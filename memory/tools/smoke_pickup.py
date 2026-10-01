import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def approve(page, test_id, reason="smoke approval", manager=None):
    await T(page, f"{test_id}-manager").wait_for()
    if manager: await T(page, f"{test_id}-manager").select_option(manager)
    await T(page, f"{test_id}-pin").fill("1234"); await T(page, f"{test_id}-reason").fill(reason); await T(page, f"{test_id}-confirm").click(); await page.wait_for_timeout(700)
    err = T(page, f"{test_id}-error"); return (await err.inner_text()) if await err.count() else None

async def open_so(page, so):
    await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(600)
    await T(page, f"pickup-queue-{so}").click(); await page.wait_for_timeout(900)
    assert await T(page, "pickup-item-card").count(), f"step1 missing for {so}"

async def err(page):
    e = T(page, "pickup-error"); return (await e.inner_text()) if await e.count() else None

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1600, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(800)
        print("queue:", await page.locator("[data-testid^='pickup-queue-so-']").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('pickup-queue-',''))"))
        print("evidence strip (seeded pending):", await page.locator("[data-testid^='evidence-so-']").evaluate_all("els=>els.map(e=>e.dataset.testid+':'+e.dataset.frames+':'+e.dataset.status)"))

        # ---- Gate 1: item mismatch → stop
        await open_so(page, "so-pu1"); print("demo banner:", await T(page, "pickup-item-demo").count())
        await T(page, "pickup-item-stop").click(); await T(page, "pickup-item-stop-reason").fill("Datejust on the counter, record says Explorer II"); await T(page, "pickup-item-stop-confirm").click(); await page.wait_for_timeout(1200)
        print("G1 back to queue:", await T(page, "pickup-customer-card").count(), "| so-pu1 still queued:", await T(page, "pickup-queue-so-pu1").count())

        # ---- Gate 2: balance → refuses; wrong self-approval refused; bypass by a different manager OK
        await open_so(page, "so-pu2"); await T(page, "pickup-item-same").click(); await page.wait_for_timeout(700)
        print("G2 gate banner:", await T(page, "pickup-balance-gate").count(), "| continue disabled:", await T(page, "pickup-next-verify").is_disabled())
        await T(page, "pickup-bypass-open").click(); await page.wait_for_timeout(600); opts = await T(page, "pickup-bypass-modal-manager").locator("option").all_inner_texts(); print("G2 approvers (Vienna excluded):", opts, "| contains Vienna:", any('Vienna' in o for o in opts))
        e = await approve(page, "pickup-bypass-modal", reason="Zelle received, screenshot verified"); print("G2 bypass err:", e, "| approved banner:", await T(page, "pickup-bypass-approved").count(), "| continue enabled:", not await T(page, "pickup-next-verify").is_disabled())
        await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(500)
        # typed code OK for so-pu2 (CD5F-22)
        await T(page, "pickup-method-code").click(); await T(page, "pickup-code").fill("CD5F-22"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(700)
        print("G2 verified:", await T(page, "pickup-verified").count()); await T(page, "pickup-next-photos").click(); await page.wait_for_timeout(500)
        await T(page, "pickup-handback-cam-placeholder").click(); await page.wait_for_timeout(1500)
        print("G2 serial:", await T(page, "pickup-serial").get_attribute("data-result"), await T(page, "pickup-serial").get_attribute("data-source"))
        await T(page, "pickup-next-complete").click(); await page.wait_for_timeout(500)
        print("G2 complete summary rows:", (await T(page, "pickup-complete-summary").inner_text()).replace("\n", " | ")[:200])
        await T(page, "pickup-complete").click(); await page.wait_for_timeout(1500)
        print("G2 done:", await T(page, "pickup-done").count(), "|", (await T(page, "pickup-done-summary").inner_text()) if await T(page, "pickup-done-summary").count() else await err(page))
        await page.wait_for_timeout(7500)
        print("G2 evidence after ~7s fast:", await page.locator("[data-testid='evidence-so-pu2']").evaluate("e=>e.dataset.frames+':'+e.dataset.status"))
        await T(page, "pickup-reset").click(); await page.wait_for_timeout(800)

        # ---- Gate 3: stale code refused with 'replaced' message; SMS resend rotates; wedge payload path; reverse QR via mock phone
        await open_so(page, "so-pu3"); await T(page, "pickup-item-same").click(); await page.wait_for_timeout(600); await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(500)
        await T(page, "pickup-method-code").click(); await T(page, "pickup-code").fill("EF2J-10"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(600)
        print("G3 stale:", (await T(page, "pickup-verify-error").inner_text())[:120])
        await T(page, "pickup-code").fill("ZZZZ-99"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(600); print("G3 wrong:", await T(page, "pickup-verify-error").inner_text())
        await T(page, "pickup-resend-sms").click(); await page.wait_for_timeout(800); print("G3 resend msg:", await T(page, "pickup-verify-msg").inner_text(), "| log rows:", await T(page, "pickup-resend-log").locator("li").count())
        await T(page, "pickup-code").fill("GH7K-93"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(600); print("G3 old-current now stale:", (await T(page, "pickup-verify-error").inner_text())[:80])
        await T(page, "pickup-method-qr_scan").click(); await page.wait_for_timeout(300); print("G3 scanner status:", await T(page, "pickup-qr-scanner").get_attribute("data-status"))
        await T(page, "pickup-qr-wedge").fill("RSPU:SO-26-0115:PQ4R-66"); await page.keyboard.press("Enter"); await page.wait_for_timeout(600); print("G3 wrong-SO QR:", await T(page, "pickup-verify-error").inner_text())
        await T(page, "pickup-qr-simulate").click(); await page.wait_for_timeout(800); print("G3 simulate scan verified:", await T(page, "pickup-verified").count(), (await T(page, "pickup-verified").inner_text())[:80])
        await T(page, "pickup-next-photos").click(); await page.wait_for_timeout(400); await T(page, "pickup-handback-cam-placeholder").click(); await page.wait_for_timeout(1500); await T(page, "pickup-next-complete").click(); await page.wait_for_timeout(400)
        # camera bypass path
        await T(page, "pickup-camera-bypass").click(); e = await approve(page, "pickup-camera-modal", reason="USB cam dead"); await page.wait_for_timeout(1000)
        print("G3 camera-bypass done:", e, await T(page, "pickup-done").count(), (await T(page, "pickup-done-summary").inner_text()) if await T(page, "pickup-done-summary").count() else "")
        await T(page, "pickup-reset").click(); await page.wait_for_timeout(600)

        # ---- Gate 4: serial mismatch hard stop → manager override; unreadable → retake
        await open_so(page, "so-pu4"); await T(page, "pickup-item-same").click(); await page.wait_for_timeout(500); await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(400)
        await T(page, "pickup-method-code").click(); await T(page, "pickup-code").fill("JK9M-44"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(600); await T(page, "pickup-next-photos").click(); await page.wait_for_timeout(400)
        await T(page, "pickup-handback-cam-placeholder").click(); await page.wait_for_timeout(1500)
        print("G4 serial:", await T(page, "pickup-serial").get_attribute("data-result"), "| result text:", (await T(page, "pickup-serial-result").inner_text())[:90], "| continue disabled:", await T(page, "pickup-next-complete").is_disabled(), "| handback bad:", await T(page, "pickup-serial-hand-back-ocr").get_attribute("data-bad"))
        await T(page, "pickup-serial-override").click(); e = await approve(page, "pickup-serial-modal", reason="Serial re-read by eye under loupe: matches record"); print("G4 override err:", e, "| override shown:", await T(page, "pickup-serial-override").count() == 0 or await T(page, "pickup-serial-override").count(), "| continue enabled:", not await T(page, "pickup-next-complete").is_disabled())
        await T(page, "pickup-leave").click(); await page.wait_for_timeout(600)
        await open_so(page, "so-pu5"); await T(page, "pickup-item-same").click(); await page.wait_for_timeout(500); await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(400)
        await T(page, "pickup-method-code").click(); await T(page, "pickup-code").fill("LM2N-55"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(600); await T(page, "pickup-next-photos").click(); await page.wait_for_timeout(400)
        await T(page, "pickup-handback-cam-placeholder").click(); await page.wait_for_timeout(1500)
        print("G4b unreadable:", await T(page, "pickup-serial").get_attribute("data-result"), "| retake btn:", await T(page, "pickup-photos-retake").count(), "| continue disabled:", await T(page, "pickup-next-complete").is_disabled())

        # ---- Clean: reverse QR via inline mock phone, then frames complete
        await T(page, "pickup-leave").click(); await page.wait_for_timeout(600)
        await open_so(page, "so-pu6"); await T(page, "pickup-item-same").click(); await page.wait_for_timeout(500); await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(400)
        await T(page, "pickup-method-reverse_qr").click(); await T(page, "pickup-reverse-show").click(); await page.wait_for_timeout(900)
        print("clean reverse QR:", await T(page, "pickup-reverse-qr").count(), "| url:", await T(page, "pickup-reverse-url").inner_text(), "| phone state:", await T(page, "rc-pickup-confirm").get_attribute("data-state"))
        await T(page, "rc-pickup-yes").click(); await page.wait_for_timeout(1200)
        print("clean confirmed:", await T(page, "rc-pickup-done").count(), "| station verified:", await T(page, "pickup-verified").count(), (await T(page, "pickup-verified").inner_text())[:70])
        await T(page, "pickup-next-photos").click(); await page.wait_for_timeout(400); await T(page, "pickup-handback-cam-placeholder").click(); await page.wait_for_timeout(1500)
        print("clean serial:", await T(page, "pickup-serial").get_attribute("data-result")); await T(page, "pickup-next-complete").click(); await page.wait_for_timeout(400)
        await T(page, "pickup-complete").click(); await page.wait_for_timeout(1500); print("clean done:", (await T(page, "pickup-done-summary").inner_text()))
        await page.wait_for_timeout(7000); print("clean evidence:", await page.locator("[data-testid='evidence-so-pu6']").evaluate("e=>e.dataset.frames+':'+e.dataset.status"))

        # ---- SO detail card + Client 360 custody + job timeline + hitlist pin for the seeded pending (needs 90 s → check incomplete status via sweep later)
        await nav(page, "/sales/so-pu6"); await page.wait_for_timeout(1200)
        print("SO card:", await T(page, "so-pickup-session").count(), "| evidence badge:", await T(page, "so-pickup-evidence").get_attribute("data-status"), "| frames imgs:", await page.locator("[data-testid='so-pickup-frames'] img").count(), "| verify:", await T(page, "so-pickup-verify").inner_text())
        await nav(page, "/sales/so-pu7"); await page.wait_for_timeout(1000); print("seeded complete SO:", await T(page, "so-pickup-evidence").get_attribute("data-status"), "| serial src:", await T(page, "so-pickup-serial").get_attribute("data-source"))
        await nav(page, "/jobs/j-pu6"); await page.wait_for_timeout(1200); tl = await T(page, "job-timeline-card").inner_text(); print("job timeline has release line:", "Released to" in tl, "| snippet:", tl[tl.find("Released to"):tl.find("Released to")+110] if "Released to" in tl else tl[:120])
        await nav(page, "/clients/c-17"); await page.wait_for_timeout(1200); cu = await T(page, "client360-custody").inner_text(); print("custody row:", cu[cu.find("Released"):cu.find("Released")+140] if "Released" in cu else cu[:150])
        await nav(page, "/sales/so-pu2"); await page.wait_for_timeout(1000); print("so-pu2 payment bypass row:", await T(page, "so-pickup-payment-bypass").count(), "| evidence:", await T(page, "so-pickup-evidence").get_attribute("data-status"))
        await nav(page, "/sales/so-pu3"); await page.wait_for_timeout(1000); print("so-pu3 camera bypass:", await T(page, "so-pickup-camera-bypass").count(), "| evidence:", await T(page, "so-pickup-evidence").get_attribute("data-status"), "| resends:", await T(page, "so-pickup-resends").locator("li").count())
        await nav(page, "/sales/so-pu1"); await page.wait_for_timeout(1000); print("so-pu1 aborts:", await T(page, "so-pickup-aborts").locator("li").count())
        # sweep: seeded so-pu8 started 40 s before page load; by now > 90 s → incomplete + pin
        await nav(page, "/sales/so-pu8"); await page.wait_for_timeout(1000); print("so-pu8 evidence:", await T(page, "so-pickup-evidence").get_attribute("data-status"))
        await page.screenshot(path="/tmp/pickup_so.png", quality=30, type="jpeg")
        print("errs:", errs)
        await b.close()
asyncio.run(main())

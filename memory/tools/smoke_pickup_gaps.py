import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")

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
        # EN column
        await nav(page, "/jobs?tab=queue"); await page.wait_for_timeout(1200)
        print("EN col:", await T(page, "tab-col-dept-EN").count(), "| count:", (await T(page, "tab-col-count-dept-EN").inner_text()) if await T(page, "tab-col-count-dept-EN").count() else None, "| E02025 in EN:", await T(page, "tab-col-dept-EN").locator("text=E02025").count())
        # Gap 1: open by reference — job number / SO digits / RSPU payload
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(800)
        await T(page, "pickup-search").fill("E02095"); await page.keyboard.press("Enter"); await page.wait_for_timeout(1000)
        print("G1 job label opened:", await T(page, "pickup-item-card").count(), "| opened via:", (await T(page, "pickup-side-opened").inner_text()) if await T(page, "pickup-side-opened").count() else None)
        await T(page, "pickup-leave").click(); await page.wait_for_timeout(500)
        await T(page, "pickup-search").fill("RSPU:SO-26-0115:PQ4R-66"); await page.keyboard.press("Enter"); await page.wait_for_timeout(1000)
        print("G1 RSPU opened:", await T(page, "pickup-item-card").count(), "| gate3 pre-verified:", await T(page, "pickup-gate-3").get_attribute("data-ok"))
        await T(page, "pickup-leave").click(); await page.wait_for_timeout(500)
        await T(page, "pickup-search").fill("ZZZ-NOPE"); await page.keyboard.press("Enter"); await page.wait_for_timeout(800); print("G1 unknown:", await err(page))
        # Gate 2: QBO read
        await open_so(page, "so-pu6"); await T(page, "pickup-item-same").click(); await page.wait_for_timeout(900)
        print("G2 gate2:", await T(page, "pickup-gate2").count(), "| sent:", (await T(page, "pickup-gate2-sent").inner_text())[:60] if await T(page, "pickup-gate2-sent").count() else None, "| qbo:", (await T(page, "pickup-gate2-qbo").inner_text())[:80] if await T(page, "pickup-gate2-qbo").count() else None, "| next enabled:", not await T(page, "pickup-next-verify").is_disabled())
        await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(500)
        # Gap 3: 3 wrong → lockout
        await T(page, "pickup-method-code").click()
        for c in ("111111", "222222", "333333"):
            await T(page, "pickup-code").fill(c); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(500)
            print("  wrong:", (await T(page, "pickup-verify-error").inner_text())[:90])
        print("G3 lockout banner:", await T(page, "pickup-lockout").count(), "| side lock:", (await T(page, "pickup-side-lock").inner_text()) if await T(page, "pickup-side-lock").count() else None, "| code tab disabled:", await T(page, "pickup-method-code").is_disabled())
        # authorized pickup person (c-17 has Folake)
        await T(page, "pickup-method-proxy").click(); await page.wait_for_timeout(300)
        opts = await T(page, "pickup-proxy-authorized").locator("option").all_inner_texts(); print("G5 authorized options:", opts)
        await T(page, "pickup-proxy-authorized").select_option("ap-c17-1"); await page.wait_for_timeout(300)
        await T(page, "pickup-proxy-cam-placeholder").click(); await page.wait_for_timeout(600)
        await T(page, "pickup-proxy-authorized-confirm").click(); await page.wait_for_timeout(800)
        print("G5 verified:", (await T(page, "pickup-verified").inner_text())[:120] if await T(page, "pickup-verified").count() else await T(page, "pickup-verify-error").inner_text())
        await T(page, "pickup-next-photos").click(); await page.wait_for_timeout(400); await T(page, "pickup-handback-cam-placeholder").click(); await page.wait_for_timeout(1500); await T(page, "pickup-next-complete").click(); await page.wait_for_timeout(400)
        print("G6 client cam:", await T(page, "pickup-client-cam").count())
        await T(page, "pickup-complete").click(); await page.wait_for_timeout(1500); print("done:", (await T(page, "pickup-done-summary").inner_text()) if await T(page, "pickup-done-summary").count() else await err(page))
        await page.wait_for_timeout(7500); print("evidence:", await page.locator("[data-testid='evidence-so-pu6']").evaluate("e=>e.dataset.frames+':'+e.dataset.status"))
        # Gap 7: ID photo manager-only on SO card (Vienna = manager → visible)
        await nav(page, "/sales/so-pu6"); await page.wait_for_timeout(1200)
        print("G7 id photo state:", await T(page, "so-pickup-id-photo").get_attribute("data-state"), "| reolink:", await T(page, "so-pickup-reolink").count(), "| invoice check:", (await T(page, "so-pickup-invoice-check").inner_text())[:80] if await T(page, "so-pickup-invoice-check").count() else None, "| tier:", (await T(page, "so-pickup-tier").inner_text())[:80])
        if await T(page, "so-pickup-id-purge-dev").count():
            await T(page, "so-pickup-id-purge-dev").click(); await page.wait_for_timeout(800); print("G7 purged:", await T(page, "so-pickup-id-photo").get_attribute("data-state"), await T(page, "so-pickup-id-purged").count())
        # Gap 4: ≥ $10k kiosk OTP (so-pu9, code 482913)
        await open_so(page, "so-pu9"); print("G4 side tier:", await T(page, "pickup-side-tier").get_attribute("data-high"))
        await T(page, "pickup-item-same").click(); await page.wait_for_timeout(900); await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(400)
        await T(page, "pickup-method-code").click(); await T(page, "pickup-code").fill("482913"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(800)
        print("G4 verified:", await T(page, "pickup-verified").count(), "| second factor panel:", await T(page, "pickup-second-factor").count(), "| kiosk:", (await T(page, "pickup-second-factor-kiosk").inner_text()) if await T(page, "pickup-second-factor-kiosk").count() else None, "| next disabled:", await T(page, "pickup-next-photos").is_disabled())
        await T(page, "pickup-sf-otp").click(); await page.wait_for_timeout(900)
        peek = (await T(page, "pickup-kiosk-otp-peek").inner_text()) if await T(page, "pickup-kiosk-otp-peek").count() else ""; code = ''.join(ch for ch in peek if ch.isdigit())[-6:]; print("G4 peek:", peek[-30:], "| code:", code)
        await T(page, "pickup-kiosk-otp").fill("000000"); await T(page, "pickup-kiosk-otp-confirm").click(); await page.wait_for_timeout(600); print("G4 wrong otp:", (await T(page, "pickup-second-factor-error").inner_text()) if await T(page, "pickup-second-factor-error").count() else None)
        await T(page, "pickup-kiosk-otp").fill(code); await T(page, "pickup-kiosk-otp-confirm").click(); await page.wait_for_timeout(800)
        print("G4 second factor ok:", await T(page, "pickup-second-factor-ok").count(), (await T(page, "pickup-second-factor-ok").inner_text())[:100] if await T(page, "pickup-second-factor-ok").count() else None, "| next enabled:", not await T(page, "pickup-next-photos").is_disabled(), "| gate3:", await T(page, "pickup-gate-3").get_attribute("data-ok"))
        await page.screenshot(path="/tmp/pickup_gaps.png", quality=30, type="jpeg")
        print("errs:", errs)
        await b.close()
asyncio.run(main())

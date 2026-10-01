import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright

async def counts(page):
    return {k: await page.locator(f"[data-testid='bin-list-{k}']").get_attribute("data-count") for k in ("in", "out", "due")}

async def scan(page, code):
    await page.locator("[data-testid='bin-scan']").fill(code); await page.locator("[data-testid='bin-scan-go']").click(); await page.wait_for_timeout(500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1400, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        # ---- JV pad · Bin tab
        await signin(page, "jv", "jv123"); await nav(page, "/rw/band"); await page.wait_for_timeout(800)
        print("url:", page.url, "bin tab:", await page.locator("[data-testid='pad-tab-bin']").count())
        await page.locator("[data-testid='pad-tab-bin']").click(); await page.wait_for_timeout(700)
        print("holder:", await page.locator("[data-testid='bin-holder']").inner_text()); print("counts line:", await page.locator("[data-testid='bin-counts']").inner_text()); print("lists:", await counts(page))
        await page.screenshot(path="/app/memory/tools/shots/bin_tab.png")
        # hand to Dre
        await page.locator("[data-testid='bin-handto-open-j-b1']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='bin-handto-Dre']").click(); await page.wait_for_timeout(600)
        print("after hand-to:", await counts(page), "row sub:", await page.locator("[data-testid='bin-out-sub-j-b1']").inner_text())
        # back in via button
        await page.locator("[data-testid='bin-back-j-b1']").click(); await page.wait_for_timeout(600); print("after back-in:", await counts(page))
        # ticket scan of an out row → back in
        await scan(page, "E02077"); print("after scan E02077 (out→in):", await counts(page))
        # ticket not in bin → error toast
        await scan(page, "E02034"); print("toast fresh ticket:", await page.locator("[data-testid='pad-toast']").inner_text() if await page.locator("[data-testid='pad-toast']").count() else (await page.locator("text=not in the bin").count()))
        # night: SAFE-VC → BIN-JV → confirm
        await scan(page, "BIN-JV"); print("bin scan w/o safe → state:", await page.locator("[data-testid='bin-scan-state']").inner_text())
        await scan(page, "SAFE-VC"); print("armed:", await page.locator("[data-testid='bin-scan-state']").get_attribute("data-armed"))
        await scan(page, "BIN-JV"); print("confirm sheet:", await page.locator("[data-testid='bin-confirm-sheet']").count(), "|", await page.locator("[data-testid='bin-confirm-line']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/bin_confirm.png")
        await page.locator("[data-testid='bin-confirm-yes']").click(); await page.wait_for_timeout(700)
        print("after confirm holder:", await page.locator("[data-testid='bin-holder']").inner_text(), "| lists:", await counts(page), "| bin due row:", await page.locator("[data-testid='bin-due-bin']").count())
        # morning: BIN-JV takes it out
        await scan(page, "BIN-JV"); print("morning holder:", await page.locator("[data-testid='bin-holder']").inner_text(), "| lists:", await counts(page))
        # mismatch path
        await scan(page, "SAFE-VC"); await scan(page, "BIN-JV"); await page.locator("[data-testid='bin-confirm-no']").click(); await page.wait_for_timeout(400)
        print("check panel:", await page.locator("[data-testid='bin-check']").count())
        for jid in ("j-b1", "j-b2", "j-b3", "j-b4", "j-b8"):
            await page.locator(f"[data-testid='bin-check-present-{jid}']").click()
        await scan(page, "E02074")  # j-b5 present by scan → j-b6 (E02075) left unscanned = MISSING
        await page.screenshot(path="/app/memory/tools/shots/bin_check.png")
        await page.locator("[data-testid='bin-check-finish']").click(); await page.wait_for_timeout(800)
        print("after check holder:", await page.locator("[data-testid='bin-holder']").inner_text(), "| lists:", await counts(page))
        await page.locator("[data-testid='bin-log-toggle']").click(); await page.wait_for_timeout(200); print("log top:", (await page.locator("[data-testid^='bin-log-bev'] >> nth=0").inner_text())[:120]); print("toast:", await page.locator("[data-testid^='pad-toast']").inner_text() if await page.locator("[data-testid^='pad-toast']").count() else "-")
        print("pending after missing:", await page.locator("[data-testid='bin-list-pending']").get_attribute("data-count"), "|", await page.locator("[data-testid='bin-pending-sub-j-b6']").inner_text())
        await nav(page, "/rw/hitlist/jv"); await page.wait_for_timeout(700); print("JV hitlist missing pin:", await page.locator("text=missing from JV bin").count()); await nav(page, "/rw/band"); await page.wait_for_timeout(600); await page.locator("[data-testid='pad-tab-bin']").click(); await page.wait_for_timeout(500)
        await scan(page, "BIN-JV"); print("out again:", await counts(page))
        # ---- Desk · Assign / Move (MH)
        ctx2 = await b.new_context(viewport={"width": 1400, "height": 1000}); await ctx2.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx2.new_page(); page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page); await nav(page, "/assign"); await page.wait_for_timeout(800)
        print("bin nodes:", await page.locator("[data-testid='dest-node-jv_bin_assign']").count(), await page.locator("[data-testid='dest-node-vc_safe']").count(), await page.locator("[data-testid='dest-node-jv_bench']").count())
        await page.locator("[data-testid='dest-node-jv_bin_assign']").click(); await page.wait_for_timeout(300)
        print("bin strip:", await page.locator("[data-testid='bulk-bin-strip']").inner_text())
        await page.locator("[data-testid='bulk-scan']").fill("E02034"); await page.keyboard.press("Enter"); await page.wait_for_timeout(400)
        await page.locator("[data-testid='bulk-scan']").fill("BIN-JV"); await page.keyboard.press("Enter"); await page.wait_for_timeout(400); print("BIN-JV at assign error:", await page.locator("[data-testid='bulk-scan-error']").inner_text() if await page.locator("[data-testid='bulk-scan-error']").count() else "none")
        await page.locator("[data-testid='bulk-commit']").click(); await page.wait_for_timeout(600); print("assign result:", await page.locator("[data-testid='bulk-results']").inner_text())
        # safe node without BIN-JV → refused
        await page.locator("[data-testid='dest-node-vc_safe']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='bulk-scan']").fill("E02034"); await page.keyboard.press("Enter"); await page.wait_for_timeout(400)
        await page.locator("[data-testid='bulk-commit']").click(); await page.wait_for_timeout(600); print("safe w/o bin:", await page.locator("[data-testid='bulk-results']").inner_text(), "| note:", await page.locator("[data-testid='bulk-bin-note']").inner_text())
        await page.locator("[data-testid='bulk-scan']").fill("BIN-JV"); await page.keyboard.press("Enter"); await page.wait_for_timeout(400); print("strip scanned:", await page.locator("[data-testid='bulk-bin-strip']").get_attribute("data-bin-scanned"))
        await page.screenshot(path="/app/memory/tools/shots/bin_desk_safe.png")
        await page.locator("[data-testid='bulk-commit']").click(); await page.wait_for_timeout(700); print("safe commit:", await page.locator("[data-testid='bulk-results']").inner_text(), "| note:", await page.locator("[data-testid='bulk-bin-note']").inner_text())
        # bench node: BIN-JV → out
        await page.locator("[data-testid='dest-node-jv_bench']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='bulk-scan']").fill("BIN-JV"); await page.keyboard.press("Enter"); await page.wait_for_timeout(300)
        await page.locator("[data-testid='bulk-commit']").click(); await page.wait_for_timeout(700); print("bench commit note:", await page.locator("[data-testid='bulk-bin-note']").inner_text())
        # single ticket override: move E02070 (in bin) to Assign band tech → leaves the bin
        await page.locator("[data-testid='dest-node-assign_band']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='bulk-scan']").fill("BAND-E02070"); await page.keyboard.press("Enter"); await page.wait_for_timeout(400)
        await page.locator("[data-testid='bulk-commit']").click(); await page.wait_for_timeout(600); print("override:", await page.locator("[data-testid='bulk-results']").inner_text())
        # custody page
        await nav(page, "/custody"); await page.wait_for_timeout(600); print("JV bin chip:", await page.locator("[data-testid='custody-bin-chip-JV']").inner_text())
        await page.locator("[data-testid='custody-toggle-JV']").click(); await page.wait_for_timeout(300); print("bin header:", await page.locator("[data-testid='custody-bin-header-JV']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/bin_custody.png")
        # shop floor
        await nav(page, "/floor"); await page.wait_for_timeout(800); print("floor counts:", await page.locator("[data-testid='map-count-vc_safe']").inner_text(), await page.locator("[data-testid='map-count-jv_bench']").inner_text())
        # pad pending list (MH on band pad)
        await nav(page, "/rw/band"); await page.wait_for_timeout(700); await page.locator("[data-testid='pad-tab-bin']").click(); await page.wait_for_timeout(600)
        print("final pad:", await page.locator("[data-testid='bin-holder']").inner_text(), await counts(page), "pending:", await page.locator("[data-testid='bin-list-pending']").get_attribute("data-count") if await page.locator("[data-testid='bin-list-pending']").count() else 0)
        print("errors:", errs); await b.close()
asyncio.run(main())

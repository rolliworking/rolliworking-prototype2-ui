import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")
txt = lambda page, t: T(page, t).inner_text()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1600, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        await nav(page, "/setup/custody"); await page.wait_for_timeout(1200)
        print("sessions:", await page.locator("[data-testid^='custody-audit-session-']").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('custody-audit-session-','')+':'+e.dataset.status)"))
        print("unaccounted count:", await T(page, "custody-unaccounted-list").get_attribute("data-count"), "| rows:", await page.locator("[data-testid^='custody-minus1-'][data-testid$='-band'],[data-testid^='custody-minus1-'][data-testid$='-case'],[data-testid^='custody-minus1-'][data-testid$='-head']").evaluate_all("els=>els.map(e=>e.dataset.testid)"))
        print("found-no-job:", await page.locator("[data-testid^='custody-stub-row-']").count(), "| coverage:", await T(page, "custody-coverage-pct").get_attribute("data-pct"))
        # live session caud-01 (open): node list + progress
        await T(page, "custody-audit-session-caud-01").click(); await page.wait_for_timeout(400)
        print("live node:", await T(page, "custody-audit-live").get_attribute("data-node"), "| nodes:", await T(page, "custody-audit-nodes").get_attribute("data-testid") and await T(page, "custody-audit-progress").inner_text().then(lambda s: s.replace('\n', ' ')) if False else (await txt(page, "custody-audit-progress")).replace("\n", " "))
        print("node statuses:", await page.locator("[data-testid^='custody-audit-node-']").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('custody-audit-node-','')+':'+e.dataset.status)"))
        # Acceptance 1: start audit (whole shop), scan a tray then two items
        await T(page, "custody-audit-scope").select_option("shop"); await T(page, "custody-audit-start-btn").click(); await page.wait_for_timeout(600)
        await T(page, "custody-audit-scan").fill("safe_await_band"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500); print("A1 node msg:", await txt(page, "custody-audit-msg"))
        await T(page, "custody-audit-scan").fill("E02032"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500); print("A1 item1:", (await txt(page, "custody-audit-msg"))[:120])
        await T(page, "custody-audit-scan").fill("E02031|B"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500); print("A1 item2:", (await txt(page, "custody-audit-msg"))[:120])
        await T(page, "custody-audit-scan").fill("ZZ-UNKNOWN-9"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500); print("A1 unknown offer:", await T(page, "custody-audit-unknown").count())
        await T(page, "custody-stub-ref").fill("16233"); await T(page, "custody-stub-create").click(); await page.wait_for_timeout(500); print("A1 stub:", (await txt(page, "custody-audit-msg"))[:100])
        await T(page, "custody-audit-close-node").click(); await page.wait_for_timeout(400); print("A1 progress:", (await txt(page, "custody-audit-progress")).replace("\n", " "))
        # pause/resume
        await T(page, "custody-audit-pause").click(); await page.wait_for_timeout(300); print("paused:", await T(page, "custody-audit-live").get_attribute("data-status")); await T(page, "custody-audit-resume").click(); await page.wait_for_timeout(300)
        # Acceptance 2: close with unscanned → unaccounted
        await T(page, "custody-audit-close").click(); await page.wait_for_timeout(800)
        print("A2 result:", (await txt(page, "custody-audit-result")).replace("\n", " | ")[:300])
        print("A2 unaccounted now:", await T(page, "custody-unaccounted-list").get_attribute("data-count"))
        # job page −1 for E02017 (j-07 band)
        await nav(page, "/jobs/j-07"); await page.wait_for_timeout(1200)
        print("job custody minus:", await T(page, "job-custody-card").get_attribute("data-minus"), "| chip:", await T(page, "custody-chip-j-07-band").get_attribute("data-state"), "| legacy:", (await txt(page, "custody-chip-j-07-band-legacy")) if await T(page, "custody-chip-j-07-band-legacy").count() else None)
        # SO so-02 at invoice: chip + send invoice → flag + pin
        await nav(page, "/sales/so-02"); await page.wait_for_timeout(1200)
        print("so strip chip:", await T(page, "custody-chip-j-07-band").get_attribute("data-state"))
        await T(page, "act-send-invoice").click(); await page.wait_for_timeout(1200)
        print("invoice send flag:", (await txt(page, "so-invoice-send-custody-1")) if await T(page, "so-invoice-send-custody-1").count() else "NONE")
        await nav(page, "/today"); await page.wait_for_timeout(1200); body = await page.inner_text("body"); print("VC hitlist has −1 at invoice:", "−1 at invoice" in body)
        # Acceptance 3: Add to custody on the SO → scan at FD → chip clears, pin clears
        await nav(page, "/sales/so-02"); await page.wait_for_timeout(1000)
        await T(page, "custody-chip-j-07-band-fix").click(); await page.wait_for_timeout(400)
        await T(page, "custody-backfill-node").select_option("finished"); await T(page, "custody-backfill-scan").fill("E02017|B"); await T(page, "custody-backfill-confirm").click(); await page.wait_for_timeout(900)
        print("A3 chip after fix:", await T(page, "custody-chip-j-07-band").get_attribute("data-state"), (await txt(page, "custody-chip-j-07-band"))[:80])
        await nav(page, "/today"); await page.wait_for_timeout(1200); body = await page.inner_text("body"); print("A3 pin cleared:", "−1 at invoice" not in body)
        # analytics: safes −1 row + coverage card
        await nav(page, "/analytics"); await page.wait_for_timeout(1500)
        print("safes −1 row:", await T(page, "safes-minus1").count(), (await txt(page, "safes-minus1-count")) if await T(page, "safes-minus1").count() else None, (await txt(page, "safes-minus1-value")) if await T(page, "safes-minus1").count() else None, "| coverage:", await T(page, "custody-coverage-pct").get_attribute("data-pct"))
        # pickup gate on so-02? (job j-07 now fixed) — check so with −1: none in queue maybe; verify ship page loads
        await nav(page, "/sales/ship"); await page.wait_for_timeout(800); print("ship page ok:", await T(page, "ship-order-card").count())
        await page.screenshot(path="/tmp/custody.png", quality=30, type="jpeg")
        print("errs:", errs)
        await b.close()
asyncio.run(main())

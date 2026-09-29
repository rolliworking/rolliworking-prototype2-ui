import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def signin(page, who="michael", pw="michael123"):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
    await page.locator(f"[data-testid='staff-card-{who}']").click(force=True); await page.wait_for_timeout(800)
    for secret in (pw,"1234"):
        if "/sign-in" not in page.url: break
        await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
    if await page.locator("[data-testid='choose-view-own']").count(): await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1400,"height":1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page)
        # ---- G6 access control
        await nav(page, "/setup/access")
        print("rows active:", await page.locator("[data-testid^='access-row-']").count(), "reports-to JV:", await page.locator("[data-testid='access-reports-to-u-jv']").inner_text(), "limits count JV:", await page.locator("[data-testid='access-limits-count-u-jv']").inner_text())
        await page.locator("[data-testid='access-limits-u-jv']").click(); await page.wait_for_timeout(500)
        print("drawer:", await page.locator("[data-testid='limits-drawer']").count(), "chain:", await page.locator("[data-testid='limits-chain']").inner_text(), "containers:", await page.locator("[data-testid^='limits-container-']").count(), "locked checked:", await page.locator("[data-testid^='limits-station-']:checked").count())
        await page.locator("[data-testid='limits-station-final_assembly']").check(); await page.locator("[data-testid='limits-save']").click(); await page.wait_for_timeout(500); print("saved:", await page.locator("[data-testid='limits-saved']").inner_text())
        await page.locator("[data-testid='limits-reports-to-select']").select_option("u-michael"); await page.locator("[data-testid='limits-reports-to-save']").click(); await page.wait_for_timeout(500); print("chain after:", await page.locator("[data-testid='limits-chain']").inner_text())
        await page.locator("[data-testid='limits-reports-to-select']").select_option("u-vienna"); await page.locator("[data-testid='limits-reports-to-save']").click(); await page.wait_for_timeout(400)
        await page.screenshot(path="/app/memory/tools/shots/limits.png")
        await page.locator("[data-testid='limits-close']").click(); await page.wait_for_timeout(300)
        # disable Sam with reason
        await page.locator("[data-testid='access-limits-u-sam']").click(); await page.wait_for_timeout(400); await page.locator("[data-testid='limits-reason']").fill("On leave until Oct 15"); await page.locator("[data-testid='limits-disable']").click(); await page.wait_for_timeout(500)
        print("disabled badge:", await page.locator("[data-testid='limits-disabled-badge']").count()); await page.locator("[data-testid='limits-close']").click(); await page.wait_for_timeout(300)
        print("active rows (Sam gone):", await page.locator("[data-testid='access-row-u-sam']").count()); await page.locator("[data-testid='access-status-disabled']").click(); await page.wait_for_timeout(300); print("disabled filter rows:", await page.locator("[data-testid^='access-row-']").count(), await page.locator("[data-testid='access-disabled-u-sam']").count())
        await page.locator("[data-testid='access-status-all']").click(); await page.wait_for_timeout(300)
        # new user from template
        await page.locator("[data-testid='access-new-user']").click(); await page.wait_for_timeout(400); await page.locator("[data-testid='new-user-template']").select_option("u-jv"); print("template summary:", (await page.locator("[data-testid='new-user-template-summary']").inner_text())[:140])
        await page.locator("[data-testid='new-user-first']").fill("priya"); await page.locator("[data-testid='new-user-short']").fill("PR"); await page.locator("[data-testid='new-user-create']").click(); await page.wait_for_timeout(700)
        print("flash:", await page.locator("[data-testid='access-flash']").inner_text() if await page.locator("[data-testid='access-flash']").count() else None, "new row:", await page.locator("[data-testid='access-row-u-priya']").count(), "reports:", await page.locator("[data-testid='access-reports-to-u-priya']").inner_text(), "limits:", await page.locator("[data-testid='access-limits-count-u-priya']").inner_text())
        print("log top:", (await page.locator("[data-testid='access-log'] li").first.inner_text())[:160])
        await page.screenshot(path="/app/memory/tools/shots/access.png")
        # choose-view groups derive from tree
        await nav(page, "/choose-view"); print("groups:", await page.locator("[data-testid^='choose-view-group-']").evaluate_all("els=>els.map(e=>[e.dataset.testid, e.querySelectorAll('button').length])"))
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1000)
        # ---- G8 device page + offline queue
        await nav(page, "/rw/device"); print("device rows:", await page.locator("[data-testid^='device-'][data-ok]").evaluate_all("els=>els.map(e=>[e.dataset.testid,e.dataset.ok])"))
        await page.locator("[data-testid='device-simulate-offline']").check(); await page.wait_for_timeout(300); print("offline banner:", await page.locator("[data-testid='rw-offline-banner']").count())
        await nav(page, "/rw/station"); await page.locator("[data-testid='station-pick-testing']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='station-scan']").fill("E02016"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500)
        print("queued msg:", await page.locator("[data-testid='station-queued']").inner_text() if await page.locator("[data-testid='station-queued']").count() else None, "log rows (expect 0):", await page.locator("[data-testid='station-log'] li").count())
        await nav(page, "/rw/device"); await page.locator("[data-testid='device-simulate-offline']").uncheck(); await page.wait_for_timeout(300); print("replay banner:", await page.locator("[data-testid='rw-replay-banner']").count()); await page.locator("[data-testid='rw-replay-now']").click(); await page.wait_for_timeout(600); print("replay banner after:", await page.locator("[data-testid='rw-replay-banner']").count())
        await page.screenshot(path="/app/memory/tools/shots/device.png")
        # 44pt check on rw shell buttons
        small = await page.locator("[data-testid='rw-shell'] button").evaluate_all("els=>els.filter(e=>e.offsetParent && e.getBoundingClientRect().height<44).map(e=>e.dataset.testid||e.textContent.trim().slice(0,20))"); print("buttons <44pt on device page:", small)
        # long-press owner path
        brand = page.locator("[data-testid='rw-brand']"); box = await brand.bounding_box(); await page.mouse.move(box['x']+10, box['y']+10); await page.mouse.down(); await page.wait_for_timeout(1400); await page.mouse.up(); await page.wait_for_timeout(300); print("owner gate:", await page.locator("[data-testid='owner-pin-gate']").count())
        await page.locator("[data-testid='owner-pin-input']").fill("1234"); await page.locator("[data-testid='owner-pin-go']").click(); await page.wait_for_timeout(1200); print("url after owner path:", page.url)
        # ---- band pad: reconcile + send to vendor (view as JV)
        await page.locator("[data-testid='choose-view-JV']").click(); await page.wait_for_timeout(2000); print("url as JV:", page.url)
        if "/rw/band" not in page.url: await nav(page, "/rw/band")
        await page.locator("[data-testid='pad-tab-jobs']").click(); await page.wait_for_timeout(600)
        print("reconcile:", await page.locator("[data-testid='container-reconcile']").count(), (await page.locator("[data-testid='container-reconcile']").inner_text())[:80] if await page.locator("[data-testid='container-reconcile']").count() else '')
        if await page.locator("[data-testid='reconcile-open']").count():
            await page.locator("[data-testid='reconcile-open']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='reconcile-scan']").fill("BIN-JV"); await page.keyboard.press("Enter"); await page.wait_for_timeout(300); print("status:", await page.locator("[data-testid='reconcile-status']").inner_text(), "items:", await page.locator("[data-testid^='reconcile-item-']").count())
            first = page.locator("[data-testid^='reconcile-present-']").first
            if await first.count(): await first.click()
            await page.locator("[data-testid='reconcile-finish']").click(); await page.wait_for_timeout(600); print("result:", await page.locator("[data-testid='reconcile-result']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/band.png")
        v = page.locator("[data-testid^='pad-send-vendor-']").first
        if await v.count():
            await v.click(); await page.wait_for_timeout(500); print("swo modal:", await page.locator("[data-testid='swo-modal']").count(), "point:", await page.locator("[data-testid='swo-form-point']").input_value(), "predicted:", await page.locator("[data-testid='swo-form-predicted']").input_value())
            await page.locator("[data-testid='swo-work']").fill("Bracelet refinish — brushed"); await page.locator("[data-testid='swo-save']").click(); await page.wait_for_timeout(800); print("toast:", (await page.locator("[data-testid='pad-toast']").inner_text())[:120] if await page.locator("[data-testid='pad-toast']").count() else 'no toast testid')
        print("errors:", errs)
        await b.close()
asyncio.run(main())

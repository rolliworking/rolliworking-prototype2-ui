import asyncio, sys
from playwright.async_api import async_playwright
BASE = "http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123", "1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        if await page.locator("[data-testid='choose-view-own']").count(): await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)
        # 1. list
        await nav(page, "/swo")
        rows = page.locator("[data-testid^='swo-row-'][data-testid$='']").filter(has=page.locator("td"))
        n = await page.locator("tr[data-testid^='swo-row-']").count(); print("list rows:", n, "| sub:", (await page.locator("h1").first.inner_text()))
        await page.screenshot(path="/app/memory/tools/shots/swo_list.png", full_page=False)
        # find the james mixed box (5 lines) via search
        await page.locator("[data-testid='swo-search']").fill("james"); await page.wait_for_timeout(300)
        ids = await page.locator("tr[data-testid^='swo-row-']").evaluate_all("els=>els.map(e=>[e.dataset.testid.replace('swo-row-',''), e.children[3].innerText])")
        print("james boxes:", ids)
        mixed = next((i for i, t in ids if t.endswith('/ 5')), ids[0][0])
        # 2. hub page
        await nav(page, f"/swo/{mixed}")
        print("hub:", await page.locator("[data-testid='hub-number']").inner_text(), await page.locator("[data-testid^='hub-stage-']").first.inner_text(), await page.locator("[data-testid^='hub-count-']").first.inner_text(), "| lines:", await page.locator("tr[data-testid^='hub-line-']").count(), "| shipments:", await page.locator("[data-testid^='shipment-'][data-direction]").count(), "| barcode:", await page.locator("[data-testid='hub-barcode']").get_attribute("data-value"))
        stages = await page.locator("tr[data-testid^='hub-line-']").evaluate_all("els=>els.map(e=>e.dataset.stage)"); print("  line stages:", stages)
        await page.screenshot(path="/app/memory/tools/shots/swo_hub_mixed.png", full_page=True)
        # receive one Returning line
        rc = page.locator("[data-testid^='hub-line-receive-']")
        if await rc.count():
            await rc.first.click(); await page.wait_for_timeout(300)
            ticks = page.locator("[data-testid^='receive-tick-']"); print("  receive ticks:", await ticks.count())
            if await ticks.count() > 1: await ticks.nth(1).uncheck()
            await page.locator("[data-testid='receive-confirm']").click(); await page.wait_for_timeout(1000)
            print("  after receive flash:", await page.locator("[data-testid='rs-msg']").inner_text() if await page.locator("[data-testid='rs-msg']").count() else None, "| err:", await page.locator("[data-testid='rs-error']").inner_text() if await page.locator("[data-testid='rs-error']").count() else None)
            print("  parts states:", await page.locator("[data-testid^='line-part-']").evaluate_all("els=>els.map(e=>e.dataset.state)"))
        # 3. new box for Claudio with a queue line → outbound label via selection
        await nav(page, "/swo")
        await page.locator("[data-testid='swo-new']").click(); await page.wait_for_timeout(400)
        await page.locator("[data-testid='swo-vendor']").select_option("v-claudio"); await page.wait_for_timeout(200)
        await page.locator("[data-testid='swo-form-point']").select_option("Vienna")
        await page.locator("[data-testid='swo-save']").click(); await page.wait_for_timeout(1500)
        print("new hub url:", page.url, "| number:", await page.locator("[data-testid='hub-number']").inner_text(), "| unprinted:", await page.locator("[data-testid='hub-unprinted']").count())
        await page.locator("[data-testid='hub-add-line']").click(); await page.wait_for_timeout(500)
        await page.locator("[data-testid='add-line-search']").fill(""); await page.wait_for_timeout(500)
        print("  candidates on-lane flags:", await page.locator("[data-testid^='add-line-job-']").evaluate_all("els=>els.map(e=>e.dataset.onLane)"))
        first = page.locator("[data-testid^='add-line-job-'][data-on-lane='false']").first; jt = await first.inner_text(); await first.click()
        await page.locator("[data-testid='add-line-comp-band']").click() if not (await page.locator("[data-testid='add-line-comp-band']").get_attribute("aria-pressed")) == "true" else None
        await page.locator("[data-testid='add-line-work']").fill("Re-pin links 3-5")
        await page.locator("[data-testid='add-line-parts-bracelet']").click(); await page.locator("[data-testid='add-line-parts-other']").fill("Spare screws"); await page.keyboard.press("Enter")
        await page.locator("[data-testid='add-line-save']").click(); await page.wait_for_timeout(1200)
        if await page.locator("[data-testid='add-line-error']").count():
            print("  ADD LINE ERROR:", await page.locator("[data-testid='add-line-error']").inner_text())
            await page.locator("[data-testid='add-line-search']").fill("Nak"); await page.wait_for_timeout(500); await page.locator("[data-testid^='add-line-job-']").first.click(); await page.locator("[data-testid='add-line-save']").click(); await page.wait_for_timeout(1200)
            if await page.locator("[data-testid='add-line-error']").count(): print("  ADD LINE ERROR 2:", await page.locator("[data-testid='add-line-error']").inner_text()); await page.locator("[data-testid='swo-add-line-close']").click()
        print("  add line:", jt.replace("\n", " ")[:60], "| flash:", await page.locator("[data-testid='rs-msg']").inner_text() if await page.locator("[data-testid='rs-msg']").count() else None, "| err:", await page.locator("[data-testid='rs-error']").inner_text() if await page.locator("[data-testid='rs-error']").count() else None, "| lines:", await page.locator("tr[data-testid^='hub-line-']").count(), "| summary:", await page.locator("[data-testid='hub-sent-summary']").inner_text() if await page.locator("[data-testid='hub-sent-summary']").count() else None)
        new_hub = page.url.split('/swo/')[-1]
        job_href = await page.locator("[data-testid^='hub-line-job-']").first.get_attribute("href")
        # print label
        await page.locator("[data-testid='hub-print']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='hub-print-go']").click(); await page.wait_for_timeout(800)
        print("  printed:", await page.locator("[data-testid='hub-printed']").count(), await page.locator("[data-testid='rs-msg']").inner_text() if await page.locator("[data-testid='rs-msg']").count() else None)
        # select all → outbound
        await page.locator("[data-testid='hub-line-check-all']").check(); await page.wait_for_timeout(200)
        print("  sel bar:", await page.locator("[data-testid='hub-sel-bar']").count(), "outbound btn:", await page.locator("[data-testid='hub-sel-outbound']").count())
        await page.locator("[data-testid='hub-sel-outbound']").click(); await page.wait_for_timeout(1200)
        print("  after outbound:", await page.locator("[data-testid='rs-msg']").inner_text() if await page.locator("[data-testid='rs-msg']").count() else None, "| err:", await page.locator("[data-testid='rs-error']").inner_text() if await page.locator("[data-testid='rs-error']").count() else None, "| stages:", await page.locator("tr[data-testid^='hub-line-']").evaluate_all("els=>els.map(e=>e.dataset.stage)"), "| shipments:", await page.locator("[data-testid^='shipment-'][data-direction]").evaluate_all("els=>els.map(e=>e.dataset.direction+':'+e.dataset.status)"))
        # simulate delivered → forward
        await page.locator("[data-testid^='shipment-deliver-']").first.click(); await page.wait_for_timeout(1000)
        print("  after deliver:", await page.locator("tr[data-testid^='hub-line-']").evaluate_all("els=>els.map(e=>e.dataset.stage)"))
        await page.locator("[data-testid='hub-line-check-all']").check(); await page.locator("[data-testid='hub-sel-forward']").click(); await page.wait_for_timeout(1200)
        print("  after forward:", await page.locator("[data-testid='rs-msg']").inner_text() if await page.locator("[data-testid='rs-msg']").count() else None, "| stages:", await page.locator("tr[data-testid^='hub-line-']").evaluate_all("els=>els.map(e=>e.dataset.stage)"))
        await page.screenshot(path="/app/memory/tools/shots/swo_hub_new.png", full_page=True)
        # 4. job page breadcrumbs
        await nav(page, job_href)
        print("job away:", await page.locator("[data-testid^='away-group-']").all_inner_texts(), "| legs:", await page.locator("[data-testid^='outsource-leg-']").count(), "| open link:", await page.locator("[data-testid^='outsource-open-']").first.inner_text() if await page.locator("[data-testid^='outsource-open-']").count() else None)
        await nav(page, "/jobs/j-31"); print("j-31 away (missing):", await page.locator("[data-testid^='away-group-']").all_inner_texts(), "| missing badge:", await page.locator("[data-testid^='away-missing-']").count(), "| flow blockers:", await page.locator("[data-testid^='flow-blocker-']").all_inner_texts())
        await nav(page, "/jobs/j-os1"); print("j-os1 away:", await page.locator("[data-testid^='away-group-']").all_inner_texts())
        # 5. concierge panel grouping + selection
        await nav(page, "/concierge")
        if await page.locator("[data-testid='concierge-view-track']").count(): await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='cell-v-james-at_vendor']").click(); await page.wait_for_timeout(800)
        print("panel groups:", await page.locator("[data-testid^='hub-group-'][data-lines]").evaluate_all("els=>els.map(e=>e.dataset.lines)"), "| headers:", await page.locator("[data-testid^='hub-group-header-']").count(), "| barcodes:", await page.locator("[data-testid^='hub-group-barcode-']").count())
        checks = page.locator("[data-testid^='panel-line-check-']"); await checks.nth(0).check(); await checks.nth(1).check(); await page.wait_for_timeout(200)
        print("  sel bar:", await page.locator("[data-testid='panel-sel-bar']").get_attribute("data-count"))
        await page.locator("[data-testid='panel-sel-forward']").click(); await page.wait_for_timeout(1500)
        print("  after panel forward:", await page.locator("[data-testid='rs-msg']").inner_text() if await page.locator("[data-testid='rs-msg']").count() else None, "| err:", await page.locator("[data-testid='rs-error']").inner_text() if await page.locator("[data-testid='rs-error']").count() else None)
        await page.screenshot(path="/app/memory/tools/shots/swo_panel.png", full_page=False)
        await page.locator("[data-testid='panel-close']").click(); await page.wait_for_timeout(300)
        # 6. assign map: scan SWO code
        await page.locator("[data-testid='concierge-view-assign']").click(); await page.wait_for_timeout(500)
        await page.locator("[data-testid='action-lookup-input']").fill(mixed); await page.locator("[data-testid='action-lookup-go']").click(); await page.wait_for_timeout(600)
        print("assign strip after SWO scan:", await page.locator("[data-testid='action-strip']").get_attribute("data-count") if await page.locator("[data-testid='action-strip']").count() else None, "| hub tags:", (await page.locator("[data-testid^='action-hub-']").all_inner_texts())[:2], "| err:", await page.locator("[data-testid='action-error']").inner_text() if await page.locator("[data-testid='action-error']").count() else None)
        rm = page.locator("[data-testid^='action-remove-']")
        if await rm.count(): await rm.first.click(); await page.wait_for_timeout(200); print("  trimmed to:", await page.locator("[data-testid='action-strip']").get_attribute("data-count"))
        await page.screenshot(path="/app/memory/tools/shots/swo_assign.png", full_page=False)
        # 7. RW hub route
        await nav(page, f"/rw/swo/{new_hub}"); print("rw hub:", page.url.split('3000')[-1], await page.locator("[data-testid='hub-number']").inner_text() if await page.locator("[data-testid='hub-number']").count() else "NOT RENDERED")
        await page.screenshot(path="/app/memory/tools/shots/swo_rw_hub.png", full_page=False)
        print("page errors:", errs)
        await b.close()
asyncio.run(main())

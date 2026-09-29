import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1500,"height":950}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1500)
        await nav(page, "/concierge")
        lanes = await page.locator("[data-testid^='lane-v-'][data-ships]").evaluate_all("els=>els.map(e=>e.dataset.testid)"); print("lanes:", lanes)
        cells = await page.locator("[data-testid^='cell-']").evaluate_all("els=>els.map(e=>[e.dataset.testid,+e.dataset.count,+e.dataset.late,+e.dataset.redo])")
        print("cells != 10:", [c for c in cells if c[1]!=10], "total:", sum(c[1] for c in cells), "late cells:", sum(1 for c in cells if c[2]>0), "redo cells:", [c[0] for c in cells if c[3]>0])
        # panel: counts = cards, split adds up
        mism=[]
        for tid,count,late,redo in cells:
            await page.locator(f"[data-testid='{tid}']").click(); await page.wait_for_timeout(500)
            n = await page.locator("[data-testid='concierge-panel'] [data-testid^='concierge-card-']:not([data-testid^='concierge-card-job-'])").count()
            pc = await page.locator("[data-testid='panel-count']").inner_text()
            ov = await page.locator("[data-testid='group-overdue']").get_attribute("data-count") if await page.locator("[data-testid='group-overdue']").count() else None
            if n!=count or int(pc)!=count or (ov is not None and int(ov)!=late): mism.append((tid,count,n,pc,late,ov))
        print("panel mismatches:", mism)
        print("selected cell highlighted:", await page.locator("[data-testid^='cell-'][data-selected='true']").count(), "board still visible:", await page.locator("[data-testid='concierge-board']").is_visible())
        await page.screenshot(path="/app/memory/tools/shots/panel.png")
        # card content checks in panel
        await page.locator("[data-testid='cell-v-chronosky-inbound']").click(); await page.wait_for_timeout(500)
        print("tracking links:", await page.locator("[data-testid='concierge-panel'] [data-testid='swo-tracking-return']").count(), "status:", (await page.locator("[data-testid='concierge-panel'] [data-testid='swo-tracking-status-return']").first.inner_text())[:60], "qbo:", (await page.locator("[data-testid='concierge-panel'] [data-testid^='swo-qbo-']").first.inner_text())[:60])
        print("push-qbo buttons (expect 0):", await page.locator("[data-testid='swo-qbo-push']").count())
        # close via Esc; same cell toggles
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300); print("panel after Esc:", await page.locator("[data-testid='concierge-panel']").count())
        await page.locator("[data-testid='cell-v-cm-queue']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='cell-v-cm-queue']").click(); await page.wait_for_timeout(300); print("panel after re-tap:", await page.locator("[data-testid='concierge-panel']").count())
        # outstanding in panel
        await page.locator("[data-testid='lane-name-v-chronosky']").click(); await page.wait_for_timeout(500); print("outstanding panel rows:", await page.locator("[data-testid^='outstanding-swo']").count(), await page.locator("[data-testid='concierge-panel']").get_attribute("data-kind")); await page.locator("[data-testid='panel-close']").click(); await page.wait_for_timeout(300)
        # ACTION view
        await page.locator("[data-testid='concierge-view-action']").click(); await page.wait_for_timeout(800)
        print("tracks:", await page.locator("[data-testid^='track-v-']").count(), "redo loops:", await page.locator("[data-testid^='redo-loop-']").count())
        # lookup a queued Chronosky job → legal nodes; pick box; scan; commit
        # find a queue chronosky card number
        await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(500)
        await page.locator("[data-testid='cell-v-chronosky-queue']").click(); await page.wait_for_timeout(500)
        nums = await page.locator("[data-testid='concierge-panel'] [data-testid^='concierge-card-job-']").evaluate_all("els=>els.slice(0,2).map(e=>e.textContent)"); print("queue jobs:", nums)
        await page.locator("[data-testid='panel-close']").click(); await page.locator("[data-testid='concierge-view-action']").click(); await page.wait_for_timeout(600)
        for n in nums:
            await page.fill("[data-testid='action-lookup-input']", n); await page.locator("[data-testid='action-lookup-go']").click(); await page.wait_for_timeout(300)
        print("selection:", await page.locator("[data-testid^='action-sel-']").count(), "err:", await page.locator("[data-testid='action-error']").all_inner_texts())
        legal = await page.locator("[data-testid^='anode-v-chronosky-'][data-legal='true']").evaluate_all("els=>els.map(e=>e.dataset.testid)"); print("legal nodes:", legal)
        await page.locator("[data-testid='anode-v-chronosky-box']").click(); await page.wait_for_timeout(300)
        print("step kind:", await page.locator("[data-testid='action-step']").get_attribute("data-kind"), "commit disabled:", await page.locator("[data-testid='action-commit']").is_disabled())
        for n in nums:
            await page.fill("[data-testid='action-scan-input']", n); await page.locator("[data-testid='action-scan-go']").click(); await page.wait_for_timeout(200)
        print("commit enabled after scans:", not await page.locator("[data-testid='action-commit']").is_disabled())
        await page.locator("[data-testid='action-commit']").click(); await page.wait_for_timeout(1200)
        print("chronosky queue/sent now:", await page.locator("[data-testid='anode-count-v-chronosky-queue']").inner_text(), "/", await page.locator("[data-testid='anode-count-v-chronosky-sent']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/action.png")
        # status move: lookup a sent job → at_vendor status (no scan)
        await page.fill("[data-testid='action-lookup-input']", nums[0]); await page.locator("[data-testid='action-lookup-go']").click(); await page.wait_for_timeout(300)
        legal = await page.locator("[data-testid^='anode-v-chronosky-'][data-legal='true']").evaluate_all("els=>els.map(e=>e.dataset.testid)"); print("legal from In route:", legal)
        await page.locator("[data-testid='anode-v-chronosky-at_vendor']").click(); await page.wait_for_timeout(300); print("status step:", await page.locator("[data-testid='action-step']").get_attribute("data-kind"), "commit enabled:", not await page.locator("[data-testid='action-commit']").is_disabled())
        await page.locator("[data-testid='action-commit']").click(); await page.wait_for_timeout(1000)
        # view remembered
        await nav(page, "/dashboard"); await nav(page, "/concierge"); print("view remembered (action):", await page.locator("[data-testid='concierge-view-action']").get_attribute("data-selected"))
        # track view reflects: back to track, chronosky sent count
        await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(500); print("track chronosky sent/at_vendor:", await page.locator("[data-testid='cell-v-chronosky-sent']").get_attribute("data-count"), await page.locator("[data-testid='cell-v-chronosky-at_vendor']").get_attribute("data-count"))
        print("pageerrors:", errs[:3])
        await b.close()
asyncio.run(main())

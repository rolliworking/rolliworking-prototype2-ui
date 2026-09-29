import asyncio, sys
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def counts(page, v):
    return await page.locator(f"[data-testid^='anode-count-{v}-']").evaluate_all("els=>Object.fromEntries(els.map(e=>[e.dataset.testid.split('-').pop(), +e.dataset.count]))")
async def main():
    pad = len(sys.argv) > 1 and sys.argv[1] == "pad"
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1180 if pad else 1500,"height":820 if pad else 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        who = "mm" if pad else "michael"; pw = "mm123" if pad else "michael123"
        await page.locator(f"[data-testid='staff-card-{who}']").click(force=True); await page.wait_for_timeout(800)
        for secret in (pw,"1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        if await page.locator("[data-testid='choose-view-own']").count(): await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)
        if pad: await nav(page, "/rw/concierge")
        else:
            await nav(page, "/concierge"); await page.locator("[data-testid='concierge-view-action']").click(); await page.wait_for_timeout(500)
        print("tracks:", await page.locator("[data-testid^='track-']").count(), "pad:", await page.locator("[data-testid='concierge-action']").get_attribute("data-pad"))
        # 1. pack two Chronosky queue jobs via the tappable count → panel → load into strip
        c0 = await counts(page, "v-chronosky"); print("chronosky before:", c0)
        await page.locator("[data-testid='anode-count-v-chronosky-queue']").click(); await page.wait_for_timeout(500)
        print("panel:", await page.locator("[data-testid='concierge-panel']").count(), "title:", await page.locator("[data-testid='panel-title']").inner_text(), "width:", (await page.locator("[data-testid='concierge-panel']").bounding_box())['width'])
        picks = page.locator("[data-testid^='panel-pick-']"); ids = [await picks.nth(i).get_attribute("data-testid") for i in range(2)]
        await picks.nth(0).click(); await page.wait_for_timeout(400)
        print("panel closed after pick:", await page.locator("[data-testid='concierge-panel']").count() == 0, "strip:", await page.locator("[data-testid='action-strip']").get_attribute("data-count"))
        await page.locator("[data-testid='anode-count-v-chronosky-queue']").click(); await page.wait_for_timeout(400); await page.locator(f"[data-testid='{ids[1]}']").click(); await page.wait_for_timeout(400)
        print("strip count:", await page.locator("[data-testid='action-strip']").get_attribute("data-count"), "current pulses:", await page.locator("[data-testid='anode-v-chronosky-queue'][data-current='true']").count(), "legal nodes:", await page.locator("[data-testid^='anode-v-chronosky-'][data-legal='true']").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop())"))
        print("dimmed tracks:", await page.locator("[data-testid^='track-'].opacity-40").count())
        ests = await page.locator("[data-testid^='action-sel-'] span.font-mono").all_inner_texts(); print("ests:", ests)
        await page.locator("[data-testid='anode-v-chronosky-box']").click(); await page.wait_for_timeout(300)
        print("bottom:", await page.locator("[data-testid='action-bottom-title']").inner_text(), "|", (await page.locator("[data-testid='action-bottom-req']").inner_text())[:120])
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(400); print("refused w/o scan:", await page.locator("[data-testid='action-error']").inner_text() if await page.locator("[data-testid='action-error']").count() else 'NO ERROR', "| queue still:", (await counts(page, "v-chronosky"))['queue'])
        for e in ests: await page.locator("[data-testid='action-scan-input']").fill(e); await page.keyboard.press("Enter"); await page.wait_for_timeout(200)
        print("scanned:", await page.locator("[data-testid^='action-scanstate-']").all_inner_texts())
        await page.screenshot(path="/app/memory/tools/shots/action_pack.png")
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(900)
        c1 = await counts(page, "v-chronosky"); print("chronosky after pack:", c1, "toast/flash:", (await page.locator("[data-testid^='pad-toast'], [data-testid='rs-flash'], [data-testid='flash']").all_inner_texts())[:1])
        # 2. redo from Jacques Inspection
        await page.locator("[data-testid='anode-count-v-jacques-inspection']").click(); await page.wait_for_timeout(400); await page.locator("[data-testid^='panel-pick-']").first.click(); await page.wait_for_timeout(400)
        print("jacques legal:", await page.locator("[data-testid^='anode-v-jacques-'][data-legal='true']").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop()+':'+e.title.slice(0,20))"))
        j0 = await counts(page, "v-jacques")
        await page.locator("[data-testid='anode-v-jacques-box']").click(); await page.wait_for_timeout(300); print("redo bottom:", await page.locator("[data-testid='action-bottom']").get_attribute("data-kind"), await page.locator("[data-testid='action-bottom-title']").inner_text())
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(300); print("refused w/o reason+scan:", (await page.locator("[data-testid='action-error']").inner_text())[:80])
        est = (await page.locator("[data-testid^='action-sel-'] span.font-mono").all_inner_texts())[0]; await page.locator("[data-testid='action-scan-input']").fill(est); await page.keyboard.press("Enter"); await page.wait_for_timeout(200)
        await page.locator("[data-testid='action-reason']").fill("Clasp gap 0.4 mm — fails QC"); await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(900)
        j1 = await counts(page, "v-jacques"); print("jacques before/after redo:", j0, j1, "redo loop live:", await page.locator("[data-testid='redo-loop-v-jacques']").get_attribute("data-live"))
        # 3. Received without scan refuses
        await page.locator("[data-testid='anode-count-v-chronosky-inbound']").click(); await page.wait_for_timeout(400); await page.locator("[data-testid^='panel-pick-']").first.click(); await page.wait_for_timeout(400)
        await page.locator("[data-testid='anode-v-chronosky-arrival']").click(); await page.wait_for_timeout(300); r0 = await counts(page, "v-chronosky")
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(400); r1 = await counts(page, "v-chronosky"); print("received refused:", (await page.locator("[data-testid='action-error']").inner_text())[:90], "| counts unchanged:", r0 == r1)
        # wedge scanner: type est digits with no input focused
        await page.locator("[data-testid='action-cancel-dest']").click(); await page.locator("[data-testid='action-clear']").click(); await page.wait_for_timeout(200)
        await page.mouse.click(5, 400); await page.keyboard.type(ests[0], delay=10); await page.keyboard.press("Enter"); await page.wait_for_timeout(400)
        print("wedge lookup strip:", await page.locator("[data-testid='action-strip']").get_attribute("data-count") if await page.locator("[data-testid='action-strip']").count() else 0, "(job is now In route — legal:", await page.locator("[data-testid^='anode-v-chronosky-'][data-legal='true']").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop())"), ")")
        await page.screenshot(path=f"/app/memory/tools/shots/action_{'pad' if pad else 'desk'}.png")
        if not pad:
            await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(500); print("track view chronosky queue/sent:", await page.locator("[data-testid='cell-v-chronosky-queue']").get_attribute("data-count"), await page.locator("[data-testid='cell-v-chronosky-sent']").get_attribute("data-count"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())

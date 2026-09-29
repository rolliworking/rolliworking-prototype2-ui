import asyncio, sys
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def tcounts(page, v):
    return await page.locator(f"[data-testid^='tnode-count-{v}-']").evaluate_all("els=>Object.fromEntries(els.map(e=>[e.dataset.testid.split('-').pop(), +e.dataset.count]))")
async def acounts(page, v):
    return await page.locator(f"[data-testid^='anode-count-{v}-']").evaluate_all("els=>Object.fromEntries(els.map(e=>[e.dataset.testid.split('-').pop(), +e.dataset.count]))")
async def view(page, v):
    await page.locator(f"[data-testid='concierge-view-{v}']").click(); await page.wait_for_timeout(400)
async def load_from_track(page, vendor, stage, idx=0):
    await view(page, "track"); await page.locator(f"[data-testid='tnode-count-{vendor}-{stage}']").click(); await page.wait_for_timeout(500)
    await page.locator("[data-testid^='panel-pick-']").nth(idx).click(); await page.wait_for_timeout(500)
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
        await nav(page, "/rw/concierge" if pad else "/concierge")
        # TRACK checks
        await view(page, "track")
        print("toggle labels:", await page.locator("[data-testid='concierge-view-toggle'] button").all_inner_texts(), "default view track visible:", await page.locator("[data-testid='concierge-track']").is_visible(), "assign hidden:", not await page.locator("[data-testid='concierge-assign']").is_visible())
        print("track: no lookup bar visible:", not await page.locator("[data-testid='action-lookup-input']").is_visible(), "| ages:", await page.locator("[data-testid^='tnode-age-v-chronosky-']").all_inner_texts())
        c0 = await tcounts(page, "v-chronosky"); print("chronosky before:", c0)
        await page.locator("[data-testid='tlane-name-v-chronosky']").click(); await page.wait_for_timeout(400); print("outstanding panel:", await page.locator("[data-testid='concierge-panel']").get_attribute("data-kind")); await page.locator("[data-testid='panel-close']").click(); await page.wait_for_timeout(200)
        await page.locator("[data-testid='tnode-count-v-chronosky-queue']").click(); await page.wait_for_timeout(500)
        print("stage panel:", await page.locator("[data-testid='panel-title']").inner_text(), "| node highlighted:", await page.locator("[data-testid='tnode-count-v-chronosky-queue']").get_attribute("aria-pressed"), "| picks:", await page.locator("[data-testid^='panel-pick-']").count(), "| label:", (await page.locator("[data-testid^='panel-pick-']").first.inner_text())[:40])
        await page.screenshot(path=f"/app/memory/tools/shots/track_{'pad' if pad else 'desk'}.png")
        # pick → switches to ASSIGN with the job loaded
        await page.locator("[data-testid^='panel-pick-']").first.click(); await page.wait_for_timeout(500)
        print("switched to assign:", await page.locator("[data-testid='concierge-view-assign']").get_attribute("data-selected"), "| strip:", await page.locator("[data-testid='action-strip']").get_attribute("data-count"), "| panel closed:", await page.locator("[data-testid='concierge-panel']").count()==0)
        # second job via Track again (strip must survive the flip)
        await load_from_track(page, "v-chronosky", "queue", 1)
        print("strip after 2nd pick:", await page.locator("[data-testid='action-strip']").get_attribute("data-count"), "| assign counts display-only (no button):", await page.locator("button[data-testid^='anode-count-']").count() == 0, "| legal:", await page.locator("[data-testid^='anode-v-chronosky-'][data-legal='true']").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop())"))
        ests = await page.locator("[data-testid^='action-sel-'] span.font-mono").all_inner_texts(); print("ests:", ests)
        await page.locator("[data-testid='anode-v-chronosky-box']").click(); await page.wait_for_timeout(300); print("bottom:", await page.locator("[data-testid='action-bottom-title']").inner_text())
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(300); print("refused w/o scan:", (await page.locator("[data-testid='action-error']").inner_text())[:70])
        for e in ests: await page.locator("[data-testid='action-scan-input']").fill(e); await page.keyboard.press("Enter"); await page.wait_for_timeout(200)
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(900)
        print("assign counts after pack:", await acounts(page, "v-chronosky"))
        await view(page, "track"); print("track counts after pack (live):", await tcounts(page, "v-chronosky"))
        # redo from Jacques inspection
        await load_from_track(page, "v-jacques", "inspection", 0)
        await page.locator("[data-testid='anode-v-jacques-box']").click(); await page.wait_for_timeout(300); print("redo kind:", await page.locator("[data-testid='action-bottom']").get_attribute("data-kind"))
        est = (await page.locator("[data-testid^='action-sel-'] span.font-mono").all_inner_texts())[0]; await page.locator("[data-testid='action-scan-input']").fill(est); await page.keyboard.press("Enter"); await page.wait_for_timeout(200)
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(300); print("refused w/o reason:", (await page.locator("[data-testid='action-error']").inner_text())[:60])
        await page.locator("[data-testid='action-reason']").fill("Clasp gap 0.4 mm — fails QC"); await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(900)
        print("jacques after redo:", await acounts(page, "v-jacques"))
        # Received without scan refuses
        await load_from_track(page, "v-chronosky", "inbound", 0)
        await page.locator("[data-testid='anode-v-chronosky-arrival']").click(); await page.wait_for_timeout(300); r0 = await acounts(page, "v-chronosky")
        await page.locator("[data-testid='action-commit']").click(force=True); await page.wait_for_timeout(300); print("received refused:", (await page.locator("[data-testid='action-error']").inner_text())[:60], "| unchanged:", r0 == await acounts(page, "v-chronosky"))
        await page.screenshot(path=f"/app/memory/tools/shots/assign_{'pad' if pad else 'desk'}.png")
        # wedge scanner only while ASSIGN visible
        await page.locator("[data-testid='action-cancel-dest']").click(); await page.locator("[data-testid='action-clear']").click(); await page.wait_for_timeout(200)
        await view(page, "track"); await page.mouse.click(5, 400); await page.keyboard.type(ests[0], delay=10); await page.keyboard.press("Enter"); await page.wait_for_timeout(300)
        await view(page, "assign"); print("wedge ignored on track (strip absent):", await page.locator("[data-testid='action-strip']").count() == 0)
        await page.mouse.click(5, 400); await page.keyboard.type(ests[0], delay=10); await page.keyboard.press("Enter"); await page.wait_for_timeout(300); print("wedge on assign strip:", await page.locator("[data-testid='action-strip']").get_attribute("data-count"))
        # toggle remembered
        await nav(page, "/rw/concierge" if pad else "/concierge"); print("remembered view:", await page.locator("[data-testid='concierge-view-assign']").get_attribute("data-selected"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())

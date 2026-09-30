import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1500,"height":1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)
        await nav(page, "/rw/assign"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='destination-map']").screenshot(path="/app/memory/tools/shots/rw_assign_map.png")
        print("rw/assign safes:", await page.locator("[data-testid='destination-map'] [data-testid='safe-icon']").count(), "nodes:", await page.locator("[data-testid='destination-map'] [data-testid^='dest-node-']").count())
        await nav(page, "/concierge"); await page.locator("[data-testid='concierge-view-assign']").click(); await page.wait_for_timeout(800)
        await page.locator("[data-testid='concierge-assign']").screenshot(path="/app/memory/tools/shots/concierge_assign.png")
        await page.locator("[data-testid='action-lookup-input']").fill("02301"); await page.keyboard.press("Enter"); await page.wait_for_timeout(400)
        await page.locator("[data-testid='dest-node-v-chronosky:box']").click(); await page.wait_for_timeout(400)
        await page.locator("[data-testid='concierge-assign']").screenshot(path="/app/memory/tools/shots/concierge_assign_sel.png")
        await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(500)
        await page.screenshot(path="/app/memory/tools/shots/concierge_track.png")
        await b.close()
asyncio.run(main())

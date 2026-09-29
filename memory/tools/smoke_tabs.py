import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def rw_sign_in(page, uid, pw, path):
    await page.goto(f"{BASE}{path}", wait_until="networkidle"); await page.wait_for_timeout(900)
    if await page.locator(f"[data-testid='bench-card-{uid}']").count():
        await page.locator(f"[data-testid='bench-card-{uid}']").click(); await page.wait_for_timeout(300)
        for k in "1234": await page.locator(f"[data-testid='bench-key-{k}']").click(); await page.wait_for_timeout(120)
        await page.wait_for_timeout(2500); return
    if await page.locator(f"[data-testid='rw-card-{uid}']").count():
        await page.locator(f"[data-testid='rw-card-{uid}']").click(force=True); await page.wait_for_timeout(300)
        for secret in (pw, "1234"):
            if not await page.locator("[data-testid='rw-secret']").count(): break
            await page.locator("[data-testid='rw-secret']").fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(2500)
async def walk(page, label):
    tabs = await page.locator("[data-testid^='role-tab-']").evaluate_all("els=>els.filter(e=>e.dataset.testid!=='role-tab-messages-unread').map(e=>e.dataset.testid)")
    print(label, "tabs:", tabs, "role:", await page.locator("[data-testid='role-tabbar']").get_attribute("data-role"))
    for t in tabs:
        await page.locator(f"[data-testid='{t}']").click(); await page.wait_for_timeout(1400)
        active = await page.locator(f"[data-testid='{t}']").get_attribute("data-active")
        print("  ", t, "->", page.url.replace(BASE,""), "active:", active, "bar:", await page.locator("[data-testid='role-tabbar']").count())
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for uid,pw,path,label in [("u-leo","leo123","/rw/bench","Leo"),("u-dre","dre123","/rw/band","Dre"),("u-jv","jv123","/rw/pad","JV")]:
            ctx=await b.new_context(viewport={"width":1180,"height":820}, has_touch=True); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
            await rw_sign_in(page, uid, pw, path); print(label, "at", page.url)
            await walk(page, label); await page.screenshot(path=f"/app/memory/tools/shots/tabs_{label}.png"); await ctx.close(); await asyncio.sleep(2)
        # MH view-as MM on pad
        ctx=await b.new_context(viewport={"width":1180,"height":820}, has_touch=True); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        print("choose-view has tabbar (expect 0):", await page.locator("[data-testid='role-tabbar']").count())
        await page.locator("[data-testid='choose-view-MM']").click(); await page.wait_for_timeout(2500)
        print("MH as MM at", page.url, "banner:", await page.locator("[data-testid='view-as-banner']").count())
        await walk(page, "MH-as-MM"); await page.screenshot(path="/app/memory/tools/shots/tabs_mh_mm.png")
        await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", "/wm-kiosk"); await page.wait_for_timeout(1200)
        print("wm-kiosk tabbar (expect 0):", await page.locator("[data-testid='role-tabbar']").count())
        await b.close()
asyncio.run(main())

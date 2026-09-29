import asyncio, sys
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
    w = int(sys.argv[1]) if len(sys.argv)>1 else 1500
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":w,"height":1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page)
        await nav(page, "/hitlist")
        print("header:", await page.locator("[data-testid='today-header'] h1, [data-testid='today-header']").first.inner_text())
        print("top-row children:", await page.locator("[data-testid='hitlist-top-row'] > *").count())
        groups = await page.locator("[data-testid^='derived-group-'][data-count]").evaluate_all("els=>els.map(e=>[e.dataset.testid,+e.dataset.count])"); print("groups:", groups, "total:", sum(g[1] for g in groups))
        print("pinned rows:", await page.locator("[data-testid^='pinned-pin-']").count())
        print("E-prefixed in derived/pinned (expect 0):", await page.locator("[data-testid='today-list-card'] a:text-matches('\\\\bE0\\\\d{4}\\\\b'), [data-testid='pinned-list'] :text-matches('\\\\bE0\\\\d{4}\\\\b')").count())
        print("chip:", await page.locator("[data-testid='hitlist-inbox-chip']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/hitlist.png")
        await page.locator("[data-testid='hitlist-inbox-chip']").click(); await page.wait_for_timeout(500)
        print("drawer:", await page.locator("[data-testid='hitlist-inbox-drawer']").count(), "inbox rows:", await page.locator("[data-testid='hitlist-inbox-drawer'] [data-testid^='inbox-ib-']").count())
        await page.screenshot(path="/app/memory/tools/shots/hitlist_inbox.png")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300); print("drawer after Esc:", await page.locator("[data-testid='hitlist-inbox-drawer']").count())
        await page.locator("[data-testid='derived-group-toggle-overdue']").click(); await page.wait_for_timeout(200); print("overdue rows after collapse:", await page.locator("[data-testid='derived-group-overdue'] li").count())
        print("errors:", errs)
        await b.close()
asyncio.run(main())

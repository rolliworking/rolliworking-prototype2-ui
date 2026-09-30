import asyncio
from playwright.async_api import async_playwright
BASE = "http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(2500)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','hybrid')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123", "1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3500)
        if await page.locator("[data-testid='choose-view-own']").count(): await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)
        await nav(page, "/jobs?tab=list"); await page.wait_for_timeout(3500)
        hrefs = await page.locator("a[href^='/jobs/']").evaluate_all("els=>[...new Set(els.map(e=>e.getAttribute('href')))].filter(h=>!/\\/jobs\\/(all|new|shop-time|j-)/.test(h))")
        print("live job links:", hrefs[:5])
        if hrefs:
            await nav(page, hrefs[0]); await page.wait_for_timeout(2000)
            print("url:", page.url, "| body:", (await page.locator("body").inner_text())[:400].replace("\n", " | "))
            if not await page.locator("[data-testid='item-title']").count(): print("errors:", errs); await page.screenshot(path="/app/memory/tools/shots/jobdetail_live.png"); await b.close(); return
            print("title:", await page.locator("[data-testid='item-title']").inner_text(), "| number:", await page.locator("[data-testid='job-number']").inner_text(), "| fraction:", await page.locator("[data-testid='flow-fraction']").inner_text(), "| stages:", await page.locator("[data-testid^='flow-dot-']").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop()+':'+e.dataset.state)"), "| custody:", (await page.locator("[data-testid^='flow-custody-']").first.inner_text()).replace("\n", " / "), "| addons:", await page.locator("[data-testid='addons-panel']").get_attribute("data-count"), "| outsource none:", await page.locator("[data-testid='outsource-none']").count())
            await page.screenshot(path="/app/memory/tools/shots/jobdetail_live.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())

import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1600, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        await nav(page, "/integrations/watchm8"); await page.wait_for_timeout(1200)
        print("old path → url:", page.url.split('.com')[-1], "| wm8 page:", await T(page, "wm8-setup-page").count())
        await nav(page, "/setup"); await page.wait_for_timeout(900); href = await T(page, "setup-open-wm8").get_attribute("href"); print("setup card link:", href)
        await T(page, "setup-open-wm8").click(); await page.wait_for_timeout(900); print("after click url:", page.url.split('.com')[-1], "| wm8 page:", await T(page, "wm8-setup-page").count())
        await nav(page, "/integrations"); await page.wait_for_timeout(900); print("tile link:", await T(page, "integration-setup-watchm8").get_attribute("href"))
        await nav(page, "/setup/inspection"); await page.wait_for_timeout(900); print("inspection data-out link:", await T(page, "wm8-seam-link").get_attribute("href"))
        print("page errors:", errs)
        await b.close()

asyncio.run(main())

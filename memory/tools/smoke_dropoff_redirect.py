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
        await nav(page, "/actions/drop-off"); await page.wait_for_timeout(1200)
        print("url:", page.url.split('.com')[-1].replace('http://localhost:3000', ''), "| walk-in card:", await T(page, "arrival-walkin-card").count(), "| placeholder:", await page.get_by_text("placeholder", exact=False).count())
        print("page errors:", errs)
        await b.close()

asyncio.run(main())

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
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(800)
        print("queue:", await page.locator("[data-testid^='pickup-queue-so-']").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('pickup-queue-',''))"))
        print("high tier:", await page.locator("[data-testid^='pickup-queue-tier-']").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('pickup-queue-tier-',''))"))
        await T(page, "pickup-queue-so-pu6").click(); await page.wait_for_timeout(900)
        print("so-pu6 tier:", await T(page, "pickup-side-tier").inner_text())
        await nav(page, "/sales/so-pu7"); await page.wait_for_timeout(1000)
        print("so-pu7 id state:", await T(page, "so-pickup-id-photo").count())
        print("errs:", errs)
        await b.close()
asyncio.run(main())

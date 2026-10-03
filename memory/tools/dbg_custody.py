import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")
txt = lambda page, t: T(page, t).inner_text()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1600, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        await nav(page, "/setup/custody"); await page.wait_for_timeout(1200)
        await T(page, "custody-audit-scope").select_option("shop"); await T(page, "custody-audit-start-btn").click(); await page.wait_for_timeout(600)
        await T(page, "custody-audit-scan").fill("safe_await_band"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500)
        await T(page, "custody-audit-scan").fill("ZZ-UNKNOWN-9"); await page.keyboard.press("Enter"); await page.wait_for_timeout(700)
        print("msg:", (await txt(page, "custody-audit-msg")) if await T(page, "custody-audit-msg").count() else None)
        print("err:", (await txt(page, "custody-audit-error")) if await T(page, "custody-audit-error").count() else None)
        print("unknown:", await T(page, "custody-audit-unknown").count())
        r = await page.evaluate("""async () => { const m = await import('/src/api/client.ts'); const j = await m.findJobByLabel('ZZ-UNKNOWN-9'); return j ? j.number : null; }""")
        print("findJobByLabel:", r)
        print("errs:", errs)
        await b.close()
asyncio.run(main())

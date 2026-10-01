import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 950}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await nav(page, "/calls"); await page.wait_for_timeout(800)
        badge = lambda: page.locator("[data-testid='nav-calls-missed'], [data-testid='nav-clients-missed']").first
        print("badge:", await badge().inner_text(), "| kpi:", (await T(page, "calls-kpi-missed").inner_text()).split("\n")[-1], "| rows:", await page.locator("[data-testid='calls-list'] > li").count())
        row = page.locator("[data-testid^='missed-call-back-']").first; cid = (await row.get_attribute("data-testid")).split("missed-call-back-")[1]
        await row.click(); await page.wait_for_timeout(700)
        print("after mark called back → badge:", await badge().inner_text(), "| kpi:", (await T(page, "calls-kpi-missed").inner_text()).split("\n")[-1], "| rows:", await page.locator("[data-testid='calls-list'] > li").count(), "| first row:", (await page.locator("[data-testid='calls-list'] > li").first.inner_text())[:80].replace("\n", " "))
        # Call back (dial) → hang up → cleared
        dial = page.locator("[data-testid^='missed-call-dial-']").first; print("dial btn:", await dial.count())
        await dial.click(); await page.wait_for_timeout(500); print("outbound pop:", await T(page, "call-pop").get_attribute("data-direction"))
        await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(400); await T(page, "call-disposition-status_inquiry").click(); await T(page, "call-disposition-save").click(); await page.wait_for_timeout(700)
        print("after dial+hangup → badge:", await badge().inner_text() if await badge().count() else "0", "| kpi:", (await T(page, "calls-kpi-missed").inner_text()).split("\n")[-1], "| missed rows left:", await page.locator("[data-testid^='missed-call-'][data-testid^='missed-call-call']").count())
        print("errors:", errs)
        await b.close()
asyncio.run(main())

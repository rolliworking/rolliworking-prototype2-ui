import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright

T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1500, "height": 950})
        await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')")
        page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(500)
        await nav(page, "/calls"); await page.wait_for_timeout(1000)

        # Expand clients nav so nav-calls-missed is visible
        if await T(page, "nav-clients-toggle").count():
            await T(page, "nav-clients-toggle").click(); await page.wait_for_timeout(300)

        b_clients = T(page, "nav-clients-missed")
        b_calls = T(page, "nav-calls-missed")
        print("badges initially → clients:", (await b_clients.inner_text() if await b_clients.count() else "-"),
              "calls:", (await b_calls.inner_text() if await b_calls.count() else "-"))
        print("kpi missed:", await T(page, "calls-kpi-missed").inner_text())

        back_btns = page.locator("[data-testid^='missed-call-back-']")
        n = await back_btns.count()
        print("missed back buttons:", n)
        if n:
            tid = await back_btns.first.get_attribute("data-testid")
            print("clicking:", tid)
            await back_btns.first.click(); await page.wait_for_timeout(1500)
            print("after click, call-pop:", await T(page, "call-pop").count(),
                  "direction:", (await T(page, "call-pop").get_attribute("data-direction") if await T(page, "call-pop").count() else "-"))
            if await T(page, "call-pop-hangup").count():
                await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(600)
            if await T(page, "call-disposition-skip").count():
                await T(page, "call-disposition-skip").click(); await page.wait_for_timeout(600)

        print("badges after → clients:", (await b_clients.inner_text() if await b_clients.count() else "-"),
              "calls:", (await b_calls.inner_text() if await b_calls.count() else "-"))
        print("kpi missed:", await T(page, "calls-kpi-missed").inner_text())
        print("remaining back buttons:", await page.locator("[data-testid^='missed-call-back-']").count())
        print("ERRORS:", errs)
        await b.close()

asyncio.run(main())

import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1600, "height": 950}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        await nav(page, "/inbox?thread=cv-01&panel=1"); await page.wait_for_timeout(1500)
        print("panel:", await T(page, "inbox-panel").get_attribute("data-kind"), "| anchor:", await T(page, "inbox-panel-anchor").inner_text())
        for k in ("active", "fulfilled", "closed"):
            s = T(page, f"inbox-panel-section-{k}"); print(f"  {k}: count={await s.get_attribute('data-count')} open={await s.get_attribute('data-open')}")
        print("active jobs:", await page.locator("[data-testid^='inbox-panel-job-j-']").evaluate_all("els=>els.map(e=>e.dataset.testid+':'+(e.dataset.anchor||'-')+':'+e.dataset.expanded)"))
        print("active requests:", await page.locator("[data-testid^='inbox-panel-request-rq-']").evaluate_all("els=>els.map(e=>e.dataset.testid+':'+e.dataset.expanded)"))
        print("flow lines j-01:", await page.locator("[data-testid^='inbox-panel-line-j-01-']").all_inner_texts())
        print("client dots:", await T(page, "inbox-panel-client-wbp").get_attribute("data-count"), "| job dots j-01:", await T(page, "inbox-panel-wbp-j-01").count())
        # expand full
        await T(page, "inbox-panel-expand-j-01").click(); await page.wait_for_timeout(900)
        print("expanded:", await T(page, "inbox-panel-job-j-01").get_attribute("data-expanded"), "| embedded body:", await T(page, "job-detail-embedded").count(), "| cards:", await page.locator("[data-testid='job-detail-embedded'] [data-testid$='-card']").evaluate_all("els=>els.map(e=>e.dataset.testid)"), "| more:", await T(page, "job-more").count(), "| collapse btn:", await T(page, "inbox-panel-collapse-j-01").count(), "| snippet flow hidden:", await T(page, "inbox-panel-flow-j-01").count() == 0)
        await T(page, "inbox-panel-collapse-j-01").click(); await page.wait_for_timeout(400); print("after collapse expanded:", await T(page, "inbox-panel-job-j-01").get_attribute("data-expanded"), "| flow back:", await T(page, "inbox-panel-flow-j-01").count())
        # fulfilled section
        await T(page, "inbox-panel-section-fulfilled-toggle").click(); await page.wait_for_timeout(400)
        print("fulfilled rows:", await page.locator("[data-testid^='inbox-panel-fulfilled-toggle-']").all_inner_texts(), "| dots in fulfilled rows:", await page.locator("[data-testid^='inbox-panel-fulfilled-'] [data-testid^='wbp-']").count())
        await T(page, "inbox-panel-fulfilled-toggle-j-20").click(); await page.wait_for_timeout(900)
        print("j-20 snippet:", await T(page, "inbox-panel-job-j-20").count(), "| finished banner:", (await T(page, "inbox-panel-finished-j-20").inner_text())[:90] if await T(page, "inbox-panel-finished-j-20").count() else "NONE", "| dots j-20:", await T(page, "inbox-panel-wbp-j-20").count())
        await T(page, "inbox-panel-expand-j-20").click(); await page.wait_for_timeout(700); print("only one expanded:", await page.locator("[data-testid^='inbox-panel-job-j-'][data-expanded='true']").evaluate_all("els=>els.map(e=>e.dataset.job)"))
        # closed section
        await T(page, "inbox-panel-section-closed-toggle").click(); await page.wait_for_timeout(400)
        print("closed rows:", await page.locator("[data-testid^='inbox-panel-closed-']").all_inner_texts())
        # rating tooltip
        await T(page, "inbox-panel-rating").hover(); await page.wait_for_timeout(300); print("rating tip visible:", await T(page, "inbox-panel-rating-tip").is_visible(), "|", (await T(page, "inbox-panel-rating-tip").inner_text()).replace("\n", " | "))
        await page.screenshot(path="/tmp/panel_sections.png", quality=30, type="jpeg")
        # dots rule elsewhere: client with nothing in possession → empty rings once; closed job cell shows nothing
        await nav(page, "/clients"); await page.wait_for_timeout(900)
        print("clients empty rings:", await page.locator("[data-testid$='-empty'][data-empty]").count(), "| client rows with dots:", await page.locator("[data-testid^='clients-wbp-'], [data-testid^='wbp-client-']").count())
        await nav(page, "/jobs/j-20"); await page.wait_for_timeout(900)
        print("closed job page own dots:", await page.locator("[data-testid='job-wbp-row'] [data-testid='wbp-j-20']").count(), "| header rows:", await page.locator("[data-testid='job-wbp-row'] [data-testid^='wbp-']").evaluate_all("els=>els.map(e=>e.dataset.testid)"))
        print("errs:", errs)
        await b.close()
asyncio.run(main())

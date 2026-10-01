import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def dots(page, tid):
    return await page.locator(f"[data-testid='{tid}'] [data-state]").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop()+':'+e.dataset.state).join(' ')")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1600, "height": 950}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        order = await page.locator("[data-testid='sidebar'] nav a, [data-testid='sidebar'] nav button").evaluate_all("els=>els.slice(0,5).map(e=>e.dataset.testid)")
        print("sidebar order:", order, "| inbox badge:", await T(page, "nav-inbox-badge").inner_text() if await T(page, "nav-inbox-badge").count() else "-", "| requests badge:", await T(page, "nav-requests-badge").inner_text() if await T(page, "nav-requests-badge").count() else "-")
        await nav(page, "/inbox?view=open"); await page.wait_for_timeout(800)
        print("open threads:", await page.locator("[data-testid^='thread-row-']:not([data-testid*='wbp']):not([data-testid*='unreplied']):not([data-testid*='component'])").count(), "| rows with dots:", await page.locator("[data-testid^='thread-row-wbp-']").count())
        async def open_case(cv, label):
            await T(page, f"thread-row-{cv}").click(); await page.wait_for_timeout(1600)
            if not await T(page, "inbox-panel").count(): await T(page, "thread-job-card").click(); await page.wait_for_timeout(700)
            kind = await T(page, "inbox-panel").get_attribute("data-kind"); print(f"\n[{label}] thread {cv} → panel kind={kind} | header dots:", await dots(page, "thread-wbp"))
            return kind
        # 1 one active job mixed
        await open_case("cv-ib1", "1 one active mixed")
        print("   job:", await T(page, "inbox-panel-job-number").inner_text(), "| dots:", await dots(page, "inbox-panel-wbp"), "| status:", await T(page, "inbox-panel-status").inner_text(), "| other jobs:", await T(page, "inbox-panel-other-jobs").count(), "| flow lines:", await page.locator("[data-testid='inbox-panel-flow'] [data-testid^='flow-line-']").count())
        await page.screenshot(path="/app/memory/tools/shots/inbox_case1.png")
        # generate summary → composer
        await T(page, "inbox-panel-summary").click(); await page.wait_for_timeout(2500); print("   composer text after summary:", (await T(page, "composer-text").input_value())[:90].replace("\n", " "), "| msg:", await T(page, "inbox-panel-msg").inner_text() if await T(page, "inbox-panel-msg").count() else "-")
        # 2 two active
        await open_case("cv-ib2", "2 two active")
        print("   job:", await T(page, "inbox-panel-job-number").inner_text(), "| dots:", await dots(page, "inbox-panel-wbp"), "| other jobs:", await T(page, "inbox-panel-other-jobs").get_attribute("data-count"), await page.locator("[data-testid^='inbox-panel-swap-']").evaluate_all("els=>els.map(e=>e.dataset.testid)"))
        await page.locator("[data-testid^='inbox-panel-swap-']").first.click(); await page.wait_for_timeout(600); print("   after swap job:", await T(page, "inbox-panel-job-number").inner_text(), "| back link:", await T(page, "inbox-panel-back").count()); await T(page, "inbox-panel-back").click(); await page.wait_for_timeout(400); print("   back to:", await T(page, "inbox-panel-job-number").inner_text())
        # 3 active + completed
        await open_case("cv-ib3", "3 completed + active")
        print("   job:", await T(page, "inbox-panel-job-number").inner_text(), "| finished:", await T(page, "inbox-panel-finished").inner_text() if await T(page, "inbox-panel-finished").count() else "NONE", "| other:", await page.locator("[data-testid^='inbox-panel-swap-']").evaluate_all("els=>els.map(e=>e.dataset.testid)"))
        await page.screenshot(path="/app/memory/tools/shots/inbox_case3.png")
        # 4 return
        await open_case("cv-ib4", "4 return/warranty")
        print("   job:", await T(page, "inbox-panel-job-number").inner_text(), "| return:", (await T(page, "inbox-panel-return").inner_text())[:160].replace("\n", " ") if await T(page, "inbox-panel-return").count() else "NONE", "| inspection details:", await T(page, "inbox-panel-return-inspection").count(), "| other:", await page.locator("[data-testid^='inbox-panel-swap-']").evaluate_all("els=>els.map(e=>e.dataset.testid)"))
        await T(page, "inbox-panel-return-original").click(); await page.wait_for_timeout(500); print("   original opened:", await T(page, "inbox-panel-job-number").inner_text(), "| finished banner:", (await T(page, "inbox-panel-finished").inner_text())[:120] if await T(page, "inbox-panel-finished").count() else "NONE")
        await page.screenshot(path="/app/memory/tools/shots/inbox_case4.png")
        # 5a request
        await open_case("cv-05", "5a request RQ-26-0043")
        print("   request text:", (await T(page, "inbox-panel-request-text").inner_text())[:60], "| source:", await T(page, "inbox-panel-request-source").inner_text(), "| photos:", await page.locator("[data-testid='inbox-panel-request-photos'] img").count(), "| legs:", await T(page, "inbox-panel-request-legs").inner_text(), "| range:", await T(page, "inbox-panel-request-range").inner_text(), "| create est:", await T(page, "inbox-panel-create-estimate").count(), "| other jobs:", await T(page, "inbox-panel-other-jobs").get_attribute("data-count"))
        await page.screenshot(path="/app/memory/tools/shots/inbox_case5a.png")
        # 5b none
        await open_case("cv-ib5", "5b no anchor")
        print("   client card:", await T(page, "inbox-panel-client").count(), "| last jobs:", await page.locator("[data-testid^='inbox-panel-client-job-']").count(), "| rating:", await T(page, "inbox-panel-rating").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/inbox_case5b.png")
        # close + requests page row click
        await T(page, "inbox-panel-close").click(); await page.wait_for_timeout(300); print("\npanel closed:", await T(page, "inbox-panel").count())
        await nav(page, "/requests"); await page.wait_for_timeout(700); print("requests rows:", await page.locator("[data-testid^='request-row-']").count(), "| dots cells:", await page.locator("[data-testid^='request-wbp-']").count(), "| assigned rq-03:", await T(page, "request-assigned-rq-03").inner_text(), "| age:", await T(page, "request-age-rq-03").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/requests.png")
        await T(page, "request-row-rq-05").click(); await page.wait_for_timeout(1200); print("after row click url:", page.url, "| panel kind:", await T(page, "inbox-panel").get_attribute("data-kind"), "| request:", await T(page, "inbox-panel-request").get_attribute("data-request"), "| messages:", await page.locator("[data-testid^='msg-cm']").count())
        print("floating lookup pill on inbox:", await T(page, "corner-lookup-open").count())
        print("errors:", errs)
        await b.close()
asyncio.run(main())

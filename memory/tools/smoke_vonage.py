import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright

T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 950}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(500)
        print("url:", page.url)
        # 1) two active jobs, one band blocked
        await T(page, "dev-simulate-call").click(); await T(page, "dev-call-two-jobs").click(); await page.wait_for_timeout(700)
        pop = T(page, "call-pop"); print("pop:", await pop.count(), "phase:", await pop.get_attribute("data-phase"), "kind:", await pop.get_attribute("data-kind"))
        print("name:", await T(page, "call-pop-name").inner_text(), "| number:", await T(page, "call-pop-number").inner_text(), "| rating:", await T(page, "call-pop-rating").inner_text())
        print("rows:", await T(page, "call-pop-wbp").get_attribute("data-count"), await page.locator("[data-testid^='call-pop-wbp-'] [data-state]").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').slice(-2).join('-')+':'+e.dataset.state)"))
        print("last contact:", await T(page, "call-pop-last-contact").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/vonage_ring.png")
        await page.wait_for_timeout(3500); print("after auto-answer phase:", await pop.get_attribute("data-phase"), "|", await T(page, "call-pop-phase").inner_text())
        # note + page
        await T(page, "call-pop-note").click(); await T(page, "call-pop-note-text").fill("Asked for Thursday pickup"); await T(page, "call-pop-page").click(); await page.wait_for_timeout(200)
        first_page = page.locator("[data-testid^='call-pop-page-']").first; print("page target:", await first_page.get_attribute("data-testid")); await first_page.click(); await page.wait_for_timeout(300); print("paged:", await T(page, "call-pop-paged").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/vonage_live.png")
        # tap a dot → job page with leg focus
        dot = page.locator("[data-testid^='call-pop-wbp-'][data-testid$='-B'][data-state='blocked']").first; await dot.click(); await page.wait_for_timeout(1200)
        print("after dot tap url:", page.url, "| chip:", await T(page, "call-pop-chip").count(), await T(page, "call-pop-chip").inner_text() if await T(page, "call-pop-chip").count() else "", "| focus line:", await page.locator("[data-focus='true']").count())
        await T(page, "call-pop-chip-expand").click(); await page.wait_for_timeout(300); print("expanded again:", await pop.count())
        # click card → client page
        await T(page, "call-pop-name").click(); await page.wait_for_timeout(1200); print("after card click url:", page.url, "| chip:", await T(page, "call-pop-chip").count())
        await T(page, "call-pop-chip-expand").click(); await page.wait_for_timeout(300)
        await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(600)
        print("disposition dialog:", await T(page, "call-disposition").count())
        await T(page, "call-disposition-approval_given").click(); await page.wait_for_timeout(200); print("approval fields:", await T(page, "call-approval-fields").count(), "job sel:", await T(page, "call-disposition-job").input_value())
        await T(page, "call-approval-what").fill("Crown + tube replacement"); await T(page, "call-approval-amount").fill("185"); await T(page, "call-disposition-save").click(); await page.wait_for_timeout(800)
        print("dialog closed:", await T(page, "call-disposition").count(), "| err:", await T(page, "call-disposition-error").inner_text() if await T(page, "call-disposition-error").count() else "-")
        # client 360 calls section
        print("c360 calls section:", await T(page, "client360-calls-section").count(), "| rows:", await page.locator("[data-testid^='c360-call-']:not([data-testid*='-note']):not([data-testid*='-disposition']):not([data-testid*='-recording']):not([data-testid*='-job'])").count())
        first = page.locator("[data-testid='client360-calls-list'] > li").first; print("first row:", (await first.inner_text())[:200].replace("\n", " | "))
        await page.screenshot(path="/app/memory/tools/shots/vonage_c360.png")
        # job page addon pending
        job_url = page.url
        jl = page.locator("[data-testid^='c360-call-'][data-testid$='-job']").first; href = await jl.get_attribute("href"); print("job link:", href)
        await nav(page, href); await page.wait_for_timeout(1000); print("pending addon:", await page.locator("[data-testid^='addon-pending-']").count(), "| job calls:", await T(page, "job-calls-count").inner_text(), "| call client btn:", await T(page, "job-call-client").count())
        # 2) unknown → attach
        await T(page, "dev-simulate-call").click(); await T(page, "dev-call-unknown").click(); await page.wait_for_timeout(600)
        print("unknown pop kind:", await pop.get_attribute("data-kind"), "|", await T(page, "call-pop-name").inner_text(), await T(page, "call-pop-rating").inner_text())
        await T(page, "call-pop-attach").click(); await T(page, "call-pop-attach-input").fill("Okafor"); await page.wait_for_timeout(600); print("hits:", await page.locator("[data-testid^='call-pop-attach-c-']").count())
        await page.locator("[data-testid^='call-pop-attach-c-']").first.click(); await page.wait_for_timeout(400); print("after attach kind:", await pop.get_attribute("data-kind"), await T(page, "call-pop-name").inner_text())
        await T(page, "call-pop-dismiss").click(); await page.wait_for_timeout(300); print("dismissed card gone:", await pop.count())
        await page.wait_for_timeout(3500); print("dismissed → live chip:", await T(page, "call-pop-chip").count(), await T(page, "call-pop-chip").inner_text() if await T(page, "call-pop-chip").count() else "")
        await T(page, "call-pop-chip-expand").click(); await page.wait_for_timeout(200); await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(400); await T(page, "call-disposition-skip").click(); await page.wait_for_timeout(300)
        # 3) missed → queue
        badge = lambda: page.locator("[data-testid='nav-calls-missed'], [data-testid='nav-clients-missed']").first
        before = await badge().inner_text() if await badge().count() else "0"
        await T(page, "dev-simulate-call").click(); await T(page, "dev-call-missed").click(); await page.wait_for_timeout(500); print("ringing:", await pop.get_attribute("data-phase"))
        await page.keyboard.press("Escape"); await page.wait_for_timeout(200); print("esc dismissed:", await pop.count())
        await page.wait_for_timeout(7200); print("missed chip:", await T(page, "call-pop-chip").inner_text() if await T(page, "call-pop-chip").count() else "none", "| nav badge:", before, "→", await badge().inner_text() if await badge().count() else "0")
        # 4) answered elsewhere
        await T(page, "dev-simulate-call").click(); await T(page, "dev-call-elsewhere").click(); await page.wait_for_timeout(3200); print("elsewhere chip:", await T(page, "call-pop-chip").first.inner_text()); await page.wait_for_timeout(4000); print("elsewhere ended → dialogs:", await T(page, "call-disposition").count())
        # Calls page
        await nav(page, "/calls"); await page.wait_for_timeout(800); print("calls page:", await T(page, "calls-page").count(), "| kpi missed:", await T(page, "calls-kpi-missed").inner_text(), "| rows:", await page.locator("[data-testid='calls-list'] > li").count())
        await page.screenshot(path="/app/memory/tools/shots/vonage_calls.png")
        # missed inbox item for concierge role (Chyna) via bubble
        await nav(page, "/clients"); await page.wait_for_timeout(600); print("directory phone links:", await page.locator("[data-testid^='directory-phone-']").count())
        await page.locator("[data-testid^='directory-phone-']").first.click(); await page.wait_for_timeout(500); print("click-to-call pop:", await pop.get_attribute("data-direction"), await T(page, "call-pop-phase").inner_text()); await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(300); await T(page, "call-disposition-status_inquiry").click(); await T(page, "call-disposition-save").click(); await page.wait_for_timeout(400)
        print("errors:", errs)
        # Chyna sees the missed item in the role queue
        ctx2 = await b.new_context(viewport={"width": 1500, "height": 950}); await ctx2.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); p2 = await ctx2.new_page(); errs2 = []; p2.on("pageerror", lambda e: errs2.append(str(e)))
        await signin(p2, "chyna", "chyna123"); await p2.wait_for_timeout(500); await T(p2, "msg-bubble").click(); await p2.wait_for_timeout(300); await T(p2, "msg-tab-inbox").click(); await p2.wait_for_timeout(500)
        print("chyna inbox missed rows:", await p2.locator("text=call back").count(), "| pop host on concierge:", await T(p2, "dev-simulate-call").count())
        await p2.screenshot(path="/app/memory/tools/shots/vonage_chyna_inbox.png")
        print("errors2:", errs2)
        await b.close()

asyncio.run(main())

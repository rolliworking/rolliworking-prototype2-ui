import asyncio, sys
from playwright.async_api import async_playwright
BASE = "http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1600)
async def dots(page, sel):
    return await page.locator(sel).evaluate_all("els=>els.map(e=>e.dataset.testid+(e.dataset.outlined?'*':'')+'['+Array.from(e.querySelectorAll('[data-state]')).map(x=>x.dataset.testid.split('-').pop()+':'+x.dataset.state).join(' ')+']')")
async def signin(page, who="michael", pw="michael123"):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(600)
    await page.locator(f"[data-testid='staff-card-{who}']").click(force=True); await page.wait_for_timeout(600)
    for secret in (pw, "1234"):
        if "/sign-in" not in page.url: break
        await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(2500)
    if await page.locator("[data-testid='choose-view-own']").count(): await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 950}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page)
        # 1. job page dots
        for jid in ["j-30", "j-mi1", "j-os1"]:
            await nav(page, f"/jobs/{jid}"); print(f"== job {jid}:", await dots(page, "[data-testid='job-wbp'] [data-testid^='wbp-j']"), "legend:", await page.locator("[data-testid='wbp-legend']").count())
        await page.screenshot(path="/app/memory/tools/shots/wbp_job.png", clip={"x": 0, "y": 0, "width": 1500, "height": 420})
        # 2. client 360 + directory
        await nav(page, "/clients/c-30"); print("== client360:", await dots(page, "[data-testid='client360-wbp'] [data-testid^='wbp-j']"))
        await nav(page, "/clients"); print("== directory rows with dots:", await page.locator("[data-testid^='directory-wbp-']").count(), "sample:", (await dots(page, "[data-testid^='directory-wbp-'] [data-testid^='wbp-j']"))[:3])
        # 3. hitlist rows
        await nav(page, "/hitlist"); print("== hitlist dots:", await page.locator("[data-testid^='today-wbp-'],[data-testid^='pinned-wbp-']").count())
        # 4. concierge track slide-out card
        await nav(page, "/concierge")
        cells = page.locator("[data-testid^='cell-'][data-count]:not([data-count='0'])")
        if await cells.count(): await cells.first.click(); await page.wait_for_timeout(900)
        print("== concierge cards:", await page.locator("[data-testid^='concierge-card-']").count(), "dots:", await page.locator("[data-testid^='concierge-wbp-']").count())
        # 5. schedule + arrival
        await nav(page, "/appointments"); print("== appointments dots:", await page.locator("[data-testid^='appt-wbp-']").count())
        await nav(page, "/intake"); print("== arrival dots:", await page.locator("[data-testid^='arrival-wbp-']").count())
        await nav(page, "/intake/inspection"); print("== inspection dots:", await page.locator("[data-testid^='inspection-wbp-']").count())
        # 6. global search client hits
        await nav(page, "/"); await page.locator("[data-testid='global-search-input']").fill("Calloway"); await page.wait_for_timeout(900)
        print("== search dots:", await page.locator("[data-testid^='search-hit-wbp-']").count()); await page.keyboard.press("Escape")
        # 7. call pop
        await page.locator("[data-testid='dev-simulate-call']").click(); await page.locator("[data-testid='dev-call-known']").click(); await page.wait_for_timeout(900)
        print("== call pop dots:", await page.locator("[data-testid='call-pop-wbp']").count()); await page.screenshot(path="/app/memory/tools/shots/wbp_callpop.png")
        await page.locator("[data-testid='call-pop-dismiss']").click(); await page.wait_for_timeout(300)
        if await page.locator("[data-testid='call-note-skip']").count(): await page.locator("[data-testid='call-note-skip']").click()
        # 8. sidebar history lookup + no corner pill
        print("== corner pill:", await page.locator("[data-testid='corner-lookup-open']").count(), "| sidebar lookup:", await page.locator("[data-testid='sidebar-history-lookup']").count())
        await page.locator("[data-testid='sidebar-history-lookup']").click(); await page.wait_for_timeout(400); print("   lookup panel:", await page.locator("[data-testid='corner-lookup']").count()); await page.locator("[data-testid='corner-lookup-close']").click()
        # 9. message bubble
        print("== bubble:", await page.locator("[data-testid='msg-bubble']").count(), "unread:", await page.locator("[data-testid='msg-bubble-unread']").all_inner_texts())
        await page.locator("[data-testid='msg-bubble']").click(); await page.wait_for_timeout(500)
        print("   panel:", await page.locator("[data-testid='msg-panel']").get_attribute("data-pad"), "tiles:", await page.locator("[data-testid^='msg-tile-']").evaluate_all("els=>els.filter(e=>!e.dataset.testid.includes('status')).map(e=>e.dataset.testid.slice(9)+':'+e.querySelector('[data-state]').dataset.state)"), "roles:", await page.locator("[data-testid^='msg-role-']").count(), "stations:", await page.locator("[data-testid^='msg-station-']").count())
        await page.screenshot(path="/app/memory/tools/shots/msg_dir.png")
        await page.locator("[data-testid='msg-tile-Leo']").click(); await page.wait_for_timeout(300)
        print("   compose to:", await page.locator("[data-testid='msg-compose-to']").inner_text(), "presets:", await page.locator("[data-testid^='msg-preset-']").count())
        await page.locator("[data-testid='msg-preset-0']").click(); await page.locator("[data-testid='msg-compose-job']").fill("E02031"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500)
        print("   job chip:", await page.locator("[data-testid='msg-compose-job-chip']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/msg_compose.png")
        await page.locator("[data-testid='msg-compose-send']").click(); await page.wait_for_timeout(600)
        print("   sent ok:", await page.locator("[data-testid='msg-sent-ok']").inner_text(), "| back to dir:", await page.locator("[data-testid='msg-dir']").count())
        await page.locator("[data-testid='msg-tab-sent']").click(); await page.wait_for_timeout(400); print("   sent rows:", await page.locator("[data-testid^='msg-sent-ib-']").count(), "first:", (await page.locator("[data-testid^='msg-sent-ib-']").first.inner_text()).replace("\n", " | ")[:120])
        await page.locator("[data-testid='msg-tab-inbox']").click(); await page.wait_for_timeout(500); print("   inbox rows:", await page.locator("[data-testid^='msg-inbox-ib-']").count(), "unread:", await page.locator("[data-testid^='msg-inbox-ib-'][data-unread='true']").count())
        await page.screenshot(path="/app/memory/tools/shots/msg_inbox.png")
        # role-tagged message to #manager → lands in MY inbox → banner
        await page.locator("[data-testid='msg-tab-send']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='msg-role-manager']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='msg-preset-3']").click(); await page.locator("[data-testid='msg-compose-send']").click(); await page.wait_for_timeout(700)
        print("   banner after role send:", await page.locator("[data-testid='msg-banner']").count(), (await page.locator("[data-testid='msg-banner-text']").all_inner_texts()))
        await page.screenshot(path="/app/memory/tools/shots/msg_banner.png", clip={"x": 300, "y": 0, "width": 900, "height": 120})
        await page.locator("[data-testid='msg-tab-inbox']").click(); await page.wait_for_timeout(500)
        claim = page.locator("[data-testid^='msg-inbox-claim-']"); print("   claimable:", await claim.count())
        if await claim.count(): await claim.first.click(); await page.wait_for_timeout(400)
        rows = page.locator("[data-testid^='msg-inbox-ib-']"); first = await rows.first.get_attribute("data-testid"); rid = first.replace("msg-inbox-", "")
        if await page.locator(f"[data-testid='msg-inbox-reply-{rid}']").count():
            await page.locator(f"[data-testid='msg-inbox-reply-{rid}']").click(); await page.wait_for_timeout(400); print("   reply compose:", await page.locator("[data-testid='msg-compose-to']").inner_text(), "quote:", await page.locator("[data-testid='msg-compose-reply-quote']").count())
            await page.locator("[data-testid='msg-preset-8']").click(); await page.locator("[data-testid='msg-compose-send']").click(); await page.wait_for_timeout(600); print("   reply sent:", await page.locator("[data-testid='msg-sent-ok']").all_inner_texts())
        await page.locator("[data-testid='msg-tab-inbox']").click(); await page.wait_for_timeout(400)
        done = page.locator("[data-testid^='msg-inbox-done-']"); await done.first.click(); await page.wait_for_timeout(400); print("   after done statuses:", await page.locator("[data-testid^='msg-inbox-ib-']").evaluate_all("els=>els.slice(0,4).map(e=>e.dataset.testid.slice(10)+':'+e.dataset.status)"))
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300); print("   panel closed:", await page.locator("[data-testid='msg-panel']").count() == 0)
        # 10. RW shell bubble (dark, full sheet)
        await nav(page, "/rw"); await page.wait_for_timeout(800); print("== rw bubble:", await page.locator("[data-testid='msg-bubble']").count(), "corner pill:", await page.locator("[data-testid='corner-lookup-open']").count())
        await page.locator("[data-testid='msg-bubble']").click(); await page.wait_for_timeout(500); print("   rw panel pad:", await page.locator("[data-testid='msg-panel']").get_attribute("data-pad"), "tiles:", await page.locator("[data-testid^='msg-tile-']").evaluate_all("els=>els.filter(e=>!e.dataset.testid.includes('status')).length"))
        await page.screenshot(path="/app/memory/tools/shots/msg_rw.png")
        print("page errors:", errs)
        await b.close()
asyncio.run(main())

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

        # --- Flow A: approval -> job addon confirm (portal) + outbox confirmation email
        await T(page, "dev-simulate-call").click(); await T(page, "dev-call-two-jobs").click(); await page.wait_for_timeout(4000)
        await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(400)
        await T(page, "call-disposition-approval_given").click(); await page.wait_for_timeout(200)
        job_val = await T(page, "call-disposition-job").input_value()
        await T(page, "call-approval-what").fill("Crown replacement")
        await T(page, "call-approval-amount").fill("185")
        await T(page, "call-disposition-save").click(); await page.wait_for_timeout(800)
        print("[A] disposition closed:", await T(page, "call-disposition").count(), "selected job:", job_val)

        await nav(page, f"/jobs/{job_val}"); await page.wait_for_timeout(900)
        pending = page.locator("[data-testid^='addon-pending-']")
        print("[A] pending addons:", await pending.count())
        pid = (await pending.first.get_attribute("data-testid") or "").replace("addon-pending-", "")
        print("[A] pending id:", pid)
        portal_btn = T(page, f"addon-confirm-{pid}-portal")
        print("[A] portal btn exists:", await portal_btn.count(), "email:", await T(page, f"addon-confirm-{pid}-email").count(), "counter:", await T(page, f"addon-confirm-{pid}-counter").count())
        await portal_btn.click(); await page.wait_for_timeout(500)
        confirmed = T(page, f"addon-confirmed-{pid}")
        print("[A] confirmed badge:", await confirmed.count(), "text:", (await confirmed.inner_text() if await confirmed.count() else "-")[:80])

        # Outbox
        await nav(page, "/intake/sent"); await page.wait_for_timeout(900)
        subjects = await page.locator("li").all_text_contents()
        pc = [s for s in subjects if "Please confirm" in s]
        print("[A] outbox 'Please confirm' matches:", len(pc), "sample:", (pc[0][:120] if pc else "-"))

        # --- Flow B: job-call-client -> status_inquiry row shows
        await nav(page, f"/jobs/{job_val}"); await page.wait_for_timeout(800)
        await T(page, "job-call-client").click(); await page.wait_for_timeout(700)
        print("[B] outbound pop:", await T(page, "call-pop").get_attribute("data-direction"))
        await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(400)
        await T(page, "call-disposition-status_inquiry").click(); await page.wait_for_timeout(200)
        await T(page, "call-disposition-save").click(); await page.wait_for_timeout(600)
        txt = await page.locator("[data-testid='job-calls']").inner_text()
        print("[B] job-calls contains Status inquiry:", "Status inquiry" in txt, "| count:", await T(page, "job-calls-count").inner_text())

        # --- Flow C: unknown -> new-client-from-call
        await T(page, "dev-simulate-call").click(); await T(page, "dev-call-unknown").click(); await page.wait_for_timeout(600)
        await T(page, "call-pop-new-client").click(); await page.wait_for_timeout(1000)
        print("[C] url:", page.url, "| form:", await T(page, "new-client-from-call").count())
        # Try common testids for first/last
        async def fill_any(ids, val):
            for i in ids:
                el = T(page, i)
                if await el.count():
                    await el.fill(val); return i
            return None
        f_used = await fill_any(["new-client-first", "new-client-firstname", "ncfc-first", "nc-first"], "Test")
        l_used = await fill_any(["new-client-last", "new-client-lastname", "ncfc-last", "nc-last"], "FromCall")
        print("[C] filled first via:", f_used, "last via:", l_used)
        await T(page, "new-client-create").click(); await page.wait_for_timeout(1200)
        print("[C] landed:", page.url, "| client360 calls:", await T(page, "client360-calls-section").count())

        # --- Flow D: search-hit-rating-c-30
        await nav(page, "/"); await page.wait_for_timeout(300)
        await T(page, "global-search-input").fill("Calloway"); await page.wait_for_timeout(900)
        print("[D] search-hit-rating-c-30:", await T(page, "search-hit-rating-c-30").count(), "search-hit-wbp-c-30:", await T(page, "search-hit-wbp-c-30").count())
        await page.keyboard.press("Escape")

        # --- Flow E: calls page -> missed-call-back decrements badge
        await nav(page, "/calls"); await page.wait_for_timeout(900)
        before_badge_el = page.locator("[data-testid='nav-calls-missed'], [data-testid='nav-clients-missed']").first
        before = (await before_badge_el.inner_text()) if await before_badge_el.count() else "0"
        before_missed_rows = await page.locator("[data-testid^='missed-call-'][data-testid$='-back'], [data-testid^='missed-call-back-']").count()
        print("[E] badge before:", before, "| missed back buttons:", before_missed_rows)
        # Prefer missed-call-back-<id> pattern
        back_btn = page.locator("[data-testid^='missed-call-back-']").first
        if await back_btn.count():
            tid = await back_btn.get_attribute("data-testid")
            print("[E] clicking:", tid)
            await back_btn.click(); await page.wait_for_timeout(1200)
            # outbound card appears; hang up + skip
            if await T(page, "call-pop-hangup").count():
                await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(400)
                if await T(page, "call-disposition-skip").count():
                    await T(page, "call-disposition-skip").click(); await page.wait_for_timeout(500)
        after = (await before_badge_el.inner_text()) if await before_badge_el.count() else "0"
        print("[E] badge after:", after)

        # --- Flow F: phone-link-error when calling while live
        await nav(page, "/clients"); await page.wait_for_timeout(700)
        links = page.locator("[data-testid^='directory-phone-']")
        print("[F] phone links:", await links.count())
        await links.nth(0).click(); await page.wait_for_timeout(600)
        print("[F] first click outbound:", await T(page, "call-pop").get_attribute("data-direction"))
        await links.nth(1).click(); await page.wait_for_timeout(500)
        err = T(page, "phone-link-error")
        print("[F] phone-link-error:", await err.count(), "text:", (await err.inner_text() if await err.count() else "-")[:80])
        await T(page, "call-pop-hangup").click(); await page.wait_for_timeout(400)
        if await T(page, "call-disposition-skip").count():
            await T(page, "call-disposition-skip").click(); await page.wait_for_timeout(400)

        print("ERRORS:", errs)
        await b.close()

        # --- Flow G: MM supervisor has NO call-pop-host on /rw/bench
        b2 = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        ctx2 = await b2.new_context(viewport={"width": 1500, "height": 950})
        await ctx2.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')")
        p2 = await ctx2.new_page()
        errs2 = []; p2.on("pageerror", lambda e: errs2.append(str(e)))
        await signin(p2, "mm", "mm123"); await p2.wait_for_timeout(800)
        print("[G] MM url:", p2.url, "| dev-simulate-call:", await T(p2, "dev-simulate-call").count(), "| call-pop-host:", await T(p2, "call-pop-host").count())
        print("ERRORS2:", errs2)
        await b2.close()

asyncio.run(main())

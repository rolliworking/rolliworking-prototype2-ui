import asyncio
from playwright.async_api import async_playwright
BASE = "http://localhost:3000"

async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path)
    await page.wait_for_timeout(1400)

async def signin(page, who="michael", pw="michael123"):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(500)
    await page.locator(f"[data-testid='staff-card-{who}']").click(force=True); await page.wait_for_timeout(500)
    for secret in (pw, "1234"):
        if "/sign-in" not in page.url: break
        await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(2200)
    if await page.locator("[data-testid='choose-view-own']").count():
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1500, "height": 950})
        await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')")
        page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page)

        # Receive package list route
        await nav(page, "/intake/receive")
        n_receive = await page.locator("[data-testid^='receive-wbp-']").count()
        print(f"== /intake/receive receive-wbp count: {n_receive}, url={page.url}")

        # Regression: process-flow on /jobs/j-30
        await nav(page, "/jobs/j-30")
        pf = await page.locator("[data-testid='process-flow']").count()
        print(f"== process-flow present on j-30: {pf}")

        # Top-bar messages-btn popover open/close regression
        mbtn = await page.locator("[data-testid='messages-btn']").count()
        print(f"== top-bar messages-btn present: {mbtn}")
        if mbtn:
            await page.locator("[data-testid='messages-btn']").click(); await page.wait_for_timeout(400)
            popover_visible_after_open = await page.locator("[data-testid='msg-to'], [data-testid^='messages-']").count()
            print(f"   popover after open (msg-to / messages-* count): {popover_visible_after_open}")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)

        # Compose empty send → error
        await page.locator("[data-testid='msg-bubble']").click(); await page.wait_for_timeout(400)
        await page.locator("[data-testid='msg-tile-Leo']").click(); await page.wait_for_timeout(300)
        # clear any preselected text
        # click send with empty
        await page.locator("[data-testid='msg-compose-send']").click(); await page.wait_for_timeout(400)
        err_ct = await page.locator("[data-testid='msg-compose-error']").count()
        err_txt = ""
        if err_ct:
            err_txt = await page.locator("[data-testid='msg-compose-error']").inner_text()
        print(f"== msg-compose-error on empty send: count={err_ct} txt='{err_txt}'")

        # Inbox tab unread badge
        await page.locator("[data-testid='msg-tab-inbox']").click(); await page.wait_for_timeout(400)
        unread_badge = await page.locator("[data-testid='msg-tab-inbox-unread']").count()
        unread_txt = await page.locator("[data-testid='msg-tab-inbox-unread']").all_inner_texts() if unread_badge else []
        print(f"== msg-tab-inbox-unread present: {unread_badge} txt={unread_txt}")

        # ib-12 details
        ib12_ct = await page.locator("[data-testid='msg-inbox-ib-12']").count()
        ib12_txt = ""
        if ib12_ct:
            ib12_txt = (await page.locator("[data-testid='msg-inbox-ib-12']").inner_text()).replace("\n", " | ")
        joblink_ct = await page.locator("[data-testid='msg-inbox-job-ib-12']").count()
        joblink_txt = await page.locator("[data-testid='msg-inbox-job-ib-12']").inner_text() if joblink_ct else ""
        print(f"== ib-12 row: {ib12_ct} '{ib12_txt[:180]}' joblink={joblink_txt}")

        # done → reopen appears
        if await page.locator("[data-testid='msg-inbox-done-ib-12']").count():
            await page.locator("[data-testid='msg-inbox-done-ib-12']").click(); await page.wait_for_timeout(300)
        reopen_ct = await page.locator("[data-testid='msg-inbox-reopen-ib-12']").count()
        print(f"== msg-inbox-reopen-ib-12 after done: {reopen_ct}")

        await page.keyboard.press("Escape")

        # view-as switch to Leo, check bubble unread updates
        vas = page.locator("[data-testid='view-as-select']")
        if await vas.count():
            await vas.select_option("u-leo"); await page.wait_for_timeout(1200)
            leo_unread = await page.locator("[data-testid='msg-bubble-unread']").all_inner_texts()
            print(f"== after view-as Leo, bubble unread: {leo_unread}")
            await page.locator("[data-testid='msg-bubble']").click(); await page.wait_for_timeout(400)
            await page.locator("[data-testid='msg-tab-inbox']").click(); await page.wait_for_timeout(400)
            leo_rows = await page.locator("[data-testid^='msg-inbox-ib-']").count()
            print(f"   Leo inbox rows: {leo_rows}")
            await page.keyboard.press("Escape")

        # Directory: client with no open jobs (component returns null)
        await nav(page, "/clients")
        total_rows = await page.locator("tr, li").count()  # sanity
        wbp_rows = await page.locator("[data-testid^='directory-wbp-']").count()
        print(f"== /clients directory-wbp rows: {wbp_rows} (expected ~26)")

        print("page errors:", errs)
        await b.close()

asyncio.run(main())

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
        await nav(page, "/inbox"); await page.wait_for_timeout(900)
        print("sections:", await page.locator("[data-testid^='inbox-section-']").all_inner_texts())
        print("who:", await page.locator("[data-testid^='inbox-who-']").all_inner_texts(), "| lanes:", await page.locator("[data-testid^='inbox-lane-']").all_inner_texts())
        print("list count:", await T(page, "inbox-list-count").inner_text(), "| pinned sec:", await T(page, "inbox-sec-pinned").get_attribute("data-count") if await T(page, "inbox-sec-pinned").count() else "-", "| quoted sec:", await T(page, "inbox-sec-quoted").get_attribute("data-count") if await T(page, "inbox-sec-quoted").count() else "-")
        # right-click a row → menu → tag Chyna
        await T(page, "thread-row-cv-ib1").click(button="right"); await page.wait_for_timeout(300); print("menu open:", await T(page, "thread-menu").count(), "| items:", await page.locator("[data-testid='thread-menu'] [role=menuitem]").all_inner_texts())
        await T(page, "thread-menu-tag-chyna").click(); await page.wait_for_timeout(600); print("tags on cv-ib1:", await T(page, "thread-tags-cv-ib1").get_attribute("data-tags"), "| flash:", await page.locator("[data-testid='flash-msg'], .text-moss-700").first.inner_text() if await page.locator("[data-testid='flash-msg']").count() else "")
        # VIENNA filter
        await T(page, "inbox-who-vienna").click(); await page.wait_for_timeout(600); print("VIENNA filter count:", await T(page, "inbox-list-count").inner_text())
        await T(page, "inbox-who-all").click(); await page.wait_for_timeout(400)
        # open thread → share with staff
        await T(page, "thread-row-cv-ib4").click(); await page.wait_for_timeout(1200)
        shares = page.locator("[data-testid^='msg-share-cm'], [data-testid^='msg-share-']").filter(has_text="Share with staff"); print("share buttons:", await shares.count())
        await shares.first.click(); await page.wait_for_timeout(700)
        print("bubble panel:", await T(page, "msg-panel").count(), "| share compose:", await T(page, "msg-share").count(), "| quote:", (await T(page, "msg-share-quote").inner_text())[:80].replace("\n", " | "))
        await T(page, "msg-share-tile-JV").click(); await T(page, "msg-share-tile-Leo").click(); await T(page, "msg-share-note").fill("Can you both check the crown notes?"); await T(page, "msg-share-send").click(); await page.wait_for_timeout(1200)
        print("sent ok:", await T(page, "msg-sent-ok").inner_text() if await T(page, "msg-sent-ok").count() else "NONE")
        shared = page.locator("[data-testid^='msg-source-']").filter(has_text="shared with staff"); print("thread shared log lines:", await shared.count(), "| last:", await page.locator("[data-testid^='msg-cm']").last.inner_text() if await page.locator("[data-testid^='msg-cm']").count() else "-")
        await T(page, "msg-panel-close").click(); await page.wait_for_timeout(300)
        # archive via hover button → archived lane
        await T(page, "thread-item-cv-ib1").hover(); await page.wait_for_timeout(200); await T(page, "thread-archive-cv-ib1").click(force=True); await page.wait_for_timeout(600)
        print("after archive list:", await T(page, "inbox-list-count").inner_text(), "| archived chip:", await T(page, "inbox-lane-archived").inner_text())
        await T(page, "inbox-lane-archived").click(); await page.wait_for_timeout(500); print("archived rows:", await page.locator("[data-testid^='thread-row-cv']").count(), "| cv-ib1 there:", await T(page, "thread-row-cv-ib1").count())
        await T(page, "thread-item-cv-ib1").hover(); await T(page, "thread-unarchive-cv-ib1").click(force=True); await page.wait_for_timeout(500); await T(page, "inbox-lane-all").click(); await page.wait_for_timeout(500); print("back in all:", await T(page, "thread-row-cv-ib1").count(), "| tags cleared:", await T(page, "thread-tags-cv-ib1").count() == 0)
        # Internal section as Vienna (no folders)
        await T(page, "inbox-section-staff").click(); await page.wait_for_timeout(600); print("Vienna internal folders:", await page.locator("[data-testid^='internal-folder-']").all_inner_texts())
        # Requests: right-click → tag
        await nav(page, "/requests"); await page.wait_for_timeout(800); print("request tags header present:", await page.locator("th", has_text="Tags").count(), "| rq-05 tags:", await T(page, "request-tags-rq-05").inner_text())
        await T(page, "request-row-rq-05").click(button="right"); await page.wait_for_timeout(300); print("request menu:", await T(page, "request-menu").count(), "| has pin item:", await T(page, "request-menu-pin").count())
        await T(page, "request-menu-tag-mike").click(); await page.wait_for_timeout(800); print("rq-05 tags after:", await T(page, "request-tags-rq-05").get_attribute("data-tags"), "| url:", page.url)
        # MH: Internal folders (fresh context — the in-memory store is per tab, so seeds only)
        ctx2 = await b.new_context(viewport={"width": 1600, "height": 950}); await ctx2.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx2.new_page(); page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "michael", "michael123"); await page.wait_for_timeout(500)
        if await T(page, "choose-view-own").count(): await T(page, "choose-view-own").click(); await page.wait_for_timeout(500)
        await nav(page, "/messages/all?staff=JV"); await page.wait_for_timeout(900); print("MH url:", page.url, "| folder:", await T(page, "inbox-staff-section").get_attribute("data-folder"), "| title:", await T(page, "internal-folder-title").inner_text(), "| rows:", await T(page, "internal-all-list").get_attribute("data-count"))
        print("MH folders:", (await page.locator("[data-testid^='internal-folder-']").all_inner_texts())[:12])
        await T(page, "internal-folder-all").click(); await page.wait_for_timeout(500); print("Everyone rows:", await T(page, "internal-all-list").get_attribute("data-count"), "| url:", page.url)
        await T(page, "internal-folder-me").click(); await page.wait_for_timeout(500); print("To me rows:", await page.locator("[data-testid^='msg-inbox-ib']").count())
        await page.screenshot(path="/tmp/inbox_internal_mh.png", quality=30, type="jpeg")
        print("page errors:", errs)
        await b.close()
asyncio.run(main())

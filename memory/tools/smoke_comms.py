import asyncio, sys
sys.path.insert(0, "/app/scripts")
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
OUT = "/app/memory/tools/shots"
import os; os.makedirs(OUT, exist_ok=True)

async def rs_sign_in(page, user, pw):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
    await page.evaluate("localStorage.setItem('rollisuite.api.mode','mock')")
    if await page.locator(f"[data-testid='staff-card-{user}']").count():
        await page.locator(f"[data-testid='staff-card-{user}']").click(force=True); await page.wait_for_timeout(800)
        for secret in (pw, "1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3500)
    print("session:", page.url)

async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); page = await ctx.new_page()
        logs = []; page.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
        await page.goto(f"{BASE}/sign-in"); await page.evaluate("localStorage.setItem('rollisuite.api.mode','mock')"); await rs_sign_in(page, "michael", "michael123")
        # 1. Desktop message: send to #polisher with job
        await page.locator("[data-testid='messages-btn']").click(); await page.wait_for_timeout(500)
        await page.select_option("[data-testid='msg-to']", "role:polisher")
        await page.fill("[data-testid='msg-text']", "Brushed only on E02016 case sides — no high polish")
        await page.fill("[data-testid='msg-job-input']", "E02016"); await page.keyboard.press("Enter"); await page.wait_for_timeout(2500); print("err:", await page.locator("[data-testid='msg-error']").all_inner_texts())
        print("job chip:", await page.locator("[data-testid='msg-job-chip']").count())
        await page.locator("[data-testid='msg-send']").click(); await page.wait_for_timeout(600)
        print("sent ok:", await page.locator("[data-testid='messages-sent-ok']").inner_text())
        await page.locator("[data-testid='messages-tab-sent']").click(); await page.wait_for_timeout(400)
        print("sent statuses:", await page.locator("[data-testid='sent-list'] [data-testid='msg-status']").evaluate_all("els => els.slice(0,3).map(e => e.dataset.status)"))
        await page.screenshot(path=f"{OUT}/desk_sent.png")
        await page.locator("[data-testid='messages-close']").click()
        # 2. Page zone WM via intercom
        await page.locator("[data-testid='intercom-btn']").click(); await page.wait_for_timeout(400)
        await page.locator("[data-testid='intercom-zone-wm']").click(); await page.fill("[data-testid='intercom-page-input']", "WM room: parts landed"); await page.locator("[data-testid='intercom-page-send']").click(); await page.wait_for_timeout(400)
        print("banner visible at Front Desk 1 for WM zone page (expect 0):", await page.locator("[data-testid='intercom-page-overlay']").count())
        await page.locator("[data-testid='intercom-zone-all']").click(); await page.fill("[data-testid='intercom-page-input']", "Everyone: lunch"); await page.locator("[data-testid='intercom-page-send']").click(); await page.wait_for_timeout(400)
        print("banner for all (expect 1):", await page.locator("[data-testid='intercom-page-overlay']").count(), await page.locator("[data-testid='intercom-page-zone-label']").inner_text())
        await page.locator("[data-testid='intercom-close']").click()
        # 3. Inbox on my hitlist: station message to Front Desk 1 (ib-12) + done
        await nav(page, "/today")
        print("station msg visible:", await page.locator("[data-testid='inbox-station-ib-12']").count())
        await page.locator("[data-testid='inbox-done-ib-12']").click(); await page.wait_for_timeout(500)
        print("ib-12 status:", await page.locator("[data-testid='inbox-ib-12']").get_attribute("data-status"))
        await page.screenshot(path=f"{OUT}/inbox.png")
        # 4. Photos panel chips
        await nav(page, "/jobs/j-04")
        print("photo chips:", await page.locator("[data-testid='photo-type-chips'] button").all_inner_texts())
        await page.locator("[data-testid='photo-type-bench']").click(); await page.wait_for_timeout(300)
        print("bench photos shown:", await page.locator("[data-testid='photo-grid'] figure").count())
        await page.screenshot(path=f"{OUT}/photos.png")
        # 5. Access control
        await nav(page, "/setup/access")
        print("access page:", await page.locator("[data-testid='access-control-page']").count(), "nav item:", await page.locator("[data-testid='nav-access']").count())
        c = page.locator("[data-testid='access-cell-u-chyna-jobs']"); print("chyna jobs before:", await c.get_attribute("data-effective"), await c.get_attribute("data-diff"))
        await c.click(); await page.wait_for_timeout(500); print("chyna jobs after:", await c.get_attribute("data-effective"), await c.get_attribute("data-diff"))
        print("log rows:", await page.locator("[data-testid='access-log'] li").count(), "diff count:", await page.locator("[data-testid='access-diff-count-u-chyna']").inner_text())
        await page.hover("[data-testid='access-col-jobs']"); await page.wait_for_timeout(200); print("desc:", (await page.locator("[data-testid='access-description']").inner_text())[:80])
        await page.screenshot(path=f"{OUT}/access.png")
        # Does Chyna now see Jobs? sign in as chyna in a fresh tab (same localStorage)
        p2 = await ctx.new_page()
        await rs_sign_in(p2, "chyna", "chyna123")
        print("chyna nav-jobs:", await p2.locator("[data-testid='nav-jobs']").count())
        await nav(p2, "/jobs"); print("chyna /jobs restricted?:", await p2.locator("[data-testid='restricted-page']").count(), await p2.locator("[data-testid='job-board'],[data-testid='jobs-page']").count(), p2.url); await p2.screenshot(path=f"{OUT}/chyna_jobs.png")
        # reset
        await c.click(button="right"); await page.wait_for_timeout(500); print("chyna jobs reset:", await c.get_attribute("data-override"))
        # 6. Pad comms tab as MM
        p3 = await b.new_page(viewport={"width": 1024, "height": 768})
        await p3.goto(f"{BASE}/rw/pad", wait_until="networkidle"); await p3.wait_for_timeout(800)
        if await p3.locator("[data-testid='rw-card-u-mm']").count():
            await p3.locator("[data-testid='rw-card-u-mm']").click(force=True); await p3.wait_for_timeout(300)
            for secret in ("mm123", "1234"):
                if not await p3.locator("[data-testid='rw-secret']").count(): break
                await p3.locator("[data-testid='rw-secret']").fill(secret); await p3.keyboard.press("Enter"); await p3.wait_for_timeout(3000)
        print("pad url:", p3.url, "comms tab:", await p3.locator("[data-testid='pad-tab-comms']").count())
        await p3.locator("[data-testid='pad-tab-comms']").click(); await p3.wait_for_timeout(600)
        await p3.locator("[data-testid='pad-page-zone-wm']").click(); await p3.fill("[data-testid='pad-page-text']", "WM: MH to bench 2"); await p3.locator("[data-testid='pad-page-send']").click(); await p3.wait_for_timeout(500)
        print("pad page overlay (station FD1 → expect 0 for wm zone):", await p3.locator("[data-testid='intercom-page-overlay']").count())
        await p3.select_option("[data-testid='pad-msg-to']", "user:Leo"); await p3.fill("[data-testid='pad-msg-text']", "Take the GMT next"); await p3.locator("[data-testid='pad-msg-send']").click(); await p3.wait_for_timeout(600)
        print("pad sent rows:", await p3.locator("[data-testid='pad-sent-list'] li").count())
        await p3.screenshot(path=f"{OUT}/pad_comms.png")
        print("console errors:", logs[:5])
        await b.close()
asyncio.run(main())

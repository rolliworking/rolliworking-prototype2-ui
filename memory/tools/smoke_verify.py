import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"

async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path)
    await page.wait_for_timeout(1500)

async def signin(page, who, pw):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
    await page.locator(f"[data-testid='staff-card-{who}']").click(force=True); await page.wait_for_timeout(800)
    for secret in (pw,"1234"):
        if "/sign-in" not in page.url: break
        await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
    if await page.locator("[data-testid='choose-view-own']").count():
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width":1400,"height":1000})
        await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')")
        page = await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "michael", "michael123")

        # /concierge → look for esc chips & pane
        await nav(page, "/concierge")
        await page.wait_for_timeout(1500)
        esc = await page.locator("[data-testid^='concierge-esc-']").count()
        health = await page.locator("[data-testid^='concierge-health-']").count()
        cards = await page.locator("[data-testid^='concierge-card-']").count()
        # Try expanding a lane by clicking a cell
        cell = page.locator("[data-testid='cell-v-cm-queue']")
        if await cell.count():
            await cell.click(); await page.wait_for_timeout(800)
            panel = await page.locator("[data-testid='concierge-panel']").count()
            print("cell click → panel:", panel)
            esc_after = await page.locator("[data-testid^='concierge-esc-']").count()
            print("esc after cell click:", esc_after)
            cards_after = await page.locator("[data-testid^='concierge-card-']").count()
            print("cards after cell click:", cards_after)
        print("initial esc:", esc, "health:", health, "cards:", cards)

        # is TRACK|ACTION toggle rendered?
        toggle = await page.locator("[data-testid*='track'], [data-testid*='action']").evaluate_all("els=>els.map(e=>e.dataset.testid)")
        print("track/action toggles:", toggle[:10])

        # team hitlist header — try both patterns
        await nav(page, "/hitlist/jv/team")
        await page.wait_for_timeout(1500)
        title = await page.title()
        print("team page title:", title, "url:", page.url)
        headers = await page.locator("h1, [data-testid='today-header']").evaluate_all("els=>els.map(e=>e.textContent.trim().slice(0,120))")
        print("team page headers:", headers[:5])
        workshop_present = await page.get_by_text("Workshop", exact=False).count()
        print("'Workshop' text count on page:", workshop_present)

        # RW sign in - disabled user check: disable Sam first via /setup/access
        await nav(page, "/setup/access")
        await page.wait_for_timeout(800)
        if await page.locator("[data-testid='access-limits-u-sam']").count():
            await page.locator("[data-testid='access-limits-u-sam']").click(); await page.wait_for_timeout(500)
            await page.locator("[data-testid='limits-reason']").fill("Test disable"); await page.wait_for_timeout(200)
            await page.locator("[data-testid='limits-disable']").click(); await page.wait_for_timeout(600)
            await page.locator("[data-testid='limits-close']").click(); await page.wait_for_timeout(300)
        # sign out MH then go to /rw
        await nav(page, "/rw")
        # sign out
        so = page.locator("[data-testid='rw-sign-out']")
        if await so.count():
            await so.click(); await page.wait_for_timeout(1500)
        cards = await page.locator("[data-testid^='rw-card-']").evaluate_all("els=>els.map(e=>e.dataset.testid)")
        print("rw sign-in cards:", cards)
        has_sam = any("u-sam" in c for c in cards)
        print("rw-card-u-sam visible after disable:", has_sam)

        print("errors:", errs)
        await b.close()

asyncio.run(main())

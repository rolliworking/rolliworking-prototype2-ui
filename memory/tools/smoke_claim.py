import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width":1440,"height":900}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3500)
        await page.locator("[data-testid='messages-btn']").click(); await page.wait_for_timeout(400)
        await page.select_option("[data-testid='msg-to']", "role:polisher"); await page.fill("[data-testid='msg-text']", "Claim test — polish tray"); await page.locator("[data-testid='msg-send']").click(); await page.wait_for_timeout(500)
        # outside click closes popover; then intercom opens
        await page.mouse.click(700, 500); await page.wait_for_timeout(300); print("popover closed:", await page.locator("[data-testid='messages-panel']").count() == 0)
        await page.locator("[data-testid='intercom-btn']").click(); await page.wait_for_timeout(300); print("intercom zones:", await page.locator("[data-testid='intercom-page-zones']").count()); await page.locator("[data-testid='intercom-close']").click()
        # switch user → other → sign in as Dre (client-side, no reload)
        await page.locator("[data-testid='switch-user-button']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='switch-user-other']").click(); await page.wait_for_timeout(1500)
        print("at:", page.url)
        await page.locator("[data-testid='staff-card-dre']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("dre123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3500)
        print("dre at:", page.url)
        await nav(page, "/rw/hitlist/dre")
        claims = page.locator("[data-testid^='inbox-claim-']"); n = await claims.count(); print("claimable rows:", n)
        if n:
            first = await claims.first.get_attribute("data-testid"); await claims.first.click(); await page.wait_for_timeout(600)
            mid = first.replace("inbox-claim-", ""); print("after claim:", await page.locator(f"[data-testid='inbox-{mid}']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/dre_claim.png")
        await b.close()
asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1400,"height":1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)
        await nav(page, "/concierge")
        before = await page.locator("[data-testid$='-queue'][data-count]").evaluate_all("els=>Object.fromEntries(els.map(e=>[e.dataset.testid,+e.dataset.count]))"); print("before:", before)
        await nav(page, "/choose-view"); await page.locator("[data-testid='choose-view-JV']").click(); await page.wait_for_timeout(1500); await nav(page, "/rw/band"); await page.locator("[data-testid='pad-tab-jobs']").click(); await page.wait_for_timeout(500)
        card = page.locator("[data-testid^='pad-send-vendor-']:not([disabled])").first; tid = await card.get_attribute("data-testid"); print("job:", tid)
        await card.click(); await page.wait_for_timeout(500)
        print("save disabled (empty work):", await page.locator("[data-testid='swo-save']").is_disabled(), "vendor:", await page.locator("[data-testid='swo-vendor']").input_value())
        await page.locator("[data-testid='swo-work']").fill("Bracelet refinish"); print("save disabled after work:", await page.locator("[data-testid='swo-save']").is_disabled())
        await page.locator("[data-testid='swo-save']").click(); await page.wait_for_timeout(300)
        print("modal after save:", await page.locator("[data-testid='swo-modal']").count(), "toast:", await page.locator("[data-testid^='pad-toast']").all_inner_texts(), "err:", await page.locator("[data-testid='swo-form-error']").all_inner_texts())
        await page.locator("[data-testid='view-as-exit']").click(); await page.wait_for_timeout(1500); print("url:", page.url)
        await nav(page, "/concierge")
        after = await page.locator("[data-testid$='-queue'][data-count]").evaluate_all("els=>Object.fromEntries(els.map(e=>[e.dataset.testid,+e.dataset.count]))"); print("after:", after)
        print("errors:", errs)
        await b.close()
asyncio.run(main())

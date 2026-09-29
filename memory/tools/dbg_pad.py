import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1400,"height":1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e))); page.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-jv']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("jv123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        print("url:", page.url)
        await nav(page, "/rw/band"); await page.locator("[data-testid='pad-tab-jobs']").click(); await page.wait_for_timeout(600)
        v = page.locator("[data-testid^='pad-send-vendor-']"); print("send-vendor buttons:", await v.count())
        await v.first.click(); await page.wait_for_timeout(800)
        print("modal:", await page.locator("[data-testid='swo-modal']").count(), "any modal:", await page.locator("[role='dialog'], [data-testid$='-modal']").count())
        await page.screenshot(path="/app/memory/tools/shots/pad_vendor.png")
        print("errors:", errs[:5])
        await nav(page, "/rw/station"); print("station log empty li text:", await page.locator("[data-testid='station-log'] li").all_inner_texts())
        await b.close()
asyncio.run(main())

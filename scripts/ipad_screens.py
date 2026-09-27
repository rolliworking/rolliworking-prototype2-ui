import asyncio, os, zipfile
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
OUT = "/app/frontend/public/ipad-screens"
ZIP = "/app/frontend/public/ipad-screens-2026-09-27.zip"
os.makedirs(OUT, exist_ok=True)

async def rw_sign_in(page):
    await page.goto(f"{BASE}/rw/pad", wait_until="networkidle")
    await page.wait_for_timeout(800)
    if await page.locator("[data-testid='rw-card-u-mm']").count():
        await page.locator("[data-testid='rw-card-u-mm']").click(force=True)
        await page.wait_for_timeout(300)
        await page.locator("[data-testid='rw-secret']").fill("mm123")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(3000)

async def rs_sign_in(page):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle")
    await page.wait_for_timeout(800)
    if await page.locator("[data-testid='staff-card-mm']").count():
        await page.locator("[data-testid='staff-card-mm']").click(force=True)
        await page.wait_for_timeout(800)
        await page.locator("input[type='password']").first.fill("mm123")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(3500)
    await page.goto(f"{BASE}/jobs?view=board", wait_until="networkidle")
    await page.wait_for_timeout(1500)

async def shot(page, name, path=None, action=None):
    if path:
        # client-side navigation keeps the in-memory RW session alive (a full goto would reload and drop it)
        await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path)
        await page.wait_for_timeout(1800)
    if action:
        await action()
        await page.wait_for_timeout(900)
    await page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print("captured", name)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1024, "height": 768}, device_scale_factor=2)
        page = await ctx.new_page()
        # RolliWorking — WM Room Supervisor Pad
        await rw_sign_in(page)
        if not os.path.exists(f"{OUT}/10-rw-today.png"):
            await shot(page, "01-wm-supervisor-pad-jobs", "/rw/pad")
            await shot(page, "02-wm-supervisor-pad-parts", None, lambda: page.locator("[data-testid='pad-tab-parts']").click(force=True))
            await shot(page, "03-wm-supervisor-pad-review", None, lambda: page.locator("[data-testid='pad-tab-review']").click(force=True))
            await shot(page, "04-wm-supervisor-pad-audit", None, lambda: page.locator("[data-testid='pad-tab-audit']").click(force=True))
            await shot(page, "05-wm-supervisor-view", "/rw/supervisor")
            await shot(page, "06-wm-room-goals-per-watchmaker", "/rw/wm")
            await shot(page, "07-rw-work-queue", "/rw/queue")
            await shot(page, "08-rw-jobs-lookup", "/rw/jobs")
            await shot(page, "09-rw-picking", "/rw/picking")
            await shot(page, "10-rw-today", "/rw/today")
        # RolliSuite — Jobs board
        await rs_sign_in(page)
        await shot(page, "11-jobs-board-all-lanes", "/jobs?view=board")
        await shot(page, "12-jobs-list-grouped", "/jobs?view=list")
        await shot(page, "13-jobs-board-in-service", "/jobs?view=board&status=in_service")
        await shot(page, "14-jobs-board-testing-qc", "/jobs?view=board&status=testing")
        await shot(page, "15-jobs-board-closed-finished", "/jobs?view=board&status=closed")
        await shot(page, "16-jobs-shop-time", "/jobs/shop-time")
        await b.close()
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(OUT)):
            z.write(os.path.join(OUT, f), f)
    print("zip", ZIP, os.path.getsize(ZIP))

asyncio.run(main())

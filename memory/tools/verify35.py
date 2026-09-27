import asyncio
from playwright.async_api import async_playwright
B="http://localhost:3000"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); page=await (await b.new_context(viewport={"width":1400,"height":900})).new_page()
        await page.goto(B+"/rw/testing", wait_until="networkidle"); await page.wait_for_timeout(500)
        await page.click('[data-testid="rw-card-u-mm"]'); await page.fill('[data-testid="rw-secret"]','mm123'); await page.click('[data-testid="rw-sign-in-btn"]'); await page.wait_for_timeout(900)
        await page.fill('[data-testid="rt-scan"]','E02026'); await page.click('[data-testid="rt-scan-go"]'); await page.wait_for_timeout(700)
        await page.click('[data-testid="grade-cleanliness-score-5"]'); await page.click('[data-testid="grade-cleanliness-save"]'); await page.wait_for_timeout(300)
        await page.click('[data-testid="grade-case_condition-score-5"]'); await page.click('[data-testid="grade-case_condition-save"]'); await page.wait_for_timeout(300)
        await page.click('[data-testid="rt-start-test"]')
        for pos in ['DU','DD','CD','CL','CU','CR']:
            await page.fill(f'[data-testid="rt-{pos}-rate"]','2'); await page.fill(f'[data-testid="rt-{pos}-beat"]','0.3'); await page.fill(f'[data-testid="rt-{pos}-amp"]','280')
        await page.fill('[data-testid="rt-reserve"]','70'); await page.click('[data-testid="rt-pass"]'); await page.wait_for_timeout(600)
        print("rt-done:", await page.locator('[data-testid="rt-done"]').count())
        await page.click('[data-testid="rw-nav-qc"]'); await page.wait_for_timeout(700)
        print("qc timing badge (in-app nav):", await page.locator('[data-testid="rw-qc-timing-pass-j-16"]').count())
        # trade accept then in-app nav to job
        await page.goto(B+"/", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.click('[data-testid="trade-accept-j-t2"]'); await page.wait_for_timeout(500)
        print("flash:", await page.locator('[data-testid="trade-review-flash"]').inner_text())
        await page.click('a[href="/jobs"]'); await page.wait_for_timeout(700)
        await page.click('[data-testid="job-filter-ready_to_ship"]'); await page.wait_for_timeout(300)
        await page.click('a[href="/jobs/j-t2"]', force=True) if await page.locator('a[href="/jobs/j-t2"]').count() else print("no j-t2 link on board")
        await page.wait_for_timeout(700); print("url:", page.url, "act-open-so:", await page.locator('[data-testid="act-open-so"]').count())
        # trade scan-in new watch
        await page.goto(B+"/intake/trade", wait_until="networkidle"); await page.wait_for_timeout(600)
        await page.click('[data-testid="trade-account-c-31"]'); await page.fill('[data-testid="trade-new-model"]','Explorer 36'); await page.fill('[data-testid="trade-new-reference"]','124270'); await page.fill('[data-testid="trade-new-serial"]','X1Y2Z3A4'); await page.fill('[data-testid="trade-line-desc-0"]','Bracelet refinish'); await page.fill('[data-testid="trade-line-price-0"]','650'); await page.click('[data-testid="trade-scan-submit"]'); await page.wait_for_timeout(600)
        print("created:", await page.locator('[data-testid^="trade-created-j"]').count(), "err:", await page.locator('[data-testid="trade-scan-error"]').count())
        await b.close()
asyncio.run(main())

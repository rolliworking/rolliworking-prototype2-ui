import asyncio
from playwright.async_api import async_playwright
B="http://localhost:3000"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); page=await (await b.new_context(viewport={"width":1400,"height":900})).new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(B+"/rw/evidence", wait_until="networkidle"); await page.wait_for_timeout(600)
        if await page.locator('[data-testid="rw-card-u-mm"]').count():
            await page.click('[data-testid="rw-card-u-mm"]'); await page.fill('[data-testid="rw-secret"]','mm123'); await page.click('[data-testid="rw-sign-in-btn"]'); await page.wait_for_timeout(900)
        await page.click('[data-testid^="rw-evidence-open-"]') if await page.locator('[data-testid^="rw-evidence-open-"]').count() else await page.locator('[data-testid="rw-evidence-queue"] button, [data-testid="rw-evidence-queue"] li').first.click()
        await page.wait_for_timeout(600)
        await page.click('[data-testid="evidence-slot-timing_sheet"]'); await page.wait_for_timeout(300)
        await page.set_input_files('[data-testid="evidence-capture"] input[type=file]', '/app/memory/tools/timing_sheet_test.jpg'); await page.wait_for_timeout(800)
        print("extract state:", await page.locator('[data-testid="sheet-extract"]').get_attribute('data-state'))
        await page.wait_for_selector('[data-testid="sheet-extract"][data-state="ready"]', timeout=90000)
        print("DU rate:", await page.locator('[data-testid="extract-DU-rate"]').input_value(), "CU amp:", await page.locator('[data-testid="extract-CU-amp"]').input_value(), "delta:", await page.locator('[data-testid="extract-delta"]').input_value(), "conf:", await page.locator('[data-testid="sheet-extract-confidence"]').inner_text())
        await page.fill('[data-testid="extract-DU-rate"]','2.5'); await page.click('[data-testid="sheet-extract-confirm"]'); await page.wait_for_timeout(300)
        print("verified:", await page.locator('[data-testid="sheet-extract-verified"]').inner_text())
        await page.screenshot(path="/app/memory/tools/ai_verify.png")
        # status line draft
        await page.goto(B+"/shipping/inbound", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.goto(B+"/shipping/inbound?track=sh-04", wait_until="networkidle"); await page.wait_for_timeout(900)
        if await page.locator('[data-testid="tracking-draft-ai"]').count():
            before=await page.locator('[data-testid="tracking-client-line-text"]').input_value(); await page.click('[data-testid="tracking-draft-ai"]'); await page.wait_for_selector('[data-testid="tracking-draft-ai"]:not([disabled])', timeout=60000); await page.wait_for_timeout(200)
            print("draft before:", before[:70]); print("draft after :", (await page.locator('[data-testid="tracking-client-line-text"]').input_value())[:120])
        else: print("tracking panel not opened")
        print("errors:", errs[:2]); await b.close()
asyncio.run(main())

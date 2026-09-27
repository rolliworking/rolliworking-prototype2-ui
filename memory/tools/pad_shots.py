import asyncio, os, sys
from playwright.async_api import async_playwright

B = "http://localhost:3000"
OUT = "/app/frontend/public/supervisor-pad-screens"
os.makedirs(OUT, exist_ok=True)
INDEX = []

async def shot(page, name, desc):
    await page.wait_for_timeout(500)
    await page.screenshot(path=f"{OUT}/{name}", full_page=True)
    INDEX.append(f"{name} — {desc}")
    print("saved", name)

async def rw_login(page, uid, pw):
    await page.goto(B + "/rw/pad", wait_until="networkidle")
    await page.wait_for_timeout(600)
    if await page.locator(f'[data-testid="rw-card-{uid}"]').count():
        await page.click(f'[data-testid="rw-card-{uid}"]')
        await page.wait_for_timeout(300)
        await page.fill('[data-testid="rw-secret"]', pw)
        await page.click('[data-testid="rw-sign-in-btn"]')
        await page.wait_for_timeout(1200)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1180, "height": 820}, device_scale_factor=1)
        page = await ctx.new_page()
        await rw_login(page, "u-mm", "mm123")
        await page.goto(B + "/rw/pad", wait_until="networkidle"); await page.wait_for_timeout(800)
        assert await page.locator('[data-testid="rw-pad-page"]').count(), "pad not visible"
        # 01 jobs (landscape + portrait)
        await shot(page, "01-jobs.png", "Supervisor Pad · Jobs tab — job board (stepper cards) with client-request badges · 1180x820 landscape")
        await page.set_viewport_size({"width": 820, "height": 1180}); await page.wait_for_timeout(500)
        await shot(page, "01-jobs-portrait.png", "Supervisor Pad · Jobs tab — same board · 820x1180 portrait")
        # 02 detail sheet (portrait first then landscape)
        job_with_photos = None
        for jid in ["j-01", "j-30", "j-04", "j-24", "j-03", "j-06"]:
            if await page.locator(f'[data-testid="pad-open-{jid}"]').count():
                job_with_photos = jid; break
        await page.click(f'[data-testid="pad-open-{job_with_photos}"]'); await page.wait_for_timeout(700)
        await shot(page, "02-detail-portrait.png", f"Job detail sheet open ({job_with_photos}) — photos + inspection / condition notes · 820x1180 portrait")
        await page.set_viewport_size({"width": 1180, "height": 820}); await page.wait_for_timeout(500)
        await shot(page, "02-detail.png", f"Job detail sheet open ({job_with_photos}) — photos + inspection / condition notes · 1180x820 landscape")
        # 12 lightbox while sheet is open
        if await page.locator('[data-testid^="pad-photo-"]').count():
            await page.locator('[data-testid^="pad-photo-"]').first.click(); await page.wait_for_timeout(600)
            await shot(page, "12-lightbox.png", "Photo lightbox open from the job detail sheet (tap image to zoom)")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
            if await page.locator('[data-testid="rw-lightbox"]').count():
                await page.locator('[data-testid="rw-lightbox"]').click(position={"x": 20, "y": 400}); await page.wait_for_timeout(300)
        # close sheet
        for sel in ['[data-testid="pad-sheet-close"]', 'button:has-text("Close")', '[aria-label="Close"]']:
            if await page.locator(sel).count():
                await page.locator(sel).first.click(); break
        else:
            await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)
        if await page.locator('[data-testid="pad-detail-photos"], [data-testid="pad-detail-condition"]').count():
            await page.goto(B + "/rw/pad", wait_until="networkidle"); await page.wait_for_timeout(800)
        # 03 send-back picker
        sb = page.locator('[data-testid^="pad-sendback-"]:not([disabled])').first
        await sb.click(); await page.wait_for_timeout(600)
        await shot(page, "03-sendback.png", "Send-back reason picker open (Rework / Waiting on part / Failed QC / Other + note)")
        await page.goto(B + "/rw/pad", wait_until="networkidle"); await page.wait_for_timeout(800)
        # 04 parts composer with scan + "bezel" suggestions
        await page.click('[data-testid="pad-tab-parts"]'); await page.wait_for_timeout(400)
        scanned = False
        for code in ["E01903", "E02016", "E02011"]:
            await page.fill('[data-testid="pad-scan"]', code); await page.press('[data-testid="pad-scan"]', 'Enter'); await page.wait_for_timeout(700)
            if await page.locator('[data-testid="client-request-understood"]').count():
                await page.click('[data-testid="client-request-understood"]'); await page.wait_for_timeout(300)
            if await page.locator('[data-testid="pad-part-input"]').count():
                scanned = True; break
        assert scanned, "parts composer did not open"
        await page.fill('[data-testid="pad-part-input"]', "bezel"); await page.wait_for_timeout(700)
        await shot(page, "04-parts-composer.png", "Parts tab — composer with a watch scanned, live suggestions for 'bezel' incl. the learned tag (recent choice for this reference)")
        # 05 parts history
        await page.click('[data-testid="pad-seg-history"]'); await page.wait_for_timeout(600)
        await shot(page, "05-parts-history.png", "Parts tab — History segment (past requests, status, steps)")
        # 06 review pending incl. OUT OF STOCK
        await page.click('[data-testid="pad-tab-review"]'); await page.wait_for_timeout(700)
        await shot(page, "06-review.png", "Review tab — pending cards incl. the OUT OF STOCK allocate card")
        # 07 generic being priced
        gen = page.locator('[data-testid^="review-generic-"]').first
        if await gen.count():
            await gen.scroll_into_view_if_needed()
            pn = page.locator('[data-testid^="review-pn-pr-20"]').first
            if await pn.count():
                await pn.fill("25-16610"); await page.wait_for_timeout(500)
            price = page.locator('[data-testid^="review-price-pr-20"]').first
            if await price.count():
                await price.fill("140"); await page.wait_for_timeout(500)
        await shot(page, "07-review-generic.png", "Review tab — the GENERIC request (PR-0050 'crystal ring for 16610') being priced / resolved to a part number")
        # 08 picking
        await page.goto(B + "/rw/picking", wait_until="networkidle"); await page.wait_for_timeout(800)
        if not await page.locator('[data-testid^="pick-alert-"]').count():
            sh = page.locator('[data-testid^="pick-short-"]').first
            if await sh.count():
                await sh.click(); await page.wait_for_timeout(600)
        await shot(page, "08-picking.png", "/rw/picking — pick cards with bin locations, incl. the short alert")
        # 09 client-request pop-up
        await page.goto(B + "/rw/pad", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.fill('[data-testid="pad-scan"]', "E02031"); await page.press('[data-testid="pad-scan"]', 'Enter'); await page.wait_for_timeout(700)
        await shot(page, "09-client-request-popup.png", "Client-request scan pop-up (modal up) after scanning E02031 on the Pad")
        if await page.locator('[data-testid="client-request-understood"]').count():
            await page.click('[data-testid="client-request-understood"]'); await page.wait_for_timeout(300)
        # 10 audit mid-scan
        await page.click('[data-testid="pad-tab-audit"]'); await page.wait_for_timeout(500)
        await page.click('[data-testid="audit-loc-safe_await_band"]'); await page.wait_for_timeout(500)
        await page.fill('[data-testid="audit-scan"]', "E02032"); await page.press('[data-testid="audit-scan"]', 'Enter'); await page.wait_for_timeout(400)
        await page.fill('[data-testid="audit-scan"]', "E02031|B"); await page.press('[data-testid="audit-scan"]', 'Enter'); await page.wait_for_timeout(500)
        await shot(page, "10-audit.png", "Audit mode mid-scan at Safe (await band) — 1 matched (greyed), 1 unexpected (correct / investigate), 2 not yet seen (missing if unscanned)")
        await page.click('[data-testid="audit-cancel"]'); await page.wait_for_timeout(300)
        # 11 Walter's trade-review queue (RS dashboard)
        await page.goto(B + "/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        ok = False
        if await page.locator('[data-testid="staff-card-walter"]').count():
            await page.click('[data-testid="staff-card-walter"]'); await page.wait_for_timeout(500)
            if await page.locator('[data-testid="password-input"]').count():
                await page.fill('[data-testid="password-input"]', "walter123"); await page.click('[data-testid="password-submit"]'); await page.wait_for_timeout(1500)
            elif await page.locator('[data-testid="pin-input"]').count():
                await page.fill('[data-testid="pin-input"]', "1234"); await page.wait_for_timeout(1500)
            ok = await page.locator('[data-testid="dashboard-page"]').count() > 0
        if not ok:
            await page.goto(B + "/", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator('[data-testid="trade-review-panel"]').scroll_into_view_if_needed()
        await page.wait_for_timeout(500)
        await page.locator('[data-testid="trade-review-panel"]').screenshot(path=f"{OUT}/11-trade-review-panel.png")
        INDEX.append("11-trade-review-panel.png — Walter's Trade review queue, panel crop")
        await page.screenshot(path=f"{OUT}/11-trade-review.png", full_page=False)
        INDEX.append("11-trade-review.png — Walter's Dashboard with the Trade review queue (E02051 RolliShop internal · Inspected/Accepted → invoice · Send back) · 1180x820")
        if False: await shot(page, "11-trade-review.png", "Walter's Trade review queue on the Dashboard — E02051 RolliShop (internal) awaiting Inspected/Accepted → invoice, or Send back")
        with open(f"{OUT}/INDEX.txt", "w") as f:
            f.write("supervisor-pad-screens — RolliWorking Supervisor Pad + workflow · iPad 1180x820 (portrait variants 820x1180) · signed in as MM (WM room supervisor); 11 as Walter\n\n")
            f.write("\n".join(sorted(INDEX)) + "\n")
        await browser.close()

asyncio.run(main())

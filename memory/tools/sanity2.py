import asyncio, re
from playwright.async_api import async_playwright
B="http://localhost:3000"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); page=await (await b.new_context(viewport={"width":1400,"height":900})).new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        # portal via magic link
        await page.goto(B+"/rc", wait_until="networkidle"); await page.wait_for_timeout(500)
        await page.fill('[data-testid="rc-email-input"]','robert.calloway@example.com'); await page.click('[data-testid="rc-send-link"]'); await page.wait_for_timeout(400)
        href=await page.locator('[data-testid="rc-magic-link"]').get_attribute('href'); await page.goto(B+href+"?next=%2Frc%2Festimates%2Fe-r4", wait_until="networkidle"); await page.wait_for_timeout(900)
        print("deep-link landed:", page.url, "send-watch card:", await page.locator('[data-testid="rc-send-watch"]').count(), "download:", await page.locator('[data-testid="rc-estimate-download"]').count())
        await page.click('[data-testid="rc-approve"]'); await page.wait_for_timeout(500); print("status:", await page.locator('[data-testid="rc-estimate-status"]').inner_text())
        await page.click('[data-testid="rc-request-label"]'); await page.wait_for_timeout(500); print("confirmed:", (await page.locator('[data-testid="rc-send-confirmed"]').inner_text())[:60])
        await page.click('a[href="/rc/estimates/e-r2"]', force=True) if await page.locator('a[href="/rc/estimates/e-r2"]').count() else None
        await page.goto(B+"/rc/estimates/e-r2", wait_until="networkidle"); await page.wait_for_timeout(600)
        print("expired:", await page.locator('[data-testid="rc-estimate-expired"]').count(), "requote btn:", await page.locator('[data-testid="rc-requote"]').count())
        if await page.locator('[data-testid="rc-requote"]').count(): await page.click('[data-testid="rc-requote"]'); await page.wait_for_timeout(400); print("requote sent:", await page.locator('[data-testid="rc-requote-sent"]').count())
        # report
        await page.goto(B+"/rc/report/IR-E02040-V1-CALLOWAY", wait_until="networkidle"); await page.wait_for_timeout(700)
        print("choices:", await page.locator('[data-testid="rc-report-choices"]').count(), "ask:", await page.locator('[data-testid="rc-report-ask"]').count())
        await page.fill('[data-testid="rc-report-question"]','Can you leave the bracelet un-polished?'); await page.click('[data-testid="rc-report-ask-send"]'); await page.wait_for_timeout(400); print("asked:", await page.locator('[data-testid="rc-report-asked"]').count())
        await page.click('[data-testid="rc-report-approve"]'); await page.wait_for_timeout(300); print("no-signature err:", await page.locator('[data-testid="rc-report-decision"] [data-testid="rc-error"]').count())
        await page.click('[data-testid="rc-polish-none"]'); await page.fill('[data-testid="rc-survey-0"]','Text me'); await page.fill('[data-testid="rc-report-signature"]','Robert Calloway'); await page.click('[data-testid="rc-report-approve"]'); await page.wait_for_timeout(600)
        print("decided:", await page.locator('[data-testid="rc-report-decided"]').count(), "record:", await page.locator('[data-testid="rc-report-decision-record"]').count())
        await page.goto(B+"/rc/watches/w-40", wait_until="networkidle"); await page.wait_for_timeout(700); print("R1 decision record on watch:", await page.locator('[data-testid="rc-decision-dec-r1"]').count())
        await page.goto(B+"/rc/watches/w-42", wait_until="networkidle"); await page.wait_for_timeout(700); print("R3 decision records:", await page.locator('[data-testid^="rc-decision-dec"]').count())
        html=await page.content(); print("rating leak in rc:", 'client360-rating' in html or 'rating-badge' in html)
        # staff side (in-memory reset on reload → seeds only)
        await page.goto(B+"/sign-in", wait_until="networkidle"); await page.wait_for_timeout(600)
        await page.click('[data-testid="staff-card-walter"]'); await page.wait_for_timeout(400); await page.fill('[data-testid="password-input"]','walter123'); await page.click('[data-testid="password-submit"]'); await page.wait_for_timeout(1200)
        await page.goto(B+"/clients/c-30", wait_until="networkidle"); await page.wait_for_timeout(800)
        print("calls counter:", await page.locator('[data-testid="client360-calls"]').inner_text())
        await page.click('[data-testid="client360-calls"]'); await page.wait_for_timeout(400); print("history rows:", await page.locator('[data-testid="call-history-list"] > li').count())
        await page.click('[data-testid="call-log-open"]'); await page.fill('[data-testid="call-log-note"]','Walk-up: wants Thursday pickup'); await page.click('[data-testid="call-log-save"]'); await page.wait_for_timeout(400); print("after manual log:", await page.locator('[data-testid="call-history-list"] > li').count())
        await page.click('[data-testid="call-call-s02-note-add"]'); await page.fill('[data-testid="call-call-s02-note-input"]','Follow-up: confirmed un-polished'); await page.click('[data-testid="call-call-s02-note-save"]'); await page.wait_for_timeout(300); print("s02 notes:", await page.locator('[data-testid^="call-call-s02-note-"]').count())
        await page.keyboard.press("Escape"); await page.mouse.click(5,5); await page.wait_for_timeout(200)
        await page.click('[data-testid="dev-simulate-call"]'); await page.click('[data-testid="dev-call-known"]'); await page.wait_for_timeout(400); await page.click('[data-testid="call-pop-dismiss"]'); await page.wait_for_timeout(300)
        print("note prompt:", await page.locator('[data-testid="call-note-prompt"]').count(), "job chips:", await page.locator('[data-testid^="call-note-job-"]').count())
        await page.click('[data-testid="call-note-job-j-r3"]'); await page.fill('[data-testid="call-note-text"]','asked about Thursday'); await page.click('[data-testid="call-note-save"]'); await page.wait_for_timeout(300)
        await page.click('[data-testid="dev-simulate-call"]'); await page.click('[data-testid="dev-call-missed"]'); await page.wait_for_timeout(400); print("missed pop:", await page.locator('[data-testid="call-pop"]').get_attribute('data-kind'))
        await page.click('[data-testid="call-pop-inbox"]'); await page.wait_for_timeout(800); print("inbox missed rows:", await page.locator('[data-testid^="missed-call-call"]').count())
        first=await page.locator('[data-testid^="missed-call-back-"]').first.get_attribute('data-testid'); cid=first.replace('missed-call-back-','')
        await page.fill(f'[data-testid="missed-call-note-{cid}"]','Called him back'); await page.click(f'[data-testid="missed-call-back-{cid}"]'); await page.wait_for_timeout(400); print("after called back rows:", await page.locator('[data-testid^="missed-call-call"]').count())
        await page.click('a[href="/jobs"]'); await page.wait_for_timeout(500); await page.goto(B+"/jobs/j-r3") if False else None
        await page.click('a[href="/jobs/j-r3"]', force=True) if await page.locator('a[href="/jobs/j-r3"]').count() else await page.goto(B+"/jobs/j-r3")
        await page.wait_for_timeout(800); print("job calls count:", await page.locator('[data-testid="job-calls-count"]').inner_text(), "decision records on job:", await page.locator('[data-testid="job-decision-records"]').count())
        # label request landed on shipping board? (fresh state: only seeds) skip. errors:
        print("errors:", errs[:3])
        await b.close()
asyncio.run(main())

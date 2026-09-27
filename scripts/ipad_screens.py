import asyncio, os, shutil, zipfile
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
OUT = "/app/frontend/public/ipad-screens"
ZIP = "/app/frontend/public/ipad-screens-2026-09-27.zip"
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
INDEX = []

async def rw_sign_in(page, user="u-mm", pw="mm123", path="/rw/pad"):
    await page.goto(f"{BASE}{path}", wait_until="networkidle")
    await page.wait_for_timeout(800)
    if await page.locator(f"[data-testid='rw-card-{user}']").count():
        await page.locator(f"[data-testid='rw-card-{user}']").click(force=True)
        await page.wait_for_timeout(300)
        for secret in (pw, "1234"):
            if not await page.locator("[data-testid='rw-secret']").count():
                break
            await page.locator("[data-testid='rw-secret']").fill(secret)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(3000)

async def rs_sign_in(page, user="mm", pw="mm123"):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle")
    await page.wait_for_timeout(800)
    if await page.locator(f"[data-testid='staff-card-{user}']").count():
        await page.locator(f"[data-testid='staff-card-{user}']").click(force=True)
        await page.wait_for_timeout(800)
        for secret in (pw, "1234"):
            if "/sign-in" not in page.url:
                break
            await page.locator("input[type='password']").first.fill(secret)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(3500)
    print("  rs session:", page.url)

async def nav(page, path):
    # client-side navigation keeps the in-memory session alive (a full goto would reload and drop it)
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path)
    await page.wait_for_timeout(1800)

async def click(page, sel):
    if await page.locator(sel).count():
        await page.locator(sel).first.click(force=True)
        await page.wait_for_timeout(900)
    else:
        print("  (missing selector)", sel)

async def shot(page, name, path=None, action=None, note=""):
    if path:
        await nav(page, path)
    if action:
        await action()
        await page.wait_for_timeout(900)
    await page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    INDEX.append(f"{name}.png  {note}")
    print("captured", name)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1024, "height": 768}, device_scale_factor=2)
        page = await ctx.new_page()
        # mock data mode so seeded packages / inspections are on screen (LIVE API stub returns empty lists)
        await page.goto(f"{BASE}/rw/pad", wait_until="networkidle")
        await page.evaluate("localStorage.setItem('rollisuite.api.mode', 'mock')")

        # ---- RolliWorking · WM Room Supervisor Pad (MM) ----
        await rw_sign_in(page)
        await shot(page, "01-wm-pad-dashboard", "/rw/pad", note="WM Room department dashboard: goal/pace, per-tech pace, funnel, stuck/problem/parts/testing, roster, scan-to-open")
        await shot(page, "02-wm-pad-dashboard-stuck-open", None, lambda: click(page, "[data-testid='dash-toggle-stuck']"), note="Stuck section expanded")
        await shot(page, "03-wm-pad-jobs", None, lambda: click(page, "[data-testid='pad-tab-jobs']"), note="Jobs tab · Send back left / Advance right")
        async def parts_scan():
            await click(page, "[data-testid='pad-tab-parts']")
            await page.locator("[data-testid='pad-scan']").fill("E02041")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1500)
        await shot(page, "04-wm-pad-parts-scan-to-narrow", None, parts_scan, note="Parts · scan-to-narrow, per-job allowance, Quick Add, returns")
        await shot(page, "05-wm-pad-parts-request-history", None, lambda: click(page, "[data-testid='pad-tab-review']"), note="Parts Request History (renamed from Review)")
        await shot(page, "06-wm-pad-audit-scoped", None, lambda: click(page, "[data-testid='pad-tab-audit']"), note="Audit · WM Supervisor scope (MM) — safes, benches, stuck bin, testing, MM Inspection, pre-queue, refinish/polish")
        await shot(page, "06b-wm-pad-team-goals", None, lambda: click(page, "[data-testid='pad-tab-team']"), note="NEW · Team tab: per-staff goals, department goal = sum")
        async def open_detail():
            await click(page, "[data-testid='pad-tab-jobs']")
            await click(page, "[data-testid='pad-open-j-30']")
            await page.wait_for_timeout(1200)
        await shot(page, "06c-wm-pad-job-detail-photos-report-emails", None, open_detail, note="NEW · job card detail: intake/inspection photos, inspection report, sent emails (parts approval)")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(400)
        await shot(page, "07-rw-supervisor-view", "/rw/supervisor")
        await shot(page, "08-wm-room-goals", "/rw/wm")
        await shot(page, "09-rw-work-queue", "/rw/queue")
        await shot(page, "10-rw-jobs-lookup", "/rw/jobs")
        async def hist():
            await page.locator("[data-testid='rw-history-search']").fill("Calloway")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1500)
        await shot(page, "11-rw-client-job-history-lookup", "/rw/history", hist, note="NEW · client / job history lookup inside RW")
        await shot(page, "12-rw-picking", "/rw/picking")
        await shot(page, "13-rw-today", "/rw/today")
        await shot(page, "13b-rw-reports-quick-overdue", "/rw/reports", lambda: click(page, "[data-testid='quick-overdue']"), note="NEW · RW Reports: quick reports, filters, results, Print (US Letter)")
        await shot(page, "14-rw-intercom-paging", "/rw/jobs", lambda: click(page, "[data-testid='intercom-btn']"), note="NEW · station intercom + storewide paging (mock)")

        # ---- Band / Polish Room Manager Pad (Joseph) ----
        await page.evaluate("localStorage.removeItem('rollisuite.prototype.currentUserId')")
        await rw_sign_in(page, "u-joseph", "joseph123", "/rw/band")
        await shot(page, "15-band-pad-dashboard", "/rw/band", note="NEW · Band / Polish Room Manager Pad (Joseph) · department dashboard")
        await shot(page, "16-band-pad-jobs", None, lambda: click(page, "[data-testid='pad-tab-jobs']"), note="Band room jobs (B / P / PM workflows only)")
        await shot(page, "17-band-pad-parts", None, lambda: click(page, "[data-testid='pad-tab-parts']"))

        # ---- Chyna · read-only Requests on the pad ----
        await page.evaluate("localStorage.removeItem('rollisuite.prototype.currentUserId')")
        await rw_sign_in(page, "u-chyna", "chyna123", "/rw/pad")
        await shot(page, "18-chyna-pad-requests-readonly", "/rw/pad", note="Concierge (Chyna) lands on read-only Parts Request History")

        # ---- RolliSuite (front desk) ----
        await page.evaluate("localStorage.removeItem('rollisuite.prototype.currentUserId')")
        await rs_sign_in(page)
        await shot(page, "19-jobs-board-all-lanes", "/jobs?view=board", note="Jobs board · card density fix · sidebar RW group")
        await shot(page, "19b-all-jobs-filterable", "/jobs/all", lambda: click(page, "[data-testid='all-jobs-filter-past_due']"), note="NEW · All Jobs management view with combinable quick filters")
        await shot(page, "20-jobs-tab-queue", "/jobs?tab=queue", note="NEW · Queue tab")
        await shot(page, "21-jobs-tab-in-progress-by-tech", "/jobs?tab=progress", note="NEW · In progress grouped by tech with chip filters")
        await shot(page, "22-jobs-tab-finished", "/jobs?tab=finished", note="NEW · Finished tab")
        await shot(page, "23-jobs-list-grouped", "/jobs?view=list")
        await shot(page, "24-jobs-shop-time", "/jobs/shop-time")
        await shot(page, "25-estimate-component-chips-chain", "/estimates/e-r3", note="NEW · component code chips + trickle-down verification chain on the estimate")
        await shot(page, "26-job-verification-chain", "/jobs/j-r3", note="Chain on the job")
        await shot(page, "27-receive-package-no-estimate-branch", "/intake/receive", note="Receive Package list → open an arrived package for the no-estimate SUB# branch")
        async def open_first_pkg():
            rows = page.locator("[data-testid^='receive-open-']")
            if await rows.count():
                await rows.first.click(force=True); await page.wait_for_timeout(1500)
            if await page.locator("[data-testid='b2b-label-input']").count():
                await page.locator("[data-testid='b2b-label-input']").fill("RS-VID-0192")
                await page.locator("[data-testid='b2b-match-btn']").click(force=True); await page.wait_for_timeout(1000)
        await shot(page, "28-receive-package-b2b-label-match", None, open_first_pkg, note="No-estimate branch · B2B label match chain (tier 2 · trade account code)")
        await shot(page, "29-inspection-whats-in-the-box", "/intake/inspection", note="Scan 2 list → What's in the box pills on an inspection")
        async def open_first_insp():
            rows = page.locator("[data-testid^='inspection-open-']")
            if await rows.count():
                await rows.first.click(force=True); await page.wait_for_timeout(1500)
        await shot(page, "30-inspection-box-pills", None, open_first_insp)
        await shot(page, "31-client360-per-staff-reviews", "/clients/c-30", lambda: click(page, "[data-testid='client360-rating']"), note="NEW · per-staff client reviews drill-down")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await shot(page, "32-inbox-grouped-by-request-job", "/inbox?view=open&group=1", note="NEW · inbox threading grouped by request / job")
        async def qbo():
            if await page.locator("[data-testid='qbo-connect']").count():
                await page.locator("[data-testid='qbo-connect']").click(force=True); await page.wait_for_timeout(800)
                await click(page, "[data-testid='qbo-toggle-pushClients']")
                await click(page, "[data-testid='qbo-sync-all']")
        await shot(page, "33-qbo-setup-client-sync", "/integrations/quickbooks", qbo, note="NEW · QuickBooks setup + client sync (MOCKED)")
        await shot(page, "34-front-desk-intercom", "/", lambda: click(page, "[data-testid='intercom-btn']"), note="Intercom from the front desk")
        await shot(page, "35-dashboard-trade-review-buttons", "/", note="Dashboard (Send back left / Accept right on trade review)")
        await b.close()
    with open(f"{OUT}/INDEX.txt", "w") as f:
        f.write("RolliSuite iPad screens · 1024x768 @2x · generated by scripts/ipad_screens.py\n\n" + "\n".join(INDEX) + "\n")
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(OUT)):
            z.write(os.path.join(OUT, f), f)
    print("zip", ZIP, os.path.getsize(ZIP))

asyncio.run(main())

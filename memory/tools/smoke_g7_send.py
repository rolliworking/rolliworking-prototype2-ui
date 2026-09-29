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

        # ---- G7 THEME: continue-as tile accent colour on choose-view
        await nav(page, "/choose-view")
        c = await page.locator("[data-testid='choose-view-own']").evaluate("el => { const s=getComputedStyle(el); return {bg:s.backgroundColor, bd:s.borderColor, col:s.color}; }")
        print("choose-view-own styles:", c)

        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)

        # Navigate to /rw (RW shell) and inspect nav active + tabbar active accent
        await nav(page, "/rw")
        # active nav item
        try:
            nav_active = await page.locator("[data-testid='rw-shell'] a[aria-current='page'], [data-testid='rw-shell'] [aria-selected='true']").first.evaluate("el => getComputedStyle(el).color + ' | bg=' + getComputedStyle(el).backgroundColor + ' | border=' + getComputedStyle(el).borderColor")
            print("rw active nav:", nav_active)
        except Exception as e: print("rw active nav error:", e)
        # role-tabbar active
        cnt = await page.locator("[data-testid='role-tabbar']").count()
        print("role-tabbar present:", cnt)

        # baseline check: --accent CSS custom prop
        accent = await page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent')")
        print("--accent token:", accent.strip())

        # ---- Concierge baseline pre send: capture v-cm lane In queue count
        await nav(page, "/concierge")
        pre = None
        try:
            pre = await page.locator("[data-testid='cell-v-cm-queue']").get_attribute("data-count")
        except Exception: pass
        # fallback: search for any cell with data-count
        if pre is None:
            all_cells = await page.locator("[data-testid^='cell-v-cm-']").evaluate_all("els=>els.map(e=>[e.dataset.testid,e.dataset.count])")
            print("v-cm cells:", all_cells)
        print("pre concierge v-cm queue count:", pre)

        # ---- View as JV and do Send to vendor from pad Jobs
        await nav(page, "/choose-view")
        await page.locator("[data-testid='choose-view-JV']").click(); await page.wait_for_timeout(2000)
        if "/rw/band" not in page.url and "/rw/pad" not in page.url:
            await nav(page, "/rw/band")
        # Ensure on Jobs tab
        if await page.locator("[data-testid='pad-tab-jobs']").count():
            await page.locator("[data-testid='pad-tab-jobs']").click(); await page.wait_for_timeout(600)
        vlist = await page.locator("[data-testid^='pad-send-vendor-']").evaluate_all("els=>els.map(e=>e.dataset.testid)")
        print("send-vendor buttons found:", len(vlist), vlist[:3])
        if vlist:
            await page.locator(f"[data-testid='{vlist[0]}']").click(); await page.wait_for_timeout(700)
            print("swo-modal:", await page.locator("[data-testid='swo-modal']").count())
            pt = await page.locator("[data-testid='swo-form-point']").input_value()
            pr = await page.locator("[data-testid='swo-form-predicted']").input_value()
            print("point:", pt, "predicted:", pr)
            # save disabled until work text
            work = page.locator("[data-testid='swo-work']")
            save = page.locator("[data-testid='swo-save']")
            save_disabled_before = await save.get_attribute("disabled")
            print("save disabled before work:", save_disabled_before)
            await work.fill("Bracelet refinish — brushed"); await page.wait_for_timeout(200)
            save_disabled_after = await save.get_attribute("disabled")
            print("save disabled after work:", save_disabled_after)
            await save.click(); await page.wait_for_timeout(1000)
            toast = await page.locator("[data-testid^='pad-toast-']").all_text_contents()
            print("pad-toast text:", toast)

        # ---- Exit view-as and check concierge lane increased
        exit_btn = page.locator("[data-testid='view-as-exit']")
        if await exit_btn.count():
            await exit_btn.click(); await page.wait_for_timeout(1500)
        await nav(page, "/concierge")
        post = await page.locator("[data-testid^='cell-v-'][data-count]").evaluate_all("els=>els.map(e=>[e.dataset.testid,e.dataset.count])")
        print("post concierge cells:", post)

        # lanes count check
        lanes = await page.locator("[data-testid^='lane-v-']").count()
        print("lanes:", lanes)

        # concierge esc chips
        esc = await page.locator("[data-testid^='concierge-esc-']").count()
        print("esc chips:", esc)

        # team hitlist JV
        await nav(page, "/hitlist/jv/team")
        header = await page.locator("[data-testid='today-header']").first.inner_text() if await page.locator("[data-testid='today-header']").count() else ""
        print("team header:", header[:120])

        # Check rw-card-u-sam presence on RW sign-in (sam disabled from prev iteration? Fresh state though - not persisted)
        await nav(page, "/rw")
        sam = await page.locator("[data-testid='rw-card-u-sam']").count()
        print("rw-card-u-sam count (sam not disabled in this run):", sam)

        print("errors:", errs)
        await b.close()

asyncio.run(main())

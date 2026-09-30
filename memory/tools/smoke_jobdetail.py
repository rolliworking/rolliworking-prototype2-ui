import asyncio, json, sys
from playwright.async_api import async_playwright
BASE = "http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1800)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123", "1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        if await page.locator("[data-testid='choose-view-own']").count(): await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1200)
        for jid in sys.argv[1:] or ["j-30", "j-mi1", "j-os1", "j-11"]:
            await nav(page, f"/jobs/{jid}")
            flow = page.locator("[data-testid='process-flow']")
            print(f"== {jid}", await page.locator("[data-testid='item-title']").inner_text(), "| fraction:", await page.locator("[data-testid='flow-fraction']").inner_text(), "| lines:", await page.locator("[data-testid^='flow-line-']").count())
            for line in await page.locator("[data-testid^='flow-line-']").all():
                key = (await line.get_attribute("data-testid")).split("-")[-1]
                stages = await line.locator("[data-testid^='flow-dot-']").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop()+':'+e.dataset.state+(e.dataset.blocked?'!'+e.dataset.blocked:''))")
                blk = await line.locator("[data-testid^='flow-blocker-']").all_inner_texts()
                cust = await line.locator("[data-testid^='flow-custody-']").inner_text()
                print("  ", key, await line.get_attribute("data-finished"), stages, "| blockers:", blk, "| custody:", cust.replace("\n", " / ")[:120], "| mismatch:", await line.locator("[data-testid^='flow-mismatch-']").count())
            print("   addons:", await page.locator("[data-testid='addons-panel']").get_attribute("data-count"), await page.locator("[data-testid^='addon-row-']").evaluate_all("els=>els.map(e=>e.dataset.source)"), "| legs:", await page.locator("[data-testid^='outsource-leg-']").count(), "| none:", await page.locator("[data-testid='outsource-none']").count())
            print("   header pkg:", await page.locator("[data-testid='job-package-link'],[data-testid='job-package-none']").first.inner_text(), "| photos:", await page.locator("[data-testid='item-photo-strip']").get_attribute("data-count"), "| collapsed open:", await page.locator("[data-testid^='job-original-estimate'][data-open='true'],[data-testid='job-inspection-report'][data-open='true']").count(), "| more cards:", await page.locator("[data-testid='job-more'] section").count(), "| removed:", await page.locator("[data-testid='job-components-card'],[data-testid='job-chain-card'],[data-testid='job-send-to-vendor'],[data-testid='job-lines-card'],[data-testid='job-watch-card']").count())
            await page.screenshot(path=f"/app/memory/tools/shots/jobdetail_{jid}.png", full_page=True)
        # manual add-on on j-30
        await nav(page, "/jobs/j-30")
        await page.locator("[data-testid='addon-add']").click(); await page.wait_for_timeout(200)
        await page.locator("[data-testid='addon-description']").fill("Bezel insert swap — phoned in"); await page.locator("[data-testid='addon-channel']").select_option("phone"); await page.locator("[data-testid='addon-amount']").fill("240"); await page.locator("[data-testid='addon-note']").fill("Naomi called 3:10pm")
        await page.locator("[data-testid='addon-save']").click(); await page.wait_for_timeout(800)
        print("after manual add:", await page.locator("[data-testid='addons-panel']").get_attribute("data-count"), await page.locator("[data-testid='addons-total']").inner_text(), "| flash:", await page.locator("[data-testid='job-flash']").inner_text())
        # collapsed toggles
        await page.locator("[data-testid='job-original-estimate-toggle']").click(); await page.wait_for_timeout(200); print("orig est open:", await page.locator("[data-testid='job-original-estimate']").get_attribute("data-open"), "rows:", await page.locator("[data-testid^='job-line-']").count())
        await page.locator("[data-testid='more-photos-toggle']").click(); await page.wait_for_timeout(200); print("photos open:", await page.locator("[data-testid='more-photos']").get_attribute("data-open"), "count pill:", await page.locator("[data-testid='more-photos-count']").inner_text(), "| parts pill:", await page.locator("[data-testid='more-parts-count']").inner_text())
        await page.locator("[data-testid^='item-photo-']").first.click(); await page.wait_for_timeout(300); print("lightbox:", await page.locator("[data-testid='item-photo-lightbox']").count()); await page.keyboard.press("Escape"); await page.locator("[data-testid='item-photo-lightbox']").click(position={"x": 5, "y": 5}) if await page.locator("[data-testid='item-photo-lightbox']").count() else None
        print("page errors:", errs)
        await b.close()
asyncio.run(main())

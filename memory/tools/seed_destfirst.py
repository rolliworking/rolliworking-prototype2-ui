import asyncio
from playwright.async_api import async_playwright
BASE = "http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def counts(page, vendor):
    return {k: await page.locator(f"[data-testid='cell-{vendor}-{k}']").get_attribute("data-count") for k in ("queue", "sent", "at_vendor", "inbound")}
async def wedge(page, code):
    await page.locator("body").click(position={"x": 5, "y": 5}); await page.keyboard.type(code, delay=5); await page.keyboard.press("Enter"); await page.wait_for_timeout(250)
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
        await nav(page, "/concierge"); await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(600)
        before_j = await counts(page, "v-jacques"); before_c = await counts(page, "v-claudio"); print("TRACK before · jacques:", before_j, "claudio:", before_c)
        # collect 5 Jacques 'In route' job numbers + 1 Claudio 'In route' from the slide-outs
        await page.locator("[data-testid='cell-v-jacques-sent']").click(); await page.wait_for_timeout(600)
        jac = await page.locator("[data-testid^='concierge-card-job-']").evaluate_all("els=>els.map(e=>e.innerText.trim())"); print("jacques in-route cards:", jac[:6])
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        if await page.locator("[data-testid='slide-panel-close']").count(): await page.locator("[data-testid='slide-panel-close']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='cell-v-claudio-sent']").click(); await page.wait_for_timeout(600)
        cla = await page.locator("[data-testid^='concierge-card-job-']").evaluate_all("els=>els.map(e=>e.innerText.trim())"); print("claudio in-route cards:", cla[:2])
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        if await page.locator("[data-testid='slide-panel-close']").count(): await page.locator("[data-testid='slide-panel-close']").click(); await page.wait_for_timeout(300)
        codes = [c.split()[0].replace("E", "").replace("#", "") for c in jac[:5]] + [cla[0].split()[0].replace("E", "").replace("#", "")]
        print("codes:", codes)
        # ASSIGN — destination-first
        await page.locator("[data-testid='concierge-view-assign']").click(); await page.wait_for_timeout(600)
        assign = page.locator("[data-testid='concierge-assign']")
        print("armed initially:", await assign.get_attribute("data-armed"), "| hint:", await page.locator("[data-testid='assign-hint']").inner_text())
        await page.locator("[data-testid='dest-node-v-jacques:at_vendor']").click(); await page.wait_for_timeout(300)
        print("armed:", await assign.get_attribute("data-armed"), "| bottom:", await page.locator("[data-testid='action-bottom-title']").inner_text(), "|", (await page.locator("[data-testid='action-bottom-req']").inner_text())[:90])
        for c in codes: await wedge(page, c)
        strip = page.locator("[data-testid='action-strip']")
        print("strip count:", await strip.get_attribute("data-count"), "legal:", await strip.get_attribute("data-legal"), "refused:", await strip.get_attribute("data-refused"))
        print("refused reasons:", await page.locator("[data-testid^='action-refused-']").all_inner_texts())
        print("bottom:", await page.locator("[data-testid='action-bottom-title']").inner_text(), "| commit:", await page.locator("[data-testid='action-commit']").inner_text(), "| req:", await page.locator("[data-testid='action-bottom-req']").inner_text())
        await assign.screenshot(path="/app/memory/tools/shots/assign_destfirst.png")
        await page.locator("[data-testid='action-commit']").click(); await page.wait_for_timeout(1200)
        print("after commit · strip count:", await strip.get_attribute("data-count") if await strip.count() else 0, "refused:", await strip.get_attribute("data-refused") if await strip.count() else 0, "| armed still:", await assign.get_attribute("data-armed"), "| error:", await page.locator("[data-testid='action-error']").all_inner_texts())
        flash = page.locator("[data-testid='concierge-flash'], [data-testid='flash'], [class*='animate-rise']"); print("flash:", (await flash.first.inner_text())[:140] if await flash.count() else "none")
        await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(700)
        after_j = await counts(page, "v-jacques"); after_c = await counts(page, "v-claudio"); print("TRACK after · jacques:", after_j, "claudio:", after_c)
        # flip back: chips + armed destination survive
        await page.locator("[data-testid='concierge-view-assign']").click(); await page.wait_for_timeout(500)
        print("survives flip · strip:", await strip.get_attribute("data-count") if await strip.count() else 0, "| armed:", await assign.get_attribute("data-armed"))
        # Esc disarms
        await page.locator("body").click(position={"x": 5, "y": 5}); await page.keyboard.press("Escape"); await page.wait_for_timeout(200); print("after Esc armed:", repr(await assign.get_attribute("data-armed")))
        # lookup-first still works: look up a Jacques queue job → legal nodes lit → click box (custody) → needs scan → scan → commit
        await page.locator("[data-testid='cell-v-jacques-queue']").count()
        await page.locator("[data-testid='action-clear']").click() if await page.locator("[data-testid='action-clear']").count() else None
        await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(400); await page.locator("[data-testid='cell-v-jacques-queue']").click(); await page.wait_for_timeout(500)
        qj = await page.locator("[data-testid^='concierge-card-job-']").evaluate_all("els=>els.map(e=>e.innerText.trim())"); qcode = qj[0].split()[0].replace("E", "").replace("#", "")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
        if await page.locator("[data-testid='slide-panel-close']").count(): await page.locator("[data-testid='slide-panel-close']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='concierge-view-assign']").click(); await page.wait_for_timeout(400)
        await page.locator("[data-testid='action-lookup-input']").fill(qcode); await page.locator("[data-testid='action-lookup-go']").click(); await page.wait_for_timeout(300)
        lit = await page.locator("[data-testid^='dest-node-'][data-legal='true']").evaluate_all("els=>els.filter(e=>e.className.includes('shadow-[0_0_12px') || e.querySelector('img')?.className.includes('92,225,255')).map(e=>e.dataset.testid)")
        print("lookup-first lit nodes:", lit)
        await page.locator("[data-testid='dest-node-v-jacques:box']").click(); await page.wait_for_timeout(300)
        print("box armed · bottom:", await page.locator("[data-testid='action-bottom-title']").inner_text(), "| req:", await page.locator("[data-testid='action-bottom-req']").inner_text(), "| commit aria-disabled:", await page.locator("[data-testid='action-commit']").get_attribute("aria-disabled"))
        await page.locator("[data-testid='action-scan-input']").fill(qcode); await page.locator("[data-testid='action-scan-go']").click(); await page.wait_for_timeout(300)
        print("after scan · bottom:", await page.locator("[data-testid='action-bottom-title']").inner_text(), "| commit aria-disabled:", await page.locator("[data-testid='action-commit']").get_attribute("aria-disabled"))
        await page.locator("[data-testid='action-commit']").click(); await page.wait_for_timeout(1200)
        await page.locator("[data-testid='concierge-view-track']").click(); await page.wait_for_timeout(600)
        print("TRACK after box · jacques:", await counts(page, "v-jacques"))
        print("page errors:", errs)
        await b.close()
asyncio.run(main())

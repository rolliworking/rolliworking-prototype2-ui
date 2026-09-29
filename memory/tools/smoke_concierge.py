import asyncio
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1440,"height":900}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1500)
        await nav(page, "/concierge")
        lanes = await page.locator("[data-testid^='lane-'][data-ships]").evaluate_all("els=>els.map(e=>[e.dataset.testid, e.dataset.ships])"); print("lanes:", lanes)
        # counts vs cards on every stage
        cells = await page.locator("[data-testid^='cell-']").evaluate_all("els=>els.map(e=>[e.dataset.testid, +e.dataset.count, e.dataset.tone])")
        print("cells:", [c for c in cells if c[1]>0])
        mism=[]
        for tid,count,tone in cells:
            if count==0: continue
            await page.locator(f"[data-testid='{tid}']").click(); await page.wait_for_timeout(500)
            n = await page.locator("[data-testid^='concierge-card-']").count()
            if n!=count: mism.append((tid,count,n))
        print("count/card mismatches:", mism)
        # CM lane: advance a queue job → in progress
        await page.locator("[data-testid='cell-v-cm-queue']").click(); await page.wait_for_timeout(500)
        first = await page.locator("[data-testid^='concierge-advance-']").first.get_attribute("data-testid"); await page.locator(f"[data-testid='{first}']").click(); await page.wait_for_timeout(800)
        print("CM queue after advance:", await page.locator("[data-testid='cell-v-cm-queue']").get_attribute("data-count"), "in progress:", await page.locator("[data-testid='cell-v-cm-at_vendor']").get_attribute("data-count"))
        # send back with reason
        await page.locator("[data-testid='cell-v-cm-at_vendor']").click(); await page.wait_for_timeout(500)
        sb = await page.locator("[data-testid^='concierge-sendback-']").first.get_attribute("data-testid"); await page.locator(f"[data-testid='{sb}']").click(); await page.wait_for_timeout(300)
        await page.fill("[data-testid='concierge-back-reason']", "client not here yet"); await page.locator("[data-testid='concierge-back-go']").click(); await page.wait_for_timeout(800)
        print("CM queue after send back:", await page.locator("[data-testid='cell-v-cm-queue']").get_attribute("data-count"))
        # Jacques returning (intl) → received → custody back
        await page.locator("[data-testid='cell-v-jacques-inbound']").click(); await page.wait_for_timeout(500)
        adv = await page.locator("[data-testid^='concierge-advance-']").first.get_attribute("data-testid"); print("jacques returning advance label:", await page.locator(f"[data-testid='{adv}']").inner_text()); await page.locator(f"[data-testid='{adv}']").click(); await page.wait_for_timeout(800)
        print("jacques received:", await page.locator("[data-testid='cell-v-jacques-received']").get_attribute("data-count"))
        # card → job → back link
        await page.locator("[data-testid='cell-v-jacques-received']").click(); await page.wait_for_timeout(500)
        await page.locator("[data-testid^='concierge-card-job-']").first.click(); await page.wait_for_timeout(1500); print("job url:", page.url, "back link:", await page.locator("[data-testid='concierge-back-link']").count(), "send-to-vendor:", await page.locator("[data-testid='job-send-to-vendor']").count())
        await page.locator("[data-testid='concierge-back-link']").click(); await page.wait_for_timeout(1200); print("back at:", page.url, "cards open:", await page.locator("[data-testid='lane-cards-v-jacques']").count())
        # add vendor no-ship
        await page.locator("[data-testid='concierge-add-vendor']").click(); await page.wait_for_timeout(300); await page.fill("[data-testid='cv-name']", "Test Polisher"); await page.locator("[data-testid='cv-ships-no']").check(); await page.locator("[data-testid='cv-save']").click(); await page.wait_for_timeout(900)
        print("new lane stages:", await page.locator("[data-testid^='lane-v-'][data-ships='false']").count(), "lanes now:", await page.locator("[data-testid^='lane-v-']").count())
        await page.screenshot(path="/app/memory/tools/shots/concierge.png"); print("pageerrors:", errs[:3])
        await b.close()
asyncio.run(main())

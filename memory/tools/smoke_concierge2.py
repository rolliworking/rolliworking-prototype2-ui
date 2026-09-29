import asyncio, json
from playwright.async_api import async_playwright
BASE="http://localhost:3000"
async def nav(page, path):
    await page.evaluate("(p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }", path); await page.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1500,"height":950}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page=await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
        await page.locator("[data-testid='staff-card-michael']").click(force=True); await page.wait_for_timeout(800)
        for secret in ("michael123","1234"):
            if "/sign-in" not in page.url: break
            await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(3000)
        await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1500)
        await nav(page, "/concierge")
        print("lanes:", await page.locator("[data-testid^='lane-v-'][data-ships]").evaluate_all("els=>els.map(e=>e.dataset.testid)"))
        cells = await page.locator("[data-testid^='cell-']").evaluate_all("els=>els.filter(e=>+e.dataset.count>0).map(e=>[e.dataset.testid,+e.dataset.count,+e.dataset.late,+e.dataset.redo])")
        print("cells:", cells)
        mism=[]
        for tid,count,late,redo in cells:
            await page.locator(f"[data-testid='{tid}']").click(); await page.wait_for_timeout(450)
            n = await page.locator("[data-testid^='concierge-card-']:not([data-testid^='concierge-card-job-'])").count()
            g = await page.locator("[data-testid='group-on-track'],[data-testid='group-overdue']").evaluate_all("els=>els.map(e=>[e.dataset.testid,+e.dataset.count])")
            ov = dict(g).get('group-overdue', None)
            if n!=count or (ov is not None and ov!=late): mism.append((tid,count,n,late,ov))
        print("count/card or late-split mismatches:", mism)
        print("prepaid header:", await page.locator("[data-testid='lane-prepaid-v-chronosky']").inner_text(), "| unpaid claudio:", await page.locator("[data-testid='lane-unpaid-v-claudio']").inner_text())
        # health chips on Chronosky in-progress
        await page.locator("[data-testid='cell-v-chronosky-at_vendor']").click(); await page.wait_for_timeout(450)
        print("chronosky health:", await page.locator("[data-testid^='concierge-health-']").all_inner_texts())
        print("redo chips:", await page.locator("[data-testid^='concierge-redo-swo']").all_inner_texts(), "esc:", await page.locator("[data-testid^='concierge-esc-']").all_inner_texts())
        pc = await page.locator("[data-testid^='concierge-paid-']").all_inner_texts(); print("paid chips:", pc[:3], "parts:", await page.locator("[data-testid^='concierge-parts-swo']").all_inner_texts())
        # Outstanding
        await page.locator("[data-testid='lane-name-v-chronosky']").click(); await page.wait_for_timeout(500)
        print("outstanding rows:", await page.locator("[data-testid^='outstanding-swo']").count()); await page.screenshot(path="/app/memory/tools/shots/outstanding.png"); await page.locator("[data-testid='concierge-outstanding-close']").click(); await page.wait_for_timeout(300)
        # duplicate guard on a Chronosky redo job: open detail of the breach card
        if not await page.locator("[data-testid='lane-cards-v-chronosky']").count(): await page.locator("[data-testid='cell-v-chronosky-at_vendor']").click(); await page.wait_for_timeout(450)
        breach = page.locator("[data-testid^='concierge-card-'][data-health='breach']").first; sid = (await breach.get_attribute("data-testid")).replace("concierge-card-","")
        await page.locator(f"[data-testid='concierge-open-{sid}']").click(); await page.wait_for_timeout(500)
        await page.locator("[data-testid='vi-add-toggle']").click(); await page.fill("[data-testid='vi-number']", "CS-5488"); await page.fill("[data-testid='vi-amount']", "100"); await page.locator("[data-testid='vi-save']").click(); await page.wait_for_timeout(400)
        print("hard dup:", await page.locator("[data-testid='vi-hard-dup']").inner_text())
        import datetime; d8 = (datetime.date.today() - datetime.timedelta(days=8)).isoformat()
        await page.fill("[data-testid='vi-number']", "CS-9999"); await page.fill("[data-testid='vi-amount']", "1450"); await page.fill("[data-testid='vi-date']", d8); await page.locator("[data-testid='vi-save']").click(); await page.wait_for_timeout(400)
        print("soft dup:", await page.locator("[data-testid='vi-soft-dup']").count())
        await page.locator("[data-testid='vi-soft-continue']").click(); await page.wait_for_timeout(500)
        print("invoice rows:", await page.locator("[data-testid='vendor-invoices'] li").count())
        # mark paid on new redo-charge invoice → blocked (already paid, redo)
        newpay = page.locator("[data-testid^='vi-pay-vi'], [data-testid^='vi-pay-']").filter(has_text="Mark paid").first
        await newpay.click(); await page.wait_for_timeout(300); await page.fill("[data-testid='vi-pay-ref']", "ACH-9001"); await page.locator("[data-testid='vi-pay-go']").click(); await page.wait_for_timeout(400)
        print("pay blocked:", (await page.locator("[data-testid='vi-pay-blocked']").inner_text())[:90])
        await page.fill("[data-testid='vi-pay-override']", "vendor charged for a new mainspring on the redo"); await page.locator("[data-testid='vi-pay-go']").click(); await page.wait_for_timeout(500)
        print("paid lines:", await page.locator("[data-testid^='vi-paid-']").count())
        await page.screenshot(path="/app/memory/tools/shots/swo_detail.png")
        await page.locator("[data-testid='swo-detail-close']").click(); await page.wait_for_timeout(300)
        # Redo from inspection on James j-04
        await nav(page, "/concierge")
        await page.locator("[data-testid='cell-v-james-inspection']").click(); await page.wait_for_timeout(450)
        rs_ = await page.locator("[data-testid^='concierge-redo-start-']").first.get_attribute("data-testid"); await page.locator(f"[data-testid='{rs_}']").click(); await page.wait_for_timeout(300)
        await page.fill("[data-testid='concierge-redo-reason']", "Lume tone too green vs. dial"); await page.locator("[data-testid='concierge-redo-modal-go']").click(); await page.wait_for_timeout(800)
        print("james in progress after redo:", await page.locator("[data-testid='cell-v-james-at_vendor']").evaluate("e=>[e.dataset.count,e.dataset.redo]"))
        # Chip on parent job + pads
        await nav(page, "/jobs/j-23"); print("j-23 chip:", await page.locator("[data-testid='component-wait-j-23']").inner_text(), "| at-risk tag:", await page.locator("[data-testid='job-at-risk-j-23']").count())
        await nav(page, "/jobs"); print("jobs board chips:", await page.locator("[data-testid^='component-wait-chip-']").count())
        await nav(page, "/today"); print("hitlist chips:", await page.locator("[data-testid^='component-wait-chip-']").count(), "inbox concierge alerts:", await page.locator("[data-testid^='inbox-ib-swo-']").count())
        print("pageerrors:", errs[:3]); await page.screenshot(path="/app/memory/tools/shots/concierge2.png")
        await b.close()
asyncio.run(main())

import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page); await nav(page, "/hitlist")
        pins = await page.locator("[data-testid^='pinned-pin'][data-key]").evaluate_all("els=>els.map(e=>e.dataset.key+' | '+e.dataset.priority+' | '+(e.dataset.standing||'')+' | '+e.querySelector('[data-testid^=pinned-link-]')?.textContent)")
        print("system pins:"); [print("  ", x) for x in pins]
        await page.screenshot(path="/app/memory/tools/shots/autopo_hitlist.png", clip={"x": 216, "y": 60, "width": 1284, "height": 520})
        # standing dismiss requires a reason
        hi = page.locator("[data-testid^='pinned-pin'][data-priority='high']").first; pid = (await hi.get_attribute("data-testid")).replace("pinned-", "")
        await page.locator(f"[data-testid='pin-dismiss-{pid}']").click(); print("reason input:", await page.locator(f"[data-testid='pin-dismiss-reason-{pid}']").count(), "confirm disabled:", await page.locator(f"[data-testid='pin-dismiss-confirm-{pid}']").is_disabled())
        await page.keyboard.press("Escape")
        # open the auto PO via the pin link
        await page.locator(f"[data-testid='pinned-link-{pid}']").click(); await page.wait_for_timeout(900)
        print("po modal:", await page.locator("[data-testid='po-modal']").count(), "auto chip:", await page.locator("[data-testid='po-modal-auto']").count(), "lines:", await page.locator("[data-testid^='po-line-']").count(), "red acked:", await page.locator("[data-testid='po-red-acked']").count())
        await page.screenshot(path="/app/memory/tools/shots/autopo_modal.png")
        # send without ack → error; ack → send → pin resolved
        await page.locator("[data-testid='po-send']").click(); await page.wait_for_timeout(400); print("send w/o ack flash:", (await page.locator("[data-testid='flash-error'],[data-testid='flash']").all_inner_texts())[:2])
        ack = page.locator("[data-testid='po-ack-red']")
        if await ack.count(): await ack.click(); await page.wait_for_timeout(400)
        await page.locator("[data-testid='po-send']").click(); await page.wait_for_timeout(500); print("status after send:", await page.locator("[data-testid='po-modal'] [data-testid='status-pill']").first.inner_text() if await page.locator("[data-testid='po-modal'] [data-testid='status-pill']").count() else "?")
        await nav(page, "/hitlist"); print("high pins after send:", await page.locator("[data-testid^='pinned-pin'][data-priority='high']").count())
        # approvals to send
        appr = page.locator("[data-testid^='pinned-pin'][data-key='approvals-to-send:MH']"); print("approvals pin:", await appr.locator("[data-testid^='pinned-link-']").inner_text())
        await appr.locator("[data-testid^='pinned-link-']").click(); await page.wait_for_timeout(700)
        print("approvals page rows:", await page.locator("[data-testid^='approval-row-'][data-ready='true']").count(), await page.locator("[data-testid='approvals-summary']").inner_text())
        first = page.locator("[data-testid^='approval-send-']").first; await first.click(); await page.wait_for_timeout(500); print("flash:", await page.locator("[data-testid='approvals-flash']").inner_text()); print("rows now:", await page.locator("[data-testid^='approval-row-'][data-ready='true']").count())
        await page.screenshot(path="/app/memory/tools/shots/autopo_approvals.png", clip={"x": 216, "y": 60, "width": 1284, "height": 420})
        await nav(page, "/hitlist"); print("approvals pin after send:", await page.locator("[data-testid^='pinned-pin'][data-key='approvals-to-send:MH'] [data-testid^='pinned-link-']").all_inner_texts())
        await nav(page, "/intake/outbox"); print("outbox has parts approval:", await page.locator("[data-testid^='outbox-item-']").filter(has_text="Parts approval needed").count())
        print("errors:", errs); await b.close()
asyncio.run(main())

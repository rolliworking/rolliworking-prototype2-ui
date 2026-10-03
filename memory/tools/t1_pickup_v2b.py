import asyncio, os
from playwright.async_api import async_playwright
BASE = os.environ.get("REACT_APP_BACKEND_URL","https://rollisuite-emergent.preview.emergentagent.com").rstrip("/")

async def nav(page, path):
    await page.evaluate("(p)=>{window.history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'));}", path)
    await page.wait_for_timeout(1400)

async def signin(page):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle"); await page.wait_for_timeout(800)
    await page.locator("[data-testid='staff-card-vienna']").click(force=True); await page.wait_for_timeout(600)
    for s in ("vienna123","1234"):
        if "/sign-in" not in page.url: break
        if await page.locator("input[type='password']").count():
            await page.locator("input[type='password']").first.fill(s); await page.keyboard.press("Enter"); await page.wait_for_timeout(2200)

def T(page,t): return page.locator(f"[data-testid='{t}']")
async def txt(l): 
    try: 
        if await l.count(): return (await l.inner_text()).strip()
    except: pass
    return None

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width":1600,"height":1000})
        await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')")
        page = await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page)
        
        # T6 — so-pu9 full flow with alt second-factor paths
        await nav(page,"/sales/pickup?fast=1"); await page.wait_for_timeout(900)
        all_rows = await page.locator("[data-testid^='pickup-queue-so-']").evaluate_all("els=>els.map(e=>e.dataset.testid)")
        print("[T6_queue_rows]", all_rows)
        tier_row = await txt(T(page, "pickup-queue-tier-so-pu9"))
        print("[T6_tier_row]", tier_row)
        if await T(page,"pickup-queue-so-pu9").count()==0:
            # scroll
            await page.evaluate("()=>window.scrollTo(0,document.body.scrollHeight)")
            await page.wait_for_timeout(500)
        await T(page,"pickup-queue-so-pu9").scroll_into_view_if_needed()
        await T(page,"pickup-queue-so-pu9").click(force=True); await page.wait_for_timeout(900)
        print("[T6_side_tier]", await T(page,"pickup-side-tier").get_attribute("data-high"), await txt(T(page,"pickup-side-tier")))
        await T(page,"pickup-item-same").click(); await page.wait_for_timeout(900)
        await T(page,"pickup-next-verify").click(); await page.wait_for_timeout(500)
        await T(page,"pickup-method-code").click(); await page.wait_for_timeout(200)
        await T(page,"pickup-code").fill("482913"); await T(page,"pickup-code-check").click(); await page.wait_for_timeout(900)
        print("[T6_verified]", await T(page,"pickup-verified").count())
        print("[T6_next_photos_disabled]", await T(page,"pickup-next-photos").is_disabled())
        print("[T6_next_photos_title]", await T(page,"pickup-next-photos").get_attribute("title"))
        print("[T6_second_factor_panel]", await T(page,"pickup-second-factor").count())
        print("[T6_sf_kiosk_txt]", await txt(T(page,"pickup-second-factor-kiosk")))
        print("[T6_sf_breakdown]", await txt(T(page,"pickup-second-factor-breakdown")))
        
        # try the reverse QR path
        if await T(page,"pickup-sf-reverse").count():
            await T(page,"pickup-sf-reverse").click(); await page.wait_for_timeout(900)
            # inline mock phone
            if await T(page,"rc-pickup-confirm").count():
                await T(page,"rc-pickup-confirm").click(); await page.wait_for_timeout(500)
            if await T(page,"rc-pickup-yes").count():
                await T(page,"rc-pickup-yes").click(); await page.wait_for_timeout(900)
            print("[T6_sf_reverse_ok]", await T(page,"pickup-second-factor-ok").count(), await txt(T(page,"pickup-second-factor-ok")))
            print("[T6_next_photos_enabled_after_reverse]", not await T(page,"pickup-next-photos").is_disabled(), "gate3=", await T(page,"pickup-gate-3").get_attribute("data-ok"))
        
        # continue to end for evidence
        if await T(page,"pickup-next-photos").count() and not await T(page,"pickup-next-photos").is_disabled():
            await T(page,"pickup-next-photos").click(); await page.wait_for_timeout(500)
            if await T(page,"pickup-handback-cam-placeholder").count():
                await T(page,"pickup-handback-cam-placeholder").click(); await page.wait_for_timeout(1500)
            print("[T6_serial]", await T(page,"pickup-serial").get_attribute("data-result") if await T(page,"pickup-serial").count() else None)
            if await T(page,"pickup-next-complete").count() and not await T(page,"pickup-next-complete").is_disabled():
                await T(page,"pickup-next-complete").click(); await page.wait_for_timeout(400)
                print("[T6_client_cam]", await T(page,"pickup-client-cam").count())
                if await T(page,"pickup-complete").count():
                    await T(page,"pickup-complete").click(); await page.wait_for_timeout(1800)
                    print("[T6_done]", await T(page,"pickup-done").count(), await txt(T(page,"pickup-done-summary")))
                    await page.wait_for_timeout(8000)
                    if await page.locator("[data-testid='evidence-so-pu9']").count():
                        print("[T6_evidence]", await page.locator("[data-testid='evidence-so-pu9']").evaluate("e=>e.dataset.frames+':'+e.dataset.status"))
        
        # T7 /sales/so-pu9 card
        await nav(page,"/sales/so-pu9"); await page.wait_for_timeout(1800)
        print("[T7_session]", await T(page,"so-pickup-session").count())
        print("[T7_invoice_check]", await txt(T(page,"so-pickup-invoice-check")))
        print("[T7_tier_high]", await T(page,"so-pickup-tier").get_attribute("data-high") if await T(page,"so-pickup-tier").count() else None, await txt(T(page,"so-pickup-tier")))
        print("[T7_sf]", await txt(T(page,"so-pickup-second-factor")))
        print("[T7_reolink]", await txt(T(page,"so-pickup-reolink")))
        print("[T7_id_state]", await T(page,"so-pickup-id-photo").get_attribute("data-state") if await T(page,"so-pickup-id-photo").count() else None)
        if await T(page,"so-pickup-frames").count():
            print("[T7_frames_imgs]", await T(page,"so-pickup-frames").locator("img").count())
        # purge dev
        if await T(page,"so-pickup-id-purge-dev").count():
            await T(page,"so-pickup-id-purge-dev").click(); await page.wait_for_timeout(1200)
            print("[T7_after_purge_state]", await T(page,"so-pickup-id-photo").get_attribute("data-state"), "msg=", await txt(T(page,"so-pickup-id-purged")))

        # T8 regression — so-pu1 'not the same item', so-pu4 serial mismatch, camera bypass
        await nav(page,"/sales/pickup?fast=1"); await page.wait_for_timeout(700)
        if await T(page,"pickup-queue-so-pu1").count():
            await T(page,"pickup-queue-so-pu1").click(); await page.wait_for_timeout(800)
            if await T(page,"pickup-item-stop").count():
                await T(page,"pickup-item-stop").click(); await page.wait_for_timeout(500)
                # pick reason
                reason = page.locator("[data-testid*='pickup-item-stop'] button, [data-testid*='stop-reason']").first
                print("[T8_stop_reason_present]", await reason.count())
                # fill reason textarea
                ra = page.locator("textarea").first
                if await ra.count(): await ra.fill("Serial mismatch test")
                # confirm
                for sel in ["pickup-stop-confirm","pickup-item-stop-confirm"]:
                    if await T(page,sel).count():
                        await T(page,sel).click(); await page.wait_for_timeout(800); print("[T8_stop_confirmed]", sel); break
                # check queue - so-pu1 still present
                await page.wait_for_timeout(500)
                print("[T8_so_pu1_still_in_queue]", await T(page,"pickup-queue-so-pu1").count())

        # T8 jobs timeline + client custody
        await nav(page, "/jobs/j-pu6"); await page.wait_for_timeout(1500)
        page_txt = await page.evaluate("()=>document.body.innerText")
        print("[T8_j_pu6_released_in_timeline]", "Released" in page_txt or "released" in page_txt)
        await nav(page, "/clients/c-17"); await page.wait_for_timeout(1500)
        page_txt = await page.evaluate("()=>document.body.innerText")
        print("[T8_c17_custody_released]", "Released" in page_txt)
        print("[T8_c17_authorized_card]", "Folake" in page_txt, "authorized_mentioned=", "uthorized" in page_txt)

        print("ERRS:", errs[:5])
        await b.close()
asyncio.run(main())

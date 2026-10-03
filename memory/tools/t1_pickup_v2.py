import asyncio, os, re, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://rollisuite-emergent.preview.emergentagent.com").rstrip("/")

async def nav(page, path):
    await page.evaluate("(p)=>{window.history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'));}", path)
    await page.wait_for_timeout(1400)

async def signin(page, who="vienna", pw="vienna123"):
    await page.goto(f"{BASE}/sign-in", wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.locator(f"[data-testid='staff-card-{who}']").click(force=True)
    await page.wait_for_timeout(600)
    for secret in (pw, "1234"):
        if "/sign-in" not in page.url: break
        if await page.locator("input[type='password']").count():
            await page.locator("input[type='password']").first.fill(secret)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(2200)
    if await page.locator("[data-testid='choose-view-own']").count():
        await page.locator("[data-testid='choose-view-own']").click()
        await page.wait_for_timeout(1200)

def T(page, t): return page.locator(f"[data-testid='{t}']")

async def safe_text(loc):
    try:
        if await loc.count(): return (await loc.inner_text()).strip()
    except: pass
    return None

results = {}
def rec(k, v):
    results[k] = v
    print(f"[{k}] {v}")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1600, "height": 1000})
        await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')")
        page = await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page, "vienna", "vienna123")
        rec("signed_in_url", page.url)

        # ===== T1 EN column =====
        await nav(page, "/jobs?tab=queue"); await page.wait_for_timeout(1500)
        en_count = await T(page, "tab-col-dept-EN").count()
        count_txt = await safe_text(T(page, "tab-col-count-dept-EN"))
        has_e02025_in_en = (await T(page, "tab-col-dept-EN").locator("text=E02025").count()) if en_count else 0
        has_e02025_approved = await T(page, "tab-col-approved").locator("text=E02025").count()
        rec("T1_en_col", f"col={en_count} count={count_txt} e02025_in_en={has_e02025_in_en} e02025_in_approved={has_e02025_approved}")

        # ===== T2 open-by-any-reference =====
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(900)
        # a) job number
        await T(page, "pickup-search").fill("E02095"); await page.keyboard.press("Enter"); await page.wait_for_timeout(1200)
        rec("T2a_job", f"card={await T(page,'pickup-item-card').count()} opened_via={await safe_text(T(page,'pickup-side-opened'))}")
        if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(500)
        # b) SO number
        await T(page, "pickup-search").fill("SO-26-0115"); await page.keyboard.press("Enter"); await page.wait_for_timeout(1200)
        rec("T2b_so", f"card={await T(page,'pickup-item-card').count()} opened_via={await safe_text(T(page,'pickup-side-opened'))}")
        if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(500)
        # c) RSPU QR payload
        await T(page, "pickup-search").fill("RSPU:SO-26-0115:PQ4R-66"); await page.keyboard.press("Enter"); await page.wait_for_timeout(1200)
        rec("T2c_rspu", f"card={await T(page,'pickup-item-card').count()} gate3_ok={await T(page,'pickup-gate-3').get_attribute('data-ok')}")
        if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(500)
        # d) unknown
        await T(page, "pickup-search").fill("ZZZ-NOPE"); await page.keyboard.press("Enter"); await page.wait_for_timeout(800)
        rec("T2d_unknown_err", await safe_text(T(page, "pickup-error")))
        # e) client name
        await T(page, "pickup-search").fill("Calloway"); await page.keyboard.press("Enter"); await page.wait_for_timeout(1000)
        rec("T2e_client", f"picker={await T(page,'pickup-picker').count()} card={await T(page,'pickup-item-card').count()} err={await safe_text(T(page,'pickup-error'))}")
        # dismiss picker/card
        if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(400)

        # ===== T3 Gate 2 invoice/QBO positive (so-pu6) =====
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(800)
        await T(page, "pickup-queue-so-pu6").click(); await page.wait_for_timeout(900)
        await T(page, "pickup-item-same").click(); await page.wait_for_timeout(1000)
        rec("T3_g2_pos", f"gate2={await T(page,'pickup-gate2').count()} sent={await safe_text(T(page,'pickup-gate2-sent'))} qbo={await safe_text(T(page,'pickup-gate2-qbo'))} next_disabled={await T(page,'pickup-next-verify').is_disabled()} gate2_ok={await T(page,'pickup-gate-2').get_attribute('data-ok')}")
        # reread
        if await T(page, "pickup-gate2-reread").count():
            await T(page, "pickup-gate2-reread").click(); await page.wait_for_timeout(600)
            rec("T3_reread", f"qbo_after={await safe_text(T(page,'pickup-gate2-qbo'))}")
        if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(500)

        # ===== T3 Gate 2 negative — so-pu2 $830 due, bypass =====
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(600)
        if await T(page, "pickup-queue-so-pu2").count():
            await T(page, "pickup-queue-so-pu2").click(); await page.wait_for_timeout(800)
            await T(page, "pickup-item-same").click(); await page.wait_for_timeout(1000)
            rec("T3_g2_neg", f"balance_gate={await T(page,'pickup-balance-gate').count()} next_disabled={await T(page,'pickup-next-verify').is_disabled()}")
            if await T(page, "pickup-bypass-open").count():
                await T(page, "pickup-bypass-open").click(); await page.wait_for_timeout(600)
                # list approver options
                sel = T(page, "pickup-bypass-modal-manager")
                opts = []
                if await sel.count():
                    opts = await sel.locator("option").evaluate_all("els=>els.map(e=>e.value+'|'+e.textContent)")
                rec("T3_bypass_opts", opts)
                # try select a non-Vienna manager
                non_vienna = None
                for o in opts:
                    val = o.split("|")[0]
                    if val and "vienna" not in o.lower():
                        non_vienna = val; break
                if non_vienna:
                    await sel.select_option(non_vienna); await page.wait_for_timeout(300)
                    # try pin field
                    pin = page.locator("[data-testid='pickup-bypass-modal-pin'], [data-testid*='bypass-pin'], input[type='password']").first
                    if await pin.count(): await pin.fill("1234")
                    reason = page.locator("[data-testid='pickup-bypass-modal-reason'], textarea, [data-testid*='bypass-reason']").first
                    if await reason.count(): await reason.fill("test bypass")
                    confirm = page.locator("[data-testid='pickup-bypass-modal-confirm'], [data-testid*='bypass'][data-testid*='confirm']").first
                    if await confirm.count():
                        await confirm.click(); await page.wait_for_timeout(900)
                    rec("T3_bypass_approved", f"approved={await T(page,'pickup-bypass-approved').count()} next_disabled={await T(page,'pickup-next-verify').is_disabled()}")
                vienna_in_opts = any("vienna" in o.lower() for o in opts)
                rec("T3_bypass_excludes_vienna", not vienna_in_opts)
            if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(500)
        else:
            rec("T3_g2_neg", "pickup-queue-so-pu2 not present")

        # ===== T3 so-02 invoice not sent =====
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(600)
        has_so02 = await T(page, "pickup-queue-so-02").count()
        rec("T3_so02_present", has_so02)
        if has_so02:
            row_txt = await safe_text(T(page, "pickup-queue-so-02"))
            rec("T3_so02_rowtxt", (row_txt or "")[:120])
            await T(page, "pickup-queue-so-02").click(); await page.wait_for_timeout(800)
            await T(page, "pickup-item-same").click(); await page.wait_for_timeout(900)
            send_btn = T(page, "pickup-send-invoice")
            rec("T3_so02_send_btn", await send_btn.count())
            if await send_btn.count():
                await send_btn.click(); await page.wait_for_timeout(1200)
                rec("T3_so02_sent_after", await safe_text(T(page, "pickup-gate2-sent")))
            if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(400)

        # ===== T4 code lockout + stale code demo + so-pu9 code accept =====
        # Already covered in main-agent smoke: skip lockout again, test stale (so-pu3)
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(500)
        if await T(page, "pickup-queue-so-pu3").count():
            await T(page, "pickup-queue-so-pu3").click(); await page.wait_for_timeout(800)
            await T(page, "pickup-item-same").click(); await page.wait_for_timeout(900)
            # gate 2 may show if order is "ready"; try to advance
            if await T(page, "pickup-next-verify").count() and not await T(page, "pickup-next-verify").is_disabled():
                await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(500)
            if await T(page, "pickup-method-code").count():
                await T(page, "pickup-method-code").click(); await page.wait_for_timeout(300)
                await T(page, "pickup-code").fill("EF2J-10"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(700)
                rec("T4_stale_err", await safe_text(T(page, "pickup-verify-error")))
                await T(page, "pickup-code").fill("GH7K-93"); await T(page, "pickup-code-check").click(); await page.wait_for_timeout(900)
                rec("T4_current_ok", f"verified={await T(page,'pickup-verified').count()}")
            if await T(page, "pickup-leave").count(): await T(page, "pickup-leave").click(); await page.wait_for_timeout(400)

        # ===== T5 negative — not-on-list proxy on so-pu6 =====
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(500)
        # NOTE: so-pu6 may already have advanced in prior session; reopen fresh
        await T(page, "pickup-queue-so-pu6").click(); await page.wait_for_timeout(800)
        if await T(page, "pickup-item-same").count():
            await T(page, "pickup-item-same").click(); await page.wait_for_timeout(900)
        if await T(page, "pickup-next-verify").count() and not await T(page, "pickup-next-verify").is_disabled():
            await T(page, "pickup-next-verify").click(); await page.wait_for_timeout(500)
        if await T(page, "pickup-method-proxy").count():
            await T(page, "pickup-method-proxy").click(); await page.wait_for_timeout(400)
            # select "— not on the list"
            sel = T(page, "pickup-proxy-authorized")
            if await sel.count():
                opts = await sel.locator("option").evaluate_all("els=>els.map(e=>e.value+'|'+e.textContent)")
                rec("T5_proxy_options", opts)
                # pick option with 'not' or empty
                not_val = None
                for o in opts:
                    v,t = o.split("|",1)
                    if "not" in t.lower() or v=="":
                        not_val = v; break
                if not_val is not None:
                    await sel.select_option(not_val); await page.wait_for_timeout(300)
                name = T(page, "pickup-proxy-name")
                if await name.count():
                    await name.fill("Random Visitor"); await page.wait_for_timeout(200)
                if await T(page, "pickup-proxy-cam-placeholder").count():
                    await T(page, "pickup-proxy-cam-placeholder").click(); await page.wait_for_timeout(600)
                approve = T(page, "pickup-proxy-approve")
                if await approve.count():
                    await approve.click(); await page.wait_for_timeout(800)
                    modal_count = await page.locator("[data-testid^='pickup-proxy-modal']").count()
                    rec("T5_not_on_list_modal", modal_count)
                    # verify no Vienna in approver list
                    msel = page.locator("[data-testid*='pickup-proxy-modal'] select").first
                    if await msel.count():
                        mopts = await msel.locator("option").evaluate_all("els=>els.map(e=>e.textContent)")
                        rec("T5_approver_opts", mopts)
                        rec("T5_approver_excludes_vienna", not any("vienna" in o.lower() for o in mopts))

        # ===== T6 so-pu9 — verify $1,610 invoice figure in side tier =====
        await nav(page, "/sales/pickup?fast=1"); await page.wait_for_timeout(500)
        row_txt = await safe_text(T(page, "pickup-queue-tier-so-pu9"))
        rec("T6_tier_row", row_txt)
        await T(page, "pickup-queue-so-pu9").click(); await page.wait_for_timeout(900)
        side_tier_txt = await safe_text(T(page, "pickup-side-tier"))
        side_tier_high = await T(page, "pickup-side-tier").get_attribute("data-high")
        rec("T6_side_tier", f"high={side_tier_high} txt={side_tier_txt}")
        rec("T6_invoice_1610_present", ("1,610" in (side_tier_txt or "")))
        rec("T6_total_30110_present", ("30,110" in (side_tier_txt or "")))

        # ===== T7 /sales/so-pu6 SO card =====
        await nav(page, "/sales/so-pu6"); await page.wait_for_timeout(1500)
        rec("T7_session_card", await T(page, "so-pickup-session").count())
        rec("T7_invoice_check", await safe_text(T(page, "so-pickup-invoice-check")))
        rec("T7_tier", await safe_text(T(page, "so-pickup-tier")))
        rec("T7_tier_high", await T(page, "so-pickup-tier").get_attribute("data-high") if await T(page,"so-pickup-tier").count() else None)
        rec("T7_second_factor_txt", await safe_text(T(page, "so-pickup-second-factor")))
        rec("T7_reolink", await safe_text(T(page, "so-pickup-reolink")))
        rec("T7_id_state", await T(page, "so-pickup-id-photo").get_attribute("data-state") if await T(page,"so-pickup-id-photo").count() else None)
        rec("T7_frames_count", await T(page, "so-pickup-frames").locator("img").count() if await T(page,"so-pickup-frames").count() else None)

        print("ERRS:", errs[:5])
        await b.close()

asyncio.run(main())

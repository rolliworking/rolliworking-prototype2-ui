import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        # staff: issue an estimate link from the estimate detail (e-02 Eleanor, sent)
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        await nav(page, "/estimates/e-02"); await page.wait_for_timeout(1200)
        await T(page, "client-link-send").click(); await page.wait_for_timeout(800)
        tok = await page.locator("[data-testid^='client-link-lnk-']").first.get_attribute("data-testid"); token = tok.replace("client-link-", ""); print("estimate link token:", token)
        # client: open the LINK without any RC session (phone viewport)
        await nav(page, f"/rc/estimates/e-02?t={token}"); await page.wait_for_timeout(1200)
        print("link page:", await T(page, "rc-estimate-page").count(), "| lock wall:", await T(page, "rc-lock-wall").count(), "| footer:", await T(page, "rc-link-footer").count(), "| back-home hidden:", await T(page, "rc-back-home").count() == 0)
        await T(page, "rc-approve").click(); await page.wait_for_timeout(400); print("stepup modal:", await T(page, "rc-stepup").get_attribute("data-stage"))
        await T(page, "rc-stepup-email").click(); await page.wait_for_timeout(700); print("stepup sent:", (await T(page, "rc-stepup-sent").inner_text())[:80])
        await T(page, "rc-stepup-code").fill("000000"); await T(page, "rc-stepup-verify").click(); await page.wait_for_timeout(600); print("wrong code err:", await T(page, "rc-error").inner_text())
        await T(page, "rc-dev-fill-code").click(); await page.wait_for_timeout(1500)
        print("approved status:", await T(page, "rc-estimate-status").inner_text(), "| decided card:", await T(page, "rc-estimate-decided").count())
        # link stays readable 15 min after the decision, then retires; bogus is dead immediately
        await nav(page, f"/rc/estimates/e-02?t={token}"); await page.wait_for_timeout(1000); print("decided link still readable:", await T(page, "rc-estimate-decided").count())
        await nav(page, "/rc/estimates/e-02?t=lnk-bogus"); await page.wait_for_timeout(800); print("bogus link:", await T(page, "rc-link-expired").count())
        # Create account via OTP (Harrison, on file, no account) from the footer-style prefilled URL
        await nav(page, "/rc?mode=create&email=harrison.whitfield%40example.com"); await page.wait_for_timeout(800)
        print("lookup state:", await T(page, "rc-lookup").get_attribute("data-state"), "| mode:", await T(page, "rc-login-page").get_attribute("data-mode"))
        await T(page, "rc-send-code").click(); await page.wait_for_timeout(800); print("code card:", await T(page, "rc-code-card").count(), "| resend disabled:", await T(page, "rc-code-resend").is_disabled())
        await T(page, "rc-code-input").fill("123456"); await T(page, "rc-code-verify").click(); await page.wait_for_timeout(500); print("bad code:", await T(page, "rc-error").inner_text())
        await T(page, "rc-dev-fill-code").click(); await page.wait_for_timeout(1500)
        print("home:", await T(page, "rc-home-page").count(), "| first-run note:", await T(page, "rc-first-run-note").count(), "| name:", await T(page, "rc-session-name").inner_text())
        await T(page, "rc-first-run-dismiss").click(); await page.wait_for_timeout(200); print("note dismissed:", await T(page, "rc-first-run-note").count() == 0)
        await nav(page, "/rc/account"); await page.wait_for_timeout(800); print("account:", await T(page, "rc-account-password").inner_text(), "|", await T(page, "rc-account-touch").inner_text(), "| signins:", (await T(page, "rc-account-signins").inner_text())[:3], "| placeholders card:", await T(page, "rc-account-placeholders").count())
        await T(page, "rc-sign-out").click(); await page.wait_for_timeout(600)
        # Magic link sign-in for Eleanor (existing account) with next
        await nav(page, "/rc?email=eleanor.vance%40example.com&next=%2Frc%2Fmessages"); await page.wait_for_timeout(700)
        print("eleanor lookup:", await T(page, "rc-lookup").get_attribute("data-state"))
        await T(page, "rc-send-code").click(); await page.wait_for_timeout(800)
        magic = await page.evaluate("""async () => { const m = await import('/src/api/client.ts'); const ch = JSON.parse(localStorage.getItem('rollisuite.rc.challenges')); const last = ch[ch.length-1]; return '/rc/auth/' + last.linkToken + '?next=%2Frc%2Fmessages'; }""")
        print("magic path:", magic[:40]); await nav(page, magic); await page.wait_for_timeout(1500); print("after magic → url:", page.url.split('/rc')[1][:20], "| messages page:", await page.locator("[data-testid='rc-messages-page'], [data-testid='rc-shell']").count() > 0)
        await nav(page, magic); await page.wait_for_timeout(800); print("magic reuse:", await T(page, "rc-link-expired").count(), (await T(page, "rc-link-expired").inner_text())[:60] if await T(page, "rc-link-expired").count() else "")
        # signed-in approve (e-08 belongs to c-08 not Eleanor; use Eleanor's other sent estimate if any) — check needs-you list
        await nav(page, "/rc/home"); await page.wait_for_timeout(1000); print("eleanor home first-run (should show once):", await T(page, "rc-first-run-note").count())
        # report ask gating: signed-in → ask card present
        await T(page, "rc-sign-out").click(); await page.wait_for_timeout(500)
        await nav(page, "/rc/report/bogus"); await page.wait_for_timeout(800); print("report bogus → expired copy:", await T(page, "rc-link-expired").count())
        # parts link via staff send approval email → read token from Sent? Instead: find existing parts links in storage
        await page.screenshot(path="/tmp/rc_phone.jpg", quality=30, type="jpeg")
        print("errs:", errs)
        await b.close()
asyncio.run(main())

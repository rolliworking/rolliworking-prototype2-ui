import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright

async def states(page, tid):
    return {leg: await page.locator(f"[data-testid='{tid}-{leg}']").get_attribute("data-state") for leg in "WBP"}

async def spa_signin(page, who, pw):
    if await page.locator("[data-testid='switch-user-button']").count():
        await page.locator("[data-testid='switch-user-button']").click(); await page.wait_for_timeout(300); await page.locator("[data-testid='switch-user-other']").click(); await page.wait_for_timeout(900)
    else: await nav(page, "/sign-in"); await page.wait_for_timeout(500)
    await page.locator(f"[data-testid='staff-card-{who}']").click(force=True); await page.wait_for_timeout(600)
    for secret in (pw, "1234"):
        if "/sign-in" not in page.url: break
        await page.locator("input[type='password']").first.fill(secret); await page.keyboard.press("Enter"); await page.wait_for_timeout(2000)
    if await page.locator("[data-testid='choose-view-own']").count(): await page.locator("[data-testid='choose-view-own']").click(); await page.wait_for_timeout(1000)

async def rc_login(page):
    await page.goto("http://localhost:3000/rc", wait_until="networkidle"); await page.wait_for_timeout(600); await page.locator("[data-testid='rc-email-input']").fill("eleanor.vance@example.com"); await page.locator("[data-testid='rc-password-input']").fill("Rolli2026!"); await page.locator("[data-testid='rc-sign-in']").click(); await page.wait_for_timeout(500)
    await page.locator("[data-testid='rc-totp-input']").fill("000000"); await page.locator("[data-testid='rc-totp-verify']").click(); await page.wait_for_timeout(900)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1400, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        # ---- Portal · Eleanor
        await rc_login(page); print("url:", page.url)
        print("home dots:", await states(page, "rc-dots-w-66"), "| legend first time:", await page.locator("[data-testid='rc-dots-legend-home']").count())
        print("B ask label:", await page.locator("[data-testid='rc-dots-w-66-B-ask']").count(), "| daytona dots:", await states(page, "rc-dots-w-02"), "| W approve:", await page.locator("[data-testid='rc-dots-w-02-W-approve']").inner_text() if await page.locator("[data-testid='rc-dots-w-02-W-approve']").count() else "-")
        await page.locator("[data-testid='rc-dots-legend-home-dismiss']").click(); await page.wait_for_timeout(200); print("legend toggle:", await page.locator("[data-testid='rc-dots-legend-home-toggle']").count())
        await page.screenshot(path="/app/memory/tools/shots/portal_home.png")
        # watch page: dots + flow
        await nav(page, "/rc/watches/w-66"); await page.wait_for_timeout(600)
        print("watch dots:", await states(page, "rc-watch-dots"), "| flow lines:", await page.locator("[data-testid^='rc-watch-flow-'][data-stuck]").count(), "| band stuck:", await page.locator("[data-testid='rc-watch-flow-band']").get_attribute("data-stuck"), "| case done:", await page.locator("[data-testid='rc-watch-flow-case']").get_attribute("data-done"), "| case ready stop:", await page.locator("[data-testid='rc-watch-flow-case-ready']").get_attribute("data-state"), "| projected:", await page.locator("[data-testid='rc-watch-flow-projected']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/portal_watch.png")
        # tap red B → ask
        await page.locator("[data-testid='rc-watch-dots-B']").click(); await page.wait_for_timeout(600); print("ask url:", page.url.split('/rc')[1])
        print("prefill:", await page.locator("[data-testid='rc-message-input']").input_value(), "| context:", await page.locator("[data-testid='rc-message-context']").inner_text())
        await page.locator("[data-testid='rc-message-send']").click(); await page.wait_for_timeout(700)
        print("messages with component tag:", await page.locator("[data-testid^='rc-message-component-']").count())
        # ---- Staff · Vienna (concierge) · Inbox
        await spa_signin(page, "vienna", "vienna123"); print("staff url:", page.url); await nav(page, "/inbox"); await page.wait_for_timeout(900)
        rows = page.locator("[data-testid^='thread-row-component-']"); print("ask rows:", await rows.count(), "|", await rows.first.inner_text() if await rows.count() else "-")
        tid = await rows.first.get_attribute("data-testid"); rid = tid.replace("thread-row-component-", "")
        await page.locator(f"[data-testid='thread-row-{rid}']").click(); await page.wait_for_timeout(900)
        card = page.locator("[data-testid^='ask-draft-']"); await card.first.wait_for(); print("ask card:", await card.count(), "| source:", await card.first.get_attribute("data-source"))
        print("internal:", (await page.locator("[data-testid^='ask-internal-']").first.inner_text())[:200])
        print("draft text:", (await page.locator("[data-testid^='ask-text-']").first.input_value())[:260])
        print("assignee:", await page.locator("[data-testid='thread-assign']").input_value(), "| needs reply count before:", await page.locator("[data-testid='inbox-count-needs_reply']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/inbox_ask.png")
        await page.locator("[data-testid^='ask-send-']").first.click(); await page.wait_for_timeout(1000)
        print("sent:", await page.locator("[data-testid^='ask-sent-']").count(), "| needs reply after:", await page.locator("[data-testid='inbox-count-needs_reply']").inner_text(), "| ask rows after:", await page.locator("[data-testid^='thread-row-component-']").count(), "| flash:", (await page.locator("[data-testid='flash-msg']").inner_text() if await page.locator("[data-testid='flash-msg']").count() else "-"))
        # job timeline
        await nav(page, "/jobs/j-pd1"); await page.wait_for_timeout(900); print("job note update:", await page.locator("text=Client update sent").count(), "| hold badge:", await page.locator("[data-testid='hold-badge-j-pd1']").inner_text() if await page.locator("[data-testid='hold-badge-j-pd1']").count() else "-", "| wbp:", {l: await page.locator(f"[data-testid='wbp-j-pd1-{l}']").get_attribute("data-state") for l in "WBP"} if await page.locator("[data-testid='wbp-j-pd1-W']").count() else "n/a")
        # ---- Staff · MH sends the parts approval
        await spa_signin(page, "michael", "michael123"); await nav(page, "/parts/approvals"); await page.wait_for_timeout(800); print("approval row pr-pd1:", await page.locator("[data-testid='approval-row-pr-pd1']").count())
        await page.locator("[data-testid='approval-send-pr-pd1']").click(); await page.wait_for_timeout(800); print("flash:", (await page.locator("[data-testid='approvals-flash']").inner_text())[:120] if await page.locator("[data-testid='approvals-flash']").count() else "-")
        # ---- Portal again: needs you + approve path
        await nav(page, "/rc/home"); await page.wait_for_timeout(800)
        if "/rc/home" not in page.url: await rc_login(page)
        print("needs parts:", await page.locator("[data-testid='rc-needs-ny-parts-pr-pd1']").count(), "| B now:", await page.locator("[data-testid='rc-dots-w-66-B']").get_attribute("data-action"), await page.locator("[data-testid='rc-dots-w-66-B-approve']").inner_text() if await page.locator("[data-testid='rc-dots-w-66-B-approve']").count() else "-")
        await page.locator("[data-testid='rc-dots-w-66-B']").click(); await page.wait_for_timeout(700); print("parts page:", page.url.split('/rc')[1], "| total:", await page.locator("[data-testid='rc-parts-total']").inner_text())
        await page.screenshot(path="/app/memory/tools/shots/portal_parts.png")
        await page.locator("[data-testid='rc-parts-approve']").click(); await page.wait_for_timeout(800); print("status:", await page.locator("[data-testid='rc-parts-page']").get_attribute("data-status"), "| decided:", await page.locator("[data-testid='rc-parts-decided']").count())
        await nav(page, "/rc/watches/w-66"); await page.wait_for_timeout(600); print("B after approve:", await page.locator("[data-testid='rc-watch-dots-B']").get_attribute("data-state"), await page.locator("[data-testid='rc-watch-dots-B']").get_attribute("data-action"))
        await nav(page, "/rc/messages"); await page.wait_for_timeout(700); print("staff reply visible:", await page.locator("text=wanted to give you a quick update").count())
        print("errors:", errs); await b.close()
asyncio.run(main())

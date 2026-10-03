import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
T = lambda page, t: page.locator(f"[data-testid='{t}']")
txt = lambda page, t: T(page, t).inner_text()

async def classes(page):
    return await page.locator("[data-testid^='photo-class-chip-']").evaluate_all("els=>els.reduce((m,e)=>{m[e.dataset.class]=(m[e.dataset.class]||0)+1;return m},{})")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1600, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        # ---- Vienna (manager): identity visible, class chips, pad view, SO card
        await signin(page, "vienna", "vienna123"); await page.wait_for_timeout(400)
        await nav(page, "/jobs/j-pu8"); await page.wait_for_timeout(1200); await T(page, "more-photos-toggle").click(); await page.wait_for_timeout(400)
        print("MGR j-pu8 photos count:", await txt(page, "more-photos-count"), "| classes:", await classes(page), "| identity badge:", await page.locator("[data-testid^='photo-identity-']").count(), "| class chips:", await page.locator("[data-testid^='photo-class-'][data-count]").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('photo-class-','')+':'+e.dataset.count)"))
        await T(page, "photo-class-identity").click(); await page.wait_for_timeout(300); print("MGR identity filter grid:", await page.locator("[data-testid='photo-grid'] figure").count())
        await nav(page, "/jobs/j-30"); await page.wait_for_timeout(1500)
        if (await T(page, "more-photos").get_attribute("data-open")) != "true": await T(page, "more-photos-toggle").click(); await page.wait_for_timeout(600)
        print("MGR j-30 classes:", await classes(page))
        await nav(page, "/sales/so-pu8"); await page.wait_for_timeout(1200); print("MGR so-pu8 id photo:", await T(page, "so-pickup-id-photo").get_attribute("data-state"), "| verify:", (await txt(page, "so-pickup-verify"))[:80])
        # portal-side export view: docs/photos never carry identity (checked via client-side api)
        leak = await page.evaluate("""async () => { const m = await import('/src/api/client.ts'); const s = m.portalPhotoSections('c-20', 'j-pu8'); return [s.arrival, s.condition, s.completed].flat().some(p => p.id === 'ph-id-so-pu8') }""")
        print("portal sections leak identity:", leak)
        # WatchM8 seam page as manager
        await nav(page, "/integrations"); await page.wait_for_timeout(900); print("integration tile:", await T(page, "integration-watchm8").count(), await T(page, "integration-setup-watchm8").count())
        await T(page, "integration-setup-watchm8").click(); await page.wait_for_timeout(1000)
        print("wm8 page:", await T(page, "wm8-setup-page").count(), "| overall:", await txt(page, "wm8-overall"), "| envs:", await page.locator("[data-testid^='wm8-env-'][data-on]").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('wm8-env-','')+':'+e.dataset.on+(e.dataset.current==='true'?'*':''))"))
        print("classes:", await page.locator("[data-testid^='wm8-class-'][data-on]").evaluate_all("els=>els.map(e=>e.dataset.testid.replace('wm8-class-','')+':'+e.dataset.on+(e.dataset.locked==='true'?'(locked)':''))"), "| log empty:", await T(page, "wm8-log-empty").count(), "| cand:", await txt(page, "wm8-cand-labels"), await txt(page, "wm8-cand-photos"))
        print("prod switch disabled for Vienna:", await T(page, "wm8-switch-prod").is_disabled(), "| locked badge:", await T(page, "wm8-locked-prod").count(), "| operational switch disabled:", await T(page, "wm8-class-switch-operational").is_disabled(), "| identity disabled:", await T(page, "wm8-class-switch-identity").is_disabled())
        print("run disabled while OFF:", await T(page, "wm8-run").is_disabled())
        await T(page, "wm8-switch-dev").click(); await page.wait_for_timeout(600); print("dev ON:", await T(page, "wm8-env-dev").get_attribute("data-on"), "| current state:", await txt(page, "wm8-current-state"))
        await T(page, "wm8-run").click(); await page.wait_for_timeout(900); rows = await page.locator("[data-testid^='wm8-log-row-']").count(); types = await page.locator("[data-testid^='wm8-log-row-']").evaluate_all("els=>els.reduce((m,e)=>{m[e.dataset.type]=(m[e.dataset.type]||0)+1;return m},{})"); print("log rows after run:", rows, types, "| count label:", await txt(page, "wm8-log-count"))
        await T(page, "wm8-run").click(); await page.wait_for_timeout(700); print("re-run adds nothing:", await page.locator("[data-testid^='wm8-log-row-']").count() == rows)
        await T(page, "wm8-ack").click(); await page.wait_for_timeout(600); print("acked:", await page.locator("[data-testid^='wm8-log-row-'][data-acked='true']").count())
        await T(page, "wm8-switch-dev").click(); await page.wait_for_timeout(500); print("dev OFF again:", await T(page, "wm8-env-dev").get_attribute("data-on"))
        # Setup → Inspection link state
        await nav(page, "/setup/inspection"); await page.wait_for_timeout(1000); print("insp seam link:", await txt(page, "wm8-seam-link"))
        await nav(page, "/setup"); await page.wait_for_timeout(800); print("setup card:", await T(page, "setup-wm8-card").count())
        await page.screenshot(path="/tmp/wm8_mgr.png", quality=30, type="jpeg")
        # ---- MM (supervisor tier, not manager): identity hidden on the RW job page (data layer)
        await T(page, "switch-user-button").click(); await page.wait_for_timeout(300); await T(page, "switch-user-other").click(); await page.wait_for_timeout(1000)
        await signin(page, "mm", "mm123"); await page.wait_for_timeout(600); print("MM landed:", page.url)
        await nav(page, "/rw/jobs/j-pu8"); await page.wait_for_timeout(1500)
        print("MM rw job photos card:", await T(page, "rw-job-photos").count(), "| classes:", await classes(page), "| identity badge:", await page.locator("[data-testid^='photo-identity-']").count(), "| identity chip filter present:", await T(page, "photo-class-identity").count(), "| job-photo-ph-id-so-pu8:", await T(page, "job-photo-ph-id-so-pu8").count())
        await nav(page, "/setup/integrations/watchm8"); await page.wait_for_timeout(1000); print("MM wm8 page:", await T(page, "wm8-setup-page").count(), "| body:", (await page.inner_text("body"))[:60].replace("\n", " "))
        # ---- MH owner: prod guard
        await nav(page, "/"); await page.wait_for_timeout(800); await T(page, "switch-user-button").click(); await page.wait_for_timeout(300); await T(page, "switch-user-other").click(); await page.wait_for_timeout(1000)
        await signin(page, "michael", "michael123"); await page.wait_for_timeout(400)
        await nav(page, "/setup/integrations/watchm8"); await page.wait_for_timeout(1000)
        print("MH prod switch enabled:", not await T(page, "wm8-switch-prod").is_disabled())
        await T(page, "wm8-switch-prod").click(); await page.wait_for_timeout(600); print("MH prod ON without ref → error:", (await page.inner_text("body")).count("agreement ref") > 0, "| prod on:", await T(page, "wm8-env-prod").get_attribute("data-on"))
        await T(page, "wm8-ref-prod").fill("WM8-AGR-2026-001"); await T(page, "wm8-ref-prod").blur(); await page.wait_for_timeout(500)
        await T(page, "wm8-switch-prod").click(); await page.wait_for_timeout(600); print("MH prod ON with ref:", await T(page, "wm8-env-prod").get_attribute("data-on"))
        await T(page, "wm8-switch-prod").click(); await page.wait_for_timeout(500); print("MH prod OFF:", await T(page, "wm8-env-prod").get_attribute("data-on"))
        # pad detail sheet class chip (MH on pad) — j-pu8 may not be on the pad board; check j-30 via getJobPhotoViews
        print("errs:", errs)
        await b.close()
asyncio.run(main())

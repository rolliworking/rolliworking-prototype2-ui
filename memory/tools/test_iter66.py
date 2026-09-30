import asyncio, sys, traceback
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright

RESULTS = []
def rec(name, ok, detail=""):
    RESULTS.append({"test": name, "ok": ok, "detail": detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {name} :: {detail}")

async def open_card(page):
    t = page.locator("[data-testid='job-opinions']")
    if await t.count() and (await t.get_attribute("data-open")) != "true":
        await page.locator("[data-testid='job-opinions-toggle']").click()
    await page.wait_for_timeout(500)

async def safe(name, coro):
    try:
        await coro()
    except Exception as e:
        rec(name, False, f"Exception: {e}\n{traceback.format_exc()[-400:]}")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1500, "height": 1000})
        await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')")
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        console_errs = []
        page.on("console", lambda msg: console_errs.append(msg.text) if msg.type == "error" else None)

        await signin(page)
        rec("signin", "/sign-in" not in page.url, f"url={page.url}")

        # ============ Test 1: j-r1 seed inspection ============
        async def t_jr1():
            await nav(page, "/jobs/j-r1")
            await open_card(page)
            count_txt = await page.locator("[data-testid='job-opinions-toggle']").inner_text()
            dots = await page.locator("[data-testid='opinion-dots'] [data-opinion]").evaluate_all(
                "els=>els.map(e=>e.dataset.testid.split('-').pop()+':'+e.dataset.opinion)")
            rec("j-r1 dots seeded", len(dots) == 8, f"dots={dots} count_hdr={count_txt[:60]}")
            dial_op = await page.locator("[data-testid='opinion-dial']").get_attribute("data-opinion")
            rec("j-r1 dial=counterfeit", dial_op == "counterfeit", f"got {dial_op}")
            second = await page.locator("[data-testid='opinion-dial-second']").inner_text()
            agree = await page.locator("[data-testid='opinion-dial-second']").get_attribute("data-agree")
            rec("j-r1 dial 2nd opinion MM disagrees", "MM" in second and agree == "false", f"txt={second} agree={agree}")
            spec_done = await page.locator("[data-testid='specimen-banner']").get_attribute("data-done")
            rec("j-r1 specimen-banner done=true", spec_done == "true", f"done={spec_done}")
            await page.locator("[data-testid='opinion-dial-history']").click()
            await page.wait_for_timeout(300)
            revs = await page.locator("[data-testid='opinion-dial-revisions'] li").count()
            rec("j-r1 dial history revisions", revs >= 2, f"revisions={revs}")
            shots = await page.locator("[data-testid='shots-dial'] figure[data-have='true']").count()
            adhoc = await page.locator("[data-testid^='shots-dial-adhoc-']").count()
            rec("j-r1 dial shots 9 + adhoc", shots >= 9 and adhoc >= 1, f"shots={shots} adhoc={adhoc}")
            # Offer to acquire → inbox
            await page.locator("[data-testid='specimen-offer-acquire']").check()
            await page.wait_for_timeout(400)
            await page.locator("[data-testid='msg-bubble']").click()
            await page.wait_for_timeout(400)
            # look for INBOX tab (may be labelled)
            inbox_rows = await page.locator("text=Offer to acquire").count()
            rec("j-r1 offer-to-acquire creates inbox msg", inbox_rows >= 1, f"inbox_matches={inbox_rows}")
            # close bubble
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
        await safe("j-r1 seeds", t_jr1)

        # ============ Test 2: revision + tags on hands ============
        async def t_hands():
            await nav(page, "/jobs/j-r1")
            await open_card(page)
            await page.locator("[data-testid='opinion-hands-opt-genuine_service']").click()
            await page.locator("[data-testid='opinion-hands-conf-likely']").click()
            await page.locator("[data-testid='opinion-hands-tags-notes']").fill("Replaced service hands #hand-l")
            await page.wait_for_timeout(400)
            ta = await page.locator("[data-testid^='opinion-hands-tags-ta-']").all_inner_texts()
            rec("hands typeahead offers #hand-lume", any("hand-lume" in t for t in ta), f"ta={ta}")
            if await page.locator("[data-testid='opinion-hands-tags-ta-hand-lume']").count():
                await page.locator("[data-testid='opinion-hands-tags-ta-hand-lume']").click()
                await page.wait_for_timeout(200)
            chip_pressed = await page.locator("[data-testid='opinion-hands-tags-chip-hand-lume']").get_attribute("aria-pressed") if await page.locator("[data-testid='opinion-hands-tags-chip-hand-lume']").count() else None
            rec("hands chip #hand-lume pressed", chip_pressed == "true", f"aria-pressed={chip_pressed}")
            await page.locator("[data-testid='opinion-hands-tags-notes']").press("End")
            await page.keyboard.type(" #newtell")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(400)
            ask = await page.locator("[data-testid='opinion-hands-tags-ask-new']").count()
            rec("hands ask-new appears", ask >= 1, f"ask={ask}")
            if ask:
                await page.locator("[data-testid='opinion-hands-tags-ask-yes']").click()
                await page.wait_for_timeout(300)
            await page.locator("[data-testid='opinion-hands-save']").click()
            await page.wait_for_timeout(700)
            op = await page.locator("[data-testid='opinion-hands']").get_attribute("data-opinion")
            r = await page.locator("[data-testid='opinion-hands']").get_attribute("data-revision")
            chip = await page.locator("[data-testid='opinion-hands-chip']").inner_text()
            rec("hands saved r2 genuine_service", op == "genuine_service" and r == "2", f"op={op} r={r} chip={chip}")
        await safe("hands revision+tags", t_hands)

        # ============ Test 3: shareable toggle ============
        async def t_shareable():
            await nav(page, "/jobs/j-r1")
            await open_card(page)
            before = await page.locator("[data-testid='opinion-dial-shareable']").get_attribute("aria-pressed")
            await page.locator("[data-testid='opinion-dial-shareable']").click()
            await page.wait_for_timeout(300)
            after = await page.locator("[data-testid='opinion-dial-shareable']").get_attribute("aria-pressed")
            rec("shareable toggle dial", before != after, f"before={before} after={after}")
        await safe("shareable", t_shareable)

        # ============ Test 4: guided shots ============
        async def t_guided():
            await nav(page, "/jobs/j-r1")
            await open_card(page)
            await page.locator("[data-testid='shoot-bezel']").click()
            await page.wait_for_timeout(800)
            comp = await page.locator("[data-testid='guided-shots']").get_attribute("data-component")
            counter = await page.locator("[data-testid='guided-counter']").inner_text()
            overlay = await page.locator("[data-testid='guided-overlay']").count()
            steps_done = await page.locator("[data-testid^='guided-step-'][data-state='done']").count()
            total_steps = await page.locator("[data-testid^='guided-step-']").count()
            rec("guided bezel opens", comp == "bezel" and "1 of 4" in counter and overlay >= 1,
                f"comp={comp} counter={counter} overlay={overlay} steps={steps_done}/{total_steps}")
            await page.locator("[data-testid='guided-shutter']").click()
            await page.wait_for_timeout(300)
            await page.locator("[data-testid='guided-next']").click()
            await page.wait_for_timeout(400)
            c2 = await page.locator("[data-testid='guided-counter']").inner_text()
            rec("guided advances to shot 2", "2 of 4" in c2, f"counter={c2}")
            retake_ct = await page.locator("[data-testid='guided-retake']").count()
            rec("guided-retake present", retake_ct >= 1, f"retakes={retake_ct}")
            await page.locator("[data-testid='guided-close']").click()
            await page.wait_for_timeout(400)
        await safe("guided shots", t_guided)

        # ============ Test 5: variant picker j-08 ============
        async def t_variant():
            await nav(page, "/jobs/j-08")
            await open_card(page)
            chip = await page.locator("[data-testid='opinion-dial-chip']").inner_text()
            rec("j-08 dial chip has MK4", "MK4" in chip, f"chip={chip}")
            await page.locator("[data-testid='opinion-dial-variant-open']").click()
            await page.wait_for_timeout(500)
            tiles = await page.locator("[data-testid^='variant-tile-']").evaluate_all(
                "els=>els.map(e=>e.dataset.testid.slice(13))")
            shot_ct = await page.locator("[data-testid='variant-shot']").count()
            rec("variant picker MK1-4 + unsure + none + shot",
                all(k in tiles for k in ["MK1","MK2","MK3","MK4","unsure","none"]) and shot_ct >= 1,
                f"tiles={tiles} shot={shot_ct}")
            await page.locator("[data-testid='variant-tile-MK2']").click()
            await page.wait_for_timeout(400)
            btn = await page.locator("[data-testid='opinion-dial-variant-open']").inner_text()
            rec("variant picker MK2 selected", "MK2" in btn, f"btn={btn}")
            await page.locator("[data-testid='opinion-dial-variant-open']").click()
            await page.wait_for_timeout(400)
            await page.locator("[data-testid='variant-tile-none']").click()
            await page.wait_for_timeout(400)
            cand = await page.locator("[data-testid='opinion-dial-variant-candidate']").count()
            rec("variant-tile-none creates candidate", cand >= 1, f"candidate={cand}")
            await page.locator("[data-testid='opinion-dial-save']").click()
            await page.wait_for_timeout(500)
            r = await page.locator("[data-testid='opinion-dial']").get_attribute("data-revision")
            rec("j-08 dial saved r2", r == "2", f"r={r}")
        await safe("variant picker", t_variant)

        # ============ Test 6: blind 2nd opinion ============
        async def t_blind():
            await nav(page, "/jobs/j-08")
            await open_card(page)
            await page.locator("[data-testid='opinion-bezel-request-second']").click()
            await page.wait_for_timeout(400)
            pend = await page.locator("[data-testid='opinion-bezel-second-pending']").count()
            rec("bezel 2nd opinion pending", pend >= 1, f"pend={pend}")
            await page.locator("[data-testid='view-as-select']").select_option("u-mm")
            await page.wait_for_timeout(1500)
            await nav(page, "/rw/inspect/j-08")
            await page.locator("[data-testid='inspect-tab-bezel']").click()
            await page.wait_for_timeout(600)
            blind = await page.locator("[data-testid='inspect-opinion-bezel']").get_attribute("data-blind")
            banner = await page.locator("[data-testid='inspect-opinion-bezel-blind-banner']").count()
            chip_hidden = await page.locator("[data-testid='inspect-opinion-bezel-chip']").count() == 0
            rec("MM blind view", blind == "true" and banner >= 1 and chip_hidden,
                f"blind={blind} banner={banner} chip_hidden={chip_hidden}")
            await page.locator("[data-testid='inspect-opinion-bezel-opt-genuine_original']").click()
            await page.locator("[data-testid='inspect-opinion-bezel-save']").click()
            await page.wait_for_timeout(700)
            second_txt = await page.locator("[data-testid='inspect-opinion-bezel-second']").inner_text()
            rec("MM 2nd opinion submitted (agrees)", "agree" in second_txt.lower(), f"txt={second_txt}")
            await page.locator("[data-testid='view-as-select']").select_option("")
            await page.wait_for_timeout(1200)
        await safe("blind 2nd opinion", t_blind)

        # ============ Test 7: pad /rw/inspect ============
        async def t_pad():
            await nav(page, "/rw/inspect")
            empty = await page.locator("[data-testid='inspect-empty']").count()
            rec("pad shows empty state", empty >= 1, f"empty={empty}")
            await page.locator("[data-testid='inspect-scan']").fill("E02031")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(900)
            job_txt = await page.locator("[data-testid='inspect-job']").inner_text()
            dots = await page.locator("[data-testid='inspect-dots']").count()
            rec("pad scan E02031", "Naomi" in job_txt and "278274" in job_txt and dots >= 1, f"job={job_txt[:80]}")
            # rig kiosk
            await nav(page, "/rw/inspect?rig=kiosk")
            await page.wait_for_timeout(500)
            ctrl = await page.locator("[data-testid='rw-inspect-page']").get_attribute("data-controlled")
            rec("rig=kiosk controlled=true", ctrl == "true", f"controlled={ctrl}")
            await nav(page, "/rw/inspect?rig=bench")
            await page.wait_for_timeout(500)
            ctrl2 = await page.locator("[data-testid='rw-inspect-page']").get_attribute("data-controlled")
            rec("rig=bench controlled=false", ctrl2 == "false", f"controlled={ctrl2}")
            # scan again then bezel
            await page.locator("[data-testid='inspect-scan']").fill("E02031")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(900)
            await page.locator("[data-testid='inspect-tab-bezel']").click()
            await page.wait_for_timeout(400)
            chip = await page.locator("[data-testid='inspect-opinion-bezel-chip']").inner_text()
            grid_ct = await page.locator("[data-testid='inspect-grid-bezel'] figure").count()
            rec("pad bezel opinion chip + shot grid", "MK3" in chip and grid_ct == 4, f"chip={chip} grid={grid_ct}")
            # next button
            nxt = await page.locator("[data-testid='inspect-next']").count()
            rec("inspect-next button exists", nxt >= 1, f"next={nxt}")
        await safe("pad page", t_pad)

        # ============ Test 8: error path E02040 ============
        async def t_error_path():
            await nav(page, "/rw/inspect")
            await page.locator("[data-testid='inspect-scan']").fill("E02040")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(900)
            await page.locator("[data-testid='inspect-tab-dial']").click()
            await page.wait_for_timeout(400)
            await page.locator("[data-testid='inspect-opinion-dial-save']").click()
            await page.wait_for_timeout(500)
            err = await page.locator("[data-testid='inspect-opinion-dial-error']").count()
            err_text = await page.locator("[data-testid='inspect-opinion-dial-error']").inner_text() if err else ""
            rec("pad error path: opinion required", err >= 1 and "required" in err_text.lower(), f"err={err} txt={err_text}")
            # Aftermarket + save
            await page.locator("[data-testid='inspect-opinion-dial-opt-aftermarket']").click()
            await page.wait_for_timeout(200)
            await page.locator("[data-testid='inspect-opinion-dial-save']").click()
            await page.wait_for_timeout(700)
            banner = await page.locator("[data-testid='specimen-banner']").count()
            banner_done = await page.locator("[data-testid='specimen-banner']").get_attribute("data-done") if banner else None
            rec("Aftermarket triggers specimen banner incomplete", banner >= 1 and banner_done == "false",
                f"banner={banner} done={banner_done}")
        await safe("pad error path", t_error_path)

        # ============ Test 9: Setup → Inspection ============
        async def t_setup():
            await nav(page, "/setup")
            card = await page.locator("[data-testid='setup-inspection-card']").count()
            link = await page.locator("[data-testid='setup-open-inspection']").count()
            rec("setup inspection card + link", card >= 1 and link >= 1, f"card={card} link={link}")
            await nav(page, "/setup/inspection")
            page_ct = await page.locator("[data-testid='inspection-setup-page']").count()
            rec("inspection setup page loads", page_ct >= 1, f"page={page_ct}")
            await page.locator("[data-testid='vs-ref']").select_option("124300")
            await page.wait_for_timeout(300)
            await page.locator("[data-testid='vs-component']").select_option("dial")
            await page.wait_for_timeout(400)
            variants = await page.locator("[data-testid^='vs-variant-']").evaluate_all("els=>els.map(e=>e.dataset.testid.slice(11))")
            rec("124300 dial variants MK1-4", all(f"MK{i}" in variants for i in range(1,5)), f"variants={variants}")
            # candidates
            cands = await page.locator("[data-testid^='vs-candidate-']").count()
            rec("candidates present after earlier picker", cands >= 1, f"candidates={cands}")
            if cands:
                first = page.locator("[data-testid^='vs-candidate-']").first
                cid = (await first.get_attribute("data-testid")).replace("vs-candidate-", "")
                try:
                    await page.locator(f"[data-testid='vs-promote-key-{cid}']").fill("MK5")
                    await page.locator(f"[data-testid='vs-promote-tells-{cid}']").fill("Test tells")
                    await page.locator(f"[data-testid='vs-promote-{cid}']").click()
                    await page.wait_for_timeout(500)
                    await page.locator("[data-testid='vs-ref']").select_option("124300")
                    await page.wait_for_timeout(300)
                    v2 = await page.locator("[data-testid^='vs-variant-']").evaluate_all("els=>els.map(e=>e.dataset.testid.slice(11))")
                    rec("candidate promoted to MK5", "MK5" in v2, f"variants={v2}")
                except Exception as e:
                    rec("candidate promote", False, str(e))
            # shots-count
            sc = await page.locator("[data-testid='shots-count-dial']").inner_text() if await page.locator("[data-testid='shots-count-dial']").count() else ""
            rec("shots-count-dial has 9", "9" in sc, f"txt={sc}")
            # tags card
            new_tags = await page.locator("[data-testid^='tag-'][data-status='new']").count()
            rec("new tags visible", new_tags >= 1, f"new={new_tags}")
            if await page.locator("[data-testid='tag-confirm-hands-newtell']").count():
                await page.locator("[data-testid='tag-confirm-hands-newtell']").click()
                await page.wait_for_timeout(400)
                st = await page.locator("[data-testid='tag-hands-newtell']").get_attribute("data-status")
                rec("tag confirmed", st == "confirmed", f"status={st}")
            # wm8
            rows = await page.locator("[data-testid^='wm8-']").count()
            rec("wm8 export rows >= 24", rows >= 24, f"rows={rows}")
        await safe("setup inspection", t_setup)

        # ============ Test 10: Reports label quality ============
        async def t_reports():
            await nav(page, "/reports")
            card = await page.locator("[data-testid='report-label-quality']").count()
            rec("report-label-quality card", card >= 1, f"card={card}")
            so01 = await page.locator("[data-testid='label-quality-so-01']").get_attribute("data-agree") if await page.locator("[data-testid='label-quality-so-01']").count() else None
            rec("so-01 disagree", so01 == "false", f"agree={so01}")
            rows = await page.locator("[data-testid^='label-quality-']").evaluate_all("els=>els.map(e=>e.dataset.testid+':'+e.dataset.agree)")
            has_agree_true = any(":true" in r for r in rows)
            rec("has an agreement row (j-08 bezel)", has_agree_true, f"rows={rows}")
        await safe("reports", t_reports)

        # ============ Test 11: Regression j-30 ============
        async def t_regress():
            await nav(page, "/jobs/j-30")
            wbp = await page.locator("[data-testid='job-wbp']").count()
            insp_report = await page.locator("[data-testid='job-inspection-report']").count()
            opinions = await page.locator("[data-testid='job-opinions']").count()
            rec("j-30 has W·B·P + old inspection + new card", wbp >= 1 and insp_report >= 1 and opinions >= 1,
                f"wbp={wbp} insp_report={insp_report} opinions={opinions}")
            await nav(page, "/rw/jobs/j-30")
            rw_link = await page.locator("[data-testid='rw-act-inspect']").count()
            rec("rw job page has rw-act-inspect link", rw_link >= 1, f"link={rw_link}")
        await safe("regression", t_regress)

        rec("no page errors overall", len(errs) == 0, f"errs={errs[:3]}")

        await b.close()

    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n===== SUMMARY: {passed}/{len(RESULTS)} passed =====")
    for r in RESULTS:
        if not r["ok"]:
            print(f"  FAIL {r['test']}: {r['detail'][:200]}")

asyncio.run(main())

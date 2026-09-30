import asyncio, sys
sys.path.insert(0, '/app/memory/tools')
from smoke_wbp_msg import signin, nav
from playwright.async_api import async_playwright
async def open_card(page):
    t = page.locator("[data-testid='job-opinions']")
    if await t.count() and (await t.get_attribute("data-open")) != "true": await page.locator("[data-testid='job-opinions-toggle']").click()
    await page.wait_for_timeout(500)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(viewport={"width": 1500, "height": 1000}); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await signin(page)
        # j-r1: counterfeit dial + blind 2nd opinion disagreement + specimen banner
        await nav(page, "/jobs/j-r1"); await page.locator("[data-testid='job-opinions-toggle']").click(); await page.wait_for_timeout(600)
        print("dots:", await page.locator("[data-testid='opinion-dots'] [data-opinion]").evaluate_all("els=>els.map(e=>e.dataset.testid.split('-').pop()+':'+e.dataset.opinion)"))
        print("dial row:", await page.locator("[data-testid='opinion-dial']").get_attribute("data-opinion"), "| second:", await page.locator("[data-testid='opinion-dial-second']").inner_text(), "| specimen done:", await page.locator("[data-testid='specimen-banner']").get_attribute("data-done"))
        await page.locator("[data-testid='opinion-dial-history']").click(); await page.wait_for_timeout(200); print("revisions:", await page.locator("[data-testid='opinion-dial-revisions'] li").count())
        print("shots dial:", await page.locator("[data-testid='shots-dial'] figure[data-have='true']").count(), "adhoc:", await page.locator("[data-testid^='shots-dial-adhoc-']").count())
        await page.screenshot(path="/app/memory/tools/shots/insp_jr1.png")
        # revision on hands: opinion → genuine_service, likely, tag via typeahead
        await page.locator("[data-testid='opinion-hands-opt-genuine_service']").click(); await page.locator("[data-testid='opinion-hands-conf-likely']").click()
        await page.locator("[data-testid='opinion-hands-tags-notes']").fill("Replaced service hands #hand-l"); await page.wait_for_timeout(200); print("typeahead:", await page.locator("[data-testid^='opinion-hands-tags-ta-']").all_inner_texts())
        await page.locator("[data-testid='opinion-hands-tags-ta-hand-lume']").click(); await page.wait_for_timeout(200)
        await page.locator("[data-testid='opinion-hands-tags-notes']").press("End"); await page.keyboard.type(" #newtell"); await page.keyboard.press("Enter"); await page.wait_for_timeout(200)
        print("ask new tag:", await page.locator("[data-testid='opinion-hands-tags-ask-new']").count()); await page.locator("[data-testid='opinion-hands-tags-ask-yes']").click()
        await page.locator("[data-testid='opinion-hands-save']").click(); await page.wait_for_timeout(500)
        print("hands after save:", await page.locator("[data-testid='opinion-hands']").get_attribute("data-opinion"), "r", await page.locator("[data-testid='opinion-hands']").get_attribute("data-revision"), "chip:", await page.locator("[data-testid='opinion-hands-chip']").inner_text())
        # shareable toggle + specimen offer to acquire
        await page.locator("[data-testid='opinion-dial-shareable']").click(); await page.wait_for_timeout(200); print("shareable:", await page.locator("[data-testid='opinion-dial-shareable']").get_attribute("aria-pressed"))
        await page.locator("[data-testid='specimen-offer-acquire']").check(); await page.wait_for_timeout(300)
        # guided shots on crown? (no list) → shoot bezel retake flow
        await page.locator("[data-testid='shoot-bezel']").click(); await page.wait_for_timeout(700); print("guided:", await page.locator("[data-testid='guided-shots']").get_attribute("data-shot-key"), await page.locator("[data-testid='guided-counter']").inner_text())
        await page.locator("[data-testid='guided-shutter']").click(); await page.wait_for_timeout(200); await page.locator("[data-testid='guided-next']").click(); await page.wait_for_timeout(300); print("  step2:", await page.locator("[data-testid='guided-counter']").inner_text()); await page.locator("[data-testid='guided-close']").click(); await page.wait_for_timeout(400)
        print("bezel retakes ring:", await page.locator("[data-testid='shots-bezel-insert_straight_on']").get_attribute("data-have"))
        # j-08 variant picker (124300 dial set)
        await nav(page, "/jobs/j-08"); await open_card(page)
        print("j-08 dial chip:", await page.locator("[data-testid='opinion-dial-chip']").inner_text()); await page.locator("[data-testid='opinion-dial-variant-open']").click(); await page.wait_for_timeout(400)
        print("picker tiles:", await page.locator("[data-testid^='variant-tile-']").evaluate_all("els=>els.map(e=>e.dataset.testid.slice(13))"), "shot:", await page.locator("[data-testid='variant-shot']").count())
        await page.screenshot(path="/app/memory/tools/shots/insp_variant.png")
        await page.locator("[data-testid='variant-tile-none']").click(); await page.wait_for_timeout(200); print("candidate flag:", await page.locator("[data-testid='opinion-dial-variant-candidate']").count())
        await page.locator("[data-testid='opinion-dial-save']").click(); await page.wait_for_timeout(300); print("j-08 dial r:", await page.locator("[data-testid='opinion-dial']").get_attribute("data-revision"))
        # request blind 2nd opinion on j-08 bezel (MH manager) then view as MM → blind
        await page.locator("[data-testid='opinion-bezel-request-second']").click(); await page.wait_for_timeout(300); print("pending 2nd:", await page.locator("[data-testid='opinion-bezel-second-pending']").count())
        await page.locator("[data-testid='view-as-select']").select_option("u-mm"); await page.wait_for_timeout(1500)
        await nav(page, "/rw/inspect/j-08"); await page.locator("[data-testid='inspect-tab-bezel']").click(); await page.wait_for_timeout(400)
        print("MM blind:", await page.locator("[data-testid='inspect-opinion-bezel']").get_attribute("data-blind"), "banner:", await page.locator("[data-testid='inspect-opinion-bezel-blind-banner']").count(), "chip hidden:", await page.locator("[data-testid='inspect-opinion-bezel-chip']").count() == 0)
        await page.locator("[data-testid='inspect-opinion-bezel-opt-genuine_original']").click(); await page.locator("[data-testid='inspect-opinion-bezel-save']").click(); await page.wait_for_timeout(500)
        print("after submit:", await page.locator("[data-testid='inspect-opinion-bezel-second']").inner_text())
        await page.locator("[data-testid='view-as-select']").select_option(""); await page.wait_for_timeout(800)
        # setup → inspection
        await nav(page, "/setup/inspection"); print("setup: variants", await page.locator("[data-testid^='vs-variant-']").count(), "candidates", await page.locator("[data-testid^='vs-candidate-']").count(), "new tags", await page.locator("[data-testid^='tag-'][data-status='new']").count(), "wm8 rows", await page.locator("[data-testid^='wm8-']").count())
        c = page.locator("[data-testid^='vs-candidate-vc']").first; cid = (await c.get_attribute("data-testid")).replace("vs-candidate-", "")
        await page.locator(f"[data-testid='vs-promote-key-{cid}']").fill("MK5"); await page.locator(f"[data-testid='vs-promote-tells-{cid}']").fill("Test tells"); await page.locator(f"[data-testid='vs-promote-{cid}']").click(); await page.wait_for_timeout(300)
        await page.locator("[data-testid='vs-ref']").select_option("124300"); await page.wait_for_timeout(200); print("  after promote variants:", await page.locator("[data-testid^='vs-variant-']").evaluate_all("els=>els.map(e=>e.dataset.testid.slice(11))"))
        await page.locator("[data-testid='tag-confirm-hands-newtell']").click(); await page.wait_for_timeout(200); print("  newtell status:", await page.locator("[data-testid='tag-hands-newtell']").get_attribute("data-status"))
        await page.screenshot(path="/app/memory/tools/shots/insp_setup.png")
        await nav(page, "/reports"); print("label quality rows:", await page.locator("[data-testid^='label-quality-']").evaluate_all("els=>els.map(e=>e.dataset.testid+':'+e.dataset.agree)"))
        # pad
        await nav(page, "/rw/inspect?rig=kiosk"); await page.locator("[data-testid='inspect-scan']").fill("E02031"); await page.keyboard.press("Enter"); await page.wait_for_timeout(700)
        print("pad job:", (await page.locator("[data-testid='inspect-job']").inner_text())[:60].replace("\n", " "), "controlled:", await page.locator("[data-testid='rw-inspect-page']").get_attribute("data-controlled"))
        await page.locator("[data-testid='inspect-tab-bezel']").click(); await page.wait_for_timeout(300); print("  bezel chip:", await page.locator("[data-testid='inspect-opinion-bezel-chip']").inner_text(), "dictate btn:", await page.locator("[data-testid='inspect-opinion-bezel-tags-dictate']").count())
        await page.screenshot(path="/app/memory/tools/shots/insp_pad.png")
        print("page errors:", errs); await b.close()
asyncio.run(main())

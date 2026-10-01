import asyncio, json
from playwright.async_api import async_playwright
JS = """
async () => {
  const api = await import('/src/api/client.ts');
  const out = [];
  for (const c of api.hitlistBridge.clients ? [] : []) {}
  const jobs = await api.getJobs();
  const byClient = {};
  for (const j of jobs) { (byClient[j.clientId] ??= []).push(j); }
  for (const [cid, js] of Object.entries(byClient)) {
    const rows = api.wbpForClientSync(cid);
    out.push({ cid, name: js[0].client ? js[0].client.firstName + ' ' + js[0].client.lastName : cid, jobs: js.map(j => ({ id: j.id, n: j.number, kind: j.kind, status: j.status, simple: j.simpleStatus, created: j.createdAt.slice(0,10), comps: (j.components||[]).map(c=>c.key+(c.completedAt?'✓':'')).join(','), wbp: (()=>{ const r = rows.find(r=>r.jobId===j.id); return r ? Object.entries(r.legs).map(([k,v])=>k+':'+v.state).join(' ') : 'n/a'; })() })) });
  }
  return out;
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"]); ctx = await b.new_context(); await ctx.add_init_script("localStorage.setItem('rollisuite.api.mode','mock')"); page = await ctx.new_page()
        await page.goto("http://localhost:3000/sign-in"); await page.wait_for_timeout(1500)
        data = await page.evaluate(JS)
        for c in data:
            print(c['cid'], c['name'])
            for j in c['jobs']: print('   ', j['id'], j['n'], j['kind'], j['status'], j['simple'], j['created'], '|', j['comps'], '|', j['wbp'])
        await b.close()
asyncio.run(main())

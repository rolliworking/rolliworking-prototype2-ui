import re, sys
files = {'t': '/app/frontend/src/api/types.ts', 'c': '/app/frontend/src/api/client.ts', 'i': '/app/frontend/src/api/inspectionLabels.ts', 'h': '/app/frontend/src/api/hitlist.ts', 'k': '/app/frontend/src/api/calls.ts', 'r': '/app/frontend/src/api/requestBuilder.ts', 'g': '/app/frontend/src/api/concierge.ts', 'w': '/app/frontend/src/api/watchm8.ts'}
src = {k: open(v).read() for k, v in files.items()}
def grab(name):
    for k, s in src.items():
        m = re.search(r'^export (?:interface|type) ' + re.escape(name) + r'\b[^\n]*', s, re.M)
        if not m: continue
        start = m.start(); i = m.end()
        if '{' in s[start:i] or s[i:i+2].strip().startswith('{'):
            depth = s[start:i].count('{') - s[start:i].count('}')
            j = i
            if depth == 0:
                j = s.find('{', i); depth = 1; j += 1
            while depth > 0 and j < len(s):
                depth += {'{': 1, '}': -1}.get(s[j], 0); j += 1
            body = s[start:j]
        else:
            j = s.find(';', i); body = s[start:j+1]
        body = re.sub(r'\s+', ' ', body)
        print(f'[{k}] {body[:900]}\n')
        return
    print(f'?? {name} not found\n')
for n in sys.argv[1:]: grab(n)

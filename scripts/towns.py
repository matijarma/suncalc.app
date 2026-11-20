"""Build a first-party, prefix-sharded GeoNames gazetteer (CC BY 4.0)."""
import io, json, pathlib, unicodedata, urllib.request, zipfile, hashlib
from collections import defaultdict
root = pathlib.Path(__file__).resolve().parents[1]
out = root/'public'/'towns'
out.mkdir(parents=True, exist_ok=True)
url = 'https://download.geonames.org/export/dump/cities500.zip'
data = urllib.request.urlopen(url, timeout=60).read()
def norm(s): return ''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if c.isascii() and c.isalnum())
groups = defaultdict(list)
with zipfile.ZipFile(io.BytesIO(data)) as z:
 for line in z.read('cities500.txt').decode().splitlines():
  a=line.split('\t'); name, ascii_name, aliases=a[1:4]; pop=int(a[14] or 0)
  names=list(dict.fromkeys([name,ascii_name]+([v for v in aliases.split(',') if v.isascii() and len(v)>2][:12] if pop>=50000 else [])))
  keys={norm(n)[:2] for n in names}-{''}
  for k in keys:
   groups[k].append([name,a[8],round(float(a[4]),4),round(float(a[5]),4),pop,'|'.join(n for n in names if norm(n)[:2]==k and n!=name)])
for k,rows in groups.items():
 rows.sort(key=lambda r:-r[4])
 (out/(k+'.json')).write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
print('Gazetteer:',len(groups),'shards; input SHA256',hashlib.sha256(data).hexdigest())

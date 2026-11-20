"""Mirror the published font, checking each blob against its Git object ID."""
import concurrent.futures, hashlib, json, pathlib, subprocess, urllib.request, time
commit=subprocess.check_output(['gh','api','repos/protomaps/basemaps-assets/commits/main','--jq','.sha'],text=True).strip()
rows=json.loads(subprocess.check_output(['gh','api','repos/protomaps/basemaps-assets/contents/fonts/Noto%20Sans%20Regular?ref='+commit]))
out=pathlib.Path(__file__).resolve().parents[1]/'public/maps/fonts/Noto Sans Regular'
def copy(r):
 path=out/r['name']
 def valid(b): return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['sha']
 if path.exists() and valid(path.read_bytes()):return
 for n in range(4):
  try:
   req=urllib.request.Request(r['download_url'],headers={'User-Agent':'SunCalc atlas build'});b=urllib.request.urlopen(req,timeout=20).read()
   if not valid(b):raise ValueError('Font checksum mismatch')
   path.write_bytes(b);return
  except Exception:
   if n==3:raise
   time.sleep(n+1)
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:list(pool.map(copy,rows))
print('Font mirror:',commit,len(rows),'verified blobs')

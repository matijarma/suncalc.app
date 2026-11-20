export type Env={DB:D1Database;MAPS:R2Bucket;ASSETS:Fetcher;MAP_KEY:string;BILLING_MODE:string;GEOAPIFY_KEY?:string;SUMUP_KEY?:string;SUMUP_MERCHANT?:string;RECOVERY_SECRET?:string};
const DAY=86400000,base='https://api.sumup.com/v0.1/checkouts';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const fail=(s:string,c:number)=>json({error:s},c);
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
const hash=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
async function code(ref:string,secret:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(ref))).slice(0,32)}
async function sumup(env:Env,path:string,body?:object){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.SUMUP_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Payment service unavailable');return await r.json() as any}
export async function api(request:Request,env:Env){
 const u=new URL(request.url),route=u.pathname.substring(5),mode=env.BILLING_MODE==='live'&&!!env.SUMUP_KEY&&!!env.SUMUP_MERCHANT&&!!env.RECOVERY_SECRET?'live':'preview';
 if(route==='config'&&request.method==='GET')return json({mode,addressLookup:!!env.GEOAPIFY_KEY});
 if(request.method!=='POST')return fail('Not found',404);
 if(request.headers.get('origin')&&request.headers.get('origin')!==u.origin)return fail('Invalid origin',403);
 if(!(request.headers.get('content-type')||'').includes('application/json'))return fail('JSON required',415);
 const bodyText=await request.text();if(bodyText.length>2048)return fail('Request too large',413);
 let b:any;try{b=JSON.parse(bodyText);if(!b||typeof b!=='object')throw 0}catch{return fail('Invalid request',400)}
 if(route==='address'){
  const q=typeof b.q==='string'?b.q.trim():'';if(q.length<3||q.length>180)return fail('Enter an address or place name.',400);
  if(!env.GEOAPIFY_KEY)return fail('Address lookup is not available. Search towns or place a pin.',503);
  const today=new Date().toISOString().slice(0,10);
  const used=await env.DB.prepare('INSERT INTO address_budget(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used<3000 RETURNING used').bind(today).first();
  if(!used)return fail('Today’s address allowance has been used. Town and map search still work.',429);
  const target=new URL('https://api.geoapify.com/v1/geocode/search');target.search=new URLSearchParams({text:q,apiKey:env.GEOAPIFY_KEY,limit:'6',format:'json',lang:'en'}).toString();
  const res=await fetch(target,{signal:AbortSignal.timeout(8000)});if(!res.ok)return fail('Address lookup is busy. Try town search.',503);
  const data=await res.json() as any;return json({places:(data.results??[]).slice(0,6).map((r:any)=>({name:String(r.formatted).slice(0,140),lat:r.lat,lon:r.lon}))});
 }
 if(mode!=='live')return json({mode:'preview'});
 const bearer=request.headers.get('Authorization')?.match(/^Bearer ([0-9a-f-]{36})$/i)?.[1];if(!bearer)return fail('Installation required',401);
 const id=await hash(bearer),now=Date.now();
 if(route==='start')await env.DB.prepare('INSERT OR IGNORE INTO installs(id,started) VALUES(?,?)').bind(id,now).run();
 const ins=await env.DB.prepare('SELECT started,paid FROM installs WHERE id=?').bind(id).first<{started:number;paid:number}>();
 if(!ins)return fail('Start planning first',404);
 const status=()=>json({mode:'live',paid:!!ins.paid,until:ins.started+30*DAY});
 if(route==='start'||route==='status')return status();
 if(route==='checkout'){
 if(ins.paid)return fail('Already unlocked',409);const ref=crypto.randomUUID();
 const o=await sumup(env,'',{amount:1,currency:'EUR',merchant_code:env.SUMUP_MERCHANT,checkout_reference:ref,description:'SunCalc lifetime unlock',redirect_url:u.origin+'/?order='+ref,hosted_checkout:{enabled:true}});
 const href=new URL(o.hosted_checkout_url);if(href.protocol!=='https:'||!/(^|\.)sumup\.com$/.test(href.hostname))throw Error('Invalid checkout URL');
 await env.DB.prepare('INSERT INTO orders(ref,install,checkout) VALUES(?,?,?)').bind(ref,id,o.id).run();return json({url:href.toString(),ref});
 }
 if(route==='confirm'){
 const row=await env.DB.prepare('SELECT checkout,paid FROM orders WHERE ref=? AND install=?').bind(String(b.ref),id).first<{checkout:string;paid:number}>();if(!row)return fail('Unknown order',404);
 const recovery=await code(String(b.ref),env.RECOVERY_SECRET!);
 if(!row.paid){const o=await sumup(env,'/'+encodeURIComponent(row.checkout));
 if(o.status!=='PAID')return json({pending:true,status:o.status});
 if(Number(o.amount)!==1||o.currency!=='EUR'||o.checkout_reference!==b.ref||o.merchant_code!==env.SUMUP_MERCHANT)throw Error('Payment does not match order');
 await env.DB.batch([env.DB.prepare('UPDATE orders SET paid=1,recovery_hash=? WHERE ref=?').bind(await hash(recovery),b.ref),env.DB.prepare('UPDATE installs SET paid=1 WHERE id=?').bind(id)]);
 }return json({mode:'live',paid:true,recovery});
 }
 if(route==='restore'){
 const raw=String(b.code??'').replace(/[\s-]/g,'').toLowerCase();if(!/^[a-f0-9]{32}$/.test(raw))return fail('Invalid recovery code',400);
 const o=await env.DB.prepare('SELECT ref FROM orders WHERE recovery_hash=? AND paid=1').bind(await hash(raw)).first();
 if(!o)return fail('Recovery code not found',404);
 await env.DB.prepare('UPDATE installs SET paid=1 WHERE id=?').bind(id).run();return json({mode:'live',paid:true});
 }
 return fail('Not found',404);
}

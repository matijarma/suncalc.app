import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
// One immutable source and a bounded, resumable server-side copy. No public import route.
const key='20261118.pmtiles',size=139594494611,etag='"f80d23ebf8f97045b56ad0bc73b8ec76-521"',part=64*1024*1024;
export class MapImport extends WorkflowEntrypoint<{MAPS:R2Bucket},unknown> {
 async run(_event:WorkflowEvent<unknown>,step:WorkflowStep){
 const bucket=this.env.MAPS;
 if(await step.do('check archive',async()=> (await bucket.head(key))?.size===size))return 'already imported';
 const id=await step.do('open multipart upload',async()=>(await bucket.createMultipartUpload(key,{customMetadata:{source:'Protomaps / OSM',build:'20261118'}})).uploadId);
 const complete:R2UploadedPart[]=[];const count=Math.ceil(size/part);
 for(let batch=0;batch<count;batch+=4){
 const list=await step.do('copy parts '+batch,{retries:{limit:5,delay:'10 seconds',backoff:'exponential'},timeout:'15 minutes'},async()=>{
 const upload=bucket.resumeMultipartUpload(key,id);
 return Promise.all(Array.from({length:Math.min(4,count-batch)},async(_,i)=>{
 const n=batch+i,start=n*part,end=Math.min(size,start+part)-1;
 const r=await fetch('https://build.protomaps.com/'+key,{headers:{Range:'bytes='+start+'-'+end,'If-Match':etag}});
 if(r.status!==206||!r.body||r.headers.get('content-range')!=='bytes '+start+'-'+end+'/'+size||r.headers.get('etag')!==etag)throw Error('Incomplete or changed map source');
 return upload.uploadPart(n+1,r.body);
 }));
 });complete.push(...list);
 }
 await step.do('publish archive',async()=>{if((await bucket.head(key))?.size===size)return;const o=await bucket.resumeMultipartUpload(key,id).complete(complete);if(o.size!==size)throw Error('Archive length mismatch')});
 return 'complete';
 }}

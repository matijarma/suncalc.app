import type {Map as GLMap} from 'maplibre-gl';import {coordinates} from './storage';import type {Spot} from './solar';
export type Result=Spot&{detail:string};
const fold=(s:string)=>s.normalize('NFKD').replace(/\p{Mark}/gu,'').toLowerCase(),key=(s:string)=>fold(s).replace(/[^a-z0-9]/g,'');
const country=new Intl.DisplayNames(['en'],{type:'region'});
export async function find(q:string,m:GLMap|null,signal:AbortSignal):Promise<Result[]>{
 const c=coordinates(q);if(c)return [{...c,detail:'Coordinates'}];if(q.trim().length<2)return [];
 const results:Result[]=[],raw=fold(q.trim()),query=key(q),seen=new Set<string>();
 if(m&&m.isStyleLoaded())for(const layer of ['pois','roads']){for(const f of m.querySourceFeatures('atlas',{sourceLayer:layer})){const n=f.properties?.['name:en']||f.properties?.name;if(typeof n!=='string'||!fold(n).includes(raw)||seen.has(n))continue;const g=f.geometry;
 let point=g.type==='Point'?g.coordinates:g.type==='LineString'?g.coordinates[Math.floor(g.coordinates.length/2)]:null;if(!point||!m.getBounds().contains([point[0],point[1]]))continue;
 seen.add(n);results.push({name:n,lon:point[0],lat:point[1],detail:'On this map'});if(results.length>=3)break}if(results.length>=3)break}
 if(query.length<2)return results;
 const response=await fetch('/towns/'+query.slice(0,2)+'.json',{signal});if(!response.ok)return results;
 const rows=await response.json() as [string,string,number,number,number,string][];
 const matched=rows.filter(r=>[r[0],...r[5].split('|')].some(n=>key(n).startsWith(query))).sort((a,b)=>Number(key(b[0])===query)-Number(key(a[0])===query)||b[4]-a[4]).slice(0,6);
 return [...matched.map(r=>({name:r[0],detail:country.of(r[1])||r[1],lat:r[2],lon:r[3]})),...results]
}

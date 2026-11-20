import { Body, Observer, Equator, Horizon, SearchAltitude, SearchRiseSet, SearchHourAngle } from 'astronomy-engine';
import { Temporal as Fallback } from 'temporal-polyfill';
import tzlookup from '@photostructure/tz-lookup';

export const T=(globalThis as typeof globalThis & {Temporal?:typeof Fallback}).Temporal ?? Fallback;
export type Spot={lat:number;lon:number;name:string};
export const SPLIT:Spot={lat:43.5083,lon:16.4383,name:'Split waterfront'};
export const zoneAt=(p:Spot)=>tzlookup(p.lat,p.lon);
export function validSpot(p:any):p is Spot {return !!p && Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=140}
export const local=(ms:number,zone:string)=>T.Instant.fromEpochMilliseconds(Math.round(ms)).toZonedDateTimeISO(zone);
export const dayAt=(ms:number,zone:string)=>local(ms,zone).toPlainDate().toString();
export function atClock(day:string,clock:string,zone:string){return T.PlainDate.from(day).toPlainDateTime(T.PlainTime.from(clock)).toZonedDateTime(zone,{disambiguation:'compatible'}).epochMilliseconds}
export function clock(ms:number,zone:string){const t=local(ms,zone);return String(t.hour).padStart(2,'0')+':'+String(t.minute).padStart(2,'0')}
export function sun(p:Spot,ms:number){const date=new Date(ms),obs=new Observer(p.lat,p.lon,0), e=Equator(Body.Sun,date,obs,true,true), h=Horizon(date,obs,e.ra,e.dec,'normal');return {az:h.azimuth,alt:h.altitude}}
export const direction=(az:number)=>['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(az/22.5)%16];
export function solarDay(p:Spot,day:string,zone=zoneAt(p)){
 const date=T.PlainDate.from(day),start=date.toZonedDateTime(zone).epochMilliseconds,end=date.add({days:1}).toZonedDateTime(zone).epochMilliseconds;
 const obs=new Observer(p.lat,p.lon,0),s=new Date(start),days=(end-start)/86400000+.00001;
 const bound=(v:Date|undefined)=>v&&v.getTime()>=start&&v.getTime()<end?v.getTime():null;
 const edge=(dir:1|-1,alt?:number)=>bound((alt===undefined?SearchRiseSet(Body.Sun,obs,dir,s,days):SearchAltitude(Body.Sun,obs,dir,s,days,alt))?.date);
 const rise=edge(1),set=edge(-1),noon=bound(SearchHourAngle(Body.Sun,obs,0,s).time.date);
 const events=[{key:'dawn',label:'Civil dawn',ms:edge(1,-6)},{key:'gold-am-start',label:'Morning golden hour starts',ms:edge(1,-4)},{key:'rise',label:'Sunrise',ms:rise},{key:'gold-am',label:'Morning golden hour ends',ms:edge(1,6)},{key:'noon',label:'Solar noon',ms:noon},{key:'gold-pm',label:'Evening golden hour starts',ms:edge(-1,6)},{key:'set',label:'Sunset',ms:set},{key:'gold-pm-end',label:'Evening golden hour ends',ms:edge(-1,-4)},{key:'dusk',label:'Civil dusk',ms:edge(-1,-6)}];
 const path=Array.from({length:97},(_,i)=>{const ms=start+(end-start)*i/96;return {ms,...sun(p,ms)}});
 // A civil day can begin in daylight and can have a sunset before its sunrise.
 const edges=[start,...[rise,set].filter((v):v is number=>v!==null).sort((a,b)=>a-b),end];
 let light=0;for(let i=1;i<edges.length;i++)if(sun(p,(edges[i-1]+edges[i])/2).alt>-.27)light+=edges[i]-edges[i-1];
 return {day,zone,start,end,rise,set,noon,events,path,light};
}
export type SolarDay=ReturnType<typeof solarDay>;
export function shadow(height:number,alt:number){return alt>0?height/Math.tan(alt*Math.PI/180):null}
export function duration(ms:number){const m=Math.round(ms/60000);return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'}

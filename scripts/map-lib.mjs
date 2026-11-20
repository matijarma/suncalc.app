import {copyFileSync,mkdirSync,readFileSync} from 'node:fs';
const pkg='node_modules/maplibre-gl/',v=JSON.parse(readFileSync(pkg+'package.json')).version,out='public/maps/lib/'+v+'/';
mkdirSync(out,{recursive:true});
for(const f of ['maplibre-gl.mjs','maplibre-gl-shared.mjs','maplibre-gl-worker.mjs'])copyFileSync(pkg+'dist/'+f,out+f);
copyFileSync(pkg+'LICENSE.txt',out+'LICENSE.txt');

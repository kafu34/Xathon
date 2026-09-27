import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=['index.html','styles.css','student.css','services.js','timetable.js','journey.js','app.js','student.js','ai.js'];
const assets=Object.fromEntries(files.map(name=>['/'+name,readFileSync(join(root,'dist',name),'utf8')]));
mkdirSync(join(root,'dist','server'),{recursive:true});
writeFileSync(join(root,'dist','server','index.js'),`const ASSETS = ${JSON.stringify(assets)};\n${readFileSync(join(root,'worker','index.js'),'utf8')}`);
console.log('Built dist/server/index.js with the Pace UI and AI endpoints.');

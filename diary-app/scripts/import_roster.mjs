import {readFileSync} from 'node:fs';
import {createStore} from '../store.mjs';
import {fileURLToPath} from 'node:url';
const source=JSON.parse(readFileSync(process.argv[2],'utf8'));
const store=createStore(process.argv[3]||fileURLToPath(new URL('../data/diary.sqlite',import.meta.url)));
try{console.log(JSON.stringify(store.roster.import(source.students,source.source)));}finally{store.close();}

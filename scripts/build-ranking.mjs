import { build } from 'vite';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
await build({configFile:false,build:{outDir:'release/ranking-build/server',emptyOutDir:true,target:'es2022',lib:{entry:'server/ranking-worker.mjs',formats:['es'],fileName:()=> 'index.js'},minify:true}});
await mkdir('release/ranking-build/.openai',{recursive:true});
await copyFile('.openai/hosting.json','release/ranking-build/.openai/hosting.json');
await writeFile('release/ranking-build/server/wrangler.json',JSON.stringify({name:'orbita-ranking',main:'index.js',compatibility_date:'2026-09-28',d1_databases:[{binding:'DB',database_name:'orbita-ranking',database_id:'00000000-0000-4000-8000-000000000000'}]},null,2));
console.log('API pronta em release/ranking-build.');

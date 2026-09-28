import { linkedInProfile, verifyRun } from '../src/ranking.mjs';
import { games } from '../src/galaxy.mjs';
import { difficulties, GAME_VERSION } from '../src/difficulty.mjs';

const allowedOrigins=new Set(['https://matheusmartinsderamos.github.io','http://127.0.0.1:4173','http://127.0.0.1:5173','http://localhost:5173']);
const schema=[
  `CREATE TABLE IF NOT EXISTS results (game TEXT NOT NULL, difficulty TEXT NOT NULL, handle TEXT NOT NULL, name TEXT NOT NULL, time_ms INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL, penalty_ms INTEGER NOT NULL, completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(game,difficulty,handle))`,
  `CREATE INDEX IF NOT EXISTS results_board ON results(game,difficulty,time_ms,completed_at,handle)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)`
];
let initialized;
async function initialize(db) {
  if(!initialized) initialized=db.batch(schema.map(sql=>db.prepare(sql))).catch(error=>{initialized=undefined;throw error;});
  await initialized;
}
function boardParams(game,difficulty) {
  if(!Object.hasOwn(games,game)||!Object.hasOwn(difficulties,difficulty)) throw new Error('Planeta ou nível inválido.');
}
async function leaderboard(db,game,difficulty,handle='',offset=0) {
  boardParams(game,difficulty);
  const queries=[
    db.prepare(`SELECT handle,name,time_ms,elapsed_ms,penalty_ms,RANK() OVER(ORDER BY time_ms) AS position FROM results WHERE game=? AND difficulty=? ORDER BY time_ms,completed_at,handle LIMIT 20 OFFSET ?`).bind(game,difficulty,offset),
    db.prepare('SELECT COUNT(*) AS total FROM results WHERE game=? AND difficulty=?').bind(game,difficulty),
    db.prepare(`SELECT r.handle,r.name,r.time_ms,r.elapsed_ms,r.penalty_ms,1+(SELECT COUNT(*) FROM results b WHERE b.game=r.game AND b.difficulty=r.difficulty AND b.time_ms<r.time_ms) AS position FROM results r WHERE r.game=? AND r.difficulty=? AND r.handle=?`).bind(game,difficulty,handle)
  ];
  const [rows,count,own]=await db.batch(queries);
  return {game,difficulty,entries:rows.results,total:count.results[0].total,own:own.results[0]??null,offset};
}
async function readJson(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Envie os dados em JSON.');
  const reader=request.body?.getReader();if(!reader)throw new Error('Envie o resultado da partida.');
  let length=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>131072){await reader.cancel();throw new Error('Registro de partida muito grande.');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('Dados de partida inválidos.');}
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin')??'';
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin']=origin;
    const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
    if(origin&&!allowedOrigins.has(origin))return json({error:'Origem não permitida.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
    const url=new URL(request.url);
    if(!env.DB)return json({error:'Ranking indisponível: banco de dados não configurado.'},503);
    try {
      await initialize(env.DB);
      if(url.pathname==='/'||url.pathname==='/api/health')return json({ok:true,service:'Ranking da Operação Órbita',version:GAME_VERSION});
      if(url.pathname==='/api/leaderboard'&&request.method==='GET') {
        const offset=Math.min(10000,Math.max(0,Number.parseInt(url.searchParams.get('offset')??'0',10)||0));
        return json(await leaderboard(env.DB,url.searchParams.get('game'),url.searchParams.get('difficulty'),url.searchParams.get('handle')??'',offset));
      }
      if(url.pathname==='/api/results'&&request.method==='POST') {
        const now=Math.floor(Date.now()/1000),hour=Math.floor(now/3600);
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${hour}:${request.headers.get('CF-Connecting-IP')??'local'}`));
        const bucket=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
        const rate=await env.DB.prepare('INSERT INTO rate_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+7200).first();
        if(rate.count>30)return json({error:'Muitas tentativas. Aguarde um pouco antes de salvar outra partida.'},429);
        const payload=await readJson(request);
        if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Dados de partida inválidos.');
        boardParams(payload.game,payload.difficulty);
        const profile=linkedInProfile(payload.linkedin);
        const name=typeof payload.name==='string'?payload.name.trim().normalize('NFC'):'';
        if(name.length>70||/[\u0000-\u001f<>]/u.test(name))throw new Error('Use um nome com até 70 caracteres, sem símbolos especiais.');
        const result=verifyRun(payload);
        const [saved]=await env.DB.batch([
          env.DB.prepare(`INSERT INTO results(game,difficulty,handle,name,time_ms,elapsed_ms,penalty_ms) VALUES(?,?,?,?,?,?,?) ON CONFLICT(game,difficulty,handle) DO UPDATE SET name=excluded.name,time_ms=excluded.time_ms,elapsed_ms=excluded.elapsed_ms,penalty_ms=excluded.penalty_ms,completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE excluded.time_ms<results.time_ms`).bind(payload.game,payload.difficulty,profile.handle,name,result.timeMs,result.elapsedMs,result.penaltyMs),
          env.DB.prepare('DELETE FROM rate_limits WHERE expires<?').bind(now)
        ]);
        return json({...await leaderboard(env.DB,payload.game,payload.difficulty,profile.handle),improved:saved.meta.changes>0,result});
      }
      return json({error:'Rota não encontrada.'},404);
    } catch(error) {
      if(error instanceof Error && /D1_|SQLITE|database|binding|network/i.test(error.message)) return json({error:'O ranking está temporariamente indisponível. Tente novamente.'},503);
      return json({error:error instanceof Error?error.message:'Não foi possível registrar a partida.'},400);
    }
  }
};

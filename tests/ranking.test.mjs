import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {linkedInProfile,verifyRun} from '../src/ranking.mjs';
import {difficulties,GAME_VERSION,MAX_FRAMES} from '../src/difficulty.mjs';
import {games} from '../src/galaxy.mjs';
import {mirrorLayout,traceBeam} from '../src/mirrors.mjs';
import {play} from './helpers/plays.mjs';
import worker from '../server/ranking-worker.mjs';

const winning=new Map();
test('24 desafios são concluíveis com controles reais e seus replays são aceitos pelo servidor',()=>{
  for(const difficulty of Object.keys(difficulties))for(const game of Object.keys(games)){
    const {state,replay}=play(game,difficulty);
    assert.equal(state.phase,'won',`${game}/${difficulty} precisa ser possível`);
    const payload={game,difficulty,version:GAME_VERSION,replay};
    const result=verifyRun(payload);assert.ok(result.timeMs>0);assert.equal(result.elapsedMs,Math.round(state.elapsed*1000));
    winning.set(`${game}/${difficulty}`,payload);
  }
});
test('LinkedIn extrai o mesmo identificador com barra e rastreamento; rejeita outros domínios e caminhos',()=>{
  assert.equal(linkedInProfile('https://www.linkedin.com/in/matheusramoscrm/?utm=xyz&hsjdkdhf').handle,'matheusramoscrm');
  assert.equal(linkedInProfile('https://linkedin.com/in/MatheusRamosCRM#bio').url,'https://www.linkedin.com/in/matheusramoscrm/');
  for(const value of ['https://linkedin.com.evil.test/in/test/','javascript:alert(1)','https://evil@linkedin.com/in/test/','https://www.linkedin.com/company/test/','https://www.linkedin.com/in/a%2fb/','http://www.linkedin.com/in/test/','https://www.linkedin.com/in/%3Cscript%3E/'])assert.throws(()=>linkedInProfile(value));
});
test('ranking rejeita vitória inventada, replay inválido, duração excessiva e versão antiga',()=>{
  const base={game:'identidade',difficulty:'junior',version:GAME_VERSION,replay:[[0,60]]};
  assert.throws(()=>verifyRun({...base,score:999}),/Conclua/);
  for(const replay of [[[128,1]],[[0,-1]],[[0,1.5]],[[0,MAX_FRAMES+1]],[]])assert.throws(()=>verifyRun({...base,replay}));
  assert.throws(()=>verifyRun({...base,version:'old'}),/atualizado/);
  assert.throws(()=>verifyRun({...base,difficulty:'inventado'}));
});
test('espelhos mostram caminho real, uma configuração inicial sem vitória e término mesmo se houver ciclo',()=>{
  const layout=mirrorLayout(6,1,false);
  assert.equal(traceBeam(layout.items,layout.source,layout.receiver).connected,false);
  layout.items.filter(item=>!item.decoy).forEach(item=>item.orientation=item.index<2?0:2);
  const beam=traceBeam(layout.items,layout.source,layout.receiver);assert.equal(beam.connected,true);assert.equal(beam.lit.length,6);
  const loop=traceBeam([{x:1,y:0,index:0,orientation:2},{x:1,y:1,index:1,orientation:0},{x:0,y:1,index:2,orientation:2},{x:0,y:0,index:3,orientation:0}],{x:.5,y:0},{x:5,y:5});
  assert.equal(loop.connected,false);assert.ok(loop.points.length<34);
});

const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){return{args:[],bind(...args){this.args=args;return this;},async first(){return sqlite.prepare(sql).get(...this.args);},execute(){const before=sqlite.prepare('SELECT total_changes() AS n').get().n;const results=sqlite.prepare(sql).all(...this.args);return {results,meta:{changes:sqlite.prepare('SELECT total_changes() AS n').get().n-before}};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
async function call(path,body,origin='https://matheusmartinsderamos.github.io'){
  const request=new Request(`https://ranking.test${path}`,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const response=await worker.fetch(request,{DB:db});return {status:response.status,headers:response.headers,data:await response.json()};
}
test('API persiste melhor tempo, mantém jogadores únicos, separa planeta/nível e informa a posição fora do top 20',async()=>{
  const base=winning.get('identidade/junior');
  const first=await call('/api/results',{...base,linkedin:'https://www.linkedin.com/in/piloto-a/?utm=example',name:'Piloto A'});
  assert.equal(first.status,200);assert.equal(first.data.own.position,1);assert.equal(first.data.total,1);
  const slow=play('identidade','junior',120);
  const repeated=await call('/api/results',{...base,replay:slow.replay,linkedin:'https://linkedin.com/in/piloto-a',name:'Piloto A'});
  assert.equal(repeated.data.total,1);assert.equal(repeated.data.improved,false);assert.equal(repeated.data.own.time_ms,first.data.own.time_ms);
  await call('/api/results',{...winning.get('identidade/pleno'),linkedin:'https://linkedin.com/in/piloto-a'});
  await call('/api/results',{...winning.get('sistemas/junior'),linkedin:'https://linkedin.com/in/piloto-a'});
  assert.equal((await call('/api/leaderboard?game=identidade&difficulty=junior')).data.total,1);
  for(let i=0;i<22;i++)sqlite.prepare('INSERT INTO results(game,difficulty,handle,name,time_ms,elapsed_ms,penalty_ms) VALUES(?,?,?,?,?,?,0)').run('identidade','junior',`fixture-${i}`,'',i+1,i+1);
  const board=await call('/api/leaderboard?game=identidade&difficulty=junior&handle=piloto-a');
  assert.equal(board.data.entries.length,20);assert.equal(board.data.total,23);assert.equal(board.data.own.position,23);
  const page=await call('/api/leaderboard?game=identidade&difficulty=junior&offset=20');assert.equal(page.data.entries.length,3);assert.equal(page.data.entries.at(-1).handle,'piloto-a');
  assert.equal((await call('/api/results',{...base,linkedin:'https://evil.test/in/pilot'})).status,400);
  assert.equal((await call('/api/leaderboard?game=identidade&difficulty=junior',null,'https://evil.test')).status,403);
  assert.equal((await call('/api/health')).data.ok,true);
});

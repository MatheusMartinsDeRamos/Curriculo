import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, pauseGame, updateGame, games, segmentDistance, WORLD } from '../src/galaxy.mjs';

const tick=(s,keys=[],dt=.05)=>updateGame(s,new Set(keys),dt);
const running=id=>{const s=createGame(id);startGame(s);return s;};
function flyTo(s, target, boost=true) {
  for(let i=0;i<1500&&s.phase==='running';i++) {
    const dx=target.x-s.ship.x,dy=target.y-s.ship.y;
    if(Math.hypot(dx,dy)<18)return;
    const keys=[];
    if(Math.abs(dx)>8)keys.push(dx>0?'d':'a');
    if(Math.abs(dy)>8)keys.push(dy>0?'s':'w');
    if(boost&&Math.hypot(dx,dy)>100)keys.push('shift');
    tick(s,keys,.025);
  }
}
test('seis mundos têm seis mecânicas distintas; Shift aumenta a velocidade em quatro vezes',()=>{
  assert.equal(new Set(Object.values(games).map(g=>g.kind)).size,6);
  const normal=running('identidade'),fast=running('identidade');
  tick(normal,['d']);tick(fast,['d','shift']);
  assert.equal(fast.ship.x-1300,(normal.ship.x-1300)*4);
  assert.equal(fast.boost,true);
  tick(fast,['shift']);assert.equal(fast.boost,false);
});
test('pausa congela todos os sistemas; reinício restaura o estado; limites e dt são seguros',()=>{
  const s=running('jornadas');tick(s,['a','shift']);pauseGame(s);
  const before=structuredClone(s);tick(s,['d','shift'],10);assert.deepEqual(s,before);
  startGame(s);tick(s,['d'],10);assert.ok(s.elapsed<.2);
  const fresh=createGame('jornadas');assert.equal(fresh.elapsed,0);assert.equal(fresh.shields,3);assert.equal(fresh.phase,'ready');
  const edge=running('identidade');for(let i=0;i<500;i++)tick(edge,['shift','d','s']);
  assert.ok(edge.ship.x<WORLD.width);assert.ok(edge.ship.y<WORLD.height);
});
test('coleta detecta cruzamentos em velocidade da luz e todos os cristais são alcançáveis',()=>{
  assert.equal(segmentDistance({x:5,y:0},{x:0,y:0},{x:10,y:0}),0);
  const sweep=running('identidade');sweep.ship.x=sweep.items[0].x-60;sweep.ship.y=sweep.items[0].y;tick(sweep,['d','shift']);assert.equal(sweep.score,1);
  const s=running('identidade');for(const item of s.items)flyTo(s,item);
  assert.equal(s.score,10);assert.equal(s.phase,'won');
});
test('corrida exige ordem, tem rota possível em 90 segundos e derrota ao esgotar tempo',()=>{
  const s=running('trajetoria');for(const item of s.items)flyTo(s,item);
  assert.equal(s.score,7);assert.equal(s.phase,'won');assert.ok(s.elapsed<90);
  const wrong=running('trajetoria');wrong.ship.x=wrong.items[1].x;wrong.ship.y=wrong.items[1].y;tick(wrong);assert.equal(wrong.score,0);
  for(let i=0;i<1801;i++)tick(wrong);assert.equal(wrong.phase,'lost');
});
test('escudos absorvem impactos, protegem por 2s e sobrevivência pode terminar em vitória',()=>{
  const s=running('jornadas');s.hazards=[{x:1300,y:900,vx:0,vy:0,r:40}];tick(s);assert.equal(s.shields,2);
  tick(s);assert.equal(s.shields,2);
  for(let i=0;i<85;i++)tick(s);assert.equal(s.phase,'lost');assert.equal(s.shields,0);
  const win=running('jornadas');win.ship={x:40,y:40,angle:0};win.hazards=[{x:2400,y:1600,vx:0,vy:0,r:20}];
  for(let i=0;i<801;i++)tick(win);assert.equal(win.phase,'won');
});
test('reatores exigem proximidade e uma pressão por ação; combinação resolve o quebra-cabeça',()=>{
  const s=running('sistemas');tick(s,['e']);assert.equal(s.moves,0);tick(s);
  for(const index of [0,2,4]) {flyTo(s,s.items[index]);tick(s,['e']);const moves=s.moves;tick(s,['e']);assert.equal(s.moves,moves);tick(s);}
  assert.equal(s.moves,3);assert.equal(s.phase,'won');assert.ok(s.items.every(item=>item.on));
});
test('resgate carrega uma cápsula por vez e só pontua ao retornar à base',()=>{
  const s=running('mentoria');
  for(const item of s.items){const score=s.score;flyTo(s,item);assert.equal(s.carrying,item.index);assert.equal(s.score,score);flyTo(s,{x:1300,y:900});assert.equal(s.carrying,-1);assert.equal(s.score,score+1);}
  assert.equal(s.phase,'won');
});
test('disparos atingem alvos móveis e têm cadência e alcance limitados',()=>{
  const s=running('conexao');tick(s,[' ']);assert.equal(s.bullets.length,1);tick(s,[' ']);assert.equal(s.bullets.length,1);
  for(let i=0;i<30;i++)tick(s);assert.equal(s.bullets.length,0);
  for(const target of s.items){
    for(let i=0;i<20&&!target.done;i++){
      s.ship.x=target.x;s.ship.y=target.y+55;s.ship.angle=0;
      tick(s,[' ']);
    }
    assert.equal(target.done,true);
  }
  assert.equal(s.phase,'won');assert.equal(s.score,6);
});

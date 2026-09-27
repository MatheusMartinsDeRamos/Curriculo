import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { advancePosition, directionVector, nearestPlanet, buildJourney, missionOptions } from '../src/flight.mjs';

test('movimento diagonal mantém a mesma velocidade e teclas opostas se anulam', () => {
  const diagonal = directionVector(new Set(['w', 'd']));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.deepEqual(directionVector(new Set(['w','s','a','d'])), { x:0, y:0 });
  assert.deepEqual(directionVector(new Set(['arrowup'])), { x:0, y:-1 });
});
test('nave permanece dentro do mapa após muitas atualizações ou aba suspensa', () => {
  let position = { x:50, y:50 };
  for (let i=0; i<1000; i++) position = advancePosition(position, {x:1,y:-1}, 1, 360, 400);
  assert.deepEqual(position, {x:96,y:8});
  const afterSuspension = advancePosition({x:50,y:50}, {x:1,y:0}, 100, 1000, 600);
  assert.ok(afterSuspension.x < 52);
});
test('pouso exige proximidade em pixels e escolhe o planeta mais próximo', () => {
  const planets = [{id:'a',x:20,y:30},{id:'b',x:60,y:65}];
  assert.equal(nearestPlanet({x:50,y:50}, planets, 1000, 600, 40), null);
  assert.equal(nearestPlanet({x:58,y:64}, planets, 1000, 600, 40).id, 'b');
  assert.equal(nearestPlanet({x:25,y:30}, planets, 2000, 600, 60), null);
});
test('todas as 27 combinações da missão geram jornada sem pontuação fictícia', () => {
  for (const audience of missionOptions.audience) for (const trigger of missionOptions.trigger) for (const action of missionOptions.action) {
    const journey = buildJourney({audience:audience.value, trigger:trigger.value, action:action.value});
    assert.equal(journey.length,3);
    assert.equal(journey[0].title,audience.title);
    assert.equal(journey[1].title,trigger.title);
    assert.equal(journey[2].title,action.title);
    assert.ok(journey.every(item=>item.detail.length>30));
  }
  assert.throws(()=>buildJourney({audience:'invalido'}), /opção válida/);
});
test('currículo mantém trajetória completa e a origem dos resultados', async () => {
  const data = JSON.parse(await readFile(new URL('../src/content/profile.json', import.meta.url), 'utf8'));
  assert.equal(data.experience.length,11);
  assert.equal(data.experience.at(-1).period, '11/2014 — 12/2015');
  assert.equal(data.experience[0].company,'Overlabs');
  assert.match(data.projects[0].result, /aproximada de 75%/);
  assert.match(data.projects[1].result, /não informa uma métrica/);
  for (const project of data.projects) for (const field of ['context','challenge','action','result']) assert.ok(project[field].length > 20);
});

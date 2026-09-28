import { clamp, directionVector } from './flight.mjs';
import { difficulties } from './difficulty.mjs';
import { mirrorLayout, traceBeam } from './mirrors.mjs';

export const WORLD = { width: 2600, height: 1800 };
export const CRUISE_SPEED = 290;
export const LIGHT_SPEED = 1160;
export const games = {
  identidade: { name: 'Jardim de cristais', zone: 'NEBULOSA ESMERALDA', kind: 'collect', goal: 10, color: '#9bdcc4', instructions: 'Explore a nebulosa e recolha os 10 cristais. O radar mostra onde procurar. Passe sobre cada cristal para coletá-lo.', action: '', duration: 0 },
  trajetoria: { name: 'Circuito de Saturno', zone: 'ANEL DOURADO', kind: 'race', goal: 7, color: '#e4bd7c', instructions: 'Atravesse os 7 portais na ordem, em até 90 segundos. Siga o marcador dourado e use Shift nas retas para ganhar tempo.', action: '', duration: 90 },
  jornadas: { name: 'Chuva de asteroides', zone: 'CINTURÃO VIOLETA', kind: 'survive', goal: 40, color: '#b8a0df', instructions: 'Sobreviva por 40 segundos ao campo de asteroides. Você tem 3 escudos. Use a velocidade da luz para escapar de uma colisão.', action: '', duration: 40 },
  sistemas: { name: 'Espelhos orbitais', zone: 'MATRIZ AZUL', kind: 'mirror', goal: 1, color: '#87c5ef', instructions: 'Leve a luz do reator até o satélite. Pilote até um espelho e pressione E para girá-lo. Observe o feixe e ajuste o caminho. Você pode tentar quantas vezes quiser.', action: 'Girar espelho', duration: 0 },
  mentoria: { name: 'Operação resgate', zone: 'HORIZONTE DE COBRE', kind: 'rescue', goal: 4, color: '#dfac88', instructions: 'Encontre as 4 cápsulas e leve cada uma à base central. Passe sobre uma cápsula para recolhê-la; transporte uma por vez.', action: '', duration: 0 },
  conexao: { name: 'Alvos orbitais', zone: 'ARQUIPÉLAGO ESTELAR', kind: 'shoot', goal: 6, color: '#acd3ce', instructions: 'Encontre os 6 drones de treino. Vire a nave na direção de um alvo e segure Espaço para disparar. Munição ilimitada.', action: 'Disparar', duration: 0 },
};

const crystals = [[1470,800],[960,470],[1460,310],[2040,450],[2240,950],[1960,1420],[1400,1550],[920,1310],[400,1430],[390,490]];
const gates = [[1450,900],[2110,560],[1860,280],[820,380],[450,950],[1080,1450],[1900,1390]];
const pods = [[1430,690],[2140,380],[2180,1430],[470,1390]];
const drones = [[1320,690],[1370,310],[2100,580],[2070,1380],[1260,1480],[490,1130]];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Swept collisions keep small objects collectible even during a light-speed step.
export function segmentDistance(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
export function createGame(id, difficulty = 'junior') {
  const tier = difficulties[difficulty];
  if (!games[id] || !tier) throw new Error('Galáxia ou nível desconhecido');
  const index = Object.keys(games).indexOf(id);
  const target = tier.goals[index];
  const config = {...games[id], goal: games[id].kind === 'mirror' ? 1 : target, duration:tier.limits[index], radius:tier.radius};
  const sourcePoints = config.kind === 'collect' ? crystals : config.kind === 'race' ? gates : config.kind === 'rescue' ? pods : config.kind === 'shoot' ? drones : [];
  const points = sourcePoints.slice(0,target);
  while (points.length < target && sourcePoints.length) {
    const angle = points.length * 2.39996;
    points.push([1300+Math.cos(angle)*1050,900+Math.sin(angle)*720]);
  }
  let items = points.map(([x,y], i) => { const px=1300+(x-1300)*tier.scale,py=900+(y-900)*tier.scale; return { x:px, y:py, homeX:px, homeY:py, done:false, on:false, index:i, orientation:0, decoy:false }; });
  const mirror = mirrorLayout(config.kind === 'mirror' ? target : 2,tier.scale,difficulty==='junior');
  if(config.kind==='mirror') items=mirror.items;
  const beam=traceBeam(items,mirror.source,mirror.receiver);
  config.instructions = config.kind==='collect' ? `Recolha ${target} cristais. Passe sobre eles e use o radar para encontrar o próximo.` : config.kind==='race' ? `Atravesse ${target} portais na ordem. ${config.duration ? `Você tem ${config.duration} segundos.` : 'Sem limite de tempo.'} Segure Shift nas retas.` : config.kind==='survive' ? `Sobreviva ${target} segundos com ${tier.shields} escudos. Cada impacto soma 5 segundos ao tempo do ranking.` : config.kind==='rescue' ? `Resgate ${target} cápsulas levando uma por vez à base central.` : config.kind==='shoot' ? `Encontre ${target} drones de treino e segure Espaço para disparar. ${difficulty==='junior'?'A mira assistida aponta para o alvo próximo.':'Vire a nave em direção ao alvo.'}` : config.instructions;
  const hazards = Array.from({length:tier.rocks}, (_,i) => {
    const angle = i * 2.39996;
    const radius = 320 + (i * 173 % 650);
    return { x:clamp(1300 + Math.cos(angle) * radius,80,2520), y:clamp(900 + Math.sin(angle) * radius,80,1720), vx:Math.cos(angle + 2) * (105 + i % 4 * 24) * tier.danger, vy:Math.sin(angle + 2) * (105 + i % 4 * 24) * tier.danger, r:22 + i % 4 * 7, index:i };
  });
  const bullets = /** @type {{x:number,y:number,vx:number,vy:number,life:number}[]} */ ([]);
  const trail = /** @type {{x:number,y:number,boost:boolean}[]} */ ([]);
  return { id, difficulty, tier, config, mirror, beam, phase:'ready', ship:{x:1300,y:900,angle:0}, boost:false, elapsed:0, score:0, hits:0, shields:tier.shields, invulnerable:0, cooldown:0, actionHeld:false, carrying:-1, moves:0, items, hazards, bullets, trail, feedback:'', event:0 };
}
export function startGame(state) { if (state.phase === 'ready' || state.phase === 'paused') state.phase = 'running'; }
export function pauseGame(state) { if (state.phase === 'running') { state.phase = 'paused'; state.boost = false; } }
export function objective(state) {
  const { config, score } = state;
  switch (config.kind) {
    case 'collect': return `${score} / ${config.goal} cristais`;
    case 'race': return `${score} / ${config.goal} portais${config.duration ? ` · ${Math.max(0,Math.ceil(config.duration-state.elapsed))}s` : ""}`;
    case 'survive': return `${Math.min(config.goal,Math.floor(state.elapsed))} / ${config.goal}s · ${state.shields} escudos`;
    case 'mirror': return `${state.beam.connected?'Satélite ligado':`${state.beam.lit.length} espelhos com luz`} · ${state.moves} giros`;
    case 'rescue': return `${score} / ${config.goal} resgates${state.carrying >= 0 ? ' · VOLTE À BASE' : ''}`;
    default: return `${score} / ${config.goal} alvos`;
  }
}
export function nextTarget(state) {
  const kind = state.config.kind;
  if (kind === 'survive') return null;
  if (kind === 'rescue' && state.carrying >= 0) return {x:1300,y:900,index:-1};
  if (kind === 'race') return state.items[state.score] ?? null;
  const candidates = state.items.filter(item => !item.done && (kind !== 'rescue' || item.index !== state.carrying));
  return candidates.sort((a,b) => distance(a,state.ship) - distance(b,state.ship))[0] ?? null;
}
function signal(state, message) { state.feedback = message; state.event++; }
function finish(state, success) { state.phase = success ? 'won' : 'lost'; state.boost = false; signal(state, success ? 'Missão concluída!' : 'Vamos tentar outra vez?'); }

export function updateGame(state, keys, seconds) {
  if (state.phase !== 'running') return;
  const dt = clamp(seconds,0,.05);
  state.elapsed += dt;
  state.invulnerable = Math.max(0,state.invulnerable - dt);
  state.cooldown = Math.max(0,state.cooldown - dt);
  const direction = directionVector(keys);
  const moving = !!(direction.x || direction.y);
  state.boost = keys.has('shift') && moving;
  const speed = state.boost ? LIGHT_SPEED : CRUISE_SPEED;
  const previous = {...state.ship};
  state.ship.x = clamp(state.ship.x + direction.x * speed * dt,35,WORLD.width-35);
  state.ship.y = clamp(state.ship.y + direction.y * speed * dt,35,WORLD.height-35);
  if (moving) state.ship.angle = Math.atan2(direction.x, -direction.y);
  state.trail.push({x:state.ship.x,y:state.ship.y,boost:state.boost});
  if (state.trail.length > 18) state.trail.shift();
  const action = keys.has('e');
  const kind = state.config.kind;
  if (kind === 'collect') for (const item of state.items) {
    if (!item.done && segmentDistance(item,previous,state.ship) < 45*state.config.radius) {
      item.done = true; state.score++; signal(state, `Cristal ${state.score} de ${state.config.goal} coletado.`);
    }
  }
  if (kind === 'race') {
    const gate = state.items[state.score];
    if (gate && segmentDistance(gate,previous,state.ship) < 75*state.config.radius) { gate.done = true; state.score++; signal(state,`Portal ${state.score} de ${state.config.goal} atravessado.`); }
  }
  if (kind === 'mirror' && action && !state.actionHeld) {
    const nearest = nextTarget(state);
    if (nearest && distance(nearest,state.ship) < 120) {
      nearest.orientation = state.difficulty==='junior' ? (nearest.orientation===0?2:0) : (nearest.orientation+1)%4;
      state.moves++;
      state.beam=traceBeam(state.items,state.mirror.source,state.mirror.receiver);
      state.items.forEach(item=>item.on=state.beam.lit.includes(item.index));
      if(state.beam.connected) state.score=1;
      signal(state, state.beam.connected ? 'O satélite recebeu energia!' : `Espelho ${nearest.index+1} girado. Siga o feixe de luz.`);
    } else signal(state,'Aproxime-se de um espelho e pressione E para girá-lo.');
  }
  state.actionHeld = action;
  if (kind === 'rescue') {
    if (state.carrying < 0) {
      const pod = state.items.find(item => !item.done && segmentDistance(item,previous,state.ship) < 55*state.config.radius);
      if (pod) { state.carrying = pod.index; signal(state,'Cápsula a bordo! Retorne à base central.'); }
    } else if (segmentDistance({x:1300,y:900},previous,state.ship) < 95) {
      state.items[state.carrying].done = true; state.carrying = -1; state.score++;
      signal(state,`Resgate ${state.score} de ${state.config.goal} concluído.`);
    }
  }
  if (kind === 'survive') {
    for (const rock of state.hazards) {
      const rockPrevious = {x:rock.x,y:rock.y};
      rock.x += rock.vx * dt; rock.y += rock.vy * dt;
      if (rock.x < rock.r || rock.x > WORLD.width-rock.r) { rock.vx *= -1; rock.x = clamp(rock.x,rock.r,WORLD.width-rock.r); }
      if (rock.y < rock.r || rock.y > WORLD.height-rock.r) { rock.vy *= -1; rock.y = clamp(rock.y,rock.r,WORLD.height-rock.r); }
      if (state.invulnerable === 0 && segmentDistance({x:0,y:0}, {x:previous.x-rockPrevious.x,y:previous.y-rockPrevious.y}, {x:state.ship.x-rock.x,y:state.ship.y-rock.y}) < rock.r+18) {
        state.shields--; state.hits++; state.invulnerable = 2; signal(state,`Impacto! ${state.shields} escudos restantes.`);
        if (state.shields <= 0) { finish(state,false); return; }
      }
    }
    state.score = state.elapsed;
  }
  if (kind === 'shoot') {
    for (const item of state.items) { item.x = item.homeX + Math.sin(state.elapsed*.6*state.tier.danger+item.index)*85*state.tier.danger; item.y = item.homeY + Math.cos(state.elapsed*.7*state.tier.danger+item.index)*65*state.tier.danger; }
    if (keys.has(' ') && state.cooldown === 0) {
      let angle=state.ship.angle;
      const target=nextTarget(state);
      if(state.difficulty==='junior' && target && distance(target,state.ship)<650) angle=Math.atan2(target.x-state.ship.x,state.ship.y-target.y);
      state.bullets.push({x:state.ship.x,y:state.ship.y,vx:Math.sin(angle)*950,vy:-Math.cos(angle)*950,life:1.3}); state.cooldown = .18;
    }
    for (const bullet of state.bullets) {
      const from = {x:bullet.x,y:bullet.y};
      bullet.x += bullet.vx*dt; bullet.y += bullet.vy*dt; bullet.life -= dt;
      const hit = state.items.find(item => !item.done && segmentDistance(item,from,bullet) < 42*state.config.radius);
      if (hit) { hit.done = true; bullet.life=0; state.score++; signal(state,`Alvo ${state.score} de ${state.config.goal} atingido.`); }
    }
    state.bullets = state.bullets.filter(bullet => bullet.life > 0 && bullet.x > 0 && bullet.y > 0 && bullet.x < WORLD.width && bullet.y < WORLD.height);
  }
  if (state.score >= state.config.goal && state.phase === 'running') finish(state,true);
  else if (state.config.duration && state.elapsed >= state.config.duration && state.phase==='running') finish(state,false);
}

export const difficulties = {
  junior: { name: 'Júnior', summary: 'Bem tranquilo. Mais ajuda, poucos objetivos e sem pressa.', scale: .42, goals: [4,3,15,2,2,3], shields: 8, rocks: 8, danger: .4, radius: 1.6, limits: [0,0,0,0,0,0], hints: true },
  pleno: { name: 'Pleno', summary: 'Um pouco de prática e atenção ao caminho.', scale: .8, goals: [8,6,30,3,4,6], shields: 5, rocks: 22, danger: .85, radius: 1.15, limits: [120,90,0,0,150,120], hints: true },
  senior: { name: 'Sênior', summary: 'Mais objetivos, perigos rápidos e menos tempo.', scale: 1, goals: [12,9,40,4,5,8], shields: 3, rocks: 36, danger: 1.3, radius: .85, limits: [75,55,0,120,105,80], hints: false },
  especialista: { name: 'Especialista', summary: 'Desafio intenso. Exige precisão, lógica e domínio da nave.', scale: 1, goals: [16,12,55,6,6,10], shields: 2, rocks: 55, danger: 1.9, radius: .65, limits: [48,36,0,85,75,55], hints: false },
};
export const GAME_VERSION = 'orbita-v2';
export const STEP = 1 / 60;
export const MAX_FRAMES = 54000;
const controlKeys = ['w','a','s','d','shift','e',' '];
export function controlMask(keys) {
  const normalized = new Set(keys);
  for (const [arrow, key] of [['arrowup','w'],['arrowleft','a'],['arrowdown','s'],['arrowright','d']]) if (keys.has(arrow)) normalized.add(key);
  return controlKeys.reduce((mask,key,i)=>mask | (normalized.has(key) ? 1 << i : 0),0);
}
export const keysFromMask = mask => new Set(controlKeys.filter((_,i)=>mask & (1<<i)));
export function recordFrame(replay, mask) {
  const last = replay.at(-1);
  if (last && last[0] === mask) last[1]++;
  else replay.push([mask,1]);
}
export function resultFor(state) {
  const elapsedMs = Math.round(state.elapsed * 1000);
  const penaltyMs = state.config.kind === 'survive' ? state.hits * 5000 : 0;
  return { elapsedMs, penaltyMs, timeMs: elapsedMs + penaltyMs };
}
export function formatTime(ms) {
  const seconds = ms / 1000;
  return seconds >= 60 ? `${Math.floor(seconds/60)}min ${(seconds%60).toFixed(2)}s` : `${seconds.toFixed(2)}s`;
}

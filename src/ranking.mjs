import { createGame, startGame, updateGame } from './galaxy.mjs';
import { GAME_VERSION, STEP, MAX_FRAMES, keysFromMask, resultFor } from './difficulty.mjs';

export function linkedInProfile(value) {
  if(typeof value!=='string' || value.length>500) throw new Error('Informe a URL do seu perfil no LinkedIn.');
  let url;
  try { url=new URL(value.trim()); } catch { throw new Error('Use uma URL como https://www.linkedin.com/in/seu-perfil/.'); }
  if(url.protocol!=='https:' || !['linkedin.com','www.linkedin.com'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) throw new Error('Use um link HTTPS de perfil do LinkedIn.');
  const match=url.pathname.match(/^\/in\/([a-zA-Z0-9%_-]+)\/?$/);
  if(!match) throw new Error('O link deve conter /in/ seguido do seu nome de usuário.');
  let handle; try {handle=decodeURIComponent(match[1]).normalize('NFC').toLowerCase();} catch {throw new Error('O endereço do perfil está incompleto.');}
  if(!/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,99}$/u.test(handle)) throw new Error('O nome do perfil não é válido.');
  return {handle,url:`https://www.linkedin.com/in/${encodeURIComponent(handle)}/`};
}
export function verifyRun(payload) {
  if(payload.version!==GAME_VERSION) throw new Error('O jogo foi atualizado. Recarregue a página e jogue novamente.');
  const state=createGame(payload.game,payload.difficulty);
  if(!Array.isArray(payload.replay) || !payload.replay.length || payload.replay.length>8192) throw new Error('Registro de partida inválido.');
  let frames=0;startGame(state);
  for(const run of payload.replay) {
    if(!Array.isArray(run)||run.length!==2||!Number.isInteger(run[0])||run[0]<0||run[0]>127||!Number.isInteger(run[1])||run[1]<1) throw new Error('Controles de partida inválidos.');
    frames+=run[1]; if(frames>MAX_FRAMES) throw new Error('A partida excedeu o limite de 15 minutos para o ranking.');
    const keys=keysFromMask(run[0]);
    for(let i=0;i<run[1];i++) {
      if(state.phase!=='running') throw new Error('O registro contém movimentos após o fim da partida.');
      updateGame(state,keys,STEP);
    }
  }
  if(state.phase!=='won') throw new Error('Conclua o desafio para registrar seu resultado.');
  return {...resultFor(state),frames};
}

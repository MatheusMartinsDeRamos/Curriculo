import config from './ranking-config.json';
import { linkedInProfile } from './ranking.mjs';
import { GAME_VERSION, difficulties, formatTime, resultFor } from './difficulty.mjs';
import type { createGame } from './galaxy.mjs';

type State=ReturnType<typeof createGame>;
type Entry={handle:string;name:string;time_ms:number;elapsed_ms:number;penalty_ms:number;position:number};
type Board={entries:Entry[];total:number;own:Entry|null;offset:number;improved?:boolean};
const escape=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export class RankingView {
  private abort=new AbortController();
  private generation=0;
  private loadRevision=0;
  private state:State|null=null;
  private replay:number[][]=[];
  private handle='';
  private game='';
  private difficulty='junior';
  private offset=0;
  private saving=false;
  constructor(private root:HTMLElement,private continueToContent:(message?:string)=>void){
    root.addEventListener('click',this.click);
    root.addEventListener('submit',this.submit);
    root.addEventListener('input',this.input);
  }
  destroy(){this.abort.abort();this.root.removeEventListener('click',this.click);this.root.removeEventListener('submit',this.submit);this.root.removeEventListener('input',this.input);}
  show(game:string,difficulty:string,state:State|null=null,replay:number[][]=[]){
    this.abort.abort();this.abort=new AbortController();this.generation++;
    this.game=game;this.difficulty=difficulty;this.state=state;this.replay=replay;this.offset=0;this.handle='';this.saving=false;
    this.root.hidden=false;
    this.root.innerHTML=`<header><div><span class="eyebrow">RANKING PÚBLICO / ${escape(difficulties[difficulty as keyof typeof difficulties].name)}</span><h4>Seu próximo recorde começa aqui.</h4></div><button class="text-button" data-ranking-close>Fechar ×</button></header>${state?.phase==='won'?this.form(state):'<p class="rank-note">Conclua o desafio para registrar seu melhor tempo nesta categoria.</p>'}<p class="rank-feedback" role="status"></p><div class="rank-table" aria-label="Classificação dos jogadores"></div><nav class="rank-pagination"><button class="text-button" data-rank-page="previous" hidden>← Anterior</button><button class="text-button" data-rank-page="next" hidden>Próximos →</button><button class="text-button" data-ranking-retry>Atualizar classificação ↻</button></nav>`;
    void this.load();
  }
  private form(state:State){
    const result=resultFor(state);
    return `<p class="rank-result">Seu resultado: <strong>${formatTime(result.timeMs)}</strong>${result.penaltyMs?` (${formatTime(result.elapsedMs)} de voo + ${formatTime(result.penaltyMs)} por impactos)`:''}.</p><form id="ranking-form"><div class="rank-fields"><label>Seu nome <small>(opcional)</small><input name="playerName" autocomplete="name" maxlength="70" placeholder="Como você se chama?" /></label><label>Seu perfil no LinkedIn <input name="linkedin" type="url" required maxlength="500" placeholder="https://www.linkedin.com/in/seu-perfil/" autocomplete="url" /></label></div><p class="rank-identity">O nome exibido no ranking será o identificador do seu perfil.</p><p class="rank-note">Ao salvar, seu identificador, nome opcional e resultado ficam públicos. O perfil é informado por você, sem verificação pelo LinkedIn. Guardamos seu melhor resultado neste planeta e nível.</p><div class="rank-actions"><button class="button button-primary" type="submit">Salvar meu resultado ↗</button><button class="text-button" type="button" data-ranking-skip>Prefiro não informar o LinkedIn</button></div></form>`;
  }
  private input=(event:Event)=>{
    const input=event.target as HTMLInputElement;
    if(input.name!=='linkedin')return;
    input.setCustomValidity('');
    const label=this.root.querySelector('.rank-identity');
    try{const profile=linkedInProfile(input.value);if(label)label.textContent=`Você aparecerá como ${profile.handle}.`;}catch{if(label)label.textContent='Use o link do seu perfil pessoal: linkedin.com/in/seu-perfil/.';}
  };
  private click=(event:Event)=>{
    const target=(event.target as Element).closest<HTMLElement>('button');if(!target)return;
    if(target.hasAttribute('data-ranking-continue')){this.continueToContent();return;}
    if(target.hasAttribute('data-ranking-skip')){this.continueToContent('Tudo bem! Você pode explorar Estações & currículo sem informar o LinkedIn.');return;}
    if(target.hasAttribute('data-ranking-close')){this.root.hidden=true;return;}
    if(target.hasAttribute('data-ranking-retry'))void this.load();
    if(target.dataset.rankPage){this.offset=Math.max(0,this.offset+(target.dataset.rankPage==='next'?20:-20));void this.load();}
  };
  private submit=(event:Event)=>{
    const form=event.target as HTMLFormElement;if(form.id!=='ranking-form')return;event.preventDefault();
    if(this.saving||!this.state||this.state.phase!=='won')return;
    const linkedin=form.querySelector<HTMLInputElement>('[name="linkedin"]')!;
    let profile;try{profile=linkedInProfile(linkedin.value);}catch(error){linkedin.setCustomValidity((error as Error).message);linkedin.reportValidity();return;}
    if(!form.reportValidity())return;
    this.handle=profile.handle;this.saving=true;this.loadRevision++;this.offset=0;
    const button=form.querySelector<HTMLButtonElement>('[type="submit"]')!;button.disabled=true;button.textContent='Conferindo partida…';
    const generation=this.generation;
    const payload={game:this.game,difficulty:this.difficulty,linkedin:profile.url,name:new FormData(form).get('playerName'),replay:this.replay,version:GAME_VERSION};
    void this.request('/api/results',{method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'application/json'}}).then(board=>{
      if(generation!==this.generation)return;
      this.renderBoard(board);form.innerHTML=`<p class="rank-saved">${board.improved?'Resultado salvo!':'Seu melhor resultado anterior foi mantido.'}</p><button type="button" class="button button-primary" data-ranking-continue>Ir para Estações & currículo ↗</button>`;
    }).catch(error=>{if(generation===this.generation){this.feedback(error.message);button.disabled=false;button.textContent='Tentar salvar novamente ↗';}}).finally(()=>{if(generation===this.generation)this.saving=false;});
  };
  private async request(path:string,options:RequestInit={}):Promise<Board>{
    const signal=AbortSignal.any([this.abort.signal,AbortSignal.timeout(15000)]);
    let response;
    try{response=await fetch(config.apiUrl+path,{...options,signal});}catch{throw new Error('Não foi possível acessar o ranking. Sua partida continua aqui; tente novamente.');}
    let data;try{data=await response.json();}catch{throw new Error('O ranking está temporariamente indisponível. Tente novamente.');}
    if(!response.ok)throw new Error(data.error||'Não foi possível registrar o resultado.');
    return data;
  }
  private async load(){
    if(this.saving)return;
    const generation=this.generation;
    const revision=++this.loadRevision;
    this.feedback('Buscando classificação…');
    try{
      const query=new URLSearchParams({game:this.game,difficulty:this.difficulty,handle:this.handle,offset:String(this.offset)});
      const board=await this.request(`/api/leaderboard?${query}`);
      if(generation===this.generation&&revision===this.loadRevision)this.renderBoard(board);
    }catch(error){if(generation===this.generation&&revision===this.loadRevision)this.feedback((error as Error).message);}
  }
  private feedback(message:string){const feedback=this.root.querySelector('.rank-feedback');if(feedback)feedback.textContent=message;}
  private renderBoard(board:Board){
    this.feedback(board.own?`Você está em ${board.own.position}º lugar entre ${board.total} ${board.total===1?'jogador':'jogadores'}. Seu melhor resultado: ${formatTime(board.own.time_ms)}.`:`${board.total} ${board.total===1?'jogador nesta categoria':'jogadores nesta categoria'}.`);
    this.root.querySelector('.rank-table')!.innerHTML=board.entries.length?`<table><caption>Menor tempo vence. Tempos iguais compartilham a posição.</caption><thead><tr><th>Lugar</th><th>Piloto</th><th>Melhor tempo</th></tr></thead><tbody>${board.entries.map(entry=>`<tr ${entry.handle===this.handle?'class="rank-own"':''}><td>${entry.position}º</td><td><a href="https://www.linkedin.com/in/${encodeURIComponent(entry.handle)}/" target="_blank" rel="noopener noreferrer">${escape(entry.handle)} ↗</a>${entry.name?`<small>${escape(entry.name)}</small>`:''}</td><td>${formatTime(entry.time_ms)}</td></tr>`).join('')}</tbody></table>`:'<p class="rank-empty">O primeiro lugar está esperando por você. Conclua o desafio para inaugurar este ranking.</p>';
    this.root.querySelector<HTMLButtonElement>('[data-rank-page="previous"]')!.hidden=board.offset===0;
    this.root.querySelector<HTMLButtonElement>('[data-rank-page="next"]')!.hidden=board.offset+20>=board.total;
  }
}

import { createGame, games, WORLD, updateGame, startGame, pauseGame, objective, nextTarget } from './galaxy.mjs';
import type { PlanetId } from './content/planets';
import './galaxy.css';
import './ranking.css';
import { difficulties, STEP, MAX_FRAMES, controlMask, recordFrame, resultFor, formatTime } from './difficulty.mjs';
import { RankingView } from './ranking-view';

export class GalaxyView {
  state: ReturnType<typeof createGame>;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private observer: ResizeObserver;
  private width = 1;
  private height = 1;
  private displayedPhase = '';
  private lastEvent = 0;
  private accumulator = 0;
  private replay: number[][] = [];
  private frames = 0;
  private wonNotified = false;
  private ranking: RankingView;
  private stars = Array.from({length:270}, (_,i) => ({x:(i*977+97)%2600,y:(i*613+83)%1800,r:i%6===0?1.9:.85}));
  constructor(private root: HTMLElement, id: PlanetId, private notify: (message: string) => void, private clear: () => void, private completed: () => void, private openContent: (message?: string) => void) {
    let selected='junior';try{selected=localStorage.getItem('orbita-difficulty')||'junior';}catch{}
    this.state = createGame(id,Object.hasOwn(difficulties,selected)?selected:'junior');
    const config = this.state.config;
    root.innerHTML = `<div class="galaxy-toolbar"><div><span class="eyebrow">${config.zone}</span><h3>${config.name} <small id="game-level"></small></h3></div><div class="galaxy-readout"><span id="game-progress" role="status"></span><span id="warp-status">PROPULSÃO PRONTA · ×4</span></div><button class="icon-button" id="game-rank" aria-label="Ver ranking" title="Ranking">♜</button><button class="icon-button" id="game-pause" aria-label="Pausar minigame" title="Pausar (P)">Ⅱ</button><button class="icon-button" id="game-restart" aria-label="Reiniciar minigame" title="Reiniciar">↺</button></div><div class="galaxy-viewport"><canvas class="galaxy-canvas" tabindex="0" aria-label="Área de voo. WASD ou setas para pilotar, Shift para velocidade da luz. ${config.instructions}"></canvas><div class="game-overlay"></div><span class="galaxy-location" aria-hidden="true">SETOR EXPLORÁVEL / 2.600 × 1.800</span><div class="galaxy-touch" aria-label="Controles da nave"><div class="world-directions">${['up','left','down','right'].map((direction,i)=>`<button data-direction="${direction}" aria-label="Mover para ${['cima','a esquerda','baixo','a direita'][i]}">${['↑','←','↓','→'][i]}</button>`).join('')}</div><div class="world-actions"><button data-flight-key="shift" class="boost-touch" aria-label="Segurar para velocidade da luz">⚡<small>LUZ</small></button>${config.action ? `<button data-flight-key="${config.kind==='shoot'?'space':'e'}" aria-label="${config.action}">${config.kind==='shoot'?'◎':'E'}<small>${config.kind==='shoot'?'ATIRAR':'ACIONAR'}</small></button>` : ''}</div></div></div><div class="galaxy-instructions"><span><kbd>WASD</kbd> / setas · <kbd>Shift</kbd> velocidade da luz${config.action ? ` · <kbd>${config.kind==='shoot'?'Espaço':'E'}</kbd> ${config.action.toLowerCase()}` : ''} · <kbd>P</kbd> pausa</span><button id="game-help">Como jogar</button></div><p class="game-message" aria-live="polite">${config.instructions}</p><section class="ranking-panel" hidden aria-label="Ranking do minigame"></section>`;
    this.ranking=new RankingView(root.querySelector('.ranking-panel')!,openContent);
    this.canvas = root.querySelector('canvas')!;
    this.context = this.canvas.getContext('2d');
    if (!this.context) { root.innerHTML = '<p>O modo de voo precisa de Canvas. Você pode acessar todo o conteúdo em “Estações & currículo”.</p>'; this.observer = new ResizeObserver(()=>{}); return; }
    this.observer = new ResizeObserver(()=>this.resize());
    this.observer.observe(this.canvas);
    root.addEventListener('click',this.click);
    root.addEventListener('change',this.change);
    this.resize(); this.sync();
  }
  private click = (event: Event) => {
    const id = (event.target as Element).closest('button')?.id;
    if (id === 'game-start') { this.clear(); this.accumulator=0; startGame(this.state); this.canvas.focus({preventScroll:true}); this.sync(); }
    if (id === 'game-pause') { this.togglePause(); }
    if (id === 'game-restart' || id === 'game-again') this.reset(this.state.difficulty);
    if (id === 'game-rank' || id === 'game-register') { this.pause(); this.showRanking(); }
    if (id === 'game-content') this.openContent();
    if (id === 'game-help') { this.pause(); this.root.querySelector('.game-message')!.textContent=this.state.config.instructions; }
  };
  private change = (event: Event) => {
    const input=event.target as HTMLInputElement;
    if(input.name==='difficulty' && Object.hasOwn(difficulties,input.value)) {
      this.reset(input.value);
      try{localStorage.setItem('orbita-difficulty',input.value);}catch{}
      this.root.querySelector<HTMLInputElement>(`[name="difficulty"][value="${input.value}"]`)?.focus({preventScroll:true});
    }
  };
  private reset(difficulty:string) {
    this.clear();this.state=createGame(this.state.id,difficulty);this.lastEvent=0;this.frames=0;this.accumulator=0;this.replay=[];this.wonNotified=false;this.displayedPhase='';
    this.root.querySelector<HTMLElement>('.ranking-panel')!.hidden=true;
    this.root.querySelector('.game-message')!.textContent=this.state.config.instructions;
    this.sync();
  }
  private showRanking(scroll=true) {
    this.ranking.show(this.state.id,this.state.difficulty,this.state.phase==='won'?this.state:null,this.replay);
    if(scroll)this.root.querySelector('.ranking-panel')!.scrollIntoView({block:'start',behavior:'instant'});
  }
  destroy() { this.observer.disconnect(); this.root.removeEventListener('click',this.click); this.root.removeEventListener('change',this.change); this.ranking.destroy(); }
  pause() { pauseGame(this.state); this.clear(); this.sync(); }
  togglePause() {
    this.clear();
    if (this.state.phase==='running') pauseGame(this.state);
    else if (this.state.phase==='paused') { startGame(this.state); this.canvas.focus({preventScroll:true}); }
    this.sync();
  }
  update(keys: Set<string>, dt: number, reduced: boolean) {
    if (!this.context) return;
    if(this.state.phase==='running') {
      this.accumulator+=Math.min(dt,.05);
      while(this.accumulator>=STEP && this.state.phase==='running') {
        updateGame(this.state,keys,STEP);this.accumulator-=STEP;this.frames++;
        if(this.frames<=MAX_FRAMES) recordFrame(this.replay,controlMask(keys));
      }
    } else this.accumulator=0;
    if(this.state.phase==='won'&&!this.wonNotified){this.wonNotified=true;this.completed();this.showRanking(false);}

    if (this.state.event!==this.lastEvent) { this.lastEvent=this.state.event; this.root.querySelector('.game-message')!.textContent=this.state.feedback; this.notify(this.state.feedback); }
    this.sync(); this.draw(reduced);
  }
  private resize() {
    const rect=this.canvas.getBoundingClientRect();
    this.width=rect.width; this.height=rect.height;
    const ratio=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.round(rect.width*ratio); this.canvas.height=Math.round(rect.height*ratio);
    this.context?.setTransform(ratio,0,0,ratio,0,0);
    this.draw(document.body.classList.contains('reduced-motion'));
  }
  private sync() {
    if (!this.context) return;
    const s=this.state;
    this.root.querySelector('#game-level')!.textContent=s.tier.name;
    const progress=this.root.querySelector('#game-progress')!;
    const value=objective(s)+(s.phase==='running' && s.config.kind!=='survive' ? ` · ${formatTime(Math.round(s.elapsed*1000))}` : ''); if(progress.textContent!==value) progress.textContent=value;
    this.root.querySelector('.galaxy-location')!.textContent=`COORDENADAS ${Math.round(s.ship.x)} / ${Math.round(s.ship.y)} · SETOR 2.600 × 1.800`;
    const boost=this.root.querySelector('#warp-status')!;
    boost.textContent=s.boost?'VELOCIDADE DA LUZ · ×4':'PROPULSÃO PRONTA · ×4';
    boost.classList.toggle('active',s.boost);
    this.root.classList.toggle('warping',s.boost);
    const pause=this.root.querySelector<HTMLButtonElement>('#game-pause')!;
    pause.disabled=!['running','paused'].includes(s.phase); pause.setAttribute('aria-label',s.phase==='paused'?'Continuar minigame':'Pausar minigame'); pause.textContent=s.phase==='paused'?'▷':'Ⅱ';
    if(this.displayedPhase===s.phase) return;
    this.displayedPhase=s.phase;
    const overlay=this.root.querySelector<HTMLElement>('.game-overlay')!;
    overlay.hidden=s.phase==='running';
    if(s.phase==='running') return;
    const won=s.phase==='won', ended=won||s.phase==='lost', paused=s.phase==='paused';
    const result=resultFor(s);
    const levels=s.phase==='ready'?`<fieldset class="difficulty-picker"><legend>Escolha seu nível</legend>${Object.entries(difficulties).map(([key,tier])=>`<label><input type="radio" name="difficulty" value="${key}" ${key===s.difficulty?'checked':''}/><span>${tier.name}</span></label>`).join('')}</fieldset><p class="difficulty-detail">${s.tier.summary}</p>`:'';
    overlay.innerHTML=`<div class="game-brief"><span class="eyebrow">${won?'✦ EXPLORAÇÃO CONCLUÍDA':paused?'VOO PAUSADO':s.phase==='lost'?'NOVA TENTATIVA':'SEU PRÓXIMO DESAFIO'} / ${s.tier.name.toLocaleUpperCase('pt-BR')}</span><h4>${won?'Missão cumprida.':paused?'Seu universo pode esperar.':s.phase==='lost'?(s.shields===0?'Escudos esgotados.':'O tempo acabou.') :s.config.name}</h4><p>${won?`Seu resultado: ${formatTime(result.timeMs)}${result.penaltyMs?` (inclui ${formatTime(result.penaltyMs)} por impactos)`:''}. Estações & currículo já está liberado.`:paused?'O tempo e os objetos ficam parados até você continuar.':s.config.instructions}</p>${levels}<div class="game-end-actions">${won?'<button class="button button-primary" id="game-register">Salvar no ranking ↗</button><button class="button button-secondary" id="game-content">Estações & currículo ↗</button>':`<button class="button button-primary" id="${ended?'game-again':'game-start'}">${ended?'Tentar novamente ↺':paused?'Continuar voo ↗':'Iniciar minigame ↗'}</button>`}</div>${won?'<button class="text-button" id="game-again">Escolher nível e jogar de novo ↺</button>':''}${s.config.kind==='mirror'&&s.tier.hints?'<p class="mirror-tip">Dica: a linha pontilhada indica o caminho. O feixe contínuo mostra até onde a energia chega.</p>':''}</div>`;
  }
  private draw(reduced: boolean) {
    const c=this.context; if(!c||this.width<2||this.height<2)return;
    const s=this.state, color=s.config.color, w=this.width, h=this.height;
    const zoom=w<600?.7:.78;
    const cx=Math.max(w/zoom/2,Math.min(WORLD.width-w/zoom/2,s.ship.x));
    const cy=Math.max(h/zoom/2,Math.min(WORLD.height-h/zoom/2,s.ship.y));
    const screen=(x:number,y:number)=>({x:(x-cx)*zoom+w/2,y:(y-cy)*zoom+h/2});
    c.clearRect(0,0,w,h); c.fillStyle='#06101c'; c.fillRect(0,0,w,h);
    const fog=c.createRadialGradient(w*.55,h*.5,0,w*.55,h*.5,w*.7); fog.addColorStop(0,color+'19'); fog.addColorStop(1,color+'00'); c.fillStyle=fog; c.fillRect(0,0,w,h);
    c.save(); c.translate(w/2-cx*zoom,h/2-cy*zoom); c.scale(zoom,zoom);
    // Each world has its own large landmark and orbit pattern behind the playfield.
    const worldIndex=Object.keys(games).indexOf(s.id);
    const px=1300+(worldIndex%2?330:-330), py=900+(worldIndex%3-1)*260, pr=worldIndex===1?250:180;
    c.save(); c.translate(px,py); c.rotate(-.35);
    const globe=c.createRadialGradient(-pr*.35,-pr*.4,10,0,0,pr); globe.addColorStop(0,color+'38'); globe.addColorStop(.6,color+'13'); globe.addColorStop(1,'#06101c'); c.fillStyle=globe; c.beginPath(); c.arc(0,0,pr,0,Math.PI*2); c.fill();
    c.strokeStyle=color+'25'; c.lineWidth=2;
    if(worldIndex===1||worldIndex===2)for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,pr+45+i*14,pr*.35+i*9,0,0,Math.PI*2);c.stroke();}
    if(worldIndex===0){c.fillStyle=color+'12';for(let i=0;i<5;i++){c.beginPath();c.ellipse(-60+i*25,-70+i*22,60,20,i,0,Math.PI*2);c.fill();}}
    if(worldIndex===3){c.strokeStyle=color+'35';for(let i=0;i<4;i++){c.strokeRect(-230-i*25,-200-i*25,460+i*50,400+i*50);}}
    if(worldIndex===4){c.fillStyle='#11192577';for(let i=0;i<6;i++){c.beginPath();c.arc(Math.cos(i*2)*110,Math.sin(i*2)*110,15+i*2,0,Math.PI*2);c.fill();}}
    if(worldIndex===5){c.fillStyle=color+'22';c.beginPath();c.arc(-240,-110,55,0,Math.PI*2);c.fill();c.beginPath();c.arc(200,160,32,0,Math.PI*2);c.fill();} c.restore();
    for(const star of this.stars){c.fillStyle=color+(star.r>1?'99':'55');c.beginPath();c.arc(star.x,star.y,star.r,0,Math.PI*2);c.fill();}
    c.strokeStyle=color+'08';c.lineWidth=1;c.beginPath();for(let x=0;x<=2600;x+=200){c.moveTo(x,0);c.lineTo(x,1800);}for(let y=0;y<=1800;y+=200){c.moveTo(0,y);c.lineTo(2600,y);}c.stroke();
    c.strokeStyle=color+'77';c.setLineDash([12,15]);c.strokeRect(20,20,2560,1760);c.setLineDash([]);
    if(s.config.kind==='mirror') this.drawMirrors(c,color);
    if(s.config.kind==='rescue') {c.save();c.translate(1300,900);c.fillStyle=color+'15';c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(0,0,90,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([6,9]);c.beginPath();c.arc(0,0,115,0,Math.PI*2);c.stroke();c.setLineDash([]);c.font='14px monospace';c.textAlign='center';c.fillStyle=color;c.fillText('BASE DE RESGATE',0,140);c.fillRect(-15,-3,30,6);c.fillRect(-3,-15,6,30);c.restore();}
    for(const item of s.items){
      if(item.done||s.carrying===item.index)continue;
      c.save();c.translate(item.x,item.y);c.strokeStyle=color;c.fillStyle=color+'22';c.lineWidth=2;
      const kind=s.config.kind;
      if(kind==='collect'){c.shadowColor=color;c.shadowBlur=18;c.beginPath();c.moveTo(0,-25);c.lineTo(17,0);c.lineTo(0,25);c.lineTo(-17,0);c.closePath();c.fill();c.stroke();c.shadowBlur=0;c.beginPath();c.moveTo(0,-25);c.lineTo(0,25);c.stroke();}
      if(kind==='race'){const active=item.index===s.score;c.globalAlpha=active?1:.28;c.lineWidth=active?5:2;c.beginPath();c.arc(0,0,62,0,Math.PI*2);c.stroke();c.lineWidth=1;c.beginPath();c.arc(0,0,74,0,Math.PI*2);c.stroke();c.fillStyle=color;c.font='26px monospace';c.textAlign='center';c.fillText(String(item.index+1),0,9);}
      if(kind==='mirror'){c.strokeStyle=item.on?color:'#839db1';c.fillStyle=item.on?color+'22':'#142534';c.beginPath();c.arc(0,0,38,0,Math.PI*2);c.fill();c.stroke();c.save();c.rotate([-.7854,Math.PI/2,.7854,0][item.orientation]);c.lineWidth=6;c.strokeStyle='#e0f2ff';c.beginPath();c.moveTo(-27,0);c.lineTo(27,0);c.stroke();c.restore();c.fillStyle=color;c.textAlign='center';c.font='13px monospace';c.fillText(`ESPELHO ${item.index+1}`,0,59);}
      if(kind==='rescue'){c.fillRect(-17,-27,34,54);c.strokeRect(-17,-27,34,54);c.fillStyle=color;c.fillRect(-8,-17,16,13);c.beginPath();c.arc(0,0,46,0,Math.PI*2);c.setLineDash([4,7]);c.stroke();}
      if(kind==='shoot'){c.fillRect(-30,-7,60,14);c.strokeRect(-30,-7,60,14);c.beginPath();c.arc(0,0,23,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='#eeb58c';c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.stroke();}
      c.restore();
    }
    if(s.config.kind==='survive')for(const rock of s.hazards){c.save();c.translate(rock.x,rock.y);c.rotate(reduced?rock.index:rock.index+s.elapsed*.15);c.fillStyle='#45404f';c.strokeStyle='#bc9fab';c.lineWidth=1.5;c.beginPath();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,r=rock.r*(i%3===0?.75:1);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();c.fillStyle='#282c3b';c.beginPath();c.arc(-rock.r*.2,-rock.r*.1,rock.r*.24,0,Math.PI*2);c.fill();c.restore();}
    for(const bullet of s.bullets){c.strokeStyle='#f4deb0';c.lineWidth=4;c.beginPath();c.moveTo(bullet.x,bullet.y);c.lineTo(bullet.x-bullet.vx*.022,bullet.y-bullet.vy*.022);c.stroke();}
    if(!reduced&&s.trail.length>1){c.strokeStyle=s.boost?'#c4f6ff80':color+'30';c.lineWidth=s.boost?9:3;c.beginPath();s.trail.forEach((p:{x:number;y:number},i:number)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}
    c.save();c.translate(s.ship.x,s.ship.y);
    if(s.invulnerable>0){c.strokeStyle='#f1bb86';c.lineWidth=3;c.beginPath();c.arc(0,0,40,0,Math.PI*2);c.stroke();}
    c.rotate(s.ship.angle);
    if(s.phase==='running'){c.fillStyle=s.boost?'#e2fcff':'#9ce1d5';c.beginPath();c.moveTo(-6,19);c.lineTo(0,s.boost?92:38);c.lineTo(6,19);c.fill();}
    c.shadowColor=s.boost?'#c6f9ff':color;c.shadowBlur=reduced?0:s.boost?28:12;c.fillStyle='#d8e7e7';c.strokeStyle='#b6e8d8';c.lineWidth=1.4;c.beginPath();c.moveTo(0,-25);c.lineTo(11,5);c.lineTo(23,22);c.lineTo(8,17);c.lineTo(0,22);c.lineTo(-8,17);c.lineTo(-23,22);c.lineTo(-11,5);c.closePath();c.fill();c.stroke();c.shadowBlur=0;c.fillStyle='#326d80';c.beginPath();c.moveTo(0,-15);c.lineTo(5,5);c.lineTo(0,10);c.lineTo(-5,5);c.fill();
    if(s.carrying>=0){c.strokeStyle='#dfac88';c.strokeRect(-10,45,20,25);c.beginPath();c.moveTo(0,24);c.lineTo(0,45);c.stroke();}c.restore();c.restore();
    const target=nextTarget(s);
    if(target&&s.phase==='running'){
      const p=screen(target.x,target.y);
      if(p.x<40||p.y<40||p.x>w-40||p.y>h-40){const dx=p.x-w/2,dy=p.y-h/2;const f=Math.min((w/2-35)/Math.max(1,Math.abs(dx)),(h/2-50)/Math.max(1,Math.abs(dy)));c.save();c.translate(w/2+dx*f,h/2+dy*f);c.rotate(Math.atan2(dy,dx));c.fillStyle=color;c.beginPath();c.moveTo(13,0);c.lineTo(-7,-7);c.lineTo(-7,7);c.fill();c.restore();}
      if(s.config.kind==='mirror'&&Math.hypot(target.x-s.ship.x,target.y-s.ship.y)<120){c.fillStyle='#0b1729ee';c.fillRect(w/2-106,h/2+40,212,30);c.fillStyle=color;c.font='12px monospace';c.textAlign='center';c.fillText(`E · GIRAR ESPELHO ${target.index+1}`,w/2,h/2+60);}
    }
    this.drawRadar(c,w,color);
    if(s.boost&&!reduced){c.strokeStyle='#c4f6ff32';c.lineWidth=1;c.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=Math.min(w,h)*.46;c.moveTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r);c.lineTo(w/2+Math.cos(a)*(r+45),h/2+Math.sin(a)*(r+45));}c.stroke();}
  }
  private drawMirrors(c: CanvasRenderingContext2D,color:string) {
    const s=this.state;
    if(s.tier.hints){c.strokeStyle=color+'35';c.lineWidth=2;c.setLineDash([8,10]);c.beginPath();s.mirror.path.forEach((p:{x:number;y:number},i:number)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.setLineDash([]);}
    c.strokeStyle='#d6f9ff';c.shadowColor=color;c.shadowBlur=12;c.lineWidth=4;c.beginPath();s.beam.points.forEach((p:{x:number;y:number},i:number)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.shadowBlur=0;
    for(const [point,label] of [[s.mirror.source,'REATOR'],[s.mirror.receiver,'SATÉLITE']] as const){c.save();c.translate(point.x,point.y);c.strokeStyle=color;c.fillStyle=label==='SATÉLITE'&&s.beam.connected?color:'#12334b';c.lineWidth=2;c.fillRect(-30,-25,60,50);c.strokeRect(-30,-25,60,50);c.fillStyle=color;c.textAlign='center';c.font='13px monospace';c.fillText(label,0,-40);c.restore();}
  }
  private drawRadar(c: CanvasRenderingContext2D, width:number, color:string) {
    const s=this.state, rw=width<600?100:138, rh=rw*1800/2600, x=width-rw-16,y=18;
    c.fillStyle='#05101cdd';c.fillRect(x-6,y-6,rw+12,rh+30);c.strokeStyle=color+'44';c.strokeRect(x,y,rw,rh);
    const point=(px:number,py:number)=>({x:x+px/2600*rw,y:y+py/1800*rh});
    for(const item of s.items){if(item.done||s.carrying===item.index)continue;const p=point(item.x,item.y);c.fillStyle=s.config.kind==='mirror'&&!item.on?'#647687':color;c.beginPath();c.arc(p.x,p.y,s.config.kind==='race'&&item.index===s.score?4:2.5,0,Math.PI*2);c.fill();}
    if(s.config.kind==='survive')for(const rock of s.hazards){const p=point(rock.x,rock.y);c.fillStyle='#c392a0';c.fillRect(p.x-1,p.y-1,2,2);}
    if(s.config.kind==='mirror'){const p=point(s.mirror.receiver.x,s.mirror.receiver.y);c.strokeStyle=color;c.strokeRect(p.x-4,p.y-4,8,8);}
    if(s.config.kind==='rescue'){const p=point(1300,900);c.strokeStyle=color;c.strokeRect(p.x-4,p.y-4,8,8);}
    const p=point(s.ship.x,s.ship.y);c.fillStyle='#fff';c.beginPath();c.arc(p.x,p.y,3,0,Math.PI*2);c.fill();c.font='8px monospace';c.textAlign='left';c.fillStyle=color;c.fillText('RADAR / VOCÊ: ●',x,y+rh+15);
  }
}

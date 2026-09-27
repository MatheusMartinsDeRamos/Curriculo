import './styles.css';
import profile from './content/profile.json';
import { GalaxyView } from './galaxy-view';
import { planets, type Planet } from './content/planets';
import { advancePosition, directionVector, nearestPlanet, buildJourney, missionOptions } from './flight.mjs';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const tags = (items: string[]) => `<div class="tags">${items.map(item => `<span class="tag">${escape(item)}</span>`).join('')}</div>`;
const external = (url: string, title: string, className = 'button button-secondary') => `<a class="${className}" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${title} <span aria-hidden="true">↗</span></a>`;
const planetDialog = $<HTMLDialogElement>('#planet-dialog');
const mapDialog = $<HTMLDialogElement>('#map-dialog');
const tutorial = $<HTMLDialogElement>('#tutorial-dialog');
const settings = $<HTMLDialogElement>('#settings-dialog');
const ship = $('#ship');
const universe = $('#universe');
const keys = new Set<string>();
const motionMedia = matchMedia('(prefers-reduced-motion: reduce)');
const touchMedia = matchMedia('(pointer: coarse), (max-width: 760px)');
let flying = false;
let activePlanet: Planet | null = null;
let activeStation = 0;
let shipPosition = { x: 48, y: 52 };
let galaxy: GalaxyView | null = null;
let worldView: 'game' | 'content' = 'game';
let shipAngle = 32;
let velocity = { x: 0, y: 0 };
let closest: Planet | null = null;
let audioContext: AudioContext | null = null;
let sound = false;
let volume = 0.25;
let reducedMotion = motionMedia.matches;
let motionOverridden = false;
let frame: number | null = null;
let lastTime = 0;
let missionStep = 0;
let missionComplete = false;
const missionSelection: Record<string, string> = {};
let worldSize = { width: 1, height: 1 };
let flightPlanets: (Planet & { x: number; y: number })[] = [];

function readPreference(key: string) { try { return localStorage.getItem(`orbita-${key}`); } catch { return null; } }
function savePreference(key: string, value: string) { try { localStorage.setItem(`orbita-${key}`, value); } catch { /* Storage is optional. */ } }
const savedMotion = readPreference('motion');
if (savedMotion !== null) { reducedMotion = savedMotion === 'reduced'; motionOverridden = true; }
const savedVolume = Number(readPreference('volume') ?? 25);
volume = Number.isFinite(savedVolume) ? Math.min(100, Math.max(0, savedVolume)) / 100 : .25;
document.body.classList.toggle('reduced-motion', reducedMotion);
$<HTMLInputElement>('#motion-toggle').checked = reducedMotion;
$<HTMLInputElement>('#sound-volume').value = String(volume * 100);
$('#year').textContent = String(new Date().getFullYear());

function tone(kind: 'land' | 'select' | 'launch' = 'select') {
  if (!sound || volume === 0) return;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(kind === 'launch' ? 220 : 530, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'land' ? 260 : 880, now + .18);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * .12, now + .02);
    gain.gain.exponentialRampToValueAtTime(.001, now + .25);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + .3);
  } catch { sound = false; $<HTMLInputElement>('#sound-toggle').checked = false; }
}

function clearControls() { keys.clear(); velocity = { x: 0, y: 0 }; ship.classList.remove('moving', 'boosting'); universe.classList.remove('warping'); }
function announce(message: string) { $('#announcement').textContent = message; }
function syncTouchControls() {
  $('#touch-controls').hidden = !touchMedia.matches || !flying || !!document.querySelector('dialog[open]');
}
function syncScrollLock() {
  document.body.style.overflow = document.querySelector('dialog[open]') ? 'hidden' : '';
  syncTouchControls();
  ensureFrame();
}
function showDialog(dialog: HTMLDialogElement) {
  clearControls();
  if (dialog !== planetDialog) galaxy?.pause();
  if (!dialog.open) dialog.showModal();
  syncScrollLock();
}
function openMap() {
  tone();
  if (tutorial.open) tutorial.close();
  if (settings.open) settings.close();
  if (planetDialog.open) closePlanet();
  showDialog(mapDialog);
}
function travel(id: string) {
  if (mapDialog.open) mapDialog.close();
  if (location.hash.slice(1).split('/')[0] === id) openPlanet(id);
  else location.hash = id;
}

// Direct links keep the professional content accessible alongside the optional Canvas games.
$('#planet-nodes').innerHTML = planets.map((planet, index) => `<button class="planet-node" data-planet="${planet.id}" data-travel="${planet.id}" style="--x:${planet.x}%;--y:${planet.y}%;--size:${planet.size}px;--color:${planet.color}" aria-label="Explorar planeta ${planet.name}: ${planet.description}"><span class="planet-visual" aria-hidden="true"></span><span class="planet-label"><small>0${index + 1}</small>${planet.name}</span><span class="planet-subtitle">${planet.region}</span></button>`).join('');
$('#destination-list').innerHTML = planets.map((planet, index) => `<a class="destination-card" href="#${planet.id}" style="--color:${planet.color}"><span class="destination-mark" aria-hidden="true">0${index + 1}</span><div><h3>${planet.name}</h3><p>${planet.description}</p></div><span class="destination-arrow" aria-hidden="true">↗</span></a>`).join('');
$('#map-destinations').innerHTML = planets.map((planet, index) => `<button class="map-destination" data-travel="${planet.id}" style="--color:${planet.color}"><span class="planet-visual" aria-hidden="true" style="--color:${planet.color}"></span><div><small>0${index + 1} / ${planet.region}</small><h3>${planet.name}</h3><p>${planet.description}</p></div></button>`).join('');
let seed = 4521;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
$('#starfield').innerHTML = Array.from({ length: 115 }, (_, index) => `<span class="star${index % 24 === 0 ? ' cross' : ''}" style="left:${random() * 100}%;top:${random() * 100}%;width:${random() * 1.8 + .4}px;height:${random() * 1.8 + .4}px;--opacity:${random() * .6 + .15};--duration:${random() * 5 + 3}s;--delay:-${random() * 10}s"></span>`).join('');

function startFlying() {
  tutorial.close();
  flying = true;
  document.body.classList.add('flying');
  $('.pilot-hud').hidden = false;
  $('.flight-controls').hidden = false;
  clearControls();
  syncTouchControls();
  measureWorld();
  ensureFrame();
  tone('launch');
  $('#land-button').focus({ preventScroll: true });
  $('#exit-flight').focus({ preventScroll: true });
  $('.flight-deck').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  announce('Pilotagem ativada. Use WASD ou as setas e Shift para velocidade da luz. Pressione E perto de um planeta para pousar.');
}
function endFlying() {
  flying = false;
  document.body.classList.remove('flying');
  $('.pilot-hud').hidden = true;
  $('.flight-controls').hidden = true;
  clearControls();
  closest = null;
  $$('.planet-node').forEach(node => node.classList.remove('in-range'));
  shipPosition = { x: 48, y: 52 }; shipAngle = 32;
  positionShip(); syncTouchControls();
  $('#pilot-button').focus({ preventScroll: true });
  announce('Voo encerrado. Todos os planetas continuam disponíveis pelo mapa e pelo menu.');
}

function setWorldView(view: 'game' | 'content') {
  worldView = view;
  clearControls();
  if (view === 'content') galaxy?.pause();
  $('#galaxy-game').hidden = view !== 'game';
  $('#world-content').hidden = view !== 'content';
  $('#world-game-tab').setAttribute('aria-pressed', String(view === 'game'));
  $('#world-content-tab').setAttribute('aria-pressed', String(view === 'content'));
  ensureFrame();
}
function openPlanet(id: string, station?: number) {
  const planet = planets.find(item => item.id === id);
  if (!planet) return;
  if (mapDialog.open) mapDialog.close();
  if (tutorial.open) tutorial.close();
  if (settings.open) settings.close();
  galaxy?.destroy(); galaxy = null;
  clearControls(); activePlanet = planet; activeStation = station ?? 0;
  const index = planets.indexOf(planet);
  planetDialog.style.setProperty('--planet-color', planet.color);
  planetDialog.innerHTML = `<div class="dialog-topline"><span class="eyebrow"><span class="status-dot" style="background:${planet.color}"></span> PLANETA ${planet.name.toLocaleUpperCase('pt-BR')} / ${planet.region}</span><button class="text-button" id="takeoff-button">Decolar <span aria-hidden="true">↗</span></button></div><header class="planet-heading"><div><p class="eyebrow">${planet.kicker}</p><h2 id="planet-title">${planet.headline}</h2></div><span class="planet-index" aria-hidden="true">0${index + 1}</span></header><nav class="world-tabs" aria-label="Explorar planeta"><button id="world-game-tab" aria-pressed="true" aria-controls="galaxy-game">✦ Explorar galáxia</button><button id="world-content-tab" aria-pressed="false" aria-controls="world-content">Estações & currículo</button><button id="surface-map" class="world-map">Mapa ↗</button></nav><section id="galaxy-game" aria-label="Minigame de ${planet.name}"></section><div id="world-content" class="world-content" hidden><nav class="surface-tabs" aria-label="Estações de ${planet.name}">${planet.stations.map((name, i) => `<button data-station="${i}" aria-pressed="${i === activeStation}">${name}</button>`).join('')}</nav><section class="station-content" id="station-content" tabindex="-1" aria-label="Conteúdo da estação"></section></div>`;
  galaxy = new GalaxyView($('#galaxy-game'), planet.id, message => { announce(message); tone(); }, clearControls);
  renderStation(activeStation);
  setWorldView(station === undefined ? 'game' : 'content');
  showDialog(planetDialog);
  planetDialog.scrollTop = 0;
  tone('land');
  ensureFrame();
}
function closePlanet() {
  if (!planetDialog.open) return;
  galaxy?.destroy(); galaxy = null;
  planetDialog.close();
  activePlanet = null;
  if (planets.some(planet => location.hash.startsWith(`#${planet.id}`))) history.replaceState(null, '', location.pathname + location.search);
  clearControls(); syncScrollLock();
  if (flying) tone('launch');
}
function experienceEntries(start: number, end: number) {
  return profile.experience.slice(start, end).map(job => `<article class="timeline-item"><span class="period">${job.period}</span><h4>${job.company}</h4><p class="role">${job.role}</p>${job.details.length ? `<ul>${job.details.map(detail => `<li>${escape(detail)}</li>`).join('')}</ul>` : ''}</article>`).join('');
}
function project(index: number) {
  const item = profile.projects[index];
  return `<p class="eyebrow">${item.company.toUpperCase()} / CASE REAL</p><h3>${item.title}</h3>${index === 0 ? '<div class="project-metric"><strong>~75%</strong><span>menos tempo na execução de campanhas,<br />principalmente pontuais.</span></div>' : ''}${[['Contexto', item.context], ['Desafio', item.challenge], ['Minha ação', item.action], ['Resultado', item.result]].map(([title, text]) => `<div class="project-detail"><h4>${title}</h4><p>${escape(text)}</p></div>`).join('')}${tags(item.tags)}<p class="mission-note">Relato profissional de Matheus, conforme currículo de setembro de 2026.</p>${index === 0 ? '<button class="button button-secondary" data-station="1">Experimente a missão de CRM ↗</button>' : ''}`;
}
function stationContent(planet: Planet, station: number): string {
  switch (planet.id) {
    case 'identidade': return [
      `<p class="eyebrow">OLÁ, SOU MATHEUS</p><h3>Entre o negócio<br />e a próxima solução.</h3><p class="lead">${profile.title}</p><p>${profile.summary}</p><p>Hoje atuo como Salesforce Specialist e Tech Lead na Overlabs, em um projeto de alcance latino-americano.</p>${tags(['CRM', 'Martech', 'Salesforce', 'Liderança técnica'])}<button class="button button-secondary" data-travel="trajetoria">Conheça minha trajetória ↗</button>`,
      `<p class="eyebrow">COMO EU TRABALHO</p><h3>Entender. Conectar. Construir.</h3><h4>01 / Ouvir o negócio</h4><p>Entender a necessidade por trás de cada pedido e traduzi-la em requisitos técnicos claros, em contato direto com o cliente.</p><h4>02 / Conectar as peças</h4><p>Combinar dados, plataformas e estratégia para desenvolver jornadas, automações e integrações.</p><h4>03 / Dar autonomia</h4><p>Criar soluções reutilizáveis e compartilhar conhecimento para facilitar o trabalho de quem opera. O construtor de e-mails da Worten é um exemplo dessa abordagem.</p><button class="button button-secondary" data-travel="jornadas">Explore os projetos ↗</button>`,
      `<p class="eyebrow">APRENDIZADO CONTÍNUO</p><h3>Uma base para seguir explorando.</h3>${profile.education.map(item => `<article class="qualification"><h4>${item.title}</h4><p>${item.institution} · ${item.location}</p><small>${item.period}</small>${item.description ? `<p>${item.description}</p>` : ''}</article>`).join('')}<h4>Idiomas</h4>${profile.languages.map(item => `<p><strong>${item.name}</strong><br />${item.level}</p>`).join('')}`,
    ][station];
    case 'trajetoria': return `<p class="eyebrow">${['TECNOLOGIA & LIDERANÇA', 'ESTRATÉGIA & CAMPANHAS', 'IMPLEMENTAÇÃO & QUALIDADE'][station]}</p><h3>${['Do CRM à liderança técnica.', 'O encontro com as jornadas.', 'Os primeiros sinais.'][station]}</h3>${[experienceEntries(0,3),experienceEntries(3,6),experienceEntries(6,11)][station]}<a class="button button-secondary" href="./curriculo.html">Ver currículo completo ↗</a>`;
    case 'jornadas': return station === 0 ? project(0) : missionHTML();
    case 'sistemas': return [
      `<p class="eyebrow">PLATAFORMAS CONECTADAS</p><h3>Um ecossistema.<br />Muitas possibilidades.</h3><p>Liderança hands-on do ecossistema Salesforce na Overlabs, conectando as necessidades do cliente às soluções técnicas.</p>${tags(profile.skills[0].items)}<h4>Da estratégia à operação</h4><p>Experiência com jornadas, automações, Content Builder e Data Extensions. Na Pmweb, atuei também com campanhas em Oracle Responsys.</p><button class="button button-secondary" data-travel="jornadas">Ver tecnologia em ação ↗</button>`,
      `<p class="eyebrow">CONSTRUIR, INTEGRAR, ANALISAR</p><h3>Código a serviço<br />da experiência.</h3>${profile.skills.slice(1).map(item => `<h4>${item.title}</h4>${tags(item.items)}`).join('')}<p>SQL, SSJS e AMPscript aplicados em automações de crédito na Stone. HTML e componentes dinâmicos aplicados à construção de e-mails reutilizáveis na Worten.</p>`,
      `<p class="eyebrow">CONHECIMENTO E PRÁTICA</p><h3>Certificações Salesforce.</h3>${profile.certifications.map((item, index) => `<article class="qualification"><small>0${index + 1} / SALESFORCE</small><h4>${item}</h4></article>`).join('')}<p style="margin-top:20px">Certificações declaradas no currículo de setembro de 2026.</p>${external(profile.contact.linkedin, 'Ver perfil no LinkedIn')}`,
    ][station];
    case 'mentoria': return [
      `<p class="eyebrow">DESDE JUNHO DE 2024</p><h3>Um começo com mais direção.</h3><p class="lead">Mentoria voluntária para quem está iniciando ou mudando de carreira.</p><p>${profile.mentorship.volunteer}</p><h4>Estudos → entrevistas → primeiros meses</h4><p>A orientação acompanha diferentes momentos da entrada na área de CRM, com espaço para dúvidas e aprendizado.</p><button class="button button-secondary" data-station="2">Vamos conversar sobre seu momento ↗</button>`,
      `<p class="eyebrow">TREINAMENTO PARA EMPRESAS</p><h3>Conhecimento que circula no time.</h3><p>${profile.mentorship.companies}</p>${tags(['Salesforce Marketing Cloud', 'HTML & CSS', 'Programação', 'Treinamento técnico'])}<button class="button button-secondary" data-travel="conexao">Conversar sobre um projeto ↗</button>`,
      `<p class="eyebrow">PRIMEIRO CONTATO</p><h3>Qual é o seu próximo passo?</h3><p>Conte um pouco sobre seu momento: início de carreira, transição para CRM ou um desafio de capacitação da equipe.</p><p>A partir dessa conversa, podemos entender como a orientação faz sentido para você.</p>${external(profile.contact.linkedin, 'Conversar pelo LinkedIn')}<a class="button button-primary" href="mailto:${profile.contact.email}?subject=Conversa%20sobre%20mentoria%20em%20CRM">Enviar um e-mail ↗</a>`,
    ][station];
    case 'conexao': return [
      `<p class="eyebrow">CANAL ABERTO</p><h3>Vamos conectar ideias.</h3><p>Uma oportunidade em Martech ou CRM, um desafio técnico, uma conversa sobre mentoria. Escolha o melhor canal.</p><a class="contact-link" href="mailto:${profile.contact.email}"><div><small>E-MAIL</small><strong>${profile.contact.email}</strong></div><span aria-hidden="true">↗</span></a><a class="contact-link" href="${profile.contact.whatsapp}" target="_blank" rel="noopener noreferrer"><div><small>WHATSAPP</small><strong>${profile.contact.phone}</strong></div><span aria-hidden="true">↗</span></a><button class="button button-secondary" id="copy-email">Copiar e-mail <span aria-hidden="true">⧉</span></button><p id="copy-feedback" class="copy-feedback" role="status"></p>`,
      `<p class="eyebrow">CONTINUE A CONEXÃO</p><h3>Nos encontramos no LinkedIn.</h3><p>Acompanhe minha trajetória profissional ou envie uma mensagem para iniciar uma conversa.</p>${external(profile.contact.linkedin, 'Abrir LinkedIn', 'button button-primary')}<p class="mission-note">linkedin.com/in/matheusramoscrm</p>`,
      `<p class="eyebrow">PARA LEVAR COM VOCÊ</p><h3>A trajetória completa,<br />em um só lugar.</h3><p>Experiências, formação, tecnologias, certificações e canais de contato. Versão do currículo: setembro de 2026.</p><a class="button button-primary" href="./curriculo.pdf" download="Matheus-Martins-de-Ramos-Curriculo.pdf">Baixar currículo PDF ↓</a><a class="button button-secondary" href="./curriculo.pdf" target="_blank" rel="noopener">Abrir PDF ↗</a><a class="contact-link" href="./curriculo.html"><div><small>VERSÃO EM TEXTO</small><strong>Ler currículo completo</strong></div><span aria-hidden="true">↗</span></a>`,
    ][station];
  }
}
function renderStation(station: number, focus = false) {
  if (!activePlanet || station < 0 || station >= activePlanet.stations.length) return;
  activeStation = station;
  const panel = $('#station-content');
  panel.innerHTML = stationContent(activePlanet, station);
  panel.scrollTop = 0;
  $$<HTMLButtonElement>('[data-station]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.station) === station)));
  if (focus) {
    setWorldView('content');
    panel.focus({ preventScroll: true });
    if (innerWidth <= 650) panel.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
    tone();
    announce(`Estação ${activePlanet.stations[station]}.`);
  }
}

function missionHTML() {
  const labels = ['Público', 'Gatilho', 'Comunicação'];
  if (missionComplete) {
    const journey = buildJourney(missionSelection);
    return `<p class="eyebrow">MISSÃO CONCLUÍDA / SIMULAÇÃO EDUCATIVA</p><h3>Sua jornada está conectada.</h3><div class="journey-diagram" aria-label="Jornada escolhida">${journey.map((item: {title: string}, index: number) => `${index ? '<span class="journey-arrow" aria-hidden="true">↓</span>' : ''}<div class="journey-node"><small>${labels[index].toUpperCase()}</small>${item.title}</div>`).join('')}</div>${journey.map((item: {title: string; detail: string}) => `<h4>${item.title}</h4><p>${item.detail}</p>`).join('')}<p class="mission-note">Esta combinação é um exercício de raciocínio. Em um projeto real, a coerência entre público, evento e mensagem depende do objetivo, dos dados, das permissões e de testes. Não há uma resposta única nem uma previsão de resultado.</p><article class="mission-case"><p class="eyebrow">DA SIMULAÇÃO À PRÁTICA</p><h4>Na Worten, a autonomia virou entrega.</h4><p>Criei cerca de <strong>30 blocos de e-mail reutilizáveis</strong> no Content Builder. A equipe reduziu em aproximadamente <strong>75% o tempo de execução das campanhas</strong>, principalmente pontuais.</p><button class="button button-secondary" data-station="0">Abrir case completo ↗</button></article><button class="text-button" id="restart-mission">Criar outra jornada ↺</button>`;
  }
  const key = ['audience','trigger','action'][missionStep] as keyof typeof missionOptions;
  const questions = ['Quem vai receber a mensagem?', 'O que inicia essa conversa?', 'Qual será o próximo contato?'];
  return `<p class="eyebrow">MISSÃO OPCIONAL / 60–90 SEGUNDOS</p><h3>Desenhe uma jornada de CRM.</h3><div class="mission-brief"><p><strong>Pedido fictício de campanha</strong></p><p>Uma marca quer tornar a relação com seus clientes mais relevante. Monte uma primeira jornada: escolha um público, um gatilho e uma comunicação.</p></div><div class="mission-progress" aria-label="Etapa ${missionStep + 1} de 3">${labels.map((_,index) => `<span class="${index <= missionStep ? 'active' : ''}"></span>`).join('')}<small>0${missionStep + 1} / 03</small></div><form id="mission-form"><fieldset style="border:0;padding:0;margin:0"><legend style="font-size:14px;margin-bottom:16px">${questions[missionStep]}</legend><div class="mission-options">${missionOptions[key].map(option => `<label><input required type="radio" name="${key}" value="${option.value}" ${missionSelection[key] === option.value ? 'checked' : ''}/><span>${option.title}</span></label>`).join('')}</div></fieldset><div class="mission-actions"><button type="button" class="text-button" id="mission-back">${missionStep > 0 ? '← Voltar' : 'Pular missão'}</button><button type="submit" class="button button-primary">${missionStep === 2 ? 'Conectar jornada' : 'Próximo passo'} ↗</button></div></form><p class="mission-note" style="margin-top:20px">Exercício ilustrativo. As escolhas não simulam resultados reais.</p>`;
}

async function copyEmail() {
  const feedback = $('#copy-feedback');
  try {
    await navigator.clipboard.writeText(profile.contact.email);
    feedback.textContent = 'E-mail copiado. Vamos conversar!';
  } catch {
    feedback.textContent = `Copie este endereço: ${profile.contact.email}`;
    const range = document.createRange(); range.selectNodeContents(feedback);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  }
}

document.addEventListener('click', event => {
  const target = event.target as Element;
  const destination = target.closest<HTMLElement>('[data-travel]');
  if (destination) { travel(destination.dataset.travel!); return; }
  const station = target.closest<HTMLElement>('[data-station]');
  if (station) { renderStation(Number(station.dataset.station), true); return; }
  const close = target.closest<HTMLElement>('[data-close]');
  if (close) $<HTMLDialogElement>(`#${close.dataset.close}`).close();
  const button = target.closest('button');
  switch (button?.id) {
    case 'world-game-tab': setWorldView('game'); break;
    case 'world-content-tab': setWorldView('content'); break;
    case 'takeoff-button': closePlanet(); break;
    case 'map-button': case 'mobile-map-button': case 'surface-map': case 'skip-tutorial': openMap(); break;
    case 'pilot-button': showDialog(tutorial); break;
    case 'launch-button': startFlying(); break;
    case 'exit-flight': endFlying(); break;
    case 'land-button': if (closest) travel(closest.id); break;
    case 'copy-email': void copyEmail(); break;
    case 'mission-back': if (missionStep > 0) { missionStep--; renderStation(1, true); } else renderStation(0, true); break;
    case 'restart-mission': missionStep = 0; missionComplete = false; Object.keys(missionSelection).forEach(key => delete missionSelection[key]); renderStation(1, true); break;
  }
  if (target.closest('.settings-button')) showDialog(settings);
});
document.addEventListener('change', event => {
  const input = event.target as HTMLInputElement;
  if (input.closest('#mission-form')) missionSelection[input.name] = input.value;
  if (input.id === 'sound-toggle') { sound = input.checked; tone(); }
  if (input.id === 'motion-toggle') {
    reducedMotion = input.checked; motionOverridden = true;
    document.body.classList.toggle('reduced-motion', reducedMotion);
    savePreference('motion', reducedMotion ? 'reduced' : 'full');
  }
});
$('#sound-volume').addEventListener('input', event => { volume = Number((event.target as HTMLInputElement).value) / 100; savePreference('volume', String(volume * 100)); });
document.addEventListener('submit', event => {
  const form = event.target as HTMLFormElement;
  if (form.id !== 'mission-form') return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  for (const [key, value] of new FormData(form)) missionSelection[key] = String(value);
  if (missionStep === 2) missionComplete = true; else missionStep++;
  renderStation(1, true);
});

function hashRoute() {
  const [id, detail] = location.hash.slice(1).split('/');
  if (planets.some(planet => planet.id === id)) {
    const station = id === 'jornadas' ? ({ worten: 0, missao: 1 }[detail]) : undefined;
    if (id === 'jornadas' && detail === 'stone') history.replaceState(null, '', '#jornadas');
    openPlanet(id, station);
  } else if (planetDialog.open) { closePlanet(); }
}
window.addEventListener('hashchange', hashRoute);
planetDialog.addEventListener('cancel', event => { event.preventDefault(); closePlanet(); });
for (const dialog of $$<HTMLDialogElement>('dialog')) {
  dialog.addEventListener('close', () => { clearControls(); syncScrollLock(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      if (dialog === planetDialog) closePlanet(); else dialog.close();
    }
  });
}
const directionKey: Record<string, string> = { up: 'w', left: 'a', down: 's', right: 'd' };
document.addEventListener('pointerdown', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-direction], [data-flight-key]');
  if (!button) return;
  event.preventDefault();
  button.setPointerCapture(event.pointerId);
  keys.add(button.dataset.flightKey === 'space' ? ' ' : button.dataset.flightKey ?? directionKey[button.dataset.direction!]);
  ensureFrame();
});
for (const name of ['pointerup','pointercancel','lostpointercapture']) document.addEventListener(name, event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-direction], [data-flight-key]');
  if (button) keys.delete(button.dataset.flightKey === 'space' ? ' ' : button.dataset.flightKey ?? directionKey[button.dataset.direction!]);
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement).matches('input,select,textarea,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (key === 'm' && !event.repeat) { event.preventDefault(); if (mapDialog.open) mapDialog.close(); else openMap(); return; }
  if (settings.open || tutorial.open || mapDialog.open || (!flying && !planetDialog.open) || (planetDialog.open && worldView === 'content')) return;
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)) { event.preventDefault(); keys.add(key); ensureFrame(); }
  if (planetDialog.open && worldView === 'game') {
    if ((key === 'e' || key === ' ') && !(event.target as HTMLElement).matches('button,a,summary')) { event.preventDefault(); keys.add(key); ensureFrame(); }
    if (key === 'p' && !event.repeat) { event.preventDefault(); galaxy?.togglePause(); }
  } else if (key === 'e' && !event.repeat && !planetDialog.open && closest) travel(closest.id);
});
document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { clearControls(); galaxy?.pause(); });
document.addEventListener('visibilitychange', () => { clearControls(); if (document.hidden) galaxy?.pause(); else ensureFrame(); });
motionMedia.addEventListener('change', event => { if (!motionOverridden) { reducedMotion = event.matches; $<HTMLInputElement>('#motion-toggle').checked = reducedMotion; document.body.classList.toggle('reduced-motion', reducedMotion); } });
touchMedia.addEventListener('change', syncTouchControls);

function measureWorld() {
  const bounds = universe.getBoundingClientRect(); worldSize = { width: bounds.width, height: bounds.height };
  flightPlanets = planets.map(planet => {
    const visual = $(`[data-planet="${planet.id}"] .planet-visual`).getBoundingClientRect();
    return { ...planet, x: (visual.x + visual.width / 2 - bounds.x) / bounds.width * 100, y: (visual.y + visual.height / 2 - bounds.y) / bounds.height * 100 };
  });
}
new ResizeObserver(measureWorld).observe(universe);
function positionShip() { ship.style.left = `${shipPosition.x}%`; ship.style.top = `${shipPosition.y}%`; ship.style.transform = `translate(-50%,-50%) rotate(${shipAngle}deg)`; }
function ensureFrame() {
  if (frame !== null || document.hidden || !(flying || planetDialog.open)) return;
  lastTime = performance.now(); frame = requestAnimationFrame(tick);
}
function tick(time: number) {
  frame = null;
  const seconds = Math.min((time - lastTime) / 1000, .05); lastTime = time;
  if (document.hidden || mapDialog.open || tutorial.open || settings.open) return;
  const direction = directionVector(keys);
  if (planetDialog.open && activePlanet) {
    if (worldView === 'game') galaxy?.update(keys, seconds, reducedMotion);
  } else if (flying) {
    const smoothing = reducedMotion ? 1 : Math.min(1, seconds * 9);
    velocity.x += (direction.x - velocity.x) * smoothing; velocity.y += (direction.y - velocity.y) * smoothing;
    const boosting = keys.has('shift') && !!(direction.x || direction.y);
    shipPosition = advancePosition(shipPosition, velocity, seconds, worldSize.width, worldSize.height, (touchMedia.matches ? 150 : 225) * (boosting ? 4 : 1));
    ship.classList.toggle('boosting', boosting); universe.classList.toggle('warping', boosting);
    if (direction.x || direction.y) {
      const desiredAngle = Math.atan2(direction.x, -direction.y) * 180 / Math.PI;
      let turn = (desiredAngle - shipAngle + 540) % 360 - 180;
      if (turn < -180) turn += 360;
      shipAngle += turn * (reducedMotion ? 1 : Math.min(1, seconds * 12));
    }
    ship.classList.toggle('moving', !!(direction.x || direction.y)); positionShip();
    const nextClosest = nearestPlanet(shipPosition, flightPlanets, worldSize.width, worldSize.height, touchMedia.matches ? 76 : 105) as Planet | null;
    if (nextClosest?.id !== closest?.id) {
      closest = nextClosest;
      $$('.planet-node').forEach(node => node.classList.toggle('in-range', node.dataset.planet === closest?.id));
      const land = $<HTMLButtonElement>('#land-button'); land.disabled = !closest;
      land.textContent = closest ? `Pousar em ${closest.name} ↓` : 'Aproxime-se para pousar';
      $('#flight-status').textContent = closest ? `Destino ao alcance: ${closest.name}. Pressione E para pousar.` : 'Aproxime-se de um planeta ou abra o mapa.';
    }
  }
  if (flying || planetDialog.open) frame = requestAnimationFrame(tick);
}

// Expose shareable case URLs, without coupling the data to the flight controls.
document.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-station]');
  if (button && activePlanet?.id === 'jornadas') history.replaceState(null, '', `#jornadas/${['worten','missao'][activeStation]}`);
});
positionShip(); measureWorld(); hashRoute();

import './styles.css';
import profile from './content/profile.json';
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
let roverPosition = { x: 27, y: 79 };
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

function clearControls() { keys.clear(); velocity = { x: 0, y: 0 }; ship.classList.remove('moving'); }
function announce(message: string) { $('#announcement').textContent = message; }
function syncTouchControls() {
  $('#touch-controls').hidden = !touchMedia.matches || !flying || !!document.querySelector('dialog[open]');
  const surfaceTouch = planetDialog.querySelector<HTMLElement>('.touch-controls');
  if (surfaceTouch) surfaceTouch.hidden = !touchMedia.matches;
}
function syncScrollLock() {
  document.body.style.overflow = document.querySelector('dialog[open]') ? 'hidden' : '';
  syncTouchControls();
  ensureFrame();
}
function showDialog(dialog: HTMLDialogElement) {
  clearControls();
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

// All navigation remains ordinary HTML links and buttons; there is no Canvas dependency.
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
  announce('Pilotagem ativada. Use WASD ou as setas. Pressione E perto de um planeta para pousar.');
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

function landscape(planet: Planet) {
  const index = planets.indexOf(planet);
  const peaks = ['0,200 58,143 112,181 169,101 242,187 317,125 408,198 500,157 560,210', '0,165 65,165 65,101 114,101 114,193 212,193 212,148 271,148 271,78 316,78 316,171 410,171 410,121 500,121 560,189', '0,201 80,137 141,204 218,148 276,214 361,133 422,207 502,155 560,189', '0,198 57,149 101,149 147,94 190,163 251,163 304,111 360,194 407,143 461,173 560,174', '0,176 41,138 86,190 151,131 214,192 271,131 334,184 389,143 467,201 513,141 560,192', '0,192 74,159 140,201 218,161 277,208 340,159 398,198 465,151 560,179'][index];
  return `<svg class="landscape" viewBox="0 0 560 420" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ground" x2="0" y2="1"><stop stop-color="${planet.color}" stop-opacity=".12"/><stop offset="1" stop-color="${planet.color}" stop-opacity=".025"/></linearGradient><radialGradient id="sun"><stop stop-color="${planet.color}" stop-opacity=".22"/><stop offset="1" stop-color="${planet.color}" stop-opacity="0"/></radialGradient></defs><circle cx="393" cy="100" r="100" fill="url(#sun)"/><circle cx="393" cy="100" r="28" fill="${planet.color}" opacity=".12"/><ellipse cx="393" cy="100" rx="51" ry="10" fill="none" stroke="${planet.color}" opacity="${index === 2 ? .35 : .1}" transform="rotate(-25 393 100)"/><g fill="${planet.color}" opacity=".45"><circle cx="82" cy="67" r="1"/><circle cx="208" cy="91" r="1.2"/><circle cx="315" cy="34" r="1"/><circle cx="454" cy="45" r="1"/><circle cx="497" cy="134" r="1.2"/><circle cx="155" cy="32" r="1"/></g><polygon points="${peaks} 560,420 0,420" fill="${planet.color}" opacity=".075"/><path d="M0 242Q120 169 245 232T560 230V420H0Z" fill="url(#ground)"/><g stroke="${planet.color}" fill="none" opacity=".09"><path d="M0 279H560M0 333H560M0 403H560M65 420L234 225M206 420L265 225M357 420L305 225M506 420L340 225"/><path stroke-dasharray="3 5" d="M136 238L372 175L410 344L149 348Z"/></g><g fill="${planet.color}" opacity=".18"><path d="M37 325l7-6 13 7-7 4zM307 285l6-4 9 4-4 3zM476 364l9-7 14 7-9 5zM182 404l7-5 11 6-7 4z"/></g></svg>`;
}
function stationArt(index: number, color: string) {
  const structures = [
    `<ellipse cx="45" cy="67" rx="40" ry="10" fill="${color}" opacity=".08"/><path d="M12 58A33 33 0 0 1 78 58V67H12Z" fill="#182d36" stroke="${color}" stroke-opacity=".65"/><path d="M18 53A28 28 0 0 1 72 53" fill="none" stroke="${color}" stroke-opacity=".3"/><path d="M45 25V58M13 58H77M30 31L28 58M60 31L62 58" fill="none" stroke="${color}" stroke-opacity=".25"/><path d="M37 52H53V68H37Z" fill="#09171f" stroke="${color}" stroke-opacity=".5"/><path d="M17 62H27M63 62H73" stroke="${color}"/><path d="M45 24V12" stroke="${color}"/><circle cx="45" cy="10" r="2" fill="${color}"/>`,
    `<ellipse cx="45" cy="68" rx="39" ry="9" fill="${color}" opacity=".08"/><path d="M18 36L48 22L76 36V64L47 76L18 63Z" fill="#18303a" stroke="${color}" stroke-opacity=".65"/><path d="M18 36L47 49L76 36M47 49V76" fill="none" stroke="${color}" stroke-opacity=".45"/><path d="M25 43L39 49V61L25 55Z" fill="${color}" opacity=".4"/><path d="M54 50L68 44V49L54 55Z" fill="${color}" opacity=".55"/><path d="M54 61L68 55" stroke="${color}" stroke-opacity=".4"/><path d="M48 22V11M43 11H53" stroke="${color}"/><circle cx="48" cy="9" r="2" fill="${color}"/>`,
    `<ellipse cx="45" cy="70" rx="38" ry="9" fill="${color}" opacity=".08"/><path d="M25 70L43 36L60 70Z" fill="#193039" stroke="${color}" stroke-opacity=".5"/><path d="M18 13Q12 49 53 47Z" fill="#25404a" stroke="${color}" stroke-opacity=".7"/><path d="M25 21L47 33L59 14" fill="none" stroke="${color}" stroke-opacity=".6"/><circle cx="59" cy="14" r="3" fill="${color}"/><path d="M68 8Q80 21 69 33M76 2Q94 22 79 42" fill="none" stroke="${color}" stroke-opacity=".3"/><path d="M20 70H67" stroke="${color}"/>`,
  ];
  return `<svg viewBox="0 0 94 82" aria-hidden="true">${structures[index]}</svg>`;
}
function roverArt() { return `<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M5 18L3 27M19 18L21 27M8 25V32M16 25V32" stroke="#9dafb2" stroke-width="3"/><rect x="5" y="12" width="14" height="14" rx="4" fill="#cbdbd6"/><circle cx="12" cy="9" r="8" fill="#dfe9e1"/><path d="M6 5Q12 2 18 5V11Q12 15 6 11Z" fill="#467078"/><path d="M9 7H15" stroke="#b6e8d8"/></svg>`; }
function openPlanet(id: string, station = 0) {
  const planet = planets.find(item => item.id === id);
  if (!planet) return;
  if (mapDialog.open) mapDialog.close();
  if (tutorial.open) tutorial.close();
  if (settings.open) settings.close();
  clearControls(); activePlanet = planet; activeStation = station; roverPosition = { x: 27, y: 79 };
  const index = planets.indexOf(planet);
  planetDialog.style.setProperty('--planet-color', planet.color);
  planetDialog.innerHTML = `<div class="dialog-topline"><span class="eyebrow"><span class="status-dot" style="background:${planet.color}"></span> PLANETA ${planet.name.toLocaleUpperCase('pt-BR')} / ${planet.region}</span><button class="text-button" id="takeoff-button">Decolar <span aria-hidden="true">↗</span></button></div><header class="planet-heading"><div><p class="eyebrow">${planet.kicker}</p><h2 id="planet-title">${planet.headline}</h2></div><span class="planet-index" aria-hidden="true">0${index + 1}</span></header><div class="planet-body"><div class="surface-column"><div class="surface-scene" role="region" aria-label="Base explorável de ${planet.name}">${landscape(planet)}<span class="surface-caption">BASE 0${index + 1} / CLIQUE EM UMA ESTAÇÃO</span>${planet.stations.map((name, i) => `<button class="station" data-station="${i}" aria-pressed="${i === station}" aria-label="Explorar ${name}">${stationArt(i, planet.color)}<span class="station-number">0${i + 1}</span><span class="station-name">${name}</span></button>`).join('')}<div class="rover" aria-hidden="true">${roverArt()}</div><div class="touch-controls" ${touchMedia.matches ? '' : 'hidden'} aria-label="Mover explorador">${['up','left','down','right'].map((direction, i) => `<button data-direction="${direction}" aria-label="Mover para ${['cima','a esquerda','baixo','a direita'][i]}">${['↑','←','↓','→'][i]}</button>`).join('')}</div></div><div class="surface-help"><span>WASD / setas para caminhar. E abre a estação mais próxima. Ou escolha abaixo.</span><button id="surface-map" aria-label="Abrir mapa estelar">Mapa ↗</button></div><nav class="surface-tabs" aria-label="Estações de ${planet.name}">${planet.stations.map((name, i) => `<button data-station="${i}" aria-pressed="${i === station}">${name}</button>`).join('')}</nav></div><section class="station-content" id="station-content" tabindex="-1" aria-label="Conteúdo da estação"></section></div>`;
  renderStation(station);
  showDialog(planetDialog);
  planetDialog.scrollTop = 0;
  tone('land');
  ensureFrame();
}
function closePlanet() {
  if (!planetDialog.open) return;
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
  return `<p class="eyebrow">${item.company.toUpperCase()} / CASE REAL</p><h3>${item.title}</h3>${index === 0 ? '<div class="project-metric"><strong>~75%</strong><span>menos tempo na execução de campanhas,<br />principalmente pontuais.</span></div>' : ''}${[['Contexto', item.context], ['Desafio', item.challenge], ['Minha ação', item.action], ['Resultado', item.result]].map(([title, text]) => `<div class="project-detail"><h4>${title}</h4><p>${escape(text)}</p></div>`).join('')}${tags(item.tags)}<p class="mission-note">Relato profissional de Matheus, conforme currículo de setembro de 2026.</p>${index === 0 ? '<button class="button button-secondary" data-station="2">Experimente a missão de CRM ↗</button>' : ''}`;
}
function stationContent(planet: Planet, station: number): string {
  switch (planet.id) {
    case 'identidade': return [
      `<p class="eyebrow">OLÁ, SOU MATHEUS</p><h3>Entre o negócio<br />e a próxima solução.</h3><p class="lead">${profile.title}</p><p>${profile.summary}</p><p>Hoje atuo como Salesforce Specialist e Tech Lead na Overlabs, em um projeto de alcance latino-americano.</p>${tags(['CRM', 'Martech', 'Salesforce', 'Liderança técnica'])}<button class="button button-secondary" data-travel="trajetoria">Conheça minha trajetória ↗</button>`,
      `<p class="eyebrow">COMO EU TRABALHO</p><h3>Entender. Conectar. Construir.</h3><h4>01 / Ouvir o negócio</h4><p>Entender a necessidade por trás de cada pedido e traduzi-la em requisitos técnicos claros, em contato direto com o cliente.</p><h4>02 / Conectar as peças</h4><p>Combinar dados, plataformas e estratégia para desenvolver jornadas, automações e integrações.</p><h4>03 / Dar autonomia</h4><p>Criar soluções reutilizáveis e compartilhar conhecimento para facilitar o trabalho de quem opera. O construtor de e-mails da Worten é um exemplo dessa abordagem.</p><button class="button button-secondary" data-travel="jornadas">Explore os projetos ↗</button>`,
      `<p class="eyebrow">APRENDIZADO CONTÍNUO</p><h3>Uma base para seguir explorando.</h3>${profile.education.map(item => `<article class="qualification"><h4>${item.title}</h4><p>${item.institution} · ${item.location}</p><small>${item.period}</small>${item.description ? `<p>${item.description}</p>` : ''}</article>`).join('')}<h4>Idiomas</h4>${profile.languages.map(item => `<p><strong>${item.name}</strong><br />${item.level}</p>`).join('')}`,
    ][station];
    case 'trajetoria': return `<p class="eyebrow">${['TECNOLOGIA & LIDERANÇA', 'ESTRATÉGIA & CAMPANHAS', 'IMPLEMENTAÇÃO & QUALIDADE'][station]}</p><h3>${['Do CRM à liderança técnica.', 'O encontro com as jornadas.', 'Os primeiros sinais.'][station]}</h3>${[experienceEntries(0,3),experienceEntries(3,6),experienceEntries(6,11)][station]}<a class="button button-secondary" href="./curriculo.html">Ver currículo completo ↗</a>`;
    case 'jornadas': return station < 2 ? project(station) : missionHTML();
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
  if (!activePlanet || station < 0 || station > 2) return;
  activeStation = station;
  const panel = $('#station-content');
  panel.innerHTML = stationContent(activePlanet, station);
  panel.scrollTop = 0;
  $$<HTMLButtonElement>('[data-station]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.station) === station)));
  if (focus) {
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
    case 'takeoff-button': closePlanet(); break;
    case 'map-button': case 'mobile-map-button': case 'surface-map': case 'skip-tutorial': openMap(); break;
    case 'pilot-button': showDialog(tutorial); break;
    case 'launch-button': startFlying(); break;
    case 'exit-flight': endFlying(); break;
    case 'land-button': if (closest) travel(closest.id); break;
    case 'copy-email': void copyEmail(); break;
    case 'mission-back': if (missionStep > 0) { missionStep--; renderStation(2, true); } else renderStation(0, true); break;
    case 'restart-mission': missionStep = 0; missionComplete = false; Object.keys(missionSelection).forEach(key => delete missionSelection[key]); renderStation(2, true); break;
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
  renderStation(2, true);
});

function hashRoute() {
  const [id, detail] = location.hash.slice(1).split('/');
  if (planets.some(planet => planet.id === id)) {
    const station = id === 'jornadas' ? ({ worten: 0, stone: 1, missao: 2 }[detail] ?? 0) : 0;
    openPlanet(id, station);
  } else if (planetDialog.open) { planetDialog.close(); activePlanet = null; syncScrollLock(); }
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
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-direction]');
  if (!button) return;
  event.preventDefault();
  button.setPointerCapture(event.pointerId);
  keys.add(directionKey[button.dataset.direction!]);
  ensureFrame();
});
for (const name of ['pointerup','pointercancel','lostpointercapture']) document.addEventListener(name, event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-direction]');
  if (button) keys.delete(directionKey[button.dataset.direction!]);
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement).matches('input,select,textarea,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (key === 'm' && !event.repeat) { event.preventDefault(); if (mapDialog.open) mapDialog.close(); else openMap(); return; }
  if (settings.open || tutorial.open || mapDialog.open || (!flying && !planetDialog.open)) return;
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) { event.preventDefault(); keys.add(key); ensureFrame(); }
  if (key === 'e' && !event.repeat) {
    if (activePlanet && planetDialog.open) {
      const scene = $('.surface-scene').getBoundingClientRect();
      const stations = $$<HTMLButtonElement>('.station');
      let nearest = 0; let distance = Infinity;
      stations.forEach((button, index) => {
        const rect = button.getBoundingClientRect();
        const d = Math.hypot(rect.x + rect.width / 2 - scene.x - roverPosition.x / 100 * scene.width, rect.y + rect.height / 2 - scene.y - roverPosition.y / 100 * scene.height);
        if (d < distance) { distance = d; nearest = index; }
      });
      renderStation(nearest, true);
    } else if (closest) travel(closest.id);
  }
});
document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', clearControls);
document.addEventListener('visibilitychange', () => { clearControls(); if (!document.hidden) ensureFrame(); });
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
    const scene = $('.surface-scene');
    roverPosition = advancePosition(roverPosition, direction, seconds, scene.clientWidth, scene.clientHeight, 105);
    const rover = $('.rover'); rover.style.left = `${roverPosition.x}%`; rover.style.top = `${roverPosition.y}%`;
  } else if (flying) {
    const smoothing = reducedMotion ? 1 : Math.min(1, seconds * 9);
    velocity.x += (direction.x - velocity.x) * smoothing; velocity.y += (direction.y - velocity.y) * smoothing;
    shipPosition = advancePosition(shipPosition, velocity, seconds, worldSize.width, worldSize.height, touchMedia.matches ? 150 : 225);
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
  if (button && activePlanet?.id === 'jornadas') history.replaceState(null, '', `#jornadas/${['worten','stone','missao'][activeStation]}`);
});
positionShip(); measureWorld(); hashRoute();

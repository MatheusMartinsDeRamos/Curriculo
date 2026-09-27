export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Normalize a direction so diagonal flight is no faster than axial flight. */
export function directionVector(keys) {
  const x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  const y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function nearestPlanet(position, planets, width, height, radius = 115) {
  let nearest = null;
  let distance = Infinity;
  for (const planet of planets) {
    const d = Math.hypot((position.x - planet.x) * width / 100, (position.y - planet.y) * height / 100);
    if (d < distance && d <= radius) { nearest = planet; distance = d; }
  }
  return nearest;
}

export function advancePosition(position, direction, seconds, width, height, speed = 220) {
  const dt = clamp(seconds, 0, 0.05);
  return {
    x: clamp(position.x + direction.x * speed * dt / Math.max(1, width) * 100, 4, 96),
    y: clamp(position.y + direction.y * speed * dt / Math.max(1, height) * 100, 8, 90),
  };
}

export const missionOptions = {
  audience: [
    { value: 'novos', title: 'Novos clientes', detail: 'Pessoas no início da relação com a marca. O contexto pede acolhimento e orientações úteis.' },
    { value: 'ativos', title: 'Clientes ativos', detail: 'Pessoas que já conhecem a marca. O histórico pode ajudar a tornar a comunicação mais relevante.' },
    { value: 'inativos', title: 'Clientes inativos', detail: 'Pessoas sem interação recente. Vale considerar a frequência e dar espaço para atualizar preferências.' },
  ],
  trigger: [
    { value: 'cadastro', title: 'Cadastro concluído', detail: 'Um evento inicia a jornada no momento em que a pessoa estabelece uma nova relação.' },
    { value: 'compra', title: 'Compra realizada', detail: 'Um evento de compra permite oferecer informação útil sobre a experiência que acabou de acontecer.' },
    { value: 'periodo', title: '30 dias sem interação', detail: 'Uma condição de tempo ajuda a identificar uma oportunidade de retomar a conversa.' },
  ],
  action: [
    { value: 'boas-vindas', title: 'E-mail de boas-vindas', detail: 'Apresenta os próximos passos e o valor que a pessoa pode encontrar na relação com a marca.' },
    { value: 'conteudo', title: 'Conteúdo personalizado', detail: 'Conecta o conteúdo ao contexto do público, usando apenas dados e permissões disponíveis.' },
    { value: 'preferencias', title: 'Atualização de preferências', detail: 'Abre espaço para a pessoa escolher os assuntos e a frequência que fazem sentido para ela.' },
  ],
};

export function buildJourney(selection) {
  return Object.entries(missionOptions).map(([key, options]) => {
    const selected = options.find(option => option.value === selection[key]);
    if (!selected) throw new Error(`Escolha uma opção válida para ${key}.`);
    return selected;
  });
}

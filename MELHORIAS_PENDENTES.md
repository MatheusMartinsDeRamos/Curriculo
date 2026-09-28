# Melhorias pendentes — Operação Órbita

Lista atualizada em **28/09/2026**. As três melhorias aprovadas foram implementadas, testadas e publicadas na **main**.

**Pendências atuais: nenhuma das três melhorias aprovadas.** Novas ideias serão acrescentadas aqui.

- [Site publicado](https://matheusmartinsderamos.github.io/Curriculo/)
- [Publicação validada no GitHub Actions](https://github.com/MatheusMartinsDeRamos/Curriculo/actions/runs/36499621132)
- Commit da entrega funcional: `105987711e3c39d1c04c3be229c82950b317be4b`.

## 1. Ranking público dos minigames e acesso às estações

**Estado: Concluído.**

- Ranking compartilhado entre visitantes, separado por planeta e nível, com paginação, posição individual e total de jogadores.
- Nome opcional e LinkedIn obrigatório apenas para gravar. O identificador de `/in/` aparece como nome principal, acompanhado do nome opcional. Parâmetros como `?utm=xyz` e barras finais são ignorados.
- O mesmo identificador mantém seu melhor resultado em cada categoria. Uma tentativa mais lenta não substitui o recorde.
- Menor tempo vence. Em Jornadas, o resultado é a duração do desafio mais **5 segundos por impacto**; empates compartilham a posição.
- A opção de não informar o LinkedIn responde **“Tudo bem!”** e leva a **Estações & currículo**.
- Concluir o desafio libera a aba. Antes disso, o convite explica que jogar é mais divertido, mas permite **“Continuar mesmo assim”**, com liberdade para “quebrar as regras”.
- API pública com banco D1 persistente, independente do frontend no GitHub Pages. O servidor reproduz os comandos e calcula a pontuação, valida os dados e limita tentativas de gravação.
- Decisão de identidade: o perfil é informado pelo visitante, sem autenticação do LinkedIn. Essa condição aparece no formulário. A validação do jogo não comprova titularidade do perfil nem elimina automação.

## 2. Novo minigame do planeta Sistemas

**Estado: Concluído — Espelhos orbitais.**

A nave pilota até espelhos e os gira com **E** ou o botão de toque para levar um feixe do reator ao satélite. O caminho da luz muda imediatamente após cada giro.

- Júnior: dois espelhos, duas orientações, caminho pontilhado e sem prazo de jogo.
- Pleno: três espelhos, mais orientações e dicas visuais.
- Sênior: quatro espelhos, sem rota sugerida e com prazo.
- Especialista: seis espelhos, distrações e prazo menor.

A conclusão por teclado, a liberação das estações e a recusa do LinkedIn foram verificadas no navegador. O layout móvel e seus controles também foram conferidos.

### Histórico das outras ideias sugeridas

As alternativas abaixo foram guardadas como referência. **Não são pendências da entrega aprovada**, que escolheu Espelhos orbitais:

- **Sequência de emergência:** pilotar entre instalações com dependências visíveis e ativá-las na ordem correta.
- **Rotas de energia:** escolher bifurcações para ligar origem e destino enquanto cada trecho se ilumina.
- **Diagnóstico de satélites:** escanear pistas e escolher a ferramenta adequada para reparar cada satélite.

## 3. Quatro níveis de dificuldade e rankings separados

**Estado: Concluído.**

- Escolha de **Júnior, Pleno, Sênior ou Especialista** antes de jogar, com explicação e preferência lembrada no navegador.
- Metas, distâncias, tempo, perigos, escudos, tolerâncias e dicas ajustados conforme o jogo. Júnior inclui mira assistida em Conexão.
- Nível visível durante a partida e no resultado, com opção de escolher novamente ao reiniciar.
- Recordes independentes por identificador, planeta e nível.
- **24 combinações de planeta e nível** concluídas por simulação usando controles reais, com replays aceitos pelo servidor. Os **17 testes automatizados** e os builds do site e da API passaram.

## Como manter esta lista

Ao receber novas ideias neste projeto, acrescentar um item. Usar **Pendente**, **Em andamento** ou **Concluído** conforme o estado real. Só marcar concluído após implementar, testar e publicar. Em cada resposta futura sobre o projeto, informar o que continua pendente ou fornecer um link para esta lista atualizada.

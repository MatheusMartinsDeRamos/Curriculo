# Melhorias pendentes — Operação Órbita

Este arquivo registra ideias para implementar **depois**. Uma ideia permanece como **Pendente** até a funcionalidade estar no site, testada e publicada. Ao concluir uma parte, atualize o estado e registre o que ainda faltar.

## 1. Ranking público dos minigames e acesso às estações

**Estado:** Pendente. Nenhuma parte do ranking ou da regra de acesso foi implementada.

- Ao concluir um desafio, mostrar o resultado e oferecer o registro no ranking público do respectivo planeta e nível de dificuldade.
- Permitir que a pessoa informe seu nome. Para **gravar** o resultado, pedir também a URL do perfil do LinkedIn. Extrair o nome de usuário do caminho `/in/` e exibi-lo no ranking; decidir na implementação se o nome digitado aparece junto. Por exemplo, `https://www.linkedin.com/in/matheusramoscrm/` e `https://www.linkedin.com/in/matheusramoscrm/?utm=xyz&hsjdkdhf` devem exibir `matheusramoscrm`. Ignorar parâmetros de consulta e barras finais. Aceitar apenas URLs válidas do domínio LinkedIn.
- Se o mesmo usuário jogar mais vezes, manter somente seu **melhor tempo** em cada planeta e nível. Ordenar o ranking pelo resultado e mostrar a posição e o total de jogadores, como **“Você ficou em 20º lugar entre 156 jogadores.”**
- Oferecer a opção de **não informar o LinkedIn**: responder que está tudo bem, não gravar a partida e convidar a pessoa para a aba **Estações & currículo**.
- Inicialmente, a aba **Estações & currículo** fica liberada ao concluir o minigame. Se alguém tentar entrar antes, avisar que liberar a aba jogando é mais divertido e oferecer **“Continuar mesmo assim”**, com a mensagem de que pode “quebrar as regras” e explorar livremente. O acesso ao currículo nunca deve ficar bloqueado de forma definitiva.
- Para um ranking público compartilhado, planejar armazenamento e uma API além dos arquivos estáticos do GitHub Pages. Definir como evitar resultados falsos e abuso antes da implementação.
- **Ponto a decidir na implementação:** os seis jogos usam regras diferentes; tempo sozinho não distingue bem todos eles, especialmente sobreviver por 40 segundos. Definir uma métrica justa por planeta e o critério de desempate. Uma URL do LinkedIn identifica o nome mostrado, mas não prova que a pessoa controla o perfil; decidir se haverá verificação.

## 2. Novo minigame do planeta Sistemas

**Estado:** Pendente. O jogo atual dos cinco reatores continua publicado.

- Substituir o desafio atual por algo mais divertido e menos difícil para quem visita o site pela primeira vez.
- Manter a nave como forma de explorar e agir. Pedir uma decisão simples de lógica, com instruções claras e retorno visual imediato.
- Garantir que qualquer pessoa consiga concluir sem depender de descobrir uma sequência escondida. Testar a experiência no computador e no celular, inclusive no nível Júnior.
- **Ideia inicial para avaliar:** conectar uma pequena rota de energia pilotando até pontos na ordem indicada; cada ponto dá uma pista visual para o seguinte. Escolher a mecânica final quando esta melhoria for implementada.

### Mecânicas candidatas (ainda sem escolha final)

1. **Espelhos orbitais — sugestão principal:** a nave pilota até dois ou três espelhos e os gira com **E** para refletir um feixe do reator até um satélite. O raio muda imediatamente após cada giro. Sem penalidade por tentativa; dicas visuais indicam o destino. O tempo de conclusão pode servir ao ranking.
2. **Sequência de emergência:** três instalações têm dependências visíveis, como “a antena precisa de energia”. O jogador pilota até elas e escolhe uma ordem que ligue tudo. A interface mostra claramente o que ainda falta; uma ordem errada permite tentar de novo.
3. **Rotas de energia:** um painel mostra a origem e o destino; a nave voa até bifurcações para apontar a energia pela rota correta. Cada escolha ilumina o trecho seguinte. Evitar transformar isso em outra corrida por portais.
4. **Diagnóstico de satélites:** a nave escaneia três satélites, vê pistas simples (sem energia, sinal bloqueado, peça solta) e escolhe a ferramenta correspondente. Cada acerto repara um satélite; um erro explica a pista e permite nova tentativa.

Para qualquer opção, manter Júnior muito simples, sem prazo apertado, e aumentar a quantidade de etapas e pistas falsas nos níveis seguintes. Testar se a solução fica clara apenas pelo que aparece na tela.

## 3. Quatro níveis de dificuldade e rankings separados

**Estado:** Pendente. Ainda não existe escolha de nível.

- Antes de cada minigame, permitir escolher **Júnior**, **Pleno**, **Sênior** ou **Especialista**.
- Júnior deve ser **muito fácil** e Especialista **muito difícil**, com Pleno e Sênior entre os dois. Ajustar metas, tempo, velocidade, perigos ou pistas conforme a mecânica de cada planeta.
- Guardar resultados em rankings independentes por **planeta e nível**. Um resultado de Júnior nunca aparece na classificação de Especialista, e vice-versa.
- Mostrar o nível escolhido durante a partida e no resultado. Ao repetir o jogo, comparar o novo resultado apenas ao melhor tempo do mesmo usuário naquele planeta e nível.
- Testar que todos os desafios continuam possíveis nos quatro níveis e que o usuário pode mudar de nível antes de reiniciar.

## Como manter esta lista

Ao receber novas ideias neste projeto, acrescentar um item aqui. Ao implementar algo, marcar como **Em andamento** ou **Concluído** conforme o estado real, registrar a publicação e deixar visível qualquer parte ainda pendente. Em cada resposta futura sobre o projeto, incluir um resumo curto do que continua pendente ou o link para esta lista atualizada.

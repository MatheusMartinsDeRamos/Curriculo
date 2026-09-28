# Operação Órbita

Portfólio interativo de **Matheus Martins de Ramos**, especialista em Martech e CRM. Uma exploração espacial em português com seis planetas, nave controlável, estações de conteúdo e uma missão educativa de CRM.

Ideias futuras e estado de implementação: [Melhorias pendentes](./MELHORIAS_PENDENTES.md).

**Site:** https://matheusmartinsderamos.github.io/Curriculo/

## Publicar gratuitamente no GitHub Pages

O repositório deve ser **público** no plano GitHub Free. Não é necessário comprar domínio ou contratar servidor.

1. Envie os arquivos deste projeto para a raiz de `MatheusMartinsDeRamos/Curriculo`, incluindo a pasta `.github` e `package-lock.json`.
2. Abra **Settings → Pages** no repositório.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. Na aba **Actions**, acompanhe o workflow **Publicar no GitHub Pages**. Se o código já tinha sido enviado antes de habilitar Pages, use **Run workflow**.
5. Quando a execução terminar com sucesso, abra https://matheusmartinsderamos.github.io/Curriculo/.

Novos commits em `main` ou `master` executam os testes, geram o site e publicam a atualização. O caminho dos arquivos é relativo, compatível com o subdiretório `/Curriculo/`.

Documentação oficial: [GitHub Pages](https://docs.github.com/en/pages/quickstart), [publicação com GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### Alternativa: publicar os arquivos já compilados

O pacote `site-pronto-github-pages.zip`, quando fornecido junto da entrega, contém o site compilado. Extraia e envie **o conteúdo** para a raiz do repositório; então selecione **Deploy from a branch → main → / (root)** em Settings → Pages. Não envie o próprio ZIP para hospedar. Para continuar atualizando pelo código-fonte, prefira o workflow acima.

## Executar no computador

Instale Node.js **22.12 ou superior**.

```sh
npm ci
npm run dev
```

Abra o endereço informado no terminal. Para verificar e gerar a versão final:

```sh
npm run check
npm run preview
```

A pasta `dist/` contém os arquivos prontos para hospedagem. Abrir o HTML diretamente por `file://` não substitui um servidor HTTP.

## O que está incluído

- Seis planetas com galáxias navegáveis, radar e acesso ao conteúdo profissional pela aba **Estações & currículo**.
- Pilotagem com WASD/setas, **Shift para velocidade da luz (4×)**, E para entrar em um planeta e M para abrir o mapa. No celular, setas e botão ⚡ por toque.
- Cada galáxia tem um minigame: cristais (Identidade), corrida por portais (Trajetória), asteroides (Jornadas), espelhos orbitais (Sistemas), resgate de cápsulas (Mentoria) e tiro ao alvo (Conexão).
- Jogos com instruções, progresso, vitória, reinício e pausa com P. Ao trocar de aba do navegador ou ler o currículo, o jogo pausa. Nos espelhos, E gira; no tiro ao alvo, Espaço dispara.
- Quatro níveis em cada jogo, de Júnior a Especialista, com metas, riscos, prazos e dicas ajustados.
- Ranking público por planeta e nível, com o melhor resultado de cada identificador do LinkedIn.
- Estações liberadas ao concluir o desafio ou por escolha do visitante, com um convite amigável para jogar.
- Missão de três escolhas, com 27 combinações e explicações; o resultado conecta ao case real da Worten.
- Currículo completo em HTML independente do jogo, com todas as 11 experiências, formação, certificações, tecnologias, idiomas e mentoria.
- PDF original, contato por e-mail/WhatsApp/LinkedIn e cópia do e-mail.
- Navegação por teclado, foco em diálogos, opção de movimento reduzido e respeito à preferência do sistema.
- Som sintetizado opcional, desligado em cada nova visita; volume e movimento são preferências locais.
- Layout responsivo, sem fontes remotas, imagens pesadas, serviços de análise.

## Atualizar o conteúdo

| Arquivo | Finalidade |
| --- | --- |
| `src/content/profile.json` | Conteúdo profissional, datas, projetos, competências e contatos |
| `src/content/planets.ts` | Nomes, posições, cores e estações dos planetas |
| `src/main.ts` | Interface, navegação, cenas e textos de apresentação |
| `src/flight.mjs` | Movimento, proximidade e regras da missão de CRM |
| `src/galaxy.mjs` | Regras, física e estado dos seis minigames |
| `src/difficulty.mjs` | Metas, prazos, tolerâncias e formato de resultado por nível |
| `src/mirrors.mjs` | Traçado e reflexão do feixe em Sistemas |
| `src/ranking-view.ts` | Formulário, classificação pública e paginação |
| `server/ranking-worker.mjs` | API, validação de partidas e persistência D1 |
| `src/galaxy-view.ts` | Câmera, cenários Canvas, radar e interface dos jogos |
| `src/galaxy.css` | Layout das galáxias e controles de toque |
| `src/styles.css` | Página inicial, mapa e controles |
| `src/surfaces.css` | Cenas e conteúdo dos planetas |
| `public/curriculo.pdf` | PDF original para download |
| `scripts/generate-resume.mjs` | Gera `public/curriculo.html` a partir do JSON |
| `.github/workflows/deploy.yml` | Testes, build e publicação automática |

Após alterar o JSON, execute `npm run build`. O currículo HTML é gerado novamente. Ao trocar o PDF, confira também o JSON e as informações resumidas na página inicial. A estrutura de dados inclui `locale` para uma futura tradução; esta versão é em português.

## Links diretos

- `/#identidade`, `/#trajetoria`, `/#jornadas`, `/#sistemas`, `/#mentoria`, `/#conexao`
- `/#jornadas/worten`, `/#jornadas/missao`
- `/curriculo.html` e `/curriculo.pdf`

No GitHub Pages, acrescente esses caminhos após `/Curriculo`.

## Conteúdo e privacidade

O conteúdo vem do currículo FlowCV de 27/09/2026. Os resultados apresentados são relatos profissionais: cerca de 30 blocos reutilizáveis e redução aproximada de 75% no tempo de execução de campanhas na Worten. A missão é fictícia e não prevê resultados. Não há dados de clientes, diagramas internos, métricas profissionais inventadas.

Os canais de contato e o PDF são públicos quando o site é publicado. O Case Stone foi retirado de Jornadas; o histórico de trabalho na Stone permanece no currículo. Os minigames funcionam localmente. A pontuação e o registro de comandos só são enviados quando o visitante escolhe salvar. O ranking mostra o identificador do LinkedIn, o nome opcional e o melhor resultado. A URL identifica o nome exibido, mas não comprova a titularidade do perfil. Volume, movimento e dificuldade são preferências locais; o acesso às estações é lembrado durante a sessão.

## Ranking compartilhado

O frontend permanece no GitHub Pages. A API usa um Worker e banco D1 gerenciados pelo Sites, porque o Pages hospeda arquivos estáticos e não grava resultados de visitantes. A configuração de publicação está em `.openai/hosting.json`; o endereço público fica em `src/ranking-config.json`. Não há chaves secretas no frontend.

- Um resultado por identificador, planeta e nível; uma nova partida só substitui a anterior se for melhor.
- Menor tempo vence. Em Jornadas, o resultado soma a duração do desafio a **5 segundos por impacto**. Tempos iguais dividem a posição.
- O servidor reproduz os comandos da partida e calcula o resultado. Essa validação rejeita tempos inventados e partidas incompletas; não comprova a identidade nem impede jogadores automatizados.
- A API limita gravações por origem de rede e hora. Armazena somente um resumo criptográfico temporário desse identificador de rede; os registros de comandos não são persistidos.
- O banco guarda os recordes entre publicações. Não apague o projeto Sites para atualizar a API.

### Publicar alterações da API

1. Execute `npm run check` e `npm run build:ranking`.
2. Faça um commit e envie o mesmo estado ao repositório de origem do projeto Sites existente. Use uma credencial temporária de publicação, sem gravá-la em arquivos ou no Git.
3. Empacote **o conteúdo** de `release/ranking-build/` como um arquivo tar, incluindo `.openai/hosting.json` e `dist/server/`.
4. Salve uma versão no Sites com o SHA completo do commit enviado e o arquivo tar. Publique essa versão no projeto indicado por `.openai/hosting.json`.
5. Confirme `/api/health` e `/api/leaderboard?game=sistemas&difficulty=junior`. Depois envie `main` ao GitHub para publicar o frontend.

O workflow do GitHub valida também o build da API, mas a publicação da API no Sites é uma etapa separada. Mantenha as regras da simulação iguais no frontend e no servidor.

# Operação Órbita

Portfólio interativo de **Matheus Martins de Ramos**, especialista em Martech e CRM. Uma exploração espacial em português com seis planetas, nave controlável, estações de conteúdo e uma missão educativa de CRM.

**Endereço previsto:** https://matheusmartinsderamos.github.io/Curriculo/

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

- Seis planetas, cada um com três estações: Identidade, Trajetória, Jornadas, Sistemas, Mentoria e Conexão.
- Pilotagem com WASD/setas, E para pousar e M para abrir o mapa. No celular, controles direcionais e botões por toque.
- Caminhada pelas bases com WASD/setas e acesso direto a todas as estações por botões.
- Missão de três escolhas, com 27 combinações e explicações; o resultado conecta ao case real da Worten.
- Currículo completo em HTML independente do jogo, com todas as 11 experiências, formação, certificações, tecnologias, idiomas e mentoria.
- PDF original, contato por e-mail/WhatsApp/LinkedIn e cópia do e-mail.
- Navegação por teclado, foco em diálogos, opção de movimento reduzido e respeito à preferência do sistema.
- Som sintetizado opcional, desligado em cada nova visita; volume e movimento são preferências locais.
- Layout responsivo, sem fontes remotas, imagens pesadas, serviços de análise ou dependências de backend.

## Atualizar o conteúdo

| Arquivo | Finalidade |
| --- | --- |
| `src/content/profile.json` | Conteúdo profissional, datas, projetos, competências e contatos |
| `src/content/planets.ts` | Nomes, posições, cores e estações dos planetas |
| `src/main.ts` | Interface, navegação, cenas e textos de apresentação |
| `src/flight.mjs` | Movimento, proximidade e regras da missão |
| `src/styles.css` | Página inicial, mapa e controles |
| `src/surfaces.css` | Cenas e conteúdo dos planetas |
| `public/curriculo.pdf` | PDF original para download |
| `scripts/generate-resume.mjs` | Gera `public/curriculo.html` a partir do JSON |
| `.github/workflows/deploy.yml` | Testes, build e publicação automática |

Após alterar o JSON, execute `npm run build`. O currículo HTML é gerado novamente. Ao trocar o PDF, confira também o JSON e as informações resumidas na página inicial. A estrutura de dados inclui `locale` para uma futura tradução; esta versão é em português.

## Links diretos

- `/#identidade`, `/#trajetoria`, `/#jornadas`, `/#sistemas`, `/#mentoria`, `/#conexao`
- `/#jornadas/worten`, `/#jornadas/stone`, `/#jornadas/missao`
- `/curriculo.html` e `/curriculo.pdf`

No GitHub Pages, acrescente esses caminhos após `/Curriculo`.

## Conteúdo e privacidade

O conteúdo vem do currículo FlowCV de 27/09/2026. Os resultados apresentados são relatos profissionais: cerca de 30 blocos reutilizáveis e redução aproximada de 75% no tempo de execução de campanhas na Worten. A missão é fictícia e não prevê resultados. Não há dados de clientes, diagramas internos, formulário com armazenamento ou métricas inventadas.

Os canais de contato e o PDF são públicos quando o site é publicado. A página guarda apenas preferências de volume e movimento no armazenamento local do navegador.

# Testes

519 verificações automatizadas sobre o sistema. Rodam no seu computador e, a cada
envio de código, dentro do próprio GitHub.

## Rodar

```bash
npm install                 # uma vez
npx playwright install chromium   # uma vez, só para os testes de navegador

npm run sintaxe             # segundos
npm run test:logica         # segundos  · 181 cenários
npm run test:navegador      # ~6 min    · 338 verificações
npm test                    # os três, na ordem
```

Uma suíte só:

```bash
node testes/rodar.mjs navegador smoke-arvore
node testes/rodar.mjs logica teste-ciclo
```

## As três camadas

| Camada | O que cobra | Tempo |
|---|---|---|
| `npm run sintaxe` | JavaScript válido nos dois HTML e no serviço, `<div>` equilibradas e **paridade**: o `index-teste-local.html` só pode diferir do `index.html` no `DEMO_MODE` | segundos |
| `npm run test:logica` | Regras de negócio, sobre as funções **extraídas do próprio `index.html`** — competência, vencimento, terceiros, assinaturas, projeção, e o serviço de WhatsApp calculando igual ao app | segundos |
| `npm run test:navegador` | O sistema de verdade, no Chromium: cliques, modais, filtros, cores, layout em 360/390/768/1280/1920 px | ~6 min |

A camada de lógica não tem uma cópia das funções: o `testes/extrair.mjs` lê o
`index.html`, acha cada `const` por balanceamento de delimitadores e monta um
módulo com o código real. Se uma função mudar de comportamento, o teste acusa; se
mudar de nome, a extração falha — nos dois casos você fica sabendo.

## Por que os CDNs são trocados por cópias locais

O `testes/preparar.mjs` gera `testes/.tmp/app.html` a partir do
`index-teste-local.html`, substituindo Tailwind, Chart.js, FontAwesome e Google
Fonts por pacotes npm. É o que torna o teste determinístico: com CDN, uma
lentidão da Cloudflare viraria "teste falhou" e você perderia a manhã procurando
um bug que não existe. O Tailwind é compilado com a **mesma paleta** configurada
dentro do HTML (`testes/tailwind.config.cjs`), para o teste ver as mesmas cores
que você vê.

Nada disso entra no sistema publicado: o `firebase.json` ignora `testes/**`.

## Arquivos

| Arquivo | Papel |
|---|---|
| `caminhos.mjs` | O único lugar que conhece o disco. Nenhum caminho fixo nos testes |
| `extrair.mjs` | Extrai as funções do `index.html` para `testes/alvo.mjs` |
| `preparar.mjs` | Monta o `app.html` de teste com os CDNs locais |
| `stub.mjs` | Dublê do `firebase-admin`, para testar o serviço sem tocar no Firebase |
| `rodar.mjs` | Executa as suítes e resume o placar |
| `sintaxe.mjs` | A barreira mais barata |
| `dados-demo.json` | Base de demonstração que alimenta os testes de navegador |
| `teste-*.mjs` | Lógica |
| `smoke-*.mjs` | Navegador |

Tudo o que é gerado vai para `testes/.tmp/` e está no `.gitignore`. As capturas
de tela ficam em `testes/.tmp/shots/` — no GitHub, elas são anexadas à execução.

## Quando um teste falha

O resumo diz qual suíte e qual verificação. Rode só aquela suíte, com o nome dela,
e leia a linha `FALHOU`: ela traz o valor obtido ao lado do esperado. Nos testes de
navegador, abra a captura correspondente em `testes/.tmp/shots/`.

Teste que falha depois de uma mudança **correta** é teste velho, não código errado:
atualize a expectativa. O contrário — mudar o código para o teste passar — é como
se perde a confiança na suíte.

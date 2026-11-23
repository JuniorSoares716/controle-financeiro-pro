# Controle Financeiro PRO

Sistema de finanças pessoais em **arquivo único** — HTML, CSS e JavaScript, sem
framework e sem etapa de build. Firebase para login, banco e hospedagem; GitHub
Actions para os testes automáticos e para os avisos de WhatsApp.

![versão](https://img.shields.io/badge/vers%C3%A3o-2.5.2-14B8A6)
![testes](https://img.shields.io/badge/testes-519-34D399)
![regras](https://img.shields.io/badge/regras%20de%20neg%C3%B3cio-148-60A5FA)
![licença](https://img.shields.io/badge/uso-pessoal-93A4C4)

---

## O problema que ele resolve

Planilha de finanças quebra em dois pontos. O primeiro é o **cartão de crédito**:
a fatura chega como um valor só, você não sabe quanto dela é seu, e o mês em que
a compra aconteceu não é o mês em que ela é paga. O segundo é a **disciplina**:
no dia 20 você não lembra se aquela conta de outubro ficou pendente.

Este sistema foi construído em volta dessas duas dores.

---

## As ideias centrais

### Competência × vencimento

O **mês de competência** é o mês de trabalho — aquele em que você está lançando e
quitando contas. O **vencimento** é a data em que cada conta é paga, e pode cair
em outro mês.

A competência **não avança por data fixa**. Ela avança quando o mês anterior está
inteiramente quitado. Enquanto houver uma conta de outubro em aberto, o sistema
abre em outubro — mesmo que o calendário já diga novembro. É o oposto de uma
planilha, que vira a página no dia 1º e deixa a pendência para trás.

### Fatura cheia, custo próprio

Quando outra pessoa compra no seu cartão, a fatura continua registrando o **valor
cheio** — é o que o banco cobra de você, e mentir sobre isso quebraria a
conciliação. O que é seu é a **diferença** entre a fatura e as parcelas de
terceiros.

Essa separação não fica numa tela só: atravessa o Dashboard, os Relatórios, a
Projeção, o consumo dos orçamentos e até a mensagem de WhatsApp. A fatura pode ser
de R$ 2.000, e o seu custo real do mês, R$ 1.400.

### O ciclo do cartão é do cartão

Cada cartão informa o dia de fechamento, o dia de vencimento e **em que mês a
fatura vence** — no próprio mês da competência ou no seguinte. Com isso o sistema
sabe que a fatura de dezembro é paga em janeiro, posiciona cada parcela na fatura
certa e, quando você muda a data de vencimento, oferece realinhar as faturas em
aberto sem tocar nas já pagas.

---

## O que ele faz

### Despesas
- Lançamento com categoria, tags, data da despesa e data de vencimento
- **Parcelamento**: informe `3/23` e as 20 parcelas seguintes são criadas, mês a
  mês, atravessando a virada de ano
- **Faturas de cartão** vinculadas ao cartão, com o valor previsto calculado a
  partir das parcelas conhecidas
- Busca, filtros por categoria, tag e situação, ordenação e **ações em lote**
- Ícone de pago em cada linha, para resolver uma conta sozinha
- Duplicar e editar pedem confirmação — numa tabela densa, o clique errado é fácil

### Cartões
- Limite comprometido, saldo devedor e ciclo de fechamento/vencimento
- **Compras parceladas** com valor, total de parcelas e mês da primeira
- **Compras à vista** e **assinaturas** (cobrança mensal sem fim definido)
- Lista agrupada por pessoa, em árvore, com a cor de cada uma ligando a faixa do
  grupo, o tronco e cada compra
- Busca por qualquer campo: nome, pessoa, cartão, valor, contagem de parcelas

### Pessoas
- Quem tem compras nos seus cartões, cada uma com nome, telefone e **cor própria**
  que a acompanha em todo o sistema
- **Extrato por pessoa**: parcela a parcela, o que já foi recebido, o que vence
  agora e o que está atrasado
- Controle de recebimento mês a mês
- Filtros por cartão, situação e nome, com somatório que acompanha o filtro

### Assinaturas
- Cobrança mensal de terceiros no seu cartão, sem total de parcelas
- Projetadas até o horizonte escolhido na aba Projeção
- **Encerramento preserva o histórico**: você informa o mês da última cobrança, e
  o que ficou pendente continua a receber
- A dívida conta só o que já foi cobrado — ninguém deve por uma mensalidade que
  ainda não caiu

### Dashboard
- Saldo do mês, total pago, total a pagar e saúde financeira
- Alertas de contas críticas e lembretes do que vence nos próximos dias
- Consumo dos orçamentos e as categorias que mais pesaram
- Card de terceiros, mostrando quanto da fatura do mês não é seu

### Projeção
- Receitas, despesas e saldo dos próximos meses, com horizonte configurável
- Considera parcelas conhecidas, recorrentes e assinaturas
- Fluxo de caixa acumulado

### Relatórios
- Evolução mensal, divisão por categoria e comparação entre meses
- Filtro de período e exportação

### Orçamentos, metas e investimentos
- Teto mensal por categoria, calculado sobre o **seu** custo, não sobre a fatura cheia
- Metas com valor alvo, prazo e histórico de contribuições
- Aportes e resgates, rendimento e propagação entre meses

### Despesas recorrentes
- Contas fixas com dia **e mês** de vencimento (no próprio mês ou no seguinte)
- O valor do cadastro é o padrão, não uma ordem permanente: o ajuste que você faz
  num mês específico sobrevive — importante para impostos, que variam

### Avisos no WhatsApp
- Contas a vencer e vencidas, duas vezes por dia, via Green API
- A mensagem usa o seu custo real, descontando o que é de terceiros
- Aviso de mês quitado
- Nada é enviado quando não há o que avisar

---

## Começar

O [**guia completo**](GUIA-COMPLETO.md) leva do zero ao sistema no ar em cinco
partes: GitHub, testes automáticos, Firebase, configuração do sistema e WhatsApp.
Leva de 50 a 70 minutos.

Para só dar uma olhada, abra o `index-teste-local.html` no navegador: ele roda com
dados fictícios, sem login e sem Firebase.

---

## Testes

```bash
npm install && npx playwright install chromium
npm test
```

**519 verificações** em três camadas:

| Camada | O que cobra | Tempo |
|---|---|---|
| Sintaxe e paridade | JavaScript válido, tags equilibradas, e o arquivo de teste idêntico ao sistema | segundos |
| Regras de negócio | 181 cenários sobre as funções **extraídas do próprio `index.html`** | segundos |
| Navegador | 338 verificações no Chromium: cliques, modais, filtros, cores, layout de 360 a 1920 px | ~6 min |

Rodam também a cada push, pelo GitHub Actions, em dois estágios — o do navegador
só começa se o rápido passar. Detalhes em [`testes/README.md`](testes/README.md).

---

## Arquitetura

| Camada | Escolha |
|---|---|
| Interface | HTML + CSS + JavaScript em **um arquivo**, Tailwind e Chart.js por CDN |
| Dados | Firestore, **um documento por usuário**, gravação agrupada |
| Login | Firebase Authentication, e-mail e senha |
| Hospedagem | Firebase Hosting |
| Notificações | GitHub Actions + Green API |
| Testes | Node e Playwright, sem framework de teste |

Arquivo único é uma decisão, não uma limitação aceita: sem build, sem
`node_modules` em produção, sem pipeline. Publicar é copiar um arquivo, e voltar
atrás é `firebase hosting:rollback`.

---

## Documentação

| Arquivo | O que tem |
|---|---|
| [`GUIA-COMPLETO.md`](GUIA-COMPLETO.md) | Instalação e configuração, do zero ao ar |
| [`HU-Controle-Financeiro-PRO.md`](HU-Controle-Financeiro-PRO.md) | 19 histórias de usuário, **148 regras de negócio**, 216 cenários, modelo de dados e fluxos |
| [`CHANGELOG.md`](CHANGELOG.md) | O que mudou em cada versão, e por quê |
| [`BACKLOG.md`](BACKLOG.md) | O que ainda não foi feito, e o motivo |
| [`testes/README.md`](testes/README.md) | Como os testes funcionam |

---

## Fora de escopo

Decidido, não esquecido:

- Múltiplos usuários na mesma conta ou perfis de acesso
- Integração bancária e importação de extrato (OFX, Open Finance)
- Aplicativo nativo — o acesso no celular é pelo navegador ou atalho na tela inicial
- Receita variável lançada item a item; a renda é cadastrada por fonte e mês

---

## Segurança

A `apiKey` do Firebase no `index.html` **não é um segredo**. Ela identifica o
projeto e é visível para qualquer pessoa que abra o site — é assim no Firebase,
por desenho. A proteção vem das regras do Firestore ([`firestore.rules`](firestore.rules)):
cada usuário só acessa o próprio documento.

A chave de serviço e as credenciais do Green API vivem **apenas nos secrets do
GitHub**, nunca em arquivo versionado. O `.gitignore` e o bloco `ignore` do
`firebase.json` existem para que continuem assim: o único arquivo publicado na
internet é o `index.html`.

---

Uso pessoal. Sem garantia.

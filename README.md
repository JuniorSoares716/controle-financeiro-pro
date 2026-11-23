# Controle Financeiro PRO

Sistema de finanças pessoais em **arquivo único** — HTML, CSS e JavaScript, sem
framework e sem build. Firebase para login, banco e hospedagem; GitHub Actions
para os testes e para os avisos de WhatsApp.

![versão](https://img.shields.io/badge/vers%C3%A3o-2.5.2-14B8A6) ![testes](https://img.shields.io/badge/testes-519-34D399) ![regras](https://img.shields.io/badge/regras%20de%20neg%C3%B3cio-148-60A5FA)

## O que ele faz

- **Competência × vencimento** — o mês só avança quando o anterior está quitado,
  nunca por data fixa
- **Compras de terceiros no seu cartão** — a fatura guarda o valor cheio; o que é
  seu é a diferença, e isso atravessa Dashboard, Relatórios e Projeção
- **Assinaturas** — cobrança mensal sem fim definido, encerrável sem perder o
  histórico
- **Cartões** — limite comprometido, ciclo de fechamento e vencimento aprendido
  das faturas lançadas
- **Projeção** — receitas, despesas e saldo nos próximos meses
- **Avisos no WhatsApp** — contas a vencer e vencidas, duas vezes por dia

## Começar

O [**guia completo**](GUIA-COMPLETO.md) leva do zero ao sistema no ar em cinco
partes: GitHub, testes automáticos, Firebase, configuração do sistema e WhatsApp.

Para só dar uma olhada, abra o `index-teste-local.html` no navegador: ele roda com
dados fictícios, sem login e sem Firebase.

## Testes

```bash
npm install && npx playwright install chromium
npm test
```

519 verificações em três camadas — sintaxe e paridade, regras de negócio e
navegador. Rodam também a cada push, pelo GitHub Actions. Detalhes em
[`testes/README.md`](testes/README.md).

## Documentação

| Arquivo | O que tem |
|---|---|
| [`GUIA-COMPLETO.md`](GUIA-COMPLETO.md) | Instalação e configuração, do zero ao ar |
| [`HU-Controle-Financeiro-PRO.md`](HU-Controle-Financeiro-PRO.md) | 19 histórias de usuário, 148 regras de negócio, 216 cenários |
| [`CHANGELOG.md`](CHANGELOG.md) | O que mudou em cada versão |
| [`BACKLOG.md`](BACKLOG.md) | O que ainda não foi feito, e por quê |
| [`testes/README.md`](testes/README.md) | Como os testes funcionam |

## Segurança

A `apiKey` do Firebase no `index.html` **não é um segredo** — ela identifica o
projeto e é visível para qualquer um que abra o site. A proteção vem das regras do
Firestore (`firestore.rules`): cada usuário só acessa o próprio documento.

A chave de serviço e as credenciais do WhatsApp vivem **apenas nos secrets do
GitHub**, nunca em arquivo versionado. O `.gitignore` e o bloco `ignore` do
`firebase.json` existem para que continuem assim.

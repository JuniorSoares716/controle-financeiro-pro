# Backlog — Controle Financeiro PRO

| Campo | Valor |
|---|---|
| **Base** | v2.5, Novembro/2026 |
| **Origem** | Auditoria completa (`ANALISE-SISTEMA-v2.3.md`), revisada após as correções |
| **Atualizado em** | 11/11/2026 |

Este é o estado real do que falta. Os itens resolvidos na v2.4 foram removidos — o que está aqui continua aberto.

---

## 1. Prioridade alta

| # | Item | Por que importa |
|---|---|---|
| A-01 | **Remover a espera artificial de 2 s** no salvamento | Toda ação trava a tela por no mínimo 2 segundos, mesmo com o banco respondendo em 200 ms. Marcar uma conta como paga custa 2 s. É o maior incômodo do uso diário e sai em uma linha. |
| A-02 | **Aviso quando a notificação falhar** | Se o QR Code do Green API cair ou um secret expirar, o job falha e ninguém fica sabendo. Você só percebe pela ausência de mensagens — provavelmente depois de perder um vencimento. |
| A-03 | **Renderizar só a aba visível** | `renderAll()` redesenha as oito telas e recria todos os gráficos a cada salvamento e a cada troca de aba. Com um ano cheio, isso aparece. |
| A-04 | **Arquivo de testes no repositório** | Não existe nenhum teste versionado. Os que foram usados nas correções da v2.4 eram montados a cada vez e se perderam. Um `testes.mjs` rodando em Node cobriria vencimento, investimentos, projeção, competência e parcelamentos. |

## 2. Dados já gravados

As correções da v2.4 valem do momento da instalação em diante. O que já estava torto no banco continua como está.

| # | Item | O que fazer |
|---|---|---|
| B-01 | **Parcelas antigas com vencimento repetido** | Varredura que identifica e corrige, com prévia do que vai mudar e confirmação antes de gravar. |
| B-02 | **Investimentos duplicados** | Varredura que detecta aplicações repetidas no mesmo mês e junta as séries, item a item. |
| B-03 | **Rendimento invertido em meses antigos** | Lançamentos em que o rendimento bate exatamente com o aporte ou resgate, com sinal trocado. Listar para revisão manual. |

## 3. Correções pendentes

| # | Item | Gravidade |
|---|---|---|
| C-01 | Nome de categoria sem escape em duas tabelas (`renderBudgetsTable` e `renderRecurringExpensesTable`) | Baixa |
| C-02 | Não existe exclusão de mês nem de ano | Média |
| C-03 | Parcela de compra dentro da fatura é propagada pelo **nome** da despesa-pai; renomear a fatura faz a parcela sumir | Média |
| C-04 | Importação de backup aceita estrutura parcial | Média |
| C-05 | Falha de rede no salvamento deixa a tela mostrando dado que não foi gravado | Média |
| C-06 | Categoria excluída não verifica uso em anos anteriores | Baixa |
| C-07 | Sem confirmação ao sair com modal preenchido | Baixa |

## 4. Segurança e operação

| # | Item | Situação |
|---|---|---|
| D-01 | **Regras do Firestore** | Regras recomendadas entregues no `GUIA-DE-INSTALACAO.md`. Falta confirmar que estão publicadas no projeto em produção. |
| D-02 | **Chave de serviço com permissão total** | O `SERVICE_ACCOUNT` é administrador do projeto inteiro. O ideal é uma conta dedicada só com acesso ao Firestore e ao Authentication. |
| D-03 | **Criação de contas aberta** | Conferir em Authentication → Settings se o cadastro está desativado. |
| D-04 | Workflow sem `concurrency` nem `timeout-minutes` | Duas execuções sobrepostas enviariam mensagens duplicadas. |
| D-05 | Dependências reinstaladas a cada execução, sem cache | ~30 s de runner por disparo. |
| D-06 | Serviço atende um único usuário (`APP_EMAIL` fixo) | Limitação conhecida, aceitável hoje. |

## 5. Melhorias técnicas

| # | Item |
|---|---|
| E-01 | Compilar o Tailwind e embutir o CSS, em vez de usar o CDN — remove o aviso do console, acelera o carregamento e funciona offline |
| E-02 | Atraso de 200 ms na busca de despesas, que hoje redesenha a aba a cada tecla |
| E-03 | Validação automática no CI (`node --check` e testes a cada push) |
| E-04 | Quebrar o arquivo único em módulos ES, sem build step |
| E-05 | Service worker para funcionamento offline |
| E-06 | Respeitar `prefers-color-scheme` na primeira visita |

## 6. Produto

| # | Item |
|---|---|
| F-01 | Marcar parcela individual como paga |
| F-02 | Anexar comprovante à despesa |
| F-03 | Receita recorrente (hoje o salário é recadastrado a cada mês novo) |
| F-04 | Busca global, não só na aba Despesas |
| F-05 | Filtro por tag nos relatórios |
| F-06 | Exportar para Excel (.xlsx) |
| F-07 | Histórico de alterações |
| F-08 | Atalhos de teclado |
| F-09 | Foco preso no modal (hoje o Tab escapa para o fundo) |
| F-10 | `aria-live` nos toasts |
| F-11 | Incluir a Projeção na exportação em PDF |
| F-12 | Aviso fixo no Dashboard quando o app abre em mês anterior, no lugar do toast que some |

## 7. Funcionalidades novas

Em ordem de retorno por esforço.

| # | Funcionalidade | Nota |
|---|---|---|
| G-01 | **Importar extrato OFX/CSV** | Melhor retorno da lista. Todo banco exporta OFX. Elimina a maior parte da digitação, sem custo, sem backend e sem depender de terceiros. |
| G-02 | **Categorização automática** | Regras do tipo "se o nome contém IFOOD então Alimentação", aplicadas na importação. |
| G-03 | **Conciliação** | Marcar despesa como conferida com o extrato, separando previsão do que de fato saiu. |
| G-04 | **Open Finance (leitura)** | Via Meu Pluggy: gratuito, até 5 contas do próprio titular, atualização a cada 24 h. Exige backend — o padrão do GitHub Actions já serve. Consentimento expira em até 12 meses. |
| G-05 | Relatório anual comparativo, ano contra ano |
| G-06 | Alertas configuráveis (janela de dias e horários hoje fixos no código) |
| G-07 | Resumo semanal no WhatsApp |
| G-08 | Simulador: "se eu cortar 20% em Lazer, quando atinjo a meta?" |
| G-09 | Metas ligadas a investimentos |
| G-11 | Múltiplos usuários |

*G-10 (divisão de despesas entre pessoas) foi entregue em parte na v2.5: compras de terceiros nos cartões. Falta o rateio de uma despesa comum fora do cartão — conta de luz dividida com o irmão, por exemplo.*

## 8. Decorrentes da v2.5

| # | Item | Nota |
|---|---|---|
| H-01 | **Cobrança pelo WhatsApp** | Usar a integração que já existe para avisar a pessoa, no vencimento, quanto ela deve. Foi levantado e deixado de fora da v2.5 por decisão sua. |
| H-02 | **Rateio parcial de uma compra** | Hoje a compra é inteira sua ou inteira de outra pessoa. Falta o caso "metade minha, metade dela". |
| H-03 | **Transferir compra entre pessoas** | Hoje é preciso editar o parcelamento. Uma ação direta evitaria o bloqueio ao excluir pessoa. |
| H-04 | **Recebimento parcial** | A parcela é recebida ou não. Não há como registrar que a pessoa pagou metade do mês. |
| H-05 | **Terceiros nos relatórios** | A aba Relatórios usa o custo próprio, mas não tem nenhuma visão histórica de quanto já foi adiantado e devolvido. |
| H-06 | **Projeção ignora lacunas no calendário** | A previsão conta passos a partir do fim do histórico, não da distância real em meses. Com meses vazios entre o último lançamento e o mês projetado, a tendência é aplicada com menos passos do que os meses decorridos e a projeção fica subestimada. Encontrado ao unificar o gráfico de Fluxo de Caixa (RN-REL-07). Só afeta quem deixa buracos no cadastro. |

---

## Sugestão de recorte para a v2.6

Nada disto entrou na v2.5, que foi inteira dedicada às compras de terceiros. O conjunto abaixo continua sendo o mais coerente: entrega valor visível e deixa a base mais sólida.

1. **A-01** — remover a espera de 2 segundos
2. **A-02** — aviso quando a notificação falhar
3. **A-03** — renderizar só a aba visível
4. **A-04** — arquivo de testes no repositório
5. **E-01** — Tailwind compilado
6. **C-03** e **C-05** — as duas correções de maior impacto

O resultado seria uma versão perceptivelmente mais rápida, que avisa quando algo quebra e que fica protegida por testes para as versões seguintes.

**Alternativa, se a prioridade for função nova em vez de base:** G-01 (importar OFX) sozinho já muda o uso diário mais do que qualquer outro item da lista.

# História de Usuário — Controle Financeiro PRO

| Campo | Valor |
|---|---|
| **Produto** | Controle Financeiro PRO |
| **Versão** | 2.5 |
| **Data** | Novembro/2026 |
| **Tipo** | Aplicação web (SPA de arquivo único) + serviço de notificações |
| **Projeto Firebase** | `projeto-financeiro-8f3f3` |
| **URL de produção** | https://projeto-financeiro-8f3f3.web.app |

---

## 1. Visão Geral

### 1.1 Objetivo do produto
Permitir que uma pessoa física controle suas finanças pessoais em um único lugar — despesas, receitas, investimentos, metas e orçamentos — organizados por mês e ano, com avisos automáticos de contas a vencer entregues por WhatsApp.

### 1.2 Problema que resolve
O usuário registra suas contas em um mês (competência), mas paga essas contas no mês seguinte (vencimento). Ferramentas comuns tratam competência e vencimento como a mesma coisa, o que gera confusão sobre "o que já venceu" e "quanto ainda falta pagar". Além disso, sem lembrete ativo, contas passam do vencimento sem que a pessoa perceba.

### 1.3 Proposta de valor
- Visão consolidada do mês em um Dashboard com nota de saúde financeira.
- Separação clara entre **mês de competência** e **data de vencimento**.
- Aviso proativo no WhatsApp, duas vezes ao dia, sem custo.
- Previsão de gastos dos próximos meses, separando compromisso já cadastrado de estimativa.
- Dados na nuvem, acessíveis de qualquer dispositivo, protegidos por login.

### 1.4 Personas
| Persona | Descrição | Necessidade principal |
|---|---|---|
| **Titular** | Dono da conta, cadastra e paga as despesas | Não perder vencimentos e saber quanto falta pagar |
| **Familiar** | Recebe as notificações no WhatsApp | Ser avisado das contas sem precisar abrir o sistema |

---

## 2. Escopo Funcional

### 2.1 Módulos
| # | Módulo | Descrição |
|---|---|---|
| 1 | Autenticação | Login por e-mail e senha |
| 2 | Dashboard | KPIs, alertas, saúde financeira, lembretes, orçamentos, top categorias |
| 3 | Despesas | Cadastro, parcelamento, faturas, tags, filtros, ações em lote |
| 4 | Investimentos | Aportes, resgates, rendimento, propagação entre meses, meta de patrimônio |
| 5 | Metas | Objetivos financeiros com histórico de contribuições e projeção |
| 6 | Relatórios | Gráficos, filtro de período, projeções, exportação |
| 7 | Configurações | Rendas, orçamentos, recorrentes, categorias, backup, contatos WhatsApp |
| 8 | Notificações | Envio automático de avisos por WhatsApp |
| 9 | Projeção | Previsão de receitas, despesas e saldo dos próximos meses |
| 10 | Cartões | Cadastro de cartões, compras parceladas, saldo devedor, uso do limite e compras de terceiros |
| 11 | Pessoas | Aba própria: quem tem compras nos cartões do titular, extrato por pessoa e controle de recebimento |

### 2.2 Fora de escopo
- Múltiplos usuários na mesma conta / perfis de acesso.
- Integração bancária ou importação automática de extratos (OFX, Open Finance).
- Aplicativo nativo (o acesso mobile é via navegador / atalho na tela inicial).
- Controle de receitas variáveis por lançamento individual (a renda é cadastrada por fonte/mês).

---

## 3. Modelo de Dados

### 3.1 Estrutura raiz
```
users/{uid}
  ├─ "2026"          ← dados do ano
  ├─ "2027"
  └─ appSettings     ← configurações globais
```

> **RN-DATA-01** — O Firestore rejeita nomes de campo que começam **e** terminam com `__`. A chave global chama-se `appSettings`. Bases antigas com `__settings__` são migradas automaticamente na leitura e na escrita, sem perda de dados.

> **RN-DATA-03** — Quando o documento do usuário existe mas não contém nenhum ano válido, o sistema cria a estrutura inicial **preservando** o que está fora dos anos (configurações globais e contatos de WhatsApp). Nada é sobrescrito em bloco.

### 3.2 Objeto do ano
| Campo | Tipo | Descrição |
|---|---|---|
| `summary` | array | `{ month, income, expenses }` por mês cadastrado |
| `expenseCategories` | array | `{ id, name, icon }` |
| `monthlyDetails[mês].expenses` | array | Despesas do mês |
| `monthlyIncomes[mês]` | array | `{ id, source, value }` |
| `monthlyInvestments[mês]` | array | Investimentos do mês |
| `budgets` | array | `{ id, categoryId, limit }` — vale para todos os meses do ano |
| `savingsGoals` | array | `{ id, name, targetAmount, currentAmount, targetDate, color, icon, contributions }` |
| `recurringExpenses` | array | `{ id, name, categoryId, value, due, startMonth }` |
| `patrimonioGoal` | número | Meta de patrimônio do ano |

### 3.3 Objeto Despesa
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | Sim | Identificador único |
| `categoryId` | string | Sim | Categoria vinculada |
| `name` | string | Sim | Descrição da despesa |
| `value` | número | Sim | Valor total |
| `dueDate` | string | Não | Data de vencimento completa (`AAAA-MM-DD`) |
| `due` | número | Não | Dia do vencimento (legado, mantido por compatibilidade) |
| `date` | string | Não | Data da despesa (competência do gasto) |
| `paid` | booleano | Sim | Status de pagamento |
| `tags` | array | Não | Etiquetas livres |
| `isInstallment` | booleano | Sim | Indica parcelamento |
| `currentInstallment` / `totalInstallments` | número | Se parcelado | Controle de parcelas |
| `purchases` | array | Não | Compras que compõem a fatura |
| `recurringId` | string | Não | Vínculo com a despesa recorrente de origem |

> **RN-DATA-02** — `dueDate` é a fonte de verdade do vencimento. `due` é preenchido automaticamente com o dia extraído de `dueDate` e existe apenas para compatibilidade com registros antigos.

### 3.4 Objeto Investimento
| Campo | Descrição |
|---|---|
| `id` | Identificador do registro naquele mês |
| `seriesId` | Identificador da **série** — o mesmo investimento ao longo dos meses |
| `bank` / `type` / `assetClass` | Instituição, aplicação e classe do ativo |
| `invested` | Saldo no início do mês (o que veio do mês anterior) |
| `added` / `withdrawn` | Aportes e resgates do mês |
| `current` | Saldo atual, já incluindo aportes e resgates do mês |

### 3.5 Configurações globais (`appSettings`)
| Campo | Descrição |
|---|---|
| `whatsappContacts` | `{ id, name, number }` — destinatários dos avisos |
| `notificacoes.mesesQuitadosAvisados` | Lista de chaves `Mês/Ano` cujo aviso de fechamento já foi enviado |
| `cards` | `{ id, name, limit, closingDay, dueDay }` — cartões de crédito |
| `people` | `{ id, name, phone, color, createdAt }` — pessoas com compras nos cartões do titular |
| `installmentPlans` | `{ id, cardId, description, installmentValue, totalInstallments, firstMonth, firstYear, purchaseDate, personId, recebimentos }` — compras parceladas |

> **RN-DATA-04** — Cartões, pessoas e parcelamentos ficam em `appSettings`, e não dentro do ano, porque **atravessam o ano**: um parcelamento em 10x iniciado em Novembro termina no ano seguinte.

> **RN-DATA-05** — `personId` nulo significa que a compra é do titular, e o comportamento é idêntico ao das versões anteriores. Preenchido, aponta para uma pessoa de `people`.

> **RN-DATA-06** — `recebimentos` é um mapa `{ "AAAA-MM": { recebido, data } }`, com uma entrada por parcela acertada. A chave usa ano e número do mês com dois dígitos: sem ponto e sem `__` nas pontas, que o Firestore recusa.

---

## 4. Regras de Negócio

### 4.1 Ciclo de competência × vencimento

> **RN-CICLO-01** — A despesa pertence ao **mês de competência** em que foi cadastrada, mas seu vencimento pode cair em qualquer data futura. Exemplo: fatura registrada em Junho com vencimento em 15/07.

> **RN-CICLO-02** — O **mês de competência corrente** para as notificações é determinado pelo status de pagamento, não por data fixa: enquanto o mês anterior tiver ao menos uma despesa **não paga**, ele permanece como competência. Quando todas forem pagas, a competência avança para o mês atual.

> **RN-CICLO-03** — Título das despesas e título dos orçamentos usam sempre o mesmo mês de competência, mudando juntos.

> **RN-CICLO-04** — O cálculo de orçamento considera **apenas** as despesas do mês de competência. Não mistura meses.

> **RN-CICLO-05** — A busca de vencimentos considera o mês de competência **e** o mês oposto, para capturar pendências dos dois lados. A deduplicação usa a chave `nome + dueDate`.

> **RN-CICLO-06** — O aplicativo **abre no mês de competência**, pela mesma regra da RN-CICLO-02: enquanto o mês anterior tiver conta não paga, é nele que o sistema abre; quando todas estiverem pagas, passa a abrir no mês corrente. Nunca abre em mês posterior ao corrente. Ao abrir em um mês passado, o sistema informa o motivo.

> **RN-CICLO-07** — Ao copiar uma despesa para outro mês (parcela seguinte, cópia em lote, novo mês ou novo ano), o **vencimento acompanha a mudança de competência**, preservando o dia e a distância em meses entre competência e vencimento. Exemplo: despesa de Junho que vence 15/07, copiada para Julho, passa a vencer 15/08. Dia inexistente no mês de destino é ajustado para o último dia daquele mês (31/01 → 28/02).

### 4.2 Classificação de vencimento
Base de cálculo: diferença em dias entre `dueDate` e a data de hoje.

| Situação | Condição | Onde aparece |
|---|---|---|
| Vencida | diferença < 0 | Seção "Vencidas (não pagas)" |
| Vence hoje | diferença = 0 | Seção "Vencendo hoje" |
| Vencendo em breve | 0 < diferença ≤ 5 | Seção "Vencendo em breve" |
| Mais adiante | diferença > 5 ou sem data | Seção "Mais adiante" |

> **RN-VENC-01** — A janela de "em breve" é de **5 dias**, configurável pela variável `JANELA_DIAS`.

> **RN-VENC-02** — Despesas **pagas** não aparecem nos lembretes nem geram notificação.

> **RN-VENC-03** — Nenhuma despesa pendente pode desaparecer da tela. Itens sem data válida são recolhidos em "Mais adiante".

> **RN-VENC-04** — Para registros legados sem `dueDate`, a comparação usa o campo `due` contra o dia atual.

> **RN-VENC-05** — Os alertas do topo do Dashboard e o painel de Lembretes usam a **mesma base**: despesas do mês selecionado e do mês anterior, deduplicadas. As contagens das duas áreas são sempre coerentes entre si.

> **RN-VENC-06** — Telas e exportações que exibem vencimento usam a data completa (`dueDate`), inclusive o indicador "Próximos 7 Dias", a ordenação por vencimento e os arquivos CSV.

### 4.3 Saúde Financeira
Nota de 0 a 100, soma de três componentes:

| Componente | Peso | Fórmula |
|---|---|---|
| Poupança | até 40 | `(saldo ÷ receita) ÷ 0,20 × 40`, limitado a 40 |
| Contas pagas | até 30 | `(despesas pagas ÷ total de despesas) × 30` |
| Orçamentos | até 30 | `(orçamentos dentro do limite ÷ total de orçamentos) × 30` |

Faixas de classificação:

| Faixa | Cor | Mensagem |
|---|---|---|
| Sem dados | Cinza | "Sem dados ainda — registre receitas e despesas para ver sua nota." |
| 0 a 49 | Vermelho | "Atenção — reveja gastos e contas." |
| 50 a 74 | Âmbar | "Regular — dá para melhorar." |
| 75 a 100 | Verde | "Boa — continue assim!" |

> **RN-SAUDE-01** — A nota parte de zero. Sem receitas nem despesas registradas, todos os componentes valem 0 e é exibida a mensagem de "sem dados", evitando nota inflada artificialmente.

> **RN-SAUDE-02** — A meta de poupança é de 20% da receita; poupar 20% ou mais concede os 40 pontos integrais.

> **RN-SAUDE-03** — Orçamentos com limite igual ou menor que zero ficam **fora** do componente de orçamentos, tanto do numerador quanto do denominador. Sem nenhum orçamento válido, esse componente vale 0 — não são concedidos pontos por ausência de limite.

### 4.4 Orçamentos
Vinculados a uma categoria, com limite mensal, válidos para todos os meses do ano.

| Situação | Condição | Texto exibido |
|---|---|---|
| Dentro da margem | gasto < 80% do limite | "Pode utilizar R$ X." |
| Apertado | 80% ≤ gasto ≤ 100% | "Pode utilizar R$ X." |
| Estourado | gasto > limite | "Você estourou R$ X a mais do cadastrado." |

> **RN-ORC-01** — O limite de "apertado" é **80%**, definido pela constante `LIMITE_APERTADO`. O valor é inclusivo: exatamente 80% já é apertado, no app e na notificação.

> **RN-ORC-02** — Só é permitido um orçamento por categoria. Salvar sobre uma categoria já orçada atualiza o registro existente. Ao **editar** um orçamento e trocar a categoria para outra que já possui orçamento, o registro de origem é removido, de modo que a categoria nunca fica com dois orçamentos.

> **RN-ORC-03** — Orçamentos com limite igual ou menor que zero são ignorados nos cálculos.

### 4.5 Despesas parceladas e faturas

> **RN-DESP-01** — A parcela atual não pode ser maior que o total de parcelas.

> **RN-DESP-02** — Uma despesa pode agrupar várias compras (faturas). O valor da despesa-pai é sincronizado automaticamente com a soma das compras a cada inclusão ou exclusão.

> **RN-DESP-03** — Compras parceladas propagam automaticamente para o mês seguinte, incrementando o número da parcela.

> **RN-DESP-04** — Percentuais por categoria são exibidos com duas casas decimais, refletindo o valor real (ex.: 82,43%). A soma pode não fechar exatamente 100% por arredondamento — comportamento esperado.

> **RN-DESP-05** — Cada parcela futura vence **um mês depois** da anterior, conforme a RN-CICLO-07. A data é calculada sempre a partir do vencimento da primeira parcela, sem acúmulo de desvio.

> **RN-DESP-07** — A despesa pode ser vinculada a um cartão pelo campo `cardId`. O botão "Detalhar compras" passa a valer para qualquer despesa vinculada a um cartão, além da categoria histórica "Faturas de Cartão".

> **RN-DESP-06** — O formulário de despesa oferece a opção **"Repetir nos próximos meses (sem valor)"**, que lança a mesma despesa do mês seguinte até Dezembro com valor zero, para o usuário preencher mês a mês. É recurso distinto do módulo de Despesas Recorrentes: não cria registro em `recurringExpenses` e as cópias mantêm o mesmo nome do original.

### 4.6 Despesas recorrentes (fixas)

> **RN-REC-01** — Ao cadastrar, o usuário escolhe o **mês inicial**; a despesa é lançada desse mês até Dezembro do mesmo ano.

> **RN-REC-02** — Ao editar uma recorrente, os lançamentos dos meses futuros (a partir do mês inicial) são atualizados. Meses anteriores não são alterados e o status pago/pendente dos lançamentos existentes é preservado.

> **RN-REC-03** — O vínculo entre a recorrente e seus lançamentos é feito pelo campo `recurringId`. Editar um lançamento pela tela de Despesas **preserva** esse vínculo; sem isso, a edição seguinte da recorrente criaria um lançamento duplicado no mês.

> **RN-REC-04** — Os lançamentos gerados por uma recorrente gravam a **data completa de vencimento** (`dueDate`), conforme a RN-DATA-02, calculada a partir do dia informado e do mês escolhido na RN-REC-05.

> **RN-REC-05** — O cadastro da recorrente informa **em que mês ela vence**: no próprio mês de competência (aluguel, água, luz) ou **no mês seguinte** (fatura de cartão, assinaturas lançadas no fechamento). Guardado em `dueMonthOffset` (0 ou 1); cadastros antigos, sem o campo, valem como 0 e continuam exatamente como estavam. Com 1, a competência de Dezembro vence em Janeiro do ano seguinte, e um dia 31 cai no último dia do mês de destino. Sem esse campo, a recorrente era o único gerador de lançamentos futuros que ignorava a defasagem entre competência e vencimento: Outubro e Novembro terminavam com a mesma data de vencimento.

> **RN-REC-06** — Editar nome, valor ou categoria de uma recorrente **não reescreve** vencimentos já lançados; uma correção feita à mão em um mês específico sobrevive. Só mudar o **dia** ou o **mês do vencimento** redefine as datas, da competência inicial em diante.

### 4.7 Investimentos

> **RN-INV-01** — Ao salvar um investimento, o valor atual é propagado para todos os meses seguintes do ano: vira o "valor investido" (saldo inicial) do mês seguinte, com aportes e resgates zerados.

> **RN-INV-02** — A propagação identifica a mesma aplicação pelo `seriesId`, e não por banco + tipo. Isso impede duplicação quando o usuário renomeia o banco ou o tipo. Registros antigos sem `seriesId` são localizados pelo banco e tipo **anteriores à edição** — nunca pelos novos — e recebem o identificador ao serem encontrados, migrando sozinhos conforme o sistema é usado.

> **RN-INV-03** — Na virada de ano, o valor atual de Dezembro é transportado para Janeiro do ano seguinte como valor investido, zerando o rendimento acumulado — o rendimento passa a contar do zero no novo ano.

> **RN-INV-04** — Valores negativos não são aceitos em nenhum campo de investimento.

> **RN-INV-09** — O rendimento é **deduzido**, nunca digitado: `saldo atual − (saldo inicial + aportes − resgates)`. Por isso o **saldo atual acompanha automaticamente** os aportes e resgates digitados, preservando o rendimento já informado. Assim que o usuário digita o saldo real, o ajuste automático para e o valor dele prevalece. Sem esse ajuste, lançar um aporte sem corrigir o saldo faria o aporte aparecer como prejuízo, e um resgate apareceria como lucro.

> **RN-INV-10** — O formulário mostra o rendimento do mês em tempo real, com a conta aberta (`saldo inicial + aportes − resgates = aplicado`) e aviso quando o rendimento fica negativo.

> **RN-INV-05** — Renomear o banco, a aplicação ou a classe atualiza a **identidade da série inteira**, inclusive nos meses anteriores. Os valores dos meses anteriores não são alterados. Sem isso, a mesma aplicação apareceria como duas instituições diferentes nos gráficos e no relatório anual.

> **RN-INV-06** — A cascata para os meses seguintes **preserva o rendimento já lançado** em cada mês: o rendimento é calculado antes de o saldo inicial ser alterado e recomposto depois. Corrigir um mês anterior não apaga o rendimento dos seguintes.

> **RN-INV-07** — Excluir um investimento remove o registro do mês selecionado **e dos meses seguintes** da mesma série. Os meses anteriores e as demais aplicações não são afetados. A confirmação informa explicitamente o alcance da exclusão.

> **RN-INV-08** — Ao adicionar uma aplicação cujo banco e tipo já existem no mês, o sistema pergunta se deve atualizar o registro existente. A comparação ignora maiúsculas e espaços. Respondendo que não, um registro separado é criado — o usuário pode ter duas aplicações de nome parecido.

### 4.8 Metas

> **RN-META-01** — O valor-alvo deve ser maior que zero.

> **RN-META-02** — O valor inicial não pode ser negativo.

> **RN-META-03** — Cada meta possui histórico de contribuições, com inclusão, edição e remoção individuais.

> **RN-META-04** — Havendo data-alvo, o sistema calcula o valor mensal necessário e projeta a data de conclusão no ritmo atual de contribuições.

> **RN-META-05** — O valor de uma contribuição não pode ser negativo, nem na inclusão nem na edição.

> **RN-META-06** — Na criação de um novo ano, as metas do ano anterior são copiadas com nome, valor-alvo, valor atual, prazo e histórico de contribuições preservados; apenas os identificadores são novos.

### 4.9 Backup

> **RN-BKP-01** — A exportação gera um arquivo JSON com todos os dados do usuário.

> **RN-BKP-02** — A importação **substitui integralmente** os dados atuais, mediante confirmação explícita.

> **RN-BKP-03** — Arquivos que não correspondam à estrutura esperada são rejeitados com mensagem de erro.

### 4.10 Notificações WhatsApp

> **RN-NOT-01** — O envio ocorre duas vezes ao dia: **08:00** e **19:00** (horário de Brasília). O agendamento roda em UTC (`0 11` e `0 22`).

> **RN-NOT-02** — Nenhuma mensagem é enviada quando não há despesas a vencer (em breve ou hoje) nem vencidas — **exceto** o aviso de mês quitado da RN-NOT-09.

> **RN-NOT-03** — A mensagem é dividida em duas páginas lógicas: **página 1 = despesas**, **página 2 = orçamentos**. Cada página é autocontida e encerra com a assinatura.

> **RN-NOT-04** — Cada página comporta até **20.000 caracteres** (limite do provedor). Na prática as mensagens do sistema nunca chegam perto disso; a divisão em partes numeradas só entraria em ação em um caso extremo.

> **RN-NOT-05** — Entre envios consecutivos há um pequeno intervalo (2 segundos), como boa prática de uso da API.

> **RN-NOT-06** — Basta o contato ter um **número** cadastrado para receber mensagens — não há chave de ativação por destinatário.

> **RN-NOT-07** — O envio é feito por **uma única conta de WhatsApp conectada ao sistema** (o número "remetente", vinculado por QR Code). Os destinatários não precisam instalar, ativar ou confirmar nada — apenas ter o número cadastrado no app.

> **RN-NOT-08** — O plano gratuito do provedor de envio permite até **3 números de destino** diferentes.

> **RN-NOT-09** — **Aviso de mês quitado.** Quando a última conta em aberto de um mês é paga, o serviço envia uma mensagem de fechamento informando que todas as contas daquele mês foram pagas, com a quantidade de contas e o total pago. Se o outro mês acompanhado ainda tiver contas em aberto, a mensagem informa quantas e o valor. Antes dessa regra, pagar a última conta simplesmente interrompia os envios, sem retorno ao usuário.

> **RN-NOT-10** — O aviso de mês quitado sai **uma única vez por mês fechado**. O controle fica em `appSettings.notificacoes.mesesQuitadosAvisados`, uma lista de chaves `Mês/Ano`. Se o mês voltar a ter conta em aberto, a chave é removida e o aviso é rearmado para quando ele fechar de novo.

> **RN-NOT-11** — Os meses acompanhados pelo aviso são o **mês anterior** e o **mês atual**, os mesmos que o serviço já considera. No máximo um aviso de fechamento é enviado por execução: o mês mais recente que acabou de fechar.

> **RN-NOT-12** — Um mês **sem nenhuma despesa cadastrada** não é considerado quitado e não gera aviso.

> **RN-NOT-13** — Na primeira execução após a implantação, o serviço apenas **registra** a situação dos meses já fechados, sem enviar aviso, para não anunciar meses que foram quitados antes da regra existir.

> **RN-NOT-14** — Havendo vencimentos a comunicar na mesma execução, o aviso de mês quitado é enviado **antes** das páginas de despesas e orçamentos.

### 4.11 Cartões e parcelamentos

> **RN-TER-28** — A lista de Parcelamentos sai **agrupada por pessoa**, com uma faixa trazendo o ponto colorido, o nome, a contagem de compras e o subtotal — "a pagar" nas suas, "a receber" nas de terceiros. "Suas compras" vem primeiro; depois as pessoas, pela maior quantia em aberto. A ordenação escolhida continua valendo **dentro** de cada grupo, e a etiqueta do nome sai da linha, já que a faixa a carrega. O agrupamento só aparece quando há compra de terceiro no conjunto visível: em "só as suas", ou para quem não empresta o cartão, a tabela fica exatamente como antes. Filtrando por uma pessoa, a faixa permanece, porque é ali que o subtotal dela aparece.

> **RN-TER-29** — O agrupamento se apresenta como uma **árvore**: a faixa da pessoa, as linhas das compras dela e o ponto na frente de cada compra usam a mesma cor, ligados por um tronco vertical e um ramo horizontal que nasce na faixa e morre em cada linha — o último ramo fecha o grupo. "Suas compras" segue o mesmo desenho, na cor de destaque do sistema. No celular, onde não há espaço para o tronco, a cor passa para a borda esquerda do cartão da compra.

> **RN-ASS-01** — Uma **assinatura** é um parcelamento sem fim: mesmo cadastro, mesmo cartão, mesma pessoa, sem total de parcelas. Marcada a opção, o formulário esconde "total de parcelas" e "à vista" — dois campos que pediriam um número que não existe — e o valor passa a ser "por mês". Guardada com `recorrente: true` e `totalInstallments: 0`.

> **RN-ASS-02** — Como não há fim, quem decide até onde gerar cobranças é o **horizonte escolhido na aba Projeção**, o mesmo número que o usuário já enxerga lá, e não uma constante escondida no código. A geração continua sendo a de sempre (`planInstallments`), então limite do cartão, fatura prevista, projeção e extrato enxergam a assinatura sem código novo; a sincronização de faturas previstas, que repetia a geração à mão, passou a usar o mesmo gerador.

> **RN-ASS-03** — Cancelar é **encerrar**, nunca excluir: grava-se o mês da última cobrança (`endMonth`/`endYear`). O histórico fica, o que estiver pendente continua cobrável, e a partir do mês seguinte nenhuma cobrança nova é gerada. O encerramento não pode ser anterior à primeira cobrança, e limpar os campos reativa a assinatura. O botão na lista encerra no mês selecionado, com confirmação que diz qual será a última cobrança.

> **RN-ASS-04** — Dívida de assinatura ativa conta **apenas o que já foi cobrado** até o mês selecionado: ninguém deve por uma mensalidade que ainda não caiu. O compromisso futuro aparece à parte, como "R$ X/mês", na linha da compra, na faixa da pessoa e no subtítulo da lista. Encerrada, a assinatura vira uma série fechada e volta a somar como qualquer parcelamento.

> **RN-ASS-05** — O serviço de WhatsApp espelha a geração, limitada ao mês sobre o qual ele está falando — ele olha um mês por vez e não precisa de horizonte. Sem isso, o custo próprio das faturas ignoraria a assinatura de terceiro.

> **RN-PROP-01** — Ao nascer um **mês novo**, a despesa do mês-modelo é propagada conforme o que ela é, e não por uma regra só: uma **parcela** avança a contagem e **mantém o valor** (a 3/23 vira 4/23, pelo mesmo valor); uma **recorrente** chega com o valor do cadastro e o vencimento da RN-REC-05; qualquer outra despesa continua nascendo **zerada**, que é o esqueleto que o usuário preenche. A parcela cuja série terminou simplesmente **não é copiada**.

> **RN-PROP-02** — O **ano novo** segue a mesma regra, com o deslocamento contado do mês-modelo até cada mês do ano que nasce: o financiamento em 3/23 em dezembro entra como 4/23 em janeiro e 15/23 em dezembro seguinte. As recorrentes do ano anterior são recriadas em todos os meses, mesmo as que não estavam no mês-modelo. Antes, o ano nascia com tudo zerado e sem parcelamento, e o usuário perdia valor e contagem na virada.

> **RN-PROP-03** — A cascata que cria as parcelas seguintes ao salvar uma despesa parcelada **atravessa a virada de ano**. Antes ela parava em dezembro, e as parcelas do ano seguinte nunca existiam. Mês ainda não criado é pulado — quando o ano nascer, a RN-PROP-02 continua a série a partir dele.

> **RN-PROP-04** — A RN-PROP-02 arruma a **criação** do ano, não o que já está gravado: um ano criado antes dela continua com as parcelas zeradas. Para esses, **Configurações → Reaplicar parcelas e recorrentes** reaplica a regra ao **ano selecionado**, tocando apenas no que está **intocado — valor R$ 0,00 e não pago**. Faturas de cartão ficam de fora, porque têm cálculo próprio, e o vencimento existente é preservado: a criação do ano sempre soube deslocar a data, o que ela perdia era valor e contagem. A parcela cuja série já terminou é removida. O botão mostra, linha a linha, o que pretende mudar antes de gravar, e rodar de novo não faz nada.

> **RN-REC-07** — O valor do cadastro da recorrente é o **padrão, não uma ordem permanente**. Imposto sobe, conta de luz varia: o ajuste feito num mês específico, pela aba Despesas, **sobrevive** a edições da recorrente que não toquem no valor. Só alterar o valor no cadastro reescreve os meses, da competência inicial em diante — simétrico à RN-REC-06, que faz o mesmo com o vencimento.

> **RN-PLAN-05** — A busca da lista de parcelamentos cobre **a linha inteira**, não só a descrição: nome da compra, pessoa, cartão, valor da parcela, quanto falta, contagem de parcelas, primeira e última competência e a situação. O valor é reconhecido com vírgula, com ponto, sem separador e só a parte inteira. Vários termos separados por espaço funcionam como **"e"**.

> **RN-CARD-05** — O cartão informa **em que mês a sua fatura vence**: no próprio mês da competência ou **no mês seguinte** (`dueMonthOffset`). Antes havia apenas dedução — "vence depois de fechar, então é no mesmo mês" —, que erra justamente no arranjo mais comum: fecha dia 8, paga dia 15 **do mês seguinte**. Com a dedução, a fatura prevista nascia vencendo dentro da própria competência. Cartão novo nasce em "mês seguinte"; cartão antigo abre com o que vinha sendo deduzido, para que abrir e salvar não mova data nenhuma. Mudar o campo oferece **realinhar as faturas em aberto**, recalculando o mês — ao contrário da troca de dia (RN-TER-18), que respeita o mês onde a fatura já está. Faturas pagas e vencidas nunca são tocadas. O ciclo aprendido de uma fatura lançada passou a considerar também a **do próprio mês**, que é a evidência mais direta.

> **RN-CARD-01** — **Fatura prevista.** Ao cadastrar um parcelamento, o sistema cria nos meses futuros a fatura daquele cartão já com a soma das parcelas do mês. É um lançamento comum: conta nos totais do mês, na Evolução Anual e na Saúde Financeira. O usuário depois substitui pelo valor real da fatura.

> **RN-CARD-13** — **Trava do valor.** Enquanto o valor vier do sistema, a despesa carrega `valorAutomatico: true`, é marcada como "prevista" na tela e se mantém igual à soma das parcelas, acompanhando novos parcelamentos. Assim que o usuário **digita um valor diferente**, a trava cai, a etiqueta some e o sistema nunca mais altera aquele valor. Detalhar compras na fatura também derruba a trava.

> **RN-CARD-14** — **Meses passados nunca são tocados.** A geração vale do mês corrente em diante, para não reescrever histórico já fechado.

> **RN-CARD-15** — Se a fatura do mês já existir, ela é reaproveitada em vez de duplicada — inclusive quando está sem vínculo e o nome contém o do cartão, caso em que recebe o vínculo automaticamente.

> **RN-CARD-16** — Parcelas que caem em um ano **ainda não criado** entram quando aquele ano for criado. Excluir um parcelamento recalcula as faturas previstas e remove as que ficarem sem nenhuma parcela, desde que ainda estejam travadas e não pagas.

> **RN-CARD-02** — Um parcelamento é cadastrado uma única vez (descrição, cartão, valor da parcela, número de parcelas e mês da primeira). O sistema distribui as parcelas mês a mês, **virando o ano** quando necessário.

> **RN-CARD-03** — O **dia de fechamento** do cartão determina em qual fatura cai uma compra: comprando depois do fechamento, a primeira parcela vai para a fatura seguinte. Informando a data da compra, o sistema sugere o mês da primeira parcela e explica o motivo.

> **RN-CARD-04** — **Saldo devedor** de um cartão é a soma das parcelas ainda não vencidas, contando o mês de referência em diante.

> **RN-CARD-05** — **Uso do limite** é a fatura do mês de referência — ou, se ela ainda não foi lançada, as parcelas daquele mês — somada às parcelas dos meses seguintes. A parcela do mês corrente nunca é contada duas vezes.

> **RN-CARD-06** — Se a fatura lançada for **menor** que as parcelas conhecidas daquele mês, o sistema alerta: ou o valor está errado, ou um parcelamento já terminou e não foi encerrado.

> **RN-CARD-07** — Excluir um cartão exclui também os parcelamentos ligados a ele, com confirmação que informa a quantidade.

> **RN-CARD-08** — Na projeção, as parcelas conhecidas entram como compromisso **apenas nos meses cuja fatura daquele cartão ainda não foi lançada**. Quando a fatura existe, o valor dela já contém a parcela.

> **RN-CARD-09** — O vínculo entre a fatura e o cartão é feito pelo campo `cardId`. Ao cadastrar ou editar um cartão, o sistema procura em todos os anos os lançamentos **sem vínculo** cujo nome contenha o nome do cartão (ignorando acentos e maiúsculas) e oferece vinculá-los de uma vez.

> **RN-CARD-10** — Enquanto existirem lançamentos com nome parecido e sem vínculo, a aba Cartões exibe alerta com botão para vincular, porque sem o vínculo a projeção contaria a fatura e as parcelas em dobro.

> **RN-CARD-11** — Nos meses em que a fatura de um cartão **ainda não foi lançada**, a aba Despesas exibe um bloco com as parcelas conhecidas daquele mês, informando que já estão na projeção. Sem isso, um parcelamento recém-cadastrado não apareceria em nenhum lugar da aba.

> **RN-CARD-12** — A lista de parcelamentos tem filtros de cartão, situação (em aberto, concluídos, todos), busca por texto e ordenação (última parcela, falta pagar, valor da parcela, nome). O subtítulo informa quantos itens o filtro mostra e o total a pagar.

---

### 4.12 Projeção

A projeção estima receitas, despesas e saldo dos meses futuros. Cada mês projetado é a soma de duas partes, sempre exibidas separadas.

| Parte | O que é | Origem |
|---|---|---|
| **Já cadastrado** | Compromisso existente naquele mês: recorrentes, parcelas a vencer e lançamentos manuais | Dados do sistema, não é estimativa |
| **Estimado** | Quanto o histórico sugere que ainda vai aparecer além do que já está cadastrado | Cálculo estatístico |

> **RN-PROJ-01** — A projeção de um mês é `já cadastrado + estimado`. A parte estimada é a previsão do método menos o que já está cadastrado, com piso em zero: a projeção **nunca** fica abaixo do compromisso já assumido.

> **RN-PROJ-02** — O método padrão é **regressão linear** (mínimos quadrados) sobre os meses com movimento. Ele só é usado com **4 meses ou mais** de histórico e **R² maior ou igual a 0,2**. Fora dessas condições, o sistema usa a **média ponderada** dos 3 últimos meses, com pesos 3, 2 e 1 do mais recente para o mais antigo.

> **RN-PROJ-03** — Nenhuma previsão é negativa. Tendências de queda acentuada travam em zero.

> **RN-PROJ-04** — A previsão tem teto de **1,5x o maior mês já registrado**, para que um mês atípico não distorça todo o período.

> **RN-PROJ-05** — Quando o mês futuro já tem renda cadastrada, ela é usada como está. A receita só é estimada quando não há nada cadastrado naquele mês.

> **RN-PROJ-06** — Meses **sem movimento** ficam fora do histórico, para não rebaixar a média artificialmente.

> **RN-PROJ-07** — Horizonte: a aba Projeção oferece 3, 6 ou 12 meses, com 6 como padrão, virando o ano quando necessário. O card do Dashboard usa **todos os meses restantes até Dezembro** do ano selecionado; estando em Dezembro, mostra os 3 primeiros meses do ano seguinte.

> **RN-PROJ-08** — A projeção por categoria soma a parte cadastrada da categoria com a sua fatia histórica da parte estimada, e compara o resultado com o orçamento multiplicado pelo número de meses do período.

> **RN-PROJ-09** — O mesmo cálculo alimenta a aba Projeção e o card do Dashboard; as duas telas nunca apresentam números diferentes.

> **RN-PROJ-10** — *Limitação conhecida:* a projeção não considera sazonalidade (13º salário, IPVA, IPTU, festas de fim de ano). Meses com despesas sazonais tendem a ficar subestimados.

> **RN-PROJ-11** — O indicador de confiança exibido é o **R²** do ajuste, em percentual. Quando o método é a média ponderada, não há R² a exibir e o sistema informa o motivo da escolha.

---

### 4.13 Compras de terceiros nos cartões

Outras pessoas usam os cartões do titular. Essas compras aparecem na fatura, porque o cartão é dele e o banco cobra o total — mas não são despesa dele e não podem comprometer a renda dele. A separação acontece **no cálculo, não no valor lançado**: a fatura mantém o valor cheio, que bate com o extrato, e o custo próprio é derivado dele.

| Número | Qual valor usa | Por quê |
|---|---|---|
| Despesas do Mês, saldo, taxa de poupança | sua parte | é o custo real do titular |
| Saúde Financeira e orçamentos | sua parte | compra de terceiro não pode estourar categoria alheia |
| Valor da fatura na lista de despesas | cheio | precisa bater com o cartão |
| Total pago / faltante no mês | cheio | é o dinheiro que sai da conta |
| Alertas de vencimento | cheio | é o que precisa ter em conta no dia |
| Uso do limite do cartão | cheio | o limite é consumido igual |
| Relatórios e evolução mensal | sua parte | comparar meses só faz sentido com o custo próprio |
| Projeção: despesa e saldo | sua parte | o reembolso volta, não é perda |
| Projeção: coluna "De terceiros" | parte de terceiros | mostra o desembolso que o titular adianta |

> **RN-TER-01** — Um parcelamento com `personId` preenchido é de terceiro. Ele continua dentro da fatura e continua consumindo limite, mas sai dos totais do titular. Com `personId` nulo, tudo se comporta exatamente como nas versões anteriores.

> **RN-TER-02** — A parte de terceiros **não é armazenada na despesa**: é derivada dos parcelamentos. Guardar nos dois lugares permitiria divergência entre a despesa e os planos sem como saber qual está certo. A única fonte de verdade são os planos.

> **RN-TER-03** — `recalculateSummaries` grava no resumo do mês o **custo próprio**, não o valor cheio das faturas. Dashboard, Relatórios e Projeção bebem desse resumo. O resumo também guarda `expensesTotais` (caixa) e `terceiros` (diferença).

> **RN-TER-04** — Orçamentos e Saúde Financeira usam o custo próprio: a compra de outra pessoa não estoura a categoria do titular.

> **RN-TER-05** — A aba Despesas é o extrato de caixa e exibe os valores cheios. Quando há parte de terceiros no mês, um aviso no topo informa o valor, as pessoas envolvidas e qual é o custo real — sem ele, a aba e o Dashboard pareceriam contraditórios.

> **RN-TER-06** — A linha da fatura mostra a divisão: `seu X · Pessoa Y · Pessoa Z`. A soma das etiquetas é sempre igual ao valor lançado.

> **RN-TER-07** — Excluir uma pessoa com compras lançadas é **bloqueado**, com mensagem explicando. Sem isso, as parcelas ficariam órfãs e voltariam a contar como despesa do titular sem nenhum aviso.

> **RN-TER-08** — O uso do limite conta tudo, inclusive terceiros, porque o cartão é do titular. O cartão informa quanto do comprometido é de terceiros, sem alterar o percentual.

> **RN-TER-09** — Salvar uma fatura com valor **menor** que a parte de terceiros exige confirmação, explicando que o custo próprio vai a zero. O custo próprio tem piso em zero e nunca fica negativo.

> **RN-TER-10** — Cada parcela de terceiro tem situação própria: **recebida** (com data), **a receber** (mês corrente ou futuro) ou **atrasada** (mês de calendário já passado e não recebida). O atraso é medido contra o mês real, e não contra a competência, que pode estar parada por conta não paga.

> **RN-TER-11** — Marcar uma parcela como recebida **apenas baixa o débito**. O reembolso não entra como receita: a despesa correspondente já ficou de fora dos totais, e contá-la de novo inflaria a renda duas vezes. O recebimento pode ser desfeito.

> **RN-TER-12** — A previsão de terceiros de um mês soma as parcelas de terceiro de todos os cartões. Quando a fatura daquele mês já foi lançada, o teto é o valor dela — senão a soma passaria do que o cartão vai cobrar.

> **RN-TER-13** — A projeção apresenta os dois olhares: `despesa` é o compromisso do titular e é o que move o saldo; `desembolso` é despesa mais terceiros, o que de fato sai da conta no vencimento. O saldo acumulado segue o compromisso — tratar o reembolso como perda faria o acumulado cair sem motivo.

> **RN-TER-14** — Uma compra à vista de terceiro é registrada como parcelamento de **uma parcela**, reaproveitando distribuição, fatura prevista, limite e extrato. Na tela aparece como "à vista", não como "1/1".

> **RN-TER-15** — Nomes de pessoas são únicos, ignorando acentos e maiúsculas: nome repetido tornaria o extrato ambíguo.

> **RN-TER-16** — Editar um parcelamento preserva os recebimentos já registrados. Passar a compra de uma pessoa para o titular limpa os recebimentos, que deixam de ter sentido.

> **RN-TER-17** — A parcela de terceiro vence junto com a fatura daquele cartão naquele mês, porque é quando o dinheiro sai da conta do titular. A data é buscada nesta ordem: **vencimento da fatura lançada → ciclo do cartão (RN-TER-20) → último dia do mês**. Só fica atrasada depois que essa data passa; vencer hoje ainda é "a receber". O extrato mostra a data de vencimento em cada parcela, para a situação ser conferível.

> **RN-TER-20** — Competência e vencimento também se separam no cartão: a fatura de Outubro **fecha** em Outubro e costuma ser **paga** em Novembro. Para os meses sem fatura lançada, o sistema descobre o ciclo daquele cartão nesta ordem:
> 1. **aprende com as faturas já lançadas** — procura a mais próxima (um mês antes, um depois, até três de distância) e repete o intervalo e o dia que o usuário usou;
> 2. **deduz do cadastro** — vencimento igual ou anterior ao fechamento significa que a fatura só vence no mês seguinte (fecha dia 25, vence dia 5); vencimento posterior ao fechamento vence no próprio mês (fecha dia 10, vence dia 11).
>
> Supor que a fatura vence dentro do próprio mês fazia a 2ª parcela vencer **antes** da 1ª, e a mais nova aparecia atrasada com a mais velha em dia.

> **RN-TER-21** — **Cadência mensal.** Um parcelamento é, por definição, uma parcela por mês: o intervalo entre elas é sempre de um mês. O vencimento da **1ª parcela** é a âncora — da fatura lançada daquele mês, ou do ciclo do cartão — e as demais andam de mês em mês a partir dela, preservando o dia e ajustando fim de mês. A fatura lançada de um mês posterior só é usada se cair no mês que a cadência prevê; fora disso está fora de cadência e é ignorada. Derivar cada mês isoladamente produzia parcelas a **um dia** de distância em vez de um mês, quando uma fatura estava registrada vencendo dentro da própria competência e a outra no mês seguinte. Uma trava final impede que a sequência inverta em qualquer situação.

> **RN-TER-26** — O serviço de WhatsApp calcula o consumo dos **orçamentos** pelo custo próprio, não pelo valor cheio das faturas: compra de terceiro no seu cartão não pode estourar a sua categoria. Quando há parte de terceiros no mês, a mensagem diz quanto ficou de fora e por quê. Os avisos de vencimento e o total pago seguem com o valor cheio, porque é esse o dinheiro que sai da conta. A lógica de `custoProprio` existe **em dois lugares** — o app é arquivo único sem build e o serviço roda em Node, sem como compartilhar módulo —, e um cenário de teste compara os dois lados contra os mesmos dados para impedir que divirjam em silêncio.

> **RN-CARD-01** — O detalhamento de compras dentro da fatura foi **removido** na v2.5: os Parcelamentos cobrem o mesmo caso com mais precisão (atravessam o ano, sabem de quem é a compra, consomem limite e entram na projeção). O antigo propagava a parcela pelo **nome** da fatura e só dentro do ano, além de tornar o valor da fatura derivado e somente leitura. Lançamentos antigos preservam o valor e voltam a aceitar edição.

> **RN-TER-27** — Os filtros da aba Pessoas (busca, cartão, situação e ordenação) recalculam a lista **e os indicadores do topo**, e o contador avisa quando os indicadores estão seguindo o filtro. Com um cartão escolhido, os números de cada pessoa passam a ser os daquele cartão, para a soma dos cards bater com o indicador logo acima.

> **RN-TER-25** — O extrato da pessoa abre com **o que cobrar agora**: o primeiro indicador mostra o valor a receber **no mês selecionado no topo**, e não no mês do calendário, para nunca divergir do card "A receber em X" da aba Pessoas que fica atrás do modal. O subtítulo diz quantas parcelas compõem o valor — uma pessoa pode ter mais de uma compra caindo no mesmo mês — e sinaliza quantas estão atrasadas. Quando aquele mês não tem parcela dessa pessoa, o card passa a mostrar a **próxima a vencer**, com mês e data: um R$ 0,00 sem explicação não ajuda. Quando tudo do mês já foi acertado, mostra "recebido". O número de compras em aberto saiu de card próprio e virou subtítulo do total, porque repetia o que o cabeçalho e a lista abaixo já informam.

> **RN-TER-24** — Os indicadores da aba Pessoas e do extrato seguem a mesma anatomia dos cards da aba Despesas: faixa colorida à esquerda, valor na cor do indicador e ícone em medalhão. Cada um tem cor e ícone próprios — **a receber** em âmbar, cor de pendência; **total em aberto** em azul; **atrasado** em vermelho, virando verde com visto quando não há nada vencido; **já recebido** em verde. No tema claro e na impressão os tons são escurecidos, pela mesma razão da RN-TER-23.

> **RN-TER-23** — Cada pessoa tem uma **cor**, escolhida no cadastro a partir de uma paleta de 12 tons. A cor aparece como ponto antes do nome na aba Pessoas e no extrato, e tinge a etiqueta do nome na lista de parcelamentos, na linha da fatura, no aviso da aba Despesas e no card do Dashboard. A paleta é fechada, e não um seletor livre, porque os tons foram calibrados para ter contraste no tema escuro e no claro — que é o usado na exportação em PDF; no claro eles são escurecidos por filtro. Pessoa cadastrada antes desta versão, sem cor gravada, recebe uma cor derivada da própria identificação: estável entre sessões e aparelhos. Ao cadastrar, o sistema já sugere a primeira cor ainda não usada.

> **RN-TER-22** — Ao **criar fatura prevista** ou **realinhar vencimentos**, o dia vem sempre do cartão e o mês vem do ciclo (RN-TER-20). O realinhamento alcança apenas o que ainda está pela frente — fatura não paga cujo vencimento ainda não passou — e **preserva o mês de cada fatura**, trocando só o dia: recalcular o mês moveria faturas que o próprio usuário posicionou.

> **RN-TER-18** — Mudar o dia de vencimento do cartão **não altera sozinho** as faturas já lançadas, porque `dueDate` é a fonte de verdade de cada despesa. O sistema oferece realinhar as faturas ainda não pagas, da competência em diante; o passado fica como está. Valor e situação de pagamento não são tocados.

> **RN-TER-19** — O detalhe de quem deve mora na aba **Pessoas**. A aba Cartões mantém apenas um resumo com link, porque os dois assuntos continuam ligados — a compra é de alguém *e* é de um cartão — mas cada tela responde a uma pergunta diferente.

---

### 4.14 Interface

> **RN-UI-02** — A navegação tem três formas, pela largura da tela:
> - **até 767px** — barra com botão hambúrguer e o nome da aba atual; a navegação vive numa **gaveta lateral** com itens verticais, agrupados em submenus recolhíveis, alvos de toque de no mínimo 48px, rolagem interna só quando necessária, e fechamento pelo X, por toque fora, pela tecla Esc ou ao escolher um item. Enquanto aberta, a rolagem do fundo fica travada.
> - **768px a 1279px** — grade de 5 colunas, duas fileiras alinhadas. Os nove rótulos somam cerca de 960px e não cabem em uma linha; a grade evita a sobra solta que o simples `flex-wrap` produzia.
> - **1280px em diante** — fileira única, com padding fluido (`clamp`).
>
> Em nenhuma faixa há rolagem horizontal, e nenhum item fica escondido.

> **RN-UI-03** — Os itens da gaveta são **gerados a partir dos próprios botões de aba**, e escolher um dispara o clique da aba correspondente. Não existe uma segunda lista de navegação para manter em sincronia: acrescentar uma aba basta para ela aparecer nos dois lugares.

> **RN-UI-04** — **Toda ação destrutiva ou que cria dado na lista de despesas confirma antes**: excluir, duplicar e **editar**. O ícone de lápis abre um alerta com o nome e o valor da despesa; recusar não abre o formulário. O clique errado numa tabela densa é fácil, e o formulário de edição salva por cima.

> **RN-UI-05** — Cada despesa tem um **ícone de pago** nas ações, que resolve uma linha sozinha, sem passar pela seleção em lote. O ícone sai verde quando a despesa está paga e cinza quando está pendente, e o clique abre um alerta dizendo para qual estado vai ("como PAGA?" ou "como PENDENTE?"). A marcação em lote continua existindo para quando forem várias.

> **RN-UI-01** — Um modal aberto sobre outro vai para a frente. Sem isso, quem decide a ordem é a posição no HTML, e o modal mais novo pode nascer atrás do que já estava aberto, travando a tela — foi o que acontecia ao cadastrar uma pessoa de dentro do formulário de parcelamento.

---

### 4.15 Relatórios

> **RN-REL-05** — A linha "Projeção de despesas" do Fluxo de Caixa e o KPI "Projeção (resto do ano)" usam o **mesmo motor da aba Projeção**. Até a v2.5 cada um fazia a própria conta (média simples dos meses com movimento, e gasto médio × meses restantes), o que permitia três números diferentes para a mesma pergunta — contrariando a RN-PROJ-09.

> **RN-REL-06** — A linha de projeção começa no último mês com despesa lançada, ancorada no valor real daquele mês, e segue até o fim do período. Quando **não há mês a projetar** — todo o período já tem lançamento — a série inteira é omitida, inclusive da legenda, e uma nota abaixo do gráfico explica o motivo. Antes, o rótulo continuava na legenda sem nenhuma linha desenhada e o gráfico parecia defeituoso.

> **RN-REL-07** — *Limitação conhecida:* a previsão conta passos a partir do fim do histórico, não da distância no calendário. Havendo meses vazios entre o último lançamento e o mês projetado, a tendência é aplicada com menos passos do que os meses realmente decorridos, e a projeção fica subestimada. Só acontece com lacunas no cadastro.

---

## 5. Histórias de Usuário

### HU-01 — Autenticação
> **Como** titular da conta,
> **quero** entrar com e-mail e senha,
> **para** acessar meus dados com segurança de qualquer dispositivo.

**Critérios de aceite**

- [ ] Dado que informo credenciais válidas, então acesso o sistema e meus dados são carregados.
- [ ] Dado que informo credenciais inválidas, então recebo mensagem de erro e permaneço na tela de login.
- [ ] Dado que já fiz login, quando reabro o sistema, então permaneço autenticado.
- [ ] Somente o usuário autenticado acessa seu próprio documento no banco.

---

### HU-02 — Visualizar o panorama do mês
> **Como** usuário,
> **quero** ver um resumo do mês ao abrir o sistema,
> **para** entender minha situação financeira sem navegar por várias telas.

**Critérios de aceite**

- [ ] Ao abrir, o sistema seleciona automaticamente o **mês de competência** (RN-CICLO-06): o mês anterior enquanto ele tiver conta não paga, senão o mês corrente.
- [ ] Abrindo em um mês passado, o sistema informa o motivo e quantas contas estão em aberto.
- [ ] São exibidos os KPIs: Receitas do Mês, Despesas do Mês, Saldo Restante, Taxa de Poupança, Total Pago no Mês, Total Faltante a Pagar, Saldo Acumulado, Próximos 7 Dias.
- [ ] Os KPIs comparam com o mesmo mês do ano anterior quando houver dados.
- [ ] É exibida a nota de Saúde Financeira com o detalhamento dos três componentes.
- [ ] O bloco "O que significa essa nota?" explica cada componente e as faixas.
- [ ] O card **Previsão de Gastos** mostra todos os meses restantes do ano, com o valor previsto de cada um, a separação entre já cadastrado e estimado, o total do período e a média mensal.
- [ ] O card oferece atalho para a aba Projeção.

---

### HU-03 — Ser alertado sobre contas críticas
> **Como** usuário,
> **quero** ver alertas destacados no topo do Dashboard,
> **para** identificar imediatamente o que exige ação.

**Critérios de aceite**

- [ ] Havendo contas vencidas, exibe alerta **vermelho**: "X conta(s) vencida(s) — R$ Y em atraso".
- [ ] Havendo contas vencendo hoje, exibe alerta **laranja** com ícone de relógio: "X conta(s) vencem hoje — R$ Y".
- [ ] Havendo orçamentos estourados, exibe alerta **roxo**: "X orçamento(s) estourado(s) neste mês".
- [ ] Cada alerta aparece apenas quando existe a situação correspondente.
- [ ] Os alertas usam a mesma base do painel de Lembretes (mês selecionado + anterior, sem duplicar), de modo que as contagens das duas áreas coincidem.

---

### HU-04 — Acompanhar contas a pagar
> **Como** usuário,
> **quero** ver minhas contas pendentes agrupadas por urgência,
> **para** saber o que pagar primeiro.

**Critérios de aceite**

- [ ] As contas são agrupadas em: Vencidas (não pagas), Vencendo hoje, Vencendo em breve, Mais adiante.
- [ ] Cada grupo só aparece quando possui itens.
- [ ] Cada linha exibe ícone de estado, nome, valor e etiqueta de vencimento.
- [ ] Contas pagas não aparecem.
- [ ] Sem pendências, exibe: "Nenhuma conta pendente. Tudo em dia!".
- [ ] O painel considera o mês selecionado e o mês anterior, sem duplicar itens.
- [ ] Despesas pendentes sem data de vencimento aparecem em "Mais adiante" e não somem da tela.

---

### HU-05 — Cadastrar despesa com vencimento no mês seguinte
> **Como** usuário,
> **quero** registrar uma despesa em um mês e informar a data de vencimento real,
> **para** que o sistema saiba a competência e o vencimento corretamente.

**Critérios de aceite**

- [ ] O formulário oferece campo de **data completa** de vencimento (dia/mês/ano).
- [ ] Em uma nova despesa, o campo sugere o primeiro dia do mês seguinte.
- [ ] A despesa permanece vinculada ao mês em que foi cadastrada.
- [ ] A tabela exibe o vencimento no formato dia/mês (ex.: 15/07).
- [ ] Valores negativos são rejeitados.
- [ ] Em despesa parcelada, parcela atual maior que o total é rejeitada.
- [ ] Cada parcela seguinte vence um mês depois da anterior, com ajuste de dia inexistente (31/01 → 28/02).
- [ ] A data sugerida respeita o fuso local, inclusive no período da noite.

---

### HU-06 — Organizar e localizar despesas
> **Como** usuário,
> **quero** filtrar, buscar e ordenar minhas despesas,
> **para** encontrar rapidamente o que procuro.

**Critérios de aceite**

- [ ] Filtros disponíveis: categoria, status (Pagas / Pendentes / Todos) e tag.
- [ ] Busca por texto considera nome e tags.
- [ ] Ordenações: padrão, vencimento, nome (A‑Z), maior valor, menor valor, data mais recente.
- [ ] A ordenação por vencimento usa a data completa; itens sem data vão para o fim.
- [ ] Cada grupo de categoria exibe o total e o percentual do mês com duas casas decimais.

---

### HU-07 — Executar ações em lote
> **Como** usuário,
> **quero** selecionar várias despesas de uma vez,
> **para** marcá-las como pagas ou copiá-las para o próximo mês.

**Critérios de aceite**

- [ ] O seletor do cabeçalho marca e desmarca todas as despesas do grupo.
- [ ] O seletor reflete estado parcial quando apenas algumas estão marcadas.
- [ ] Ações disponíveis: marcar como pagas, marcar como pendentes, copiar para o próximo mês.
- [ ] Sem mês seguinte cadastrado, exibe: "Não há próximo mês cadastrado neste ano.".
- [ ] Após copiar, confirma: "X despesa(s) copiada(s) para [mês]".
- [ ] As cópias recebem o vencimento recalculado para o novo mês de competência (RN-CICLO-07).

---

### HU-08 — Controlar faturas de cartão
> **Como** usuário,
> **quero** detalhar as compras que compõem uma fatura,
> **para** saber a origem de cada valor.

**Critérios de aceite**

- [ ] É possível abrir uma despesa e cadastrar compras individuais.
- [ ] O valor da despesa-pai é atualizado automaticamente com a soma das compras.
- [ ] A lista é atualizada imediatamente após incluir ou excluir uma compra.
- [ ] Compras parceladas propagam para o mês seguinte com a parcela incrementada.

---

### HU-09 — Acompanhar investimentos
> **Como** usuário,
> **quero** registrar meus investimentos mês a mês,
> **para** acompanhar a evolução do meu patrimônio.

**Critérios de aceite**

- [ ] Cada investimento registra banco, tipo, classe, valor investido, aportes, resgates e valor atual.
- [ ] Ao salvar, os meses seguintes são atualizados em cascata com o novo saldo.
- [ ] Renomear banco ou tipo **não** cria registro duplicado nos meses seguintes.
- [ ] Na criação de um novo ano, o saldo de Dezembro é transportado para Janeiro.
- [ ] É possível definir e acompanhar uma meta de patrimônio anual.
- [ ] Valores negativos são rejeitados.
- [ ] Ao informar aporte ou resgate, o saldo atual é ajustado sozinho e o rendimento do mês aparece em tempo real.
- [ ] Informando o saldo real, o ajuste automático para e o valor informado prevalece.
- [ ] Renomear banco ou aplicação atualiza também os meses anteriores, sem alterar os valores deles.
- [ ] Corrigir o valor de um mês anterior não apaga o rendimento já lançado nos meses seguintes.
- [ ] Excluir um investimento o remove do mês selecionado e dos meses seguintes, preservando os anteriores e as demais aplicações.
- [ ] Adicionar uma aplicação que já existe no mês dispara pergunta de confirmação.

---

### HU-10 — Gerenciar metas financeiras
> **Como** usuário,
> **quero** criar metas com valor-alvo e prazo,
> **para** acompanhar meu progresso rumo a um objetivo.

**Critérios de aceite**

- [ ] Cada meta possui nome, valor-alvo, valor atual, ícone e cor personalizados.
- [ ] Valor-alvo deve ser maior que zero; valor inicial não pode ser negativo.
- [ ] É possível registrar, editar e remover contribuições, com histórico visível.
- [ ] Havendo data-alvo, o sistema informa o valor mensal necessário e a projeção de conclusão.
- [ ] Sem metas cadastradas, exibe: "Você ainda não tem metas. Que tal criar a primeira?".
- [ ] Contribuições com valor negativo são rejeitadas.
- [ ] A data da contribuição respeita o fuso local.

---

### HU-11 — Analisar através de relatórios
> **Como** usuário,
> **quero** visualizar gráficos e projeções,
> **para** entender minha evolução financeira.

**Critérios de aceite**

- [ ] É possível filtrar por período (mês inicial e final) ou selecionar o ano inteiro.
- [ ] Gráficos disponíveis: fluxo de caixa, evolução, distribuição, comparação de categorias, contas de consumo, patrimônio líquido e indicadores de investimentos.
- [ ] O fluxo de caixa exibe linha tracejada de projeção de despesas.
- [ ] São exibidos os KPIs de Gasto Médio Mensal, Receita Média Mensal e Projeção para o resto do ano.
- [ ] Exportações disponíveis: PDF, CSV do mês e CSV do ano.
- [ ] Os CSV trazem o vencimento como data completa (dd/mm/aaaa) e abrem com acentuação correta no Excel.

---

### HU-12 — Configurar orçamentos
> **Como** usuário,
> **quero** definir um limite de gasto por categoria,
> **para** ser avisado quando estiver perto de estourar.

**Critérios de aceite**

- [ ] O campo de categoria inicia com "Selecione a categoria".
- [ ] Salvar sem escolher categoria exibe: "Selecione uma categoria.".
- [ ] Cada categoria admite apenas um orçamento.
- [ ] O Dashboard exibe o percentual utilizado com indicação visual de estado, com 80% já sinalizado como apertado.
- [ ] Trocar a categoria ao editar um orçamento não deixa duas entradas para a mesma categoria.

---

### HU-13 — Automatizar despesas fixas
> **Como** usuário,
> **quero** cadastrar despesas recorrentes,
> **para** não precisar lançá-las manualmente todo mês.

**Critérios de aceite**

- [ ] O formulário permite escolher o mês inicial do lançamento.
- [ ] A despesa é lançada do mês inicial até Dezembro.
- [ ] Editar a recorrente atualiza os lançamentos dos meses futuros.
- [ ] Meses anteriores ao mês inicial não são alterados.
- [ ] O status pago/pendente dos lançamentos existentes é preservado.
- [ ] O campo de categoria inicia com "Selecione a categoria" e é obrigatório.
- [ ] Cada lançamento gravado recebe a data completa de vencimento daquele mês.
- [ ] Editar um lançamento pela aba Despesas não rompe o vínculo com a recorrente.

---

### HU-14 — Proteger meus dados
> **Como** usuário,
> **quero** exportar e importar meus dados,
> **para** ter uma cópia de segurança.

**Critérios de aceite**

- [ ] A exportação gera arquivo JSON com todos os dados.
- [ ] A importação exige confirmação: "Importar este backup vai SUBSTITUIR todos os dados atuais. Deseja continuar?".
- [ ] Arquivo inválido é rejeitado com: "Arquivo inválido: não parece um backup.".
- [ ] Arquivo corrompido exibe: "Erro ao ler o arquivo JSON.".

---

### HU-15 — Receber avisos no WhatsApp
> **Como** usuário,
> **quero** receber lembretes automáticos das contas,
> **para** não perder vencimentos mesmo sem abrir o sistema.

**Critérios de aceite**

- [ ] As mensagens chegam às 08:00 e às 19:00 (horário de Brasília).
- [ ] A mensagem lista contas vencendo em breve, vencendo hoje e vencidas.
- [ ] São exibidos os totais: a vencer, vencendo hoje, em atraso, a pagar e pago.
- [ ] Uma segunda mensagem apresenta a situação dos orçamentos.
- [ ] Contas pagas não aparecem na listagem, apenas no total pago.
- [ ] Nada é enviado quando não há contas a vencer nem vencidas, salvo o aviso de mês quitado.
- [ ] Ao pagar a última conta em aberto de um mês, chega uma mensagem informando que todas as contas daquele mês foram pagas.
- [ ] Esse aviso não se repete nas execuções seguintes.
- [ ] Se o mês voltar a ter conta em aberto e for quitado de novo, o aviso chega outra vez.
- [ ] O conteúdo nunca é truncado.

---

### HU-16 — Cadastrar destinatários das notificações
> **Como** usuário,
> **quero** cadastrar quem recebe os avisos,
> **para** que minha família também seja notificada.

**Critérios de aceite**

- [ ] Cada contato possui apenas nome e número — sem nenhuma chave por contato.
- [ ] Números inválidos são rejeitados: "Número inválido. Use código do país + DDD + número.".
- [ ] Nome vazio é rejeitado: "Informe o nome do contato.".
- [ ] Contatos podem ser editados e removidos.
- [ ] O sistema explica, em um passo a passo, como conectar o número que envia as mensagens (uma configuração única, feita uma vez).

---

### HU-18 — Controlar as compras parceladas do cartão
> **Como** usuário,
> **quero** saber quais compras parceladas compõem a fatura de cada cartão,
> **para** enxergar o quanto já está comprometido nos próximos meses sem precisar detalhar cada compra.

**Critérios de aceite**

- [ ] É possível cadastrar cartões com nome, limite, dia de fechamento e dia de vencimento.
- [ ] É possível cadastrar uma compra parcelada informando cartão, valor da parcela, total de parcelas e mês da primeira.
- [ ] Informando a data da compra, o sistema sugere a fatura da primeira parcela com base no dia de fechamento.
- [ ] As parcelas atravessam a virada de ano.
- [ ] Cada cartão exibe limite comprometido, percentual usado, fatura do mês e saldo devedor em parcelas.
- [ ] A lista de parcelamentos em aberto mostra parcela atual, valor, quanto falta pagar e o mês da última parcela.
- [ ] Um gráfico mostra o comprometido por mês nos próximos 12 meses, separado por cartão.
- [ ] Na aba Despesas, a fatura vinculada a um cartão mostra quanto do total já é parcela conhecida e quanto é o restante.
- [ ] Fatura menor que as parcelas conhecidas gera alerta.
- [ ] A projeção considera as parcelas conhecidas sem contar em dobro as faturas já lançadas.
- [ ] Ao cadastrar um parcelamento, as faturas dos meses futuros são criadas com a soma das parcelas e marcadas como "prevista".
- [ ] Informando o valor real da fatura, a marcação some e o sistema não altera mais aquele valor.
- [ ] Um novo parcelamento atualiza apenas as faturas ainda previstas, nunca as que o usuário já preencheu.
- [ ] Meses anteriores ao atual não são alterados.
- [ ] Ao cadastrar um cartão, o sistema oferece vincular os lançamentos já existentes com aquele nome.
- [ ] Lançamentos com nome de cartão e sem vínculo geram alerta com botão de vincular.
- [ ] Em meses sem fatura lançada, a aba Despesas mostra as parcelas conhecidas daquele mês.
- [ ] A lista de parcelamentos pode ser filtrada por cartão, situação e texto, e reordenada.

---

### HU-17 — Prever os gastos dos próximos meses
> **Como** usuário,
> **quero** ver quanto devo gastar nos próximos meses,
> **para** me preparar com antecedência e saber se o saldo aguenta.

**Critérios de aceite**

- [ ] O Dashboard exibe a previsão de todos os meses restantes do ano, a partir do mês seguinte ao selecionado.
- [ ] A aba Projeção permite escolher o horizonte entre 3, 6 e 12 meses.
- [ ] Cada mês mostra separadamente a parte já cadastrada e a parte estimada.
- [ ] São exibidos receita prevista, despesa prevista, saldo do mês e saldo acumulado.
- [ ] Meses com saldo negativo são destacados, e o sistema avisa a partir de qual mês o acumulado fica negativo.
- [ ] O sistema informa o método usado (regressão linear ou média ponderada), o número de meses de histórico e a confiança do ajuste.
- [ ] Com histórico insuficiente, o sistema avisa em vez de apresentar um número sem base.
- [ ] A projeção por categoria é comparada ao orçamento do período.
- [ ] O bloco "Como esta projeção é calculada" explica o método em linguagem simples.
- [ ] Sem dados suficientes, exibe mensagem própria em vez de valores zerados.

---

### HU-19 — Separar o que é meu do que é de outras pessoas no cartão
> **Como** titular dos cartões,
> **quero** registrar as compras que outras pessoas fazem neles,
> **para** que elas não comprometam a minha renda e eu saiba quem me deve quanto, em qual cartão e quantas parcelas faltam — com a fatura continuando a bater com o valor fechado do cartão.

**Critérios de aceite**

- [ ] É possível cadastrar pessoas com nome e telefone opcional, e reutilizá-las em várias compras.
- [ ] O formulário de parcelamento tem o campo "de quem é esta compra", com atalho para cadastrar a pessoa sem perder o que já foi digitado.
- [ ] É possível registrar compra à vista de terceiro, exibida como "à vista".
- [ ] A fatura continua com o valor cheio e bate com o extrato do cartão.
- [ ] Despesas do Mês, saldo, taxa de poupança, orçamentos e Saúde Financeira usam apenas a parte do titular.
- [ ] A linha da fatura mostra a divisão entre o titular e cada pessoa, e a soma fecha com o valor lançado.
- [ ] A aba Despesas avisa quanto do mês é de terceiros e qual é o custo real.
- [ ] O uso do limite conta tudo e informa quanto é de terceiros.
- [ ] Salvar fatura menor que a parte de terceiros pede confirmação.
- [ ] A aba Cartões lista quem deve, quanto deve, em quais cartões e quanto está atrasado.
- [ ] O extrato da pessoa mostra cada compra, as parcelas uma a uma, a situação de cada uma e a data do recebimento.
- [ ] É possível marcar uma parcela como recebida e desfazer, e marcar de uma vez todas as parcelas do mês.
- [ ] Parcela de mês já passado e não recebida aparece como atrasada.
- [ ] Receber **não** lança receita: receitas e despesas do Dashboard não se alteram.
- [ ] O Dashboard mostra um card com o total a receber, o que cai no mês e o atrasado, visível só quando há algo a receber.
- [ ] A projeção separa a coluna "De terceiros" da despesa, e o saldo acumulado segue apenas o compromisso do titular.
- [ ] A lista de parcelamentos pode ser filtrada por pessoa, por "só as suas" e por "só de terceiros".
- [ ] Excluir pessoa com compra lançada é bloqueado, com explicação.
- [ ] Sem nenhuma pessoa cadastrada, todas as telas se comportam como na versão anterior.

---

## 6. Fluxos

### 6.1 Fluxo principal — ciclo mensal
```
1. Usuário cadastra despesas do mês (competência)
   └─ informa data de vencimento (mês seguinte)
2. Sistema classifica por proximidade do vencimento
3. Notificação diária avisa conforme o vencimento se aproxima
   ├─ 5 dias antes → "Vencendo em breve"
   ├─ no dia       → "Vencendo hoje"
   └─ após o dia   → "Vencidas (não pagas)"
4. Usuário marca as contas como pagas
5. Quando todas do mês são pagas
   └─ competência avança para o mês seguinte
      └─ o app passa a abrir no mês novo (RN-CICLO-06)
```

### 6.2 Fluxo de notificação
```
Agendador dispara (08:00 / 19:00 BRT)
  ↓
Autentica no Firebase e localiza o usuário pelo e-mail
  ↓
Lê o documento do usuário
  ↓
Determina o mês de competência
  └─ mês anterior tem despesa não paga? → competência = mês anterior
                                        → senão = mês atual
  ↓
Carrega despesas (competência + mês oposto, deduplicadas)
  ↓
Classifica por vencimento
  ↓
Algum mês acompanhado acabou de ser quitado?
  ├─ Sim → monta o aviso de fechamento e grava o controle
  └─ Não ↓
Há algo a avisar (vencimentos ou aviso de fechamento)?
  ├─ Não → encerra sem enviar
  └─ Sim ↓
Monta página 1 (despesas) e página 2 (orçamentos)
  ↓
Divide páginas que excedam o limite de caracteres do provedor (20.000)
  ↓
Envia a cada contato válido, com intervalo de 2s
  ↓
Registra o resultado no log
```

### 6.3 Fluxo de salvamento
```
Usuário confirma o formulário
  ↓
Validações do formulário
  ├─ Inválido → exibe mensagem e interrompe
  └─ Válido ↓
Clona os dados em memória
  ↓
Aplica a alteração
  ↓
Recalcula os totais do ano
  ↓
Atualiza a interface imediatamente
  ↓
Persiste no banco
  ├─ Sucesso → confirmação (com opção de desfazer, quando aplicável)
  └─ Erro    → "Erro ao salvar. Verifique sua conexão."
```

### 6.4 Fluxo de virada de ano
```
Usuário cria o novo ano
  ↓
Estrutura copiada do ano anterior (categorias, orçamentos, metas)
  └─ despesas-modelo vêm do ÚLTIMO mês do ano anterior que tem despesas
     (com vencimento recalculado para cada mês do ano novo)
  ↓
Investimentos: saldo de Dezembro → Janeiro
  ├─ valor atual vira valor investido
  ├─ aportes e resgates zerados
  └─ rendimento reinicia
  ↓
Ao salvar Janeiro, a cascata preenche os demais meses
```

### 6.5 Fluxo da projeção
```
Usuário abre o Dashboard ou a aba Projeção
  ↓
Monta o histórico (ano anterior + ano atual até o mês selecionado)
  └─ descarta meses sem movimento
  ↓
Escolhe o método
  ├─ menos de 4 meses?        → média ponderada dos 3 últimos
  ├─ R² abaixo de 0,2?        → média ponderada dos 3 últimos
  └─ senão                    → regressão linear
  ↓
Para cada mês do horizonte:
  ├─ lê o que já está cadastrado naquele mês
  ├─ calcula a previsão do método (piso 0, teto 1,5x o maior mês)
  ├─ estimado = previsão − já cadastrado (nunca negativo)
  ├─ receita: usa a cadastrada; só estima se não houver
  └─ acumula o saldo a partir do saldo do ano até o mês selecionado
  ↓
Exibe por mês, por categoria e os alertas de mês negativo
```

---

## 7. Catálogo de Mensagens

### 7.1 Validação
| Mensagem | Contexto |
|---|---|
| Valor inválido (não pode ser negativo). | Despesa, renda, contribuição |
| Valor inválido (deve ser maior que zero). | Campos que exigem valor positivo |
| Valores não podem ser negativos. | Investimentos |
| O valor-alvo deve ser maior que zero. | Meta |
| O valor inicial não pode ser negativo. | Meta |
| A parcela atual não pode ser maior que o total. | Despesa parcelada |
| Dia de vencimento deve ser entre 1 e 31. | Vencimento (formato legado) |
| Selecione uma categoria. | Orçamento e despesa recorrente |
| Informe o nome do contato. | Contato WhatsApp |
| Informe o nome do cartão. | Cartão |
| Dia de fechamento deve ser entre 1 e 31. · Dia de vencimento deve ser entre 1 e 31. | Cartão |
| Informe o que foi comprado. | Parcelamento |
| Cadastre um cartão antes de lançar o parcelamento. | Parcelamento |
| Informe o total de parcelas. | Parcelamento |
| Informe o mês e o ano da primeira parcela. | Parcelamento |
| Número inválido. Use código do país + DDD + número. | Contato WhatsApp |
| Não há próximo mês cadastrado neste ano. | Copiar despesas em lote |
| Arquivo inválido: não parece um backup. | Importação |
| Erro ao ler o arquivo JSON. | Importação |
| Valor inválido (não pode ser negativo). | Contribuição de meta (inclusão e edição) |

### 7.2 Confirmação de ação
| Mensagem |
|---|
| Despesa excluída · Despesa duplicada · Despesas marcadas como pagas · Despesas marcadas como pendentes |
| X despesa(s) copiada(s) para [mês] |
| Compra salva · Compra excluída |
| Investimento salvo · Investimento excluído |
| Meta excluída · Contribuição adicionada · Contribuição atualizada · Contribuição removida |
| Orçamento excluído · Renda excluída · Categoria salva · Categoria excluída |
| Despesa recorrente excluída |
| Contato removido |
| Backup exportado · Backup importado · Exportação do ano concluída |
| Mês adicionado · Ano adicionado |
| Ação desfeita |
| Despesa adicionada com sucesso · Despesa atualizada com sucesso |
| Renda adicionada · Renda atualizada |
| Orçamento adicionado · Orçamento atualizado |
| Meta adicionada · Meta atualizada |
| Recorrente lançada de [mês] a Dezembro · Recorrente atualizada de [mês] a Dezembro |
| Contato adicionado · Contato atualizado |
| Cartão adicionado · Cartão atualizado · Cartão excluído |
| Parcelamento lançado: [N]x de R$ [valor] · Parcelamento atualizado · Parcelamento excluído |
| [N] fatura(s) prevista(s) criada(s) · [N] atualizada(s) · [N] removida(s) |
| Cartão adicionado · [N] fatura(s) vinculada(s) |
| [N] fatura(s) vinculada(s) a [cartão] |
| Meta de patrimônio definida · Meta de patrimônio removida |
| Alterações salvas |
| Abrindo em [mês]: N conta(s) ainda não paga(s) nesse mês. |

### 7.3 Confirmação destrutiva
| Mensagem |
|---|
| Importar este backup vai SUBSTITUIR todos os dados atuais. Deseja continuar? |
| Remover este contato? |
| Remover esta contribuição? |
| Excluir "[banco] / [aplicação]" deste mês e dos meses seguintes? |
| Já existe "[banco] / [aplicação]" neste mês. Atualizar o registro existente em vez de criar outro? |

### 7.4 Estados vazios
| Mensagem | Local |
|---|---|
| Nenhuma conta pendente. Tudo em dia! | Lembretes |
| Nenhum orçamento definido. | Orçamentos |
| Nenhuma despesa este mês. | Despesas |
| Nenhuma despesa categorizada neste mês. | Top Categorias |
| Nenhum investimento registrado neste mês. | Investimentos |
| Você ainda não tem metas. Que tal criar a primeira? | Metas |
| Sem dados ainda — registre receitas e despesas para ver sua nota. | Saúde Financeira |
| Cadastre mais de um mês para ver comparações automáticas de gastos. | Insight |
| Registre despesas neste mês para ver os destaques de variação. | Insight |
| Seus gastos por categoria ficaram estáveis em relação ao mês anterior. | Insight |
| Nenhum contato cadastrado. | Contatos de WhatsApp |
| Nenhuma renda adicionada. | Fontes de renda |
| Nenhuma despesa recorrente. | Despesas recorrentes |
| Nenhuma compra detalhada. | Detalhes da fatura |
| Nenhuma contribuição registrada ainda. | Histórico de meta |
| Nenhuma despesa neste mês. Clique em “Adicionar”. | Despesas |
| Nenhuma despesa corresponde aos filtros. | Despesas com filtro ativo |
| Sem dados suficientes para projetar. Cadastre receitas e despesas de pelo menos um mês. | Aba Projeção |
| Sem dados suficientes para prever. Cadastre despesas de pelo menos um mês. | Card Previsão de Gastos |
| Nenhuma despesa categorizada para projetar. | Projeção por categoria |
| Nenhum cartão cadastrado. Comece em "Novo cartão" e depois lance as compras parceladas. | Aba Cartões |
| Nenhuma compra parcelada cadastrada ainda. | Parcelamentos |
| Nenhum parcelamento corresponde aos filtros. | Parcelamentos com filtro ativo |

### 7.5 Erro do sistema
| Mensagem |
|---|
| Erro ao salvar. Verifique sua conexão. |

### 7.6 Mensagens do WhatsApp

> Cada página começa com um pequeno ícone (sino na página de despesas, gráfico de barras na de orçamentos) — veja o resultado real nas Figuras 8 e 9.

**Página 1 — Despesas**
```
*Lembrete de contas* — [Mês]/[Ano]

*Vencendo em breve:*
• [Nome] — R$ [valor] — faltam [N] dias (vence [dd/mm])
• [Nome] — R$ [valor] — vence amanhã ([dd/mm])

*Vencendo hoje:*
• [Nome] — R$ [valor] — vence hoje ([dd/mm])

*Vencidas (não pagas):*
• [Nome] — R$ [valor] — venceu [dd/mm] (atrasada há [N] dias)

*Total a vencer:* R$ [valor]
*Total vencendo hoje:* R$ [valor]
*Total em atraso:* R$ [valor]
*Total a pagar (todas as despesas):* R$ [valor]
*Total pago:* R$ [valor]

_Controle Financeiro PRO_
```

**Página 2 — Orçamentos**
```
*Orçamentos do mês* — [Mês]/[Ano]

_Dentro da margem:_
• [Categoria]: R$ [gasto] de R$ [limite] — [N]% já utilizado.
  Pode utilizar R$ [saldo].

_Apertado (perto do limite):_
• [Categoria]: R$ [gasto] de R$ [limite] — [N]% já utilizado.
  Pode utilizar R$ [saldo].

_Estourado:_
• [Categoria]: R$ [gasto] de R$ [limite] — [N]% já utilizado.
  Você estourou R$ [excedente] a mais do cadastrado.

_Controle Financeiro PRO_
```

**Mensagens auxiliares**
| Situação | Texto |
|---|---|
| Grupo sem itens | _Sem orçamento nessa situação._ |
| Sem orçamentos | _Nenhum orçamento cadastrado._ |
| Teste de conexão | *Teste — Controle Financeiro PRO* — Se você recebeu esta mensagem, as notificações de WhatsApp estão funcionando! |

**Mensagem de mês quitado**
```
✅ *Contas em dia!* — [Mês]/[Ano]

Todas as contas de *[Mês]/[Ano]* foram pagas. 🎉

*Contas pagas:* [N]
*Total pago:* R$ [valor]

_Em [Mês]/[Ano] há [N] conta(s) em aberto, somando R$ [valor]._

_Controle Financeiro PRO_
```
> A última linha só aparece quando o outro mês acompanhado ainda tem contas em aberto.

### 7.7 Registros de log (serviço de notificação)
| Mensagem |
|---|
| Mês anterior ([mês]): [N] não pagas — Competência: [mês]/[ano] |
| Despesas: [N] de [mês] + [N] de [mês] = [N] (após dedup) |
| Nada a vencer (em breve/hoje) nem vencido. Nada será enviado. |
| Mês quitado: [mês]/[ano] ([N] conta(s), R$ [valor]). Enviando aviso de fechamento. |
| Aviso de mês quitado enviado para [nome] ([número]): status [código] |
| Primeira execução do aviso de mês quitado. Situação registrada: [meses]. Nada enviado por isso. |
| Não foi possível gravar o controle de meses avisados: [erro] |
| Nenhum contato com número cadastrado. Nada enviado. |
| Enviado para [nome] ([número]) parte [i]/[n]: status [código] |
| Documento do usuário não encontrado. Nada a fazer. |
| Concluído. |

### 7.8 Alertas da projeção
| Mensagem |
|---|
| N mês/meses fecha(m) no vermelho: [meses] |
| O saldo acumulado fica negativo a partir de [mês]/[ano] |
| Só N mês/meses de histórico. A estimativa fica mais confiável a partir de 4 meses cadastrados. |

---

## 8. Requisitos Não Funcionais

### 8.1 Interface
| Requisito | Especificação |
|---|---|
| Tipografia | Inter, com números tabulares para alinhamento de valores |
| Tema | **Escuro por padrão dentro do sistema**, no estilo fintech: fundo quase preto, cartões em superfície elevada com borda fina e acento verde vivo. Alternância para o tema claro pelo botão do cabeçalho, com a escolha salva no navegador (`theme-v3`) |
| Tela de login | Mantém a identidade clara original (painel visual escuro à esquerda, formulário em creme), independente do tema do sistema |
| Navegação | Abas em formato de pílula; a aba ativa é preenchida com o acento |
| Responsividade | Tabelas convertidas em cartões em telas até 640px |
| Aplicativo | Instalável na tela inicial, com ícone e cor de tema |
| Identificação | Versão visível na tela de login e no cabeçalho |
| Contraste | No tema escuro, os tons de valor (verde e vermelho) sobem um degrau, para manter no mínimo 4,5:1 sobre o fundo |
| Impressão | A exportação em PDF alterna para o tema claro antes de imprimir e volta ao escuro em seguida |
| Datas | Datas geradas pelo sistema usam o fuso local, nunca UTC |
| Exportação | Arquivos CSV gravados com BOM, para acentuação correta no Excel |

### 8.2 Acessibilidade
- Modais com `role` e `aria-modal`, com gestão de foco na abertura e restauração ao fechar.
- Fechamento de modais pela tecla Esc.
- Rótulos acessíveis em botões representados apenas por ícones.

### 8.3 Padrões de cor
**Superfícies**

| Papel | Tema escuro | Tema claro |
|---|---|---|
| Fundo da página | `#0A0F0E` | `#EEF3F1` |
| Cartão | `#161E1C` | `#FFFFFF` |
| Superfície elevada (campos, chips, rodapés) | `#1B2321` | `#F4F7F6` |
| Borda | `#27322F` | `#E2E9E6` |
| Texto principal / secundário | `#ECF3F1` / `#8A9A96` | `#0F2420` / `#5A6B66` |
| Acento | `#34D399` | `#0D9488` |
| Texto sobre o acento | `#04211B` | `#FFFFFF` |

> As cores de estado abaixo valem para o tema claro. No tema escuro o sistema usa o tom imediatamente mais claro de cada uma (ex.: vermelho `#F87171`, verde `#4ADE80`, âmbar `#FBBF24`). As paletas dos gráficos também mudam com o tema.

| Estado | Cor | Aplicação |
|---|---|---|
| Vencida | Vermelho | Alerta e etiqueta de conta vencida |
| Vence hoje | Laranja | Alerta e etiqueta com ícone de relógio |
| A vencer | Amarelo | Etiqueta de conta futura |
| Orçamento estourado | Roxo | Alerta de orçamento |
| Positivo | Verde | Saldos e variações favoráveis |

### 8.4 Desempenho e confiabilidade
- Atualização otimista da interface: a tela responde antes da confirmação do banco.
- Sincronização em tempo real entre dispositivos.
- Ação de desfazer disponível nas exclusões.
- Divisão automática de mensagens longas, evitando truncamento.

### 8.5 Segurança
- Acesso restrito ao próprio documento do usuário, validado por regra no banco.
- Credenciais de serviço (Firebase e provedor de envio) armazenadas exclusivamente como segredos no ambiente de execução — nunca em arquivo de código, mesmo em repositório público.

---

## 9. Arquitetura

### 9.1 Componentes
| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Interface | HTML/CSS/JavaScript em arquivo único | Toda a experiência do usuário |
| Autenticação | Firebase Authentication | Login por e-mail e senha |
| Banco de dados | Cloud Firestore | Persistência dos dados |
| Hospedagem | Firebase Hosting | Entrega da aplicação |
| Agendador | GitHub Actions | Disparo das notificações |
| Envio | Green API | Entrega das mensagens no WhatsApp, por uma conta conectada ao sistema |
| Gráficos | Chart.js | Visualizações dos relatórios |

### 9.2 Variáveis de ambiente do serviço de notificação
| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `SERVICE_ACCOUNT` | Segredo | — | Credencial de serviço do Firebase |
| `APP_EMAIL` | Segredo | — | E-mail do usuário no sistema |
| `GREENAPI_URL` | Segredo | — | Endereço do servidor do provedor de envio (ex.: `https://7107.api.greenapi.com`) |
| `GREENAPI_ID_INSTANCE` | Segredo | — | Identificador da conta de envio conectada por QR Code |
| `GREENAPI_TOKEN_INSTANCE` | Segredo | — | Chave de acesso da conta de envio |
| `JANELA_DIAS` | Configuração | 5 | Dias de antecedência do aviso |
| `MODO_TESTE` | Entrada manual | falso | Envia mensagem de verificação |

### 9.3 Ambientes
| Ambiente | Arquivo | Características |
|---|---|---|
| Produção | `index.html` | Conectado ao Firebase |
| Teste local | `index-teste-local.html` | Login simulado, dados apenas no navegador |

---

## 10. Cenários de Teste

### 10.1 Ciclo de competência
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Mês anterior com despesas não pagas | Competência permanece no mês anterior |
| 2 | Mês anterior com uma única despesa não paga | Competência permanece no mês anterior |
| 3 | Mês anterior totalmente pago | Competência avança para o mês atual |
| 4 | Virada de ano com pendências em Dezembro | Competência permanece em Dezembro do ano anterior |

### 10.2 Classificação de vencimento
| # | Cenário (referência: dia 10) | Resultado esperado |
|---|---|---|
| 1 | Vencimento em 15 | Vencendo em breve — faltam 5 dias |
| 2 | Vencimento em 11 | Vencendo em breve — vence amanhã |
| 3 | Vencimento em 10 | Vencendo hoje |
| 4 | Vencimento em 5 | Vencida — atrasada há 5 dias |
| 5 | Vencimento em 25 | Mais adiante |
| 6 | Sem data de vencimento | Mais adiante (não desaparece) |
| 7 | Despesa paga | Não aparece nos lembretes |

### 10.3 Orçamentos
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Gasto de 27% do limite | Dentro da margem |
| 2 | Gasto de 86% do limite | Apertado |
| 3 | Gasto de 125% do limite | Estourado, com valor excedente |
| 4 | Nenhum orçamento cadastrado | Mensagem de ausência de orçamentos |
| 5 | Grupo sem itens | Mensagem de grupo vazio |

### 10.4 Investimentos
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Atualizar valor atual de um mês | Meses seguintes atualizados em cascata |
| 2 | Renomear banco de um investimento | Nenhuma duplicação nos meses seguintes |
| 3 | Registro antigo sem identificador de série | Localizado por banco e tipo; identificador atribuído ao salvar |
| 4 | Criar novo ano | Saldo de Dezembro transportado para Janeiro |

### 10.5 Propagação de vencimento
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Parcela 1/5 em Janeiro vencendo 10/02 | Parcelas seguintes vencem 10/03, 10/04, 10/05 e 10/06 |
| 2 | Parcela com vencimento em 31/01 | A de fevereiro vence 28/02 e a de março volta a 31/03 |
| 3 | Recorrente lançada de Março a Dezembro, dia 10 | Cada lançamento com data completa do próprio mês |
| 4 | Editar lançamento gerado por recorrente | Vínculo `recurringId` preservado |
| 5 | Copiar despesa de Junho (vence 15/07) para Julho | A cópia vence 15/08 |
| 6 | Criar novo ano a partir do ano anterior | Vencimentos recalculados mês a mês; metas copiadas |

### 10.6 Projeção
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Série crescente e regular (5 meses) | Regressão linear, R² alto, previsão seguindo a tendência |
| 2 | Apenas 2 meses de histórico | Média ponderada, com aviso de histórico curto |
| 3 | Meses muito irregulares (R² baixo) | Média ponderada, com o motivo informado |
| 4 | Tendência de queda acentuada | Previsão trava em zero, nunca negativa |
| 5 | Extrapolação longa | Previsão limitada a 1,5x o maior mês registrado |
| 6 | Mês futuro com parcela já cadastrada | Projeção = cadastrado + estimado, nunca abaixo do cadastrado |
| 7 | Horizonte ultrapassando dezembro | Continua no ano seguinte |
| 8 | Dashboard estando em Julho | Mostra de Agosto a Dezembro |
| 9 | Dashboard estando em Dezembro | Mostra os 3 primeiros meses do ano seguinte |
| 10 | Mês sem movimento no histórico | Ignorado, não rebaixa a média |

### 10.7 Abertura do sistema
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Mês anterior com contas não pagas | Abre no mês anterior, informando o motivo |
| 2 | Mês anterior totalmente pago | Abre no mês corrente |
| 3 | Mês anterior sem despesas | Abre no mês corrente |
| 4 | Mês corrente com pendências, anterior pago | Abre no mês corrente (não avança além dele) |
| 5 | 08/01 com pendências em Dezembro | Abre em Dezembro do ano anterior |

### 10.8 Notificações
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Sem contas a vencer nem vencidas | Nenhuma mensagem enviada |
| 2 | Mensagem longa | Dividida e numerada, sem truncamento |
| 3 | Contato sem número cadastrado | Ignorado no envio |
| 4 | Conta de envio desconectada (QR Code expirado) | Envio falha, registrado no log |
| 5 | Modo teste ativado | Mensagem de verificação enviada, ignorando vencimentos |
| 6 | Última conta em aberto do mês é paga | Aviso de fechamento enviado uma vez |
| 7 | Execução seguinte sem mudanças | Nenhum aviso repetido |
| 8 | Mês volta a ter conta em aberto e é quitado de novo | Aviso enviado outra vez |
| 9 | Mês sem nenhuma despesa | Não é considerado quitado |
| 10 | Primeira execução após a implantação | Situação registrada, nenhum aviso enviado |
| 11 | Mês fechado com vencimentos pendentes no outro mês | Aviso de fechamento vai antes das páginas de despesas e orçamentos |

### 10.9 Compras de terceiros
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Fatura de R$ 1.820 com R$ 530 de terceiros | Fatura continua R$ 1.820; Despesas do Mês conta R$ 1.290 |
| 2 | Soma das etiquetas da linha da fatura | Igual ao valor lançado, sempre |
| 3 | Despesa sem cartão | Valor inalterado em todos os cálculos |
| 4 | Compra de terceiro numa categoria com orçamento | Não consome o orçamento do titular |
| 5 | Fatura lançada com valor menor que a parte de terceiros | Pede confirmação; custo próprio fica em zero, nunca negativo |
| 6 | Parcelamento de terceiro em 8x iniciado em Novembro | Última parcela em Junho do ano seguinte |
| 7 | Compra à vista de terceiro em Outubro | Aparece só em Outubro, exibida como "à vista" |
| 8 | Parcela de mês já passado, não recebida | Situação "atrasada" |
| 9 | Parcela do mês corrente, não recebida | Situação "a receber", não atrasada |
| 10 | Competência parada em mês anterior por conta não paga | Atraso continua medido pelo mês de calendário |
| 11 | Marcar parcela como recebida | A receber cai, já recebido sobe, soma se mantém |
| 12 | Desfazer o recebimento | Volta exatamente ao estado anterior |
| 13 | Receber uma parcela | Receita e despesa do Dashboard não se alteram |
| 14 | Todas as parcelas de uma compra recebidas | Compra marcada como quitada e movida para o fim da lista |
| 15 | Pessoa cadastrada sem nenhuma compra | Não aparece no resumo; extrato abre vazio sem erro |
| 16 | Excluir pessoa com compra lançada | Bloqueado, com mensagem explicando |
| 17 | Nome de pessoa repetido | Recusado |
| 18 | Editar parcelamento de terceiro | Recebimentos preservados |
| 19 | Passar compra de terceiro para o titular | Recebimentos limpos |
| 20 | Projeção de mês com parcela de terceiro | Coluna "De terceiros" preenchida; despesa e saldo sem ela |
| 21 | Projeção com e sem terceiros, mesmo histórico | Saldo acumulado idêntico; desembolso maior no caso com terceiros |
| 22 | Mês futuro com fatura já lançada e parcela de terceiro | Sem dupla contagem: cadastrado + terceiros = valor da fatura |
| 23 | Nenhuma pessoa cadastrada | Card do Dashboard e seção de terceiros não aparecem; coluna toda em "—" |
| 24 | Uso do limite com compra de terceiro | Percentual conta tudo; cartão informa quanto é de terceiros |
| 25 | Cadastrar pessoa de dentro do formulário de parcelamento | Modal abre por cima, e ao salvar a pessoa já volta selecionada, sem perder o que foi digitado |
| 26 | Parcela em mês corrente com cartão vencendo depois de hoje | "A receber", não atrasada |
| 27 | Cartão sem fatura lançada; dia de vencimento alterado | Situação da parcela acompanha o novo dia, na hora |
| 28 | Cartão com fatura lançada; dia de vencimento alterado | Sistema oferece realinhar as faturas não pagas; valor e situação intactos |
| 29 | Realinhamento recusado | Faturas mantêm o vencimento antigo e a parcela segue a data da fatura |
| 30 | Aba Pessoas sem ninguém cadastrado | Estado vazio explicando como começar |
| 31 | Menu em 360, 375, 390 e 414px | Barra com hambúrguer; abas tradicionais escondidas; sem rolagem horizontal |
| 32 | Menu em 768, 900 e 1023px | Grade de 5 colunas, duas fileiras, tudo dentro do contêiner |
| 33 | Menu em 1024, 1200 e 1279px | Grade de 5 colunas, sem rolagem |
| 34 | Menu em 1280, 1366 e 1920px | Fileira única com os nove itens, sem rolagem |
| 35 | Gaveta aberta | Nove itens, três grupos recolhíveis, largura dentro da tela, fundo travado |
| 36 | Fechar a gaveta | Funciona pelo X, por toque fora, por Esc e ao escolher um item |
| 37 | Recolher e expandir um grupo | `aria-expanded` e visibilidade acompanham |
| 38 | Grupo que contém a aba ativa | Nunca fica recolhido |
| 39 | Escolher item na gaveta | Troca de página, fecha a gaveta, destrava a rolagem e atualiza o título da barra |
| 40 | Redimensionar de mobile para desktop com a gaveta aberta | Gaveta fecha, abas voltam, rolagem do corpo liberada |
| 41 | Navegar pelas nove abas no desktop | Todas abrem, comportamento inalterado |
| 42 | Fatura de Outubro lançada vencendo em 20/11; Novembro e Dezembro sem fatura | Vencimentos 20/11, 20/12 e 20/01 — nunca a 2ª atrasada com a 1ª em dia |
| 43 | Cartão fecha dia 25 e vence dia 5, sem faturas lançadas | Competência Outubro vence em 05/11 |
| 44 | Cartão fecha dia 10 e vence dia 11, sem faturas lançadas | Competência Outubro vence em 11/10 |
| 45 | Só a fatura de Dezembro lançada | Os meses anteriores herdam o intervalo e o dia dela |
| 46 | Faturas com datas irregulares (Novembro vencendo antes de Outubro) | Trava de ordem puxa a anterior; a sequência nunca inverte |
| 47 | Cartão sem dia de vencimento cadastrado | Último dia de cada mês, com Fevereiro em 28 |
| 48 | Parcela recebida em mês já vencido | Continua "recebida", nunca "atrasada" |
| 49 | Fatura de Outubro vencendo 12/11 e a de Novembro lançada vencendo 13/11 | Parcelas em 12/11, 12/12 e 12/01 — um mês entre elas, não um dia |
| 50 | Fatura de um mês posterior em cadência (vence 20/12 quando a cadência prevê Dezembro) | É usada: o dia real daquele mês prevalece |
| 51 | Fatura de um mês posterior fora de cadência | Ignorada; vale a cadência mensal |
| 52 | Mudar o dia de vencimento do cartão | Faturas por vencer trocam só o dia, mantendo o mês; a cadência segue mensal |
| 53 | Realinhamento com fatura já vencida ou já paga | Ambas ficam de fora |
| 54 | Cadastrar pessoa | Paleta de 12 cores, já com a primeira cor livre marcada |
| 55 | Trocar a cor no cadastro | Seleção acompanha e a cor é gravada |
| 56 | Pessoa sem cor gravada | Recebe cor derivada da identificação, igual após recarregar |
| 57 | Mesma pessoa em telas diferentes | Aba Pessoas, parcelamentos, fatura e Dashboard usam a mesma cor |
| 58 | Tema claro e exportação em PDF | Etiquetas e indicadores escurecidos, legíveis sobre branco |
| 59 | Indicadores da aba Pessoas | Faixa colorida, valor na cor e ícone em medalhão, como em Despesas |
| 60 | Nada vencido em aberto | Card "Atrasado" fica verde com visto, em vez de vermelho |
| 61 | Pessoa com duas compras caindo no mesmo mês | Card do mês soma as duas e informa quantas parcelas |
| 62 | Receber uma das parcelas do mês | Valor do card cai e a contagem de parcelas acompanha |
| 63 | Todas as parcelas do mês recebidas | Card mostra "recebido" e quanto foi acertado |
| 64 | Pessoa sem parcela no mês selecionado | Card vira "Próxima parcela", com valor, mês e vencimento |
| 65 | Trocar o mês no seletor | Card do extrato acompanha e bate com o da aba Pessoas |
| 66 | Duplicar despesa | Pede confirmação, informando valor e destino; cancelar não cria nada |
| 67 | Buscar pessoa pelo nome | Lista e indicadores filtram na hora |
| 68 | Filtrar por situação | "Quitadas", "sem compras" e "com saldo" trazem os conjuntos certos |
| 69 | Filtrar por cartão | Indicador soma só aquele cartão e bate com os cards da lista |
| 70 | Ordenar por nome e por maior saldo | Ordem respeitada |
| 71 | Orçamento no WhatsApp com fatura de terceiros | Usa o custo próprio; app e serviço devolvem o mesmo número |
| 72 | Mensagem de orçamento com terceiros no mês | Informa quanto ficou de fora e por quê |
| 73 | Fatura antiga com compras detalhadas | Valor preservado, campo de valor volta a ser editável, nenhum botão de detalhar |
| 74 | Parcelamentos com compras de terceiros | Agrupado por pessoa, "Suas compras" primeiro, subtotal por grupo |
| 75 | Ordenar com agrupamento ativo | Ordem aplicada dentro de cada grupo |
| 76 | Filtrar por uma pessoa | Mantém a faixa dela, com o subtotal |
| 77 | Filtrar "só as suas" ou base sem pessoas | Sem faixas: tabela igual à anterior |
| 78 | Agrupamento no celular | Faixas visíveis, sem rolagem horizontal |
| 79 | Árvore do agrupamento | Tronco, ramo e ponto na cor da pessoa; faixa na mesma cor |
| 80 | Último ramo de cada grupo | Tronco encerra na linha, fechando o grupo |
| 81 | Árvore no celular | Borda colorida no cartão, rótulos preservados |
| 82 | Editar despesa | Pede confirmação com nome e valor; recusar não abre o formulário |
| 83 | Ícone de pago numa despesa pendente | Alerta "como PAGA?"; confirmar grava e deixa o ícone verde |
| 84 | Ícone de pago numa despesa paga | Alerta "como PENDENTE?"; confirmar devolve ao estado anterior |
| 85 a 97 | Cada botão "Adicionar" da interface | O clique abre o modal correspondente |
| 98 | Novo formulário de despesa | Chega com categorias carregadas e título "Nova Despesa" |
| 99 | Novo formulário de recorrente | Chega com os meses carregados |
| 100 | Botão "Gerenciar categorias" | Abre o modal de categorias |
| 101 | Recorrente "no mesmo mês" | Competência e vencimento no mesmo mês, como antes |
| 102 | Recorrente "no mês seguinte" | Outubro vence 10/11, Novembro 10/12, Dezembro 10/01 do ano seguinte |
| 103 | Recorrente dia 31 no mês seguinte | Cai no último dia do mês de destino |
| 104 | Cadastro antigo sem o campo | Abre como "no mesmo mês" e não muda de comportamento |
| 105 | Editar valor com vencimento corrigido à mão | A correção do mês permanece; o valor novo chega |
| 106 | Editar o dia da recorrente | Todos os meses, da competência inicial em diante, são reescritos |
| 107 | Editar o mês do vencimento | Idem, inclusive virando o ano em Dezembro |
| 108 | Tabela de recorrentes | Marca quais vencem no mês seguinte |
| 109 | Formulário com assinatura marcada | Esconde total de parcelas e "à vista", valor vira "por mês" |
| 110 | Prévia da assinatura | "R$ X por mês · a partir de … · sem fim definido" |
| 111 | Gravação da assinatura | `recorrente: true`, `totalInstallments: 0`, sem campos de encerramento |
| 112 | Linha da assinatura na lista | "mensal", "sem fim definido" e o valor por mês |
| 113 | Subtítulo e faixa da pessoa | Separam "a pagar/a receber" de "R$ X/mês em assinaturas" |
| 114 | Dívida de assinatura ativa | Só as cobranças até o mês selecionado |
| 115 | Avanço de mês com assinatura ativa | A dívida cresce uma mensalidade |
| 116 | Fatura prevista com assinatura | Já conta a mensalidade nos meses futuros do horizonte |
| 117 | Encerrar pelo botão da lista | Confirma dizendo a última cobrança; grava mês e ano |
| 118 | Registro após encerrar | Continua existindo, com histórico e pendente intactos |
| 119 | Mês seguinte ao encerramento | Nenhuma cobrança nova; a fatura prevista encolhe |
| 120 | Encerramento anterior à 1ª cobrança | Recusado, com a mensagem de erro |
| 121 | Limpar o encerramento | Reativa a assinatura |
| 122 | Parcelamento comum junto de assinaturas | Segue mostrando n/total, sem mudança |
| 123 | Ano novo com parcela em andamento | Entra na parcela seguinte, com o valor preservado |
| 124 | Ano novo, último mês | A contagem avança os doze meses (3/23 vira 15/23) |
| 125 | Ano novo com parcela encerrada | A despesa não é copiada |
| 126 | Ano novo com recorrente | Chega com o valor do cadastro e o vencimento correto |
| 127 | Ano novo com despesa comum | Continua nascendo zerada |
| 128 | Mês novo com parcela e recorrente | Mesma regra do ano novo |
| 129 | Editar nome da recorrente | O valor ajustado à mão no mês permanece |
| 130 | Editar valor da recorrente | Reescreve os meses, da competência inicial em diante |
| 131 a 139 | Busca nos parcelamentos | Valor com vírgula, com ponto, parcial, pessoa, cartão, total de parcelas, dois termos como "e", sem resultado, busca limpa |
| 140 | Ano criado pela regra antiga | Financiamento zerado e sem contagem, recorrentes em branco |
| 141 | Prévia do conserto | Lista parcelas, recorrentes e séries encerradas antes de gravar |
| 142 | Recusar a prévia | Nada é alterado |
| 143 a 145 | Conserto aplicado | Parcela volta à contagem certa em janeiro e em dezembro; recorrente recebe o valor do cadastro |
| 146 | Vencimento no conserto | Preservado, nunca recalculado |
| 147 | Série encerrada no conserto | Removida do mês em que já acabou, mantida onde ainda vale |
| 148 | Valor digitado à mão | Preservado, e não ganha contagem de parcela |
| 149 | Zerada mas paga | Não é tocada |
| 150 | Rodar o conserto de novo | Avisa que não há o que reaplicar |
| 151 | Ano de origem | Permanece intacto |
| 152 | Cartão antigo no formulário | Abre com o ciclo que vinha sendo deduzido |
| 153 | Cartão novo no formulário | Abre em "mês seguinte" |
| 154 | Trocar para "mês seguinte" | Oferece realinhar, avisando que pagas e vencidas não são tocadas |
| 155 | Realinhamento aplicado | A competência de dezembro passa a vencer em 15/01 |
| 156 | Fatura já vencida | Não é movida pelo realinhamento |
| 157 | Escolha gravada no cartão | `dueMonthOffset` persistido |
| 158 e 159 | Faturas criadas depois | Janeiro vence 15/02, fevereiro 15/03 |
| 160 | Linha da fatura na tela | Mostra o vencimento do mês seguinte |
| 161 | Voltar para "próprio mês" | Pergunta de novo; recusar mantém as faturas e grava a escolha |
| 162 e 163 | Base com um ano certo e outro errado | Partida: 2026 corrigido à mão, 2027 vencendo na própria competência |
| 164 | Proposta do realinhamento | Só as faturas erradas entram; a já correta não é listada |
| 165 a 167 | Realinhamento aplicado a 2027 | Janeiro passa a 15/02, fevereiro a 15/03, abril a 15/05 |
| 168 | Mês já correto | Permanece como estava |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| **Competência** | Mês ao qual a despesa pertence, independente da data de pagamento |
| **Vencimento** | Data limite para o pagamento da despesa |
| **Janela de aviso** | Quantidade de dias de antecedência para o alerta de vencimento |
| **Série de investimento** | Conjunto de registros do mesmo investimento ao longo dos meses |
| **Propagação** | Replicação automática de um valor para os meses seguintes |
| **Modo demo** | Execução local com login simulado e dados apenas no navegador |
| **Instance** | Conta de envio do Green API, conectada a um número de WhatsApp por QR Code; identificada por `idInstance` e `apiTokenInstance` |
| **Deduplicação** | Remoção de registros repetidos ao mesclar dados de dois meses |
| **Parte certa** | Na projeção, o que já está cadastrado no mês futuro — não é estimativa |
| **Parte estimada** | Na projeção, o quanto o histórico sugere que ainda vai aparecer além do cadastrado |
| **Regressão linear** | Reta que melhor acompanha os meses do histórico, usada para estender a tendência |
| **R²** | Medida de 0 a 100% de quanto a reta explica a variação dos meses; é o indicador de confiança |
| **Média ponderada** | Média dos 3 últimos meses com pesos 3, 2 e 1, usada quando a regressão não é confiável |

---

## 12. Histórico de Versões

| Versão | Data | Alterações |
|---|---|---|
| **2.5** | Novembro/2026 | Compras de terceiros nos cartões do titular: cadastro de pessoas; campo "de quem é" no parcelamento; compra à vista de terceiro; fatura mantida no valor cheio com o custo próprio derivado dos parcelamentos, separando o que é do titular em Dashboard, Relatórios, orçamentos e Saúde Financeira; divisão visível na linha da fatura e aviso na aba Despesas; uso do limite contando tudo, com a parte de terceiros informada; extrato por pessoa com parcelas, situação, atraso e histórico; recebimento parcela a parcela, sem lançar receita; card "A receber de terceiros" no Dashboard; coluna "De terceiros" na projeção, fora da despesa e do saldo; filtro por pessoa na lista de parcelamentos |
| **2.4** | Outubro/2026 | Correção do lançamento de investimentos (saldo atual acompanha aportes e resgates, com rendimento em tempo real); módulo de Cartões e parcelamentos, com faturas previstas criadas automaticamente nos meses futuros e trava do valor assim que o usuário informa o real; com vínculo automático das faturas já lançadas, alerta de fatura sem vínculo, bloco de parcelas nos meses sem fatura e filtros na lista de parcelamentos: cadastro de cartões com limite, fechamento e vencimento; compras parceladas cadastradas uma vez e distribuídas mês a mês, atravessando o ano; saldo devedor, uso do limite e previsão por cartão; fatura vinculada ao cartão mostrando quanto do total já é parcela conhecida; alerta de fatura menor que as parcelas; parcelas conhecidas integradas à projeção sem dupla contagem |
| **2.3** | Outubro/2026 | Tema escuro como padrão no sistema, no estilo fintech (fundo quase preto, acento verde vivo, abas em pílula), preservando a tela de login original; com ajuste de contraste e PDF impresso em tema claro; aviso de WhatsApp quando todas as contas do mês são pagas; correção da propagação do vencimento em parcelas, recorrentes, cópia em lote, novo mês e novo ano; preservação do vínculo das recorrentes; despesas sem data mantidas em "Mais adiante"; correções de investimentos (duplicação ao renomear, perda de rendimento na cascata, identidade da série nos meses anteriores, exclusão em cascata e aviso de aplicação repetida); novo módulo de Projeção com card no Dashboard; abertura do sistema pelo mês de competência; alertas e lembretes com base única; data completa nas telas e exportações restantes; ajustes de orçamento, fuso horário, validações e carga inicial |
| **2.2** | Setembro/2026 | Troca do provedor de envio de WhatsApp (CallMeBot → Green API), motivada pelo fim do envio gratuito ilimitado do CallMeBot; cadastro de destinatário simplificado (nome e número, sem chave por contato); envio por uma única conta conectada por QR Code |
| **2.1** | Julho/2026 | Correção do salvamento no banco; data de vencimento completa; competência por status de pagamento; notificações em duas páginas; correção da duplicação de investimentos; agrupamento dos lembretes; alertas de vencimento no dia; explicação da saúde financeira |
| **2.0** | Junho/2026 | Identidade visual e ícone; backup; validações; ação de desfazer; acessibilidade; responsividade; notificações por WhatsApp; recursos avançados em todas as abas |
| **1.0** | — | Versão inicial: dashboard, despesas, investimentos, metas, relatórios e configurações |

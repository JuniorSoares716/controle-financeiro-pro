# Changelog — Controle Financeiro PRO

Formato: versão, data e o que mudou. A especificação completa de cada regra está em `HU-Controle-Financeiro-PRO.md`.

---

## [2.5.2] — Novembro/2026

Tema da versão: **o cartão é seu, a compra nem sempre.**

### Adicionado
- **Cadastro de pessoas** (`appSettings.people`), reutilizável entre compras, acessível pelo botão "Pessoas" na aba Cartões.
- **Dono da compra**: o parcelamento ganhou o campo "de quem é", com atalho para cadastrar a pessoa sem perder o que já foi digitado. `personId` nulo = sua compra, e tudo se comporta como antes.
- **Compra à vista de terceiro**, registrada como parcelamento de uma parcela e exibida como "à vista" — reaproveita distribuição, fatura prevista, limite e extrato sem código novo.
- **Separação do que é seu**: a fatura mantém o valor cheio, que bate com o extrato do cartão, e o custo próprio é derivado dos parcelamentos. Dashboard, Relatórios, Projeção, orçamentos e Saúde Financeira passaram a usar só a sua parte; caixa, alertas de vencimento e uso do limite continuam com o valor cheio.
- **Divisão visível**: a linha da fatura mostra `seu X · Pessoa Y`, e a aba Despesas avisa quanto do mês é de terceiros e qual é o custo real — sem isso a aba e o Dashboard pareceriam contraditórios.
- **Extrato por pessoa**: total devido quebrado por cartão, cada compra com as parcelas uma a uma, situação de cada parcela (recebida com data, a receber, atrasada) e o histórico do que já foi acertado.
- **Recebimento parcela a parcela**, com desfazer e com atalho para baixar de uma vez todas as parcelas do mês. Receber apenas baixa o débito: **não lança receita**, porque a despesa correspondente já ficou de fora dos seus totais.
- **Seção "Quem deve a você"** na aba Cartões e **card "A receber de terceiros"** no Dashboard, com total em aberto, o que cai no mês e destaque para o atraso. Ambos só aparecem quando há algo a receber.
- **Projeção com os dois olhares**: coluna "De terceiros" separada da despesa, faixa própria no gráfico e nota no KPI. O saldo acumulado segue apenas o seu compromisso — tratar o reembolso como perda faria o acumulado cair sem motivo.
- **Filtro por pessoa** na lista de parcelamentos, com as opções "só as suas" e "só de terceiros".
- **Aba Pessoas própria**, com os três indicadores no topo e um cartão por pessoa: telefone, compras, quebra por cartão, o que vence no mês, total a receber e os atalhos de Recebi, Extrato, editar e excluir. A aba Cartões ficou com um resumo de uma linha e link, já que os dois assuntos continuam ligados.

### Corrigido
- **Fatura prevista vencendo dentro da própria competência.** O mês do vencimento era deduzido do par fechamento/vencimento: "vence depois de fechar, logo é no mesmo mês". A dedução erra no arranjo mais comum — fecha dia 8, paga dia 15 do mês seguinte —, e a prévia da fatura de dezembro nascia vencendo em dezembro. Agora o cartão **informa** em que mês a fatura vence, e mudar esse campo oferece realinhar as faturas em aberto. Cartão antigo abre com o que vinha sendo deduzido, então nada se move sozinho.
- **Virada de ano zerava parcelas e recorrentes.** O ano novo nascia de um molde que copiava toda despesa com valor zero e sem parcelamento. O financiamento que estava em 3/23 em dezembro aparecia em janeiro sem valor e sem contagem, e as contas fixas chegavam todas em branco. Agora a parcela avança e mantém o valor, a recorrente chega com o valor do cadastro, a parcela cuja série acabou não é copiada, e a despesa comum continua nascendo zerada, como deve. Vale igual para o mês novo.
- **Conserto para quem já criou o ano.** As correções acima valem para anos criados daqui em diante; um ano já gravado continua como está. Para esses, entrou em Configurações o botão **Reaplicar parcelas e recorrentes**, que age no ano selecionado e só em despesas com R$ 0,00 não pagas — o que você já preencheu fica intacto. Ele mostra linha a linha o que pretende mudar antes de gravar, e rodar de novo não faz nada.
- **Parcelas não atravessavam o ano.** Ao salvar uma despesa parcelada, a cascata que cria as parcelas seguintes parava em dezembro. As do ano seguinte nunca existiam.
- **Edição da recorrente desfazia o ajuste do mês.** Mudar o nome ou a categoria reescrevia o valor de todos os meses, apagando o ajuste feito naquele mês — justamente o caso dos impostos, que variam. Agora só mexer no valor do cadastro reescreve os meses.
- **Recorrente repetindo o vencimento de um mês para o outro.** O cadastro de Despesas Recorrentes era o único gerador de lançamentos futuros que montava a data como "o dia informado dentro do próprio mês de competência" — o formulário nem pedia mais do que o dia. Quem tinha a competência de Outubro vencendo em Novembro via a conta de Novembro cair no mesmo 10/11. Os outros três caminhos (despesa marcada como recorrente, parcelamento e cópia para o mês novo) partem da primeira data e andam de mês em mês, e por isso acertavam. Agora o cadastro pergunta **em que mês vence**, no próprio ou no seguinte, e a virada de ano e o fim de mês são tratados.
- **Edição da recorrente desfazendo correção manual.** Mudar o valor reescrevia o vencimento de todos os meses, apagando sem aviso o ajuste feito em um mês específico. Agora só mexer no dia ou no mês do vencimento redefine as datas.
- **Botões "Adicionar" mudos.** A remoção do antigo "detalhar compra" apagou a linha inteira de ouvintes, e o `add-purchase-btn` apenas dividia essa linha com outros sete: Adicionar despesa, investimento, renda, orçamento, meta, categoria e recorrente, mais o "Gerenciar categorias", pararam de responder ao clique. Os ouvintes voltaram, agora um por linha, e um teste novo cobra de cada botão o modal que ele deve abrir.
- **Aba Pessoas derrubava o app.** O template do card da pessoa referenciava uma variável que não existia mais depois da entrada dos filtros, e qualquer carregamento com pessoa cadastrada travava na tela de "Salvando...".
- **Filtros da aba Pessoas não reagiam.** Busca, cartão, situação e ordenação existiam na tela, mas nenhum ouvinte redesenhava a página — só surtiam efeito no próximo salvamento ou troca de aba.
- **Números da pessoa ignoravam o filtro de cartão.** O card mostrava o saldo total enquanto o indicador do topo somava só o cartão escolhido; agora os dois usam o mesmo recorte.
- **Orçamento no WhatsApp contava compra de terceiro.** O serviço somava o valor cheio das faturas, então a categoria de cartão aparecia mais consumida do que é. Passou a usar o custo próprio, e a mensagem informa quanto ficou de fora.
- **Parcelas caindo no mesmo mês.** O vencimento de cada parcela era derivado isoladamente da fatura daquele mês, então uma fatura registrada vencendo dentro da própria competência e outra no mês seguinte produziam parcelas a um dia de distância — 1/3 em 12/11 e 2/3 em 13/11. Agora a 1ª parcela é a âncora e as seguintes andam de mês em mês; fatura de mês posterior só vale se cair no mês que a cadência prevê. Criar fatura prevista e realinhar vencimentos passaram a usar o mesmo ciclo, e o realinhamento preserva o mês de cada fatura, trocando só o dia, alcançando apenas o que ainda não venceu.
- **Parcela do meio aparecendo atrasada com a primeira em dia.** O vencimento dos meses sem fatura lançada era chutado dentro do próprio mês, mas a fatura de Outubro fecha em Outubro e é paga em Novembro. Com a de Outubro registrada vencendo 20/11 e a de Novembro caindo no palpite 11/11, a parcela mais nova vencia antes da mais velha. Agora o sistema aprende o ciclo com as faturas já lançadas e, sem nenhuma, deduz do fechamento e do vencimento cadastrados; uma trava de ordem impede que a sequência inverta em qualquer situação. O extrato passou a mostrar a data de vencimento de cada parcela.
- **Menu com rolagem horizontal em qualquer resolução.** Os nove itens pediam 1277px de largura e o contêiner da página trava em 1216px, então a barra de rolagem aparecia até em 1920px. O padding passou a ser fluido, o `overflow-x-auto` saiu, e o menu agora é fileira única a partir de 1280px e grade de 5 colunas entre 768px e 1279px — sem rolagem e sem nada escondido.
- **Menu sem versão mobile.** Até 767px o menu repetia a estrutura do desktop. Agora há barra com hambúrguer mostrando a aba atual e uma gaveta lateral com os itens na vertical, agrupados em submenus recolhíveis, alvos de toque de 48px, fechamento pelo X, por toque fora, por Esc ou ao escolher um item, e rolagem do fundo travada enquanto aberta. Os itens são gerados a partir das abas reais, sem segunda lista para manter em sincronia.
- **Página rolando na horizontal no celular.** O grupo de indicadores do card "A receber de terceiros" e os cartões da aba Pessoas usavam `flex-shrink-0` e esticavam a página para 490px em telas de 360px. Regressão introduzida nesta mesma versão.
- **Modal nascendo atrás de outro.** Cadastrar uma pessoa de dentro do formulário de parcelamento abria a tela por trás dele, deixando o cadastro inacessível. A ordem passou a ser decidida na hora de abrir, e não pela posição no HTML — vale para qualquer modal sobre modal.
- **Atraso decidido pela virada do mês.** A parcela de terceiro virava "atrasada" assim que o mês acabava, ignorando o vencimento do cartão. Agora segue a data real: vencimento da fatura lançada, ou o dia do cartão, ou o fim do mês.
- **Dia de vencimento do cartão não chegava às faturas já lançadas.** Mudar o dia não alterava o `dueDate` das despesas existentes, e o atraso continuava aparecendo. O sistema passou a oferecer o realinhamento das faturas não pagas, da competência em diante.
- **Fluxo de Caixa sem linha de projeção.** A legenda trazia "Projeção de despesas" mas nada era desenhado quando todos os meses do período já tinham lançamento. Agora a série some junto com a legenda e uma nota explica o motivo.
- **Três cálculos de projeção diferentes.** A linha do Fluxo de Caixa usava média simples dos meses com movimento e o KPI "Projeção (resto do ano)" usava gasto médio × meses restantes, enquanto a aba Projeção usa regressão com queda para média ponderada. Os três passaram a usar o mesmo motor, como manda a RN-PROJ-09.

- **Valor a receber no mês no extrato da pessoa**: o primeiro indicador passou a mostrar o que cobrar agora, seguindo o mês selecionado no topo, com quantas parcelas compõem o valor e quantas estão atrasadas. Sem parcela naquele mês, mostra a próxima a vencer com data; com tudo acertado, mostra "recebido". O card "Compras em aberto", que repetia o cabeçalho, virou subtítulo do total.
- **Indicadores da aba Pessoas e do extrato** passaram a seguir a anatomia dos cards da aba Despesas: faixa colorida à esquerda, valor na cor do indicador e ícone em medalhão. "A receber" em âmbar, "total em aberto" em azul, "atrasado" em vermelho — virando verde com visto quando não há nada vencido.
- **Cor por pessoa**: paleta de 12 tons no cadastro, com a primeira cor livre já sugerida. A cor vira ponto antes do nome na aba Pessoas e no extrato, e tinge a etiqueta do nome na lista de parcelamentos, na linha da fatura, no aviso da aba Despesas e no card do Dashboard. Quem foi cadastrado antes recebe uma cor derivada da identificação, estável entre sessões.

### Removido
- **Detalhamento de compras dentro da fatura**, do tempo anterior ao módulo de Cartões. Ele fazia pior o que os Parcelamentos fazem: propagava a parcela procurando a fatura pelo **nome** nos meses seguintes — renomear a fatura fazia a parcela sumir — e parava em Dezembro, sem atravessar o ano. Pior, sequestrava o valor da fatura: com compras detalhadas, o valor virava a soma delas e o campo ficava somente leitura, e a fatura prevista deixava de ser sincronizada. Faturas que já tinham detalhamento mantêm o valor como está e voltam a ter o campo editável.

- **Parcelamentos agrupados por pessoa**: faixa com o ponto colorido, o nome, a contagem e o subtotal de cada um — "a pagar" nas suas, "a receber" nas de terceiros. A ordenação escolhida vale dentro de cada grupo, e a etiqueta do nome sai da linha. Sem compra de terceiro no conjunto visível, a tabela continua simples.

- **Parcelamentos em árvore**: a faixa da pessoa, as linhas das compras dela e o ponto de cada linha compartilham a cor, ligados por tronco e ramo. No celular a cor vira a borda do cartão.
- **Confirmação ao editar despesa**: o lápis agora pergunta antes de abrir o formulário, como já faziam duplicar e excluir.
- **Ícone de pago por despesa**: resolve uma linha sozinha, com alerta dizendo para qual estado vai. Verde quando paga, cinza quando pendente. A marcação em lote continua para quando forem várias.

- **Assinaturas de terceiros**: compra recorrente no seu cartão, sem total de parcelas — a mensalidade de quem usa seu cartão todo mês. Até onde projetar é o horizonte da aba Projeção, o mesmo que você já escolhe lá. Cancelar é encerrar, informando o mês da última cobrança: o histórico fica e o que estiver pendente continua a receber. A dívida conta só o que já foi cobrado, e o compromisso futuro aparece como "R$ X/mês" na linha, na faixa da pessoa e no subtítulo.

- **Busca dos parcelamentos em qualquer campo**: nome, pessoa, cartão, valor, quanto falta, contagem de parcelas, competência e situação. O valor é reconhecido com vírgula, com ponto ou só a parte inteira, e vários termos funcionam como "e".

### Travas
- Salvar fatura com valor **menor** que a parte de terceiros pede confirmação e explica que o custo próprio vai a zero; o custo nunca fica negativo.
- Excluir pessoa com compra lançada é bloqueado: as parcelas ficariam órfãs e voltariam a contar como suas sem aviso.
- Nome de pessoa repetido é recusado, para o extrato não ficar ambíguo.
- Editar o parcelamento preserva os recebimentos; passar a compra para você limpa os recebimentos, que deixam de ter sentido.

### Notas de migração
- Nenhuma alteração destrutiva. Sem pessoas cadastradas, todas as telas se comportam como na 2.4.
- Ao marcar como de terceiros parcelamentos que já existiam, o total de despesas daqueles meses **cai** e a nota de Saúde Financeira sobe. Não é perda de dado: é a correção.
- O serviço de WhatsApp continua somando o valor cheio das faturas, que é o que de fato sai da conta.

### Documentação
- Especificação em **148 regras**, **19 histórias de usuário** e **216 cenários de teste**; seção 4.13 nova, com a tabela de "qual valor onde".

---

## [2.4] — Outubro/2026 · versão fechada

### Adicionado
- **Módulo de Cartões e parcelamentos** (aba nova). Cadastro de cartões com limite, dia de fechamento e dia de vencimento; compras parceladas cadastradas uma vez e distribuídas mês a mês, atravessando o ano; saldo devedor e percentual do limite comprometido por cartão; gráfico do comprometido nos próximos 12 meses; lista de parcelamentos com filtros de cartão, situação, busca e ordenação.
- **Faturas previstas**: ao cadastrar um parcelamento, as faturas dos meses futuros são criadas com a soma das parcelas e marcadas como "prevista". Assim que o usuário informa o valor real, a trava cai e o sistema não altera mais aquele valor.
- **Vínculo automático de faturas**: ao cadastrar um cartão, o sistema encontra os lançamentos já existentes com aquele nome, em todos os anos, e oferece vinculá-los de uma vez. Lançamentos sem vínculo geram alerta.
- **Módulo de Projeção** (aba nova) e card **Previsão de Gastos** no Dashboard. Cada mês separa o compromisso já assumido da estimativa estatística; regressão linear com queda automática para média ponderada; piso em zero, teto de 1,5× o maior mês e indicador de confiança visível.
- **Aviso de mês quitado no WhatsApp**: quando a última conta em aberto de um mês é paga, sai uma mensagem de fechamento. Controle em `appSettings.notificacoes` impede repetição e rearma quando o mês volta a ter conta em aberto.
- **Tema escuro como padrão**, em estilo fintech: fundo quase preto, acento verde vivo, abas em pílula e contraste ajustado. A tela de login mantém a identidade clara original.

### Corrigido
- **Propagação do vencimento**: parcelas, recorrentes, cópia em lote, novo mês e novo ano passaram a mover a data junto, preservando o dia e a distância entre competência e vencimento, com ajuste de dia inexistente no mês de destino.
- **Vínculo das recorrentes**: editar um lançamento não rompe mais o `recurringId`, o que gerava lançamento duplicado na edição seguinte.
- **Despesas sem data** deixaram de sumir dos Lembretes; agora caem em "Mais adiante".
- **Investimentos**: renomear banco ou aplicação em registro antigo não duplica mais a série; a cascata preserva o rendimento já lançado nos meses seguintes; a identidade da série passa a valer também para os meses anteriores; a exclusão desce para os meses seguintes; e adicionar uma aplicação que já existe no mês dispara confirmação.
- **Lançamento de investimento**: o saldo atual acompanha automaticamente aportes e resgates, com o rendimento do mês exibido em tempo real. Antes, informar um aporte sem corrigir o saldo fazia o aporte aparecer como prejuízo.
- **Abertura do sistema** passou a usar o mês de competência, a mesma regra das notificações.
- **Alertas do Dashboard e Lembretes** passaram a usar a mesma base de dados; as contagens não divergem mais.
- **Vencimento completo** nas telas restantes: "Próximos 7 Dias", ordenação por vencimento e exportações CSV.
- **Criação de ano**: usa o último mês com despesas como modelo, em vez de Outubro fixo, e copia as metas.
- **Orçamentos**: 80% passou a ser inclusivo na faixa "apertado"; orçamentos com limite zero saíram da conta da Saúde Financeira; trocar a categoria na edição não deixa mais dois orçamentos na mesma categoria.
- **Datas geradas pelo sistema** passaram a usar o fuso local; antes, após as 21h, gravavam o dia seguinte.
- **Contribuição de meta** rejeita valor negativo.
- **CSV do mês** ganhou BOM, corrigindo a acentuação no Excel.
- **Carga inicial** preserva os contatos de WhatsApp quando o documento existe sem nenhum ano válido.
- **Exportar PDF** alterna para o tema claro antes de imprimir, evitando texto ilegível no papel.
- `<div>` não fechada na aba Configurações.

### Documentação
- Especificação ampliada para **94 regras**, **18 histórias de usuário** e **62 cenários de teste**.
- `GUIA-DE-INSTALACAO.md`: passo a passo de GitHub, Firebase e WhatsApp, com as regras do Firestore prontas.
- `ANALISE-SISTEMA-v2.3.md`: auditoria completa do sistema.
- Apresentação em PDF com telas reais e diagramas, mais roteiro de fala.

---

## [2.3] — Outubro/2026

Versão intermediária, consolidada na 2.4. Trouxe a primeira rodada de correções de vencimento e investimentos, o módulo de Projeção e o tema escuro.

---

## [2.2] — Setembro/2026

- Troca do provedor de WhatsApp (CallMeBot → Green API), motivada pelo fim do envio gratuito ilimitado do CallMeBot.
- Cadastro de destinatário simplificado: nome e número, sem chave por contato.
- Envio por uma única conta conectada por QR Code.

## [2.1] — Julho/2026

- Correção do salvamento no banco; data de vencimento completa; competência por status de pagamento; notificações em duas páginas; correção da duplicação de investimentos; agrupamento dos lembretes; alertas de vencimento no dia; explicação da saúde financeira.

## [2.0] — Junho/2026

- Identidade visual e ícone; backup; validações; ação de desfazer; acessibilidade; responsividade; notificações por WhatsApp; recursos avançados em todas as abas.

## [1.0]

- Versão inicial: dashboard, despesas, investimentos, metas, relatórios e configurações.

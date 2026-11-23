import * as S from './alvo.mjs';

let falhas = 0, total = 0;
const eq = (nome, obtido, esperado) => {
    total++;
    const ok = Math.abs((obtido ?? NaN) - esperado) < 0.005 || obtido === esperado;
    if (!ok) { falhas++; console.log(`  FALHOU ${nome}: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`); }
    else console.log(`  ok  ${nome} = ${JSON.stringify(obtido)}`);
};

const NUBANK = 'c_nu', AMAZON = 'c_amz';
const MARIANA = 'p_mari', PEDRO = 'p_pedro';

const montar = (valorFaturaNov = 1820) => ({
    appSettings: {
        cards: [
            { id: NUBANK, name: 'Nubank', limit: 8000, closingDay: 25, dueDay: 5 },
            { id: AMAZON, name: 'Amazon', limit: 3000, closingDay: 20, dueDay: 1 }
        ],
        people: [
            { id: MARIANA, name: 'Mariana', phone: '', createdAt: '2026-11-11' },
            { id: PEDRO, name: 'Pedro', phone: '', createdAt: '2026-11-11' }
        ],
        installmentPlans: [
            // sua: 10x de 129 a partir de Novembro/2026
            { id: 'pl1', cardId: NUBANK, description: 'Notebook', installmentValue: 129,
              totalInstallments: 10, firstMonth: 'Novembro', firstYear: '2026', personId: null },
            // de Mariana: 8x de 380, atravessa o ano
            { id: 'pl2', cardId: NUBANK, description: 'Celular da Mariana', installmentValue: 380,
              totalInstallments: 8, firstMonth: 'Novembro', firstYear: '2026', personId: MARIANA, recebimentos: {} },
            // de Pedro: à vista de 150, só em Novembro
            { id: 'pl3', cardId: NUBANK, description: 'Fone do Pedro', installmentValue: 150,
              totalInstallments: 1, firstMonth: 'Novembro', firstYear: '2026', personId: PEDRO, recebimentos: {} }
        ]
    },
    2026: {
        summary: [{ month: 'Outubro' }, { month: 'Novembro' }, { month: 'Dezembro' }],
        expenseCategories: [{ id: 'cat_cartao', name: 'Faturas de Cartão', icon: 'credit-card' },
                            { id: 'cat_casa', name: 'Casa', icon: 'house' }],
        budgets: [],
        monthlyIncomes: { Outubro: [], Novembro: [{ id: 'i1', value: 9000 }], Dezembro: [] },
        monthlyDetails: {
            Outubro: { expenses: [] },
            Novembro: { expenses: [
                { id: 'e1', name: 'Fatura Nubank', categoryId: 'cat_cartao', cardId: NUBANK, value: valorFaturaNov, paid: false },
                { id: 'e2', name: 'Aluguel', categoryId: 'cat_casa', cardId: null, value: 2200, paid: true }
            ] },
            Dezembro: { expenses: [] }
        }
    },
    2027: { summary: [], expenseCategories: [], monthlyIncomes: {}, monthlyDetails: {} }
});

console.log('\n== 1. Fatura cheia com terceiros dentro ==');
S.setDb(montar());
const fatura = S.database[2026].monthlyDetails.Novembro.expenses[0];
eq('parcelas do mês no Nubank', S.parcelasDoMes(NUBANK, '2026', 'Novembro').length, 3);
eq('parte de terceiros (380 + 150)', S.terceirosDoMes(NUBANK, '2026', 'Novembro'), 530);
eq('fatura mantém valor cheio', fatura.value, 1820);
eq('custo próprio da fatura', S.custoProprio(fatura, '2026', 'Novembro'), 1290);
eq('soma própria do mês (1290 + 2200)', S.somaPropria(S.database[2026].monthlyDetails.Novembro.expenses, '2026', 'Novembro'), 3490);
eq('despesa sem cartão não muda', S.custoProprio({ value: 2200, cardId: null }, '2026', 'Novembro'), 2200);

console.log('\n== 2. Conciliação: seu + terceiros = fatura ==');
const seu = S.custoProprio(fatura, '2026', 'Novembro');
const ter = S.terceirosDaDespesa(fatura, '2026', 'Novembro');
eq('seu + terceiros bate com a fatura', seu + ter, fatura.value);

console.log('\n== 3. Quebra por pessoa ==');
const grupos = S.terceirosPorPessoa(NUBANK, '2026', 'Novembro');
eq('duas pessoas no mês', grupos.length, 2);
eq('maior primeiro é Mariana', S.nomePessoa(grupos[0].personId), 'Mariana');
eq('valor da Mariana', grupos[0].total, 380);
eq('valor do Pedro', grupos[1].total, 150);

console.log('\n== 4. Resumo do mês usa o seu custo ==');
S.recalculateSummaries('2026');
const nov = S.database[2026].summary.find(s => s.month === 'Novembro');
eq('summary.expenses = seu custo', nov.expenses, 3490);
eq('summary.expensesTotais = caixa', nov.expensesTotais, 4020);
eq('summary.terceiros', nov.terceiros, 530);
eq('saldo do mês (9000 - 3490)', nov.income - nov.expenses, 5510);
eq('mês sem despesa zera os três', S.database[2026].summary.find(s => s.month === 'Outubro').terceiros, 0);

console.log('\n== 5. Limite do cartão conta tudo (RN-TER-08) ==');
const uso = S.usoDoCartao(S.findCard(NUBANK), '2026', 'Novembro');
eq('do mês = fatura cheia', uso.doMes, 1820);
// futuras: Notebook 9x129 = 1161 + Mariana 7x380 = 2660
eq('futuras incluem terceiros', uso.futuras, 1161 + 2660);
eq('total comprometido', uso.total, 1820 + 1161 + 2660);

console.log('\n== 6. Mês seguinte: à vista não repete ==');
eq('terceiros em Dezembro = só Mariana', S.terceirosDoMes(NUBANK, '2026', 'Dezembro'), 380);
eq('suas parcelas em Dezembro', S.parcelasPropriasDoMes(NUBANK, '2026', 'Dezembro').reduce((s, i) => s + i.value, 0), 129);

console.log('\n== 7. Parcelamento de terceiro atravessa o ano ==');
const ultima = S.planInstallments(S.getPlans()[1]).slice(-1)[0];
eq('8ª parcela da Mariana cai em Junho/2027', `${ultima.month}/${ultima.year}`, 'Junho/2027');
eq('terceiros em Junho/2027', S.terceirosDoMes(NUBANK, '2027', 'Junho'), 380);
eq('terceiros em Julho/2027 (acabou)', S.terceirosDoMes(NUBANK, '2027', 'Julho'), 0);

console.log('\n== 8. Fatura menor que a parte de terceiros: piso em zero ==');
S.setDb(montar(400));
const f400 = S.database[2026].monthlyDetails.Novembro.expenses[0];
eq('custo próprio não fica negativo', S.custoProprio(f400, '2026', 'Novembro'), 0);
eq('terceiros limitado ao valor lançado', S.terceirosDaDespesa(f400, '2026', 'Novembro'), 400);
eq('seu + terceiros ainda bate', S.custoProprio(f400, '2026', 'Novembro') + S.terceirosDaDespesa(f400, '2026', 'Novembro'), 400);

console.log('\n== 9. Cartão sem compra de terceiro não muda nada ==');
S.setDb(montar());
eq('Amazon sem terceiros', S.terceirosDoMes(AMAZON, '2026', 'Novembro'), 0);
eq('fatura da Amazon seria integral', S.custoProprio({ value: 900, cardId: AMAZON }, '2026', 'Novembro'), 900);

console.log('\n== 10. Sem pessoas cadastradas, comportamento antigo ==');
const antigo = montar();
antigo.appSettings.people = [];
antigo.appSettings.installmentPlans = antigo.appSettings.installmentPlans
    .filter(p => !p.personId);
S.setDb(antigo);
S.recalculateSummaries('2026');
const novAntigo = S.database[2026].summary.find(s => s.month === 'Novembro');
eq('custo = valor cheio', novAntigo.expenses, 4020);
eq('nada de terceiros', novAntigo.terceiros, 0);
eq('planos da pessoa some', S.planosDaPessoa(MARIANA).length, 0);
eq('nome de pessoa inexistente', S.nomePessoa('p_nao_existe'), 'Terceiro');

console.log(`\n${total - falhas}/${total} cenários passaram.`);
process.exit(falhas ? 1 : 0);

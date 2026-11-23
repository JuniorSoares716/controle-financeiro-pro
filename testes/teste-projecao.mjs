import * as S from './alvo.mjs';

let falhas = 0, total = 0;
const eq = (nome, obtido, esperado) => {
    total++;
    const ok = (typeof obtido === 'number' && typeof esperado === 'number')
        ? Math.abs(obtido - esperado) < 0.005
        : JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) { falhas++; console.log(`  FALHOU ${nome}: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`); }
    else console.log(`  ok  ${nome} = ${JSON.stringify(obtido)}`);
};

const NUBANK = 'c_nu', MARIANA = 'p_mari';
const MESES = S.MESES_SYS;

// Ano com 10 meses de histórico estável e parcelamentos a partir de Novembro.
const montar = ({ comTerceiro = true, faturaNov = null } = {}) => {
    const monthlyDetails = {}, monthlyIncomes = {}, summary = [];
    MESES.forEach((m, i) => {
        monthlyDetails[m] = { expenses: [] };
        monthlyIncomes[m] = [];
        summary.push({ month: m, income: 0, expenses: 0 });
        if (i <= 9) { // Janeiro a Outubro: histórico
            monthlyDetails[m].expenses.push({ id: 'e' + i, name: 'Vida', categoryId: 'c1', cardId: null, value: 3000, paid: true });
            monthlyIncomes[m].push({ id: 'r' + i, value: 8000 });
        }
    });
    if (faturaNov != null) {
        monthlyDetails['Novembro'].expenses.push({ id: 'fat_nov', name: 'Fatura Nubank', categoryId: 'c1', cardId: NUBANK, value: faturaNov, paid: false });
    }
    const planos = [
        { id: 'pl_meu', cardId: NUBANK, description: 'Notebook', installmentValue: 400,
          totalInstallments: 6, firstMonth: 'Novembro', firstYear: '2026', personId: null }
    ];
    if (comTerceiro) planos.push(
        { id: 'pl_mari', cardId: NUBANK, description: 'Celular da Mariana', installmentValue: 380,
          totalInstallments: 4, firstMonth: 'Novembro', firstYear: '2026', personId: MARIANA, recebimentos: {} });
    return {
        appSettings: {
            cards: [{ id: NUBANK, name: 'Nubank', limit: 9000, closingDay: 25, dueDay: 10 }],
            people: [{ id: MARIANA, name: 'Mariana', phone: '', createdAt: '2026-10-01' }],
            installmentPlans: planos
        },
        2026: { summary, expenseCategories: [{ id: 'c1', name: 'Casa', icon: 'house' }],
                budgets: [], monthlyIncomes, monthlyDetails },
        2027: { summary: [], expenseCategories: [], budgets: [], monthlyIncomes: {}, monthlyDetails: {} }
    };
};

console.log('\n== 1. Previsto de terceiros, sem fatura lançada ==');
S.setDb(montar());
S.recalculateSummaries('2026');
eq('Novembro: só a parcela da Mariana', S.terceirosPrevistosNoMes('2026', 'Novembro'), 380);
eq('Fevereiro/2027: 4ª e última', S.terceirosPrevistosNoMes('2027', 'Fevereiro'), 380);
eq('Março/2027: acabou', S.terceirosPrevistosNoMes('2027', 'Março'), 0);
eq('mês sem parcelamento nenhum', S.terceirosPrevistosNoMes('2026', 'Maio'), 0);

console.log('\n== 2. Com fatura lançada, o teto é o valor da fatura (RN-TER-12) ==');
S.setDb(montar({ faturaNov: 1000 }));  // 400 seus + 380 dela cabem
S.recalculateSummaries('2026');
eq('fatura cobre tudo: terceiros integrais', S.terceirosPrevistosNoMes('2026', 'Novembro'), 380);
S.setDb(montar({ faturaNov: 200 }));   // fatura menor que a parte dela
S.recalculateSummaries('2026');
eq('fatura menor: terceiros limitados a ela', S.terceirosPrevistosNoMes('2026', 'Novembro'), 200);
eq('e o custo próprio vai a zero',
   S.custoProprio(S.database[2026].monthlyDetails['Novembro'].expenses.find(e => e.cardId), '2026', 'Novembro'), 0);

console.log('\n== 3. Projeção a partir de Outubro: os dois olhares ==');
S.setDb(montar());
S.recalculateSummaries('2026');
const { linhas } = S.projetarMeses('2026', 'Outubro', 4); // Nov, Dez, Jan/27, Fev/27
eq('quatro meses projetados', linhas.length, 4);
eq('primeiro é Novembro', `${linhas[0].month}/${linhas[0].year}`, 'Novembro/2026');
eq('último é Fevereiro/2027', `${linhas[3].month}/${linhas[3].year}`, 'Fevereiro/2027');

const nov = linhas[0];
eq('Novembro: compromisso seu = só a sua parcela', nov.cadastrado, 400);
eq('Novembro: terceiros em coluna separada', nov.terceiros, 380);
eq('Novembro: desembolso = despesa + terceiros', nov.desembolso, nov.despesa + 380);
eq('terceiros NÃO entram na despesa', nov.despesa < nov.desembolso, true);
eq('saldo usa a despesa, não o desembolso', nov.saldo, nov.receita - nov.despesa);

console.log('\n== 4. O acumulado ignora o reembolso ==');
S.setDb(montar({ comTerceiro: false }));
S.recalculateSummaries('2026');
const semTer = S.projetarMeses('2026', 'Outubro', 4).linhas;
S.setDb(montar());
S.recalculateSummaries('2026');
const comTer = S.projetarMeses('2026', 'Outubro', 4).linhas;
eq('despesa igual com e sem terceiro', comTer[0].despesa, semTer[0].despesa);
eq('saldo acumulado igual com e sem terceiro', comTer[3].acumulado, semTer[3].acumulado);
eq('mas o desembolso é maior', comTer[0].desembolso > semTer[0].desembolso, true);
eq('sem terceiro, desembolso = despesa', semTer[0].desembolso, semTer[0].despesa);
eq('sem terceiro, coluna zerada', semTer[0].terceiros, 0);

console.log('\n== 5. Soma do período ==');
const totalTer = comTer.reduce((s, l) => s + l.terceiros, 0);
eq('4 parcelas de 380 no período', totalTer, 4 * 380);
const totalDesp = comTer.reduce((s, l) => s + l.despesa, 0);
const totalDesemb = comTer.reduce((s, l) => s + l.desembolso, 0);
eq('desembolso − despesa = terceiros', totalDesemb - totalDesp, totalTer);

console.log('\n== 6. Com a fatura lançada não há dupla contagem ==');
S.setDb(montar({ faturaNov: 1000 }));
S.recalculateSummaries('2026');
const comFat = S.projetarMeses('2026', 'Outubro', 2).linhas[0];
eq('cadastrado = só o seu lado da fatura (1000 − 380)', comFat.cadastrado, 620);
eq('terceiros continuam 380', comFat.terceiros, 380);
eq('desembolso devolve a fatura cheia', comFat.cadastrado + comFat.terceiros, 1000);

console.log('\n== 7. Resumo de terceiros alimenta o card do Dashboard ==');
S.setDb(montar());
S.recalculateSummaries('2026');
const r = S.resumoTerceiros('2026', 'Novembro');
eq('uma pessoa', r.pessoas.length, 1);
eq('total em aberto = 4 parcelas', r.falta, 4 * 380);
eq('em Novembro cai uma', r.noMes, 380);
eq('nada recebido', r.recebidoNoMes, 0);
eq('nada atrasado: fecha 25 e vence 10, a de Novembro só vence em 10/12', r.atrasado, 0);

console.log(`\n${total - falhas}/${total} cenários passaram.`);
process.exit(falhas ? 1 : 0);

/* Garante que o serviço de WhatsApp e o app calculam a MESMA parte de terceiros.
   A lógica está duplicada por necessidade (arquivo único x Node), então o teste
   é o que impede os dois lados de divergirem em silêncio. */
import { createRequire } from 'module';
import * as APP from './alvo.mjs';
import { prepararServico } from './stub.mjs';
/* O serviço é CommonJS e importa firebase-admin. preparar.mjs deixa uma cópia dele
   ao lado de um dublê do firebase-admin, então o require encontra o dublê primeiro
   e nada toca no Firebase de verdade. */
const require = createRequire(import.meta.url);
const SVC = require(prepararServico());

let falhas = 0, total = 0;
const eq = (nome, obtido, esperado) => {
    total++;
    const ok = (typeof obtido === 'number' && typeof esperado === 'number')
        ? Math.abs(obtido - esperado) < 0.005
        : JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) { falhas++; console.log(`  FALHOU ${nome}: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`); }
    else console.log(`  ok  ${nome} = ${JSON.stringify(obtido)}`);
};

const NU = 'c_nu', AMZ = 'c_amz', MARI = 'p_mari';
const CAT_CARTAO = 'cat_cartao', CAT_CASA = 'cat_casa';

const montar = () => ({
    appSettings: {
        cards: [{ id: NU, name: 'Nubank', limit: 8000, closingDay: 25, dueDay: 10 },
                { id: AMZ, name: 'Amazon', limit: 3000, closingDay: 18, dueDay: 28 }],
        people: [{ id: MARI, name: 'Mariana', phone: '', color: '#60A5FA', createdAt: '2026-08-01' }],
        installmentPlans: [
            { id: 'meu', cardId: NU, description: 'Notebook', installmentValue: 420,
              totalInstallments: 10, firstMonth: 'Agosto', firstYear: '2026', personId: null },
            { id: 'dela', cardId: NU, description: 'Celular da Mariana', installmentValue: 380,
              totalInstallments: 6, firstMonth: 'Agosto', firstYear: '2026', personId: MARI, recebimentos: {} },
            { id: 'dela2', cardId: AMZ, description: 'Livros', installmentValue: 120,
              totalInstallments: 4, firstMonth: 'Outubro', firstYear: '2026', personId: MARI, recebimentos: {} }
        ]
    },
    2026: {
        summary: [{ month: 'Outubro' }, { month: 'Novembro' }],
        expenseCategories: [{ id: CAT_CARTAO, name: 'Faturas de Cartão' }, { id: CAT_CASA, name: 'Casa' }],
        budgets: [{ categoryId: CAT_CARTAO, limit: 2000 }, { categoryId: CAT_CASA, limit: 2500 }],
        monthlyIncomes: { Outubro: [], Novembro: [] },
        monthlyDetails: {
            Outubro: { expenses: [
                { id: 'f_nu', name: 'Fatura Nubank', categoryId: CAT_CARTAO, cardId: NU, value: 1820, paid: false },
                { id: 'f_amz', name: 'Fatura Amazon', categoryId: CAT_CARTAO, cardId: AMZ, value: 600, paid: false },
                { id: 'aluguel', name: 'Aluguel', categoryId: CAT_CASA, cardId: null, value: 2200, paid: true }
            ] },
            Novembro: { expenses: [] }
        }
    },
    2027: { summary: [], expenseCategories: [], budgets: [], monthlyIncomes: {}, monthlyDetails: {} }
});

const db = montar();
APP.setDb(db);
const fatNu = db[2026].monthlyDetails.Outubro.expenses[0];
const fatAmz = db[2026].monthlyDetails.Outubro.expenses[1];
const aluguel = db[2026].monthlyDetails.Outubro.expenses[2];

console.log('\n== 1. Os dois lados enxergam a mesma parte de terceiros ==');
eq('terceiros no Nubank (app)', APP.terceirosDoMes(NU, '2026', 'Outubro'), 380);
eq('terceiros no Nubank (serviço)', SVC.terceirosDoMes(db, NU, '2026', 'Outubro'), 380);
eq('terceiros na Amazon (app)', APP.terceirosDoMes(AMZ, '2026', 'Outubro'), 120);
eq('terceiros na Amazon (serviço)', SVC.terceirosDoMes(db, AMZ, '2026', 'Outubro'), 120);

console.log('\n== 2. Custo próprio idêntico nos dois ==');
[['Fatura Nubank', fatNu, 1820 - 380], ['Fatura Amazon', fatAmz, 600 - 120], ['Aluguel', aluguel, 2200]]
    .forEach(([nome, desp, esperado]) => {
        const a = APP.custoProprio(desp, '2026', 'Outubro');
        const s = SVC.custoProprio(db, desp, '2026', 'Outubro');
        eq(`${nome}: app`, a, esperado);
        eq(`${nome}: serviço igual ao app`, s, a);
    });

console.log('\n== 3. Consumo do orçamento de cartão ==');
const despesas = db[2026].monthlyDetails.Outubro.expenses;
const gastoCheio = despesas.filter(e => e.categoryId === CAT_CARTAO).reduce((s, e) => s + e.value, 0);
const gastoProprio = despesas.filter(e => e.categoryId === CAT_CARTAO)
    .reduce((s, e) => s + SVC.custoProprio(db, e, '2026', 'Outubro'), 0);
eq('valor cheio das faturas', gastoCheio, 2420);
eq('seu custo real', gastoProprio, 2420 - 500);
eq('com o valor cheio o orçamento de 2000 estourava', gastoCheio > 2000, true);
eq('com o seu custo ele cabe', gastoProprio <= 2000, true);
eq('serviço bate com o app', gastoProprio, despesas.filter(e => e.categoryId === CAT_CARTAO)
    .reduce((s, e) => s + APP.custoProprio(e, '2026', 'Outubro'), 0));

console.log('\n== 4. Categoria sem cartão não muda ==');
eq('Casa segue integral', SVC.custoProprio(db, aluguel, '2026', 'Outubro'), 2200);

console.log('\n== 5. Avisos de vencimento e total pago seguem no valor cheio ==');
const resumo = SVC.resumoDoMes(db, '2026', 'Outubro');
eq('total pago usa o valor cheio da despesa paga', resumo.valorPago, 2200);
eq('contagem de despesas', resumo.total, 3);
eq('em aberto', resumo.emAberto, 2);

console.log('\n== 6. Parcelas do plano batem com o app ==');
const planoDela = db.appSettings.installmentPlans[1];
const svcParc = SVC.parcelasDoPlano(planoDela).map(i => `${i.month}/${i.year}`);
const appParc = APP.planInstallments(planoDela).map(i => `${i.month}/${i.year}`);
eq('mesma distribuição mês a mês', svcParc, appParc);
eq('6 parcelas atravessando o ano', svcParc, ['Agosto/2026', 'Setembro/2026', 'Outubro/2026',
    'Novembro/2026', 'Dezembro/2026', 'Janeiro/2027']);

console.log('\n== 7. Sem pessoas cadastradas, nada muda ==');
const limpo = montar();
limpo.appSettings.people = [];
limpo.appSettings.installmentPlans = limpo.appSettings.installmentPlans.filter(p => !p.personId);
APP.setDb(limpo);
const fatLimpa = limpo[2026].monthlyDetails.Outubro.expenses[0];
eq('app devolve o valor cheio', APP.custoProprio(fatLimpa, '2026', 'Outubro'), 1820);
eq('serviço devolve o valor cheio', SVC.custoProprio(limpo, fatLimpa, '2026', 'Outubro'), 1820);

console.log(`\n${total - falhas}/${total} cenários passaram.`);
process.exit(falhas ? 1 : 0);

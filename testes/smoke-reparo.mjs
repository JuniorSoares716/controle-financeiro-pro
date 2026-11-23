/* RN-PROP-04: o conserto de um ano criado pela regra antiga. Reproduz exatamente
   o estado que o usuário tinha — 2027 com o financiamento zerado e as contas fixas
   em branco — e cobra que o conserto só encoste no que está intocado. */
import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';

const vazio = () => ({ expenses: [] });
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* 2026 com a série viva; 2027 como a regra antiga o deixava: tudo zerado,
   sem parcelamento, com as recorrentes presentes mas em branco. */
const comAnoAntigo = () => {
    const db = JSON.parse(readFileSync(DADOS, 'utf8'));
    const cat = db['2026'].expenseCategories[0].id;
    db['2026'].recurringExpenses = [{ id: 'rec_das', name: 'Simples Nacional', categoryId: cat,
        value: 480.49, due: 20, startMonth: 'Janeiro', dueMonthOffset: 0 }];
    db['2026'].monthlyDetails['Dezembro'] = { expenses: [
        { id: 'fin26', categoryId: cat, name: 'Financiamento carro', value: 618.27, paid: false,
          isInstallment: true, currentInstallment: 3, totalInstallments: 23, dueDate: '2027-01-21', due: 21 },
        { id: 'gel26', categoryId: cat, name: 'Geladeira', value: 300, paid: false,
          isInstallment: true, currentInstallment: 10, totalInstallments: 12, dueDate: '2026-12-15', due: 15 },
        { id: 'das26', categoryId: cat, name: 'Simples Nacional', value: 480.49, paid: false,
          recurringId: 'rec_das', dueDate: '2026-12-20', due: 20 }
    ] };
    db['2026'].summary = MESES.map(m => ({ month: m, income: 0, expenses: 0 }));

    db['2027'] = {
        summary: MESES.map(m => ({ month: m, income: 0, expenses: 0 })),
        expenseCategories: JSON.parse(JSON.stringify(db['2026'].expenseCategories)),
        budgets: [], savingsGoals: [], monthlyIncomes: {}, monthlyInvestments: {},
        recurringExpenses: JSON.parse(JSON.stringify(db['2026'].recurringExpenses)),
        monthlyDetails: {}
    };
    MESES.forEach((m, i) => {
        const mm = String(i + 1).padStart(2, '0');
        db['2027'].monthlyInvestments[m] = [];
        db['2027'].monthlyIncomes[m] = [];
        db['2027'].monthlyDetails[m] = { expenses: [
            { id: `fin27_${i}`, categoryId: cat, name: 'Financiamento carro', value: 0, paid: false,
              isInstallment: false, dueDate: `2027-${mm}-21`, due: 21 },
            { id: `gel27_${i}`, categoryId: cat, name: 'Geladeira', value: 0, paid: false,
              isInstallment: false, dueDate: `2027-${mm}-15`, due: 15 },
            { id: `das27_${i}`, categoryId: cat, name: 'Simples Nacional', value: 0, paid: false,
              recurringId: 'rec_das', dueDate: `2027-${mm}-20`, due: 20 },
            { id: `alu27_${i}`, categoryId: cat, name: 'Aluguel', value: 0, paid: false, dueDate: `2027-${mm}-05`, due: 5 }
        ] };
    });
    // o usuário já tinha preenchido fevereiro à mão: não pode ser tocado
    db['2027'].monthlyDetails['Fevereiro'].expenses[0].value = 700;
    db['2027'].monthlyDetails['Março'].expenses[2].value = 0;
    db['2027'].monthlyDetails['Março'].expenses[2].paid = true;
    return db;
};

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

const desp = (ano, mes) => pg.evaluate(([a, m]) => {
    const d = JSON.parse(localStorage.getItem('finance-demo-data'));
    return ((((d[a] || {}).monthlyDetails || {})[m] || {}).expenses || [])
        .map(e => ({ nome: e.name, valor: e.value, pago: !!e.paid,
                     parc: e.isInstallment ? `${e.currentInstallment}/${e.totalInstallments}` : null, venc: e.dueDate }));
}, [ano, mes]);

await pg.goto(APP_URL); await pg.waitForTimeout(700);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(comAnoAntigo()));
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#year-selector-main', '2027'); await pg.waitForTimeout(1600);
await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="settings"]').click());
await pg.waitForTimeout(1500);

console.log('\n== Antes: o ano está do jeito que o usuário descreveu ==');
let jan = await desp('2027', 'Janeiro');
checa('financiamento zerado e sem parcela',
    jan[0].valor === 0 && jan[0].parc === null, `${jan[0].valor} / ${jan[0].parc}`);
checa('recorrente zerada', jan[2].valor === 0);

console.log('\n== O botão mostra o que vai mudar antes de gravar ==');
await pg.evaluate(() => document.getElementById('reparar-ano-btn').click());
await pg.waitForTimeout(900);
const msg = await pg.$eval('#confirm-message', el => el.textContent);
checa('o alerta lista as parcelas', /Parcelas restauradas/.test(msg) && /4\/23/.test(msg), msg.slice(0, 90));
checa('lista as recorrentes', /Recorrentes com valor/.test(msg) && /480,49/.test(msg));
checa('e avisa das séries encerradas', /série encerrada|série terminou/.test(msg));
console.log('\n== Recusar não muda nada ==');
await pg.click('#confirm-cancel'); await pg.waitForTimeout(1200);
jan = await desp('2027', 'Janeiro');
checa('tudo como estava', jan[0].valor === 0 && jan[0].parc === null);

console.log('\n== Aplicar ==');
await pg.evaluate(() => document.getElementById('reparar-ano-btn').click());
await pg.waitForTimeout(900);
await pg.click('#confirm-ok'); await pg.waitForTimeout(3000);

jan = await desp('2027', 'Janeiro');
const fin = jan.find(e => e.nome === 'Financiamento carro');
checa('Janeiro vira a parcela 4/23', fin && fin.parc === '4/23', fin && fin.parc);
checa('com o valor da série', fin && Math.abs(fin.valor - 618.27) < 0.01, fin && String(fin.valor));
// a data já estava certa na criação do ano: o conserto não encosta nela
checa('o vencimento é preservado', fin && fin.venc === '2027-01-21', fin && fin.venc);
const das = jan.find(e => e.nome === 'Simples Nacional');
checa('a recorrente recebe o valor do cadastro', das && Math.abs(das.valor - 480.49) < 0.01, das && String(das.valor));
checa('vencendo dia 20', das && das.venc === '2027-01-20', das && das.venc);

const dez = await desp('2027', 'Dezembro');
const finD = dez.find(e => e.nome === 'Financiamento carro');
checa('Dezembro/2027 vira a 15/23', finD && finD.parc === '15/23', finD && finD.parc);

console.log('\n== Série encerrada some; o Aluguel continua zerado ==');
checa('a Geladeira (12 parcelas, acabou em fev/2027) sai de dezembro',
    !dez.some(e => e.nome === 'Geladeira'), dez.map(e => e.nome).join(', '));
checa('mas continua em Janeiro, na 11/12',
    (jan.find(e => e.nome === 'Geladeira') || {}).parc === '11/12',
    (jan.find(e => e.nome === 'Geladeira') || {}).parc);
checa('despesa comum segue zerada', (jan.find(e => e.nome === 'Aluguel') || {}).valor === 0);

console.log('\n== O que você já tinha mexido fica intacto ==');
const fev = await desp('2027', 'Fevereiro');
const finF = fev.find(e => e.nome === 'Financiamento carro');
checa('valor digitado à mão é preservado', finF && finF.valor === 700, finF && String(finF.valor));
checa('e não ganha contagem de parcela', finF && finF.parc === null, finF && finF.parc);
const mar = await desp('2027', 'Março');
const dasM = mar.find(e => e.nome === 'Simples Nacional');
checa('zerada mas marcada como paga não é tocada', dasM && dasM.valor === 0 && dasM.pago, `${dasM && dasM.valor} pago=${dasM && dasM.pago}`);

console.log('\n== Rodar de novo é inofensivo ==');
await pg.evaluate(() => document.getElementById('reparar-ano-btn').click());
await pg.waitForTimeout(900);
/* Sem nada a fazer o sistema usa o modal de aviso, não o de confirmação —
   por isso a checagem olha qual dos dois abriu, e não o texto do antigo. */
const abertos = await pg.$$eval('.modal-backdrop:not(.hidden)', els => els.map(e => e.id));
const aviso = await pg.$eval('#alert-message', el => el.textContent);
checa('a segunda passada não propõe mudança',
    abertos.includes('alert-modal') && !abertos.includes('confirm-modal'), abertos.join(', '));
checa('e explica que não há o que reaplicar', /Nada a reaplicar em 2027/.test(aviso), aviso.slice(0, 90));
await pg.evaluate(() => document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden')));

console.log('\n== 2026 não foi tocado ==');
const dez26 = await desp('2026', 'Dezembro');
checa('a série de origem continua na 3/23',
    (dez26.find(e => e.nome === 'Financiamento carro') || {}).parc === '3/23',
    (dez26.find(e => e.nome === 'Financiamento carro') || {}).parc);

console.log('\n== E a tela mostra o resultado ==');
await pg.selectOption('#month-selector-main', 'Janeiro'); await pg.waitForTimeout(1200);
await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="details"]').click());
await pg.waitForTimeout(1600);
const naTela = await pg.$$eval('#expense-tables tbody tr', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
checa('a linha do financiamento mostra (4/23)', naTela.some(l => /Financiamento carro.*\(4\/23\)/.test(l)),
    naTela.find(l => /Financiamento/.test(l)) || '');
await pg.locator('#expense-tables').screenshot({ path: `${SHOTS}/reparo-ano.png` });

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

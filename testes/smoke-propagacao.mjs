/* RN-PROP-01 a RN-PROP-03 e RN-REC-07: o que acontece com parcelas e recorrentes
   quando nasce um mês ou um ano novo, e o que acontece com o valor que você
   ajustou à mão num mês específico. */
import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';

const base = () => {
    const db = JSON.parse(readFileSync(DADOS, 'utf8'));
    const cat = db['2026'].expenseCategories[0].id;
    // financiamento 3/23: a série atravessa o ano
    db['2026'].monthlyDetails['Dezembro'] = db['2026'].monthlyDetails['Dezembro'] || { expenses: [] };
    db['2026'].monthlyDetails['Dezembro'].expenses.push({
        id: 'fin', categoryId: cat, name: 'Financiamento carro', value: 618.27, paid: false,
        isInstallment: true, currentInstallment: 3, totalInstallments: 23,
        dueDate: '2027-01-21', due: 21
    });
    // parcela que termina em dezembro: não pode aparecer no ano novo
    db['2026'].monthlyDetails['Dezembro'].expenses.push({
        id: 'ult', categoryId: cat, name: 'Geladeira', value: 300, paid: false,
        isInstallment: true, currentInstallment: 10, totalInstallments: 10,
        dueDate: '2026-12-15', due: 15
    });
    // recorrente com valor
    db['2026'].recurringExpenses = [{ id: 'rec_imp', name: 'Simples Nacional', categoryId: cat,
        value: 480.49, due: 20, startMonth: 'Janeiro', dueMonthOffset: 0 }];
    db['2026'].monthlyDetails['Dezembro'].expenses.push({
        id: 'imp', categoryId: cat, name: 'Simples Nacional', value: 480.49, paid: false,
        recurringId: 'rec_imp', dueDate: '2026-12-20', due: 20
    });
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

const carregar = async (db, mes = 'Dezembro') => {
    await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(db));
    await pg.reload(); await pg.waitForTimeout(2400);
    await pg.selectOption('#month-selector-main', mes); await pg.waitForTimeout(1300);
};
const aba = async (t, ms = 1500) => { await pg.evaluate(n => document.querySelector(`.nav-tab[data-tab="${n}"]`).click(), t); await pg.waitForTimeout(ms); };
const despesasDe = (ano, mes) => pg.evaluate(([a, m]) => {
    const d = JSON.parse(localStorage.getItem('finance-demo-data'));
    return ((((d[a] || {}).monthlyDetails || {})[m] || {}).expenses || [])
        .map(e => ({ nome: e.nome || e.name, valor: e.value, parc: e.isInstallment ? `${e.currentInstallment}/${e.totalInstallments}` : null, venc: e.dueDate }));
}, [ano, mes]);
const criarAno = async (ano) => {
    await pg.evaluate(() => document.getElementById('add-year-btn').click());
    await pg.waitForTimeout(800);
    await pg.fill('#prompt-input', String(ano));
    await pg.click('#prompt-ok'); await pg.waitForTimeout(3000);
};

await pg.goto(APP_URL); await pg.waitForTimeout(700);

console.log('\n== Ano novo: a parcela continua a série ==');
await carregar(base());
await criarAno(2027);
let jan = await despesasDe('2027', 'Janeiro');
const fin = jan.find(e => e.nome === 'Financiamento carro');
checa('o financiamento aparece em Janeiro/2027', !!fin, jan.map(e => e.nome).join(', '));
checa('com o valor preservado', fin && Math.abs(fin.valor - 618.27) < 0.01, fin && String(fin.valor));
checa('e na parcela 4 de 23', fin && fin.parc === '4/23', fin && fin.parc);
checa('vencendo em fevereiro', fin && fin.venc === '2027-02-21', fin && fin.venc);
const dez27 = (await despesasDe('2027', 'Dezembro')).find(e => e.nome === 'Financiamento carro');
checa('em Dezembro/2027 está na 15/23', dez27 && dez27.parc === '15/23', dez27 && dez27.parc);

console.log('\n== Parcela que acabou não é copiada ==');
checa('a Geladeira (10/10) não entra em 2027', !jan.some(e => e.nome === 'Geladeira'),
    jan.map(e => e.nome).join(', '));

console.log('\n== Recorrente chega com o valor do cadastro ==');
const imp = jan.find(e => e.nome === 'Simples Nacional');
checa('o imposto aparece em Janeiro/2027', !!imp);
checa('com o valor do cadastro', imp && Math.abs(imp.valor - 480.49) < 0.01, imp && String(imp.valor));
checa('vencendo no dia 20 do próprio mês', imp && imp.venc === '2027-01-20', imp && imp.venc);

console.log('\n== Despesa comum continua nascendo zerada ==');
/* Faturas de cartão ficam de fora: elas são preenchidas pela soma das parcelas
   conhecidas (fatura prevista), e não pelo molde do mês. */
const comuns = jan.filter(e => !['Financiamento carro', 'Simples Nacional'].includes(e.nome) && !/fatura/i.test(e.nome));
checa('as demais vêm com valor zero', comuns.length > 0 && comuns.every(e => !e.valor),
    comuns.slice(0, 3).map(e => `${e.nome}=${e.valor}`).join(', '));

console.log('\n== Mês novo, dentro do mesmo ano ==');
const semDez = base();
delete semDez['2026'].monthlyDetails['Dezembro'];
semDez['2026'].summary = semDez['2026'].summary.filter(s => s.month !== 'Dezembro');
semDez['2026'].monthlyDetails['Novembro'] = { expenses: [
    { id: 'f2', categoryId: semDez['2026'].expenseCategories[0].id, name: 'Financiamento carro',
      value: 618.27, paid: false, isInstallment: true, currentInstallment: 2, totalInstallments: 23,
      dueDate: '2026-12-21', due: 21 },
    { id: 'i2', categoryId: semDez['2026'].expenseCategories[0].id, name: 'Simples Nacional',
      value: 480.49, paid: false, recurringId: 'rec_imp', dueDate: '2026-11-20', due: 20 }
] };
await carregar(semDez, 'Novembro');
await pg.evaluate(() => document.getElementById('add-month-btn').click());
await pg.waitForTimeout(800);
await pg.fill('#prompt-input', 'Dezembro');
await pg.click('#prompt-ok'); await pg.waitForTimeout(3000);
const dez = await despesasDe('2026', 'Dezembro');
const finD = dez.find(e => e.nome === 'Financiamento carro');
checa('mês novo avança a parcela', finD && finD.parc === '3/23', finD && finD.parc);
checa('e mantém o valor', finD && Math.abs(finD.valor - 618.27) < 0.01, finD && String(finD.valor));
const impD = dez.find(e => e.nome === 'Simples Nacional');
checa('recorrente no mês novo traz o valor', impD && Math.abs(impD.valor - 480.49) < 0.01, impD && String(impD.valor));

console.log('\n== RN-REC-07: ajuste de um mês sobrevive à edição da recorrente ==');
await carregar(base());
await pg.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('finance-demo-data'));
    d['2026'].summary = ['Novembro', 'Dezembro'].map(m => ({ month: m, income: 0, expenses: 0 }));
    d['2026'].monthlyDetails['Novembro'] = { expenses: [{ id: 'impN', categoryId: d['2026'].expenseCategories[0].id,
        name: 'Simples Nacional', value: 999.99, paid: false, recurringId: 'rec_imp', dueDate: '2026-11-20', due: 20 }] };
    d['2026'].recurringExpenses[0].startMonth = 'Novembro';
    localStorage.setItem('finance-demo-data', JSON.stringify(d));
});
await pg.reload(); await pg.waitForTimeout(2400);
await pg.selectOption('#month-selector-main', 'Novembro'); await pg.waitForTimeout(1300);
await aba('settings');
const editar = async () => {
    await pg.$$eval('.edit-recurring-expense-btn', els => {
        const a = els.find(e => e.closest('tr').textContent.includes('Simples Nacional'));
        if (a) a.click();
    });
    await pg.waitForTimeout(800);
};
await editar();
await pg.fill('#recurring-expense-name', 'Simples Nacional (DAS)');
await pg.click('#recurring-expense-form button[type="submit"]'); await pg.waitForTimeout(2800);
let nov = await despesasDe('2026', 'Novembro');
checa('mudar só o nome não mexe no valor ajustado',
    nov[0] && Math.abs(nov[0].valor - 999.99) < 0.01, nov[0] && String(nov[0].valor));
checa('mas o nome novo chegou', nov[0] && nov[0].nome === 'Simples Nacional (DAS)', nov[0] && nov[0].nome);

console.log('\n== Mudar o valor na recorrente reescreve os meses ==');
await aba('settings');
await editar();
await pg.fill('#recurring-expense-value', '520');
await pg.click('#recurring-expense-form button[type="submit"]'); await pg.waitForTimeout(2800);
nov = await despesasDe('2026', 'Novembro');
checa('o valor novo chega a Novembro', nov[0] && Math.abs(nov[0].valor - 520) < 0.01, nov[0] && String(nov[0].valor));
const dezR = await despesasDe('2026', 'Dezembro');
const impDez = dezR.find(e => /Simples/.test(e.nome));
checa('e a Dezembro também', impDez && Math.abs(impDez.valor - 520) < 0.01, impDez && String(impDez.valor));

console.log('\n== RN-PLAN-05: busca em qualquer campo ==');
const comPlanos = JSON.parse(readFileSync(DADOS, 'utf8'));
comPlanos.appSettings.people = [{ id: 'p_ray', name: 'Rayanne', phone: '', color: '#60A5FA', createdAt: '2026-08-01' }];
comPlanos.appSettings.installmentPlans.push(
    { id: 'pz', cardId: 'card_nubank', description: 'Financiamento carro', installmentValue: 618.27,
      totalInstallments: 23, firstMonth: 'Outubro', firstYear: '2026', personId: null, recebimentos: {} },
    { id: 'pw', cardId: 'card_amazon', description: 'Mesa dobrável', installmentValue: 200,
      totalInstallments: 3, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ray', recebimentos: {} });
await carregar(comPlanos, 'Outubro');
await aba('cards', 1800);
const buscar = async (t) => {
    await pg.fill('#plan-search', t); await pg.waitForTimeout(900);
    // só as linhas de compra: a tabela usa um <tr> para o aviso de "nada encontrado"
    return pg.$$eval('#plans-table tr:not(.plan-group)', els => els
        .map(e => e.textContent.replace(/\s+/g, ' ').trim())
        .filter(t => /R\$/.test(t)));
};
let r = await buscar('618,27');
checa('acha pelo valor com vírgula', r.length === 1 && /Financiamento/.test(r[0]), `${r.length} linha(s)`);
r = await buscar('618.27');
checa('acha pelo valor com ponto', r.length === 1 && /Financiamento/.test(r[0]), `${r.length} linha(s)`);
r = await buscar('618');
checa('acha por parte do valor', r.some(l => /Financiamento/.test(l)), `${r.length} linha(s)`);
r = await buscar('rayanne');
checa('acha pelo nome da pessoa', r.length === 1 && /Mesa/.test(r[0]), `${r.length} linha(s)`);
r = await buscar('amazon');
checa('acha pelo nome do cartão', r.some(l => /Mesa/.test(l)), `${r.length} linha(s)`);
r = await buscar('23');
checa('acha pelo total de parcelas', r.some(l => /Financiamento/.test(l)), `${r.length} linha(s)`);
r = await buscar('mesa rayanne');
checa('dois termos funcionam como "e"', r.length === 1 && /Mesa/.test(r[0]), `${r.length} linha(s)`);
r = await buscar('mesa financiamento');
checa('dois termos que não coexistem não acham nada', r.length === 0, `${r.length} linha(s)`);
r = await buscar('');
checa('limpar a busca devolve tudo', r.length >= 2, `${r.length} linha(s)`);
await pg.locator('#plans-table').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/busca-parcelamentos.png` });

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

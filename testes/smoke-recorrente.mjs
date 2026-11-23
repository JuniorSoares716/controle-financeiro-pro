/* RN-REC-05 e RN-REC-06: o mês do vencimento da recorrente e a preservação
   das correções feitas à mão em um mês específico. */
import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';

const db = JSON.parse(readFileSync(DADOS, 'utf8'));

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

await pg.goto(APP_URL); await pg.waitForTimeout(700);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(db));
await pg.reload(); await pg.waitForTimeout(2400);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1200);

const vencimentos = (nome) => pg.evaluate((n) => {
    const base = JSON.parse(localStorage.getItem('finance-demo-data'))['2026'].monthlyDetails;
    const saida = {};
    for (const mes of Object.keys(base))
        (base[mes].expenses || []).filter(e => e.name === n).forEach(e => { saida[mes] = e.dueDate || null; });
    return saida;
}, nome);

const cadastra = async ({ nome, dia, offset, valor = '100', mes = 'Outubro' }) => {
    await pg.evaluate(() => document.getElementById('add-recurring-expense-btn').click());
    await pg.waitForTimeout(700);
    await pg.fill('#recurring-expense-name', nome);
    await pg.selectOption('#recurring-expense-category', { index: 1 });
    await pg.fill('#recurring-expense-value', valor);
    await pg.fill('#recurring-expense-due', String(dia));
    await pg.selectOption('#recurring-expense-due-offset', String(offset));
    await pg.selectOption('#recurring-expense-start', mes);
    await pg.click('#recurring-expense-form button[type="submit"]');
    await pg.waitForTimeout(2800);
};
const abreEdicao = async (nome) => {
    await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="settings"]').click());
    await pg.waitForTimeout(1400);
    await pg.$$eval('.edit-recurring-expense-btn', (els, n) => {
        const alvo = els.find(e => e.closest('tr').textContent.includes(n));
        if (alvo) alvo.click();
    }, nome);
    await pg.waitForTimeout(800);
};

console.log('\n== Padrão: vence no mesmo mês (comportamento antigo preservado) ==');
await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="settings"]').click()); await pg.waitForTimeout(1500);
await pg.evaluate(() => document.getElementById('add-recurring-expense-btn').click()); await pg.waitForTimeout(700);
checa('formulário novo abre em "No mesmo mês"',
    (await pg.$eval('#recurring-expense-due-offset', el => el.value)) === '0');
await pg.click('#recurring-expense-modal .cancel-btn'); await pg.waitForTimeout(500);
await cadastra({ nome: 'ALUGUEL', dia: 10, offset: 0 });
let v = await vencimentos('ALUGUEL');
checa('Outubro vence em outubro', v.Outubro === '2026-10-10', v.Outubro);
checa('Novembro vence em novembro', v.Novembro === '2026-11-10', v.Novembro);
checa('Dezembro vence em dezembro', v.Dezembro === '2026-12-10', v.Dezembro);

console.log('\n== "No mês seguinte" ==');
await cadastra({ nome: 'ASSINATURA', dia: 10, offset: 1 });
v = await vencimentos('ASSINATURA');
checa('competência Outubro vence 10/11', v.Outubro === '2026-11-10', v.Outubro);
checa('competência Novembro vence 10/12', v.Novembro === '2026-12-10', v.Novembro);
checa('competência Dezembro vira o ano: 10/01/2027', v.Dezembro === '2027-01-10', v.Dezembro);
checa('nenhum par de meses repete vencimento',
    new Set(Object.values(v)).size === Object.values(v).length, JSON.stringify(v));

console.log('\n== Fim de mês não estoura ==');
await cadastra({ nome: 'DIA31', dia: 31, offset: 1 });
v = await vencimentos('DIA31');
checa('31 de competência Outubro cai em 30/11 (novembro não tem 31)', v.Outubro === '2026-11-30', v.Outubro);

console.log('\n== A tabela avisa qual é qual ==');
await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="settings"]').click()); await pg.waitForTimeout(1500);
const linhas = await pg.$$eval('#recurring-expenses-table tr', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
checa('a recorrente do mês seguinte é marcada', linhas.some(l => l.includes('ASSINATURA') && l.includes('mês seguinte')),
    linhas.find(l => l.includes('ASSINATURA')));
checa('a do mesmo mês não ganha marca', linhas.some(l => l.includes('ALUGUEL') && !l.includes('mês seguinte')),
    linhas.find(l => l.includes('ALUGUEL')));

console.log('\n== Editar guarda o mês escolhido ==');
await abreEdicao('ASSINATURA');
checa('abre com "No mês seguinte" marcado',
    (await pg.$eval('#recurring-expense-due-offset', el => el.value)) === '1');
await pg.click('#recurring-expense-modal .cancel-btn'); await pg.waitForTimeout(500);

console.log('\n== Correção manual sobrevive à edição de valor ==');
await pg.evaluate(() => {
    const dados = JSON.parse(localStorage.getItem('finance-demo-data'));
    const out = dados['2026'].monthlyDetails['Outubro'].expenses.find(e => e.name === 'ALUGUEL');
    out.dueDate = '2026-10-25'; out.due = 25;            // você corrigiu só este mês
    localStorage.setItem('finance-demo-data', JSON.stringify(dados));
});
await pg.reload(); await pg.waitForTimeout(2400);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1200);
await abreEdicao('ALUGUEL');
await pg.fill('#recurring-expense-value', '250');
await pg.click('#recurring-expense-form button[type="submit"]'); await pg.waitForTimeout(2800);
v = await vencimentos('ALUGUEL');
checa('a correção de Outubro continua lá', v.Outubro === '2026-10-25', v.Outubro);
checa('os outros meses seguem intactos', v.Novembro === '2026-11-10', v.Novembro);
const valor = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data'))['2026']
    .monthlyDetails['Novembro'].expenses.find(e => e.name === 'ALUGUEL').value);
checa('mas o valor novo chegou', valor === 250, `${valor}`);

console.log('\n== Mudar o dia reescreve mesmo ==');
await abreEdicao('ALUGUEL');
await pg.fill('#recurring-expense-due', '5');
await pg.click('#recurring-expense-form button[type="submit"]'); await pg.waitForTimeout(2800);
v = await vencimentos('ALUGUEL');
checa('Outubro foi para o dia 5', v.Outubro === '2026-10-05', v.Outubro);
checa('Novembro também', v.Novembro === '2026-11-05', v.Novembro);

console.log('\n== Mudar só o mês do vencimento também reescreve ==');
await abreEdicao('ALUGUEL');
await pg.selectOption('#recurring-expense-due-offset', '1');
await pg.click('#recurring-expense-form button[type="submit"]'); await pg.waitForTimeout(2800);
v = await vencimentos('ALUGUEL');
checa('Outubro passou a vencer 05/11', v.Outubro === '2026-11-05', v.Outubro);
checa('Dezembro virou o ano', v.Dezembro === '2027-01-05', v.Dezembro);

console.log('\n== Cadastro antigo, sem o campo, continua no mesmo mês ==');
await pg.evaluate(() => {
    const dados = JSON.parse(localStorage.getItem('finance-demo-data'));
    dados['2026'].recurringExpenses.push({ id: 'rec_legado', name: 'LEGADO',
        categoryId: dados['2026'].expenseCategories[0].id, value: 70, due: 15, startMonth: 'Outubro' });
    localStorage.setItem('finance-demo-data', JSON.stringify(dados));
});
await pg.reload(); await pg.waitForTimeout(2400);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1200);
await abreEdicao('LEGADO');
checa('registro sem o campo abre como "No mesmo mês"',
    (await pg.$eval('#recurring-expense-due-offset', el => el.value)) === '0');
await pg.fill('#recurring-expense-value', '80');
await pg.click('#recurring-expense-form button[type="submit"]'); await pg.waitForTimeout(2800);
v = await vencimentos('LEGADO');
checa('e segue vencendo no próprio mês', v.Novembro === '2026-11-15' || v.Novembro === null, v.Novembro);

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';

const base = JSON.parse(readFileSync(DADOS, 'utf8'));
const brl = (t) => parseFloat(String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};
const legendas = () => pg.evaluate(() => {
    const cv = document.getElementById('cashFlowChart');
    const ch = (window.Chart && window.Chart.getChart) ? window.Chart.getChart(cv) : null;
    return ch ? ch.data.datasets.map(d => d.label) : [];
});
const serieProj = () => pg.evaluate(() => {
    const cv = document.getElementById('cashFlowChart');
    const ch = (window.Chart && window.Chart.getChart) ? window.Chart.getChart(cv) : null;
    const d = ch && ch.data.datasets.find(x => /Projeção/.test(x.label));
    return d ? d.data : null;
});
const carregar = async (db) => {
    await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(db));
    await pg.reload(); await pg.waitForTimeout(2500);
    await pg.click('.nav-tab[data-tab="reports"]'); await pg.waitForTimeout(2000);
};

await pg.goto(APP_URL); await pg.waitForTimeout(800);

console.log('\n== A: ano todo preenchido (o caso que você viu) ==');
await carregar(base);
let legs = await legendas();
checa('legenda NÃO traz "Projeção de despesas"', !legs.some(l => /Projeção/.test(l)), legs.join(' | '));
let nota = await pg.textContent('#cashflow-note');
checa('nota explica por que não há projeção', /não há mês a projetar/.test(nota), nota.trim());
let kpiSub = await pg.textContent('#report-projection-sub');
checa('KPI diz ano completo', /sem meses a projetar/.test(kpiSub), kpiSub.trim());
await pg.locator('#cashFlowChart').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/fluxo-ano-cheio.png` });

console.log('\n== B: últimos meses vazios (projeção deve aparecer) ==');
const parcial = JSON.parse(JSON.stringify(base));
['Setembro', 'Outubro', 'Novembro', 'Dezembro'].forEach(m => {
    parcial['2026'].monthlyDetails[m] = { expenses: [] };
    parcial['2026'].monthlyIncomes[m] = [];
    const s = parcial['2026'].summary.find(x => x.month === m);
    if (s) { s.expenses = 0; s.income = 0; }
});
// sem parcelamentos, para o gráfico não receber faturas previstas nos meses limpos
parcial.appSettings.installmentPlans = [];
await carregar(parcial);
legs = await legendas();
checa('legenda traz "Projeção de despesas"', legs.some(l => /Projeção/.test(l)), legs.join(' | '));
const serie = await serieProj();
checa('série tem 12 posições', serie && serie.length === 12, `${serie && serie.length}`);
const nulos = serie.slice(0, 7).every(v => v === null);
checa('meses antes do último real ficam nulos', nulos);
checa('ancora no último mês real (Agosto)', serie[7] !== null && serie[7] > 0, `Ago = ${serie[7]}`);
checa('projeta Set a Dez', serie.slice(8).every(v => typeof v === 'number' && v > 0), serie.slice(8).join(', '));
nota = await pg.textContent('#cashflow-note');
checa('nota informa o início e o método', /Projeção de Setembro em diante/.test(nota), nota.trim());
await pg.locator('#cashFlowChart').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/fluxo-com-projecao.png` });

console.log('\n== C: o gráfico bate com a aba Projeção (RN-PROJ-09) ==');
const kpiProj = brl(await pg.textContent('#report-projection'));
const somaSerie = serie.slice(8).reduce((s, v) => s + v, 0);
checa('KPI = soma dos meses projetados no gráfico', Math.abs(kpiProj - somaSerie) < 4,
    `KPI ${kpiProj} vs série ${somaSerie}`);
// compara maçã com maçã: a aba parte do mesmo mês-base do gráfico (Agosto, último real)
await pg.selectOption('#month-selector-main', 'Agosto'); await pg.waitForTimeout(1200);
await pg.click('.nav-tab[data-tab="projection"]'); await pg.waitForTimeout(2000);
await pg.selectOption('#projection-horizon', '3').catch(() => {});
await pg.waitForTimeout(1500);
const linhasProj = await pg.$$eval('#projection-table tr', trs => trs.map(tr =>
    [...tr.querySelectorAll('td')].map(td => td.textContent.trim())));
// a aba Projeção parte do mês de competência (Agosto) -> Set, Out, Nov
const despAba = linhasProj.map(l => brl(l[4]));
const mesesAba = linhasProj.map(l => l[0].split('/')[0]);
checa('aba Projeção tem 3 meses', despAba.length === 3, mesesAba.join(', '));
const serieOutDez = serie.slice(8, 8 + despAba.length);
checa('mesmos valores nos meses coincidentes',
    despAba.every((v, i) => Math.abs(v - serieOutDez[i]) < 2),
    `aba ${despAba.map(v => v.toFixed(2)).join(', ')} vs gráfico ${serieOutDez.join(', ')}`);

console.log('\n== D: ano sem nenhuma despesa ==');
const vazio = JSON.parse(JSON.stringify(base));
Object.keys(vazio['2026'].monthlyDetails).forEach(m => { vazio['2026'].monthlyDetails[m] = { expenses: [] }; });
vazio['2026'].summary.forEach(s => { s.expenses = 0; });
vazio.appSettings.installmentPlans = [];
await carregar(vazio);
legs = await legendas();
checa('sem série de projeção', !legs.some(l => /Projeção/.test(l)), legs.join(' | '));
nota = await pg.textContent('#cashflow-note');
checa('nota avisa que não há despesa lançada', /Nenhum mês do período tem despesa/.test(nota), nota.trim());

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 3).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

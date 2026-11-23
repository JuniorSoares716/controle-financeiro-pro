import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';


const db = JSON.parse(readFileSync(DADOS, 'utf8'));
db.appSettings.people = [
    { id: 'p_ray', name: 'Rayanne', phone: '', color: '#60A5FA', createdAt: '2026-08-01' },
    { id: 'p_ellem', name: 'Ellem', phone: '', color: '#F472B6', createdAt: '2026-08-01' },
    { id: 'p_kaio', name: 'Kaio', phone: '', color: '#FBBF24', createdAt: '2026-09-01' },
    { id: 'p_victor', name: 'Victor', phone: '', color: '#A78BFA', createdAt: '2026-09-01' }
];
db.appSettings.installmentPlans.push(
    { id: 'pl_ray', cardId: 'card_nubank', description: 'WellHub', installmentValue: 50,
      totalInstallments: 6, firstMonth: 'Agosto', firstYear: '2026', personId: 'p_ray', recebimentos: {} },
    { id: 'pl_ray2', cardId: 'card_amazon', description: 'Cadeira', installmentValue: 200,
      totalInstallments: 3, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ray', recebimentos: {} },
    { id: 'pl_ellem', cardId: 'card_nubank', description: 'Celular', installmentValue: 500,
      totalInstallments: 4, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ellem', recebimentos: {} },
    // Kaio: compra inteiramente quitada
    { id: 'pl_kaio', cardId: 'card_nubank', description: 'Fone', installmentValue: 90, totalInstallments: 2,
      firstMonth: 'Agosto', firstYear: '2026', personId: 'p_kaio',
      recebimentos: { '2026-08': { recebido: true, data: '2026-08-20' }, '2026-09': { recebido: true, data: '2026-09-20' } } }
    // Victor fica sem compras
);
const dados = JSON.stringify(db);
const brl = (t) => parseFloat(String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

await pg.goto(APP_URL); await pg.waitForTimeout(700);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, dados);
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1300);

const nomesVisiveis = () => pg.$$eval('#people-cards .card p.font-semibold', els => els.map(e => e.textContent.trim()));
const contador = () => pg.textContent('#people-count');
const kpiFalta = async () => brl((await pg.textContent('#people-kpis')).match(/Total em aberto\s*(R\$[\s ]*[\d.,]+)/)[1]);

console.log('\n== ITEM 1: duplicar pede confirmação ==');
await pg.click('.nav-tab[data-tab="details"]'); await pg.waitForTimeout(1600);
const antesDup = await pg.$$eval('#expense-tables tbody tr', els => els.length);
await pg.click('#expense-tables .duplicate-expense-btn'); await pg.waitForTimeout(800);
const msgConf = await pg.textContent('#confirm-message').catch(() => '');
checa('abre o modal de confirmação', /Duplicar/.test(msgConf), msgConf.slice(0, 90));
checa('informa o valor e o destino', /R\$/.test(msgConf) && /não paga/.test(msgConf));
await pg.click('#confirm-cancel'); await pg.waitForTimeout(1200);
const depoisCancel = await pg.$$eval('#expense-tables tbody tr', els => els.length);
checa('cancelar não duplica nada', depoisCancel === antesDup, `${antesDup} -> ${depoisCancel}`);
await pg.click('#expense-tables .duplicate-expense-btn'); await pg.waitForTimeout(800);
await pg.click('#confirm-ok'); await pg.waitForTimeout(2800);
const depoisOk = await pg.$$eval('#expense-tables tbody tr', els => els.length);
checa('confirmar duplica', depoisOk > depoisCancel, `${depoisCancel} -> ${depoisOk}`);
checa('a cópia é marcada como cópia', (await pg.textContent('#expense-tables')).includes('(cópia)'));

console.log('\n== ITEM 2: filtros da aba Pessoas reagem na hora ==');
await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1600);
const todosNomes = await nomesVisiveis();
checa('lista as quatro pessoas', todosNomes.length === 4, todosNomes.join(', '));
const faltaTotal = await kpiFalta();
checa('contador mostra o total', /4 de 4 pessoa/.test(await contador()), (await contador()).trim());

await pg.fill('#person-search', 'ray'); await pg.waitForTimeout(900);
let nomes = await nomesVisiveis();
checa('busca filtra na hora', nomes.length === 1 && nomes[0].includes('Rayanne'), nomes.join(', '));
const faltaRay = await kpiFalta();
checa('indicador segue o filtro', faltaRay < faltaTotal && faltaRay > 0, `${faltaRay} de ${faltaTotal}`);
checa('contador avisa que os indicadores seguem o filtro', /seguem o filtro/.test(await contador()));
checa('contador mostra 1 de 4', /1 de 4 pessoa/.test(await contador()), (await contador()).trim());
await pg.screenshot({ path: `${SHOTS}/pessoas-filtro.png`, clip: { x: 0, y: 100, width: 1400, height: 560 } });

await pg.fill('#person-search', ''); await pg.waitForTimeout(900);
checa('limpar a busca restaura', (await nomesVisiveis()).length === 4);
checa('e o indicador volta ao total', Math.abs(await kpiFalta() - faltaTotal) < 0.01);

console.log('\n== Filtro por situação ==');
await pg.selectOption('#person-status-filter', 'settled'); await pg.waitForTimeout(900);
nomes = await nomesVisiveis();
checa('"quitadas" traz só quem não deve nada', nomes.length === 1 && nomes[0].includes('Kaio'), nomes.join(', '));
await pg.selectOption('#person-status-filter', 'none'); await pg.waitForTimeout(900);
nomes = await nomesVisiveis();
checa('"sem compras" traz o Victor', nomes.length === 1 && nomes[0].includes('Victor'), nomes.join(', '));
await pg.selectOption('#person-status-filter', 'open'); await pg.waitForTimeout(900);
nomes = await nomesVisiveis();
checa('"com saldo" exclui quitadas e sem compras',
    nomes.length === 2 && !nomes.join().includes('Kaio') && !nomes.join().includes('Victor'), nomes.join(', '));
await pg.selectOption('#person-status-filter', 'all'); await pg.waitForTimeout(900);

console.log('\n== Filtro por cartão ==');
await pg.selectOption('#person-card-filter', { label: 'Amazon' }); await pg.waitForTimeout(900);
nomes = await nomesVisiveis();
checa('só quem deve na Amazon', nomes.length === 1 && nomes[0].includes('Rayanne'), nomes.join(', '));
const faltaAmz = await kpiFalta();
checa('indicador soma só a Amazon (3x200)', Math.abs(faltaAmz - 600) < 0.01, `${faltaAmz}`);
await pg.selectOption('#person-card-filter', 'all'); await pg.waitForTimeout(900);

console.log('\n== Ordenação ==');
await pg.selectOption('#person-sort', 'nome'); await pg.waitForTimeout(900);
nomes = await nomesVisiveis();
const sohNomes = nomes.map(n => n.replace(/\s+/g, ' ').trim().split(' ')[0]);
checa('ordena por nome', JSON.stringify(sohNomes) === JSON.stringify([...sohNomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))), sohNomes.join(', '));
await pg.selectOption('#person-sort', 'falta'); await pg.waitForTimeout(900);
const valores = await pg.$$eval('#people-cards .card', els => els.map(e => {
    const m = e.textContent.replace(/\s+/g, ' ').match(/a receber\s*(R\$[\s ]*[\d.,]+)/); return m ? m[1] : null; }));
const nums = valores.filter(Boolean).map(v => parseFloat(v.replace(/[^\d,]/g, '').replace(',', '.')));
checa('ordena por maior saldo', nums.every((v, i) => i === 0 || nums[i - 1] >= v), nums.join(' ≥ '));

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

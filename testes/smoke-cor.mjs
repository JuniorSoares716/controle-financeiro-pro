import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';


const db = JSON.parse(readFileSync(DADOS, 'utf8'));
// duas com cor gravada, uma SEM cor (cadastrada antes desta versão)
db.appSettings.people = [
    { id: 'p_ray', name: 'Rayanne', phone: '', color: '#60A5FA', createdAt: '2026-08-01' },
    { id: 'p_ellem', name: 'Ellem', phone: '', color: '#F472B6', createdAt: '2026-09-01' },
    { id: 'p_dan', name: 'Daniel', phone: '', createdAt: '2026-10-01' }
];
db.appSettings.installmentPlans.push(
    { id: 'pl_ray', cardId: 'card_nubank', description: 'WellHub', installmentValue: 50,
      totalInstallments: 3, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ray', recebimentos: {} },
    { id: 'pl_ellem', cardId: 'card_nubank', description: 'teste', installmentValue: 500,
      totalInstallments: 1, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ellem', recebimentos: {} },
    { id: 'pl_dan', cardId: 'card_amazon', description: 'Teste em cartão', installmentValue: 100,
      totalInstallments: 3, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_dan', recebimentos: {} }
);
const dados = JSON.stringify(db);

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n>>16)&255}, ${(n>>8)&255}, ${n&255})`; };

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 2 });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

await pg.goto(APP_URL); await pg.waitForTimeout(700);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, dados);
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1300);

console.log('\n== Aba Pessoas: ponto colorido na frente do nome ==');
await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1500);
// a lista ordena por maior saldo, então busca pelo nome em vez da posição
const corDe = (nome) => pg.$$eval('#people-cards .card', (els, n) => {
    const card = els.find(e => e.textContent.includes(n));
    const d = card && card.querySelector('.person-dot');
    return d ? getComputedStyle(d).backgroundColor : null;
}, nome);
const pontos = await pg.$$eval('#people-cards .person-dot', els => els.map(e => getComputedStyle(e).backgroundColor));
checa('um ponto por pessoa', pontos.length === 3, pontos.join(' | '));
checa('Rayanne com a cor gravada', (await corDe('Rayanne')) === rgb('#60A5FA'), await corDe('Rayanne'));
checa('Ellem com a cor gravada', (await corDe('Ellem')) === rgb('#F472B6'), await corDe('Ellem'));
const corDaniel = await corDe('Daniel');
checa('Daniel (sem cor) recebe uma cor estável',
    /^rgb\(/.test(corDaniel) && corDaniel !== rgb('#60A5FA') && corDaniel !== rgb('#F472B6'), corDaniel);
await pg.locator('#people-cards').screenshot({ path: `${SHOTS}/cor-pessoas.png` });

console.log('\n== Lista de parcelamentos: faixa de cada pessoa na cor dela ==');
await pg.click('.nav-tab[data-tab="cards"]'); await pg.waitForTimeout(1600);
// as compras saem agrupadas por pessoa: a cor está no ponto da faixa do grupo
const faixas = await pg.$$eval('#plans-table tr.plan-group', els => els.map(e => {
    const d = e.querySelector('.person-dot');
    return { txt: e.textContent.replace(/\s+/g, ' ').trim(),
             cor: d ? getComputedStyle(d).backgroundColor : null };
}));
const fRay = faixas.find(t => t.txt.includes('Rayanne'));
const fEllem = faixas.find(t => t.txt.includes('Ellem'));
const fDan = faixas.find(t => t.txt.includes('Daniel'));
checa('as três pessoas têm faixa própria', !!fRay && !!fEllem && !!fDan, faixas.map(f => f.txt.split(' ')[0]).join(', '));
checa('Rayanne com a própria cor', fRay.cor === rgb('#60A5FA'), fRay.cor);
checa('Ellem com a própria cor', fEllem.cor === rgb('#F472B6'), fEllem.cor);
checa('cores diferentes entre si', new Set([fRay.cor, fEllem.cor, fDan.cor]).size === 3);
checa('suas compras também têm faixa', faixas.some(f => /Suas compras/.test(f.txt)));
await pg.locator('#plans-table').screenshot({ path: `${SHOTS}/cor-parcelamentos.png` });

console.log('\n== Mesma cor em todos os lugares ==');
const corNaFatura = await pg.evaluate(() => {
    const el = [...document.querySelectorAll('#terceiros-section .person-dot, #terceiros-section .expense-tag')];
    return el.map(e => getComputedStyle(e).color || getComputedStyle(e).backgroundColor);
});
await pg.click('.nav-tab[data-tab="dashboard"]'); await pg.waitForTimeout(1500);
const chips = await pg.$$eval('#dashboard-terceiros .expense-tag', els => els.map(e => ({ txt: e.textContent.trim(), cor: getComputedStyle(e).color })));
const chipRay = chips.find(c => c.txt.includes('Rayanne'));
checa('card do Dashboard usa a mesma cor', chipRay && chipRay.cor === rgb('#60A5FA'), chipRay && chipRay.cor);
await pg.click('.nav-tab[data-tab="details"]'); await pg.waitForTimeout(1600);
const naDespesa = await pg.$$eval('#expense-tables .expense-tag', els => els.map(e => ({ txt: e.textContent.trim(), cor: getComputedStyle(e).color })));
const dRay = naDespesa.find(c => c.txt.includes('Rayanne'));
checa('linha da fatura usa a mesma cor', dRay && dRay.cor === rgb('#60A5FA'), dRay && dRay.cor);

console.log('\n== Cadastro: seletor de cor ==');
await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1400);
await pg.click('#add-person-btn'); await pg.waitForTimeout(700);
const swatches = await pg.$$('#person-color-picker .color-swatch');
checa('paleta com 12 cores', swatches.length === 12, `${swatches.length}`);
const preSel = await pg.$eval('#person-color', el => el.value);
checa('já vem com uma cor livre marcada', /^#[0-9A-F]{6}$/i.test(preSel), preSel);
checa('a cor sugerida não está em uso', ![ '#60A5FA', '#F472B6' ].includes(preSel), preSel);
const marcados = await pg.$$eval('#person-color-picker [aria-checked="true"]', els => els.length);
checa('exatamente uma marcada', marcados === 1, `${marcados}`);
await pg.click('#person-color-picker .color-swatch[data-cor="#FBBF24"]'); await pg.waitForTimeout(300);
checa('clicar troca a seleção', (await pg.$eval('#person-color', el => el.value)) === '#FBBF24');
checa('marcação acompanha', (await pg.$$eval('#person-color-picker [aria-checked="true"]', els => els.map(e => e.dataset.cor)))[0] === '#FBBF24');
await pg.screenshot({ path: `${SHOTS}/cor-cadastro.png`, clip: { x: 420, y: 120, width: 600, height: 620 } });

console.log('\n== Salvar e ver a cor aplicada ==');
await pg.fill('#person-name', 'Victor');
await pg.click('#person-form button[type="submit"]'); await pg.waitForTimeout(2200);
const salvo = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data')).appSettings.people.find(p => p.name === 'Victor'));
checa('cor gravada no cadastro', salvo && salvo.color === '#FBBF24', salvo && salvo.color);
const pontos2 = await pg.$$eval('#people-cards .person-dot', els => els.map(e => getComputedStyle(e).backgroundColor));
checa('ponto novo com a cor escolhida', pontos2.includes(rgb('#FBBF24')), pontos2.join(' | '));

console.log('\n== Editar mantém e permite trocar ==');
// edita a Rayanne especificamente, qualquer que seja a posição dela na lista
const idxRay = await pg.$$eval('#people-cards .card', els => els.findIndex(e => e.textContent.includes('Rayanne')));
await pg.$$eval('#people-cards .edit-person-btn', (els, i) => els[i].click(), idxRay);
await pg.waitForTimeout(700);
const corAtual = await pg.$eval('#person-color', el => el.value);
checa('abre com a cor atual da pessoa', corAtual === '#60A5FA', corAtual);
await pg.click('#person-modal .cancel-btn'); await pg.waitForTimeout(400);

console.log('\n== Pessoa sem cor gravada: a derivada é estável ==');
const antes = (await pg.$$eval('#people-cards .person-dot', els => els.map(e => getComputedStyle(e).backgroundColor)));
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1200);
await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1500);
const depois = (await pg.$$eval('#people-cards .person-dot', els => els.map(e => getComputedStyle(e).backgroundColor)));
checa('mesmas cores depois de recarregar', JSON.stringify(antes) === JSON.stringify(depois), depois.join(' | '));

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

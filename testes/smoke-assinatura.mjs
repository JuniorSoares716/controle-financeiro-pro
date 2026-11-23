/* RN-ASS-01 a RN-ASS-05: assinatura de terceiro no seu cartão. */
import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';


const base = () => {
    const db = JSON.parse(readFileSync(DADOS, 'utf8'));
    db.appSettings.people = [
        { id: 'p_ray', name: 'Rayanne', phone: '', color: '#60A5FA', createdAt: '2026-08-01' }
    ];
    return db;
};
const comAssinatura = (extra = {}) => {
    const db = base();
    db.appSettings.installmentPlans.push({
        id: 'ass1', cardId: 'card_nubank', description: 'Spotify Família', installmentValue: 35,
        totalInstallments: 0, recorrente: true, firstMonth: 'Agosto', firstYear: '2026',
        personId: 'p_ray', recebimentos: {}, ...extra
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
const pg = await b.newPage({ viewport: { width: 1400, height: 1050 } });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

const carregar = async (db, mes = 'Outubro') => {
    await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(db));
    await pg.reload(); await pg.waitForTimeout(2400);
    await pg.selectOption('#month-selector-main', mes); await pg.waitForTimeout(1300);
};
const aba = async (t) => { await pg.evaluate(n => document.querySelector(`.nav-tab[data-tab="${n}"]`).click(), t); await pg.waitForTimeout(1500); };
const linhaDe = (desc) => pg.$$eval('#plans-table tr', (els, d) => {
    const tr = els.find(e => !e.classList.contains('plan-group') && e.textContent.includes(d));
    return tr ? tr.textContent.replace(/\s+/g, ' ').trim() : null;
}, desc);

await pg.goto(APP_URL); await pg.waitForTimeout(700);

console.log('\n== Cadastro: o formulário troca de cara ==');
await carregar(base());
await aba('cards');
await pg.evaluate(() => document.getElementById('add-plan-btn').click()); await pg.waitForTimeout(800);
checa('começa como parcelamento: total de parcelas visível',
    await pg.$eval('#plan-total-wrap', el => !el.classList.contains('hidden')));
checa('campos de encerramento escondidos',
    await pg.$eval('#plan-end-wrap', el => el.classList.contains('hidden')));
await pg.check('#plan-assinatura'); await pg.waitForTimeout(400);
checa('assinatura esconde o total de parcelas',
    await pg.$eval('#plan-total-wrap', el => el.classList.contains('hidden')));
checa('assinatura esconde o "à vista"',
    await pg.$eval('#plan-avista', el => el.closest('label').classList.contains('hidden')));
checa('mostra o encerramento',
    await pg.$eval('#plan-end-wrap', el => !el.classList.contains('hidden')));
checa('rótulo do valor vira "por mês"',
    (await pg.$eval('#plan-value-label', el => el.textContent)).includes('por mês'));
await pg.fill('#plan-description', 'Netflix');
await pg.fill('#plan-value', '55');
await pg.selectOption('#plan-first-month', 'Outubro');
await pg.selectOption('#plan-person', 'p_ray');
await pg.waitForTimeout(400);
const previa = await pg.$eval('#plan-preview', el => el.textContent);
checa('prévia fala em mensalidade sem fim', /55,00 por mês/.test(previa) && /sem fim definido/.test(previa), previa.trim());
await pg.click('#plan-form button[type="submit"]'); await pg.waitForTimeout(2800);
const salvo = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data'))
    .appSettings.installmentPlans.find(p => p.description === 'Netflix'));
checa('grava recorrente, sem total e sem encerramento',
    salvo && salvo.recorrente === true && salvo.totalInstallments === 0
    && !('endMonth' in salvo) && !('endYear' in salvo), JSON.stringify(salvo && { r: salvo.recorrente, t: salvo.totalInstallments, e: salvo.endMonth }));

console.log('\n== Na lista: mensal, sem fim, e a mensalidade no rodapé ==');
await carregar(comAssinatura());
await aba('cards');
let l = await linhaDe('Spotify');
checa('a linha diz "mensal"', /mensal/.test(l), l);
checa('e "sem fim definido"', /sem fim definido/.test(l), l);
checa('traz o valor por mês', /35,00\/mês/.test(l), l);
const sub = await pg.$eval('#plans-subtitle', el => el.textContent);
checa('o subtítulo separa assinatura de parcelamento', /35,00\/mês em assinaturas/.test(sub), sub);
const faixa = await pg.$$eval('#plans-table tr.plan-group', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
checa('a faixa da pessoa mostra a mensalidade', faixa.some(f => /Rayanne/.test(f) && /35,00\/mês/.test(f)), faixa.find(f => /Rayanne/.test(f)));
await pg.locator('#plans-table').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/assinatura-lista.png` });

console.log('\n== Dívida só do que já foi cobrado ==');
// Agosto, Setembro e Outubro = 3 cobranças de 35 até o mês selecionado (Outubro)
const devido = () => pg.evaluate(() => {
    const el = document.querySelector('#people-cards .card');
    return el ? el.textContent.replace(/\s+/g, ' ') : '';
});
await aba('people'); await pg.waitForTimeout(600);
checa('a pessoa deve 3 cobranças (ago+set+out), não o horizonte inteiro',
    /105,00/.test(await devido()), (await devido()).slice(0, 160));
await pg.selectOption('#month-selector-main', 'Novembro'); await pg.waitForTimeout(1600);
checa('em Novembro passa a dever 4 (140,00)', /140,00/.test(await devido()), (await devido()).slice(0, 160));

console.log('\n== Mas a projeção e a fatura prevista enxergam o futuro ==');
// a sincronização de faturas previstas roda ao salvar; aqui ela é disparada sem mudar nada
await aba('cards');
await pg.evaluate(() => {
    const btn = [...document.querySelectorAll('.edit-plan-btn')].find(b => b.closest('tr').textContent.includes('Spotify'));
    btn.click();
});
await pg.waitForTimeout(800);
await pg.click('#plan-form button[type="submit"]'); await pg.waitForTimeout(2900);
const parcelasFuturas = await pg.evaluate(() => {
    // Dezembro ainda não chegou: a cobrança tem de existir mesmo assim
    const db = JSON.parse(localStorage.getItem('finance-demo-data'));
    return (db['2026'].monthlyDetails['Dezembro'].expenses || [])
        .filter(e => e.cardId === 'card_nubank').map(e => e.value);
});
checa('a fatura prevista de Dezembro já conta a assinatura',
    parcelasFuturas.some(v => v >= 35), JSON.stringify(parcelasFuturas));

console.log('\n== Encerrar: histórico fica, pendente continua ==');
await aba('cards');
await pg.evaluate(() => document.querySelector('.encerrar-plan-btn').click()); await pg.waitForTimeout(700);
const msg = await pg.$eval('#confirm-message', el => el.textContent);
checa('confirma dizendo qual será a última cobrança', /última cobrança será a de Novembro\/2026/.test(msg), msg);
checa('e avisa que o pendente continua', /continua a receber/.test(msg));
await pg.click('#confirm-ok'); await pg.waitForTimeout(2900);
const enc = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data'))
    .appSettings.installmentPlans.find(p => p.id === 'ass1'));
checa('gravou o encerramento', enc && enc.endMonth === 'Novembro' && enc.endYear === '2026', JSON.stringify({ m: enc.endMonth, a: enc.endYear }));
checa('o registro continua existindo', !!enc);
l = await linhaDe('Spotify');
checa('a linha passa a mostrar o fim', /Novembro\/2026/.test(l) && !/sem fim definido/.test(l), l);
await aba('people'); await pg.waitForTimeout(600);
checa('a dívida de 4 cobranças permanece', /140,00/.test(await devido()), (await devido()).slice(0, 160));
await pg.selectOption('#month-selector-main', 'Dezembro'); await pg.waitForTimeout(1600);
checa('e não cresce mais depois do encerramento', /140,00/.test(await devido()), (await devido()).slice(0, 160));

console.log('\n== Encerrada não gera cobrança nova ==');
const depois = await pg.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('finance-demo-data'));
    return (db['2026'].monthlyDetails['Dezembro'].expenses || [])
        .filter(e => e.cardId === 'card_nubank').map(e => e.value);
});
checa('a fatura de Dezembro encolheu', JSON.stringify(depois) !== JSON.stringify(parcelasFuturas),
    `antes ${JSON.stringify(parcelasFuturas)} / agora ${JSON.stringify(depois)}`);

console.log('\n== Encerramento não pode ser antes do início ==');
await aba('cards');
// encerrada em Novembro, ela some do filtro "Em aberto" quando se olha Dezembro
await pg.selectOption('#plan-status-filter', 'all'); await pg.waitForTimeout(1000);
await pg.evaluate(() => {
    const btn = [...document.querySelectorAll('.edit-plan-btn')]
        .find(b => b.closest('tr').textContent.includes('Spotify'));
    btn.click();
});
await pg.waitForTimeout(800);
checa('edição abre com assinatura marcada', await pg.$eval('#plan-assinatura', el => el.checked));
checa('e com o encerramento carregado', (await pg.$eval('#plan-end-month', el => el.value)) === 'Novembro');
await pg.selectOption('#plan-end-month', 'Janeiro');
await pg.fill('#plan-end-year', '2026');       // antes de Agosto/2026
await pg.click('#plan-form button[type="submit"]'); await pg.waitForTimeout(900);
checa('recusa encerramento anterior à 1ª cobrança',
    await pg.$eval('#plan-modal', el => !el.classList.contains('hidden')));
await pg.selectOption('#plan-end-month', '');
await pg.fill('#plan-end-year', '');
await pg.click('#plan-form button[type="submit"]'); await pg.waitForTimeout(2900);
const reativada = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data'))
    .appSettings.installmentPlans.find(p => p.id === 'ass1'));
checa('limpar o encerramento reativa a assinatura',
    reativada && reativada.recorrente === true && !reativada.endMonth, JSON.stringify({ r: reativada.recorrente, e: reativada.endMonth }));

console.log('\n== Parcelamento comum não mudou ==');
await aba('cards');
l = await linhaDe('Notebook');
checa('continua mostrando n/total', /\d+\/\d+/.test(l) && !/mensal/.test(l), l);

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 3).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

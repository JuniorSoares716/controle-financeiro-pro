import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';


const comPessoas = () => {
    const db = JSON.parse(readFileSync(DADOS, 'utf8'));
    db.appSettings.people = [
        { id: 'p_ray', name: 'Rayanne', phone: '', color: '#60A5FA', createdAt: '2026-08-01' },
        { id: 'p_ellem', name: 'Ellem', phone: '', color: '#F472B6', createdAt: '2026-08-01' }
    ];
    db.appSettings.installmentPlans.push(
        { id: 'r1', cardId: 'card_nubank', description: 'WellHub', installmentValue: 50,
          totalInstallments: 6, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ray', recebimentos: {} },
        { id: 'r2', cardId: 'card_amazon', description: 'Mesa dobrável', installmentValue: 200,
          totalInstallments: 3, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ray', recebimentos: {} },
        { id: 'e1', cardId: 'card_nubank', description: 'Celular', installmentValue: 500,
          totalInstallments: 4, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_ellem', recebimentos: {} }
    );
    return db;
};

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n>>16)&255}, ${(n>>8)&255}, ${n&255})`; };

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

const aba = async (nome) => {
    await pg.evaluate(t => document.querySelector(`.nav-tab[data-tab="${t}"]`).click(), nome);
    await pg.waitForTimeout(1500);
};
const msgConfirm = () => pg.$eval('#confirm-message', el => el.textContent);
const confirmVisivel = () => pg.$eval('#confirm-modal', el => !el.classList.contains('hidden'));

await pg.goto(APP_URL); await pg.waitForTimeout(700);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(comPessoas()));
await pg.reload(); await pg.waitForTimeout(2400);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1200);

console.log('\n== Despesas: editar pede confirmação ==');
await aba('details');
const primeiraLinha = () => pg.$eval('#expense-tables tbody tr', el => el.textContent.replace(/\s+/g, ' ').trim());
const nomePrim = await pg.$eval('#expense-tables tbody tr td[data-label="Nome"]', el => el.textContent.trim().split('  ')[0]);
await pg.$$eval('.edit-expense-btn', els => els[0].click()); await pg.waitForTimeout(600);
checa('abre o alerta de confirmação', await confirmVisivel());
const msgEdit = await msgConfirm();
checa('a mensagem diz Editar e traz o nome', /^Editar "/.test(msgEdit) && msgEdit.includes(nomePrim.split(' ')[0]), msgEdit);
await pg.click('#confirm-cancel'); await pg.waitForTimeout(500);
checa('ao recusar, o modal de despesa NÃO abre',
    await pg.$eval('#expense-modal', el => el.classList.contains('hidden')));
await pg.$$eval('.edit-expense-btn', els => els[0].click()); await pg.waitForTimeout(600);
await pg.click('#confirm-ok'); await pg.waitForTimeout(700);
checa('ao confirmar, abre a edição', await pg.$eval('#expense-modal', el => !el.classList.contains('hidden')));
checa('abre com a despesa certa', (await pg.$eval('#expense-name', el => el.value)).startsWith(nomePrim.split(' ')[0]), await pg.$eval('#expense-name', el => el.value));
await pg.click('#expense-modal .cancel-btn'); await pg.waitForTimeout(500);

console.log('\n== Despesas: ícone de pago ==');
const estados = await pg.$$eval('#expense-tables tbody tr', els => els.map(tr => ({
    pago: /Pago/.test(tr.querySelector('td[data-label="Status"]').textContent),
    temBotao: !!tr.querySelector('.toggle-paid-btn'),
    cor: tr.querySelector('.toggle-paid-btn') ? getComputedStyle(tr.querySelector('.toggle-paid-btn')).color : null,
    titulo: tr.querySelector('.toggle-paid-btn')?.title
})));
checa('toda linha tem o ícone', estados.length > 0 && estados.every(e => e.temBotao), `${estados.length} linha(s)`);
const pend = estados.filter(e => !e.pago), pagas = estados.filter(e => e.pago);
checa('título muda conforme o status',
    pend.every(e => e.titulo === 'Marcar como paga') && pagas.every(e => e.titulo === 'Marcar como pendente'),
    `${pend.length} pendente(s) / ${pagas.length} paga(s)`);
checa('verde nas pagas, cinza nas pendentes',
    pagas.every(e => e.cor !== pend[0]?.cor), `paga=${pagas[0]?.cor} pendente=${pend[0]?.cor}`);

const idxPend = estados.findIndex(e => !e.pago);
const nomePend = await pg.$$eval('#expense-tables tbody tr', (els, i) => els[i].querySelector('td[data-label="Nome"]').textContent.trim(), idxPend);
await pg.$$eval('#expense-tables tbody tr', (els, i) => els[i].querySelector('.toggle-paid-btn').click(), idxPend);
await pg.waitForTimeout(600);
const msgPago = await msgConfirm();
checa('confirma antes de marcar, dizendo PAGA', /como PAGA\?$/.test(msgPago) && /R\$/.test(msgPago), msgPago);
await pg.click('#confirm-cancel'); await pg.waitForTimeout(2500);
const aindaPend = await pg.$$eval('#expense-tables tbody tr', (els, i) => /Pendente/.test(els[i].querySelector('td[data-label="Status"]').textContent), idxPend);
checa('ao recusar, nada muda', aindaPend);

await pg.$$eval('#expense-tables tbody tr', (els, i) => els[i].querySelector('.toggle-paid-btn').click(), idxPend);
await pg.waitForTimeout(600);
await pg.click('#confirm-ok'); await pg.waitForTimeout(2800);
const gravado = await pg.evaluate((n) => {
    const db = JSON.parse(localStorage.getItem('finance-demo-data'));
    const todas = db['2026'].monthlyDetails['Outubro'].expenses;
    return (todas.find(e => n.startsWith(e.name)) || {}).paid;
}, nomePend);
checa('grava paid=true no banco', gravado === true, `${gravado}`);
const virouVerde = await pg.$$eval('#expense-tables tbody tr', els => {
    const tr = els.find(t => /Pago/.test(t.querySelector('td[data-label="Status"]').textContent));
    return tr ? { cor: getComputedStyle(tr.querySelector('.toggle-paid-btn')).color, titulo: tr.querySelector('.toggle-paid-btn').title } : null;
});
checa('ícone passa a verde e troca o título', virouVerde && virouVerde.titulo === 'Marcar como pendente', JSON.stringify(virouVerde));
await pg.locator('#expense-tables').screenshot({ path: `${SHOTS}/despesas-icone-pago.png` });

console.log('\n== Desmarcar volta para pendente ==');
const idxPaga = await pg.$$eval('#expense-tables tbody tr', els => els.findIndex(t => /Pago/.test(t.querySelector('td[data-label="Status"]').textContent)));
await pg.$$eval('#expense-tables tbody tr', (els, i) => els[i].querySelector('.toggle-paid-btn').click(), idxPaga);
await pg.waitForTimeout(600);
checa('mensagem diz PENDENTE', /como PENDENTE\?$/.test(await msgConfirm()), await msgConfirm());
await pg.click('#confirm-ok'); await pg.waitForTimeout(2800);
checa('volta a pendente na tela',
    await pg.$$eval('#expense-tables tbody tr', (els, i) => /Pendente/.test(els[i].querySelector('td[data-label="Status"]').textContent), idxPaga));

console.log('\n== Parcelamentos: árvore com a cor da pessoa ==');
await aba('cards');
const arvore = await pg.$$eval('#plans-table tr', els => els.map(tr => ({
    grupo: tr.classList.contains('plan-group'),
    filho: tr.classList.contains('plan-child'),
    ultimo: tr.classList.contains('plan-last'),
    txt: tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 40),
    cor: tr.style.getPropertyValue('--cor-grupo'),
    ponto: (() => { const d = tr.querySelector('td:first-child .person-dot'); return d ? getComputedStyle(d).backgroundColor : null; })(),
    tronco: tr.classList.contains('plan-child')
        ? getComputedStyle(tr.querySelector('td:first-child'), '::before').borderLeftColor : null,
    ramo: tr.classList.contains('plan-child')
        ? getComputedStyle(tr.querySelector('td:first-child'), '::after').borderTopColor : null
})));
const filhos = arvore.filter(l => l.filho);
checa('toda compra é um ramo', filhos.length === arvore.filter(l => !l.grupo).length && filhos.length >= 4, `${filhos.length} ramo(s)`);
const wellhub = arvore.find(l => l.txt.includes('WellHub'));
checa('a linha da Rayanne carrega a cor dela', wellhub.cor === '#60A5FA', wellhub.cor);
checa('o ponto da linha é da cor da pessoa', wellhub.ponto === rgb('#60A5FA'), wellhub.ponto);
checa('tronco na cor da pessoa', wellhub.tronco === rgb('#60A5FA'), wellhub.tronco);
checa('ramo na cor da pessoa', wellhub.ramo === rgb('#60A5FA'), wellhub.ramo);
const celular = arvore.find(l => l.txt.includes('Celular'));
checa('a linha da Ellem carrega a cor dela', celular.cor === '#F472B6', celular.cor);
const suas = arvore.find(l => l.filho && !l.cor);
checa('suas compras ficam sem cor de pessoa (usa o destaque)', !!suas, suas && suas.txt);
checa('o destaque chega ao tronco das suas', suas && /^rgb/.test(suas.tronco), suas && suas.tronco);
const grupos = arvore.filter(l => l.grupo);
checa('cada faixa também carrega a cor', grupos.filter(g => g.cor).length === 2, grupos.map(g => g.cor || 'destaque').join(', '));
// um último ramo por grupo, e é mesmo o último da sequência
const ultimoPorGrupo = [];
arvore.forEach((l, i) => { if (l.ultimo) ultimoPorGrupo.push(i); });
checa('um "último ramo" por grupo', ultimoPorGrupo.length === grupos.length, `${ultimoPorGrupo.length} de ${grupos.length}`);
checa('o último ramo fecha o grupo',
    ultimoPorGrupo.every(i => i === arvore.length - 1 || arvore[i + 1].grupo));
await pg.locator('#plans-table').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/arvore-parcelamentos.png` });

console.log('\n== Sem agrupamento, nada de árvore ==');
await pg.selectOption('#plan-person-filter', 'mine'); await pg.waitForTimeout(1000);
checa('"só as suas" não desenha ramos',
    (await pg.$$eval('#plans-table tr.plan-child', els => els.length)) === 0);
await pg.selectOption('#plan-person-filter', 'all'); await pg.waitForTimeout(1000);

console.log('\n== No celular ==');
await pg.setViewportSize({ width: 390, height: 840 });
await pg.waitForTimeout(900);
const semRolagem = await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
checa('sem rolagem horizontal', semRolagem);
const borda = await pg.$$eval('#plans-table tr.plan-child', els => els.map(e => getComputedStyle(e).borderLeftColor + ' ' + getComputedStyle(e).borderLeftWidth));
checa('cartão do celular ganha a borda colorida',
    borda.length > 0 && borda.some(b => b.includes(rgb('#60A5FA'))) && borda.every(b => b.endsWith('4px')), borda.slice(0, 3).join(' | '));
const rotulo = await pg.$$eval('#plans-table tr.plan-child td:first-child', els => getComputedStyle(els[0], '::before').content);
checa('o rótulo "Compra" volta no celular', /Compra/.test(rotulo), rotulo);
await pg.locator('#plans-table').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/arvore-mobile.png` });
await pg.setViewportSize({ width: 1400, height: 1000 });

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

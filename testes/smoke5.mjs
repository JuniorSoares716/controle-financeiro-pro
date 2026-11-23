import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';


const db = JSON.parse(readFileSync(DADOS, 'utf8'));
db.appSettings.people = [
    { id: 'p_mari', name: 'Mariana', phone: '11999998888', createdAt: '2026-08-01' },
    { id: 'p_pedro', name: 'Pedro', phone: '', createdAt: '2026-10-01' }
];
db.appSettings.installmentPlans.push(
    { id: 'plan_mari', cardId: 'card_nubank', description: 'Celular da Mariana', installmentValue: 380,
      totalInstallments: 8, firstMonth: 'Agosto', firstYear: '2026', purchaseDate: '2026-07-18',
      personId: 'p_mari', recebimentos: { '2026-08': { recebido: true, data: '2026-08-12' } } },
    { id: 'plan_pedro', cardId: 'card_nubank', description: 'Fone do Pedro', installmentValue: 150,
      totalInstallments: 1, firstMonth: 'Novembro', firstYear: '2026', purchaseDate: '2026-10-22',
      personId: 'p_pedro', recebimentos: {} }
);
const dados = JSON.stringify(db);

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 2 });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

await pg.goto(APP_URL); await pg.waitForTimeout(800);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, dados);
await pg.reload(); await pg.waitForTimeout(2500);

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};
const zTopo = (sel) => pg.evaluate(s => {
    const el = document.querySelector(s);
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const noCentro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { z: cs.zIndex, visivel: !el.classList.contains('hidden'), contemPontoCentral: el.contains(noCentro) };
}, sel);

console.log('\n== BUG 1: cadastrar pessoa de dentro do parcelamento ==');
await pg.click('.nav-tab[data-tab="cards"]'); await pg.waitForTimeout(1500);
await pg.click('#add-plan-btn'); await pg.waitForTimeout(700);
await pg.fill('#plan-description', 'Guitarra do João');
await pg.click('#plan-new-person'); await pg.waitForTimeout(700);
const pessoa = await zTopo('#person-modal');
const plano = await zTopo('#plan-modal');
checa('modal de pessoa abre visível', pessoa.visivel);
checa('modal de pessoa fica POR CIMA do parcelamento',
    parseInt(pessoa.z, 10) > parseInt(plano.z, 10), `pessoa z=${pessoa.z}, parcelamento z=${plano.z}`);
checa('o clique no centro chega ao modal de pessoa', pessoa.contemPontoCentral);
await pg.screenshot({ path: `${SHOTS}/modal-empilhado.png` });
// e dá para realmente cadastrar sem perder o parcelamento
await pg.fill('#person-name', 'João'); await pg.fill('#person-phone', '11988887777');
await pg.click('#person-form button[type="submit"]'); await pg.waitForTimeout(1800);
checa('pessoa cadastrada e selecionada no parcelamento',
    (await pg.inputValue('#plan-person')) !== '' &&
    (await pg.$eval('#plan-person', s => s.options[s.selectedIndex].textContent)) === 'João');
checa('descrição do parcelamento preservada', (await pg.inputValue('#plan-description')) === 'Guitarra do João');
checa('modal de pessoa fechou', (await pg.getAttribute('#person-modal', 'class')).includes('hidden'));
await pg.click('#plan-modal .cancel-btn'); await pg.waitForTimeout(600);

console.log('\n== BUG 2a: sem fatura lançada, o status segue o ciclo do cartão ==');
// fecha dia 1 e vence dia 5 -> paga no próprio mês, e o dia 5 já passou
const semFatura = JSON.parse(dados);
const nu = semFatura.appSettings.cards.find(c => c.id === 'card_nubank');
nu.closingDay = 1; nu.dueDay = 5;
semFatura['2026'].monthlyDetails['Novembro'] = { expenses: [] };
// tira também as faturas vizinhas: sem nenhuma por perto, o ciclo vem do cadastro do cartão
Object.values(semFatura['2026'].monthlyDetails).forEach(d => {
    if (d && Array.isArray(d.expenses)) d.expenses = d.expenses.filter(e => e.cardId !== 'card_nubank');
});
await pg.evaluate(d => localStorage.setItem('finance-demo-data', d), JSON.stringify(semFatura));
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#month-selector-main', 'Novembro'); await pg.waitForTimeout(1200);
await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1500);
const blocoPedro = (t) => (t.split('Pedro')[1] || '').slice(0, 300);
checa('Pedro atrasado: fecha 1, vence 5, e o dia 5 passou',
    /atrasada\(s\)/.test(blocoPedro(await pg.textContent('#people-cards'))));
await pg.click('.nav-tab[data-tab="cards"]'); await pg.waitForTimeout(1500);
await pg.click('#cards-list .edit-card-btn'); await pg.waitForTimeout(700);
await pg.fill('#card-due', '28');
await pg.click('#card-form button[type="submit"]'); await pg.waitForTimeout(2600);
if (await pg.isVisible('#confirm-ok')) { await pg.click('#confirm-ok'); await pg.waitForTimeout(2200); }
await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1800);
checa('mudando para dia 28, Pedro deixa de estar atrasado',
    !/atrasada\(s\)/.test(blocoPedro(await pg.textContent('#people-cards'))),
    blocoPedro(await pg.textContent('#people-cards')).replace(/\s+/g, ' ').slice(0, 110));

console.log('\n== BUG 2b: fatura ainda por vencer é realinhada, mantendo o mês ==');
const comFatura = JSON.parse(dados);
const nu2 = comFatura.appSettings.cards.find(c => c.id === 'card_nubank');
nu2.closingDay = 1; nu2.dueDay = 25;
comFatura['2026'].monthlyDetails['Novembro'] = { expenses: [
    { id: 'fat_nov', name: 'Fatura Nubank', categoryId: comFatura['2026'].expenseCategories[0].id,
      cardId: 'card_nubank', value: 2400, paid: false, dueDate: '2026-11-25', due: 25 }
] };
await pg.evaluate(d => localStorage.setItem('finance-demo-data', d), JSON.stringify(comFatura));
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#month-selector-main', 'Novembro'); await pg.waitForTimeout(1200);
await pg.click('.nav-tab[data-tab="cards"]'); await pg.waitForTimeout(1500);
await pg.click('#cards-list .edit-card-btn'); await pg.waitForTimeout(700);
await pg.fill('#card-due', '28');
await pg.click('#card-form button[type="submit"]'); await pg.waitForTimeout(1200);
const txtConfirm = await pg.textContent('#confirm-message').catch(() => '');
checa('oferece realinhar as faturas ainda por vencer', /vencimento passou do dia 25 para o dia 28/.test(txtConfirm), txtConfirm.slice(0, 130));
checa('explica o efeito em Pessoas', /atrasado em Pessoas/.test(txtConfirm));
await pg.click('#confirm-ok'); await pg.waitForTimeout(2600);
if (await pg.isVisible('#confirm-ok')) { await pg.click('#confirm-ok'); await pg.waitForTimeout(2200); }
const fatSalva = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data'))['2026']
    .monthlyDetails['Novembro'].expenses.find(e => e.id === 'fat_nov'));
checa('dia mudou para 28 e o mês foi preservado', fatSalva.dueDate === '2026-11-28' && fatSalva.due === 28,
    `${fatSalva.dueDate} / dia ${fatSalva.due}`);
checa('valor e situação da fatura intactos', fatSalva.value === 2400 && fatSalva.paid === false);

console.log('\n== ITEM 3: aba Pessoas ==');
await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1500);
checa('aba existe na navegação', (await pg.$$('.nav-tab[data-tab="people"]')).length === 1);
checa('página visível', await pg.isVisible('#people-page'));
const kpis = await pg.textContent('#people-kpis');
checa('três KPIs', /A receber em/.test(kpis) && /Total em aberto/.test(kpis) && /Atrasado/.test(kpis));
const cards = await pg.textContent('#people-cards');
checa('lista as pessoas', cards.includes('Mariana') && cards.includes('Pedro'));

checa('mostra telefone', /11999998888/.test(cards));
checa('quebra por cartão', /Nubank/.test(cards));
checa('botão de nova pessoa', await pg.isVisible('#add-person-btn'));
await pg.screenshot({ path: `${SHOTS}/aba-pessoas.png`, clip: { x: 0, y: 120, width: 1440, height: 640 } });

console.log('\n== Cartões: resumo compacto com link ==');
await pg.click('.nav-tab[data-tab="cards"]'); await pg.waitForTimeout(1500);
const sec = await pg.textContent('#terceiros-section');
checa('resumo compacto na aba Cartões', /a receber de \d+ pessoa\(s\)/.test(sec), sec.replace(/\s+/g, ' ').trim().slice(0, 120));
checa('não repete a lista inteira', !/Quem deve a você/.test(sec));
await pg.click('#cards-goto-people'); await pg.waitForTimeout(1500);
checa('link leva para a aba Pessoas', await pg.isVisible('#people-page'));

console.log('\n== Dashboard: botão Ver aponta para Pessoas ==');
await pg.click('.nav-tab[data-tab="dashboard"]'); await pg.waitForTimeout(1500);
await pg.click('#dash-goto-terceiros'); await pg.waitForTimeout(1500);
checa('Ver leva para a aba Pessoas', await pg.isVisible('#people-page'));

console.log('\n== Extrato continua funcionando a partir da aba ==');
await pg.click('#people-cards .extrato-btn'); await pg.waitForTimeout(900);
checa('extrato abre', !(await pg.getAttribute('#person-statement-modal', 'class')).includes('hidden'));
checa('tem parcelas', /\/8/.test(await pg.textContent('#statement-body')));
await pg.click('#person-statement-modal .cancel-btn'); await pg.waitForTimeout(500);

console.log('\n== Excluir pessoa sem compras funciona; com compras é bloqueado ==');
const btnsDel = await pg.$$('#people-cards .delete-person-btn');
checa('pessoas têm botão excluir', btnsDel.length >= 2, `${btnsDel.length}`);
await btnsDel[0].click(); await pg.waitForTimeout(700);
const alerta = await pg.textContent('#alert-message').catch(() => '');
checa('bloqueia quem tem compra', /compra\(s\) lançada\(s\)/.test(alerta), alerta.slice(0, 80));
await pg.click('#alert-ok').catch(() => {}); await pg.waitForTimeout(400);

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 3).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

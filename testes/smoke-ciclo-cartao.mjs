/* RN-CARD-05: o mês em que a fatura vence passa a ser escolha do cartão, não
   dedução. Antes, um cartão que fecha dia 8 e vence dia 15 fazia a prévia nascer
   vencendo dentro da própria competência — quando na vida real a fatura de
   dezembro é paga em janeiro. */
import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';

const base = () => {
    const db = JSON.parse(readFileSync(DADOS, 'utf8'));
    // cartão como o do usuário: fecha antes de vencer, mas a fatura é paga no mês seguinte
    db.appSettings.cards = [{ id: 'card_nu', name: 'Nubank', limit: 8000, closingDay: 8, dueDay: 15 }];
    db.appSettings.installmentPlans = [
        { id: 'pl1', cardId: 'card_nu', description: 'Notebook', installmentValue: 400,
          totalInstallments: 10, firstMonth: 'Novembro', firstYear: '2026', personId: null, recebimentos: {} }
    ];
    /* Prévias como o usuário as tinha: vencendo DENTRO da própria competência.
       Novembro já venceu (hoje é dia 23) e serve para checar que o realinhamento
       não mexe no passado. */
    const cat = db['2026'].expenseCategories[0].id;
    const previa = (venc) => ({ id: 'f' + venc, categoryId: cat, name: 'Fatura Nubank', value: 400,
        paid: false, cardId: 'card_nu', valorAutomatico: true, dueDate: venc, due: 15 });
    db['2026'].monthlyDetails['Novembro'] = { expenses: [previa('2026-11-15')] };
    db['2026'].monthlyDetails['Dezembro'] = { expenses: [previa('2026-12-15')] };
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

const fatura = (ano, mes) => pg.evaluate(([a, m]) => {
    const d = JSON.parse(localStorage.getItem('finance-demo-data'));
    const e = ((((d[a] || {}).monthlyDetails || {})[m] || {}).expenses || []).find(x => x.cardId === 'card_nu');
    return e ? { valor: e.value, venc: e.dueDate, pago: !!e.paid } : null;
}, [ano, mes]);
const abrirCartao = async () => {
    await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="cards"]').click());
    await pg.waitForTimeout(1600);
    await pg.evaluate(() => {
        const btn = [...document.querySelectorAll('.edit-card-btn')].find(b => b.closest('*').textContent.includes('Nubank'))
            || document.querySelector('.edit-card-btn');
        btn.click();
    });
    await pg.waitForTimeout(800);
};

await pg.goto(APP_URL); await pg.waitForTimeout(700);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(base()));
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#month-selector-main', 'Dezembro'); await pg.waitForTimeout(1500);

console.log('\n== Cartão antigo abre com o que era deduzido ==');
await abrirCartao();
checa('fecha 8 / vence 15 abre em "próprio mês"',
    (await pg.$eval('#card-due-offset', el => el.value)) === '0',
    await pg.$eval('#card-due-offset', el => el.value));
await pg.click('#card-modal .cancel-btn'); await pg.waitForTimeout(500);

console.log('\n== Cartão novo nasce em "mês seguinte" ==');
await pg.evaluate(() => document.getElementById('add-card-btn').click());
await pg.waitForTimeout(800);
checa('o padrão do cadastro é o mês seguinte',
    (await pg.$eval('#card-due-offset', el => el.value)) === '1',
    await pg.$eval('#card-due-offset', el => el.value));
await pg.click('#card-modal .cancel-btn'); await pg.waitForTimeout(500);

console.log('\n== Trocar para "mês seguinte" oferece realinhar ==');
await abrirCartao();
await pg.selectOption('#card-due-offset', '1');
await pg.click('#card-form button[type="submit"]'); await pg.waitForTimeout(1200);
const msg = await pg.$eval('#confirm-message', el => el.textContent);
checa('pergunta antes de mover as faturas', /vencer no mês seguinte/.test(msg), msg.slice(0, 120));
checa('e diz que pagas e vencidas não são tocadas', /não são tocadas/.test(msg));
await pg.click('#confirm-ok'); await pg.waitForTimeout(3000);

console.log('\n== A prévia passa a vencer no mês seguinte ==');
const dez = await fatura('2026', 'Dezembro');
checa('competência Dezembro vence 15/01', dez && dez.venc === '2027-01-15', dez && dez.venc);
const nov = await fatura('2026', 'Novembro');
checa('Novembro, já vencida, não é tocada', nov && nov.venc === '2026-11-15', nov && nov.venc);
const gravado = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data'))
    .appSettings.cards.find(c => c.id === 'card_nu').dueMonthOffset);
checa('o cartão guarda a escolha', gravado === 1, String(gravado));

console.log('\n== Fatura criada daqui em diante já nasce certa ==');
await pg.evaluate(() => document.getElementById('add-year-btn').click());
await pg.waitForTimeout(800);
await pg.fill('#prompt-input', '2027');
await pg.click('#prompt-ok'); await pg.waitForTimeout(3200);
const jan = await fatura('2027', 'Janeiro');
checa('competência Janeiro/2027 vence 15/02', jan && jan.venc === '2027-02-15', jan && jan.venc);
const fev = await fatura('2027', 'Fevereiro');
checa('competência Fevereiro/2027 vence 15/03', fev && fev.venc === '2027-03-15', fev && fev.venc);

console.log('\n== Na tela da fatura ==');
await pg.selectOption('#year-selector-main', '2027'); await pg.waitForTimeout(1600);
await pg.selectOption('#month-selector-main', 'Janeiro'); await pg.waitForTimeout(1400);
await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="details"]').click());
await pg.waitForTimeout(1600);
const linhas = await pg.$$eval('#expense-tables tbody tr', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
checa('a linha mostra 15/02', linhas.some(l => /Fatura Nubank/.test(l) && /15\/02/.test(l)),
    linhas.find(l => /Fatura Nubank/.test(l)) || linhas.slice(0, 2).join(' | '));
await pg.locator('#expense-tables').screenshot({ path: `${SHOTS}/ciclo-cartao.png` });

console.log('\n== Voltar para "próprio mês" também pergunta ==');
await pg.selectOption('#year-selector-main', '2026'); await pg.waitForTimeout(1600);
await pg.selectOption('#month-selector-main', 'Dezembro'); await pg.waitForTimeout(1400);
await abrirCartao();
await pg.selectOption('#card-due-offset', '0');
await pg.click('#card-form button[type="submit"]'); await pg.waitForTimeout(1200);
const msg2 = await pg.$eval('#confirm-message', el => el.textContent);
checa('pergunta na volta também', /vencer no próprio mês/.test(msg2), msg2.slice(0, 110));
await pg.click('#confirm-cancel'); await pg.waitForTimeout(2600);
const depois = await fatura('2026', 'Dezembro');
checa('recusar mantém as faturas onde estavam', depois && depois.venc === '2027-01-15', depois && depois.venc);
const offDepois = await pg.evaluate(() => JSON.parse(localStorage.getItem('finance-demo-data'))
    .appSettings.cards.find(c => c.id === 'card_nu').dueMonthOffset);
checa('mas a escolha do cartão foi gravada', offDepois === 0, String(offDepois));

/* O caso exato do usuário: ele já tinha corrigido 2026 à mão, e só 2027 ficou
   vencendo dentro da própria competência. O realinhamento precisa consertar 2027
   sem reencostar no que já estava certo. */
console.log('\n== 2026 já ajustado à mão, 2027 errado ==');
await pg.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('finance-demo-data'));
    const c = d.appSettings.cards.find(x => x.id === 'card_nu');
    delete c.dueMonthOffset;                       // volta ao estado anterior à v2.5.2
    const por = (ano, mes, venc) => {
        const det = d[ano].monthlyDetails[mes];
        const f = (det.expenses || []).find(e => e.cardId === 'card_nu');
        if (f) { f.dueDate = venc; f.due = 15; f.paid = false; }
    };
    por('2026', 'Dezembro', '2027-01-15');         // corrigido à mão: certo
    ['Janeiro', 'Fevereiro', 'Março', 'Abril'].forEach((m, i) => {
        por('2027', m, `2027-${String(i + 1).padStart(2, '0')}-15`);  // errado
    });
    localStorage.setItem('finance-demo-data', JSON.stringify(d));
});
await pg.reload(); await pg.waitForTimeout(2500);
await pg.selectOption('#year-selector-main', '2026'); await pg.waitForTimeout(1500);
await pg.selectOption('#month-selector-main', 'Dezembro'); await pg.waitForTimeout(1400);
checa('partida: Dezembro/2026 certo', (await fatura('2026', 'Dezembro')).venc === '2027-01-15');
checa('partida: Janeiro/2027 errado', (await fatura('2027', 'Janeiro')).venc === '2027-01-15');

await abrirCartao();
await pg.selectOption('#card-due-offset', '1');
await pg.click('#card-form button[type="submit"]'); await pg.waitForTimeout(1200);
const msg3 = await pg.$eval('#confirm-message', el => el.textContent);
const qtd = (/Atualizar (\d+) fatura/.exec(msg3) || [])[1];
checa('propõe só as que estão erradas', Number(qtd) >= 4, `${qtd} fatura(s) · ${msg3.slice(0, 90)}`);
checa('e não lista Dezembro/2026, que já estava certo', !/Dezembro\/2026/.test(msg3), msg3.slice(0, 140));
await pg.click('#confirm-ok'); await pg.waitForTimeout(3200);

checa('Janeiro/2027 passa a vencer 15/02', (await fatura('2027', 'Janeiro')).venc === '2027-02-15',
    (await fatura('2027', 'Janeiro')).venc);
checa('Fevereiro/2027 passa a vencer 15/03', (await fatura('2027', 'Fevereiro')).venc === '2027-03-15',
    (await fatura('2027', 'Fevereiro')).venc);
checa('Abril/2027 passa a vencer 15/05', (await fatura('2027', 'Abril')).venc === '2027-05-15',
    (await fatura('2027', 'Abril')).venc);
checa('Dezembro/2026 continua igual', (await fatura('2026', 'Dezembro')).venc === '2027-01-15',
    (await fatura('2026', 'Dezembro')).venc);

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

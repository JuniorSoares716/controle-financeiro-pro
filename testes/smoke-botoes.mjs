/* Guarda contra o que aconteceu com a remoção do "detalhar compra": uma linha de
   listeners apagada deixou sete botões "Adicionar" mudos, e nenhum teste viu.
   Aqui todo botão que deve abrir um modal é clicado e cobrado. */
import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';

const db = JSON.parse(readFileSync(DADOS, 'utf8'));
db.appSettings.people = [{ id: 'p_ray', name: 'Rayanne', phone: '', color: '#60A5FA', createdAt: '2026-08-01' }];

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

await pg.goto(APP_URL); await pg.waitForTimeout(700);
await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(db));
await pg.reload(); await pg.waitForTimeout(2400);
await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1200);

/* botão -> modal que ele precisa abrir. O clique vai por .click() direto:
   o listener tem de responder mesmo com a aba escondida, e é isso que importa. */
const botoes = [
    ['add-expense-btn', 'expense-modal'],
    ['add-investment-btn', 'investment-modal'],
    ['add-income-btn', 'income-modal'],
    ['add-budget-btn', 'budget-modal'],
    ['add-goal-btn', 'goal-modal'],
    ['add-card-btn', 'card-modal'],
    ['add-plan-btn', 'plan-modal'],
    ['add-person-btn', 'person-modal'],
    ['add-recurring-expense-btn', 'recurring-expense-modal'],
    ['manage-categories-btn', 'manage-categories-modal'],
    ['add-new-category-btn', 'category-modal'],
    ['add-month-btn', 'prompt-modal'],
    ['add-year-btn', 'prompt-modal']
];

const fechaTudo = () => pg.evaluate(() => {
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
});

console.log('\n== Todo botão "Adicionar" abre o seu modal ==');
for (const [idBotao, idModal] of botoes) {
    await fechaTudo();
    const existe = await pg.$(`#${idBotao}`);
    if (!existe) { checa(`#${idBotao} existe na página`, false); continue; }
    await pg.evaluate(id => document.getElementById(id).click(), idBotao);
    await pg.waitForTimeout(500);
    const abertos = await pg.$$eval('.modal-backdrop:not(.hidden)', els => els.map(e => e.id));
    checa(`#${idBotao} abre #${idModal}`, abertos.includes(idModal),
        abertos.length ? `abriu: ${abertos.join(', ')}` : 'nada abriu');
}
await fechaTudo();

console.log('\n== E os formulários chegam prontos ==');
await pg.evaluate(() => document.getElementById('add-expense-btn').click()); await pg.waitForTimeout(500);
checa('nova despesa traz categorias', (await pg.$$eval('#expense-category option', els => els.length)) > 0);
checa('nova despesa vem com o título certo', (await pg.$eval('#expense-modal-title', el => el.textContent)) === 'Nova Despesa');
await fechaTudo();
await pg.evaluate(() => document.getElementById('add-recurring-expense-btn').click()); await pg.waitForTimeout(500);
checa('nova recorrente traz os meses', (await pg.$$eval('#recurring-expense-start option', els => els.length)) > 0);
await fechaTudo();

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

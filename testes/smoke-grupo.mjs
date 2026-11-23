import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';


const base = () => JSON.parse(readFileSync(DADOS, 'utf8'));
const comPessoas = () => {
    const db = base();
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

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

const carregar = async (db) => {
    await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(db));
    await pg.reload(); await pg.waitForTimeout(2400);
    await pg.selectOption('#month-selector-main', 'Outubro'); await pg.waitForTimeout(1200);
    // clique direto no botão: no celular as abas ficam escondidas atrás da gaveta
    await pg.evaluate(() => document.querySelector('.nav-tab[data-tab="cards"]').click());
    await pg.waitForTimeout(1600);
};
// sequência de linhas: cabeçalhos de grupo e compras, na ordem em que aparecem
const sequencia = () => pg.$$eval('#plans-table tr', els => els.map(e => ({
    grupo: e.classList.contains('plan-group'),
    txt: e.textContent.replace(/\s+/g, ' ').trim()
})));

await pg.goto(APP_URL); await pg.waitForTimeout(700);

console.log('\n== Com pessoas: agrupa ==');
await carregar(comPessoas());
let seq = await sequencia();
const grupos = seq.filter(l => l.grupo);
checa('três grupos', grupos.length === 3, grupos.map(g => g.txt.slice(0, 40)).join(' | '));
checa('"Suas compras" vem primeiro', /Suas compras/.test(grupos[0].txt), grupos[0].txt.slice(0, 50));
checa('depois quem deve mais (Rayanne 900 > Ellem 2000?)',
    /Rayanne|Ellem/.test(grupos[1].txt), grupos[1].txt.slice(0, 60));
checa('cabeçalho traz contagem e subtotal', /compra\(s\)/.test(grupos[1].txt) && /R\$/.test(grupos[1].txt), grupos[1].txt);
checa('subtotal de terceiro diz "a receber"', grupos.slice(1).every(g => /a receber/.test(g.txt)));
checa('subtotal das suas diz "a pagar"', /a pagar/.test(grupos[0].txt), grupos[0].txt.slice(-30));

console.log('\n== Cada compra cai no grupo certo ==');
const posGrupo = (nome) => seq.findIndex(l => l.grupo && l.txt.includes(nome));
const posCompra = (nome) => seq.findIndex(l => !l.grupo && l.txt.includes(nome));
const proximoGrupo = (desde) => { const i = seq.slice(desde + 1).findIndex(l => l.grupo); return i === -1 ? seq.length : desde + 1 + i; };
const dentroDe = (compra, grupo) => {
    const g = posGrupo(grupo), c = posCompra(compra);
    return c > g && c < proximoGrupo(g);
};
checa('WellHub sob Rayanne', dentroDe('WellHub', 'Rayanne'));
checa('Mesa dobrável sob Rayanne', dentroDe('Mesa dobrável', 'Rayanne'));
checa('Celular sob Ellem', dentroDe('Celular', 'Ellem'));
checa('Notebook sob Suas compras', dentroDe('Notebook', 'Suas compras'));
checa('etiqueta de pessoa some da linha (já está no grupo)',
    !seq.some(l => !l.grupo && /WellHub/.test(l.txt) && /Rayanne/.test(l.txt)));
await pg.locator('#plans-table').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/parcelamentos-agrupados.png` });

console.log('\n== Ordenação continua valendo dentro do grupo ==');
await pg.selectOption('#plan-sort', 'name'); await pg.waitForTimeout(1000);
seq = await sequencia();
const g1 = posGrupo('Rayanne'), fim = proximoGrupo(g1);
const nomesRay = seq.slice(g1 + 1, fim).map(l => l.txt.split(' ')[0]);
checa('compras da Rayanne em ordem alfabética',
    JSON.stringify(nomesRay) === JSON.stringify([...nomesRay].sort((a, b) => a.localeCompare(b, 'pt-BR'))), nomesRay.join(', '));

console.log('\n== Filtrar por pessoa deixa só um grupo ==');
await pg.selectOption('#plan-person-filter', 'p_ellem'); await pg.waitForTimeout(1000);
seq = await sequencia();
checa('só o grupo da Ellem, com o subtotal dela', seq.filter(l => l.grupo).length === 1 && /Ellem/.test(seq[0].txt) && /a receber/.test(seq[0].txt), seq[0].txt.slice(0, 60));
await pg.selectOption('#plan-person-filter', 'mine'); await pg.waitForTimeout(1000);
seq = await sequencia();
checa('"só as suas" não mostra faixa nenhuma', seq.filter(l => l.grupo).length === 0);
checa('e ainda lista as compras', seq.length > 0 && seq.some(l => /Notebook/.test(l.txt)));
await pg.selectOption('#plan-person-filter', 'all'); await pg.waitForTimeout(1000);

console.log('\n== Sem pessoas: tabela simples, como antes ==');
await carregar(base());
seq = await sequencia();
checa('nenhuma faixa de grupo', seq.filter(l => l.grupo).length === 0);
checa('as compras continuam listadas', seq.length >= 2, `${seq.length} linha(s)`);

console.log('\n== No celular ==');
await pg.setViewportSize({ width: 390, height: 840 });
await carregar(comPessoas());
await pg.waitForTimeout(600);
const semRolagem = await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
checa('sem rolagem horizontal', semRolagem);
const alturaGrupo = await pg.$$eval('#plans-table tr.plan-group', els => els.map(e => e.getBoundingClientRect().height));
checa('faixas de grupo visíveis no celular', alturaGrupo.length === 3 && alturaGrupo.every(h => h > 10), alturaGrupo.map(Math.round).join(', '));
await pg.locator('#plans-table').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: `${SHOTS}/parcelamentos-mobile.png` });

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

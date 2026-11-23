import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';


const base = () => {
    const db = JSON.parse(readFileSync(DADOS, 'utf8'));
    db.appSettings.people = [
        { id: 'p_e', name: 'Ellem', phone: '', color: '#F472B6', createdAt: '2026-08-01' },
        { id: 'p_k', name: 'Kaio', phone: '', color: '#34D399', createdAt: '2026-08-01' }
    ];
    db.appSettings.installmentPlans.push(
        // duas compras da Ellem caindo no MESMO mês (Outubro)
        { id: 'pe1', cardId: 'card_nubank', description: 'Celular', installmentValue: 380,
          totalInstallments: 6, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_e', recebimentos: {} },
        { id: 'pe2', cardId: 'card_amazon', description: 'Livros', installmentValue: 120,
          totalInstallments: 4, firstMonth: 'Outubro', firstYear: '2026', personId: 'p_e', recebimentos: {} },
        // Kaio só tem parcela a partir de Dezembro
        { id: 'pk1', cardId: 'card_nubank', description: 'Fone', installmentValue: 90,
          totalInstallments: 3, firstMonth: 'Dezembro', firstYear: '2026', personId: 'p_k', recebimentos: {} }
    );
    return db;
};
const brl = (t) => parseFloat(String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 950 }, deviceScaleFactor: 2 });
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

const carregar = async (db, mes) => {
    await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, JSON.stringify(db));
    await pg.reload(); await pg.waitForTimeout(2400);
    await pg.selectOption('#month-selector-main', mes); await pg.waitForTimeout(1300);
    await pg.click('.nav-tab[data-tab="people"]'); await pg.waitForTimeout(1500);
};
const abrirExtrato = async (nome) => {
    const idx = await pg.$$eval('#people-cards .card', (els, n) => els.findIndex(e => e.textContent.includes(n)), nome);
    await pg.$$eval('#people-cards .extrato-btn', (els, i) => els[i].click(), idx);
    await pg.waitForTimeout(900);
    return (await pg.textContent('#statement-body')).replace(/\s+/g, ' ');
};
const fechar = async () => { await pg.click('#person-statement-modal .cancel-btn'); await pg.waitForTimeout(500); };
const cards = () => pg.$$eval('#statement-body .kpi-card', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));

await pg.goto(APP_URL); await pg.waitForTimeout(700);

console.log('\n== Mês com duas parcelas da mesma pessoa ==');
await carregar(base(), 'Outubro');
let txt = await abrirExtrato('Ellem');
let cs = await cards();
checa('quatro cards', cs.length === 4, `${cs.length}`);
checa('o primeiro é o do mês', /A receber em Outubro/.test(cs[0]), cs[0]);
checa('soma as duas compras do mês (380 + 120)', Math.abs(brl(cs[0].match(/R\$[\s ]*[\d.,]+/)[0]) - 500) < 0.01, cs[0]);
checa('diz quantas parcelas compõem', /2 parcelas/.test(cs[0]), cs[0]);
checa('total continua separado', /A receber no total/.test(cs[1]) && Math.abs(brl(cs[1].match(/R\$[\s ]*[\d.,]+/)[0]) - (6*380 + 4*120)) < 0.01, cs[1]);
checa('compras em aberto viraram subtítulo do total', /compra\(s\) em aberto/.test(cs[1]), cs[1]);
checa('não existe mais card "Compras em aberto"', !cs.some(c => /^Compras em aberto/.test(c)));
await pg.screenshot({ path: `${SHOTS}/extrato-mes.png`, clip: { x: 200, y: 60, width: 800, height: 300 } });

console.log('\n== Marcar recebida atualiza o card do mês ==');
const antes = brl(cs[0].match(/R\$[\s ]*[\d.,]+/)[0]);
await pg.click('#statement-body .toggle-recebida-btn[data-chave="2026-10"][data-recebida="0"]'); await pg.waitForTimeout(2800);
cs = await cards();
const depois = brl(cs[0].match(/R\$[\s ]*[\d.,]+/)[0]);
checa('valor do mês cai ao receber', Math.abs((antes - depois) - 380) < 0.01, `${antes} -> ${depois}`);
checa('sobra uma parcela', /1 parcela/.test(cs[0]), cs[0]);
await pg.click('#statement-body .toggle-recebida-btn[data-chave="2026-10"][data-recebida="0"]'); await pg.waitForTimeout(2800);
cs = await cards();
checa('tudo recebido no mês mostra "recebido"', /recebido/.test(cs[0]) && !/R\$\s*0,00/.test(cs[0].split('·')[0]), cs[0]);
checa('subtítulo informa o acertado', /acertado no mês/.test(cs[0]), cs[0]);
await fechar();

console.log('\n== Pessoa sem parcela no mês selecionado ==');
txt = await abrirExtrato('Kaio');
cs = await cards();
checa('mostra a próxima parcela', /Próxima parcela/.test(cs[0]), cs[0]);
checa('com o valor dela', Math.abs(brl(cs[0].match(/R\$[\s ]*[\d.,]+/)[0]) - 90) < 0.01, cs[0]);
checa('e com o mês e o vencimento', /Dezembro\/2026/.test(cs[0]) && /vence \d{2}\/\d{2}\/\d{4}/.test(cs[0]), cs[0]);
await pg.screenshot({ path: `${SHOTS}/extrato-proxima.png`, clip: { x: 200, y: 60, width: 800, height: 260 } });
await fechar();

console.log('\n== Acompanha o seletor de mês (não o calendário) ==');
await pg.selectOption('#month-selector-main', 'Dezembro'); await pg.waitForTimeout(1500);
cs = await (async () => { await abrirExtrato('Kaio'); return cards(); })();
checa('agora o mês de Kaio é Dezembro', /A receber em Dezembro/.test(cs[0]), cs[0]);
checa('com o valor da parcela', Math.abs(brl(cs[0].match(/R\$[\s ]*[\d.,]+/)[0]) - 90) < 0.01, cs[0]);
await fechar();

console.log('\n== Bate com o card da aba Pessoas ==');
const naAba = await pg.$$eval('#people-cards .card', els => {
    const e = els.find(x => x.textContent.includes('Kaio'));
    const m = e.textContent.replace(/\s+/g, ' ').match(/em Dezembro\s*(R\$[\s ]*[\d.,]+)/);
    return m ? m[1] : null;
});
checa('mesmo número nas duas telas', naAba && Math.abs(brl(naAba) - 90) < 0.01, `aba: ${naAba}`);

console.log('\n== Parcela atrasada no mês é sinalizada ==');
const comAtraso = base();
comAtraso.appSettings.cards.find(c => c.id === 'card_nubank').closingDay = 1;
comAtraso.appSettings.cards.find(c => c.id === 'card_nubank').dueDay = 5;
Object.values(comAtraso['2026'].monthlyDetails).forEach(d => {
    if (d && Array.isArray(d.expenses)) d.expenses = d.expenses.filter(e => e.cardId !== 'card_nubank');
});
await carregar(comAtraso, 'Novembro');
cs = await (async () => { await abrirExtrato('Ellem'); return cards(); })();
checa('marca atrasada no card do mês', /\d+ atrasada/.test(cs[0]), cs[0]);
await fechar();

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 2).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

import { exigir, APP_URL, DADOS, SHOTS } from './caminhos.mjs';
const { chromium } = exigir('playwright');
import { readFileSync } from 'fs';

const db = JSON.parse(readFileSync(DADOS, 'utf8'));
db.appSettings.people = [{ id: 'p_mari', name: 'Mariana', phone: '', createdAt: '2026-08-01' }];
db.appSettings.installmentPlans.push({ id: 'pl_m', cardId: 'card_nubank', description: 'Celular', installmentValue: 380,
    totalInstallments: 6, firstMonth: 'Setembro', firstYear: '2026', personId: 'p_mari', recebimentos: {} });
const dados = JSON.stringify(db);

let falhas = 0, total = 0;
const checa = (nome, cond, extra = '') => {
    total++;
    if (cond) console.log(`  ok  ${nome}${extra ? ' — ' + extra : ''}`);
    else { falhas++; console.log(`  FALHOU ${nome}${extra ? ' — ' + extra : ''}`); }
};

const b = await chromium.launch();
const erros = [];
const abrir = async (w, h = 820) => {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    pg.on('pageerror', e => erros.push(`${w}px PAGEERROR: ${e.message}`));
    pg.on('console', m => { if (m.type() === 'error') erros.push(`${w}px: ${m.text()}`); });
    await pg.goto(APP_URL); await pg.waitForTimeout(600);
    await pg.evaluate(d => { localStorage.setItem('finance-demo-data', d); localStorage.setItem('finance-demo-logged', '1'); }, dados);
    await pg.reload(); await pg.waitForTimeout(2300);
    return pg;
};
const medir = (pg) => pg.evaluate(() => {
    const nav = document.getElementById('main-nav');
    const de = document.documentElement;
    const visivel = (el) => el && getComputedStyle(el).display !== 'none';
    const itens = [...nav.querySelectorAll('.nav-tab')];
    const dentro = itens.every(el => {
        const r = el.getBoundingClientRect(), n = nav.getBoundingClientRect();
        return r.left >= n.left - 1 && r.right <= n.right + 1;
    });
    const linhas = new Set(itens.map(el => Math.round(el.getBoundingClientRect().top))).size;
    return {
        navVisivel: visivel(nav),
        barraMobile: visivel(document.querySelector('.nav-mobile-bar')),
        navRolaH: nav.scrollWidth > nav.clientWidth + 1,
        navRolaV: nav.scrollHeight > nav.clientHeight + 1,
        pagRolaH: de.scrollWidth > de.clientWidth + 1,
        itensDentro: dentro, linhas, qtd: itens.length
    };
});

console.log('\n== Sem rolagem horizontal em nenhuma resolução ==');
for (const w of [360, 375, 390, 414, 768, 1024, 1366, 1920]) {
    const pg = await abrir(w);
    const m = await medir(pg);
    const modo = m.barraMobile ? 'gaveta' : `abas (${m.linhas} linha${m.linhas > 1 ? 's' : ''})`;
    checa(`${String(w).padStart(4)}px — ${modo}`,
        !m.pagRolaH && !m.navRolaH && !m.navRolaV && (m.barraMobile || (m.itensDentro && m.qtd === 9)),
        `pág rola H: ${m.pagRolaH ? 'SIM' : 'não'} · menu rola H: ${m.navRolaH ? 'SIM' : 'não'} · V: ${m.navRolaV ? 'SIM' : 'não'}`);
    if (w === 1920 || w === 1366 || w === 1024) await pg.locator('#main-nav').screenshot({ path: `${SHOTS}/menu-${w}.png` });
    await pg.close();
}

console.log('\n== Breakpoints: quem aparece onde ==');
for (const [w, esperado] of [[767, 'gaveta'], [768, 'abas'], [1023, 'abas'], [1024, 'abas']]) {
    const pg = await abrir(w);
    const m = await medir(pg);
    checa(`${w}px usa ${esperado}`, esperado === 'gaveta' ? (m.barraMobile && !m.navVisivel) : (!m.barraMobile && m.navVisivel));
    await pg.close();
}

console.log('\n== Gaveta no mobile (390px) ==');
const pg = await abrir(390, 760);
checa('abas tradicionais escondidas', !(await pg.isVisible('#main-nav')));
checa('barra mobile visível', await pg.isVisible('.nav-mobile-bar'));
checa('mostra onde você está', (await pg.textContent('#mobile-current-tab')).trim() === 'Dashboard');
const alvoBtn = await pg.locator('#mobile-menu-btn').boundingBox();
checa('área de toque confortável', alvoBtn.width >= 44 && alvoBtn.height >= 44, `${Math.round(alvoBtn.width)}×${Math.round(alvoBtn.height)}`);
checa('gaveta começa fechada', (await pg.evaluate(() => getComputedStyle(document.getElementById('mobile-drawer')).visibility)) === 'hidden');

await pg.click('#mobile-menu-btn'); await pg.waitForTimeout(500);
checa('abre ao tocar no hambúrguer', await pg.evaluate(() => document.getElementById('mobile-drawer').classList.contains('open')));
checa('aria-expanded atualizado', (await pg.getAttribute('#mobile-menu-btn', 'aria-expanded')) === 'true');
const itensGaveta = await pg.$$eval('#mobile-drawer-items .drawer-item', els => els.map(e => e.textContent.trim()));
checa('exibe as 9 abas', itensGaveta.length === 9, itensGaveta.join(', '));
const grupos = await pg.$$eval('.drawer-group-btn', els => els.map(e => e.textContent.trim()));
checa('tem submenus agrupados', grupos.length === 3, grupos.join(' | '));
const caixa = await pg.locator('#mobile-drawer').boundingBox();
checa('não ultrapassa a tela', caixa.x >= 0 && caixa.x + caixa.width <= 390, `x=${Math.round(caixa.x)} w=${Math.round(caixa.width)}`);
const alvoItem = await pg.locator('#mobile-drawer-items .drawer-item').first().boundingBox();
checa('itens com alvo de toque ≥44px', alvoItem.height >= 44, `${Math.round(alvoItem.height)}px`);
checa('fundo travado enquanto aberta', (await pg.evaluate(() => document.body.style.overflow)) === 'hidden');
checa('sem rolagem horizontal com a gaveta aberta',
    !(await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)));
await pg.screenshot({ path: `${SHOTS}/gaveta-aberta.png` });

console.log('\n== Submenus expansíveis ==');
await pg.click('.drawer-group-btn[data-group="1"]'); await pg.waitForTimeout(350);
checa('recolhe o grupo', await pg.evaluate(() => document.getElementById('drawer-group-1').hidden));
checa('aria-expanded false', (await pg.getAttribute('.drawer-group-btn[data-group="1"]', 'aria-expanded')) === 'false');
await pg.click('.drawer-group-btn[data-group="1"]'); await pg.waitForTimeout(350);
checa('expande de novo', !(await pg.evaluate(() => document.getElementById('drawer-group-1').hidden)));

console.log('\n== Navegar pela gaveta ==');
await pg.click('#mobile-drawer-items .drawer-item[data-goto="people"]'); await pg.waitForTimeout(1600);
checa('troca de página', await pg.isVisible('#people-page'));
checa('gaveta fecha ao navegar', !(await pg.evaluate(() => document.getElementById('mobile-drawer').classList.contains('open'))));
checa('título da barra acompanha', (await pg.textContent('#mobile-current-tab')).trim() === 'Pessoas');
checa('fundo destravado', (await pg.evaluate(() => document.body.style.overflow)) === '');
await pg.click('#mobile-menu-btn'); await pg.waitForTimeout(450);
checa('item ativo destacado', (await pg.getAttribute('#mobile-drawer-items .drawer-item[data-goto="people"]', 'class')).includes('active'));

console.log('\n== Formas de fechar ==');
await pg.click('#mobile-drawer-backdrop', { position: { x: 360, y: 400 } }); await pg.waitForTimeout(450);
checa('fecha ao tocar fora', !(await pg.evaluate(() => document.getElementById('mobile-drawer').classList.contains('open'))));
await pg.click('#mobile-menu-btn'); await pg.waitForTimeout(450);
await pg.click('#mobile-drawer-close'); await pg.waitForTimeout(450);
checa('fecha no X', !(await pg.evaluate(() => document.getElementById('mobile-drawer').classList.contains('open'))));
await pg.click('#mobile-menu-btn'); await pg.waitForTimeout(450);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(450);
checa('fecha no Esc', !(await pg.evaluate(() => document.getElementById('mobile-drawer').classList.contains('open'))));

console.log('\n== Redimensionar a janela ==');
await pg.click('#mobile-menu-btn'); await pg.waitForTimeout(450);
await pg.setViewportSize({ width: 1280, height: 820 }); await pg.waitForTimeout(700);
checa('gaveta fecha ao virar desktop', !(await pg.evaluate(() => document.getElementById('mobile-drawer').classList.contains('open'))));
checa('abas voltam', await pg.isVisible('#main-nav'));
checa('rolagem do corpo liberada', (await pg.evaluate(() => document.body.style.overflow)) === '');
await pg.setViewportSize({ width: 390, height: 760 }); await pg.waitForTimeout(700);
checa('volta para a gaveta', await pg.isVisible('.nav-mobile-bar') && !(await pg.isVisible('#main-nav')));

console.log('\n== Navegação do desktop preservada ==');
await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(700);
for (const t of ['details', 'cards', 'people', 'investments', 'goals', 'reports', 'projection', 'settings', 'dashboard']) {
    await pg.click(`.nav-tab[data-tab="${t}"]`); await pg.waitForTimeout(700);
    if (!(await pg.isVisible(`#${t}-page`))) { checa(`aba ${t} abre`, false); }
}
checa('todas as 9 abas navegam', true);
await pg.close();

console.log('\n== Erros de página ==');
checa('nenhum erro de JS', erros.length === 0, erros.slice(0, 3).join(' | '));
console.log(`\n${total - falhas}/${total} verificações passaram.`);
await b.close();
process.exit(falhas ? 1 : 0);

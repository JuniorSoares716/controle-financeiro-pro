/* Monta testes/.tmp/app.html: o index-teste-local.html com os CDNs trocados por
   cópias locais. Não é frescura de ambiente — é o que torna o teste determinístico.
   Com CDN, uma lentidão da Cloudflare viraria "teste falhou" e você perderia a
   manhã procurando um bug que não existe.
   */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join } from 'path';
import { RAIZ, TMP, APP_HTML, SHOTS } from './caminhos.mjs';

mkdirSync(SHOTS, { recursive: true });

/* Os arquivos locais ficam ao lado do app.html, porque o HTML os referencia por
   caminho relativo. Copiamos só os três pacotes que a página carrega — node_modules
   inteiro levaria o Playwright e os navegadores junto. */
const NM = join(RAIZ, 'node_modules');
for (const pkg of ['chart.js', '@fortawesome/fontawesome-free', '@fontsource/inter']) {
    const de = join(NM, pkg);
    if (!existsSync(de)) {
        console.error(`Falta a dependência ${pkg}. Rode: npm install`);
        process.exit(1);
    }
    cpSync(de, join(TMP, 'node_modules', pkg), { recursive: true, dereference: true, force: true });
}

let src = readFileSync(join(RAIZ, 'index-teste-local.html'), 'utf8');
src = src.replace(
    /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>[\s\S]*?<\/script>/,
    '<link rel="stylesheet" href="tw.css">');
src = src.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
    '<script src="node_modules/chart.js/dist/chart.umd.js"></script>');
src = src.replace(/<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^>]*\/?>/,
    '<link rel="stylesheet" href="node_modules/@fortawesome/fontawesome-free/css/all.min.css">');
src = src.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/,
    [400, 500, 600, 700].map(w => `<link rel="stylesheet" href="node_modules/@fontsource/inter/${w}.css">`).join(''));

for (const [cdn, nome] of [['cdn.tailwindcss.com', 'Tailwind'], ['cdn.jsdelivr.net', 'Chart.js'],
                           ['cdnjs.cloudflare.com', 'FontAwesome'], ['fonts.googleapis.com/css2', 'Google Fonts']]) {
    if (src.includes(cdn)) { console.error(`o CDN do ${nome} ficou no app.html — o index mudou de forma?`); process.exit(1); }
}
if (!src.includes('const DEMO_MODE = true')) {
    console.error('index-teste-local.html não está em DEMO_MODE — regenere-o a partir do index.html');
    process.exit(1);
}
writeFileSync(APP_HTML, src, 'utf8');

console.log('app.html pronto em testes/.tmp/, com os CDNs locais');

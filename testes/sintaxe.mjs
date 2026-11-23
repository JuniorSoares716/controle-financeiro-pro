/* Primeira barreira, e a mais barata: roda em segundos e pega o erro que mais
   dói — um arquivo publicado que nem carrega. Verifica, nos dois HTML e no
   serviço, se o JavaScript é válido; se as tags fecham; e se o index-teste-local
   é mesmo o index com DEMO_MODE ligado, nada além disso. */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { RAIZ, TMP } from './caminhos.mjs';

mkdirSync(TMP, { recursive: true });
let falhas = 0;
const ok = (m) => console.log(`  ok  ${m}`);
const erro = (m) => { falhas++; console.log(`  FALHOU ${m}`); };

const moduloDe = (html) => {
    const abre = html.indexOf('<script type="module">');
    if (abre < 0) return null;
    const ini = abre + '<script type="module">'.length;
    return html.slice(ini, html.indexOf('</script>', ini));
};
const contar = (html, re) => (html.match(re) || []).length;

const arquivos = ['index.html', 'index-teste-local.html'];
const conteudos = {};

for (const nome of arquivos) {
    const html = readFileSync(join(RAIZ, nome), 'utf8');
    conteudos[nome] = html;
    const mod = moduloDe(html);
    if (!mod) { erro(`${nome}: não achei o <script type="module">`); continue; }
    const tmp = join(TMP, nome.replace('.html', '.mjs'));
    writeFileSync(tmp, mod, 'utf8');
    try {
        execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
        ok(`${nome}: JavaScript válido`);
    } catch (e) {
        erro(`${nome}: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' ')}`);
    }
    const abertas = contar(html, /<div[\s>]/g), fechadas = contar(html, /<\/div>/g);
    if (abertas === fechadas) ok(`${nome}: ${abertas} <div> equilibradas`);
    else erro(`${nome}: ${abertas} <div> abertas contra ${fechadas} fechadas`);
}

try {
    execFileSync(process.execPath, ['--check', join(RAIZ, 'enviar-notificacoes.js')], { stdio: 'pipe' });
    ok('enviar-notificacoes.js: JavaScript válido');
} catch (e) {
    erro(`enviar-notificacoes.js: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' ')}`);
}

/* Paridade: index-teste-local.html é o index.html com uma única linha trocada.
   Qualquer outra diferença significa que alguém editou um e esqueceu o outro,
   e aí o que você testa não é o que você publica. */
const a = conteudos['index.html'], b = conteudos['index-teste-local.html'];
if (a && b) {
    if (!a.includes('const DEMO_MODE = false;')) erro('index.html deveria ter DEMO_MODE = false');
    else if (!b.includes('const DEMO_MODE = true;')) erro('index-teste-local.html deveria ter DEMO_MODE = true');
    else if (b.split('const DEMO_MODE = true;').join('const DEMO_MODE = false;') === a)
        ok('paridade: os dois arquivos diferem apenas no DEMO_MODE');
    else erro('os dois arquivos divergem em mais do que o DEMO_MODE — regenere o index-teste-local.html');
}

console.log(falhas ? `\n${falhas} verificação(ões) de sintaxe falharam.` : '\nSintaxe e paridade: tudo certo.');
process.exit(falhas ? 1 : 0);

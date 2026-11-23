/* Executa as suítes e resume. Cada suíte roda em um processo próprio, para que
   uma que derrube o Node não leve as outras com ela. O resumo no fim é o que
   você lê no GitHub sem abrir o log inteiro.

   Uso:  node testes/rodar.mjs logica
         node testes/rodar.mjs navegador
         node testes/rodar.mjs            (as duas)
         node testes/rodar.mjs navegador smoke-arvore     (uma só)
*/
import { readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { TESTES } from './caminhos.mjs';

const GRUPOS = { logica: 'teste-', navegador: 'smoke' };
const [grupoPedido, filtro] = process.argv.slice(2);
const grupos = grupoPedido ? [grupoPedido] : Object.keys(GRUPOS);

for (const g of grupos) {
    if (!GRUPOS[g]) { console.error(`grupo desconhecido: ${g} (use ${Object.keys(GRUPOS).join(' ou ')})`); process.exit(2); }
}

const suites = grupos.flatMap(g => readdirSync(TESTES)
    .filter(f => f.startsWith(GRUPOS[g]) && f.endsWith('.mjs'))
    .filter(f => !filtro || f.includes(filtro))
    .sort()
    .map(f => ({ grupo: g, arquivo: f })));

if (!suites.length) { console.error('nenhuma suíte encontrada com esse filtro'); process.exit(2); }

const resultados = [];
let verificacoes = 0;

for (const { grupo, arquivo } of suites) {
    console.log(`\n${'='.repeat(64)}\n${grupo} · ${arquivo}\n${'='.repeat(64)}`);
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [join(TESTES, arquivo)], { encoding: 'utf8' });
    const saida = (r.stdout || '') + (r.stderr || '');
    process.stdout.write(saida);
    // as suítes terminam com "N/M verificações passaram." ou "N/M cenários passaram."
    const m = /(\d+)\/(\d+) (?:verificações|cenários) passaram/.exec(saida);
    if (m) verificacoes += Number(m[2]);
    resultados.push({
        arquivo, grupo,
        ok: r.status === 0,
        placar: m ? `${m[1]}/${m[2]}` : (r.status === 0 ? 'ok' : 'erro'),
        seg: ((Date.now() - t0) / 1000).toFixed(1)
    });
}

const falhou = resultados.filter(r => !r.ok);
console.log(`\n${'='.repeat(64)}\nRESUMO\n${'='.repeat(64)}`);
for (const r of resultados) {
    console.log(`${r.ok ? ' PASSOU ' : ' FALHOU '} ${r.arquivo.padEnd(24)} ${r.placar.padStart(8)}  ${r.seg}s`);
}
console.log(`\n${resultados.length - falhou.length}/${resultados.length} suíte(s) passaram · ${verificacoes} verificações no total`);
if (falhou.length) console.log(`\nFalharam: ${falhou.map(r => r.arquivo).join(', ')}`);
process.exit(falhou.length ? 1 : 0);

/* Extrai, do <script type="module"> do index.html, as funções que os testes de
   lógica exercitam — por balanceamento de delimitadores, respeitando strings e
   templates. O ponto é testar o código que está mesmo no sistema, não uma cópia
   que pode envelhecer em silêncio. */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RAIZ, ALVO } from './caminhos.mjs';

const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
const abre = html.indexOf('<script type="module">');
if (abre < 0) { console.error('não achei o <script type="module"> no index.html'); process.exit(1); }
const ini = abre + '<script type="module">'.length;
const mod = html.slice(ini, html.indexOf('</script>', ini));

const extrai = (nome) => {
    const re = new RegExp('^[ \\t]*const ' + nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' = ', 'm');
    const m = re.exec(mod);
    if (!m) { console.error('não achei: ' + nome); process.exit(1); }
    const i = m.index;
    let j = i + m[0].length, prof = 0, str = null;
    while (j < mod.length) {
        const c = mod[j];
        if (str) {
            if (c === '\\') { j += 2; continue; }
            if (c === str) str = null;
            j++; continue;
        }
        if (c === '"' || c === "'" || c === '`') { str = c; j++; continue; }
        if (c === '(' || c === '[' || c === '{') prof++;
        else if (c === ')' || c === ']' || c === '}') prof--;
        else if (c === ';' && prof === 0) return mod.slice(i, j + 1);
        j++;
    }
    console.error('fim inesperado em ' + nome); process.exit(1);
};

const ALVOS = ['MESES_SYS', 'getCards', 'getPlans', 'findCard', 'getPeople', 'findPerson',
    'nomePessoa', 'planosDaPessoa', 'isoDate', 'hojeLocalISO', 'shiftDueDate', 'dayOfDue',
    'horizonteProjecao', 'mesSelecionadoIdx', 'mesAtualIdx', 'fimDaAssinatura', 'ehAssinatura',
    'assinaturaAtiva', 'planInstallments', 'parcelaCobravel', 'parcelasCobraveis',
    'posMes', 'parcelasDoMes', 'faturaDoMes', 'parcelasTerceirosDoMes', 'terceirosDoMes',
    'parcelasPropriasDoMes', 'custoProprio', 'somaPropria', 'terceirosDaDespesa',
    'terceirosPorPessoa', 'parcelasEmAberto', 'usoDoCartao', 'recalculateSummaries',
    'chaveMes', 'recebimentoDe', 'posHojeMes', 'cicloDoCartao', 'vencimentoParcela',
    'vencimentoDaFatura', 'faturasParaRealinhar', 'realinharFaturas', 'withDue',
    'vencimentoAncora', 'vencimentosDoPlano', 'vencimentoEfetivo', 'situacaoParcela',
    'extratoPessoa', 'doMesDaPessoa', 'resumoTerceiros', 'terceirosPrevistosNoMes',
    'projNextMonths', 'projWeightedAvg', 'projLinearFit', 'projForecast',
    'projExpensesOf', 'projExpensesFullOf', 'projIncomeOf', 'projHistory', 'projetarMeses'];

const corpo = ALVOS.map(extrai).map(p => p.trim()).join('\n');
const cabeca = 'export let database = {};\nexport const setDb = (d) => { database = d; };\n';
const rodape = '\nexport { ' + ALVOS.filter(n => n !== 'MESES_SYS').join(', ') + ', MESES_SYS };\n';
writeFileSync(ALVO, cabeca + corpo + rodape, 'utf8');
console.log(`extraído: ${ALVOS.length} funções, ${corpo.length} bytes de código real do index.html`);

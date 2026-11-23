import * as S from './alvo.mjs';

let falhas = 0, total = 0;
const eq = (nome, obtido, esperado) => {
    total++;
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) { falhas++; console.log(`  FALHOU ${nome}: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`); }
    else console.log(`  ok  ${nome} = ${JSON.stringify(obtido)}`);
};
const HOJE = S.hojeLocalISO();
console.log('hoje =', HOJE);

const C6 = 'c6', DAN = 'p_dan';
const vazio = () => ({ summary: [], expenseCategories: [], budgets: [], monthlyIncomes: {},
    monthlyDetails: Object.fromEntries(S.MESES_SYS.map(m => [m, { expenses: [] }])) });
/* A competência é parâmetro porque os cenários precisam ser relativos a hoje:
   com mês fixo, o primeiro vencimento vira passado com a passagem do tempo e o
   teste acusa "atrasada" numa parcela que o código trata certo. */
const montar = ({ fecha = 10, vence = 11, faturas = {}, mes = 'Outubro', ano = '2026' } = {}) => {
    const db = {
        appSettings: {
            cards: [{ id: C6, name: 'C6 Bank', limit: 20000, closingDay: fecha, dueDay: vence }],
            people: [{ id: DAN, name: 'Daniel', phone: '', createdAt: '2026-10-01' }],
            installmentPlans: [{ id: 'pl', cardId: C6, description: 'Teste', installmentValue: 50,
                totalInstallments: 3, firstMonth: mes, firstYear: String(ano), personId: DAN, recebimentos: {} }]
        }
    };
    const base = parseInt(ano, 10);
    for (const y of [base - 1, base, base + 1, base + 2]) db[y] = vazio();
    Object.entries(faturas).forEach(([m, lista]) => { db[base].monthlyDetails[m] = { expenses: lista }; });
    return db;
};
const fat = (dueDate, valor = 420) => [{ id: 'f_' + dueDate, name: 'Fatura C6', cardId: C6, value: valor, paid: false,
    dueDate, due: dueDate ? Number(dueDate.split('-')[2]) : null }];
const vencs = () => S.vencimentosDoPlano(S.getPlans()[0]).map(i => i.venc);
const sits = () => S.planInstallments(S.getPlans()[0]).map(i => S.situacaoParcela(S.getPlans()[0], i));
const ordenado = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);

console.log('\n== 1. O caso relatado: competência num mês, fatura vencendo no seguinte ==');
/* Vencimento 25 dias à frente: a 1ª parcela está sempre no futuro, hoje e daqui
   a um ano. A competência é o mês anterior ao do vencimento. */
const alvo = (() => { const x = new Date(); x.setDate(x.getDate() + 25); return x; })();
const idxVenc = alvo.getFullYear() * 12 + alvo.getMonth();
const compMes = S.MESES_SYS[(idxVenc - 1 + 1200) % 12];
const compAno = String(Math.floor((idxVenc - 1) / 12));
const iso = (ym, dia) => `${Math.floor(ym / 12)}-${String(ym % 12 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
// 28 no máximo: dia 29/30/31 encosta no fim de mês curto e o vencimento é aparado
const diaV = Math.min(28, alvo.getDate());
S.setDb(montar({ mes: compMes, ano: compAno, faturas: { [compMes]: fat(iso(idxVenc, diaV)) } }));
eq('vencimentos seguem o ciclo do cartão', vencs(),
    [iso(idxVenc, diaV), iso(idxVenc + 1, diaV), iso(idxVenc + 2, diaV)]);
eq('nenhuma inversão', ordenado(vencs()), true);
eq('situações', sits(), ['pendente', 'pendente', 'pendente']);
eq('a 2ª não fica atrasada com a 1ª em dia', sits()[1] === 'atrasada' && sits()[0] === 'pendente', false);

console.log('\n== 2. Sem fatura nenhuma: deduz do cartão ==');
S.setDb(montar());                       // fecha 10, vence 11 -> vence no próprio mês
eq('vence no mês da competência', vencs(), ['2026-10-11', '2026-11-11', '2026-12-11']);
eq('ordem preservada', ordenado(vencs()), true);

console.log('\n== 3. Vencimento antes do fechamento: rola para o mês seguinte ==');
S.setDb(montar({ fecha: 25, vence: 5 })); // fecha 25, vence 5 -> só paga no mês seguinte
eq('competência Outubro vence em Novembro', vencs(), ['2026-11-05', '2026-12-05', '2027-01-05']);
eq('ordem preservada', ordenado(vencs()), true);

console.log('\n== 4. Cartão sem dia de vencimento ==');
S.setDb(montar({ fecha: null, vence: null }));
eq('cai no último dia de cada mês', vencs(), ['2026-10-31', '2026-11-30', '2026-12-31']);

console.log('\n== 5. Aprende com a fatura mais próxima, em qualquer direção ==');
S.setDb(montar({ faturas: { Dezembro: fat('2027-01-15') } }));   // só a de Dezembro existe
eq('offset e dia vêm dela', vencs(), ['2026-11-15', '2026-12-15', '2027-01-15']);
S.setDb(montar({ faturas: { Novembro: fat('2026-11-08') } }));   // vence no próprio mês
eq('offset zero quando a fatura vence no mês dela', vencs(), ['2026-10-08', '2026-11-08', '2026-12-08']);

console.log('\n== 6. Todas as faturas lançadas: cada uma manda na sua ==');
S.setDb(montar({ faturas: { Outubro: fat('2026-11-10'), Novembro: fat('2026-12-10'), Dezembro: fat('2027-01-10') } }));
eq('usa o que está lançado', vencs(), ['2026-11-10', '2026-12-10', '2027-01-10']);

console.log('\n== 7. Datas irregulares: a cadência mensal prevalece ==');
// usuário digitou a fatura de Novembro vencendo ANTES da de Outubro
S.setDb(montar({ faturas: { Outubro: fat('2026-12-20'), Novembro: fat('2026-11-01'), Dezembro: fat('2027-01-20') } }));
const v7 = vencs();
eq('âncora na 1ª parcela, um mês entre cada', v7, ['2026-12-20', '2027-01-20', '2027-02-20']);
eq('faturas fora de cadência são ignoradas', ordenado(v7), true);
const s7 = sits();
eq('não existe atrasada depois de pendente', s7.indexOf('pendente') === -1 || s7.lastIndexOf('atrasada') < s7.indexOf('pendente'), true);

console.log('\n== 8. Recebida continua recebida, qualquer que seja a data ==');
const comRec = montar({ faturas: { Outubro: fat('2026-10-01') } });
comRec.appSettings.installmentPlans[0].recebimentos = { '2026-10': { recebido: true, data: '2026-10-05' } };
S.setDb(comRec);
eq('1ª recebida', sits()[0], 'recebida');

console.log('\n== 9. Nenhum atraso aparece antes de um pendente, em 4 cenários ==');
[{}, { fecha: 25, vence: 5 }, { faturas: { Outubro: fat('2026-11-20') } },
 { faturas: { Outubro: fat('2026-12-20'), Novembro: fat('2026-11-01') } }].forEach((cfg, n) => {
    S.setDb(montar(cfg));
    const s = sits().filter(x => x !== 'recebida');
    const primeiroPendente = s.indexOf('pendente');
    const ok = primeiroPendente === -1 || !s.slice(primeiroPendente).includes('atrasada');
    eq(`cenário ${n + 1} sem inversão`, ok, true);
});

console.log('\n== 10. Virada de ano e fim de mês ==');
S.setDb(montar({ fecha: 20, vence: 31 }));
eq('dia 31 em novembro vira 30', vencs()[1], '2026-11-30');
const anoVirada = montar({ fecha: 25, vence: 5 });
anoVirada.appSettings.installmentPlans[0].firstMonth = 'Novembro';
S.setDb(anoVirada);
eq('Nov/Dez/Jan atravessa o ano', vencs(), ['2026-12-05', '2027-01-05', '2027-02-05']);

console.log('\n== 11. Cadência mensal (o caso relatado) ==');
/* Datas relativas a hoje, e não fixas: com datas absolutas estes cenários passam a
   reprovar sozinhos quando a data do sistema avança. A fatura da 1ª parcela vence
   daqui a 6 dias; a da 2ª está lançada no MESMO mês dela, fora de cadência. */
const d = new Date();
const isoRel = (dias) => { const x = new Date(d); x.setDate(x.getDate() + dias);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const mesDe = (iso) => S.MESES_SYS[parseInt(iso.slice(5, 7), 10) - 1];
const anoDe = (iso) => iso.slice(0, 4);
// a 1ª parcela tem competência no mês ANTERIOR ao vencimento, como num cartão real
const vencFuturo = isoRel(6);                     // ainda vai vencer
const compet1 = (() => { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() - 1); return x; })();
const mes1 = S.MESES_SYS[compet1.getMonth()], ano1 = String(compet1.getFullYear());
const mes2 = mesDe(vencFuturo), ano2 = anoDe(vencFuturo);
/* Fixture acumulativo: literais com duas chaves de ano iguais descartariam a primeira,
   e aqui competência e vencimento caem no mesmo ano com frequência. */
const anoVazio = () => ({ summary: [], expenseCategories: [], budgets: [], monthlyIncomes: {}, monthlyDetails: {} });
const planoRel = (faturas = []) => {
    const db = {
        appSettings: {
            cards: [{ id: C6, name: 'C6 Bank', limit: 20000, closingDay: 10, dueDay: Number(vencFuturo.slice(8)) }],
            people: [{ id: DAN, name: 'Daniel', phone: '', createdAt: '2026-10-01' }],
            installmentPlans: [{ id: 'pl', cardId: C6, description: 'Teste', installmentValue: 50,
                totalInstallments: 3, firstMonth: mes1, firstYear: ano1, personId: DAN, recebimentos: {} }]
        }
    };
    [2026, 2027, 2028].forEach(y => { db[y] = anoVazio(); });
    faturas.forEach(({ ano, mes, expenses }) => {
        db[ano] = db[ano] || anoVazio();
        db[ano].monthlyDetails[mes] = { expenses };
    });
    return db;
};
const umMesDepois = (iso) => { const [y, m, dd] = iso.split('-').map(Number);
    const x = new Date(y, m - 1 + 1, dd); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

// fatura da competência 1 vence no mês seguinte; a da competência 2 está lançada no mês dela (fora de cadência)
S.setDb(planoRel([{ ano: ano1, mes: mes1, expenses: fat(vencFuturo) },
                  { ano: ano2, mes: mes2, expenses: fat(isoRel(7)) }]));
const v11 = S.vencimentosDoPlano(S.getPlans()[0]).map(i => i.venc);
eq('âncora é a fatura da 1ª parcela', v11[0], vencFuturo);
eq('um mês entre a 1ª e a 2ª, não um dia', v11[1], umMesDepois(vencFuturo));
eq('a 2ª não cai no mesmo mês da 1ª', v11[0].slice(0, 7) !== v11[1].slice(0, 7), true);
eq('fatura fora de cadência ignorada', v11[1] !== isoRel(7), true);
eq('nenhuma atrasada: todas vencem a partir de hoje', S.planInstallments(S.getPlans()[0])
    .map(i => S.situacaoParcela(S.getPlans()[0], i)), ['pendente', 'pendente', 'pendente']);

console.log('\n== 12. Fatura em cadência é respeitada ==');
// agora a fatura da 2ª parcela está lançada no mês que a cadência prevê, com outro dia
const emCadencia = umMesDepois(vencFuturo).slice(0, 8) + '28';
S.setDb(planoRel([{ ano: ano1, mes: mes1, expenses: fat(vencFuturo) }]));
const planoBase = JSON.parse(JSON.stringify(S.database));
const compet2 = (() => { const x = new Date(compet1); x.setMonth(x.getMonth() + 1); return x; })();
planoBase[String(compet2.getFullYear())] = planoBase[String(compet2.getFullYear())]
    || { summary: [], expenseCategories: [], budgets: [], monthlyIncomes: {}, monthlyDetails: {} };
planoBase[String(compet2.getFullYear())].monthlyDetails[S.MESES_SYS[compet2.getMonth()]] = { expenses: fat(emCadencia) };
S.setDb(planoBase);
eq('usa o dia real da fatura daquele mês', S.vencimentosDoPlano(S.getPlans()[0]).map(i => i.venc)[1], emCadencia);

console.log('\n== 13. Mudar o dia de vencimento do cartão ==');
S.setDb(planoRel([{ ano: ano1, mes: mes1, expenses: fat(vencFuturo) },
                  { ano: ano2, mes: mes2, expenses: fat(isoRel(7)) }]));
const cartao13 = S.findCard(C6);
const novoDia = Number(isoRel(9).slice(8));
cartao13.dueDay = novoDia;
const alvo13 = S.faturasParaRealinhar(S.database, cartao13);
eq('realinha as faturas ainda por vencer', alvo13.length, 2);
eq('mantém o mês de cada uma, troca só o dia',
   alvo13.every(a => a.novo.slice(0, 7) === a.expense.dueDate.slice(0, 7) && Number(a.novo.slice(8)) === novoDia), true);
eq('nenhuma já vencida entrou', alvo13.every(a => a.expense.dueDate >= HOJE), true);
S.realinharFaturas(alvo13);
const v13 = S.vencimentosDoPlano(S.getPlans()[0]).map(i => i.venc);
eq('cadência segue mensal depois do realinhamento',
   [v13[1] === umMesDepois(v13[0]), v13[2] === umMesDepois(v13[1])], [true, true]);

console.log('\n== 14. Realinhamento não mexe em fatura já vencida ou paga ==');
// -60 dias cai dois meses atrás, sem colidir com o mês da 1ª parcela
const vencido = isoRel(-60), paga = isoRel(12);
S.setDb(planoRel([
    { ano: ano1, mes: mes1, expenses: fat(vencFuturo) },
    { ano: anoDe(vencido), mes: mesDe(vencido), expenses: fat(vencido) },
    { ano: anoDe(paga), mes: mesDe(paga), expenses: [{ id: 'fp', name: 'Fatura C6', cardId: C6, value: 300, paid: true, dueDate: paga, due: Number(paga.slice(8)) }] }
]));
const c14 = S.findCard(C6); c14.dueDay = 20;
const alvo14 = S.faturasParaRealinhar(S.database, c14);
eq('a já vencida fica de fora', alvo14.some(a => a.expense.dueDate < HOJE), false);
eq('a paga fica de fora', alvo14.some(a => a.expense.paid), false);
eq('a que ainda vai vencer entra', alvo14.some(a => a.expense.dueDate === vencFuturo), true);

console.log(`\n${total - falhas}/${total} cenários passaram.`);
process.exit(falhas ? 1 : 0);

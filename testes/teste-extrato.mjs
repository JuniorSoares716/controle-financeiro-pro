import * as S from './alvo.mjs';

let falhas = 0, total = 0;
const eq = (nome, obtido, esperado) => {
    total++;
    const ok = (typeof obtido === 'number' && typeof esperado === 'number')
        ? Math.abs(obtido - esperado) < 0.005
        : JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) { falhas++; console.log(`  FALHOU ${nome}: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`); }
    else console.log(`  ok  ${nome} = ${JSON.stringify(obtido)}`);
};

// Hoje é Novembro/2026 nesta sessão. Agosto, Setembro e Outubro já passaram.
const hoje = new Date();
const MES_HOJE = S.MESES_SYS[hoje.getMonth()], ANO_HOJE = String(hoje.getFullYear());
console.log(`(mês corrente de calendário: ${MES_HOJE}/${ANO_HOJE})`);

const MARIANA = 'p_mari', PEDRO = 'p_pedro', NUBANK = 'c_nu', AMAZON = 'c_amz';

const montar = (recebimentosMari = {}) => ({
    appSettings: {
        cards: [{ id: NUBANK, name: 'Nubank', limit: 8000, closingDay: 25, dueDay: 10 },
                { id: AMAZON, name: 'Amazon', limit: 3000, closingDay: 18, dueDay: 28 }],
        people: [{ id: MARIANA, name: 'Mariana', phone: '11999998888', createdAt: '2026-08-01' },
                 { id: PEDRO, name: 'Pedro', phone: '', createdAt: '2026-10-01' }],
        installmentPlans: [
            // sua, para garantir que não aparece em extrato de ninguém
            { id: 'pl_meu', cardId: NUBANK, description: 'Notebook', installmentValue: 420,
              totalInstallments: 10, firstMonth: 'Março', firstYear: '2026', personId: null },
            // Mariana: 6x de 380 começando em Agosto/2026 -> Ago, Set, Out, Nov, Dez, Jan/27
            { id: 'pl_mari', cardId: NUBANK, description: 'Celular da Mariana', installmentValue: 380,
              totalInstallments: 6, firstMonth: 'Agosto', firstYear: '2026',
              personId: MARIANA, recebimentos: recebimentosMari },
            // Mariana no outro cartão: 3x de 100 começando em Novembro/2026
            { id: 'pl_mari2', cardId: AMAZON, description: 'Livros', installmentValue: 100,
              totalInstallments: 3, firstMonth: 'Novembro', firstYear: '2026',
              personId: MARIANA, recebimentos: {} },
            // Pedro: à vista de 150 em Outubro/2026 (mês já passado)
            { id: 'pl_pedro', cardId: NUBANK, description: 'Fone do Pedro', installmentValue: 150,
              totalInstallments: 1, firstMonth: 'Outubro', firstYear: '2026',
              personId: PEDRO, recebimentos: {} }
        ]
    },
    2026: { summary: [], expenseCategories: [], budgets: [], monthlyIncomes: {}, monthlyDetails: {} }
});

console.log('\n== 1. Chave do mês (compatível com o Firestore) ==');
S.setDb(montar());
eq('Janeiro vira 01', S.chaveMes('2026', 'Janeiro'), '2026-01');
eq('Dezembro vira 12', S.chaveMes('2026', 'Dezembro'), '2026-12');
const chaves = S.MESES_SYS.map(m => S.chaveMes('2026', m));
eq('nenhuma chave tem ponto', chaves.some(k => k.includes('.')), false);
eq('nenhuma chave começa/termina com __', chaves.some(k => k.startsWith('__') && k.endsWith('__')), false);

console.log('\n== 2. Situação da parcela: atrasada x pendente ==');
const planMari = S.getPlans().find(p => p.id === 'pl_mari');
const parcMari = S.planInstallments(planMari);
eq('1ª parcela é Agosto/2026', `${parcMari[0].month}/${parcMari[0].year}`, 'Agosto/2026');
eq('Agosto (passado, não recebido) = atrasada', S.situacaoParcela(planMari, parcMari[0]), 'atrasada');
const futura = parcMari.find(i => S.posMes(i.year, i.month) > S.posHojeMes());
eq('parcela futura = pendente', S.situacaoParcela(planMari, futura), 'pendente');
// RN-TER-17: o mês corrente depende do dia de vencimento do cartão, não da virada do mês
const doMesCorrente = parcMari.find(i => i.year === ANO_HOJE && i.month === MES_HOJE);
if (doMesCorrente) {
    const card = S.findCard(NUBANK);
    // fecha 25 e vence 10: a fatura do mês corrente só vence no mês seguinte
    eq(`fecha dia ${card.closingDay}, vence dia ${card.dueDay} — rola para o mês seguinte`,
       S.situacaoParcela(planMari, doMesCorrente), 'pendente');
    // vencimento depois do fechamento: paga no próprio mês, e esse dia já passou
    card.dueDay = 28; card.closingDay = 5;
    eq('fechando dia 5 e vencendo dia 28, vence no próprio mês', S.situacaoParcela(planMari, doMesCorrente), 'pendente');
    card.closingDay = 1; card.dueDay = 3;
    eq('fechando dia 1 e vencendo dia 3, já passou neste mês', S.situacaoParcela(planMari, doMesCorrente), 'atrasada');
    card.dueDay = 10; card.closingDay = 25;
}

console.log('\n== 3. Extrato da Mariana (dois cartões) ==');
let ext = S.extratoPessoa(MARIANA);
eq('duas compras', ext.compras.length, 2);
eq('total a receber (6x380 + 3x100)', ext.falta, 6 * 380 + 3 * 100);
eq('nada recebido ainda', ext.recebido, 0);
eq('atrasadas: Ago, Set e Out (Nov só vence em 10/12)', ext.qtdAtrasadas, 3);
eq('valor atrasado', ext.atrasado, 3 * 380);
eq('quebra por cartão tem os dois', ext.porCartao.length, 2);
eq('Nubank primeiro (maior)', ext.porCartao[0].card.name, 'Nubank');
eq('falta no Nubank', ext.porCartao[0].falta, 6 * 380);
eq('falta na Amazon', ext.porCartao[1].falta, 300);
eq('compra sua não entra no extrato dela',
   ext.compras.some(c => c.plan.description === 'Notebook'), false);

console.log('\n== 4. Marcar parcelas como recebidas ==');
S.setDb(montar({ '2026-08': { recebido: true, data: '2026-08-12' },
                 '2026-09': { recebido: true, data: '2026-09-11' } }));
ext = S.extratoPessoa(MARIANA);
eq('recebido 2x380', ext.recebido, 760);
eq('a receber cai para', ext.falta, 6 * 380 + 300 - 760);
eq('sobra 1 atrasada (Outubro)', ext.qtdAtrasadas, 1);
eq('valor atrasado', ext.atrasado, 380);
const compraCel = ext.compras.find(c => c.plan.id === 'pl_mari');
eq('guardou a data do recebimento', compraCel.parcelas[0].recebimento.data, '2026-08-12');
eq('parcela 1 marcada como recebida', compraCel.parcelas[0].situacao, 'recebida');
eq('seu + recebido = total da compra', compraCel.falta + 760, 6 * 380);

console.log('\n== 5. Compra quitada ==');
const todasMari = {};
S.MESES_SYS.slice(7).forEach(m => { todasMari[S.chaveMes('2026', m)] = { recebido: true, data: '2026-12-01' }; });
todasMari['2027-01'] = { recebido: true, data: '2027-01-05' };
S.setDb(montar(todasMari));
ext = S.extratoPessoa(MARIANA);
const cel = ext.compras.find(c => c.plan.id === 'pl_mari');
eq('celular quitado', cel.quitada, true);
eq('falta zero nessa compra', cel.falta, 0);
eq('compras quitadas vão para o fim da lista', ext.compras[0].plan.id, 'pl_mari2');
eq('ainda falta a outra compra', ext.falta, 300);
eq('sem atraso depois de quitar', ext.qtdAtrasadas, 0);

console.log('\n== 6. Recorte de um mês específico ==');
S.setDb(montar({ '2026-08': { recebido: true, data: '2026-08-12' } }));
const ago = S.doMesDaPessoa(MARIANA, '2026', 'Agosto');
eq('Agosto: uma parcela', ago.itens.length, 1);
eq('Agosto: total', ago.total, 380);
eq('Agosto: já recebido', ago.recebido, 380);
eq('Agosto: nada pendente', ago.pendentes, 0);
const nov = S.doMesDaPessoa(MARIANA, '2026', 'Novembro');
eq('Novembro: celular + livros', nov.itens.length, 2);
eq('Novembro: total 380 + 100', nov.total, 480);
eq('Novembro: nada recebido', nov.recebido, 0);
eq('mês sem parcela dela', S.doMesDaPessoa(MARIANA, '2026', 'Julho').total, 0);

console.log('\n== 7. Resumo geral dos terceiros ==');
const r = S.resumoTerceiros('2026', 'Outubro');
eq('duas pessoas com compras', r.pessoas.length, 2);
eq('quem tem atraso vem primeiro', r.pessoas[0].pessoa.name, 'Mariana');
eq('total em aberto (Mariana 2000 + Pedro 150)', r.falta, (6 * 380 - 380) + 300 + 150);
eq('em Outubro caem 380 + 150', r.noMes, 530);
eq('nada recebido em Outubro', r.recebidoNoMes, 0);
eq('atrasado soma as duas pessoas', r.atrasado, 380 * 2 + 150);

console.log('\n== 8. Pessoa sem compra não aparece no resumo ==');
const semCompra = montar();
semCompra.appSettings.people.push({ id: 'p_vazio', name: 'Ana', phone: '', createdAt: '2026-11-01' });
S.setDb(semCompra);
const r2 = S.resumoTerceiros('2026', 'Novembro');
eq('Ana fica de fora', r2.pessoas.some(x => x.pessoa.name === 'Ana'), false);
eq('extrato de Ana existe e é vazio', S.extratoPessoa('p_vazio').compras.length, 0);
eq('extrato de Ana não quebra', S.extratoPessoa('p_vazio').falta, 0);

console.log('\n== 9. Desfazer recebimento volta ao estado anterior ==');
const comRec = montar({ '2026-08': { recebido: true, data: '2026-08-12' } });
S.setDb(comRec);
const antes = S.extratoPessoa(MARIANA).falta;
delete comRec.appSettings.installmentPlans.find(p => p.id === 'pl_mari').recebimentos['2026-08'];
S.setDb(comRec);
eq('voltou a dever a parcela', S.extratoPessoa(MARIANA).falta, antes + 380);
eq('e voltou a ficar atrasada', S.extratoPessoa(MARIANA).qtdAtrasadas, 3);

console.log('\n== 10. Vencimento manda no atraso (RN-TER-17) ==');
S.setDb(montar());
const pMari = S.getPlans().find(p => p.id === 'pl_mari');
const parcNov = S.planInstallments(pMari).find(i => i.month === 'Novembro' && i.year === '2026');
const cartao = S.findCard(NUBANK);
eq('fecha 25 e vence 10: paga no mês seguinte', S.vencimentoParcela(pMari, parcNov), '2026-12-10');
cartao.dueDay = 28;
eq('mudou o cartão, mudou o vencimento', S.vencimentoParcela(pMari, parcNov), '2026-11-28');
eq('e a parcela deixa de estar atrasada', S.situacaoParcela(pMari, parcNov), 'pendente');
// fatura lançada tem precedência sobre o dia do cartão
S.database[2026].monthlyDetails['Novembro'] = { expenses: [
    { id: 'f1', name: 'Fatura Nubank', cardId: NUBANK, value: 3000, paid: false, dueDate: '2026-11-02', due: 2 }] };
eq('fatura lançada manda', S.vencimentoParcela(pMari, parcNov), '2026-11-02');
eq('e volta a estar atrasada', S.situacaoParcela(pMari, parcNov), 'atrasada');
S.database[2026].monthlyDetails['Novembro'].expenses[0].dueDate = '2026-11-30';
eq('realinhando a fatura, sai do atraso', S.situacaoParcela(pMari, parcNov), 'pendente');
// cartão sem dia de vencimento: cai para o fim do mês
cartao.dueDay = null;
S.database[2026].monthlyDetails['Novembro'] = { expenses: [] };
eq('sem dia no cartão, vence no fim do mês', S.vencimentoParcela(pMari, parcNov), '2026-11-30');
const parcFev = { year: '2027', month: 'Fevereiro' };
eq('fim de mês respeita fevereiro', S.vencimentoParcela(pMari, parcFev), '2027-02-28');
// recebida nunca aparece como atrasada, mesmo vencida
cartao.dueDay = 1;
pMari.recebimentos = { '2026-11': { recebido: true, data: '2026-11-01' } };
eq('recebida vence o atraso', S.situacaoParcela(pMari, parcNov), 'recebida');

console.log(`\n${total - falhas}/${total} cenários passaram.`);
process.exit(falhas ? 1 : 0);

/* O serviço de WhatsApp é CommonJS e importa firebase-admin — um pacote pesado e
   que não tem o que fazer num teste de função pura. A saída é colocar uma cópia do
   serviço ao lado de um dublê do firebase-admin: o require do Node procura
   node_modules subindo a partir do arquivo, encontra o dublê primeiro e nada toca
   no Firebase de verdade. */
import { cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { RAIZ, TESTES, TMP } from './caminhos.mjs';

export const prepararServico = () => {
    const base = join(TMP, 'stub');
    mkdirSync(base, { recursive: true });
    cpSync(join(TESTES, 'stub-firebase-admin'), join(base, 'node_modules', 'firebase-admin'),
        { recursive: true, force: true });
    cpSync(join(RAIZ, 'enviar-notificacoes.js'), join(base, 'enviar-notificacoes.js'), { force: true });
    return join(base, 'enviar-notificacoes.js');
};

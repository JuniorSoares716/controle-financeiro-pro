/* Único lugar que conhece o disco. Tudo é resolvido a partir deste arquivo, então
   a pasta do projeto pode estar em qualquer lugar — a sua máquina ou o runner do
   GitHub — sem nenhum caminho fixo espalhado pelos testes. */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

export const TESTES = dirname(fileURLToPath(import.meta.url));
export const RAIZ = dirname(TESTES);
export const TMP = join(TESTES, '.tmp');

export const APP_HTML = join(TMP, 'app.html');
export const APP_URL = 'file://' + APP_HTML;
export const DADOS = join(TESTES, 'dados-demo.json');
export const SHOTS = join(TMP, 'shots');
export const ALVO = join(TESTES, 'alvo.mjs');

// O playwright é devDependency na raiz do projeto
export const exigir = createRequire(join(RAIZ, 'package.json'));

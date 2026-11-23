# Controle Financeiro PRO — guia completo

| Campo | Valor |
|---|---|
| **Versão** | 2.5 |
| **Atualizado em** | Novembro/2026 |
| **Tempo estimado** | 50 a 70 minutos, do zero ao sistema no ar com testes rodando |

Este guia leva o sistema do seu computador até o ar, com os testes rodando
automaticamente a cada atualização de código. Cinco partes, na ordem:

| Parte | O que faz | Depende de |
|---|---|---|
| [1](#parte-1--subir-o-projeto-no-github) | Subir tudo para o GitHub | nada |
| [2](#parte-2--testes-automáticos-a-cada-atualização) | Testes rodando a cada push | Parte 1 |
| [3](#parte-3--criar-e-configurar-o-firebase) | Firebase: banco, login e hospedagem | Parte 1 |
| [4](#parte-4--configurar-o-sistema-depois-de-no-ar) | Configurar o sistema já rodando | Parte 3 |
| [5](#parte-5--notificações-por-whatsapp) | Avisos no WhatsApp | Partes 1 e 3 |

**Antes de começar, tenha instalado:**

- [Node.js](https://nodejs.org) 20 ou superior — confira com `node -v`
- [Git](https://git-scm.com) — confira com `git --version`
- Uma conta Google (para o Firebase) e uma conta GitHub

> **Por que o Node.js, se o sistema é um arquivo HTML?** O sistema não precisa dele
> para funcionar. O Node é para os testes (Parte 2) e para a ferramenta de publicação
> do Firebase (Parte 3).

---

## O que é cada arquivo

| Arquivo | O que é | Vai para |
|---|---|---|
| `index.html` | **É o sistema.** Tudo em um arquivo: HTML, CSS e JavaScript | GitHub e Firebase Hosting |
| `index-teste-local.html` | O mesmo arquivo com `DEMO_MODE = true`: abre com dados fictícios, sem login e sem Firebase | GitHub. **Nunca é publicado** |
| `enviar-notificacoes.js` | O serviço que manda as mensagens de WhatsApp. Roda no GitHub, não no navegador | GitHub |
| `testes/` | As 519 verificações automatizadas | GitHub |
| `package.json` / `package-lock.json` | Dizem ao GitHub quais ferramentas instalar para rodar os testes | GitHub |
| `firebase.json` | Diz ao Firebase o que publicar e, principalmente, **o que não publicar** | GitHub |
| `firestore.rules` | A regra que protege os seus dados | GitHub e Firebase |
| `.github/workflows/testes.yml` | Receita dos testes automáticos | GitHub |
| `.github/workflows/notificacoes.yml` | Receita do envio de WhatsApp | GitHub |
| `*.md` | Documentação (este guia, CHANGELOG, histórias de usuário) | GitHub |

**O único arquivo que vai para a internet é o `index.html`.** Todo o resto fica no
repositório ou é usado apenas pelas ferramentas.

---

# Parte 1 — Subir o projeto no GitHub

## 1.1 Criar o repositório

No GitHub, clique em **New repository**. Dê um nome (por exemplo
`controle-financeiro`), escolha **Public** ou **Private** e crie **sem** README,
`.gitignore` ou licença — esses arquivos já vêm no projeto e a duplicação só dá
conflito no primeiro push.

> **Público ou privado?** Os dois funcionam igual. O que protege os seus dados são
> as regras do Firestore (Parte 3.4) e os secrets do GitHub — nunca o sigilo do
> código. Se escolher privado, saiba que o GitHub Actions tem 2.000 minutos
> gratuitos por mês em repositórios privados; em públicos é ilimitado. Os testes
> consomem cerca de 7 minutos por push, o que dá folga para umas 280 atualizações
> mensais.

## 1.2 Conferir a estrutura

A pasta do projeto precisa estar assim:

```
controle-financeiro/
├─ .github/
│  └─ workflows/
│     ├─ testes.yml              ← Parte 2
│     └─ notificacoes.yml        ← Parte 5
├─ testes/
│  ├─ README.md
│  ├─ caminhos.mjs
│  ├─ extrair.mjs
│  ├─ preparar.mjs
│  ├─ rodar.mjs
│  ├─ sintaxe.mjs
│  ├─ stub.mjs
│  ├─ tailwind.config.cjs
│  ├─ in.css
│  ├─ dados-demo.json
│  ├─ stub-firebase-admin/
│  ├─ teste-ciclo.mjs ... (5 arquivos de lógica)
│  └─ smoke-arvore.mjs ... (11 arquivos de navegador)
├─ .gitignore
├─ index.html
├─ index-teste-local.html
├─ enviar-notificacoes.js
├─ firebase.json
├─ firestore.rules
├─ package.json
├─ package-lock.json
└─ GUIA-COMPLETO.md, CHANGELOG.md, HU-Controle-Financeiro-PRO.md, BACKLOG.md
```

Os dois arquivos `.yml` **precisam** estar em `.github/workflows/`. Fora dessa
pasta, o GitHub simplesmente os ignora — sem erro e sem aviso.

## 1.3 O `.gitignore` e por que ele importa

O projeto já vem com este `.gitignore`:

```gitignore
# NUNCA versionar credenciais
*serviceAccount*.json
*firebase-adminsdk*.json
.env

# Backups dos seus dados reais (o dado de teste é testes/dados-demo.json)
backup*.json

# Gerados
node_modules/
.firebase/
testes/.tmp/
testes/alvo.mjs
```

A primeira seção é a que mais importa. A chave de serviço do Firebase (Parte 3.6)
dá **acesso total ao seu banco de dados**, por cima de qualquer regra. Ela vive
apenas nos secrets do GitHub — nunca em um arquivo versionado, nunca em um
`index.html`, nunca em um print de tela.

> Se um dia você publicar uma chave por engano: apagar o arquivo e dar push **não
> resolve**, porque ela continua no histórico do Git. O caminho é revogar a chave no
> console do Firebase (Configurações → Contas de serviço) e gerar outra.

## 1.4 Primeiro envio

```bash
cd controle-financeiro

git init
git add .
git commit -m "Controle Financeiro PRO v2.5"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/controle-financeiro.git
git push -u origin main
```

Na primeira vez o GitHub pede autenticação. Se ele recusar a sua senha, é esperado:
senha de conta não serve mais para `git push`. Use um **Personal Access Token**
(GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
tokens), com permissão de **Contents: Read and write** no repositório, e cole o
token no lugar da senha.

## 1.5 Publicar atualizações, daqui em diante

```bash
git add .
git commit -m "descreva o que mudou"
git push
```

Esse `git push` é o gatilho da Parte 2: a partir dele, os testes rodam sozinhos.

---

# Parte 2 — Testes automáticos a cada atualização

## 2.1 O que vai rodar

São 519 verificações, em três camadas, organizadas em dois estágios no GitHub:

| Estágio | O que roda | Tempo | Para que serve |
|---|---|---|---|
| **Sintaxe e lógica** | Validação de sintaxe + 181 cenários de regra de negócio | ~40 segundos | Pegar o erro barato antes de gastar o caro |
| **Navegador** | 338 verificações no Chromium, em 14 suítes | ~6 minutos | Garantir que a tela funciona de verdade |

O segundo estágio só começa se o primeiro passar. Não faz sentido esperar seis
minutos de navegador para descobrir que falta um ponto e vírgula.

**A camada de sintaxe** confere três coisas: se o JavaScript dos dois HTML e do
serviço é válido, se as `<div>` fecham, e se o `index-teste-local.html` difere do
`index.html` **apenas** no `DEMO_MODE`. Essa última é a mais valiosa no dia a dia:
é o erro de editar um arquivo e esquecer o outro, que faz você testar uma coisa e
publicar outra.

**A camada de lógica** não tem cópia das funções. O `testes/extrair.mjs` abre o
`index.html`, localiza cada função por balanceamento de delimitadores e monta um
módulo com o **código real** que está publicado. Se o comportamento mudar, o teste
acusa; se a função mudar de nome, a extração falha. Nos dois casos você fica
sabendo antes do seu usuário.

**A camada de navegador** abre o sistema no Chromium, com dados de demonstração, e
clica. Testa modais, filtros, cores das pessoas, a árvore dos parcelamentos, as
assinaturas, o menu em 360/390/768/1280/1920 px. As capturas de tela ficam
anexadas à execução no GitHub.

## 2.2 Não precisa configurar nada

O arquivo `.github/workflows/testes.yml` já vem pronto no projeto. Assim que você
fizer o push da Parte 1.4, o GitHub o encontra e começa a usar. Não há secret,
chave ou permissão a configurar: os testes não acessam o Firebase nem a internet
além do npm.

Confira em **Actions**, no seu repositório. Você verá a execução **Testes** com os
dois estágios.

## 2.3 Rodar os mesmos testes no seu computador

Antes de dar push, vale rodar localmente — o retorno é imediato:

```bash
npm install                        # uma vez
npx playwright install chromium    # uma vez

npm run sintaxe                    # segundos
npm run test:logica                # segundos
npm run test:navegador             # ~6 minutos
npm test                           # os três, na ordem
```

Uma suíte só, quando você está atrás de um problema específico:

```bash
node testes/rodar.mjs navegador smoke-arvore
node testes/rodar.mjs logica teste-ciclo
```

O resumo no fim mostra o placar de cada suíte. Detalhes em
[`testes/README.md`](testes/README.md).

## 2.4 Ler o resultado no GitHub

Em **Actions**, cada execução mostra:

- ✅ **verde** — as 519 verificações passaram
- ❌ **vermelho** — clique na execução, abra o estágio vermelho e procure a linha
  `FALHOU`. Ela traz o valor obtido ao lado do esperado
- 🟡 **amarelo** — ainda rodando

Quando um teste de layout falha, baixe o artefato **capturas-de-tela** no topo da
página da execução: a imagem resolve em um segundo o que o log levaria dez minutos
para explicar.

## 2.5 Impedir que código quebrado entre no `main`

Por padrão, um teste vermelho **não bloqueia nada** — ele só avisa. Para o GitHub
barrar de fato, trabalhe com pull request e exija os testes:

1. Repositório → **Settings → Branches → Add branch protection rule**
2. Em **Branch name pattern**, escreva `main`
3. Marque **Require status checks to pass before merging**
4. Procure e marque **Sintaxe e lógica** e **Navegador**
5. **Create**

A partir daí o fluxo passa a ser:

```bash
git checkout -b ajuste-no-menu
# ... edite, teste localmente ...
git add . && git commit -m "ajusta o menu no celular"
git push -u origin ajuste-no-menu
```

Abra o pull request no GitHub, espere o verde e só então faça o merge.

> Se você trabalha sozinho e prefere empurrar direto no `main`, pode pular este
> passo. Os testes continuam rodando e avisando; só não impedem.

## 2.6 Atenção ao editar o sistema

O `index.html` e o `index-teste-local.html` são o **mesmo arquivo**, diferindo em
uma linha. Ao mexer em um, regenere o outro:

```bash
# Linux ou macOS
sed 's/const DEMO_MODE = false;/const DEMO_MODE = true;/' index.html > index-teste-local.html
```

```powershell
# Windows (PowerShell)
(Get-Content index.html -Raw) -replace 'const DEMO_MODE = false;','const DEMO_MODE = true;' | Set-Content index-teste-local.html
```

Se esquecer, o `npm run sintaxe` reclama — e o GitHub também.

---

# Parte 3 — Criar e configurar o Firebase

## 3.1 Criar o projeto

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. **Adicionar projeto** → dê um nome → pode desativar o Google Analytics
3. Anote o **ID do projeto** (algo como `controle-financeiro-a1b2c`), que aparece em
   **Configurações do projeto**. É diferente do nome que você digitou

O plano gratuito (**Spark**) atende este sistema com folga: ele guarda **um
documento por usuário** e grava com um atraso de dois segundos, agrupando
alterações. Um uso pessoal intenso fica na casa de centenas de operações por dia,
contra o limite de 20.000 leituras e 20.000 escritas diárias.

## 3.2 Registrar o app web e colar a configuração

1. Na página inicial do projeto, clique no ícone **`</>`** (Web)
2. Dê um apelido ao app e **não** marque Firebase Hosting agora
3. O console mostra um bloco `firebaseConfig`. Copie-o
4. Abra o `index.html`, localize `const firebaseConfig = {` (perto do fim do
   arquivo) e substitua pelos seus valores:

```js
const firebaseConfig = {
    apiKey: "...",
    authDomain: "SEU-PROJETO.firebaseapp.com",
    projectId: "SEU-PROJETO",
    storageBucket: "SEU-PROJETO.firebasestorage.app",
    messagingSenderId: "...",
    appId: "..."
};
```

5. Regenere o `index-teste-local.html` com o comando da Parte 2.6

> **A `apiKey` do Firebase não é um segredo.** Ela identifica o projeto e é visível
> para qualquer pessoa que abra o site — é assim no Firebase, por desenho. A
> proteção real vem das regras do passo 3.4. Por isso o repositório pode ser
> público sem problema.

## 3.3 Ativar o login por e-mail e senha

1. Menu lateral → **Build → Authentication** → **Começar**
2. Aba **Sign-in method** → **E-mail/senha** → **Ativar** → salvar
3. Aba **Users** → **Adicionar usuário** → informe e-mail e senha (mínimo 6
   caracteres)

É com esse e-mail e senha que você entra no sistema. **Anote o e-mail** — ele será
o secret `APP_EMAIL` na Parte 5.

O sistema não tem tela de cadastro nem recuperação de senha, de propósito: é de uso
pessoal. Para trocar a senha depois, vá em **Users** → três pontinhos → **Redefinir
senha**.

**Recomendado:** em **Authentication → Settings → User actions**, desmarque a
criação de contas. Sem isso, qualquer pessoa pode criar uma conta no seu projeto.
Ela não veria os seus dados — as regras impedem — mas é lixo que você não quer.

## 3.4 Criar o banco e publicar as regras

1. Menu lateral → **Build → Firestore Database** → **Criar banco de dados**
2. Escolha **Modo de produção** e a região `southamerica-east1` (São Paulo)
3. Abra a aba **Regras** e substitua todo o conteúdo pelo que está no
   `firestore.rules` do projeto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cada usuário só acessa o próprio documento. Nada mais é permitido.
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

4. Clique em **Publicar**

**Essa regra é a única barreira entre os seus dados e a internet.** Ela garante
que, mesmo com a `apiKey` visível, ninguém lê nem escreve no documento de outra
pessoa. Confira depois, na aba **Regras**, que o cabeçalho não diz mais
"modo de teste" nem traz uma data de expiração.

> O serviço de notificações continua funcionando: ele usa a chave de serviço (SDK
> Admin), que passa por cima das regras por natureza.

## 3.5 Publicar o site

```bash
# Instala a ferramenta (uma vez por computador)
npm install -g firebase-tools

# Entra na sua conta Google
firebase login

# Dentro da pasta do projeto
firebase init hosting
```

No assistente, responda:

| Pergunta | Resposta |
|---|---|
| Please select an option | **Use an existing project** → escolha o seu |
| What do you want to use as your public directory? | `.` (ponto, a pasta atual) |
| Configure as a single-page app? | **No** |
| Set up automatic builds and deploys with GitHub? | **No** |
| File index.html already exists. Overwrite? | **No** — atenção: é a pergunta que apaga o sistema |

O `firebase.json` já vem pronto no projeto. Se o assistente o sobrescrever,
restaure este conteúdo:

```json
{
  "firestore": { "rules": "firestore.rules" },
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "firestore.rules",
      "**/.*",
      "**/node_modules/**",
      "**/*.json",
      "testes/**",
      "enviar-notificacoes.js",
      "index-teste-local.html",
      "*.md",
      "*.pdf"
    ],
    "headers": [
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, max-age=0" }]
      }
    ]
  }
}
```

O bloco `ignore` é de segurança: sem ele, a chave de serviço, os backups, os testes
e a documentação iriam para a internet junto com o sistema. O bloco `headers` faz o
navegador sempre buscar a versão nova, dispensando o Ctrl+Shift+R a cada publicação.

**Teste antes de publicar de verdade** (recomendado):

```bash
firebase hosting:channel:deploy teste --expires 1d
```

Publica numa URL temporária, separada da produção, válida por um dia.

Agora publique:

```bash
firebase deploy --only hosting
```

O endereço aparece no final: `https://SEU-PROJETO.web.app`.

Para enviar também as regras do Firestore pelo terminal, em vez de colar no console:

```bash
firebase deploy --only firestore:rules
```

**Se algo der errado:**

```bash
firebase hosting:rollback
```

Volta para a versão anterior na hora. Os dados no Firestore não são afetados.

## 3.6 Gerar a chave de serviço

Essa chave permite que o serviço de notificações leia os seus dados.

1. **Configurações do projeto** (engrenagem) → aba **Contas de serviço**
2. **Gerar nova chave privada** → confirmar
3. Baixa um arquivo `.json`

**Guarde esse arquivo fora da pasta do projeto.** Ele dá acesso total ao seu banco.
Nunca o versione, nunca o publique, nunca o cole em um chat.

## 3.7 Guardar os dois primeiros secrets no GitHub

No repositório → **Settings → Secrets and variables → Actions → New repository
secret**:

| Nome | Valor |
|---|---|
| `SERVICE_ACCOUNT` | Abra o `.json` baixado, copie **todo** o conteúdo (incluindo as chaves `{ }`) e cole |
| `APP_EMAIL` | O e-mail do usuário criado no passo 3.3 |

## 3.8 Resumo dos comandos do Firebase

| Comando | Para que |
|---|---|
| `firebase login` | Entrar na conta Google |
| `firebase projects:list` | Ver os seus projetos |
| `firebase use SEU-PROJETO` | Escolher com qual projeto trabalhar |
| `firebase deploy --only hosting` | Publicar o sistema |
| `firebase deploy --only firestore:rules` | Publicar as regras |
| `firebase hosting:channel:deploy teste --expires 1d` | Publicar numa URL de teste |
| `firebase hosting:rollback` | Voltar a versão anterior |
| `firebase hosting:channel:list` | Ver os canais de teste abertos |

---

# Parte 4 — Configurar o sistema depois de no ar

O sistema está publicado, mas chega **vazio**. Esta parte é a configuração inicial
dentro dele, na ordem que evita retrabalho — cada passo usa o anterior.

Abra `https://SEU-PROJETO.web.app` e entre com o e-mail e senha do passo 3.3.

> **O sistema abriu num mês anterior ao atual?** É o comportamento esperado. Ele
> abre no **mês de competência**: enquanto o mês anterior tiver despesa em aberto, é
> nele que o sistema abre. O mês só avança quando tudo do anterior está pago — nunca
> por data fixa.

## 4.1 Categorias de despesa

**Configurações → Categorias de Despesa → Gerenciar categorias**

Comece por aqui: toda despesa pertence a uma categoria, e os orçamentos (4.5) são
definidos por categoria. Cadastrar as despesas antes de ter categorias dá
retrabalho.

Cada categoria tem **nome, ícone e cor**. Sugestão de partida: Moradia,
Alimentação, Transporte, Saúde, Educação, Lazer, Assinaturas, Cartão de Crédito.

## 4.2 Fontes de renda

**Configurações → Fontes de Renda → Adicionar**

Salário, freelance, aluguel recebido. O valor entra mês a mês na aba **Detalhes**;
aqui você cadastra apenas o nome da fonte.

## 4.3 Cartões de crédito

**Cartões → Adicionar cartão**

Para cada cartão, informe:

| Campo | Observação |
|---|---|
| **Nome** | Como você o chama. Use o mesmo nome da despesa da fatura (ver abaixo) |
| **Limite** | Usado no indicador de limite consumido |
| **Dia de fechamento** | O dia em que a fatura fecha |
| **Dia de vencimento** | O dia em que você paga |

O par fechamento/vencimento é o que ensina o sistema a calcular em que mês cada
compra vence. Quando o vencimento é **menor ou igual** ao fechamento, o sistema
entende que a fatura vence no mês seguinte.

> **Vínculo entre a fatura e o cartão.** Quando você lança a despesa "Fatura
> Nubank", o sistema precisa saber que ela é a fatura daquele cartão — sem isso, a
> projeção somaria a fatura **e** as parcelas, dobrando o valor. Ele encontra as
> faturas soltas pelo nome e oferece o vínculo em um clique, na própria aba Cartões.
> Nomear a despesa com o nome do cartão faz esse reconhecimento funcionar de
> primeira.

## 4.4 Pessoas, parcelamentos e assinaturas

Só se outras pessoas compram no seu cartão.

**Pessoas → Adicionar pessoa** — nome, telefone (opcional) e **cor**. A cor
acompanha a pessoa em todo o sistema: na árvore dos parcelamentos, nas faixas de
grupo, nas etiquetas da fatura e no extrato.

**Cartões → Novo parcelamento** — para cada compra de terceiro:

- **Compra parcelada**: valor da parcela, total de parcelas, mês da primeira
- **Compra à vista**: marque a opção; o total vira 1
- **Assinatura**: marque *"Assinatura — cobra todo mês, sem fim definido"*. O valor
  passa a ser mensal e não há total de parcelas. É o caso de quem tem Spotify ou
  academia no seu cartão

A fatura continua registrando o **valor cheio** — é o que o banco cobra de você. A
parte de terceiros é derivada dos parcelamentos, e o que o sistema chama de "seu" é
a diferença. Por isso o Dashboard, os Relatórios e a Projeção mostram o seu custo
real, não o valor da fatura.

Para encerrar uma assinatura, use o botão de encerrar na linha dela: ele grava o mês
da última cobrança. O histórico fica e o que estava pendente continua a receber.

## 4.5 Orçamentos

**Configurações → Orçamentos → Adicionar**

Um teto mensal por categoria. O consumo considera o **seu** custo, não o valor
cheio das faturas — uma fatura de R$ 2.000 com R$ 600 de terceiros consome R$ 1.400
do orçamento.

## 4.6 Despesas recorrentes

**Configurações → Despesas Recorrentes → Adicionar**

Contas que repetem todo mês: aluguel, internet, energia, mensalidade escolar. Cada
uma tem nome, categoria, valor, **dia do vencimento** e **mês do vencimento**.

> **O campo "mês do vencimento" merece atenção.** Ele responde: a conta vence no
> próprio mês de competência ou no seguinte? Aluguel, água e luz costumam vencer no
> mesmo mês. Fatura de cartão e assinaturas lançadas no fechamento vencem no mês
> seguinte. Marcar errado faz a mesma conta aparecer em dois meses com a mesma data
> de vencimento.

Editar o valor ou o nome de uma recorrente **não** reescreve vencimentos já
lançados — uma correção que você fez em um mês específico sobrevive. Só mudar o dia
ou o mês do vencimento redefine as datas.

## 4.7 Metas

**Metas → Adicionar** — nome, valor alvo e prazo. Acompanhamento manual, por
aporte.

## 4.8 Primeiro mês de uso

Na aba **Detalhes**, lance as rendas e as despesas do mês corrente. Despesas de
cartão devem ter o cartão escolhido no campo correspondente — é o que liga a
despesa ao limite e ao cálculo de terceiros.

Depois de lançar, confira:

- **Dashboard** — o saldo do mês fecha com o que você esperava?
- **Cartões** — o limite consumido de cada cartão está coerente?
- **Projeção** — escolha o horizonte (3, 6, 12 meses). É esse número que o sistema
  usa para projetar assinaturas sem fim definido

## 4.9 Backup

**Configurações → Backup dos Dados → Exportar (JSON)**

Faça isso agora, com o sistema configurado, e **antes de cada atualização**. Os
dados vivem no Firestore e não são afetados pela troca do `index.html`, mas a cópia
é a sua rede de segurança. O arquivo é ignorado pelo Git (`backup*.json`), então não
corre risco de ir para o repositório.

## 4.10 Checklist da configuração inicial

- [ ] Categorias de despesa cadastradas, com ícone e cor
- [ ] Fontes de renda cadastradas
- [ ] Cartões com limite, fechamento e vencimento
- [ ] Fatura de cada cartão vinculada ao cartão
- [ ] Pessoas cadastradas com cor (se houver compras de terceiros)
- [ ] Parcelamentos e assinaturas de terceiros lançados
- [ ] Orçamentos por categoria
- [ ] Despesas recorrentes, com o **mês do vencimento** correto em cada uma
- [ ] Rendas e despesas do mês corrente lançadas
- [ ] Horizonte da Projeção escolhido
- [ ] Backup exportado

---

# Parte 5 — Notificações por WhatsApp

O sistema usa o **Green API**, que não é a API oficial da Meta. Na prática: uma
conta de WhatsApp sua é conectada por QR Code e passa a enviar as mensagens. Quem
recebe não precisa instalar nem ativar nada.

## 5.1 Criar a conta e a instância

1. Acesse [green-api.com](https://green-api.com) e crie uma conta gratuita
2. No painel, crie uma **instância** (*Create an instance*), no plano **Developer**
   (gratuito)
3. Abra a instância criada

## 5.2 Conectar o número que vai enviar

1. Na página da instância, clique em **Scan QR code**
2. No celular, abra o WhatsApp → **Aparelhos conectados** → **Conectar um aparelho**
3. Aponte para o QR Code na tela

O status da instância precisa ficar **authorized**. Esse é o número **remetente** —
pode ser o seu próprio.

> Mantenha o celular conectado à internet. Se o aparelho ficar muito tempo offline,
> ou se você remover o dispositivo conectado no WhatsApp, a instância cai e as
> mensagens param sem aviso.

## 5.3 Copiar as três credenciais

Ainda na página da instância:

| Campo no painel | Secret correspondente |
|---|---|
| `apiUrl` (algo como `https://7105.api.greenapi.com`) | `GREENAPI_URL` |
| `idInstance` | `GREENAPI_ID_INSTANCE` |
| `apiTokenInstance` | `GREENAPI_TOKEN_INSTANCE` |

## 5.4 Guardar os secrets no GitHub

Mesmo caminho do passo 3.7 — **Settings → Secrets and variables → Actions**. Ao
final você terá **cinco**:

```
SERVICE_ACCOUNT          (Parte 3.7)
APP_EMAIL                (Parte 3.7)
GREENAPI_URL             (aqui)
GREENAPI_ID_INSTANCE     (aqui)
GREENAPI_TOKEN_INSTANCE  (aqui)
```

**Por que secrets e não um arquivo de configuração?** Porque o repositório pode ser
público e, mesmo privado, qualquer credencial em arquivo acaba vazando em um print,
em um fork ou no histórico do Git. Os secrets ficam criptografados, só o GitHub
Actions os lê, e eles nem aparecem no log — se o valor for impresso por engano, o
GitHub o substitui por `***`.

## 5.5 Cadastrar quem recebe

1. Abra o sistema e entre
2. **Configurações → Notificações por WhatsApp**
3. Para cada pessoa: nome e número no formato **país + DDD + número**:
   `+55 (85) 99999-9999`

O plano gratuito do Green API envia para até **3 números diferentes**.

## 5.6 Testar

GitHub → **Actions → Notificacoes WhatsApp → Run workflow** → marque **modo_teste**
→ **Run**.

Em cerca de um minuto, todos os contatos recebem:

> ✅ **Teste — Controle Financeiro PRO**
> Se você recebeu esta mensagem, as notificações de WhatsApp estão funcionando! 🎉

Se não chegar, abra a execução e leia o log do passo *Enviar notificações* — a
mensagem de erro diz qual secret está errado.

## 5.7 Como funciona daqui em diante

Envio automático às **08:00** e às **19:00** (horário de Brasília). Nada é enviado
quando não há contas a vencer nem vencidas.

Na **primeira execução real**, o log mostra:

```
Primeira execução do aviso de mês quitado. Situação registrada: ... Nada enviado por isso.
```

É proposital: evita disparar avisos de fechamento sobre meses que já estavam
quitados antes da regra existir.

---

# Atualizar o sistema depois

```bash
# 1. Substitua index.html, index-teste-local.html e enviar-notificacoes.js

# 2. Confira localmente
npm test

# 3. Envie para o GitHub — os testes rodam sozinhos
git add .
git commit -m "descreva o que mudou"
git push

# 4. Com o verde no Actions, publique
firebase deploy --only hosting
```

A ordem importa: **teste, envie, espere o verde, publique**. Publicar antes de ver o
resultado dos testes é abrir mão da rede que você acabou de montar.

**Antes de qualquer atualização**, exporte um backup pela aba **Configurações →
Backup dos Dados**.

---

# Checklist geral

**Parte 1 — GitHub**
- [ ] Repositório criado, sem README/gitignore/licença
- [ ] Estrutura com `testes/` e os dois `.yml` em `.github/workflows/`
- [ ] `.gitignore` no lugar, ignorando credenciais e backups
- [ ] Primeiro push concluído

**Parte 2 — Testes**
- [ ] Execução **Testes** aparecendo em Actions
- [ ] Os dois estágios verdes
- [ ] `npm test` rodando no seu computador
- [ ] (Opcional) Proteção do `main` exigindo os dois checks

**Parte 3 — Firebase**
- [ ] `firebaseConfig` do seu projeto colado no `index.html` e o `index-teste-local.html` regenerado
- [ ] Login por e-mail e senha ativado, usuário criado
- [ ] Criação de contas desativada em Authentication → Settings
- [ ] Firestore criado em modo de produção, com as regras publicadas
- [ ] `firebase.json` com o bloco `ignore` preenchido
- [ ] Site publicado e acessível
- [ ] Chave de serviço gerada e guardada fora da pasta do projeto

**Parte 4 — Sistema**
- [ ] Checklist do passo 4.10 completo

**Parte 5 — WhatsApp**
- [ ] Cinco secrets cadastrados
- [ ] Instância do Green API **authorized**
- [ ] Contatos cadastrados
- [ ] Mensagem de teste recebida

---

# Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `git push` recusa a senha | O GitHub não aceita mais senha de conta | Use um Personal Access Token (passo 1.4) |
| O workflow não aparece em Actions | Arquivo fora de `.github/workflows/` | Mova e faça push novamente |
| Testes vermelhos logo no primeiro push | `index-teste-local.html` desatualizado | Regenere com o comando do passo 2.6 |
| `npm ci` falha no GitHub | `package-lock.json` não foi enviado | Confirme que ele não está no `.gitignore` e faça push |
| Teste de navegador falha só no GitHub | Diferença de tempo de carga | Rode de novo; se insistir, baixe o artefato de capturas |
| "Email ou senha incorretos" | Usuário não existe no Authentication | Crie em Authentication → Users (passo 3.3) |
| Tela de login aparece e nada acontece | `firebaseConfig` errado no `index.html` | Confira os valores do passo 3.2 |
| "Erro ao carregar dados" | Regras do Firestore bloqueando | Confira as regras do passo 3.4 |
| O site não atualiza depois do deploy | Cache do navegador | Ctrl+Shift+R; confirme o bloco `headers` do passo 3.5 |
| A mesma conta aparece em dois meses com o mesmo vencimento | "Mês do vencimento" errado na recorrente | Corrija no passo 4.6; mudar o campo reescreve os meses |
| O limite do cartão parece alto demais | Fatura não vinculada ao cartão | Vincule na aba Cartões (passo 4.3) |
| Teste do WhatsApp não chega | Instância desconectada | Verifique o status **authorized** no painel do Green API |
| Mensagens pararam sem motivo | GitHub suspendeu o agendamento | Repositórios sem commits por ~60 dias têm o cron desativado. Reative em Actions |
| As mensagens chegam atrasadas | Comportamento normal do GitHub | O agendador costuma atrasar de 5 a 20 minutos em horários de pico |
| O app abre em um mês anterior | Comportamento esperado | O sistema abre no mês de competência (ver Parte 4) |

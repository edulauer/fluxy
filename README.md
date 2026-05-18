# Fluxo Simples

Mini SaaS web para controle financeiro empresarial, focado em lancar e visualizar receitas e despesas do dia a dia.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Banco: SQLite com `better-sqlite3`
- Extras: exportacao CSV e dados mockados no primeiro start

## Estrutura

```text
mini-finance-saas/
  server/
    index.js          API HTTP e rotas de lancamentos
    storage.js        inicializacao do SQLite e seed mockado
    data/             banco local gerado automaticamente
  src/
    components/       dashboard, formulario, categorias, filtros, lista e grafico
    utils/            formatadores de moeda e data
    api.js            cliente HTTP do frontend
    App.jsx           orquestracao da tela principal
    styles.css        layout mobile-first
  index.html
  vite.config.js
  package.json
```

## Como rodar localmente

A senha padrao e o nome da empresa deve ser configurada em base64 no arquivo `.env`:

```text
APP_PASSWORD_BASE64=<senhabase64>
APP_COMPANY_NAME=Nome da Empresa
```

```bash
cd mini-finance-saas
npm install
npm run dev
```

Depois abra:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3333/api/health`



Para gerar a versao de producao:

```bash
npm run build
npm start
```

## Deploy e variaveis de ambiente

Este projeto e full-stack: o frontend em `dist/` depende da API Express em `server/index.js`. Um deploy padrao da Netlify apenas com `npm run build` e publish em `dist` publica somente o frontend, entao rotas como `/api/login` e `/api/config` nao rodam e as variaveis `APP_PASSWORD_BASE64` e `APP_COMPANY_NAME` nao chegam ao backend.

Para hospedar sem adaptar o codigo, use uma plataforma que rode Node.js persistente, como Render, Railway, Fly.io ou um VPS, e configure no ambiente do servidor:

```text
APP_PASSWORD_BASE64=<senhabase64>
APP_COMPANY_NAME=Nome da Empresa
NODE_ENV=production
```

Na Netlify, sera necessario converter a API para Netlify Functions e trocar o SQLite local por um banco persistente externo. Caso contrario, o site ate abre, mas login/configuracao/dados falham porque a API nao existe no deploy estatico.

## Funcionalidades

- Cadastro de receitas e despesas com valor, data, descricao e categoria.
- Edicao e exclusao diretamente na lista.
- Filtros por periodo: dia, semana e mes.
- Filtros por tipo: todos, receitas ou despesas.
- Dashboard inicial com total de receitas, total de despesas e saldo.
- Grafico simples de barras com receitas versus despesas por dia.
- Tela de categorias para cadastrar novas categorias de receitas e despesas.
- Tela de login com senha unica, sem usuarios.
- Exportacao CSV dos lancamentos filtrados.

## Dados mockados

Na primeira execucao, o SQLite e criado em `server/data/finance.sqlite` com exemplos como:

- Vendas no balcao
- Compra de insumos
- Contrato mensal
- Campanha local
- Aluguel da loja

Para resetar os dados, pare o servidor e remova o arquivo `server/data/finance.sqlite`.

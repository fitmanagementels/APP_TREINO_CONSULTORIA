# Guia 02 — criar D1 de testes e publicar a prévia

Este guia cria apenas o ambiente **staging** (testes). Ele não importa dados reais e não modifica Google Sheets. Consulte também o [guia oficial do D1](https://developers.cloudflare.com/d1/get-started/).

## Resultado esperado

Ao final haverá um banco chamado `xsteam-pwa-staging`, a estrutura das tabelas estará aplicada e uma URL temporária do Worker abrirá o PWA vazio. A confirmação técnica é abrir `URL_DO_WORKER/api/status` e encontrar `"database":"ok"`.

## Passo a passo

1. Termine o [Guia 01](01-cloudflare-conta-e-wrangler.md). No terminal, `npx wrangler whoami` deve funcionar.
2. Na pasta do projeto, gere a cópia estática que será servida pelo Worker:

   ```bash
   npm run assets:build
   ```

3. Crie sua configuração local. Este arquivo fica ignorado pelo Git:

   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

4. Crie o banco de testes:

   ```bash
   npx wrangler d1 create xsteam-pwa-staging
   ```

5. O terminal mostrará um `database_id` e normalmente também um trecho de configuração. Copie **somente para o arquivo local** `wrangler.jsonc`: no VS Code, clique no arquivo, localize o valor `00000000-0000-0000-0000-000000000000` e substitua pelo ID mostrado. Salve o arquivo.

   Não envie esse ID por chat, não o inclua em captura de tela e não faça commit do arquivo `wrangler.jsonc`.

6. Aplique a estrutura do banco remoto:

   ```bash
   npx wrangler d1 migrations apply xsteam-pwa-staging --remote
   ```

   Confirme que o terminal informa a aplicação de `0001_initial_schema.sql`.

7. Publique a prévia:

   ```bash
   npm run deploy
   ```

8. Copie a URL do Worker mostrada no final. Abra primeiro `URL_DO_WORKER/api/status` no navegador. Depois abra apenas `URL_DO_WORKER`.

## Confirmações obrigatórias

- `/api/status` mostra `"database":"ok"`, `"prescriptionRows":0` e `"executionRows":0`.
- A URL sem `/api/status` abre o PWA; como ainda não há prescrição, ela pode mostrar um aviso de prescrição vazia, mas não pode ficar travada no carregamento.

Se qualquer comando falhar, pare aqui. Não exporte nem importe dados antes de corrigir o ambiente de staging.

# Guia 01 — entrar na Cloudflare e autorizar o computador

Use este guia somente quando for iniciar o ambiente de testes. Ele não altera o PWA, o Apps Script nem o Google Sheets.

## Antes de começar

- Você precisa estar no computador em que está este projeto e ter acesso ao seu e-mail.
- Nunca envie em chat a senha da Cloudflare, código recebido por e-mail, token de API, ID do banco ou captura de tela com esses dados.
- Se ainda não tem uma conta, abra [Cloudflare — criar conta ou entrar](https://dash.cloudflare.com/sign-up). Crie a conta gratuita ou entre em uma conta já existente.

## Autorizar este computador

1. Abra o terminal no VS Code: menu **Terminal > New Terminal**.
2. Confirme que o terminal está na pasta do projeto. Se não estiver, copie e cole:

   ```bash
   cd "/home/elohimlima/Downloads/VSCODE|ANTIGRAVITY/APP_TREINO_CONSULTORIA"
   ```

3. Rode o comando abaixo. Ele abre uma página do navegador para a própria Cloudflare:

   ```bash
   npx wrangler login
   ```

4. Na página aberta, entre na sua conta e clique em **Allow** / **Permitir** para autorizar o Wrangler.
5. Volte ao terminal. Aguarde o comando terminar sem erro.
6. Confirme a identidade conectada:

   ```bash
   npx wrangler whoami
   ```

## Como saber que deu certo

O último comando deve mostrar o nome da conta Cloudflare e não uma mensagem de autenticação falha. Guarde somente esse nome não secreto para o registro técnico; não copie tokens, IDs ou códigos para chat.

Se o navegador não abrir, copie o endereço que o terminal mostrar e abra-o manualmente. Se `whoami` falhar, rode `npx wrangler logout` e repita este guia. Não crie token manual como atalho.

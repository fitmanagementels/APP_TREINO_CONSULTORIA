# Publicar com login Google gratuito, sem domínio próprio

Este guia ativa o acesso ao PWA usando somente a conta Google autorizada e a URL gratuita do Cloudflare Workers. Não compra domínio, não usa Google Sheets e não pede senha dentro do PWA.

Antes de começar, deixe esta página aberta. O app já está preparado no computador; você só fará a configuração que exige a sua conta Google.

## Resultado esperado

- URL do PWA: `https://xsteam-pwa.fitmanagement-els.workers.dev`
- Só uma conta Google permitida (single tenant).
- Dados continuam no D1 do Cloudflare.
- O PWA fica privado: sem login, as APIs devolvem bloqueio de acesso.

## Parte 1 — criar a identificação do Google

1. Abra [Google Cloud Console — Credenciais](https://console.cloud.google.com/apis/credentials).
2. Faça login com a conta Google que será a dona do projeto.
3. No topo da página, clique no seletor de projeto e escolha **Novo projeto**. Use um nome simples, por exemplo `XSTEAM PWA`, e clique em **Criar**.
4. Aguarde o projeto abrir. Volte à página de [Credenciais](https://console.cloud.google.com/apis/credentials) se necessário.
5. Se o Google pedir para configurar a tela de consentimento, clique em **Configure consent screen** (ou **Configurar tela de consentimento**):
   - Tipo de usuário: escolha **External / Externo**.
   - Nome do app: `XSTEAM Wellness`.
   - E-mail de suporte e e-mail do desenvolvedor: escolha o seu.
   - Salve as telas seguintes. Não é necessário publicar nem verificar o app agora.
   - Em **Test users / Usuários de teste**, adicione a mesma conta Google que usará para entrar no PWA. Isso é necessário enquanto o app estiver em teste.
6. Volte a **APIs e serviços > Credenciais** e clique em **Criar credenciais > ID do cliente OAuth**.
7. Em **Tipo de aplicativo**, escolha **Aplicativo da Web**.
8. Dê o nome `XSTEAM PWA Workers`.
9. Em **Origens JavaScript autorizadas**, clique em **Adicionar URI** e cole exatamente:

   `https://xsteam-pwa.fitmanagement-els.workers.dev`

10. Não preencha **URIs de redirecionamento autorizados**. Este PWA usa o botão oficial Google Identity Services, sem redirecionamento.
11. Clique em **Criar**.
12. Copie somente o campo **ID do cliente**. Ele costuma terminar com `.apps.googleusercontent.com`. Não copie nem compartilhe um `client secret`.

## Parte 2 — me liberar para concluir a publicação

Envie aqui apenas o **ID do cliente** copiado no passo 12. Ele é uma identificação pública e será colocado na configuração do Worker.

Eu ainda precisarei que você faça duas ações pessoais, porque a conta permitida e a chave de sessão não devem ser enviadas por chat:

1. Abra um terminal na pasta do projeto.
2. Execute `npx wrangler secret put ALLOWED_GOOGLE_EMAIL`.
3. Quando o terminal pedir o valor, digite o e-mail da conta Google que poderá entrar no PWA e pressione Enter.
4. Execute `openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET` e confirme, se o terminal perguntar.

Esses comandos mandam os valores diretamente ao Cloudflare como segredos. Não cole o e-mail nem a chave no repositório, em arquivos de configuração ou nesta conversa.

Quando terminar, responda somente: **“segredos configurados”**. Então eu reativo a URL gratuita, publico a versão protegida e faço as verificações técnicas.

## Parte 3 — teste depois da publicação

Após eu confirmar a publicação:

1. Abra uma janela anônima do navegador.
2. Acesse `https://xsteam-pwa.fitmanagement-els.workers.dev`.
3. A tela deve mostrar **Acesso protegido** e o botão Google.
4. Entre com a conta autorizada. O PWA deve abrir Treino, Prescrição, Prescrever, Histórico e Carga.
5. Em outra janela anônima, tente uma conta Google diferente. Ela deve receber a mensagem de conta não autorizada e nunca ver dados do treino.

## Se aparecer erro de origem

Confira no Google Cloud se a origem está idêntica, incluindo `https://` e sem barra no final: `https://xsteam-pwa.fitmanagement-els.workers.dev`. Depois espere alguns minutos, atualize a página e tente de novo.

## O que nunca deve ser feito

- Não comprar domínio para esta etapa.
- Não ativar `workers.dev` antes de os dois segredos estarem configurados.
- Não enviar `SESSION_SECRET`, e-mail permitido ou qualquer `client secret` por chat.
- Não remover a proteção das rotas `/api/*` para “testar mais rápido”.

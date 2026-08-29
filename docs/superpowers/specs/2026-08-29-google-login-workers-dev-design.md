# Login Google gratuito no PWA single-tenant

## Objetivo

Proteger o PWA hospedado em `workers.dev` sem comprar domínio e sem criar estrutura multiusuário. O único usuário autorizado entra com uma conta Google; todo acesso a dados do D1 e às rotas de API exige uma sessão válida.

## Decisão

Usar Google Identity Services no navegador e autenticação própria no Cloudflare Worker. Cloudflare Access não será usado nesta fase porque a aplicação não tem domínio controlado. Firebase também fica fora do escopo para não adicionar um segundo serviço.

## Fluxo

1. O navegador carrega a casca estática do PWA e verifica `GET /api/auth/session`.
2. Sem sessão, exibe uma tela de login, carrega o script oficial Google Identity Services e obtém um ID token após o botão “Entrar com Google”.
3. O navegador envia o token para `POST /api/auth/google`.
4. O Worker valida assinatura, emissor, audiência, expiração, `email_verified` e e-mail permitido; então emite um cookie de sessão `HttpOnly`, `Secure`, `SameSite=Lax`, assinado com Web Crypto.
5. As demais rotas `/api/*` validam o cookie antes de acessar D1. O Worker retorna `401 AUTH_REQUIRED` quando não há sessão e `403 AUTH_FORBIDDEN` quando a identidade não é autorizada.
6. `POST /api/auth/logout` limpa o cookie; o frontend volta para a tela de login.

## Configuração e segredos

- `GOOGLE_CLIENT_ID`: variável não secreta usada pelo navegador e pelo Worker para validar a audiência.
- `ALLOWED_GOOGLE_EMAIL`: segredo/variável local com o único e-mail autorizado. Não será incluído no Git.
- `SESSION_SECRET`: segredo aleatório do Worker para assinar sessões. Não será incluído no Git.
- A configuração local `wrangler.jsonc` permanece ignorada pelo Git. O endereço `workers.dev` só será reativado após os três valores existirem no ambiente Cloudflare.

## Escopo de UI

- Overlay de login simples, sem cadastro, recuperação de senha ou seleção de perfil.
- O PWA não chama bootstrap, prescrição, histórico, carga, sincronização ou salvamento antes de uma sessão aprovada.
- Falhas mostram mensagem legível e não expõem detalhes de token ou configurações.

## Segurança e limites

- O ID token nunca é salvo em `localStorage`.
- O cookie não contém o token Google; contém somente uma sessão curta assinada pelo Worker.
- A verificação de token usa chaves públicas Google (JWKS) e valida criptograficamente `RS256`; não confia apenas no e-mail enviado pelo navegador.
- O app permanece single-tenant: uma única identidade permitida, sem tabelas de usuários e sem alteração do schema D1.

## Testes e aceite

- Testes do Worker: requisição sem cookie retorna 401; token inválido retorna 401; identidade fora da allowlist retorna 403; sessão válida permite rota de dados; logout invalida cookie.
- Testes de frontend: a fonte contém o gate de sessão e nenhuma chamada de dados ocorre antes de autenticação.
- Aceite manual: criar OAuth Client gratuito no Google Cloud, inserir configurações via Wrangler, entrar com o e-mail autorizado, testar recusa de outro e-mail e confirmar que `/api/status` não abre sem login.

## Ação manual futura

Criar um OAuth Client do tipo Web no Google Cloud Console e cadastrar a origem `https://xsteam-pwa.fitmanagement-els.workers.dev`. Essa ação será detalhada somente quando o código e os testes estiverem prontos. Nenhuma senha, código ou e-mail precisa ser enviado pelo chat.

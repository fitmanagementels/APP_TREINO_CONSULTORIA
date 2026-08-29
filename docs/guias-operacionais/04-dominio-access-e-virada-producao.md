# Guia 04 — domínio controlado, Cloudflare Access e virada de produção

Use este guia somente depois que a migração de staging e o aceite completo estiverem aprovados. O objetivo é proteger o PWA single-tenant: ninguém deve abrir a URL de produção antes de passar pelo Cloudflare Access.

Leituras oficiais: [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) e [políticas comuns do Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/).

## Pré-requisitos

- Um domínio que você controla e que esteja configurado na Cloudflare. Não use a URL pública `workers.dev` como endereço final de produção.
- O banco de produção já criado, migrado e auditado; não reutilize o banco de staging.
- Uma única conta de e-mail autorizada para este PWA. Não coloque esse e-mail em Git, chat, print ou documentação pública.

## Proteger o endereço de produção

1. Entre no [dashboard Cloudflare](https://dash.cloudflare.com/).
2. Abra **Zero Trust**. Se for a primeira vez, conclua apenas o cadastro inicial da organização.
3. No menu, abra **Access controls > Applications**.
4. Clique em **Add an application** e escolha **Self-hosted**.
5. Informe um nome identificável, por exemplo `XSTeam PWA Produção`.
6. Em hostname, informe exatamente o subdomínio de produção que será conectado ao Worker, por exemplo `treino.seudominio.com`. Não use curinga amplo se não for necessário.
7. Crie uma política **Allow**. Em vez de escolher “all valid emails”, selecione a regra de e-mail e informe apenas o e-mail autorizado.
8. Em método de login, habilite **One-time PIN**. Salve a aplicação.
9. Conecte o mesmo hostname ao Worker já publicado, usando a área de rotas/domínios do Worker no dashboard. Confirme que o hostname aponta para o Worker correto antes de compartilhar o endereço.

## Teste de segurança obrigatório

1. Abra uma janela anônima/privada.
2. Abra o hostname de produção. O Cloudflare Access deve pedir o e-mail e enviar um PIN de uso único.
3. Entre com o e-mail autorizado, use o PIN e confirme que o PWA e `/api/status` funcionam.
4. Em outra janela privada, tente um e-mail não autorizado. Ele não deve receber acesso ao PWA.

Se qualquer pessoa não autorizada chegar ao PWA, pare a virada e corrija a política antes de importar ou registrar dados de produção.

## Rollback seguro

Se for necessário interromper a produção, desative a rota ou remova temporariamente o domínio da configuração do Worker. Não apague o banco D1: ele é a evidência para diagnóstico. O Google Sheets e o Apps Script continuam disponíveis apenas como caminho de rollback até que a migração seja formalmente encerrada.

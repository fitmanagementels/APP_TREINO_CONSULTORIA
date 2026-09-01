# Contexto e Status do Projeto

Última atualização: 1º de setembro de 2026 (America/Fortaleza)

Este documento é a fonte de continuidade do projeto. Ele registra o estado atual, as decisões já aprovadas e a ordem segura para continuar a migração.

## Resumo executivo

- O PWA está em transição de Google Apps Script/Sheets para **Cloudflare Worker + D1**, usando a camada gratuita e a URL `workers.dev`.
- A arquitetura atual é **single tenant** e o acesso é protegido por login Google e cookie de sessão seguro.
- Cloudflare já serve frontend e API; D1 guarda catálogo, prescrições, execuções e, com a migração `0003`, o ciclo de vida das sessões de treino.
- A planilha pública permanece apenas como fonte editorial do catálogo de exercícios. O navegador não a consulta durante o uso diário.
- As abas **Histórico** e **Carga** não foram redesenhadas. Sessões finalizadas são convertidas para o formato de execução que essas telas já consomem.
- A aba **Treino** agora possui início explícito, uma única sessão ativa, treino prescrito/livre, rascunho offline, RER em intervalos de `0,5`, revisão, PSE e finalização.
- A próxima evolução de produto será prescrição com quantidade dinâmica de ciclos e cronograma de periodização; ela não faz parte deste incremento.

## Decisões aprovadas

| Decisão | Regra atual |
|---|---|
| Hospedagem | Cloudflare no plano gratuito, sem compra de domínio. |
| URL | Subdomínio atual em `workers.dev`. |
| Arquitetura | Single tenant nesta fase. |
| Autenticação | Login Google; apenas o e-mail configurado no secret do Worker pode entrar. |
| Banco operacional | D1, sem Google Sheets como banco do PWA. |
| Catálogo | A planilha pública é a fonte de referência; o Worker espelha dados válidos no D1. |
| Exercícios | Prescrição e treino livre aceitam somente exercícios ativos do catálogo. |
| Terminologia | **RER** = repetições em reserva; **PSE** = percepção subjetiva de esforço da sessão. |
| Interface | Manter o design atual até uma etapa específica de redesign. |
| Histórico/Carga | Preservar comportamento e contratos existentes. |

## Arquitetura atual

```text
Navegador/PWA
    │ HTTPS + cookie de sessão
    ▼
Cloudflare Worker
    ├── arquivos estáticos do PWA
    ├── autenticação Google
    ├── rotas /api/*
    └── sincronização do catálogo público
             │
             ▼
        Cloudflare D1
        ├── catálogo
        ├── prescrições
        ├── sessões e rascunhos
        └── execuções finalizadas
```

Google Apps Script e a antiga planilha operacional devem permanecer intactos apenas como rollback enquanto a migração Cloudflare não conclui todo o aceite. Não devem receber novas funcionalidades.

## Fluxo da aba Treino

1. Sem sessão ativa, o usuário escolhe **Treino prescrito** ou **Treino livre**.
2. O treino prescrito exige data, ficha, treino e ciclo; o livre exige apenas a data.
3. **Iniciar treino** cria uma sessão oficial no D1. Uma restrição impede duas sessões ativas.
4. Durante a sessão, somente ela aparece na aba Treino. Não é possível trocar silenciosamente para outra ficha.
5. Exercícios e séries são rascunhos. Alterações são salvas primeiro no navegador e sincronizadas em segundo plano.
6. Cada série usa carga, repetições e RER. RER aceita `0`, `0,5`, `1` ... `10`.
7. Séries parciais impedem finalizar; linhas vazias são ignoradas.
8. A revisão solicita PSE da sessão. A finalização publica as séries completas em uma transação e encerra a sessão.
9. Cancelar encerra a sessão sem criar execuções no histórico.

O procedimento detalhado está no [Guia 08](guias-operacionais/08-sessao-treino-e-treino-livre.md).

## Telas

| Tela | Responsabilidade atual |
|---|---|
| **Treino** | Iniciar, executar, recuperar, finalizar ou cancelar uma sessão prescrita/livre. |
| **Prescrição** | Visualizar fichas, treinos e ciclos, sem edição. |
| **Prescrever** | Editar prescrições e escolher exercícios do catálogo oficial. |
| **Histórico** | Consultar execuções finalizadas. Não foi alterada neste incremento. |
| **Carga** | Consultar indicadores existentes a partir das execuções. Não foi alterada neste incremento. |

## Banco D1

As migrações são aplicadas em ordem:

| Migração | Conteúdo |
|---|---|
| `0001_initial_schema.sql` | Catálogo, prescrições e execuções. |
| `0002_reference_catalog.sql` | Espelho e controle da sincronização da referência pública. |
| `0003_training_sessions.sql` | Sessões, exercícios da sessão, séries em rascunho e vínculo com execuções. |

A migração `0003` adiciona:

- `training_sessions`;
- `training_session_exercises`;
- `training_session_sets`;
- `execution_records.training_session_id`;
- índice único parcial que permite somente uma sessão com status `active`.

## Regras de integridade

- A finalização é idempotente: repetir a requisição não duplica séries.
- O D1 publica séries e encerra a sessão por lote transacional.
- Identificadores gerados no navegador são temporários e são trocados pelos IDs do servidor antes de salvar séries.
- O rascunho local só é apagado depois que o Worker confirma a conclusão ou o cancelamento.
- Em uma recuperação da mesma sessão, os valores locais vencem os valores antigos do servidor.
- Se o servidor indicar outra sessão ou nenhuma sessão, o rascunho divergente é guardado separadamente para recuperação técnica.
- Nomes fora do catálogo ativo são recusados pelo backend, mesmo que alguém tente chamar a API diretamente.

## Catálogo de referência

A fonte autorizada é:

<https://docs.google.com/spreadsheets/d/1ukUCtws2hV2_PW7JzduQV4cr_EcqVC6-EoHzut1KS0Y/edit?gid=139666673#gid=139666673>

O botão **Atualizar catálogo**, na aba Prescrever, solicita que o Worker leia a planilha pública, valide os dados e atualize o D1. O uso normal do PWA lê apenas D1, evitando peso, latência e dependência constante do Google Sheets. Consulte o [Guia 07](guias-operacionais/07-catalogo-referencia-exercicios.md).

## Validação já executada no repositório

- Testes de schema e domínio das sessões.
- Testes das seis rotas autenticadas de sessão.
- Contratos do frontend Cloudflare.
- Regressões do PWA e proteção das telas existentes.
- Geração dos arquivos estáticos usados pelo Worker.
- Verificação real no navegador em viewport móvel do estado ativo, séries completas/parciais, RER decimal e modal de finalização.
- Suíte Worker: 13 arquivos e 69 testes aprovados antes da publicação.

## Próxima ação

1. Aplicar as migrações pendentes no D1 remoto.
2. Gerar os assets e publicar o Worker.
3. Confirmar `/api/status` e a proteção das rotas sem autenticação.
4. Com a conta Google autorizada, executar o aceite do [Guia 08](guias-operacionais/08-sessao-treino-e-treino-livre.md).
5. Somente depois iniciar a etapa de ciclos dinâmicos e cronograma de periodização.

## Evoluções posteriores

- Quantidade dinâmica de ciclos na prescrição.
- Área de periodização que permita ordenar e repetir ciclos livremente.
- Visualização da flutuação esperada da carga de treino.
- Métrica primária: somatório de `10 − RER` por série.
- Métrica complementar: `repetições × (10 − RER)` por série, somada no treino/ciclo.
- Depois da base funcional, avaliar múltiplos perfis/atletas sem antecipar complexidade multi-tenant.

## Arquivos principais

| Caminho | Função |
|---|---|
| `worker/src/index.js` | Rotas, autenticação e entrada do Worker. |
| `worker/src/training-sessions.js` | Regras de domínio das sessões e publicação das execuções. |
| `worker/migrations/0003_training_sessions.sql` | Estrutura D1 do novo fluxo. |
| `app/index.html` | Estrutura visual do PWA. |
| `app/script.html` | Estado, rascunho offline, sincronização e interação. |
| `app/style.html` | Estilos existentes e pequenos estados visuais do fluxo. |
| `tests/cloudflare/` | Testes do Worker, D1, rotas e contratos estáticos. |
| `tests/app-regression.test.js` | Regressões do frontend e compatibilidade. |
| `docs/guias-operacionais/08-sessao-treino-e-treino-livre.md` | Operação e aceite do novo fluxo. |

## Cuidados ao continuar

- Não alterar Histórico ou Carga sem solicitação explícita.
- Não voltar a usar Apps Script/Sheets como backend operacional.
- Não expor `ALLOWED_GOOGLE_EMAIL` ou `SESSION_SECRET` em arquivos versionados.
- Não versionar `wrangler.jsonc`; somente `wrangler.jsonc.example` é público.
- Não editar dados do D1 manualmente para contornar falhas de sessão.
- Não criar exercícios fora da planilha de referência.
- Não confundir RER com RIR na interface em português.
- Não implementar periodização antes de concluir o aceite da sessão básica.

## Como retomar em outra sessão

1. Leia este arquivo e os Guias 07 e 08.
2. Verifique o repositório com `bash scripts/git-workspace.sh status --short --branch`.
3. Execute `node tests/app-regression.test.js` e a suíte Vitest antes de modificar o fluxo.
4. Consulte `worker/src/training-sessions.js` antes de alterar regras de sessão.
5. Confirme no painel Cloudflare quais migrações e qual versão estão publicadas antes de qualquer nova implantação.

## Contexto para outro chat ou IA

- **Objetivo essencial:** migrar todas as funções básicas do PWA para Cloudflare sem custo, em single tenant.
- **Estado funcional:** autenticação Google, D1, catálogo, prescrição, execução e análises existentes; ciclo de vida explícito da sessão implementado no código.
- **Não desfazer:** design atual, Histórico/Carga, catálogo exclusivo, RER em português, rascunho offline e sessão única.
- **Próxima ação de produto:** validar o fluxo publicado; depois implementar ciclos dinâmicos e cronograma de periodização.

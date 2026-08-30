# Ciclo de vida da sessão de treino e treino livre

## Objetivo

Transformar a aba **Treino** em um fluxo explícito de sessão: selecionar, iniciar, executar, revisar e finalizar ou cancelar. O aplicativo deve permitir treino prescrito e treino livre, impedir duas sessões simultâneas e manter séries incompletas fora de Histórico e Carga.

Esta é a primeira etapa da melhoria das três primeiras abas. **Prescrição** permanece somente leitura. **Prescrever** permanece como área de edição. Ciclos ilimitados, cronograma de periodização e carga prevista serão especificados e implementados em etapas posteriores.

## Restrições aprovadas

- Uso single-tenant e somente uma sessão `in_progress` em toda a aplicação.
- Histórico e Carga não terão interface, cálculo ou consulta alterados nesta etapa.
- O visual atual do PWA será preservado. O wireframe de brainstorming definiu apenas estados e fluxo, não uma nova identidade visual.
- A primeira versão continuará consumindo os quatro ciclos atuais da prescrição. A futura migração para ciclos ilimitados não deverá exigir refazer o ciclo de vida de sessão.
- Iniciar e finalizar exigem internet. O preenchimento de uma sessão já iniciada funciona offline.
- A interface usa **RER — repetições em reserva**. Os valores vão de `0` a `10` em passos de `0,5`.
- A avaliação geral ao finalizar usa **PSE da sessão**, de `1` a `10`, mantendo os passos atuais de `0,5`.

## Abordagem escolhida

Rascunhos de sessão serão armazenados em tabelas próprias. Eles não serão inseridos em `execution_records` enquanto a sessão estiver ativa. Ao finalizar, somente séries válidas serão publicadas atomicamente na tabela existente; então Histórico e Carga poderão enxergá-las sem precisar aprender a filtrar rascunhos.

Esta abordagem foi escolhida em vez de:

1. gravar rascunhos diretamente em `execution_records`, o que obrigaria a alterar as análises existentes; ou
2. manter a sessão somente no navegador, o que não garantiria recuperação nem sessão única.

## Estados e transições

Uma sessão possui um dos estados:

- `in_progress`: sessão única ativa e editável;
- `completed`: séries publicadas e sessão imutável;
- `canceled`: rascunho encerrado sem publicação.

Transições permitidas:

```text
sem sessão ativa -> iniciar -> in_progress
in_progress -> finalizar -> completed
in_progress -> cancelar -> canceled
```

Não há reabertura de sessão finalizada ou cancelada nesta etapa. Uma nova sessão só pode ser criada quando não houver sessão `in_progress`.

## Modelo de dados

### `training_sessions`

Armazena a identidade e o estado da sessão:

- `id` — identificador gerado pelo servidor;
- `session_date` — data escolhida, bloqueada após o início;
- `mode` — `prescribed` ou `free`;
- `status` — `in_progress`, `completed` ou `canceled`;
- `id_ficha` — obrigatório somente no modo prescrito;
- `id_treino` — obrigatório somente no modo prescrito;
- `cycle_reference` — ciclo atual `1..4` no modo prescrito;
- `session_pse` — preenchida somente na finalização;
- `started_at`, `completed_at`, `canceled_at`, `updated_at`.

Um índice único parcial impedirá mais de uma linha com `status = 'in_progress'`.

### `training_session_exercises`

É o retrato editável dos exercícios do dia:

- `id`, `session_id`, `id_exercicio`;
- `exercise_order`;
- `source` — `prescription` ou `session`;
- `observations`;
- metadados prescritos do ciclo selecionado: séries, repetições e descanso esperados.

No modo prescrito, as linhas são copiadas ao iniciar. Alterações posteriores na prescrição não mudam a sessão. No modo livre, a sessão começa sem exercícios. Exercícios adicionados durante o treino precisam estar ativos no catálogo naquele momento.

Um exercício que fique inativo no catálogo depois de ter sido copiado poderá ser concluído naquela sessão.

### `training_session_sets`

Armazena rascunhos de séries:

- `id`, `session_id`, `session_exercise_id`, `set_order`;
- `load_value` — campo anulável no rascunho; quando preenchido, número maior ou igual a zero;
- `repetitions` — campo anulável no rascunho; quando preenchido, inteiro maior que zero;
- `rer` — campo anulável no rascunho; quando preenchido, número de `0` a `10` cujo dobro seja inteiro;
- `updated_at`.

Linhas totalmente vazias representam espaço de preenchimento e não são publicadas. Uma linha parcialmente preenchida é inválida para finalização.

### Compatibilidade com `execution_records`

Uma coluna opcional `training_session_id` será acrescentada para idempotência e rastreabilidade. Registros antigos permanecerão com valor vazio e não serão alterados.

Na publicação, `rer` será gravado na coluna legada `rir`. A API e a interface novas usarão o nome `rer`; leitores antigos continuarão recebendo `rir` até que Histórico e Carga sejam modernizados em outra etapa.

Os identificadores das séries finalizadas continuarão compatíveis com a extração atual de ficha e treino. Para treino livre, a publicação usará `Livre` como ficha interna e `TreinoLivre-<id-curto-da-sessão>` como treino interno. Nenhum desses valores contém sublinhado; portanto, o parser legado continuará agrupando a sessão corretamente e duas sessões livres na mesma data não serão misturadas.

## APIs

Todas as rotas seguem protegidas pela sessão Google existente.

- `POST /api/training-sessions` — inicia sessão prescrita ou livre; exige internet e, quando já existe uma sessão ativa, responde `409 ACTIVE_SESSION_EXISTS` incluindo a sessão que deve ser retomada.
- `GET /api/training-sessions/active` — retorna a sessão ativa completa ou `null`.
- `PUT /api/training-sessions/:id/exercises` — substitui ordem e composição dos exercícios do rascunho.
- `PUT /api/training-sessions/:id/sets` — salva séries de rascunho de modo idempotente.
- `POST /api/training-sessions/:id/complete` — valida, publica séries e finaliza atomicamente.
- `POST /api/training-sessions/:id/cancel` — marca como cancelada sem publicar séries.

Cada mutação verifica que a sessão existe, está `in_progress` e corresponde ao identificador informado. Finalizar duas vezes devolve o resultado já concluído ou uma resposta idempotente, sem duplicar séries.

## Fluxo da aba Treino

### Sem sessão ativa

A tela mantém o design atual e apresenta:

1. data, inicialmente hoje;
2. alternância entre **Treino prescrito** e **Treino livre**;
3. no modo prescrito: ficha, treino e um dos quatro ciclos atuais;
4. botão **Iniciar treino**.

O modo prescrito exige todos os campos. O modo livre exige somente a data. O início consulta o servidor, cria a sessão e muda imediatamente a tela para o estado ativo.

### Sessão ativa

Seletores deixam de ser editáveis e a tela exibe somente a sessão ativa até finalizar ou cancelar. O cabeçalho informa modalidade, data e, quando aplicável, ficha, treino e ciclo.

Os cartões de exercícios preservam os componentes e o estilo atuais. O usuário pode:

- preencher carga, repetições e RER por série;
- adicionar e remover séries;
- adicionar, remover e reordenar exercícios naquela sessão;
- continuar preenchendo sem internet.

Treino livre começa com um estado vazio e ação **Adicionar exercício**. Ele usa o mesmo editor de séries do treino prescrito.

### Salvamento de rascunho

Cada alteração é salva primeiro no armazenamento local. Com conexão, o cliente envia atualizações idempotentes ao D1 com pequeno atraso para consolidar digitação. Um indicador já compatível com o visual atual mostra `salvando`, `salvo` ou `pendente`.

Ao reabrir o aplicativo, o cliente consulta a sessão ativa no servidor, combina atualizações locais ainda não confirmadas e volta ao mesmo treino. Dados locais nunca são apagados antes da confirmação do servidor.

### Revisar e finalizar

A ação de finalização exige conexão e abre um resumo no estilo dos modais existentes:

- exercícios realizados;
- séries preenchidas versus previstas;
- exercícios ou séries prescritos não realizados;
- campos parcialmente preenchidos que precisam de correção;
- PSE geral de `1` a `10`, em passos de `0,5`.

Regras:

- pelo menos uma série válida;
- carga maior ou igual a zero;
- repetições inteiras maiores que zero;
- RER presente, entre `0` e `10`, em passos de `0,5`;
- linhas vazias ignoradas;
- linhas parciais bloqueiam a finalização.

Depois da confirmação, uma única operação transacional insere as séries válidas em `execution_records`, grava a PSE em `rpe_sessao`, vincula `training_session_id` e muda a sessão para `completed`. A interface só libera o início de outra sessão depois da confirmação.

### Cancelar

Cancelar pede confirmação explícita, marca a sessão como `canceled`, mantém o rascunho apenas para auditoria no D1 e remove o cache ativo do aparelho depois da confirmação. Nenhuma linha é criada em `execution_records`.

## Erros e concorrência

- Início ou finalização offline não muda o estado; o app preserva o rascunho e informa que é necessário reconectar.
- Tentativa de iniciar com uma sessão ativa retorna essa sessão e abre o treino existente.
- Falha de sincronização mantém mudanças locais como pendentes.
- A sessão ativa é protegida no banco, não apenas na interface.
- Finalização é idempotente e não pode publicar séries duas vezes.
- Falhas durante a publicação mantêm a sessão `in_progress` e não deixam execução parcial visível.
- Alterações posteriores na prescrição ou no catálogo não reescrevem o retrato de uma sessão iniciada.

## Segurança e custo

As rotas usam a autenticação Google e o single tenant atuais. Não há acesso direto do navegador ao D1. O volume é pequeno: uma sessão ativa, poucos exercícios e séries, dentro das cotas gratuitas atuais do D1 e Workers.

## Migração e compatibilidade

- Criar as três novas tabelas e índices por migração incremental.
- Acrescentar `training_session_id` opcional a `execution_records`.
- Não atualizar, excluir ou recalcular registros históricos existentes.
- Manter as respostas atuais de Histórico e Carga.
- Migrar o frontend Treino para as novas rotas sem remover o funcionamento offline.
- Prescrição e Prescrever continuam usando os quatro ciclos atuais até a etapa de ciclos ilimitados.

## Testes e aceite

Testes automatizados cobrirão:

- criação prescrita e livre;
- bloqueio de segunda sessão ativa;
- snapshot da prescrição;
- adição, remoção e ordem de exercícios do rascunho;
- RER válido em passos de `0,5` e rejeição de valores inválidos;
- salvamento idempotente de séries;
- recuperação da sessão ativa;
- linhas vazias, parciais e finalização incompleta;
- PSE obrigatória;
- cancelamento sem publicação;
- finalização atômica e sem duplicidade;
- ausência de rascunhos nas APIs existentes de Histórico e Carga;
- preservação dos registros antigos;
- contrato estático dos três estados da aba Treino.

Aceite manual:

1. Iniciar treino prescrito e confirmar o bloqueio dos seletores.
2. Reabrir o PWA e recuperar a sessão.
3. Ficar offline, preencher séries, reconectar e verificar sincronização.
4. Finalizar parcialmente com linhas vazias e confirmar que linhas parciais são bloqueadas.
5. Confirmar PSE e verificar a sessão em Histórico e Carga somente depois da finalização.
6. Iniciar treino livre, adicionar exercícios, finalizar e confirmar o agrupamento.
7. Cancelar uma sessão e confirmar que ela não aparece nas análises.

## Fora de escopo

- Alterar o design visual do PWA.
- Redesenhar Histórico ou Carga.
- Modificar métricas de treinos já realizados.
- Implementar ciclos ilimitados.
- Implementar cronograma de periodização.
- Calcular carga prevista por `séries × (10 − RER)` ou `séries × repetições × (10 − RER)`; essas métricas dependem do futuro modelo de ciclos e entram na etapa correspondente.
- Multi-tenant, múltiplos perfis ou permissões adicionais.

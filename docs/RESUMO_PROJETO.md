# Resumo do Projeto

## Visao geral

Este projeto e um Web App em Google Apps Script para ficha de treino, com foco mobile e fluxo offline-first.

- Backend: `app/Código.gs`
- Frontend: `app/index.html`, `app/script.html`, `app/style.html`
- Manifesto do Apps Script: `app/appscript.json`
- Base de dados principal: planilha Google com abas `DB_Prescricao`, `DB_Execucao` e `DB_GestaoCarga`

## Como o app funciona

Ao abrir o Web App, `doGet()` renderiza `index.html`, que inclui CSS e JavaScript via `include()`.

No carregamento da pagina:

1. `App.init()` define a data atual, carrega pendencias do `localStorage`, atualiza o badge de sincronizacao e inicia a navegacao.
2. `index.html` injeta `window.__XS_BOOTSTRAP__` com o retorno de `getInitialAppDataJson()`.
3. `fetchInitialData()` consome um pacote unico de boot com:
   - `prescricao.rows`
   - `historico.rows`
   - `status`
4. Quando os dados essenciais terminam, o loader global e escondido e a tela inicial de treino e renderizada.
5. A gestao de carga e carregada em segundo plano, sem bloquear a abertura do app.

## Estrutura das telas

### 1. Treino

Tela principal de execucao.

- Filtra por `ficha`, `treino` e `data`
- Renderiza exercicios da prescricao da semana ativa
- Permite adicionar/remover series por exercicio
- Salva carga, repeticoes e RIR no `localStorage`
- Gera `id_sessao` por exercicio/semana/data/serie
- Tenta sincronizar com a planilha quando ha internet

### 2. Prescricao

Mostra a ficha organizada por treino e semana.

- Agrupa por `id_treino`
- Exibe sets, reps, descanso e observacoes
- Compartilha o filtro de ficha com a tela de treino

### 3. Historico

Mostra as execucoes agrupadas por data.

- Cada card resume volume total, numero de exercicios e numero de series
- Ao abrir o modal, exibe detalhes por exercicio e serie

### 4. Carga

Dashboard visual calculado a partir do historico.

- KPIs de volume, RPE medio, volume acumulado e total de sessoes
- Grafico de volume por sessao
- Grafico de carga geral
- Grafico de progressao por exercicio com selecao de ate 3 exercicios

## Modelo de dados identificado

### DB_Prescricao

Cabecalho atual da planilha-base:

- `id_ficha`
- `id_treino`
- `id_exercicio`
- `observacoes`
- `ordem_exercicio`
- `semana_1_sets`
- `semana_1_reps`
- `semana_1_descanso`
- `semana_2_sets`
- `semana_2_reps`
- `semana_2_descanso`
- `semana_3_sets`
- `semana_3_reps`
- `semana_3_descanso`
- `semana_4_sets`
- `semana_4_reps`
- `semana_4_descanso`

Regras de uso no app:

- a aba lida pelo app precisa se chamar exatamente `DB_Prescricao`;
- a linha 1 precisa conter os cabecalhos acima;
- cada linha valida precisa ter `id_exercicio` preenchido;
- `id_ficha` alimenta o filtro Ficha;
- `id_treino` alimenta o filtro Treino;
- na tela Treino, o app filtra por Ficha + Treino + Semana ativa;
- na Semana 1, a linha aparece como exercicio prescrito quando `semana_1_sets` e/ou `semana_1_reps` estao preenchidos;
- espacos extras em `id_ficha`, `id_treino`, `id_exercicio` e `observacoes` sao normalizados pelo backend.

### DB_Execucao

Esperada pelo backend:

- `id_sessao`
- `data_treino`
- `id_exercicio`
- `semana_referencia`
- `carga_absoluta`
- `reps_executadas`
- `rir`
- `rpe_sessao`
- `sync_status`

### DB_GestaoCarga

Gerada/atualizada no backend com resumo por sessao:

- `data_sessao`
- `exercicio_principal`
- `volume_load`
- `e1RM`
- `rpe_sessao_agregado`

## Fluxo de sincronizacao

O app guarda execucoes localmente em `xs_pending`.

- Ao registrar uma serie, cria um objeto com `sync_status: "pending"`
- O badge mostra quantos registros ainda nao foram sincronizados
- `syncToServer()` envia apenas itens pendentes
- O backend faz upsert na aba `DB_Execucao`
- Depois do sucesso, os itens locais passam para `sync_status: "clean"`

## Observacoes importantes encontradas

- O projeto mistura dois modelos de schema da prescricao: um antigo sem `id_ficha` e o atual com `id_ficha`
- A tela de carga hoje usa `historicoCache` no frontend, mesmo havendo uma rota/back-end especifica de gestao de carga
- O backend recalcula e tenta escrever `DB_GestaoCarga` durante a leitura de dados da carga

## Correcao aplicada para o "carregamento infinito"

O loader deixou de depender da chamada de gestao de carga. Agora ele depende apenas de prescricao e historico, que sao os dados essenciais para abrir a tela de treino.

Tambem foram aplicados ajustes defensivos:

- timeout de 12 segundos com fallback para cache local
- fallback independente no `index.html` que libera o loader apos 8 segundos mesmo se o script principal quebrar
- mensagens de status no loader para diagnosticar em que etapa o boot travou
- leitura segura do `localStorage`
- carregamento de gestao de carga em segundo plano
- `clientGetGestaoCarga()` sem escrita automatica em `DB_GestaoCarga`
- `setupDatabase()` alinhado ao schema atual com `id_ficha`
- `id_sessao` incluindo ficha e treino para reduzir colisao entre treinos
- RPE alterado apos sincronizacao volta para `pending` e pode ser reenviado

## Proximos passos

- publicar nova versao do Web App no Apps Script
- testar abertura inicial com a planilha real
- testar registro de serie, RPE e sincronizacao
- criar documentacao de deploy do Apps Script

## Correcao aplicada para leitura da planilha real

A planilha-base atual e:

- `1x4tHTYIr4GKuBqyW_SnoUsQaC9U1PeIgsKdXrXaztG8`

O backend passou a usar `getSpreadsheet()` como ponto unico de acesso a base:

- primeiro tenta `ScriptProperties.SPREADSHEET_ID`;
- depois tenta o ID da planilha-base acima;
- se algum ID explicito falhar por acesso/autorizacao, registra o erro e tenta o proximo caminho;
- por fim usa `SpreadsheetApp.getActiveSpreadsheet()` como fallback para scripts vinculados.

Tambem foi adicionado `getAppStatus()`/`clientGetAppStatus()` para diagnosticar abas, linhas de dados e cabecalhos ausentes. A leitura de `DB_Prescricao` agora normaliza espacos extras em `id_ficha`, `id_treino`, `id_exercicio` e observacoes, evitando que valores como `Treino 1 ` quebrem os filtros do frontend.

No frontend, quando a prescricao vier vazia ou falhar, o app deixa de mascarar o problema como tela vazia simples e passa a mostrar uma mensagem de diagnostico na tela de treino, incluindo o detalhe do erro quando o Apps Script retornar uma causa, mantendo o cache local como fallback.

Tambem foi tratado o caso em que `google.script.run` retorna `null` para chamadas de leitura. Nessa situacao, o frontend agora considera a resposta invalida e cai para cache local com uma mensagem clara, sem tentar parsear como JSON uma resposta HTML do Web App publicado. As leituras de prescricao e historico tambem passaram a validar `data` antes de acessar `data.rows`, evitando que uma resposta vazia quebre a renderizacao.

No frontend publicado, `google.script.run` deve ser tratado como proxy do Apps Script. O app nao verifica mais `typeof google.script.run[metodo]`, porque essa checagem pode falhar e desviar indevidamente para `fetch`. Quando `google.script.run` existe, ele e o caminho principal para `clientGetPrescricao`, `clientGetHistorico` e demais funcoes do backend.

Para reduzir fragilidade na abertura, o contrato principal agora e `getInitialAppData()`/`clientGetInitialData()`. Ele retorna um objeto simples:

- `prescricao: { rows: [...] }`
- `historico: { rows: [...] }`
- `status: { prescricaoRows, historicoRows, prescricaoSheet, execucaoSheet }`
- `errors`/`error` quando alguma leitura parcial falhar

Esse pacote e tambem injetado no HTML como `window.__XS_BOOTSTRAP__`, antes do `script.html`. Assim o filtro Ficha/Treino pode ser populado a partir dos dados renderizados pelo proprio backend, sem depender de multiplas chamadas iniciais.

## Compatibilidade do frontend com Apps Script

Como o Web App publicado pelo HtmlService pode falhar durante a injecao do HTML com `document.write`, o `app/script.html` foi convertido para uma sintaxe mais conservadora.

Evitar no frontend publicado:

- virgulas finais antes de `]`, `}` ou `)`;
- `const` e `let`;
- arrow functions;
- template literals;
- spread syntax e optional chaining;
- `Set`, `Array.from`, `Object.values`, `Object.assign`;
- `requestAnimationFrame`;
- `new URL`;
- `NodeList.forEach` e `dataset`.

Foram adicionados helpers simples no frontend para substituir esses recursos quando necessario. A suite local agora protege essa compatibilidade em `tests/app-regression.test.js`.

## Arquitetura de IA hibrida

Foi definida uma arquitetura hibrida para relatorios interpretativos: regras deterministicas no Apps Script, memoria estruturada na planilha e IA apenas sob demanda.

A regra maxima e custo zero. A IA nao roda no carregamento, nao participa do registro de treino e nao faz chamadas automaticas. Quando houver botao de relatorio, o app deve montar um contexto compacto a partir das abas de memoria e so entao chamar o modelo.

O boot do app nao usa `DB_GestaoCarga`, `DB_MemoriaBase`, `DB_MemoriaExercicio` nem `DB_Insights`. Essas abas nao podem bloquear a leitura de `DB_Prescricao` nem a populacao dos filtros da tela Treino.

Novas abas previstas/gerenciadas:

- `DB_MemoriaBase`: snapshots consolidados por periodo e tipo de relatorio
- `DB_MemoriaExercicio`: variaveis por exercicio dentro de cada snapshot
- `DB_Insights`: historico de respostas de IA e contexto usado

`DB_GestaoCarga` continua sendo usada pelo app como cache/resumo por sessao, principalmente para telas, graficos e estatisticas rapidas.

## Setup seguro da planilha

`setupDatabase()` foi redesenhado para ser nao destrutivo.

Agora ele cria abas gerenciadas se faltarem, acrescenta cabecalhos ausentes e formata a linha 1, mas nao apaga dados existentes e nao mexe em abas criadas manualmente fora da lista gerenciada.

Documentacao detalhada: `docs/ARQUITETURA_IA_HIBRIDA.md`

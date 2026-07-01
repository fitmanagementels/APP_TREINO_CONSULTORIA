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
2. `fetchInitialData()` busca dois blocos essenciais do servidor via `google.script.run`:
   - prescricao
   - historico/execucao
3. Quando as chamadas essenciais terminam, o loader global e escondido e a tela inicial de treino e renderizada.
4. A gestao de carga e carregada em segundo plano, sem bloquear a abertura do app.

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

## Arquitetura de IA hibrida

Foi definida uma arquitetura hibrida para relatorios interpretativos: regras deterministicas no Apps Script, memoria estruturada na planilha e IA apenas sob demanda.

A regra maxima e custo zero. A IA nao roda no carregamento, nao participa do registro de treino e nao faz chamadas automaticas. Quando houver botao de relatorio, o app deve montar um contexto compacto a partir das abas de memoria e so entao chamar o modelo.

Novas abas previstas/gerenciadas:

- `DB_MemoriaBase`: snapshots consolidados por periodo e tipo de relatorio
- `DB_MemoriaExercicio`: variaveis por exercicio dentro de cada snapshot
- `DB_Insights`: historico de respostas de IA e contexto usado

`DB_GestaoCarga` continua sendo usada pelo app como cache/resumo por sessao, principalmente para telas, graficos e estatisticas rapidas.

## Setup seguro da planilha

`setupDatabase()` foi redesenhado para ser nao destrutivo.

Agora ele cria abas gerenciadas se faltarem, acrescenta cabecalhos ausentes e formata a linha 1, mas nao apaga dados existentes e nao mexe em abas criadas manualmente fora da lista gerenciada.

Documentacao detalhada: `docs/ARQUITETURA_IA_HIBRIDA.md`

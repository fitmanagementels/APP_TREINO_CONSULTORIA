# Arquitetura de IA Hibrida e Memoria do App

## Decisao principal

Vamos usar uma arquitetura hibrida: regras deterministicas no Apps Script + memoria estruturada na planilha + IA apenas quando o usuario pedir um relatorio.

A regra maxima continua sendo custo zero: nenhuma chamada automatica a IA, nenhum credito pago e nenhum aumento de limite contratado.

## Como fica o uso da IA

A IA nao participa do uso normal do app. Registrar treino, sincronizar series, abrir historico e ver carga devem continuar funcionando sem IA.

A IA entra somente por uma acao explicita, como um botao de relatorio. Quando acionada, ela recebe um pacote compacto com dados ja resumidos pelo app, nao a planilha inteira.

O app nao faz machine learning. Ele nao treina modelo proprio e nao muda sozinho a forma de interpretar. O que evolui com o tempo e a memoria estruturada: mais sessoes, mais snapshots, mais insights salvos e mais contexto historico resumido.

## Como fica a estrutura da planilha

Abas principais do app:

- DB_Prescricao: ficha prescrita por ficha, treino, exercicio e semanas.
- DB_Execucao: registro granular de series executadas.
- DB_GestaoCarga: cache/resumo por sessao para alimentar telas e analises rapidas.

Abas de memoria e IA:

- DB_MemoriaBase: snapshots consolidados por periodo e tipo de relatorio.
- DB_MemoriaExercicio: resumo por exercicio dentro de cada snapshot.
- DB_Insights: respostas de IA, prompt resumido, periodo, status e modelo usado.

Abas manuais:

Qualquer aba criada manualmente fora da lista gerenciada nao deve ser apagada, recriada ou alterada pelo setupDatabase. Ela pode ser lida futuramente por funcoes especificas, mas isso precisa ser uma decisao explicita no codigo.

## Como fica o setupDatabase

O setupDatabase agora e seguro e idempotente.

Ele faz:

- cria abas gerenciadas se elas nao existirem;
- acrescenta colunas esperadas que ainda estejam faltando;
- formata a linha de cabecalho;
- preserva dados existentes;
- preserva abas manuais.

Ele nao faz:

- clear na planilha;
- recriacao destrutiva de abas;
- exclusao de linhas;
- alteracao de abas fora da lista gerenciada.

## Como fica a estrutura do app

Camada 1 - Uso normal:

- usuario registra series e RPE;
- app salva localmente primeiro;
- sincronizacao envia dados para DB_Execucao;
- tela abre sem depender de IA e sem depender da escrita em DB_GestaoCarga.

Camada 2 - Cache de sessao:

- DB_GestaoCarga resume sessoes por data, ficha e treino;
- esse cache pode alimentar cards, graficos e analises rapidas;
- a atualizacao deve ser acionada quando necessario, nao no boot essencial.

Camada 3 - Memoria estruturada:

- DB_MemoriaBase guarda snapshots por periodo;
- DB_MemoriaExercicio guarda variaveis por exercicio;
- os dados sao numericos, filtraveis e reutilizaveis sem gastar tokens.

Camada 4 - IA sob demanda:

- o app monta um contexto compacto a partir das memorias;
- a IA interpreta esse contexto e gera texto;
- a resposta e salva em DB_Insights;
- chamadas repetidas podem reaproveitar insights anteriores.

## Como a memoria sera formada

A memoria nao depende da IA para saber o que guardar. O app usa regras fixas para calcular variaveis importantes:

- volume total;
- RPE medio;
- frequencia de sessoes;
- melhor carga;
- melhor e1RM estimado;
- variacao de volume;
- variacao de carga;
- exercicios com recordes;
- exercicios com queda;
- possiveis estagnacoes;
- alertas simples por excesso de RPE ou queda de desempenho.

Essas informacoes viram snapshots estruturados. A IA recebe o snapshot pronto e interpreta, em vez de analisar milhares de celulas brutas.

## Performance

Para o app nao ficar lento:

- o carregamento inicial usa apenas prescricao e historico essencial;
- gestao de carga roda em segundo plano ou por acao explicita;
- memoria estruturada e relatorios sao gerados sob demanda;
- IA nunca roda automaticamente no boot;
- respostas de IA ficam cacheadas em DB_Insights.

## Filtros de relatorio

Os relatorios devem usar filtros de tempo:

- ultima semana;
- ultimos 30 dias;
- ultimos 90 dias;
- personalizado com data inicial e final.

Cada snapshot precisa registrar o filtro usado, a data inicial e a data final. Isso evita confusao historica e permite comparar relatorios depois.

## Estado atual da implementacao

Implementado agora:

- setupDatabase seguro e nao destrutivo;
- contrato das abas DB_MemoriaBase, DB_MemoriaExercicio e DB_Insights;
- DB_GestaoCarga mantida como cache de resumo por sessao;
- atualizacao de DB_GestaoCarga por upsert, sem limpar a aba inteira;
- testes locais protegendo esse comportamento.

Ainda nao implementado:

- tela final de relatorios com IA;
- chamada real para Gemini;
- botoes de gerar snapshot e gerar insight;
- politica de reaproveitamento automatico de insights antigos.
# Historico, Status e Proximas Atualizacoes

## Historico do projeto

Este documento registra o que ja foi feito no projeto da ficha de treino em Google Apps Script e serve como memoria de trabalho para as proximas etapas.

### 1. Importacao dos arquivos do app

O projeto recebeu os arquivos de um Web App criado em Google Apps Script:

- `app/appscript.json`
- `app/Código.gs`
- `app/index.html`
- `app/script.html`
- `app/style.html`

Esses arquivos formam uma aplicacao mobile-first para prescricao e execucao de treinos, usando uma planilha Google como base de dados.

### 2. Identificacao da base de dados

Foi analisada a planilha-base usada pelo app. A aba principal de prescricao usa o seguinte modelo:

- `id_ficha`
- `id_treino`
- `id_exercicio`
- `observacoes`
- `ordem_exercicio`
- campos semanais de sets, reps e descanso para as semanas 1 a 4

Tambem foi identificado que o app espera abas auxiliares para execucao e gestao de carga:

- `DB_Execucao`
- `DB_GestaoCarga`

### 3. Entendimento da arquitetura

O projeto foi mapeado em tres partes principais:

- Backend em Google Apps Script, responsavel por ler e gravar dados na planilha.
- Frontend HTML/CSS/JS, responsavel pela interface mobile e fluxo offline-first.
- Documentacao local em Markdown, para manter entendimento e decisoes do projeto.

### 4. Resumo tecnico inicial

Foi criado o arquivo `RESUMO_PROJETO.md`, contendo:

- visao geral do app
- estrutura das telas
- modelo de dados identificado
- fluxo de sincronizacao
- hipoteses para o erro de carregamento infinito
- proximos passos tecnicos

### 5. Revisao inicial de riscos

Na primeira revisao do codigo, foram encontrados pontos importantes:

- o carregamento inicial depende de tres chamadas assicronas, incluindo uma chamada de gestao de carga que nao e essencial para abrir a tela principal
- existem sinais de schema antigo e schema novo misturados na prescricao
- `setupDatabase()` cria `DB_Prescricao` sem `id_ficha`, mas a planilha atual usa `id_ficha`
- o RPE pode ser perdido se a sincronizacao acontecer antes do usuario confirmar o RPE da sessao
- o `id_sessao` nao inclui `id_ficha` nem `id_treino`, podendo causar colisao entre treinos

### 6. Reorganizacao das pastas

O projeto foi reorganizado em duas pastas:

- `app/`: arquivos de codigo do Web App
- `docs/`: arquivos explicativos e documentacao do projeto

### 7. Correcao do carregamento infinito

Foi criada uma suite de regressao local em `tests/app-regression.test.js` e o fluxo de carregamento foi ajustado.

Mudancas principais:

- `fetchInitialData()` agora libera a tela com prescricao e historico
- gestao de carga passou a carregar em segundo plano
- o loader tem fallback por timeout usando cache local
- leituras de `localStorage` ficaram protegidas contra JSON invalido
- `setupDatabase()` foi alinhado ao schema atual de `DB_Prescricao` com `id_ficha`
- `clientGetGestaoCarga()` deixou de escrever em `DB_GestaoCarga` durante o boot
- `id_sessao` passou a incluir ficha e treino
- RPE alterado depois da sincronizacao volta para `pending`

### 8. Fallback independente do loader

Como o carregamento eterno continuou no ambiente real, foi adicionado um fallback direto em `app/index.html`, antes do include de `script.html`.

Esse fallback:

- registra erros globais de JavaScript no console
- atualiza o texto do loader com a etapa atual
- libera o loader apos 8 segundos mesmo se o script principal quebrar
- troca skeletons por uma mensagem de modo seguro
- cria `window.__xsReleaseLoader` e `window.__xsSetLoaderStatus` para o app principal usar
- garante que `App.init()` rode mesmo se `DOMContentLoaded` ja tiver disparado

## Status atual

No momento, o carregamento infinito foi tratado em duas camadas: fluxo principal resiliente em `script.html` e fallback independente em `index.html`.

O foco atual e:

- publicar a versao atualizada no Apps Script
- testar com a planilha real
- validar abertura inicial, registro de series, RPE e sincronizacao
- continuar usando `docs/` como memoria viva do projeto

## Arquivos atuais

### Codigo do app

- `app/appscript.json`
- `app/Código.gs`
- `app/index.html`
- `app/script.html`
- `app/style.html`
- `tests/app-regression.test.js`

### Documentacao

- `docs/RESUMO_PROJETO.md`
- `docs/HISTORICO_STATUS_PROJETO.md`
- `docs/index.html`

## Atualizacoes futuras recomendadas

### Prioridade alta

- publicar nova versao do Web App no Apps Script
- testar a abertura inicial na URL publicada
- testar registro de serie e sincronizacao com `DB_Execucao`
- testar RPE depois de uma sincronizacao ja concluida

### Prioridade media

- separar melhor dados pendentes, dados sincronizados e historico vindo da planilha
- melhorar mensagens de erro para o usuario final
- criar uma acao explicita para atualizar `DB_GestaoCarga` quando necessario

### Prioridade baixa

- criar uma rotina de diagnostico para validar abas e colunas da planilha
- criar uma documentacao de deploy do Apps Script
- padronizar nomes de arquivos sem acentos, caso isso ajude ferramentas externas
- evoluir o visualizador de docs para carregar novos documentos automaticamente quando usado com servidor local

## Proximo passo tecnico sugerido

O proximo trabalho tecnico sugerido e publicar e testar a versao corrigida no ambiente real do Apps Script:

- abrir o Web App publicado
- confirmar que o loader some mesmo se gestao de carga demorar
- registrar uma serie em um treino
- finalizar a sessao com RPE
- conferir a linha criada/atualizada em `DB_Execucao`

### 9. Planejamento da IA hibrida e memoria estruturada

Foi escolhido um modelo hibrido para relatorios interpretativos: o app calcula e guarda memoria estruturada, e a IA entra apenas quando o usuario solicitar um relatorio.

Decisoes aprovadas:

- custo zero como regra maxima;
- Gemini ou outra IA somente por botao/acesso explicito;
- sem machine learning proprio no app;
- memoria formada por snapshots numericos e JSONs compactos;
- `DB_GestaoCarga` mantida como cache/resumo de sessoes do app;
- criacao das abas `DB_MemoriaBase`, `DB_MemoriaExercicio` e `DB_Insights`;
- `setupDatabase()` nao pode apagar dados nem mexer em abas manuais.

### 10. Ajuste seguro do backend da planilha

O arquivo `app/Código.gs` foi atualizado para:

- centralizar schemas em constantes;
- criar/atualizar apenas abas gerenciadas;
- preservar dados existentes;
- preservar abas manuais;
- atualizar `DB_GestaoCarga` por upsert;
- ampliar `DB_GestaoCarga` para resumo por sessao, ficha e treino;
- preparar as abas de memoria para os proximos relatorios.

## Status atual atualizado

Estamos preparando a base tecnica para relatorios pos-treino e analises por periodo sem deixar o app lento.

Implementado nesta etapa:

- contrato de planilha para memoria hibrida;
- setup seguro e nao destrutivo;
- documentacao da arquitetura de IA hibrida;
- testes de regressao para proteger setup, memoria e `DB_GestaoCarga`.

Proximo passo sugerido:

- colar o novo `app/Código.gs` no Apps Script;
- rodar `setupDatabase()` uma vez;
- conferir se as abas foram criadas sem apagar dados;
- depois implementar a tela/botao de analise detalhada pos-treino.

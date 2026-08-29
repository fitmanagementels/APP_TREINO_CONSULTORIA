# Migração do PWA para Cloudflare — Design Single Tenant

**Status:** aprovado para planejamento em 29 de agosto de 2026  
**Objetivo:** retirar Google Apps Script e Google Sheets do caminho de produção, preservando todas as funções atuais do PWA em uma única instalação operacional no Cloudflare.

## 1. Escopo e decisões

Esta entrega é **single tenant**. Existe uma única base de dados e não haverá, nesta fase, cadastro de usuário, perfil de aluno, autorização por papel ou separação de dados por cliente.

O resultado precisa manter as cinco telas existentes:

1. **Treino:** leitura da prescrição, registro de séries e fila offline.
2. **Prescrição:** visualização do ciclo de quatro semanas.
3. **Prescrever:** criação e edição de uma combinação ficha + treino, validada pelo catálogo muscular.
4. **Histórico:** consulta das execuções sincronizadas.
5. **Carga:** cálculo e visualização dos indicadores que hoje derivam de `DB_Execucao`.

Ficam fora desta entrega: login, múltiplos alunos, compartilhamento de fichas, IA generativa, anexos/fotos e alteração visual ampla. As tabelas de memória e insights poderão ser criadas somente quando uma função que as use for implementada; não devem atrasar o funcionamento básico.

## 2. Arquitetura-alvo

```text
Navegador / PWA
  ├─ interface existente, cache e fila local
  └─ HTTPS JSON
             │
Cloudflare Worker com Static Assets
  ├─ entrega index.html, script e estilos
  ├─ API de prescrição, treino, histórico e carga
  ├─ validação de payloads e resposta padronizada
  └─ regras de negócio hoje em Código.gs
             │ binding D1
Cloudflare D1 (SQLite)
  ├─ catálogo muscular
  ├─ prescrições e ciclos
  ├─ execuções de séries
  └─ resumos de carga (se materializados)
```

Um único Worker publica frontend e API no mesmo domínio, eliminando CORS e a dependência de `HtmlService`. O frontend continuará JavaScript sem framework nesta fase. `fetchServerAction()` já fornece uma base de transporte HTTP; `callServer()` será simplificado depois que Apps Script deixar de ser suportado.

R2 não entra no MVP: o projeto atual não manipula arquivos. R2 será adicionado apenas quando houver um requisito concreto de anexos.

## 3. Modelo de dados D1

O modelo conserva os contratos que o frontend conhece, mas usa relações e índices em vez de abas planas.

| Origem Google Sheets | Destino D1 | Regra de migração |
|---|---|---|
| `Demanda_Muscular` | `exercise_catalog` e `exercise_muscle_demands` | Cada exercício preserva nome, grupo, tipo e demandas. |
| `DB_Prescricao` | `prescription_exercises` | Uma linha por exercício em uma combinação de ficha e treino; as colunas `semana_1..4` permanecem inicialmente para não quebrar o payload atual. |
| `DB_Execucao` | `execution_records` | Uma linha por `id_sessao`; `id_sessao` continua a chave idempotente da sincronização. |
| `DB_GestaoCarga` | consulta SQL e, se necessário, `session_summaries` | Os indicadores são calculados a partir de execuções. A tabela materializada só será preenchida por ação explícita, nunca no boot. |
| `DB_MemoriaBase`, `DB_MemoriaExercicio`, `DB_Insights` | não migradas no MVP | Não possuem função de UI/IA atual. O CSV original será preservado como backup. |

### Tabelas e chaves iniciais

- `exercise_catalog(id_exercicio PRIMARY KEY, grupo_principal, tipo, created_at, updated_at)`.
- `exercise_muscle_demands(id_exercicio, muscle_name, demand, PRIMARY KEY(id_exercicio, muscle_name))`.
- `prescription_exercises(id_ficha, id_treino, id_exercicio, observacoes, ordem_exercicio, semana_1_sets, semana_1_reps, semana_1_descanso, ... semana_4_descanso, PRIMARY KEY(id_ficha, id_treino, ordem_exercicio))`.
- `execution_records(id_sessao PRIMARY KEY, data_treino, id_exercicio, semana_referencia, carga_absoluta, reps_executadas, rir, rpe_sessao, sync_status, created_at, updated_at)`.

Índices obrigatórios:

- `prescription_exercises(id_ficha, id_treino, ordem_exercicio)`;
- `execution_records(data_treino)`;
- `execution_records(id_exercicio, data_treino)`.

O Worker extrairá `id_ficha` e `id_treino` de `id_sessao` enquanto o cliente ainda usar esse formato. Em uma etapa posterior, esses valores podem ser enviados e persistidos explicitamente, sem alterar a chave de deduplicação.

## 4. Contrato de API

As respostas de sucesso seguem `{ success: true, data }`; falhas seguem `{ success: false, error, code }`. Rotas de leitura não alteram o banco.

| Método e rota | Substitui | Comportamento |
|---|---|---|
| `GET /api/bootstrap` | `getInitialAppData()` | Retorna prescrição, histórico, status e erros não bloqueantes. |
| `GET /api/status` | `getAppStatus()` | Confirma saúde básica e contagens. |
| `GET /api/prescriptions` | `getPrescricaoData()` | Retorna linhas ordenadas da prescrição. |
| `GET /api/prescription-editor` | `getPrescriptionEditorData()` | Retorna catálogo, prescrição, fichas e treinos por ficha. |
| `PUT /api/prescriptions/{idFicha}/{idTreino}` | `savePrescricaoTreino()` | Valida exercícios contra o catálogo e substitui atomicamente somente aquela combinação. |
| `GET /api/executions` | `getExecucaoData()` e histórico | Retorna execuções. |
| `POST /api/executions/sync` | `syncExecucaoData()` | Aceita lote de registros e faz upsert por `id_sessao`. Repetir o mesmo lote não duplica dados. |
| `GET /api/load` | `getGestaoCargaData({ updateSheet:false })` | Calcula sessões, volume, RPE e e1RM sem escrita durante o boot. |

O endpoint de sincronização deve retornar quais `id_sessao` foram aceitos. A fila local só marca um item como sincronizado após uma resposta de sucesso que o inclua.

## 5. Sequência de migração e pontos de controle

Cada fase termina com um checkpoint objetivo. Não se avança para a seguinte quando o checkpoint falha.

### Fase A — Preparação local e deploy de teste

1. Criar estrutura Worker, configuração Wrangler e ambiente local.
2. Mover os assets atuais para o Worker sem mudar o comportamento visual.
3. Criar D1 local, migrations versionadas e dados de exemplo mínimos.
4. Escrever testes de API e manter os testes de regressão do frontend.

**Checkpoint A:** PWA abre localmente; todas as telas renderizam; chamadas ainda podem apontar para Apps Script durante a adaptação inicial.

### Fase B — Dados e backend Cloudflare

1. Implementar migrations D1 e repositórios SQL.
2. Implementar leitura de prescrição, editor, execução, histórico e carga.
3. Implementar validação, transações para salvar prescrição e upsert idempotente para execução.
4. Trocar o transporte do frontend para a API Cloudflare por configuração, sem apagar o adaptador Google ainda.

**Checkpoint B:** testes automáticos cobrem cada rota, e as respostas são compatíveis com as estruturas consumidas pelo frontend atual.

### Fase C — Transferência de dados sem perda

1. Exportar cada aba fonte em CSV, com data e hora, sem alterar a planilha.
2. Guardar os CSVs fora do bundle público e registrar contagem e hash de cada arquivo.
3. Importar em uma base D1 de staging usando script idempotente.
4. Comparar contagens, chaves únicas e amostras de prescrição, execução e carga entre origem e staging.
5. Corrigir mapeamentos até a auditoria passar. Somente então repetir a importação em D1 de produção.

**Checkpoint C:** todas as linhas migráveis foram contabilizadas; nenhuma chave de `id_sessao` foi perdida ou duplicada; o CSV original permanece como rollback de dados.

### Fase D — Validação paralela

1. Publicar um ambiente de preview Cloudflare apontando para a base D1 de staging.
2. Executar roteiro manual: boot, consulta de ficha, edição de prescrição, registro offline, reconexão, sincronização, alteração de RPE, histórico e carga.
3. Comparar os resultados com Apps Script para os mesmos dados importados.
4. Corrigir divergências antes de alterar o domínio/URL usada no dia a dia.

**Checkpoint D:** roteiro completo aprovado sem Google Sheets e sem regressão de offline/sincronização.

### Fase E — Virada controlada

1. Fazer uma exportação final dos CSVs da planilha.
2. Pausar alterações no Apps Script durante a janela curta de virada.
3. Importar o delta final no D1 de produção e repetir a auditoria.
4. Publicar a versão Cloudflare de produção.
5. Usar a nova URL e monitorar erros e sincronizações por alguns dias.

**Checkpoint E:** Cloudflare é a única base operacional; Apps Script e Sheets ficam somente leitura como backup, sem serem apagados.

### Fase F — Encerramento do legado

1. Remover o fallback ativo para Apps Script do frontend após o período de observação.
2. Arquivar os exports CSV e documentar a versão do schema aplicada.
3. Atualizar a documentação de continuidade e o guia de deploy.

**Checkpoint F:** nenhuma URL ou chamada do PWA de produção depende do Google.

## 6. Integridade, offline e rollback

- **Idempotência:** `id_sessao` é único no D1. Upsert atualiza carga, repetições, RIR e RPE, como a implementação atual.
- **Prescrição atômica:** validar todo o payload antes de apagar/substituir exercícios da combinação ficha + treino. A operação roda em transação.
- **Offline:** a estrutura de pendências e cache local é preservada; apenas o destino da sincronização muda.
- **Boot leve:** `/api/bootstrap` traz somente prescrição e histórico. Carga continua em segundo plano e não grava resumos durante a abertura.
- **Rollback de aplicação:** manter a implantação anterior do Worker e o Apps Script ativo até a Fase F. Reverter o tráfego não altera D1.
- **Rollback de dados:** CSVs datados e importação reexecutável permitem recriar a base antes de uma nova tentativa.

## 7. Segurança proporcional ao single tenant

Single tenant não significa API pública. Um segredo colocado no JavaScript do PWA poderia ser extraído por qualquer visitante, portanto não será usado como autenticação.

Para a primeira instalação haverá uma única identidade operacional protegida pelo **Cloudflare Access**: o responsável abre a URL, informa o e-mail previamente autorizado e recebe um código temporário por e-mail. Isso não cria conta, perfil ou tabela de usuários no PWA; apenas impede que pessoas fora da lista alcancem o site e a API. O Access ficará na frente de todo o domínio, de modo que assets e `/api/*` tenham a mesma proteção.

O deploy de produção precisará de um domínio controlado pela organização e ativo no Cloudflare. Caso ainda não exista um domínio, a aplicação pode ser desenvolvida e testada em preview, mas não será considerada pronta para receber dados reais até que esse domínio seja conectado e a política de e-mail esteja ativa.

Antes de colocar a URL em uso diário, adicionar limite de taxa lógico no Worker às rotas de escrita e avaliar Turnstile somente se houver uma necessidade concreta de defesa adicional. Futuramente, Cloudflare Access pode ser substituído ou complementado por autenticação da aplicação e perfis sem alterar a estrutura de treinos.

## 8. Limites gratuitos e critérios de custo

O desenho evita dependências pagas. Como referência atual, Workers Free possui 100 mil requisições por dia e D1 Free inclui 5 milhões de linhas lidas e 100 mil escritas por dia. Consultas devem usar índices e retornar apenas campos necessários; leituras de carga não podem fazer varreduras desnecessárias. Limites e preços são conferidos novamente imediatamente antes do deploy, pois podem mudar.

## 9. Intervenções manuais do responsável

O trabalho de código, migrations, testes, preview e preparação de importação é automatizável pelo repositório. As únicas ações que exigem o responsável serão agrupadas, nunca solicitadas em passos pequenos:

1. Criar/entrar na conta Cloudflare e autorizar o deploy local uma única vez.
2. Criar o projeto Worker e o banco D1 no dashboard, se a autorização local não puder criá-los.
3. Conectar um domínio já controlado pela organização ao Cloudflare e informar o único e-mail que terá acesso inicial; configurar o Access por código temporário.
4. Exportar os CSVs finais da planilha Google na janela de virada.
5. Abrir a URL de preview e executar o roteiro curto de aceitação no celular.

No momento de cada ação, o guia operacional deverá conter: objetivo, pré-requisito, link oficial direto, texto exato a procurar/clicar, o que preencher, como confirmar sucesso, capturas/valores que não devem ser compartilhados e como voltar atrás. Não será assumido conhecimento prévio de Cloudflare ou terminal.

## 10. Critérios de aceite

- Todas as cinco telas atuais funcionam em URL Cloudflare sem Apps Script.
- A prescrição e o catálogo são consultados e editados no D1.
- Registros offline sincronizam com segurança e sem duplicação.
- Histórico e carga conferem com os dados migrados.
- A página inicial não depende de cálculo de carga nem IA.
- Não existe segredo no Git ou no bundle público.
- Há export CSV de origem, migration versionada, contagens comparadas e procedimento de rollback documentado.

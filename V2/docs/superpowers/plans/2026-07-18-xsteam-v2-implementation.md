# XSTeam V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a V2 do XSTeam com um PWA Gerenciador central e PWAs single-tenant atualizáveis para cada aluno, preservando a V1 intacta.

**Architecture:** `V2/app/` evolui como o pacote-modelo do PWA do aluno. `V2/manager/` será um novo projeto Apps Script com planilha central para alunos, fichas, catálogo, filas e observabilidade. O Gerenciador provisiona e atualiza instâncias através de filas idempotentes; as instâncias dos alunos mantêm dados operacionais isolados e caches de demanda reconstruíveis.

**Tech Stack:** Google Apps Script V8, HtmlService, Google Sheets/Drive, Apps Script REST API, HTML/CSS/JavaScript ES5 compatível, Node.js `node:assert` para testes estáticos locais.

## Global Constraints

- Preservar `V1_BACKUP/` sem qualquer edição.
- Trabalhar apenas dentro de `V2/`.
- Frontend publicado no Apps Script usa sintaxe ES5: sem `const`, `let`, arrow functions, optional chaining, template literals ou APIs incompatíveis já protegidas pelos testes existentes.
- O PWA do aluno não edita prescrição; somente o Gerenciador cria, publica, ativa, oculta e encerra fichas.
- O uso do aluno deve continuar durante falhas temporárias: sincronização em fila local, lote, retentativa e operações idempotentes.
- O catálogo de exercícios é central e dinâmico; correções recalculam dados derivados de todas as instâncias sem alterar fatos de execução.
- O agente não acessa nem modifica o Google Drive do treinador. Configuração, criação de modelos, autorização e execução inicial no Drive são etapas manuais do treinador.
- Uma atualização normal de instância atualiza o deployment existente; não cria uma URL nova para o aluno.
- Eventos de observabilidade não incluem telefone, nome, cargas, exercícios ou texto livre do aluno; eventos brutos são mantidos por 90 dias.

---

## Phased delivery map

| Fase | Entrega testável | Dependências |
|---|---|---|
| 1 | PWA Gerenciador, schema central, perfis, catálogo e fichas em rascunho. | Nenhuma. |
| 2 | Contrato do PWA do aluno, publicação, visibilidade, ativação e histórico de fichas. | Fase 1. |
| 3 | Motor de demanda, caches, acompanhamento e observabilidade. | Fase 2. |
| 4 | Provisão, ciclo de vida e atualização automática de instâncias. | Fases 1–3. |
| 5 | Validação integrada no Apps Script e configuração manual do Drive. | Fase 4. |

## File map after Phase 1

| Path | Responsibility |
|---|---|
| `V2/manager/app/Codigo.gs` | Rotas, schema, serviços e operações da planilha central. |
| `V2/manager/app/index.html` | Shell do PWA Gerenciador e payload de boot. |
| `V2/manager/app/script.html` | Estado, navegação, renderização e chamadas ao backend do Gerenciador. |
| `V2/manager/app/style.html` | Layout responsivo e estados visuais do Gerenciador. |
| `V2/manager/app/appscript.json` | Manifesto do Gerenciador, começando com acesso somente do treinador. |
| `V2/manager/tests/manager-regression.test.js` | Contratos estáticos do schema e das rotas do Gerenciador. |
| `V2/app/` | Pacote-modelo do PWA do aluno, evoluído nas fases 2–4. |
| `V2/tests/app-regression.test.js` | Regressão e compatibilidade do pacote-modelo do aluno. |
| `V2/docs/knowledge hub.html` | Painel de continuidade da V2. |

---

## Phase 1 — Gerenciador, alunos, catálogo e rascunhos

### Task 1: Scaffold isolado do Gerenciador

**Files:**
- Create: `V2/manager/app/Codigo.gs`
- Create: `V2/manager/app/index.html`
- Create: `V2/manager/app/script.html`
- Create: `V2/manager/app/style.html`
- Create: `V2/manager/app/appscript.json`
- Create: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces `doGet(e)`, `routeManagerAction(payload)`, `getManagerBootstrap()` and `setupManagerDatabase()`.
- Consumes `google.script.run` from `index.html` and `script.html`.

- [ ] **Step 1: Write a failing static regression test for the manager entry points.**

```js
assert.match(code, /function\s+doGet\s*\(/);
assert.match(code, /function\s+routeManagerAction\s*\(/);
assert.match(code, /function\s+getManagerBootstrap\s*\(/);
assert.match(code, /function\s+setupManagerDatabase\s*\(/);
assert.match(manifest, /"executeAs"\s*:\s*"USER_DEPLOYING"/);
assert.match(manifest, /"access"\s*:\s*"MYSELF"/);
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: Node fails because `V2/manager/app/Codigo.gs` does not yet exist.

- [ ] **Step 3: Add the minimum Apps Script shell.**

Implement these exact backend action names:

```js
function doGet(e) { /* render index */ }
function routeManagerAction(payload) { /* dispatch allowed actions */ }
function getManagerBootstrap() { /* return initial manager data */ }
function setupManagerDatabase() { /* create missing central tabs only */ }
```

The initial `routeManagerAction` accepts only `getBootstrap` and `setupDatabase`; unknown actions return `{ success: false, error: "Ação desconhecida" }`.

- [ ] **Step 4: Add the HTML shell.**

The shell must contain a persistent header, a main application mount point, a compact loader and four navigation controls labelled `Alunos`, `Prescrições`, `Acompanhamento` and `Saúde do App`.

- [ ] **Step 5: Run the manager regression test.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the scaffold.**

```bash
git add V2/manager
git commit -m "feat: add manager app scaffold"
```

### Task 2: Central schema and non-destructive setup

**Files:**
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces `MANAGER_SHEETS`, `ensureManagerSheet(ss, name, headers)` and `getManagerSpreadsheet()`.
- `setupManagerDatabase()` returns `{ sheets: [{ name: string, created: boolean, missingHeaders: string[] }] }`.

- [ ] **Step 1: Write failing schema assertions.**

```js
["Alunos", "Instancias", "Fichas", "Prescricoes", "Prescricao_Itens",
 "Catalogo_Exercicios", "Publicacoes", "Sessoes_Monitoradas",
 "Eventos_Observabilidade", "Resumo_Uso_Diario", "Fila_Operacoes"]
  .forEach(function (name) { assert.match(code, new RegExp(name)); });
assert.match(code, /function\s+ensureManagerSheet\s*\(/);
assert.doesNotMatch(bodyOf(code, "setupManagerDatabase"), /deleteSheet|clear\s*\(/);
```

- [ ] **Step 2: Run the manager test and confirm failure.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: FAIL because the schema constants do not exist.

- [ ] **Step 3: Define the schemas with stable IDs.**

Use these mandatory headers at minimum:

```js
Alunos: ["aluno_id", "nome", "telefone_e164", "status", "observacoes_gestao", "created_at", "updated_at"]
Instancias: ["instancia_id", "aluno_id", "status_provisionamento", "folder_id", "spreadsheet_id", "script_id", "deployment_id", "pwa_url", "versao_template", "created_at", "updated_at", "erro_resumo"]
Fichas: ["ficha_id", "aluno_id", "nome_ficha", "visibilidade_aluno", "estado_uso", "publicacao_atual_id", "data_inicio", "data_fim", "created_at", "updated_at"]
Prescricoes: ["prescricao_id", "ficha_id", "aluno_id", "versao", "status_edicao", "created_at", "updated_at"]
```

`Prescricao_Itens` must include `semana_1_zona_rir` through `semana_4_zona_rir` in addition to the existing series, repetitions and rest fields.

- [ ] **Step 4: Implement non-destructive setup.**

`ensureManagerSheet` creates only missing tabs and appends missing headers without deleting cells, rows, manual tabs or records.

- [ ] **Step 5: Run regression tests.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: PASS.

- [ ] **Step 6: Commit schema support.**

```bash
git add V2/manager/app/Codigo.gs V2/manager/tests/manager-regression.test.js
git commit -m "feat: add manager database schema"
```

### Task 3: Student profiles, WhatsApp and instance records

**Files:**
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/manager/app/script.html`
- Modify: `V2/manager/app/style.html`
- Modify: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces `listAlunos()`, `saveAluno(payload)`, `getAlunoProfile(alunoId)` and `buildWhatsAppUrl(phone, message)`.
- `saveAluno` returns `{ success: true, aluno: { aluno_id, nome, telefone_e164, status } }`.

- [ ] **Step 1: Add failing tests for profile validation and WhatsApp URL construction.**

```js
assert.match(code, /function\s+saveAluno\s*\(/);
assert.match(code, /function\s+buildWhatsAppUrl\s*\(/);
assert.match(code, /wa\.me/);
assert.match(code, /telefone_e164/);
```

- [ ] **Step 2: Run the manager test and confirm failure.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: FAIL because profile functions are absent.

- [ ] **Step 3: Implement profile operations.**

Normalize `telefone_e164` to digits with country code, reject empty name/phone, generate `aluno_id` with `Utilities.getUuid()`, and create exactly one `Instancias` row in status `nao_provisionada` when a new profile is saved.

- [ ] **Step 4: Implement the Alunos page.**

Render a searchable list, an add/edit profile form, a profile detail panel and a WhatsApp action that opens `https://wa.me/<telefone_e164>` in the browser. The client must not store the phone outside the loaded manager payload.

- [ ] **Step 5: Run manager tests and a manual browser check after Apps Script deployment.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: PASS. In the deployed manager, create one profile and verify that the new `Alunos` and `Instancias` records exist.

- [ ] **Step 6: Commit profile functionality.**

```bash
git add V2/manager
git commit -m "feat: add manager student profiles"
```

### Task 4: Central exercise catalog and prescription drafts

**Files:**
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/manager/app/script.html`
- Modify: `V2/manager/app/style.html`
- Modify: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces `listCatalogoExercicios()`, `saveCatalogoExercicio(payload)`, `createFicha(alunoId, name)`, `savePrescricaoDraft(payload)` and `getPrescricaoEditorData(fichaId)`.
- `savePrescricaoDraft` accepts `{ ficha_id, prescricao_id, itens: [] }` and returns a monotonically increasing `versao`.

- [ ] **Step 1: Add failing catalog and RIR assertions.**

```js
assert.match(code, /function\s+saveCatalogoExercicio\s*\(/);
assert.match(code, /function\s+savePrescricaoDraft\s*\(/);
assert.match(code, /semana_1_zona_rir/);
assert.match(code, /semana_4_zona_rir/);
assert.match(code, /versao_catalogo/);
```

- [ ] **Step 2: Run the test and confirm failure.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: FAIL because catalog and draft functions are absent.

- [ ] **Step 3: Implement catalog CRUD.**

Each catalog row requires `exercicio_id`, `nome_exercicio`, `grupo_muscular`, `tipo_exercicio`, coefficients for the supported muscle groups, `ativo`, `versao_catalogo` and `updated_at`. Editing a coefficient increments the catalog version and creates a `recalcular_catalogo` queue item; no tenant update is executed in Phase 1.

- [ ] **Step 4: Implement draft and ficha CRUD.**

A new ficha starts as `rascunho`, `oculta` and `inativa`. The editor stores rows in `Prescricao_Itens` with the four week triplets plus four RIR-zone fields. The editor reads only active catalog entries and calculates a local planned-demand preview using `coeficiente × séries prescritas`.

- [ ] **Step 5: Render the Prescrições page.**

Show fichas for the selected aluno, version/status chips, a draft editor and the planned-demand preview. Do not render publication, activation or tenant calls in this phase.

- [ ] **Step 6: Run tests.**

Run: `node V2/manager/tests/manager-regression.test.js`

Expected: PASS.

- [ ] **Step 7: Commit catalogs and drafts.**

```bash
git add V2/manager
git commit -m "feat: add manager catalog and prescription drafts"
```

### Task 5: Phase 1 documentation and regression gate

**Files:**
- Modify: `V2/docs/RESUMO_PROJETO.md`
- Modify: `V2/docs/knowledge hub.html`
- Modify: `V2/docs/superpowers/specs/2026-07-18-xsteam-v2-manager-single-tenant-design.md`

- [ ] **Step 1: Add Phase 1 status to the Markdown and HTML continuity documents.**

Record the manager project location, completed central tabs, catalog version rule, known manual Drive configuration still pending, and the exact next phase: tenant publication contract.

- [ ] **Step 2: Run all local tests.**

Run:

```bash
node V2/manager/tests/manager-regression.test.js
node V2/tests/app-regression.test.js
node V2/tests/frontend-polish.test.js
```

Expected: every test prints only `PASS` lines and exits with code `0`.

- [ ] **Step 3: Run whitespace and working-tree checks.**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended Phase 1 files are modified before commit.

- [ ] **Step 4: Commit Phase 1 documentation.**

```bash
git add V2/docs
git commit -m "docs: record v2 manager foundation status"
```

---

## Phase 2 — Tenant publication contract

### Task 6: Convert `V2/app/` into the student-only product

**Files:**
- Modify: `V2/app/Código.gs`
- Modify: `V2/app/index.html`
- Modify: `V2/app/script.html`
- Modify: `V2/app/style.html`
- Modify: `V2/app/appscript.json`
- Modify: `V2/tests/app-regression.test.js`

**Interfaces:**
- Produces `getTenantBootstrap()`, `getVisibleFichas()`, `getActiveFicha()` and `syncExecucaoData(records)`.
- Removes client routes that edit prescriptions and catalog data.

- [ ] **Step 1: Add failing tests asserting that the student UI has only Treino, Fichas, and Histórico e Progresso.**
- [ ] **Step 2: Implement `DB_Fichas`, published prescription headers, and active-ficha backend validation.**
- [ ] **Step 3: Make the student UI render visible fichas read-only and permit new records only for `estado_uso === "ativa"`.**
- [ ] **Step 4: Preserve an in-progress local session by storing its `publicacao_id` and permit that exact session to finish after an activation change.**
- [ ] **Step 5: Run student regression tests and commit.**

## Phase 3 — Publication, demand, monitoring and health

### Task 7: Publish and activate from the Manager

**Files:**
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/manager/app/script.html`
- Modify: `V2/manager/tests/manager-regression.test.js`
- Modify: `V2/app/Código.gs`
- Modify: `V2/tests/app-regression.test.js`

**Interfaces:**
- Produces `queuePublication(publicacaoId)`, `publishFicha(publicacaoId)`, `setFichaVisibility(fichaId, visible)` and `activateFicha(fichaId)`.
- `activateFicha` rejects an invisible ficha and atomically deactivates the previous active ficha for the same aluno.

- [ ] **Step 1: Add failing tests for one-active-ficha, invisible-ficha rejection, and idempotent publication ID.**
- [ ] **Step 2: Implement `Publicacoes` and `Fila_Operacoes` records with statuses `pendente`, `executando`, `concluida`, `falha`.**
- [ ] **Step 3: Write the published ficha, item rows and active state to the target tenant spreadsheet in batched ranges.**
- [ ] **Step 4: Render Publish, Hide/Restore and Activate actions in the Manager with explicit confirmation and result state.**
- [ ] **Step 5: Run both manager and tenant test suites and commit.**

### Task 8: Build demand caches and session monitoring

**Files:**
- Modify: `V2/app/Código.gs`
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/tests/app-regression.test.js`
- Modify: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces tenant functions `rebuildDemandCaches()`, `rebuildDemandForSession(sessaoId)`, `getDemandProgress(filters)`.
- Produces manager functions `queueCatalogRecalculation(version)` and `recordSessionSummary(summary)`.

- [ ] **Step 1: Add failing tests for `DB_Catalogo_Exercicios`, `DB_Demanda_Planejada`, `DB_Demanda_Sessao`, `DB_Demanda_Periodo`, `Sessoes_Monitoradas`, and `exercicios_concluidos`.**
- [ ] **Step 2: Implement planned demand as each muscle coefficient multiplied by prescribed series.**
- [ ] **Step 3: Implement realized demand as each muscle coefficient multiplied by executed series, using `DB_Execucao` as immutable input.**
- [ ] **Step 4: Update only the affected session and period caches after a successful sync; batch-write summary rows.**
- [ ] **Step 5: When catalog version changes, queue each tenant recalculation and surface `atualizando indicadores` without blocking training.**
- [ ] **Step 6: Run regression suites and commit.**

### Task 9: Automatic observability and health dashboard

**Files:**
- Modify: `V2/app/Código.gs`
- Modify: `V2/app/script.html`
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/manager/app/script.html`
- Modify: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces `enqueueTelemetry(event)`, `flushTelemetry()` in the tenant and `recordObservabilityEvent(event)`, `getHealthDashboard(filters)` in the manager.
- Event shape: `{ event_id, ocorreu_em, aluno_id, instancia_id, tipo, resultado, tela, acao, codigo_erro, mensagem_sanitizada, duracao_ms, versao_app }`.

- [ ] **Step 1: Add failing tests rejecting phone, name, exercise, load and free-text fields in observability events.**
- [ ] **Step 2: Instrument boot, sync success/failure, controlled backend error and publication-received events; queue events locally when offline.**
- [ ] **Step 3: Append events in batches and update `Resumo_Uso_Diario` without polling tenant sheets.**
- [ ] **Step 4: Build Health filters for date, aluno, event type, app version and error code; default to daily aggregates.**
- [ ] **Step 5: Add a retention job that deletes only raw observability events older than 90 days.**
- [ ] **Step 6: Run regression suites and commit.**

## Phase 4 — Provisioning, lifecycle and releases

### Task 10: Provisioning and lifecycle queue workers

**Files:**
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/manager/app/script.html`
- Modify: `V2/manager/app/appscript.json`
- Modify: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces `queueProvision(instanciaId)`, `processOperationQueue(limit)`, `pauseInstance(instanciaId)`, `archiveInstance(instanciaId)`, `reactivateInstance(instanciaId)`.
- Each worker transition is persisted before and after side effects; retry reuses existing folder/spreadsheet/script IDs.

- [ ] **Step 1: Add failing tests for idempotent provisioning state transitions and archive path selection.**
- [ ] **Step 2: Implement Script Properties validation for Drive folder/model IDs before any Drive operation.**
- [ ] **Step 3: Implement folder creation, template-sheet copy, file move, bound script creation, property initialization, setup and deployment registration.**
- [ ] **Step 4: Implement pause, archive and reactivate without deleting data; archival moves the folder to `99_ALUNOS_ARQUIVADOS`.**
- [ ] **Step 5: Add queue status and retry controls to the Aluno profile.**
- [ ] **Step 6: Run manager tests and commit.**

### Task 11: Central tenant release management

**Files:**
- Modify: `V2/manager/app/Codigo.gs`
- Modify: `V2/manager/app/script.html`
- Modify: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Produces `createTenantRelease(templateScriptId, versionLabel)`, `queueTenantRelease(releaseId)`, `applyTenantRelease(instanciaId, releaseId)` and `rollbackTenantRelease(instanciaId, versionNumber)`.
- Each release stores template hash, Apps Script version number, deployment ID, migration version, status and result.

- [ ] **Step 1: Add failing tests requiring update of an existing deployment ID and forbidding creation of a new tenant URL during standard release.**
- [ ] **Step 2: Read complete model-project content, update target project content, create an immutable version and update the existing deployment.**
- [ ] **Step 3: Run additive schema migrations before code that requires new fields; preserve Script Properties unique to each tenant.**
- [ ] **Step 4: Process tenant releases sequentially or in a small configurable batch, recording per-instance health checks and failures.**
- [ ] **Step 5: Implement rollback by pointing the existing deployment at the previously recorded immutable version.**
- [ ] **Step 6: Run manager tests and commit.**

## Phase 5 — Manual Google configuration and integrated acceptance

### Task 12: Trainer-run setup and full validation

**Files:**
- Modify: `V2/docs/RESUMO_PROJETO.md`
- Modify: `V2/docs/knowledge hub.html`
- Create: `V2/docs/GUIA_CONFIGURACAO_GOOGLE.md`

- [ ] **Step 1: Document the exact manual setup:** create the template sheet and template script in `00_MODELOS`, create the manager sheet/script in `01_GERENCIADOR`, enable the Apps Script API, set Script Properties and authorize scopes.
- [ ] **Step 2: Provision one non-production test student through the manager and verify a stable `/exec` URL.**
- [ ] **Step 3: Publish two fichas, activate only one, execute a session, and confirm active-ficha validation, demand caches, usage summary and health events.**
- [ ] **Step 4: Correct one catalog coefficient and confirm the queue recalculates planned and realized demand in the test instance.**
- [ ] **Step 5: Update the template script, distribute a release, verify the same student URL serves the new version, then execute a rollback.**
- [ ] **Step 6: Archive and reactivate the test student; verify no data deletion and correct folder movement.**
- [ ] **Step 7: Run all local tests, verify `git diff --check`, update the Knowledge Hub and commit the validation record.**

## Plan self-review

- Spec coverage: Phases 1–5 cover central management, tenant UI, ficha lifecycle, catalog/demand, observability, Drive automation, release management, archive lifecycle and manual configuration.
- Scope: Phase 1 is independently deployable as a manager foundation; later phases add each external effect behind queue boundaries.
- Type consistency: `aluno_id`, `instancia_id`, `ficha_id`, `prescricao_id`, `publicacao_id`, `operacao_id`, `release_id` and `versao_catalogo` are used consistently as stable identifiers.
- Compatibility: all frontend work inherits the current Apps Script static compatibility checks; manager tests are introduced before manager implementation.
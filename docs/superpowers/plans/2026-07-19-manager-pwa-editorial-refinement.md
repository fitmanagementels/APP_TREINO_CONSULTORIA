# PWA Gerencial XSTEAM — Refinamento Editorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar presença editorial à tipografia do PWA gerencial sem alterar estrutura, dados, navegação ou responsividade.

**Architecture:** A mudança fica isolada em `style.html`: novos tokens tipográficos e ajustes nos componentes já existentes. O teste de regressão confirma a presença dos tokens e protege os controles responsivos implementados anteriormente.

**Tech Stack:** CSS vanilla no Google Apps Script HTML Service; Node.js `node:assert` para regressão estática.

## Global Constraints

- Não alterar HTML de dados, chamadas Apps Script, navegação, breakpoints ou comportamento de formulário.
- Não inserir fontes externas ou novas dependências.
- Reservar lime `#D9FF2F` para ação, seleção e marcadores ativos.
- Manter contraste, targets de toque e leitura em desktop, tablet e mobile.

---

### Task 1: Proteger e aplicar a escala editorial

**Files:**
- Modify: `V2/manager/tests/manager-regression.test.js`
- Modify: `V2/manager/app/style.html`
- Test: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Consumes: tokens CSS em `:root` e os seletores existentes `.app-header`, `.contextual-bar`, `.section-heading`, `.eyebrow`, `.nav-button` e `.student-row`.
- Produces: tokens `--type-display`, `--type-title`, `--type-body` e `--type-meta` e regras que separam visualmente marca, rótulo, título, conteúdo e metadado.

- [ ] **Step 1: Escrever o teste de contrato que falha**

  No teste `manager shell provides XSTEAM responsive navigation`, acrescentar:

  ```js
  ["--type-display", "--type-title", "--type-body", "--type-meta"].forEach(function (token) {
    assert.match(style, new RegExp(token));
  });
  assert.match(style, /\.section-heading h2\s*\{[^}]*font-size:\s*var\(--type-title\)/);
  ```

- [ ] **Step 2: Executar o teste para confirmar a falha**

  Run: `node V2/manager/tests/manager-regression.test.js`

  Expected: falha no novo contrato porque os tokens tipográficos ainda não existem.

- [ ] **Step 3: Adicionar tokens e regras editoriais mínimas**

  Em `:root`, inserir:

  ```css
  --type-display: clamp(30px, 3vw, 38px);
  --type-title: clamp(23px, 2.1vw, 29px);
  --type-body: 15px;
  --type-meta: 11px;
  ```

  Aplicar as regras:

  ```css
  h1 { font-size: var(--type-display); font-weight: 800; letter-spacing: -.055em; line-height: .98; }
  .section-heading h2 { font-size: var(--type-title); font-weight: 750; letter-spacing: -.04em; line-height: 1.04; }
  .section-heading p:last-child { color: #b8c0b3; font-size: var(--type-body); line-height: 1.65; max-width: 66ch; }
  .eyebrow,.contextual-kicker { color: #b8c0b3; font-size: var(--type-meta); letter-spacing: .16em; }
  .section-heading .eyebrow,.nav-button.is-active .nav-label { color: var(--accent); }
  ```

  Ajustar a barra contextual, sidebar, labels de campo e metadados para usar `--type-meta` ou `--type-body`, mantendo o lime somente nos estados definidos acima.

- [ ] **Step 4: Executar regressão e sintaxe**

  Run: `node V2/manager/tests/manager-regression.test.js`

  Expected: todas as linhas `PASS`.

  Run:

  ```bash
  node -e "const fs=require('fs'); const source=fs.readFileSync('V2/manager/app/script.html','utf8').replace(/^<script>\s*/,'').replace(/\s*<\/script>\s*$/,''); new Function(source); console.log('PASS manager frontend syntax');"
  ```

  Expected: `PASS manager frontend syntax`.

- [ ] **Step 5: Confirmar os formatos de tela**

  Confirmar em 1440 px, 768 px e 390 px: títulos não cortam, rótulos não competem com títulos, botões continuam com pelo menos 44 px no mobile, e a sidebar compacta não perde indicação de seleção.

- [ ] **Step 6: Commitar o refinamento**

  ```bash
  git add V2/manager/app/style.html V2/manager/tests/manager-regression.test.js
  git commit -m "style: refine manager editorial hierarchy"
  ```
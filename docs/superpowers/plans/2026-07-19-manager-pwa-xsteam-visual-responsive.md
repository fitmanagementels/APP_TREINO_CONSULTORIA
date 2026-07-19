# PWA Gerencial XSTEAM — Visual e Responsividade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o shell do PWA gerencial em uma experiência XSTEAM dark, com sidebar única retrátil e layouts seguros para desktop, tablet e mobile, sem alterar regras de dados.

**Architecture:** `index.html` passa a fornecer o shell semântico: sidebar, botão de menu e barra contextual persistente. `style.html` concentra tokens visuais e os três comportamentos responsivos; `script.html` apenas controla os estados de abertura da navegação e sincroniza o rótulo contextual com a página selecionada, preservando os renderizadores existentes.

**Tech Stack:** HTML/CSS/JavaScript vanilla, Google Apps Script HTML Service, Node.js `node:assert` para regressão estática.

## Global Constraints

- Cor de destaque da marca: lime amarelo `#D9FF2F`.
- Manter base preto/carvão, texto de alto contraste e luz ambiente sutil; não usar elementos decorativos que prejudiquem leitura.
- Preservar módulos Alunos, Prescrições, Acompanhamento e Saúde do App, assim como todas as chamadas Apps Script e regras de salvamento.
- Usar uma arquitetura de sidebar em todos os formatos: fixa/retrátil no desktop, sobreposta no tablet e drawer no mobile.
- Criar a barra contextual superior desde a primeira versão, pronta para subabas; no mobile, permitir rolagem horizontal e alvos de toque de no mínimo 44 px.
- Não introduzir dependências externas nem rolagem horizontal acidental.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `V2/manager/app/index.html` | Shell semântico da aplicação: sidebar, controles de acessibilidade, barra contextual e área de conteúdo. |
| `V2/manager/app/style.html` | Tokens XSTEAM, componentes visuais, estados de foco e media queries desktop/tablet/mobile. |
| `V2/manager/app/script.html` | Estado e eventos do drawer/sidebar, texto contextual da página e preservação da seleção de página atual. |
| `V2/manager/tests/manager-regression.test.js` | Contratos estáticos do novo shell e dos controles responsivos, além dos testes atuais. |

### Task 1: Registrar o contrato de navegação responsiva

**Files:**
- Modify: `V2/manager/tests/manager-regression.test.js`
- Test: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Consumes: o conteúdo textual de `V2/manager/app/index.html`, `style.html` e `script.html` carregado com `fs.readFileSync`.
- Produces: testes que impedem a remoção acidental de `app-sidebar`, `sidebar-toggle`, `contextual-bar`, da cor lime e dos breakpoints responsivos.

- [ ] **Step 1: Adicionar as fontes de style e script ao teste**

  Depois da leitura de `index`, inserir:

  ```js
  const style = fs.readFileSync(path.join(root, "app", "style.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
  ```

- [ ] **Step 2: Escrever o teste que falha para o shell e responsividade**

  Acrescentar ao array `tests`:

  ```js
  [
    "manager shell provides XSTEAM responsive navigation",
    function () {
      assert.match(index, /id="app-sidebar"/);
      assert.match(index, /id="sidebar-toggle"/);
      assert.match(index, /id="contextual-bar"/);
      assert.match(index, /aria-controls="app-sidebar"/);
      assert.match(style, /#D9FF2F/i);
      assert.match(style, /@media\s*\(max-width:\s*1023px\)/);
      assert.match(style, /@media\s*\(max-width:\s*700px\)/);
      assert.match(script, /function\s+toggleSidebar\s*\(/);
      assert.match(script, /function\s+setContextualPage\s*\(/);
    },
  ],
  ```

- [ ] **Step 3: Executar o teste para confirmar a falha**

  Run: `node V2/manager/tests/manager-regression.test.js`

  Expected: `FAIL manager shell provides XSTEAM responsive navigation`, porque o shell e os controladores ainda não existem.

- [ ] **Step 4: Commitar o contrato de teste**

  ```bash
  git add V2/manager/tests/manager-regression.test.js
  git commit -m "test: cover manager responsive shell contract"
  ```

### Task 2: Implementar o shell semântico com sidebar e barra contextual

**Files:**
- Modify: `V2/manager/app/index.html`
- Test: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Consumes: os seletores `#app-sidebar`, `#sidebar-toggle`, `.nav-button`, `#contextual-page-label` e `#app-root` definidos no HTML.
- Produces: uma estrutura estável para CSS e JavaScript, com navegação acessível dos quatro módulos.

- [ ] **Step 1: Substituir header e nav atuais pelo shell abaixo**

  Manter o loader e substituir o bloco de `<header>` até antes de `<main>` por:

  ```html
  <div class="app-shell">
    <aside id="app-sidebar" class="app-sidebar" aria-label="Navegação principal">
      <div class="sidebar-brand">
        <span class="brand-mark" aria-hidden="true">X</span>
        <div class="brand-copy"><strong>XSTEAM</strong><span>GESTÃO</span></div>
      </div>
      <nav class="app-nav" aria-label="Módulos do gerenciador">
        <button type="button" class="nav-button is-active" data-page="alunos" aria-current="page"><span class="nav-icon" aria-hidden="true">◉</span><span class="nav-label">Alunos</span></button>
        <button type="button" class="nav-button" data-page="prescricoes"><span class="nav-icon" aria-hidden="true">↗</span><span class="nav-label">Prescrições</span></button>
        <button type="button" class="nav-button" data-page="acompanhamento"><span class="nav-icon" aria-hidden="true">⌁</span><span class="nav-label">Acompanhamento</span></button>
        <button type="button" class="nav-button" data-page="saude"><span class="nav-icon" aria-hidden="true">＋</span><span class="nav-label">Saúde do App</span></button>
      </nav>
      <p id="connection-status" class="connection-status">Conectando</p>
    </aside>
    <div class="app-stage">
      <header class="app-header">
        <button id="sidebar-toggle" class="sidebar-toggle" type="button" aria-controls="app-sidebar" aria-expanded="true"><span class="visually-hidden">Alternar navegação</span><span aria-hidden="true">☰</span></button>
        <div><p class="eyebrow">XSTEAM V2</p><h1>Gerenciador</h1></div>
      </header>
      <section id="contextual-bar" class="contextual-bar" aria-label="Contexto da seção">
        <div><p class="contextual-kicker">MÓDULO ATIVO</p><strong id="contextual-page-label">Alunos</strong></div>
        <div id="contextual-tabs" class="contextual-tabs" aria-label="Subabas futuras"><span class="contextual-placeholder">Subabas aparecerão aqui</span></div>
      </section>
      <main id="app-root" class="app-root" tabindex="-1"></main>
    </div>
  </div>
  ```

- [ ] **Step 2: Atualizar a cor de tema do navegador**

  Alterar no `<head>`:

  ```html
  <meta name="theme-color" content="#090B09" />
  ```

- [ ] **Step 3: Executar a regressão**

  Run: `node V2/manager/tests/manager-regression.test.js`

  Expected: os testes antigos passam; o novo contrato ainda falha até Tasks 3 e 4 existirem.

- [ ] **Step 4: Commitar o shell**

  ```bash
  git add V2/manager/app/index.html
  git commit -m "feat: add manager sidebar shell"
  ```

### Task 3: Aplicar os tokens XSTEAM e os layouts desktop/tablet/mobile

**Files:**
- Modify: `V2/manager/app/style.html`
- Test: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Consumes: classes e IDs do shell criado na Task 2; classes de conteúdo existentes como `.students-layout`, `.prescription-layout`, `.profile-form` e `.catalog-content`.
- Produces: tokens e media queries que deixam o app legível entre 360 px e desktop amplo, sem alterar o HTML gerado pelos renderizadores.

- [ ] **Step 1: Substituir o bloco atual de tokens e regras de shell por tokens dark XSTEAM**

  No início de `style.html`, usar esta base (e manter o restante das regras de conteúdo, adaptando suas variáveis):

  ```css
  :root {
    --bg: #090b09;
    --bg-deep: #030403;
    --surface: #121612;
    --surface-raised: #181d18;
    --surface-input: #0d110e;
    --ink: #f5f7f1;
    --muted: #a7b0a4;
    --line: rgba(232, 255, 219, .13);
    --accent: #D9FF2F;
    --accent-ink: #111607;
    --accent-soft: rgba(217, 255, 47, .13);
    --danger: #ff7373;
    --shadow-soft: 0 14px 36px rgba(0, 0, 0, .32);
    --shadow-raised: 0 24px 64px rgba(0, 0, 0, .52);
    --sidebar-open: 248px;
    --sidebar-compact: 76px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(ellipse at 84% 4%, rgba(217, 255, 47, .11), transparent 31%), radial-gradient(ellipse at 8% 74%, rgba(217, 255, 47, .045), transparent 25%), linear-gradient(155deg, #111611 0%, var(--bg) 48%, var(--bg-deep) 100%); color: var(--ink); font-family: Arial, sans-serif; }
  .app-shell { display: grid; grid-template-columns: var(--sidebar-open) minmax(0, 1fr); min-height: 100vh; transition: grid-template-columns .22s ease; }
  .app-shell.is-sidebar-compact { grid-template-columns: var(--sidebar-compact) minmax(0, 1fr); }
  .app-sidebar { background: linear-gradient(180deg, rgba(20, 25, 20, .96), rgba(5, 7, 5, .98)); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 100vh; padding: 20px 12px; position: sticky; top: 0; }
  .app-stage { min-width: 0; padding: 24px clamp(16px, 3vw, 40px) 40px; }
  .app-header, .contextual-bar, .app-root { margin: 0 auto; max-width: 1360px; }
  ```

- [ ] **Step 2: Estilizar controles e estados usando os tokens**

  Garantir estas regras no stylesheet:

  ```css
  .primary-button { background: linear-gradient(135deg, var(--accent), #edff81); border-color: var(--accent); color: var(--accent-ink); box-shadow: 0 12px 30px rgba(217, 255, 47, .14); }
  .secondary-button, input, select, textarea { background: var(--surface-input); border-color: var(--line); color: var(--ink); }
  .page-card, .student-list-card, .profile-detail, .profile-form-card, .editor-card, .inline-form { background: linear-gradient(145deg, rgba(255,255,255,.035), transparent 45%), var(--surface); border-color: var(--line); box-shadow: var(--shadow-soft); }
  .nav-button.is-active, .student-row.is-selected, .ficha-row.is-selected { background: var(--accent-soft); border-color: rgba(217, 255, 47, .58); color: var(--accent); box-shadow: 0 0 0 1px rgba(217, 255, 47, .10), 0 0 24px rgba(217, 255, 47, .08); }
  button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid rgba(217, 255, 47, .72); outline-offset: 3px; }
  ```

- [ ] **Step 3: Acrescentar estados desktop compacto, tablet e mobile**

  Acrescentar, sem remover os ajustes internos atuais de formulários:

  ```css
  .app-shell.is-sidebar-compact .brand-copy, .app-shell.is-sidebar-compact .nav-label, .app-shell.is-sidebar-compact .connection-status { display: none; }
  .sidebar-toggle { min-height: 44px; min-width: 44px; }
  .contextual-bar { align-items: center; background: rgba(18, 22, 18, .72); border: 1px solid var(--line); border-radius: 12px; display: flex; gap: 16px; justify-content: space-between; margin-bottom: 22px; padding: 12px 16px; }
  .contextual-tabs { min-width: 0; overflow-x: auto; white-space: nowrap; }
  @media (max-width: 1023px) {
    .app-shell { grid-template-columns: var(--sidebar-compact) minmax(0, 1fr); }
    .app-shell.is-sidebar-expanded { grid-template-columns: var(--sidebar-open) minmax(0, 1fr); }
    .app-sidebar { z-index: 3; }
    .students-layout, .prescription-layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 700px) {
    .app-shell, .app-shell.is-sidebar-compact, .app-shell.is-sidebar-expanded { display: block; }
    .app-sidebar { box-shadow: var(--shadow-raised); left: 0; position: fixed; transform: translateX(-100%); transition: transform .22s ease; width: min(84vw, 300px); z-index: 5; }
    .app-shell.is-sidebar-expanded .app-sidebar { transform: translateX(0); }
    .app-stage { padding: 16px 14px 32px; }
    .contextual-bar { align-items: flex-start; flex-direction: column; }
    .contextual-tabs { margin: 0 -16px; padding: 0 16px 2px; width: calc(100% + 32px); }
    .primary-button, .secondary-button, .text-button, .nav-button { min-height: 44px; }
  }
  ```

- [ ] **Step 4: Atualizar as regras claras remanescentes**

  Trocar qualquer `background: #fff`, `background: #f8faf9` ou `background: #eff8f4` das regras de conteúdo por `var(--surface)`, `var(--surface-raised)` ou `var(--accent-soft)`, respectivamente. Trocar usos de `var(--accent)` que definem texto sobre fundo por `var(--accent-ink)` quando necessário para contraste.

- [ ] **Step 5: Rodar regressão e inspecionar o CSS**

  Run: `node V2/manager/tests/manager-regression.test.js`

  Expected: o teste novo continua falhando somente pelo controlador JavaScript ausente; os demais passam.

- [ ] **Step 6: Commitar o tema e responsividade**

  ```bash
  git add V2/manager/app/style.html
  git commit -m "feat: apply XSTEAM dark responsive manager theme"
  ```

### Task 4: Controlar sidebar e contexto sem afetar fluxos existentes

**Files:**
- Modify: `V2/manager/app/script.html`
- Test: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Consumes: `#app-sidebar`, `#sidebar-toggle`, `#contextual-page-label`, `.app-shell` e os `data-page` existentes.
- Produces: `toggleSidebar(forceOpen)`, `setContextualPage(page)` e `selectPage(page)` com `aria-current` e `aria-expanded` corretos.

- [ ] **Step 1: Definir os nomes legíveis e helpers após `root()`**

  Inserir:

  ```js
  var PAGE_LABELS = { alunos: "Alunos", prescricoes: "Prescrições", acompanhamento: "Acompanhamento", saude: "Saúde do App" };
  function shell() { return document.querySelector(".app-shell"); }
  function isMobileLayout() { return window.matchMedia("(max-width: 700px)").matches; }
  function setContextualPage(page) { var label = document.getElementById("contextual-page-label"); if (label) label.textContent = PAGE_LABELS[page] || "Gerenciador"; }
  function toggleSidebar(forceOpen) {
    var node = shell(); var button = document.getElementById("sidebar-toggle"); if (!node || !button) return;
    var open = typeof forceOpen === "boolean" ? forceOpen : !node.classList.contains("is-sidebar-expanded");
    node.classList.toggle("is-sidebar-expanded", open);
    node.classList.toggle("is-sidebar-compact", !isMobileLayout() && !open);
    button.setAttribute("aria-expanded", String(open));
  }
  ```

- [ ] **Step 2: Atualizar `selectPage` para o estado acessível e drawer mobile**

  Substituir a função por:

  ```js
  function selectPage(page) {
    state.page = page;
    var buttons = document.querySelectorAll(".nav-button");
    for (var i = 0; i < buttons.length; i += 1) {
      var active = buttons[i].getAttribute("data-page") === page;
      buttons[i].className = active ? "nav-button is-active" : "nav-button";
      if (active) buttons[i].setAttribute("aria-current", "page"); else buttons[i].removeAttribute("aria-current");
    }
    setContextualPage(page);
    if (isMobileLayout()) toggleSidebar(false);
    if (page === "prescricoes") loadFichas(render); else render();
  }
  ```

- [ ] **Step 3: Inicializar o botão e estado correto no `boot`**

  No começo de `boot()`, antes do loop dos botões de navegação, inserir:

  ```js
  var sidebarButton = document.getElementById("sidebar-toggle");
  if (sidebarButton) sidebarButton.onclick = function () { toggleSidebar(); };
  setContextualPage(state.page);
  if (shell()) shell().classList.add("is-sidebar-compact");
  ```

  Ao final desse mesmo `boot`, registrar o reajuste de layout:

  ```js
  window.addEventListener("resize", function () {
    var node = shell();
    if (!node) return;
    if (isMobileLayout()) node.classList.remove("is-sidebar-compact");
    else if (!node.classList.contains("is-sidebar-expanded")) node.classList.add("is-sidebar-compact");
  });
  ```

- [ ] **Step 4: Executar o teste para confirmar aprovação**

  Run: `node V2/manager/tests/manager-regression.test.js`

  Expected: todas as linhas começam com `PASS`, incluindo `manager shell provides XSTEAM responsive navigation`.

- [ ] **Step 5: Validar sintaxe do script extraído do HTML**

  Run:

  ```bash
  node -e "const fs=require('fs'); const source=fs.readFileSync('V2/manager/app/script.html','utf8').replace(/^<script>\s*/,'').replace(/\s*<\/script>\s*$/,''); new Function(source); console.log('PASS manager frontend syntax');"
  ```

  Expected: `PASS manager frontend syntax`.

- [ ] **Step 6: Commitar o comportamento da navegação**

  ```bash
  git add V2/manager/app/script.html
  git commit -m "feat: add manager responsive sidebar controls"
  ```

### Task 5: Validar o fluxo completo nos formatos definidos

**Files:**
- Modify: nenhum, salvo correções encontradas nos arquivos das Tasks 2–4.
- Test: `V2/manager/tests/manager-regression.test.js`

**Interfaces:**
- Consumes: shell, CSS e JavaScript das tarefas anteriores.
- Produces: evidência de que o gerenciador mantém navegação, legibilidade e fluxos em desktop, tablet e celular.

- [ ] **Step 1: Iniciar a prévia local do Apps Script/HTML já usada pelo projeto**

  Abrir o gerenciador em um navegador ou prévia local sem gravar dados. Confirmar que o loader desaparece e que os quatro módulos ainda são clicáveis.

- [ ] **Step 2: Verificar desktop (1440 px)**

  Confirmar: sidebar compacta abre e fecha; conteúdo ganha largura no modo compacto; barra contextual está acima do conteúdo; lista/detalhe de alunos e lista/editor de prescrições usam espaço sem corte.

- [ ] **Step 3: Verificar tablet (768 px)**

  Confirmar: sidebar compacta pode expandir sobre o conteúdo; grids de alunos e prescrições empilham sem campos comprimidos; ações permanecem acessíveis.

- [ ] **Step 4: Verificar mobile (390 px e 360 px)**

  Confirmar: menu abre como drawer e fecha ao escolher módulo; faixa contextual rola horizontalmente se necessário; formulários têm uma coluna; nenhum conteúdo excede a viewport; todos os controles de ação têm 44 px ou mais.

- [ ] **Step 5: Rodar as verificações finais**

  Run: `node V2/manager/tests/manager-regression.test.js`

  Expected: todas as verificações passam.

  Run: `git diff --check`

  Expected: sem saída e código de saída 0.

- [ ] **Step 6: Commitar apenas eventuais correções de verificação**

  ```bash
  git add V2/manager/app/index.html V2/manager/app/style.html V2/manager/app/script.html V2/manager/tests/manager-regression.test.js
  git commit -m "fix: polish manager responsive layout"
  ```

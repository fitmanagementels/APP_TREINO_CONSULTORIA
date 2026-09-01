# Training Start Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o estado Iniciar treino com modo na primeira linha, Ficha/Treino/Ciclo na segunda e um navegador diário com calendário mensal totalmente temático.

**Architecture:** O frontend mantém os estados e payloads atuais. Os `select` e `input type="date"` existentes ficam como controles internos ocultos para preservar a integração já testada, enquanto botões customizados renderizam valores e opções. Funções puras tratam datas locais; um único calendário mensal em overlay atualiza `selectedDate` sem qualquer mudança no Worker ou D1.

**Tech Stack:** HTML/CSS/JavaScript conservador, localStorage existente, Node.js `node:test`, builder estático existente e Cloudflare Workers Assets.

## Global Constraints

- Preservar o design dark atual e usar lime apenas em foco, seleção e CTA.
- Primeira linha: Treino prescrito / Treino livre.
- Segunda linha: Ficha / Treino / Ciclo, sempre na mesma linha no modo prescrito.
- Ocultar totalmente a segunda linha no modo Treino livre sem apagar as seleções.
- Data fechada mostra um único dia; setas mudam exatamente um dia.
- Calendário mensal próprio; nenhuma superfície visual pode depender do tema do navegador.
- Preservar o estado de sessão ativa, Prescrição, Prescrever, Histórico, Carga, APIs e D1.
- Não adicionar biblioteca externa.
- Manter sintaxe conservadora do `app/script.html`: sem `const`, `let`, arrow functions, template literals, optional chaining ou spread.

## File Structure

- Modify: `app/index.html` — estrutura dos três comboboxes, navegador diário e overlay do calendário.
- Modify: `app/style.html` — superfícies, menus, estados, calendário, responsividade e reduced motion.
- Modify: `app/script.html` — helpers de data local, estado/menus customizados, calendário e sincronização com controles internos.
- Modify: `tests/cloudflare/frontend-contract.test.cjs` — contrato estrutural do novo estado inicial.
- Modify: `tests/app-regression.test.js` — proteção do fluxo existente e sintaxe conservadora.
- Create: `tests/training-start-controls.test.cjs` — testes executáveis dos helpers de data e da integração de estado.
- Modify: `docs/guias-operacionais/08-sessao-treino-e-treino-livre.md` — instruções do novo seletor.

---

### Task 1: Reorganizar o contrato HTML do estado Iniciar treino

**Files:**
- Modify: `tests/cloudflare/frontend-contract.test.cjs`
- Modify: `app/index.html:90-150`

**Interfaces:**
- Consumes: IDs existentes `treino-mode-prescribed`, `treino-mode-free`, `ficha-filter`, `treino-filter`, `treino-date`, `treino-start-btn`.
- Produces: `training-prescribed-context`, triggers `training-ficha-trigger`, `training-treino-trigger`, `training-cycle-trigger`, menus correspondentes e `training-date-navigator`.

- [ ] **Step 1: Escrever o teste estrutural que falha**

Adicionar ao contrato do frontend:

```js
test("training start orders mode, prescribed context, date navigator and CTA", () => {
  const mode = index.indexOf('class="training-mode-selector"');
  const context = index.indexOf('id="training-prescribed-context"');
  const date = index.indexOf('id="training-date-navigator"');
  const start = index.indexOf('id="treino-start-btn"');
  assert.ok(mode > -1);
  assert.ok(context > mode);
  assert.ok(date > context);
  assert.ok(start > date);
  assert.match(index, /id="training-ficha-trigger"/);
  assert.match(index, /id="training-treino-trigger"/);
  assert.match(index, /id="training-cycle-trigger"/);
  assert.match(index, /id="training-date-previous"/);
  assert.match(index, /id="training-date-open"/);
  assert.match(index, /id="training-date-next"/);
});
```

- [ ] **Step 2: Executar e confirmar a falha**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/frontend-contract.test.cjs
```

Expected: FAIL porque `training-prescribed-context` e `training-date-navigator` ainda não existem.

- [ ] **Step 3: Substituir a estrutura visual antiga**

Em `app/index.html`, manter a linha de modo e trocar ciclos separados + filtros antigos por:

```html
<div class="training-prescribed-context" id="training-prescribed-context">
  <div class="training-select-field training-select-field--ficha">
    <label for="training-ficha-trigger">Ficha</label>
    <button type="button" class="training-select-trigger" id="training-ficha-trigger"
      aria-haspopup="listbox" aria-expanded="false" onclick="App.toggleTrainingSelect('ficha')">
      <span id="training-ficha-value">Selecionar</span><span aria-hidden="true">⌄</span>
    </button>
    <div class="training-select-menu" id="training-ficha-menu" role="listbox"></div>
    <select id="ficha-filter" class="training-native-control" tabindex="-1" aria-hidden="true"></select>
  </div>
  <div class="training-select-field training-select-field--treino">
    <label for="training-treino-trigger">Treino</label>
    <button type="button" class="training-select-trigger" id="training-treino-trigger"
      aria-haspopup="listbox" aria-expanded="false" onclick="App.toggleTrainingSelect('treino')">
      <span id="training-treino-value">Selecionar</span><span aria-hidden="true">⌄</span>
    </button>
    <div class="training-select-menu" id="training-treino-menu" role="listbox"></div>
    <select id="treino-filter" class="training-native-control" tabindex="-1" aria-hidden="true"></select>
  </div>
  <div class="training-select-field training-select-field--cycle">
    <label for="training-cycle-trigger">Ciclo</label>
    <button type="button" class="training-select-trigger" id="training-cycle-trigger"
      aria-haspopup="listbox" aria-expanded="false" onclick="App.toggleTrainingSelect('cycle')">
      <span id="training-cycle-value">1</span><span aria-hidden="true">⌄</span>
    </button>
    <div class="training-select-menu training-select-menu--right" id="training-cycle-menu" role="listbox"></div>
  </div>
</div>
<div class="training-date-navigator" id="training-date-navigator">
  <button type="button" id="training-date-previous" aria-label="Dia anterior" onclick="App.shiftTrainingDate(-1)">‹</button>
  <button type="button" id="training-date-open" aria-haspopup="dialog" onclick="App.openTrainingCalendar()">
    <span id="training-date-weekday"></span><span id="training-date-label"></span>
  </button>
  <button type="button" id="training-date-next" aria-label="Próximo dia" onclick="App.shiftTrainingDate(1)">›</button>
  <input type="date" id="treino-date" class="training-native-control" tabindex="-1" aria-hidden="true" />
</div>
```

- [ ] **Step 4: Executar os contratos**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/frontend-contract.test.cjs
```

Expected: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
bash scripts/git-workspace.sh add app/index.html tests/cloudflare/frontend-contract.test.cjs
bash scripts/git-workspace.sh commit -m "feat: reorganize training start controls"
```

### Task 2: Implementar datas locais e navegação diária

**Files:**
- Create: `tests/training-start-controls.test.cjs`
- Modify: `app/script.html:1-55,250-290,590-660`
- Modify: `tests/app-regression.test.js`

**Interfaces:**
- Produces: `xsParseDateKey(value) -> Date`, `xsDateKey(date) -> string`, `xsShiftDateKey(value, days) -> string`, `App.shiftTrainingDate(days)`, `App.renderTrainingDate()`.
- Consumes: `App.selectedDate` e o controle interno `treino-date`.

- [ ] **Step 1: Escrever testes executáveis de data que falham**

Criar `tests/training-start-controls.test.cjs` com este carregador e o teste inicial:

```js
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "script.html"), "utf8")
  .replace(/^\s*<script>\s*/, "")
  .replace(/\s*<\/script>\s*$/, "");
const context = {
  console,
  setTimeout,
  clearTimeout,
  document: {
    readyState: "loading",
    addEventListener() {}
  }
};
vm.createContext(context);
vm.runInContext(source, context);

test("date helpers cross month and year without UTC drift", () => {
  assert.equal(context.xsShiftDateKey("2026-01-31", 1), "2026-02-01");
  assert.equal(context.xsShiftDateKey("2026-01-01", -1), "2025-12-31");
  assert.equal(context.xsDateKey(context.xsParseDateKey("2026-09-01")), "2026-09-01");
});
```

O contexto precisa oferecer `console`, `setTimeout`, `clearTimeout` e um `document` mínimo; o callback `DOMContentLoaded` não deve ser executado.

- [ ] **Step 2: Executar e confirmar a falha**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/training-start-controls.test.cjs
```

Expected: FAIL com `xsShiftDateKey is not a function`.

- [ ] **Step 3: Implementar helpers puros**

Adicionar antes de `SERVER_ROUTES`:

```js
function xsParseDateKey(value) {
  var parts = String(value || "").split("-");
  if (parts.length !== 3) return new Date();
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0);
}

function xsPad2(value) {
  return ("0" + value).slice(-2);
}

function xsDateKey(date) {
  var year = date.getFullYear();
  var month = xsPad2(date.getMonth() + 1);
  var day = xsPad2(date.getDate());
  return year + "-" + month + "-" + day;
}

function xsShiftDateKey(value, days) {
  var date = xsParseDateKey(value);
  date.setDate(date.getDate() + Number(days || 0));
  return xsDateKey(date);
}
```

- [ ] **Step 4: Integrar a navegação ao estado existente**

Adicionar:

```js
shiftTrainingDate: function shiftTrainingDate(days) {
  this.selectedDate = xsShiftDateKey(this.selectedDate, days);
  this.renderTrainingDate();
},
renderTrainingDate: function renderTrainingDate() {
  var date = xsParseDateKey(this.selectedDate);
  var weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
  var label = date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("training-date-weekday").textContent = weekday;
  document.getElementById("training-date-label").textContent = label;
  document.getElementById("treino-date").value = this.selectedDate;
},
```

Chamar `renderTrainingDate()` em `renderTrainingStart()` e manter `selectedDate` como única fonte de verdade.

- [ ] **Step 5: Executar os testes de data e regressão**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/training-start-controls.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/app-regression.test.js
```

Expected: ambos PASS; nenhum recurso moderno proibido aparece.

- [ ] **Step 6: Commit**

```bash
bash scripts/git-workspace.sh add app/script.html tests/training-start-controls.test.cjs tests/app-regression.test.js
bash scripts/git-workspace.sh commit -m "feat: add local training date navigation"
```

### Task 3: Implementar os comboboxes temáticos

**Files:**
- Modify: `tests/cloudflare/frontend-contract.test.cjs`
- Modify: `tests/training-start-controls.test.cjs`
- Modify: `app/script.html:245-270,450-590,2040-2110`
- Modify: `app/style.html:690-800`

**Interfaces:**
- Produces: `trainingOpenSelect`, `renderTrainingSelectors()`, `toggleTrainingSelect(kind)`, `selectTrainingOption(kind, value)`, `closeTrainingSelects()`.
- Consumes: options dos controles internos `ficha-filter` e `treino-filter`, `selectedFicha`, `selectedTreino`, `currentWeek`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar contratos para:

```js
assert.match(script, /toggleTrainingSelect:\s*function/);
assert.match(script, /selectTrainingOption:\s*function/);
assert.match(script, /renderTrainingSelectors:\s*function/);
assert.match(style, /\.training-select-trigger/);
assert.match(style, /\.training-select-menu\.show/);
assert.doesNotMatch(index, /id="treino-cycle-selector"/);
```

No teste executável, criar selects falsos com opções e confirmar que `selectTrainingOption("cycle", "3")` define `currentWeek === 3` e fecha o menu.

- [ ] **Step 2: Executar e confirmar as falhas**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/frontend-contract.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/training-start-controls.test.cjs
```

Expected: FAIL por métodos e estilos ausentes.

- [ ] **Step 3: Implementar estado e renderização**

Adicionar `trainingOpenSelect: ""` ao estado. `renderTrainingSelectors()` deve:

```js
var definitions = {
  ficha: { selected: this.selectedFicha, selectId: "ficha-filter", valueId: "training-ficha-value" },
  treino: { selected: this.selectedTreino, selectId: "treino-filter", valueId: "training-treino-value" }
};
```

Para Ficha/Treino, derivar opções de `select.options`. Para Ciclo, usar exatamente:

```js
[
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" }
]
```

Renderizar botões com `role="option"`, `aria-selected`, texto escapado e chamada a `selectTrainingOption`.

`selectTrainingOption` deve:

- Ficha: atualizar o select interno, chamar `filterFicha()` e depois renderizar.
- Treino: atualizar o select interno, chamar `filterTreino()` e depois renderizar.
- Ciclo: chamar `changeWeek(Number(value))` e depois renderizar.
- Todos: fechar menus e devolver foco ao trigger.

- [ ] **Step 4: Fechar menus sem perder contexto**

Em `bindInlineControls()`, adicionar um único listener de `click` no documento que feche menus quando o alvo não estiver dentro de `.training-select-field`, e um listener `keydown` que feche menus/calendário com `Escape`. Evitar registrar listeners duplicados porque `bindInlineControls()` roda uma vez pelo `bootInitialized`.

- [ ] **Step 5: Aplicar estilos temáticos**

Criar grid `34% 42% 24%`, gatilhos com `appearance: none`, fundo de card, borda sutil, foco lime, elipse de texto, menus absolutos com superfície overlay, opção ativa e rolagem. Manter os controles internos com:

```css
.training-native-control {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  clip: rect(0 0 0 0) !important;
  pointer-events: none !important;
}
```

- [ ] **Step 6: Executar testes**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/frontend-contract.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/training-start-controls.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/app-regression.test.js
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/frontend-polish.test.js
```

Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
bash scripts/git-workspace.sh add app/script.html app/style.html tests/cloudflare/frontend-contract.test.cjs tests/training-start-controls.test.cjs
bash scripts/git-workspace.sh commit -m "feat: add themed training selectors"
```

### Task 4: Implementar o calendário mensal temático

**Files:**
- Modify: `app/index.html:280-330`
- Modify: `app/style.html:690-880`
- Modify: `app/script.html:245-275,590-720`
- Modify: `tests/cloudflare/frontend-contract.test.cjs`
- Modify: `tests/training-start-controls.test.cjs`

**Interfaces:**
- Produces: `trainingCalendarMonth`, `openTrainingCalendar()`, `closeTrainingCalendar(event)`, `changeTrainingCalendarMonth(offset)`, `renderTrainingCalendar()`, `selectTrainingCalendarDate(value)`, `selectTrainingToday()`.
- Consumes: `xsParseDateKey`, `xsDateKey`, `selectedDate`, `renderTrainingDate()`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar contratos para IDs `training-calendar-overlay`, `training-calendar-title`, `training-calendar-grid`, `training-calendar-today` e os seis métodos. No teste executável, confirmar:

```js
context.App.selectedDate = "2026-09-01";
context.App.selectTrainingCalendarDate("2026-10-03");
assert.equal(context.App.selectedDate, "2026-10-03");
```

Testar também que `selectTrainingToday()` produz `xsDateKey(new Date())`, comparando o valor logo após a chamada com a data local do processo.

- [ ] **Step 2: Executar e confirmar as falhas**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/frontend-contract.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/training-start-controls.test.cjs
```

Expected: FAIL por overlay e métodos ausentes.

- [ ] **Step 3: Adicionar o overlay acessível**

Adicionar ao fim dos modais em `app/index.html`:

```html
<div class="training-calendar-overlay" id="training-calendar-overlay" role="dialog"
  aria-modal="true" aria-labelledby="training-calendar-title">
  <div class="training-calendar-panel">
    <div class="training-calendar-header">
      <button type="button" aria-label="Mês anterior" onclick="App.changeTrainingCalendarMonth(-1)">‹</button>
      <h2 id="training-calendar-title"></h2>
      <button type="button" aria-label="Próximo mês" onclick="App.changeTrainingCalendarMonth(1)">›</button>
    </div>
    <div class="training-calendar-weekdays" aria-hidden="true"></div>
    <div class="training-calendar-grid" id="training-calendar-grid"></div>
    <div class="training-calendar-actions">
      <button type="button" class="btn-ghost" id="training-calendar-today" onclick="App.selectTrainingToday()">Hoje</button>
      <button type="button" class="btn-ghost" onclick="App.closeTrainingCalendar()">Voltar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Renderizar uma grade estável de 42 dias**

`renderTrainingCalendar()` calcula o domingo anterior ou igual ao primeiro dia do mês e cria 42 botões. Cada botão inclui:

- `data-date="YYYY-MM-DD"`;
- classe `is-outside` quando não pertence ao mês exibido;
- classe `is-today` para a data local atual;
- classe `is-selected` para `selectedDate`;
- `aria-current="date"` no dia atual;
- `aria-pressed="true"` no selecionado;
- `onclick="App.selectTrainingCalendarDate('YYYY-MM-DD')"`.

`openTrainingCalendar()` copia o mês de `selectedDate`, renderiza e abre. Selecionar atualiza estado, renderiza a faixa de data e fecha.

- [ ] **Step 5: Estilizar overlay e calendário**

Usar quatro superfícies dark, borda sutil, selecionado lime, hoje com ponto/contorno discreto e dias externos rebaixados. Mobile usa painel encostado à base com cantos superiores; acima de 640 px, centralizar painel de largura máxima 380 px. As transições usam somente `opacity` e `transform` por 200 ms e são removidas em `prefers-reduced-motion`.

- [ ] **Step 6: Executar os testes**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/frontend-contract.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/training-start-controls.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/app-regression.test.js
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/frontend-polish.test.js
```

Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
bash scripts/git-workspace.sh add app/index.html app/script.html app/style.html tests/cloudflare/frontend-contract.test.cjs tests/training-start-controls.test.cjs
bash scripts/git-workspace.sh commit -m "feat: add themed training calendar"
```

### Task 5: Integrar, documentar e publicar

**Files:**
- Modify: `docs/guias-operacionais/08-sessao-treino-e-treino-livre.md`
- Generated, ignored: `worker/public/index.html`, `worker/public/app.js`, `worker/public/style.css`

**Interfaces:**
- Consumes: novo formulário completo e builder existente.
- Produces: assets publicados na URL atual, sem alteração de banco.

- [ ] **Step 1: Atualizar o guia operacional**

Documentar:

- modo no primeiro controle;
- Ficha/Treino/Ciclo na mesma linha;
- linha oculta no Treino livre;
- setas que mudam um dia;
- toque na data que abre o calendário;
- botão Hoje e fechamento sem alteração.

- [ ] **Step 2: Executar a verificação completa local**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/training-start-controls.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/frontend-contract.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/app-regression.test.js
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/frontend-polish.test.js
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node tests/cloudflare/assets-build.test.cjs
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node node_modules/vitest/vitest.mjs run
```

Expected: todos PASS; Vitest mantém 13 arquivos e 69 testes, salvo aumento deliberado de cobertura.

- [ ] **Step 3: Verificar em navegador móvel**

Gerar assets, iniciar servidor estático e usar viewport `390 × 844`. Confirmar:

- nenhuma rolagem horizontal;
- três campos na mesma linha;
- menus dentro da viewport e com tema dark;
- modo livre oculta a linha inteira;
- setas atravessam mês corretamente;
- calendário abre, muda mês, seleciona dia e fecha;
- Histórico e Carga continuam navegáveis e visualmente inalterados;
- zero erro de console.

- [ ] **Step 4: Commit da documentação**

```bash
bash scripts/git-workspace.sh add docs/guias-operacionais/08-sessao-treino-e-treino-livre.md
bash scripts/git-workspace.sh commit -m "docs: explain themed training date selector"
```

- [ ] **Step 5: Integrar e verificar na main**

Fazer merge fast-forward da branch isolada, executar novamente os testes de Task 5 Step 2 na `main` e confirmar `git diff --check` limpo.

- [ ] **Step 6: Publicar sem migrar o D1**

Run:

```bash
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node scripts/build-cloudflare-assets.js
/home/elohimlima/.nvm/versions/node/v24.19.0/bin/node node_modules/wrangler/bin/wrangler.js deploy
```

Expected: upload dos três assets e URL `https://xsteam-pwa.fitmanagement-els.workers.dev`. Não executar `d1 migrations apply`, pois este incremento não altera banco.

- [ ] **Step 7: Verificar publicação e sincronizar GitHub**

Confirmar `/` e `/app.js` com HTTP 200, `/api/status` com 401 sem login, verificar os novos IDs no asset remoto, abrir a tela de login Google sem erros e enviar `main` ao `origin`.

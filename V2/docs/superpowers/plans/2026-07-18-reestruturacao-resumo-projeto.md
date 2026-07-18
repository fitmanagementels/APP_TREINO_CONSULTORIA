# Reestruturação do Resumo do Projeto — Plano de Implementação

> **Para agentes:** execute cada tarefa em sequência, preservando `RESUMO_PROJETO.md` como fonte de verdade e mantendo `docs/index.html` como sua representação navegável.

**Objetivo:** Transformar a documentação de resumo em um status confiável e portátil para retomar o projeto em outra sessão.

**Arquitetura:** `docs/RESUMO_PROJETO.md` concentrará fatos observados, decisões, pendências e instruções de retomada. `docs/index.html` espelhará os mesmos blocos em uma página HTML autônoma com seções recolhíveis, priorizando estado atual e próxima ação no primeiro viewport.

**Tecnologias:** Markdown, HTML, CSS e JavaScript nativo; testes Node.js com `assert`.

## Restrições globais

- Não alterar o código do Web App ou os dados da planilha.
- Não registrar credenciais, tokens ou identificadores privados de integração.
- Distinguir fatos verificados, decisões registradas e pendências externas.
- Manter a página de documentação funcional sem dependências externas.

---

### Tarefa 1: Definir o contrato de documentação verificável

**Arquivos:**
- Modificar: `tests/app-regression.test.js`
- Testar: `tests/app-regression.test.js`

- [ ] Substituir as verificações do visualizador antigo por asserções que exijam no HTML: estado atual, próxima ação, seções `<details>` e contexto para continuidade.
- [ ] Executar `node tests/app-regression.test.js` e confirmar falha antes da implementação do HTML novo.

### Tarefa 2: Reescrever a fonte de verdade em Markdown

**Arquivos:**
- Modificar: `docs/RESUMO_PROJETO.md`

- [ ] Registrar resumo executivo, objetivo, estado atual, histórico relevante, decisões, etapa atual, próximos passos, mapa de arquivos, riscos e contexto para outra IA.
- [ ] Remover afirmações superadas sobre a tela Prescrever e o schema antigo de `DB_GestaoCarga`.
- [ ] Registrar somente fatos verificáveis no repositório e marcar a publicação no Apps Script como pendência de validação externa.

### Tarefa 3: Espelhar o resumo em HTML navegável

**Arquivos:**
- Modificar: `docs/index.html`

- [ ] Exibir objetivo, estado, ponto de parada e próxima ação acima das seções detalhadas.
- [ ] Usar `<details>` para todas as seções extensas, sem dependências externas e com layout responsivo.
- [ ] Refletir o mesmo conteúdo factual do Markdown, sem introduzir uma segunda narrativa.

### Tarefa 4: Verificar e publicar

**Arquivos:**
- Revisar: `docs/RESUMO_PROJETO.md`, `docs/index.html`, `tests/app-regression.test.js`

- [ ] Executar `node tests/app-regression.test.js` e `node tests/frontend-polish.test.js`.
- [ ] Executar `bash scripts/git-workspace.sh diff --check`.
- [ ] Revisar a árvore de trabalho, criar commit e enviar `main` para `origin` via SSH.
- [ ] Atualizar a referência remota e confirmar que `HEAD`, `origin/main` e o SHA remoto são iguais.

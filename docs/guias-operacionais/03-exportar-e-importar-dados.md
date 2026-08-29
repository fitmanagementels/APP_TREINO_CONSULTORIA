# Guia 03 — exportar Sheets, importar em staging e auditar

Faça este guia somente depois de concluir o [Guia 02](02-criar-d1-staging-e-deploy-preview.md). Ele lê o Google Sheets, gera arquivos locais e grava somente no banco **`xsteam-pwa-staging`**. O Apps Script e as planilhas permanecem como rollback e não devem ser alterados.

## 1. Preparar as pastas locais

No terminal da pasta do projeto, rode:

```bash
mkdir -p data-import/source data-import/staging
```

Essa área é ignorada pelo Git porque os arquivos podem conter dados operacionais.

## 2. Baixar cada aba do Google Sheets

Abra a planilha atual no navegador. Para cada uma das três abas abaixo, siga exatamente a mesma sequência:

1. Clique na aba correta no rodapé da planilha.
2. No menu superior, clique em **Arquivo**.
3. Clique em **Fazer download**.
4. Clique em **Valores separados por vírgulas (.csv, planilha atual)**.
5. No navegador, localize o arquivo baixado e renomeie-o como indicado.
6. Mova o arquivo para `data-import/source` dentro deste projeto.

| Aba selecionada | Nome final obrigatório |
| --- | --- |
| `Demanda_Muscular` | `Demanda_Muscular.csv` |
| `DB_Prescricao` | `DB_Prescricao.csv` |
| `DB_Execucao` | `DB_Execucao.csv` |

Ao terminar, `data-import/source` deve conter **exatamente** esses três arquivos. Não acrescente arquivos auxiliares nessa pasta.

## 3. Validar e gerar SQL localmente

Rode:

```bash
node scripts/import-google-sheet-csv.js --source data-import/source --output data-import/staging
```

Abra `data-import/staging/import-manifest.json` no VS Code. Só continue se aparecer:

```json
"ok": true,
"validationErrors": []
```

O gerador valida cabeçalhos, remove o BOM comum de CSV, aceita decimais brasileiros como `0,75`, conta linhas ignoradas sem exercício e bloqueia sessões duplicadas. Se houver qualquer erro, pare, corrija apenas a exportação local e execute novamente. Não faça edição improvisada no D1.

## 4. Aplicar os arquivos no banco de testes

Rode os três comandos abaixo, nesta ordem, sempre com `xsteam-pwa-staging`:

```bash
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/01-exercise-catalog.sql
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/02-prescriptions.sql
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/03-executions.sql
```

Cada comando deve terminar sem erro SQL. Se um falhar, pare e mantenha o Apps Script sem alteração.

## 5. Conferir as contagens no D1

Execute individualmente estas consultas de leitura:

```bash
npx wrangler d1 execute xsteam-pwa-staging --remote --command="SELECT COUNT(*) AS count FROM exercise_catalog;"
npx wrangler d1 execute xsteam-pwa-staging --remote --command="SELECT COUNT(*) AS count FROM prescription_exercises;"
npx wrangler d1 execute xsteam-pwa-staging --remote --command="SELECT COUNT(*) AS count FROM execution_records;"
```

Agora salve uma única saída JSON de contagens e uma saída JSON de IDs, ambas na pasta local ignorada. Copie e cole os comandos completos:

```bash
npx wrangler d1 execute xsteam-pwa-staging --remote --json --command="SELECT 'exercise_catalog' AS table_name, COUNT(*) AS count FROM exercise_catalog UNION ALL SELECT 'prescription_exercises' AS table_name, COUNT(*) AS count FROM prescription_exercises UNION ALL SELECT 'execution_records' AS table_name, COUNT(*) AS count FROM execution_records;" > data-import/staging/target-counts.json
npx wrangler d1 execute xsteam-pwa-staging --remote --json --command="SELECT id_sessao FROM execution_records ORDER BY id_sessao;" > data-import/staging/target-session-ids.json
node scripts/audit-migration.js --manifest data-import/staging/import-manifest.json --target-counts data-import/staging/target-counts.json --target-session-ids data-import/staging/target-session-ids.json
```

O sucesso é o último comando mostrar `"ok": true`. Se mostrar `false`, contagens diferentes, sessão duplicada ou sessão faltando, não avance: não apague dados no D1 e não desative o Apps Script. Refaça a exportação e a validação desde o início.

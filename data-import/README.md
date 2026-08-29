# Transferência local de dados

Esta pasta é somente local. Os CSVs e os arquivos gerados podem conter dados operacionais; por isso, o Git mantém apenas este README.

Antes de qualquer importação, crie `data-import/source` e coloque nela exatamente estes três arquivos exportados do Google Sheets:

- `Demanda_Muscular.csv`
- `DB_Prescricao.csv`
- `DB_Execucao.csv`

Execute uma geração local e auditável:

```bash
node scripts/import-google-sheet-csv.js --source data-import/source --output data-import/staging
node scripts/audit-migration.js --manifest data-import/staging/import-manifest.json --target-counts data-import/staging/target-counts.json --target-session-ids data-import/staging/target-session-ids.json
```

O primeiro comando sempre cria `import-manifest.json`. Ele só cria os três arquivos SQL quando `validationErrors` estiver vazio. Nunca aplique SQL se o manifesto indicar erro; corrija a exportação e gere tudo novamente.

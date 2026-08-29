const fs = require("node:fs");

const TABLES = ["exercise_catalog", "prescription_exercises", "execution_records"];

function numberFrom(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  if (!value || typeof value !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(value, "count")) return numberFrom(value.count);
  for (const nested of Object.values(value)) {
    const found = numberFrom(nested);
    if (found !== null) return found;
  }
  return null;
}

function sessionIdsFrom(value) {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) {
    return value.flatMap(sessionIdsFrom);
  }
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.sessionIds)) return value.sessionIds.map(String);
  if (value.id_sessao !== undefined) return [String(value.id_sessao)];
  return Object.values(value).flatMap(sessionIdsFrom);
}

function auditMigration({ manifest, targetCounts, targetSessionIds }) {
  const tables = {};
  const errors = [];
  TABLES.forEach((tableName) => {
    const sourceTable = manifest.tables && manifest.tables[tableName];
    const sourceCount = sourceTable && Number(sourceTable.importedRows);
    const targetCount = numberFrom(targetCounts && targetCounts[tableName]);
    const ok = Number.isFinite(sourceCount) && targetCount !== null && sourceCount === targetCount;
    tables[tableName] = { sourceCount, targetCount, ok };
    if (!ok) errors.push(`Contagem divergente em ${tableName}: origem ${sourceCount}, destino ${targetCount}.`);
  });
  const ids = sessionIdsFrom(targetSessionIds);
  const duplicateSessionIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();
  const expectedSessionIds = ((manifest.tables && manifest.tables.execution_records && manifest.tables.execution_records.keys) || []).map(String);
  const missingSessionIds = expectedSessionIds.filter((id) => ids.indexOf(id) === -1).sort();
  if (duplicateSessionIds.length) errors.push(`id_sessao duplicado no destino: ${duplicateSessionIds.join(", ")}.`);
  if (missingSessionIds.length) errors.push(`id_sessao ausente no destino: ${missingSessionIds.join(", ")}.`);
  return {
    ok: errors.length === 0,
    tables,
    duplicateSessionIds,
    missingSessionIds,
    errors,
  };
}

function parseArguments(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (["--manifest", "--target-counts", "--target-session-ids"].indexOf(key) !== -1) args[key.slice(2)] = argv[index + 1];
  }
  if (!args.manifest || !args["target-counts"] || !args["target-session-ids"]) {
    throw new Error("Uso: node scripts/audit-migration.js --manifest ARQUIVO --target-counts ARQUIVO --target-session-ids ARQUIVO");
  }
  return args;
}

if (require.main === module) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const report = auditMigration({
      manifest: JSON.parse(fs.readFileSync(args.manifest, "utf8")),
      targetCounts: JSON.parse(fs.readFileSync(args["target-counts"], "utf8")),
      targetSessionIds: JSON.parse(fs.readFileSync(args["target-session-ids"], "utf8")),
    });
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}

module.exports = { auditMigration };

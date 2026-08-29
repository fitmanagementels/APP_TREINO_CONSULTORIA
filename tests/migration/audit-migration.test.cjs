const assert = require("node:assert");
const test = require("node:test");

const { auditMigration } = require("../../scripts/audit-migration.js");

const manifest = {
  tables: {
    exercise_catalog: { importedRows: 1 },
    prescription_exercises: { importedRows: 2 },
    execution_records: { importedRows: 2, keys: ["sessao-1", "sessao-2"] },
  },
};

test("reports count differences, duplicate target sessions and missing expected sessions", () => {
  const report = auditMigration({
    manifest,
    targetCounts: {
      exercise_catalog: 1,
      prescription_exercises: 1,
      execution_records: 2,
    },
    targetSessionIds: ["sessao-1", "sessao-1"],
  });

  assert.equal(report.ok, false);
  assert.equal(report.tables.prescription_exercises.ok, false);
  assert.deepEqual(report.duplicateSessionIds, ["sessao-1"]);
  assert.deepEqual(report.missingSessionIds, ["sessao-2"]);
});

test("passes only when every imported count and execution id exists once in D1 output", () => {
  const report = auditMigration({
    manifest,
    targetCounts: {
      exercise_catalog: 1,
      prescription_exercises: 2,
      execution_records: 2,
    },
    targetSessionIds: { sessionIds: ["sessao-2", "sessao-1"] },
  });

  assert.equal(report.ok, true);
});

test("accepts the JSON shape emitted by Wrangler D1 queries", () => {
  const report = auditMigration({
    manifest,
    targetCounts: [{
      success: true,
      results: [
        { table_name: "exercise_catalog", count: 1 },
        { table_name: "prescription_exercises", count: 2 },
        { table_name: "execution_records", count: 2 },
      ],
    }],
    targetSessionIds: [{ success: true, results: [{ id_sessao: "sessao-1" }, { id_sessao: "sessao-2" }] }],
  });

  assert.equal(report.ok, true);
});

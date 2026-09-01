const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs
  .readFileSync(path.join(root, "app", "script.html"), "utf8")
  .replace(/^\s*<script>\s*/, "")
  .replace(/\s*<\/script>\s*$/, "");
const context = {
  console,
  setTimeout,
  clearTimeout,
  document: {
    readyState: "loading",
    addEventListener() {},
  },
};
vm.createContext(context);
vm.runInContext(source, context);

test("date helpers cross month and year without UTC drift", () => {
  assert.equal(context.xsShiftDateKey("2026-01-31", 1), "2026-02-01");
  assert.equal(context.xsShiftDateKey("2026-01-01", -1), "2025-12-31");
  assert.equal(
    context.xsDateKey(context.xsParseDateKey("2026-09-01")),
    "2026-09-01",
  );
});

test("cycle selector updates the existing currentWeek state and closes", () => {
  context.document.getElementById = () => null;
  context.App.currentWeek = 1;
  context.App.trainingOpenSelect = "cycle";
  context.App.changeWeek = function changeWeek(value) {
    this.currentWeek = value;
  };
  context.App.renderTrainingSelectors = function renderTrainingSelectors() {};

  context.App.selectTrainingOption("cycle", "3");

  assert.equal(context.App.currentWeek, 3);
  assert.equal(context.App.trainingOpenSelect, "");
});

test("calendar selection and Hoje update the existing selectedDate state", () => {
  context.document.getElementById = () => null;
  context.App.renderTrainingDate = function renderTrainingDate() {};
  context.App.closeTrainingCalendar = function closeTrainingCalendar() {};
  context.App.selectedDate = "2026-09-01";

  context.App.selectTrainingCalendarDate("2026-10-03");
  assert.equal(context.App.selectedDate, "2026-10-03");

  context.App.selectTrainingToday();
  assert.equal(context.App.selectedDate, context.xsDateKey(new Date()));
});

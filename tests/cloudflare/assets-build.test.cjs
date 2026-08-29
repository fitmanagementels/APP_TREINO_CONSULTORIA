const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");

test("asset builder emits a static PWA shell without Apps Script templates", () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "xsteam-assets-"));

  try {
    execFileSync(process.execPath, ["scripts/build-cloudflare-assets.js", "--output", output], {
      cwd: root,
      stdio: "pipe",
    });

    const html = fs.readFileSync(path.join(output, "index.html"), "utf8");
    const script = fs.readFileSync(path.join(output, "app.js"), "utf8");
    const style = fs.readFileSync(path.join(output, "style.css"), "utf8");

    assert.doesNotMatch(html, /<\?!=/);
    assert.doesNotMatch(html, /include\('/);
    assert.doesNotMatch(html, /getInitialAppDataJson\(\)/);
    assert.match(html, /<link rel="stylesheet" href="\/style\.css">/);
    assert.match(html, /<script src="\/app\.js"><\/script>/);
    assert.match(html, /window\.__XS_BOOTSTRAP__ = null;/);
    assert.doesNotMatch(script, /^\s*<script>/);
    assert.doesNotMatch(script, /<\/script>\s*$/);
    assert.doesNotMatch(style, /^\s*<style>/);
    assert.doesNotMatch(style, /<\/style>\s*$/);
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});

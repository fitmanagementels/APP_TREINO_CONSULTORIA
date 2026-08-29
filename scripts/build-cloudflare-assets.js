const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function unwrapTag(source, tagName) {
  const opening = new RegExp(`^\\s*<${tagName}>\\s*`);
  const closing = new RegExp(`\\s*</${tagName}>\\s*$`);
  return source.replace(opening, "").replace(closing, "\n");
}

function getOutputDirectory() {
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex === -1) return path.join(root, "worker", "public");

  const output = process.argv[outputIndex + 1];
  if (!output || output.startsWith("-")) {
    throw new Error("Use --output seguido de uma pasta de destino.");
  }

  return path.resolve(process.cwd(), output);
}

function buildAssets(outputDirectory) {
  const index = readSource(path.join("app", "index.html"))
    .replace("<?!= include('style'); ?>", '<link rel="stylesheet" href="/style.css">')
    .replace(
      "window.__XS_BOOTSTRAP__ = <?!= getInitialAppDataJson(); ?>;",
      "window.__XS_BOOTSTRAP__ = null;",
    )
    .replace("<?!= include('script'); ?>", '<script src="/app.js"></script>');
  const script = unwrapTag(readSource(path.join("app", "script.html")), "script");
  const style = unwrapTag(readSource(path.join("app", "style.html")), "style");

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "index.html"), index, "utf8");
  fs.writeFileSync(path.join(outputDirectory, "app.js"), script, "utf8");
  fs.writeFileSync(path.join(outputDirectory, "style.css"), style, "utf8");
}

buildAssets(getOutputDirectory());

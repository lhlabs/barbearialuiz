import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("GitHub Pages export contains the public booking site", async () => {
  const html = await readFile(path.join(root, "out/index.html"), "utf8");
  assert.match(html, /Seu estilo/);
  assert.match(html, /Agendar/);
  assert.match(html, /barbearialuiz\/_next/);
});

test("admin export contains no customer data and is not indexed", async () => {
  const html = await readFile(path.join(root, "out/admin/index.html"), "utf8");
  assert.match(html, /Validando acesso seguro/);
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /customerPhone|customerName|Próximos atendimentos/);
});

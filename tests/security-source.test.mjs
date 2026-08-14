import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const ignored = new Set([".git", ".next", ".sites-runtime", ".wrangler", "dist", "node_modules", "out"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

test("repository contains no elevated Supabase key or service-role JWT", async () => {
  const files = await sourceFiles(root);
  for (const file of files) {
    const contents = await readFile(file, "utf8").catch(() => "");
    assert.doesNotMatch(contents, /sb_secret_[A-Za-z0-9_-]{12,}/, `${file} contains a secret key`);

    for (const token of contents.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      assert.notEqual(payload.role, "service_role", `${file} contains a service_role JWT`);
    }
  }
});

test("database migration includes non-negotiable security invariants", async () => {
  const sql = await readFile(path.join(root, "supabase/migrations/20260813220000_initial_booking_system.sql"), "utf8");
  assert.match(sql, /appointments_no_overlapping_scheduled/);
  assert.match(sql, /exclude using gist/);
  assert.match(sql, /alter table public\.appointments enable row level security/);
  assert.match(sql, /revoke all on all tables in schema public from anon, authenticated/);
  assert.match(sql, /if not public\.is_admin\(\)/);
  assert.match(sql, /set search_path = pg_catalog, public/);
});


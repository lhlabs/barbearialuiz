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

test("repository contains no privileged credential material", async () => {
  const files = await sourceFiles(root);
  for (const file of files) {
    const contents = await readFile(file, "utf8").catch(() => "");
    assert.doesNotMatch(contents, /-----BEGIN (RSA |EC |)PRIVATE KEY-----/, `${file} contains a private key`);
    assert.doesNotMatch(contents, /"private_key"\s*:/, `${file} contains a service-account key`);
  }
});

test("Firestore rules are deny-by-default and protect personal data", async () => {
  const rules = await readFile(path.join(root, "firestore.rules"), "utf8");
  assert.match(rules, /function isAdmin\(\)/);
  assert.match(rules, /match \/appointments\/\{appointmentId\}/);
  assert.match(rules, /allow read: if isAdmin\(\)/);
  assert.match(rules, /validPublicSlotBooking/);
  assert.match(rules, /getAfter/);
  assert.match(rules, /keys\(\)\.hasOnly/);
  assert.match(rules, /match \/\{document=\*\*\}/);
  assert.match(rules, /allow read, write: if false/);
});

test("booking is transactional and admin sessions are tab-scoped", async () => {
  const booking = await readFile(path.join(root, "lib/firebase-booking.ts"), "utf8");
  const client = await readFile(path.join(root, "lib/firebase.ts"), "utf8");
  const layout = await readFile(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(booking, /runTransaction/);
  assert.match(booking, /state !== "open"/);
  assert.match(booking, /const SLOT_INTERVAL = 15/);
  assert.match(booking, /where\("barberId", "==", barberId\)/);
  assert.match(booking, /id: "acabamento"/);
  assert.match(booking, /id: "caio"/);
  assert.match(booking, /id: "rafael"/);
  assert.match(client, /browserSessionPersistence/);
  assert.match(layout, /Content-Security-Policy/);
  assert.match(layout, /object-src 'none'/);
  assert.match(layout, /googleapis\.com/);
});

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
  assert.match(rules, /function validBrazilianMobile\(value\)/);
  assert.match(rules, /function validPublicBookingCounter/);
  assert.match(rules, /match \/publicBookingCounters\/\{counterId\}/);
  assert.match(rules, /request\.resource\.data\.count <= 2/);
  assert.match(rules, /allow read, delete: if false/);
  assert.match(rules, /match \/appointments\/\{appointmentId\}/);
  assert.match(rules, /allow read: if isAdmin\(\)/);
  assert.match(rules, /validPublicSlotBooking/);
  assert.match(rules, /getAfter/);
  assert.match(rules, /keys\(\)\.hasOnly/);
  assert.match(rules, /match \/\{document=\*\*\}/);
  assert.match(rules, /allow read, write: if false/);
});

test("booking is transactional, throttled and uses one consistent start-time window", async () => {
  const booking = await readFile(path.join(root, "lib/firebase-booking.ts"), "utf8");
  const guard = await readFile(path.join(root, "lib/booking-security.ts"), "utf8");
  const client = await readFile(path.join(root, "lib/firebase.ts"), "utf8");
  const layout = await readFile(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(booking, /runTransaction/);
  assert.match(booking, /state !== "open"/);
  assert.match(booking, /publicBookingCounters/);
  assert.match(booking, /registerBookingAttempt/);
  assert.match(booking, /registerBookingSuccess/);
  assert.match(booking, /const SLOT_INTERVAL = 15/);
  assert.match(booking, /const MAX_SERVICE_DURATION = 90/);
  assert.match(booking, /function isBookableStart/);
  assert.match(booking, /filter\(\(\[start\]\) => isBookableStart\(date, start, availability\)\)/);
  assert.match(booking, /if \(!isBookableStart\(input\.date, input\.startMinute, availability\)\) throw new Error\("invalid-slot"\)/);
  assert.match(booking, /supportEndExclusive = minuteFromTime\(range\.end\) \+ MAX_SERVICE_DURATION - SLOT_INTERVAL/);
  assert.match(booking, /availabilityEquals\(storedAvailability, LEGACY_DEFAULT_AVAILABILITY\)/);
  assert.match(booking, /"6": \[\{ start: "09:00", end: "19:00" \}\]/);
  assert.match(booking, /where\("barberId", "==", barberId\)/);
  assert.match(booking, /id: "acabamento"/);
  assert.match(booking, /id: "caio"/);
  assert.match(booking, /id: "rafael"/);
  assert.match(guard, /VALID_BRAZIL_DDDS/);
  assert.match(guard, /subscriber\.startsWith\("9"\)/);
  assert.match(guard, /MAX_ATTEMPTS_PER_WINDOW = 5/);
  assert.match(guard, /MAX_SUCCESSES_PER_DAY = 3/);
  assert.match(client, /browserSessionPersistence/);
  assert.match(client, /initializeAppCheck/);
  assert.match(layout, /Content-Security-Policy/);
  assert.match(layout, /object-src 'none'/);
  assert.match(layout, /googleapis\.com/);
});
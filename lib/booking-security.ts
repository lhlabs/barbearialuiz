"use client";

const VALID_BRAZIL_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

const THROTTLE_KEY = "barbearia-booking-guard-v1";
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const SUCCESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_ATTEMPT_INTERVAL_MS = 12 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const MAX_SUCCESSES_PER_DAY = 3;

type BookingThrottleState = {
  attempts: number[];
  successes: number[];
};

export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length === 13 ? digits.slice(2) : digits;
}

export function isPlausibleBrazilianMobile(value: string) {
  const phone = normalizeBrazilianPhone(value);
  if (!/^\d{11}$/.test(phone)) return false;
  if (!VALID_BRAZIL_DDDS.has(phone.slice(0, 2))) return false;

  const subscriber = phone.slice(2);
  if (!subscriber.startsWith("9")) return false;
  if (/^(\d)\1{8}$/.test(subscriber)) return false;
  if (["912345678", "987654321"].includes(subscriber)) return false;

  return true;
}

function readThrottleState(): BookingThrottleState {
  if (typeof window === "undefined") return { attempts: [], successes: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(THROTTLE_KEY) ?? "{}") as Partial<BookingThrottleState>;
    return {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts.filter(Number.isFinite) : [],
      successes: Array.isArray(parsed.successes) ? parsed.successes.filter(Number.isFinite) : [],
    };
  } catch {
    return { attempts: [], successes: [] };
  }
}

function writeThrottleState(state: BookingThrottleState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THROTTLE_KEY, JSON.stringify(state));
  } catch {
    // Local storage is only an additional abuse barrier; Firestore rules remain authoritative.
  }
}

export function registerBookingAttempt() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const state = readThrottleState();
  const attempts = state.attempts.filter((timestamp) => now - timestamp < ATTEMPT_WINDOW_MS);
  const successes = state.successes.filter((timestamp) => now - timestamp < SUCCESS_WINDOW_MS);

  if (successes.length >= MAX_SUCCESSES_PER_DAY) throw new Error("rate-limited");
  if (attempts.length >= MAX_ATTEMPTS_PER_WINDOW) throw new Error("rate-limited");
  const lastAttempt = attempts.at(-1);
  if (lastAttempt && now - lastAttempt < MIN_ATTEMPT_INTERVAL_MS) throw new Error("rate-limited");

  attempts.push(now);
  writeThrottleState({ attempts, successes });
}

export function registerBookingSuccess() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const state = readThrottleState();
  const attempts = state.attempts.filter((timestamp) => now - timestamp < ATTEMPT_WINDOW_MS);
  const successes = state.successes.filter((timestamp) => now - timestamp < SUCCESS_WINDOW_MS);
  successes.push(now);
  writeThrottleState({ attempts, successes });
}

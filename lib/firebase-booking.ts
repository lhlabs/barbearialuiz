"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  isPlausibleBrazilianMobile,
  normalizeBrazilianPhone,
  registerBookingAttempt,
  registerBookingSuccess,
} from "./booking-security";
import { auth, db } from "./firebase";

export type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
  display_order: number;
  barber_ids: string[];
};

export type Barber = {
  id: string;
  name: string;
  bio: string;
  active: boolean;
  display_order: number;
};

export type Slot = {
  slot_start: string;
  slot_label: string;
  start_minute: number;
  available: boolean;
  state: "open" | "booked" | "blocked";
};

export type Appointment = {
  id: string;
  customer_name: string;
  customer_phone: string;
  date: string;
  start_minute: number;
  end_minute: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  reference_code: string;
  barber_id: string;
  service_id: string;
  duration_minutes: number;
  source: "public" | "admin";
};

export type BlockedTime = {
  id: string;
  barber_id: string;
  date: string;
  start_minute: number;
  end_minute: number;
  starts_at: string;
  ends_at: string;
  reason: string;
};

export type WeeklyAvailability = Record<string, Array<{ start: string; end: string }>>;

export const defaultAvailability: WeeklyAvailability = {
  "0": [],
  "1": [{ start: "09:00", end: "19:00" }],
  "2": [{ start: "09:00", end: "19:00" }],
  "3": [{ start: "09:00", end: "19:00" }],
  "4": [{ start: "09:00", end: "19:00" }],
  "5": [{ start: "09:00", end: "19:00" }],
  "6": [{ start: "09:00", end: "19:00" }],
};

const SLOT_INTERVAL = 15;
const BRAZIL_OFFSET = "-03:00";
const serverAbuseGuardEnabled = process.env.NEXT_PUBLIC_FIREBASE_ABUSE_GUARD_ENABLED === "true";

function localIso(date: string, minute: number) {
  const hour = Math.floor(minute / 60).toString().padStart(2, "0");
  const minutes = (minute % 60).toString().padStart(2, "0");
  return `${date}T${hour}:${minutes}:00${BRAZIL_OFFSET}`;
}

function minuteFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function slotId(date: string, barberId: string, minute: number) {
  return `${date}_${barberId}_${minute}`;
}

function occupiedMinutes(start: number, duration: number) {
  return Array.from({ length: Math.ceil(duration / SLOT_INTERVAL) }, (_, index) => start + index * SLOT_INTERVAL);
}

function randomId(bytes = 16) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function mapService(id: string, data: Record<string, unknown>): Service {
  return {
    id,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    duration_minutes: Number(data.durationMinutes ?? 0),
    price_cents: Number(data.priceCents ?? 0),
    active: data.active === true,
    display_order: Number(data.displayOrder ?? 0),
    barber_ids: Array.isArray(data.barberIds) ? data.barberIds.map(String) : [],
  };
}

function mapBarber(id: string, data: Record<string, unknown>): Barber {
  return {
    id,
    name: String(data.name ?? ""),
    bio: String(data.bio ?? ""),
    active: data.active === true,
    display_order: Number(data.displayOrder ?? 0),
  };
}

export async function loadCatalog() {
  const [serviceDocs, barberDocs] = await Promise.all([
    getDocs(collection(db, "services")),
    getDocs(collection(db, "barbers")),
  ]);
  const services = serviceDocs.docs.map((item) => mapService(item.id, item.data())).filter((item) => item.active).sort((a, b) => a.display_order - b.display_order);
  const barbers = barberDocs.docs.map((item) => mapBarber(item.id, item.data())).filter((item) => item.active).sort((a, b) => a.display_order - b.display_order);
  return { services, barbers };
}

export async function loadAvailableSlots(date: string, service: Service, barberId: string, includeUnavailable = false) {
  const snapshot = await getDocs(query(
    collection(db, "slots"),
    where("date", "==", date),
    where("barberId", "==", barberId),
  ));
  const cells = new Map<number, string>();
  snapshot.docs.forEach((item) => {
    const data = item.data();
    cells.set(Number(data.startMinute), String(data.state));
  });
  const now = Date.now();
  return [...cells.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, state]) => {
      const slotStart = localIso(date, start);
      const available = new Date(slotStart).getTime() > now
        && state === "open"
        && occupiedMinutes(start, service.duration_minutes).every((minute) => cells.get(minute) === "open");
      return {
        slot_start: slotStart,
        slot_label: slotStart.slice(11, 16),
        start_minute: start,
        available,
        state: state as Slot["state"],
      } satisfies Slot;
    })
    .filter((slot) => includeUnavailable || slot.available);
}

type BookingInput = {
  service: Service;
  barberId: string;
  date: string;
  startMinute: number;
  customerName: string;
  customerPhone: string;
  consent: boolean;
  website?: string;
  source?: "public" | "admin";
};

export async function createBooking(input: BookingInput) {
  const customerName = input.customerName.trim().replace(/\s+/g, " ");
  const customerPhone = normalizeBrazilianPhone(input.customerPhone);
  const source = input.source ?? "public";
  if (input.website) throw new Error("invalid-input");
  if (customerName.length < 2 || customerName.length > 80) throw new Error("invalid-input");
  if (!isPlausibleBrazilianMobile(customerPhone)) throw new Error("invalid-phone");
  if (source !== "admin" && !input.consent) throw new Error("invalid-input");
  if (source === "public") registerBookingAttempt();

  const appointmentId = randomId();
  const referenceCode = randomId(4).toUpperCase();
  const endMinute = input.startMinute + input.service.duration_minutes;
  const dayStart = Timestamp.fromDate(new Date(`${input.date}T00:00:00${BRAZIL_OFFSET}`));
  const cellMinutes = occupiedMinutes(input.startMinute, input.service.duration_minutes);
  const appointmentRef = doc(db, "appointments", appointmentId);
  const slotIds = cellMinutes.map((minute) => slotId(input.date, input.barberId, minute));
  const cellRefs = slotIds.map((id) => doc(db, "slots", id));
  const bookingCounterId = `${customerPhone}_${input.date}`;
  const bookingCounterRef = source === "public" && serverAbuseGuardEnabled
    ? doc(db, "publicBookingCounters", bookingCounterId)
    : null;

  await runTransaction(db, async (transaction) => {
    const cellSnapshots = await Promise.all(cellRefs.map((reference) => transaction.get(reference)));
    if (cellSnapshots.some((snapshot) => !snapshot.exists() || snapshot.data().state !== "open")) throw new Error("slot-unavailable");

    transaction.set(appointmentRef, {
      customerName,
      customerPhone,
      serviceId: input.service.id,
      barberId: input.barberId,
      date: input.date,
      dayStart,
      startMinute: input.startMinute,
      endMinute,
      durationMinutes: input.service.duration_minutes,
      status: "scheduled",
      referenceCode,
      consent: source === "admin" ? false : true,
      source,
      slotIds,
      ...(bookingCounterRef ? { bookingCounterId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    cellRefs.forEach((reference) => transaction.update(reference, {
      state: "booked",
      appointmentId,
      blockId: null,
      updatedAt: serverTimestamp(),
    }));
    if (bookingCounterRef) {
      transaction.set(bookingCounterRef, {
        phone: customerPhone,
        date: input.date,
        count: increment(1),
        lastAppointmentId: appointmentId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });

  if (source === "public") registerBookingSuccess();
  return { reference_code: referenceCode, starts_at: localIso(input.date, input.startMinute) };
}

export async function isCurrentUserAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  const snapshot = await getDoc(doc(db, "admins", user.uid));
  return snapshot.exists() && snapshot.data().active === true;
}

function mapAppointment(id: string, data: Record<string, unknown>): Appointment {
  const date = String(data.date);
  const start = Number(data.startMinute);
  const end = Number(data.endMinute);
  return {
    id,
    customer_name: String(data.customerName),
    customer_phone: String(data.customerPhone),
    date,
    start_minute: start,
    end_minute: end,
    starts_at: localIso(date, start),
    ends_at: localIso(date, end),
    status: data.status as Appointment["status"],
    reference_code: String(data.referenceCode),
    barber_id: String(data.barberId),
    service_id: String(data.serviceId),
    duration_minutes: Number(data.durationMinutes),
    source: data.source as Appointment["source"],
  };
}

function mapBlock(id: string, data: Record<string, unknown>): BlockedTime {
  const date = String(data.date);
  const start = Number(data.startMinute);
  const end = Number(data.endMinute);
  return {
    id,
    barber_id: String(data.barberId),
    date,
    start_minute: start,
    end_minute: end,
    starts_at: localIso(date, start),
    ends_at: localIso(date, end),
    reason: String(data.reason),
  };
}

export async function loadAdminDay(date: string) {
  const [appointmentDocs, blockDocs, catalog, settingsDoc] = await Promise.all([
    getDocs(query(collection(db, "appointments"), where("date", "==", date))),
    getDocs(query(collection(db, "blockedSlots"), where("date", "==", date))),
    loadCatalog(),
    getDoc(doc(db, "settings", "general")),
  ]);
  return {
    ...catalog,
    appointments: appointmentDocs.docs.map((item) => mapAppointment(item.id, item.data())).sort((a, b) => a.start_minute - b.start_minute),
    blocks: blockDocs.docs.map((item) => mapBlock(item.id, item.data())).sort((a, b) => a.start_minute - b.start_minute),
    availability: (settingsDoc.data()?.weeklyAvailability ?? defaultAvailability) as WeeklyAvailability,
  };
}

export async function updateAppointmentStatus(appointment: Appointment, status: "completed" | "cancelled" | "no_show") {
  const appointmentRef = doc(db, "appointments", appointment.id);
  const cellRefs = occupiedMinutes(appointment.start_minute, appointment.duration_minutes).map((minute) => doc(db, "slots", slotId(appointment.date, appointment.barber_id, minute)));
  await runTransaction(db, async (transaction) => {
    const cells = await Promise.all(cellRefs.map((reference) => transaction.get(reference)));
    transaction.update(appointmentRef, { status, updatedAt: serverTimestamp() });
    cells.forEach((cell, index) => {
      if (cell.exists() && cell.data().appointmentId === appointment.id) {
        transaction.update(cellRefs[index], { state: "open", appointmentId: null, blockId: null, updatedAt: serverTimestamp() });
      }
    });
  });
}

export async function createBlock(input: { barberId: string; date: string; startMinute: number; endMinute: number; reason: string }) {
  if (input.startMinute >= input.endMinute || input.startMinute % SLOT_INTERVAL || input.endMinute % SLOT_INTERVAL) throw new Error("invalid-block");
  const id = randomId();
  const minutes = Array.from({ length: (input.endMinute - input.startMinute) / SLOT_INTERVAL }, (_, index) => input.startMinute + index * SLOT_INTERVAL);
  const refs = minutes.map((minute) => doc(db, "slots", slotId(input.date, input.barberId, minute)));
  await runTransaction(db, async (transaction) => {
    const cells = await Promise.all(refs.map((reference) => transaction.get(reference)));
    if (cells.some((cell) => !cell.exists() || cell.data().state !== "open")) throw new Error("slot-unavailable");
    transaction.set(doc(db, "blockedSlots", id), {
      barberId: input.barberId,
      date: input.date,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      reason: input.reason.trim().slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    refs.forEach((reference) => transaction.update(reference, { state: "blocked", appointmentId: null, blockId: id, updatedAt: serverTimestamp() }));
  });
}

export async function deleteBlock(block: BlockedTime) {
  const refs = Array.from({ length: (block.end_minute - block.start_minute) / SLOT_INTERVAL }, (_, index) => doc(db, "slots", slotId(block.date, block.barber_id, block.start_minute + index * SLOT_INTERVAL)));
  await runTransaction(db, async (transaction) => {
    const cells = await Promise.all(refs.map((reference) => transaction.get(reference)));
    transaction.delete(doc(db, "blockedSlots", block.id));
    cells.forEach((cell, index) => {
      if (cell.exists() && cell.data().blockId === block.id) transaction.update(refs[index], { state: "open", appointmentId: null, blockId: null, updatedAt: serverTimestamp() });
    });
  });
}

export async function saveWeeklyAvailability(availability: WeeklyAvailability) {
  await updateDoc(doc(db, "settings", "general"), { weeklyAvailability: availability, updatedAt: serverTimestamp() });
}

const seedServices = [
  { id: "corte-assinatura", name: "Corte Assinatura", description: "Corte personalizado, acabamento e finalização.", durationMinutes: 45, priceCents: 6500, displayOrder: 1 },
  { id: "barba-ritual", name: "Barba Ritual", description: "Toalha quente, desenho e cuidado completo.", durationMinutes: 30, priceCents: 4500, displayOrder: 2 },
  { id: "combo-reserva", name: "Combo Reserva", description: "Corte e barba em uma experiência completa.", durationMinutes: 75, priceCents: 10000, displayOrder: 3 },
  { id: "acabamento", name: "Acabamento", description: "Contorno, nuca e costeletas.", durationMinutes: 15, priceCents: 2500, displayOrder: 4 },
];

const seedBarbers = [
  { id: "caio", name: "Caio", bio: "Clássicos e acabamento de precisão.", displayOrder: 1 },
  { id: "rafael", name: "Rafael", bio: "Degradês contemporâneos e consultoria de estilo.", displayOrder: 2 },
  { id: "breno", name: "Breno", bio: "Barbas, texturas e visuais de baixa manutenção.", displayOrder: 3 },
];

export async function initializeBusinessData(days = 90) {
  const barberIds = seedBarbers.map((barber) => barber.id);
  const settingsRef = doc(db, "settings", "general");
  const existingSettings = await getDoc(settingsRef);
  const storedAvailability = existingSettings.data()?.weeklyAvailability as WeeklyAvailability | undefined;
  const availability = storedAvailability ?? defaultAvailability;

  await Promise.all([
    ...seedBarbers.map((barber) => setDoc(doc(db, "barbers", barber.id), { name: barber.name, bio: barber.bio, active: true, displayOrder: barber.displayOrder, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })),
    ...seedServices.map((service) => setDoc(doc(db, "services", service.id), { name: service.name, description: service.description, durationMinutes: service.durationMinutes, priceCents: service.priceCents, displayOrder: service.displayOrder, barberIds, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })),
    setDoc(settingsRef, {
      timezone: "America/Sao_Paulo",
      slotIntervalMinutes: SLOT_INTERVAL,
      bookingHorizonDays: days,
      weeklyAvailability: availability,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
  ]);

  const writes: Array<{ id: string; data: Record<string, unknown> }> = [];
  const today = new Date();
  const firstDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const finalDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days - 1, 12);
  const finalDateKey = `${finalDate.getFullYear()}-${String(finalDate.getMonth() + 1).padStart(2, "0")}-${String(finalDate.getDate()).padStart(2, "0")}`;
  const existing = await getDocs(query(collection(db, "slots"), where("date", ">=", firstDateKey), where("date", "<=", finalDateKey)));
  const existingIds = new Set(existing.docs.map((item) => item.id));
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 12);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    for (const range of availability[String(date.getDay())] ?? []) {
      for (const barberId of barberIds) {
        for (let minute = minuteFromTime(range.start); minute < minuteFromTime(range.end); minute += SLOT_INTERVAL) {
          const id = slotId(dateKey, barberId, minute);
          if (!existingIds.has(id)) writes.push({ id, data: { date: dateKey, dayStart: Timestamp.fromDate(new Date(`${dateKey}T00:00:00${BRAZIL_OFFSET}`)), barberId, startMinute: minute, state: "open", appointmentId: null, blockId: null, updatedAt: serverTimestamp() } });
        }
      }
    }
  }
  for (let index = 0; index < writes.length; index += 400) {
    const batch = writeBatch(db);
    writes.slice(index, index + 400).forEach((entry) => batch.set(doc(db, "slots", entry.id), entry.data, { merge: true }));
    await batch.commit();
  }
}
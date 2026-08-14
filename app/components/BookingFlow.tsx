"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { businessConfig } from "../../lib/config";
import { createBooking, loadAvailableSlots, loadCatalog, type Barber, type Service, type Slot } from "../../lib/firebase-booking";

type BarberService = { barber_id: string; service_id: string };

const steps = ["Serviço", "Profissional", "Data", "Horário", "Dados"];

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: businessConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateOptions(amount = 12) {
  const current = new Date();
  return Array.from({ length: amount }, (_, index) => {
    const date = new Date(current);
    date.setDate(current.getDate() + index);
    return {
      value: localDateKey(date),
      weekday: new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
        timeZone: businessConfig.timezone,
      }).format(date).replace(".", ""),
      day: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        timeZone: businessConfig.timezone,
      }).format(date),
      month: new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        timeZone: businessConfig.timezone,
      }).format(date).replace(".", ""),
    };
  });
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
  }
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, -4)}-${digits.slice(-4)}`;
}

export default function BookingFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [links, setLinks] = useState<BarberService[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmation, setConfirmation] = useState<{ reference: string; startsAt: string } | null>(null);
  const dates = useMemo(() => dateOptions(), []);

  useEffect(() => {
    const loadCatalogData = async () => {
      setLoading(true);
      try {
        const catalog = await loadCatalog();
        setServices(catalog.services);
        setBarbers(catalog.barbers);
        setLinks(catalog.services.flatMap((service) => service.barber_ids.map((barberId) => ({ barber_id: barberId, service_id: service.id }))));
      } catch {
        setError("Não conseguimos carregar a agenda agora. Tente novamente em instantes.");
      }
      setLoading(false);
    };
    void loadCatalogData();
  }, []);

  const availableBarbers = selectedService
    ? barbers.filter((barber) =>
        links.some((link) => link.barber_id === barber.id && link.service_id === selectedService.id),
      )
    : barbers;

  useEffect(() => {
    if (step !== 3 || !selectedService || !selectedBarber) return;
    const loadSlots = async () => {
      setSlotsLoading(true);
      setError("");
      setSelectedSlot(null);
      try {
        setSlots(await loadAvailableSlots(selectedDate, selectedService, selectedBarber.id));
      } catch {
        setSlots([]);
        setError("Não conseguimos consultar os horários. Verifique sua conexão e tente novamente.");
      }
      setSlotsLoading(false);
    };
    void loadSlots();
  }, [step, selectedDate, selectedService, selectedBarber]);

  const advance = () => {
    setError("");
    setStep((current) => Math.min(current + 1, 4));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedService || !selectedBarber || !selectedSlot) return;
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 10) {
      setError("Preencha seu nome e um WhatsApp válido.");
      return;
    }
    if (!consent) {
      setError("Confirme o uso dos dados para realizar o agendamento.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const data = await createBooking({
        service: selectedService,
        barberId: selectedBarber.id,
        date: selectedDate,
        startMinute: selectedSlot.start_minute,
        customerName: name,
        customerPhone: phone,
        consent,
        website,
      });
      setConfirmation({ reference: data.reference_code, startsAt: data.starts_at });
    } catch (bookingError) {
      const friendly = bookingError instanceof Error && bookingError.message === "slot-unavailable"
        ? "Este horário acabou de ficar indisponível. Volte e escolha outro."
        : "Não conseguimos concluir o agendamento. Revise os dados ou escolha outro horário.";
      setError(friendly);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  const confirmationDate = confirmation
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: businessConfig.timezone,
      }).format(new Date(confirmation.startsAt))
    : "";

  return (
    <div className="booking-overlay" role="dialog" aria-modal="true" aria-labelledby="booking-title">
      <button className="booking-backdrop" aria-label="Fechar agendamento" onClick={onClose} />
      <section className="booking-panel">
        <header className="booking-header">
          <div>
            <p>AGENDAMENTO ONLINE</p>
            <h2 id="booking-title">Reserve seu horário</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        </header>

        {confirmation ? (
          <div className="booking-success">
            <span className="success-icon"><CheckCircle2 /></span>
            <p className="eyebrow dark"><span /> Horário reservado</p>
            <h3>Está marcado,<br />{name.split(" ")[0]}.</h3>
            <p className="success-lead">Seu atendimento foi confirmado com segurança.</p>
            <dl>
              <div><dt>Serviço</dt><dd>{selectedService?.name}</dd></div>
              <div><dt>Profissional</dt><dd>{selectedBarber?.name}</dd></div>
              <div><dt>Quando</dt><dd>{confirmationDate}</dd></div>
              <div><dt>Referência</dt><dd>{confirmation.reference}</dd></div>
            </dl>
            <a
              className="primary-cta confirmation-whatsapp"
              href={`https://wa.me/${businessConfig.whatsapp}?text=${encodeURIComponent(`Olá! Meu agendamento é ${confirmation.reference}.`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Falar com a barbearia <ArrowRight />
            </a>
            <button className="booking-done" type="button" onClick={onClose}>Concluir</button>
          </div>
        ) : (
          <>
            <div className="stepper" aria-label={`Etapa ${step + 1} de ${steps.length}`}>
              {steps.map((label, index) => (
                <div className={index <= step ? "active" : ""} key={label}>
                  <span>{index < step ? <Check size={13} /> : index + 1}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>

            <div className="booking-body">
              {loading ? (
                <div className="booking-loading"><LoaderCircle className="spin" /> Carregando agenda…</div>
              ) : step === 0 ? (
                <div className="booking-step">
                  <div className="booking-title-row"><span>01</span><div><h3>O que vamos fazer?</h3><p>Escolha um serviço para começar.</p></div></div>
                  <div className="booking-options">
                    {services.map((service) => (
                      <button
                        type="button"
                        key={service.id}
                        className={selectedService?.id === service.id ? "selected" : ""}
                        onClick={() => setSelectedService(service)}
                      >
                        <span className="option-check"><Check /></span>
                        <span><strong>{service.name}</strong><small>{service.description}</small></span>
                        <span className="option-meta"><small>{service.duration_minutes} min</small><strong>{formatMoney(service.price_cents)}</strong></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : step === 1 ? (
                <div className="booking-step">
                  <div className="booking-title-row"><span>02</span><div><h3>Com quem?</h3><p>Escolha o profissional da vez.</p></div></div>
                  <div className="barber-options">
                    {availableBarbers.map((barber) => (
                      <button
                        type="button"
                        key={barber.id}
                        className={selectedBarber?.id === barber.id ? "selected" : ""}
                        onClick={() => setSelectedBarber(barber)}
                      >
                        <span className="barber-avatar"><UserRound /></span>
                        <span><strong>{barber.name}</strong><small>{barber.bio}</small></span>
                        <span className="option-check"><Check /></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : step === 2 ? (
                <div className="booking-step">
                  <div className="booking-title-row"><span>03</span><div><h3>Qual o melhor dia?</h3><p>Mostramos até 90 dias à frente.</p></div></div>
                  <div className="date-options">
                    {dates.map((date) => (
                      <button
                        type="button"
                        key={date.value}
                        className={selectedDate === date.value ? "selected" : ""}
                        onClick={() => setSelectedDate(date.value)}
                      >
                        <small>{date.weekday}</small><strong>{date.day}</strong><span>{date.month}</span>
                      </button>
                    ))}
                  </div>
                  <label className="date-picker">
                    <CalendarDays /> Outra data
                    <input
                      type="date"
                      value={selectedDate}
                      min={localDateKey(new Date())}
                      onChange={(event) => setSelectedDate(event.target.value)}
                    />
                  </label>
                </div>
              ) : step === 3 ? (
                <div className="booking-step">
                  <div className="booking-title-row"><span>04</span><div><h3>Escolha o horário</h3><p>Horários em cinza já estão indisponíveis.</p></div></div>
                  {slotsLoading ? (
                    <div className="booking-loading"><LoaderCircle className="spin" /> Consultando disponibilidade…</div>
                  ) : slots.length === 0 || !slots.some((slot) => slot.available) ? (
                    <div className="no-slots">
                      <Clock3 />
                      <strong>Agenda completa</strong>
                      <p>Não temos mais horários disponíveis nesta data. Escolha outro dia.</p>
                      <button type="button" onClick={() => setStep(2)}>Escolher outra data</button>
                    </div>
                  ) : (
                    <div className="slot-grid">
                      {slots.map((slot) => (
                        <button
                          type="button"
                          key={slot.slot_start}
                          disabled={!slot.available}
                          className={selectedSlot?.slot_start === slot.slot_start ? "selected" : ""}
                          onClick={() => setSelectedSlot(slot)}
                          aria-label={`${slot.slot_label}, ${slot.available ? "disponível" : "indisponível"}`}
                        >
                          {slot.slot_label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <form className="booking-step details-form" onSubmit={submit}>
                  <div className="booking-title-row"><span>05</span><div><h3>Para finalizar</h3><p>Só precisamos dos dados essenciais.</p></div></div>
                  <div className="booking-summary">
                    <span><CalendarDays /> {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: businessConfig.timezone }).format(new Date(selectedSlot?.slot_start ?? ""))}</span>
                    <strong>{selectedSlot?.slot_label}</strong>
                    <span>{selectedService?.name} · {selectedBarber?.name}</span>
                  </div>
                  <label>Seu nome<input type="text" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} autoComplete="name" required placeholder="Como podemos chamar você?" /></label>
                  <label>WhatsApp<input type="tel" value={phone} onChange={(event) => setPhone(cleanPhone(event.target.value))} minLength={10} maxLength={20} autoComplete="tel" required placeholder="(49) 99999-9999" /></label>
                  <label className="honeypot" aria-hidden="true">Seu site<input type="text" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
                  <label className="consent-row">
                    <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                    <span>{businessConfig.privacy.notice}</span>
                  </label>
                  {error && <p className="booking-error" role="alert">{error}</p>}
                  <button className="submit-booking" type="submit" disabled={submitting}>
                    {submitting ? <><LoaderCircle className="spin" /> Confirmando…</> : <><ShieldCheck /> Confirmar agendamento <ArrowRight /></>}
                  </button>
                </form>
              )}
              {error && step < 4 && <p className="booking-error" role="alert">{error}</p>}
            </div>

            {step < 4 && (
              <footer className="booking-footer">
                <button type="button" className="back-step" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>
                  <ArrowLeft /> Voltar
                </button>
                <button
                  type="button"
                  className="next-step"
                  disabled={
                    (step === 0 && !selectedService) ||
                    (step === 1 && !selectedBarber) ||
                    (step === 2 && !selectedDate) ||
                    (step === 3 && !selectedSlot)
                  }
                  onClick={advance}
                >
                  Continuar <ArrowRight />
                </button>
              </footer>
            )}
          </>
        )}
      </section>
    </div>
  );
}

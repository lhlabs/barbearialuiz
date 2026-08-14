"use client";

import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Phone,
  Scissors,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { businessConfig } from "../../lib/config";
import { supabase } from "../../lib/supabase";

type Appointment = {
  id: string;
  customer_name: string;
  customer_phone: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  reference_code: string;
  barbers: { id: string; name: string } | null;
  services: { id: string; name: string; duration_minutes: number } | null;
};

type Barber = { id: string; name: string };
type Service = { id: string; name: string; duration_minutes: number };
type BlockedTime = { id: string; barber_id: string; starts_at: string; ends_at: string; reason: string };
type Slot = { slot_start: string; slot_label: string; available: boolean };

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: businessConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return dateKey(value);
}

function dayRange(date: string) {
  return {
    start: `${date}T00:00:00-03:00`,
    end: `${addDays(date, 1)}T00:00:00-03:00`,
  };
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: businessConfig.timezone,
  }).format(new Date(value));
}

function phoneLabel(value: string) {
  return value.length === 11
    ? `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
    : value;
}

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [blocks, setBlocks] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockBarber, setBlockBarber] = useState("");
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockReason, setBlockReason] = useState("Intervalo / indisponível");
  const [scheduleBarber, setScheduleBarber] = useState("");
  const [scheduleService, setScheduleService] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setAuthorized(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setAuthorized(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const verify = async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error || data !== true) {
        await supabase.auth.signOut();
        setAuthorized(false);
        setLoginError("Credenciais inválidas ou usuário sem permissão administrativa.");
      } else {
        setAuthorized(true);
      }
    };
    void verify();
  }, [session]);

  const loadAdminData = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setActionError("");
    const range = dayRange(selectedDate);
    const [appointmentsResult, barbersResult, servicesResult, blocksResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id,customer_name,customer_phone,starts_at,ends_at,status,reference_code,barbers(id,name),services(id,name,duration_minutes)")
        .gte("starts_at", range.start)
        .lt("starts_at", range.end)
        .order("starts_at"),
      supabase.from("barbers").select("id,name").order("display_order"),
      supabase.from("services").select("id,name,duration_minutes").order("display_order"),
      supabase.from("blocked_times").select("id,barber_id,starts_at,ends_at,reason").gte("starts_at", range.start).lt("starts_at", range.end).order("starts_at"),
    ]);
    if (appointmentsResult.error || barbersResult.error || servicesResult.error || blocksResult.error) {
      setActionError("Não foi possível carregar a agenda. Tente novamente.");
    } else {
      setAppointments((appointmentsResult.data ?? []) as unknown as Appointment[]);
      setBarbers((barbersResult.data ?? []) as Barber[]);
      setServices((servicesResult.data ?? []) as Service[]);
      setBlocks((blocksResult.data ?? []) as BlockedTime[]);
      const firstBarber = barbersResult.data?.[0]?.id ?? "";
      const firstService = servicesResult.data?.[0]?.id ?? "";
      setBlockBarber((value) => value || firstBarber);
      setScheduleBarber((value) => value || firstBarber);
      setScheduleService((value) => value || firstService);
    }
    setLoading(false);
  }, [authorized, selectedDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAdminData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

  useEffect(() => {
    if (!authorized || !scheduleBarber || !scheduleService) return;
    const loadSlots = async () => {
      setSlotsLoading(true);
      const { data } = await supabase.rpc("get_available_slots", {
        p_barber_id: scheduleBarber,
        p_service_id: scheduleService,
        p_date: selectedDate,
      });
      setSlots((data ?? []) as Slot[]);
      setSlotsLoading(false);
    };
    void loadSlots();
  }, [authorized, scheduleBarber, scheduleService, selectedDate, appointments, blocks]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    if (error) setLoginError("Credenciais inválidas ou usuário sem permissão administrativa.");
    setLoginLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setAuthorized(false);
  };

  const updateStatus = async (id: string, status: "completed" | "cancelled" | "no_show") => {
    if (status === "cancelled" && !window.confirm("Cancelar este agendamento?")) return;
    setActionError("");
    const { error } = await supabase.rpc("admin_set_appointment_status", {
      p_appointment_id: id,
      p_status: status,
    });
    if (error) setActionError("Não foi possível atualizar o agendamento.");
    else {
      setActionSuccess(status === "cancelled" ? "Agendamento cancelado." : "Status atualizado.");
      await loadAdminData();
    }
  };

  const createBlock = async (event: FormEvent) => {
    event.preventDefault();
    setActionError("");
    const { error } = await supabase.rpc("admin_create_block", {
      p_barber_id: blockBarber,
      p_starts_at: `${selectedDate}T${blockStart}:00-03:00`,
      p_ends_at: `${selectedDate}T${blockEnd}:00-03:00`,
      p_reason: blockReason,
    });
    if (error) setActionError(error.message.includes("agendamento") ? "Há um agendamento nesse período. Cancele-o antes de bloquear." : "Não foi possível criar o bloqueio. Revise o período.");
    else {
      setActionSuccess("Horário bloqueado.");
      setShowBlockForm(false);
      await loadAdminData();
    }
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.rpc("admin_delete_block", { p_block_id: id });
    if (error) setActionError("Não foi possível remover o bloqueio.");
    else {
      setActionSuccess("Bloqueio removido.");
      await loadAdminData();
    }
  };

  useEffect(() => {
    if (!actionSuccess) return;
    const timeout = setTimeout(() => setActionSuccess(""), 2800);
    return () => clearTimeout(timeout);
  }, [actionSuccess]);

  const scheduled = appointments.filter((item) => item.status === "scheduled");
  const dayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: businessConfig.timezone,
  }).format(new Date(`${selectedDate}T12:00:00`));

  const slotLookup = useMemo(
    () => new Map(appointments.map((item) => [timeLabel(item.starts_at), item])),
    [appointments],
  );

  if (authorized === null || (session && authorized === null)) {
    return <main className="admin-center"><LoaderCircle className="spin" /><p>Validando acesso seguro…</p></main>;
  }

  if (!session || !authorized) {
    return (
      <main className="login-page">
        <Link href="/" className="login-back"><ArrowLeft /> Voltar ao site</Link>
        <section className="login-card">
          <div className="login-brand">
            <Image src={businessConfig.logo} alt="" width={50} height={50} />
            <span><strong>{businessConfig.shortName}</strong><small>ADMINISTRAÇÃO</small></span>
          </div>
          <span className="login-icon"><LockKeyhole /></span>
          <p className="eyebrow dark"><span /> Acesso restrito</p>
          <h1>Bem-vindo<br />de volta.</h1>
          <p>Entre com sua credencial individual cadastrada no Supabase Auth.</p>
          <form onSubmit={login}>
            <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required placeholder="seu@email.com" /></label>
            <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="••••••••••••" /></label>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? <><LoaderCircle className="spin" /> Verificando…</> : <>Entrar com segurança <ArrowRight /></>}
            </button>
          </form>
          <small className="security-note"><ShieldCheck /> Sua senha é tratada exclusivamente pelo Supabase Auth.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className={menuOpen ? "open" : ""}>
        <div className="admin-brand"><Image src={businessConfig.logo} alt="" width={40} height={40} /><span><strong>{businessConfig.shortName}</strong><small>GESTÃO</small></span></div>
        <nav>
          <a className="active" href="#agenda"><LayoutDashboard /> Agenda</a>
          <a href="#disponibilidade"><Clock3 /> Disponibilidade</a>
          <Link href="/" target="_blank"><Scissors /> Ver site <ArrowRight /></Link>
        </nav>
        <button type="button" onClick={logout}><LogOut /> Sair</button>
      </aside>
      {menuOpen && <button className="admin-menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

      <section className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
          <div><p>PAINEL ADMINISTRATIVO</p><h1>Agenda</h1></div>
          <button className="logout-mobile" type="button" onClick={logout}><LogOut /><span>Sair</span></button>
        </header>

        <div className="admin-content" id="agenda">
          <section className="date-navigator">
            <button type="button" aria-label="Dia anterior" onClick={() => setSelectedDate(addDays(selectedDate, -1))}><ChevronLeft /></button>
            <label><small>DATA SELECIONADA</small><strong>{dayLabel}</strong><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <button type="button" aria-label="Próximo dia" onClick={() => setSelectedDate(addDays(selectedDate, 1))}><ChevronRight /></button>
          </section>

          {actionError && <p className="admin-alert error" role="alert">{actionError}<button onClick={() => setActionError("")}><X /></button></p>}
          {actionSuccess && <p className="admin-alert success"><Check /> {actionSuccess}</p>}

          <section className="admin-metrics">
            <article><span><CalendarDays /></span><div><strong>{scheduled.length}</strong><small>agendados</small></div></article>
            <article><span><Clock3 /></span><div><strong>{slots.filter((slot) => slot.available).length}</strong><small>horários livres*</small></div></article>
            <article><span><Ban /></span><div><strong>{blocks.length}</strong><small>bloqueios</small></div></article>
          </section>
          <p className="metric-note">* Conforme serviço e profissional selecionados abaixo.</p>

          <section className="agenda-card">
            <div className="admin-section-title"><div><p>AGENDA DO DIA</p><h2>Próximos atendimentos</h2></div><button type="button" onClick={() => setShowBlockForm(true)}><Ban /> Bloquear horário</button></div>
            {loading ? (
              <div className="admin-empty"><LoaderCircle className="spin" /> Carregando…</div>
            ) : scheduled.length === 0 ? (
              <div className="admin-empty"><CalendarDays /><strong>Nenhum atendimento agendado</strong><p>A agenda deste dia está livre.</p></div>
            ) : (
              <div className="appointment-list">
                {scheduled.map((appointment) => (
                  <article key={appointment.id}>
                    <time>{timeLabel(appointment.starts_at)}<small>{appointment.services?.duration_minutes} min</small></time>
                    <div className="appointment-client"><strong>{appointment.customer_name}</strong><a href={`https://wa.me/55${appointment.customer_phone}`} target="_blank" rel="noreferrer"><Phone /> {phoneLabel(appointment.customer_phone)}</a></div>
                    <div className="appointment-service"><small>SERVIÇO</small><strong>{appointment.services?.name}</strong><span>{appointment.barbers?.name}</span></div>
                    <div className="appointment-actions">
                      <button title="Concluir" onClick={() => updateStatus(appointment.id, "completed")}><Check /></button>
                      <button title="Não compareceu" onClick={() => updateStatus(appointment.id, "no_show")}><UserRound /></button>
                      <button className="danger" title="Cancelar" onClick={() => updateStatus(appointment.id, "cancelled")}><X /></button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="availability-card" id="disponibilidade">
            <div className="admin-section-title"><div><p>VISÃO OPERACIONAL</p><h2>Livres e ocupados</h2></div></div>
            <div className="availability-filters">
              <label>Profissional<select value={scheduleBarber} onChange={(event) => setScheduleBarber(event.target.value)}>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>
              <label>Serviço<select value={scheduleService} onChange={(event) => setScheduleService(event.target.value)}>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
            </div>
            {slotsLoading ? <div className="admin-empty"><LoaderCircle className="spin" /></div> : (
              <div className="admin-slot-grid">
                {slots.map((slot) => {
                  const appointment = slotLookup.get(slot.slot_label);
                  const block = blocks.find((item) => item.barber_id === scheduleBarber && slot.slot_start >= item.starts_at && slot.slot_start < item.ends_at);
                  return (
                    <div className={slot.available ? "free" : block ? "blocked" : "busy"} key={slot.slot_start}>
                      <strong>{slot.slot_label}</strong>
                      <small>{slot.available ? "Livre" : block ? "Bloqueado" : appointment?.customer_name ?? "Ocupado"}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {blocks.length > 0 && (
            <section className="blocks-card">
              <div className="admin-section-title"><div><p>BLOQUEIOS</p><h2>Períodos indisponíveis</h2></div></div>
              {blocks.map((block) => (
                <article key={block.id}><Ban /><div><strong>{timeLabel(block.starts_at)}–{timeLabel(block.ends_at)}</strong><span>{barbers.find((item) => item.id === block.barber_id)?.name} · {block.reason}</span></div><button onClick={() => deleteBlock(block.id)} aria-label="Remover bloqueio"><Trash2 /></button></article>
              ))}
            </section>
          )}
        </div>
      </section>

      {showBlockForm && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="block-title">
          <button className="admin-modal-backdrop" onClick={() => setShowBlockForm(false)} aria-label="Fechar" />
          <form onSubmit={createBlock}>
            <header><div><p>NOVO BLOQUEIO</p><h2 id="block-title">Indisponibilizar horário</h2></div><button type="button" onClick={() => setShowBlockForm(false)}><X /></button></header>
            <label>Profissional<select value={blockBarber} onChange={(event) => setBlockBarber(event.target.value)} required>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>
            <div className="time-fields"><label>Início<input type="time" value={blockStart} step="900" onChange={(event) => setBlockStart(event.target.value)} required /></label><label>Fim<input type="time" value={blockEnd} step="900" onChange={(event) => setBlockEnd(event.target.value)} required /></label></div>
            <label>Motivo<input type="text" value={blockReason} maxLength={120} onChange={(event) => setBlockReason(event.target.value)} required /></label>
            <p><ShieldCheck /> O sistema impedirá bloqueios sobre agendamentos existentes.</p>
            <button type="submit"><Ban /> Criar bloqueio <ArrowRight /></button>
          </form>
        </div>
      )}
    </main>
  );
}

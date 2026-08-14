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
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { businessConfig } from "../../lib/config";
import { auth } from "../../lib/firebase";
import {
  createBlock as createFirebaseBlock,
  createBooking,
  deleteBlock as deleteFirebaseBlock,
  initializeBusinessData,
  isCurrentUserAdmin,
  loadAdminDay,
  loadAvailableSlots,
  updateAppointmentStatus,
  type Appointment,
  type Barber,
  type BlockedTime,
  type Service,
  type Slot,
} from "../../lib/firebase-booking";

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

function authenticationErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";

  if (["auth/invalid-credential", "auth/invalid-email", "auth/user-not-found", "auth/wrong-password"].includes(code)) {
    return "O Firebase recusou o e-mail ou a senha. Use exatamente a credencial cadastrada em Authentication → Usuários.";
  }
  if (code === "auth/user-disabled") return "Este usuário está desativado no Firebase Authentication.";
  if (code === "auth/too-many-requests") return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  if (code === "auth/network-request-failed") return "Falha de conexão com o Firebase. Verifique a internet e tente novamente.";
  return code ? `Falha no Firebase Authentication (${code}).` : "Não foi possível autenticar no Firebase.";
}

export default function AdminApp() {
  const [session, setSession] = useState<User | null>(null);
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
  const [initializing, setInitializing] = useState(false);
  const [adminSlot, setAdminSlot] = useState<Slot | null>(null);
  const [adminCustomerName, setAdminCustomerName] = useState("");
  const [adminCustomerPhone, setAdminCustomerPhone] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setSession(user);
      if (!user) setAuthorized(false);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const verify = async () => {
      try {
        if (await isCurrentUserAdmin()) {
          setAuthorized(true);
          return;
        }
        await signOut(auth);
        setAuthorized(false);
        setLoginError("Login aceito, mas o UID não está autorizado na coleção admins.");
      } catch {
        await signOut(auth);
        setAuthorized(false);
        setLoginError("Login aceito, mas o Firestore não permitiu validar o documento do administrador.");
      }
    };
    void verify();
  }, [session]);

  const loadAdminData = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setActionError("");
    try {
      const data = await loadAdminDay(selectedDate);
      setAppointments(data.appointments);
      setBarbers(data.barbers);
      setServices(data.services);
      setBlocks(data.blocks);
      const firstBarber = data.barbers[0]?.id ?? "";
      const firstService = data.services[0]?.id ?? "";
      setBlockBarber((value) => value || firstBarber);
      setScheduleBarber((value) => value || firstBarber);
      setScheduleService((value) => value || firstService);
    } catch {
      setActionError("Não foi possível carregar a agenda. Tente novamente.");
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
      const service = services.find((item) => item.id === scheduleService);
      setSlots(service ? await loadAvailableSlots(selectedDate, service, scheduleBarber, true).catch(() => []) : []);
      setSlotsLoading(false);
    };
    void loadSlots();
  }, [authorized, scheduleBarber, scheduleService, selectedDate, appointments, blocks, services]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    const error = await signInWithEmailAndPassword(auth, email, password).then(() => null).catch((caught) => caught);
    setPassword("");
    if (error) setLoginError(authenticationErrorMessage(error));
    setLoginLoading(false);
  };

  const logout = async () => {
    await signOut(auth);
    setSession(null);
    setAuthorized(false);
  };

  const updateStatus = async (id: string, status: "completed" | "cancelled" | "no_show") => {
    if (status === "cancelled" && !window.confirm("Cancelar este agendamento?")) return;
    setActionError("");
    const appointment = appointments.find((item) => item.id === id);
    const error = appointment ? await updateAppointmentStatus(appointment, status).then(() => null).catch((caught) => caught) : new Error("not-found");
    if (error) setActionError("Não foi possível atualizar o agendamento.");
    else {
      setActionSuccess(status === "cancelled" ? "Agendamento cancelado." : "Status atualizado.");
      await loadAdminData();
    }
  };

  const createBlock = async (event: FormEvent) => {
    event.preventDefault();
    setActionError("");
    const toMinute = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const error = await createFirebaseBlock({ barberId: blockBarber, date: selectedDate, startMinute: toMinute(blockStart), endMinute: toMinute(blockEnd), reason: blockReason }).then(() => null).catch((caught) => caught);
    if (error) setActionError(error instanceof Error && error.message === "slot-unavailable" ? "Há um agendamento ou bloqueio nesse período." : "Não foi possível criar o bloqueio. Revise o período.");
    else {
      setActionSuccess("Horário bloqueado.");
      setShowBlockForm(false);
      await loadAdminData();
    }
  };

  const deleteBlock = async (id: string) => {
    const block = blocks.find((item) => item.id === id);
    const error = block ? await deleteFirebaseBlock(block).then(() => null).catch((caught) => caught) : new Error("not-found");
    if (error) setActionError("Não foi possível remover o bloqueio.");
    else {
      setActionSuccess("Bloqueio removido.");
      await loadAdminData();
    }
  };

  const initialize = async () => {
    setInitializing(true);
    setActionError("");
    try {
      await initializeBusinessData();
      setActionSuccess("Catálogo e próximos 90 dias criados.");
      await loadAdminData();
    } catch {
      setActionError("Não foi possível inicializar os dados.");
    } finally {
      setInitializing(false);
    }
  };

  const createAdminBooking = async (event: FormEvent) => {
    event.preventDefault();
    const service = services.find((item) => item.id === scheduleService);
    if (!service || !adminSlot) return;
    setActionError("");
    try {
      await createBooking({ service, barberId: scheduleBarber, date: selectedDate, startMinute: adminSlot.start_minute, customerName: adminCustomerName, customerPhone: adminCustomerPhone, consent: false, source: "admin" });
      setAdminSlot(null);
      setAdminCustomerName("");
      setAdminCustomerPhone("");
      setActionSuccess("Agendamento criado.");
      await loadAdminData();
    } catch {
      setActionError("Não foi possível criar o agendamento. Verifique os dados e o horário.");
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
          <p>Entre com sua credencial individual cadastrada no Firebase Authentication.</p>
          <form onSubmit={login}>
            <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required placeholder="seu@email.com" /></label>
            <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="••••••••••••" /></label>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? <><LoaderCircle className="spin" /> Verificando…</> : <>Entrar com segurança <ArrowRight /></>}
            </button>
          </form>
          <small className="security-note"><ShieldCheck /> Sua senha é tratada exclusivamente pelo Firebase Authentication.</small>
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
          <Link href="/" target="_blank" rel="noreferrer"><Scissors /> Ver site <ArrowRight /></Link>
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
            <div className="admin-section-title"><div><p>AGENDA DO DIA</p><h2>Próximos atendimentos</h2></div>{services.length === 0 ? <button type="button" onClick={initialize} disabled={initializing}>{initializing ? <LoaderCircle className="spin" /> : <Scissors />} Inicializar agenda</button> : <button type="button" onClick={() => setShowBlockForm(true)}><Ban /> Bloquear horário</button>}</div>
            {loading ? (
              <div className="admin-empty"><LoaderCircle className="spin" /> Carregando…</div>
            ) : scheduled.length === 0 ? (
              <div className="admin-empty"><CalendarDays /><strong>Nenhum atendimento agendado</strong><p>A agenda deste dia está livre.</p></div>
            ) : (
              <div className="appointment-list">
                {scheduled.map((appointment) => (
                  <article key={appointment.id}>
                    <time>{timeLabel(appointment.starts_at)}<small>{appointment.duration_minutes} min</small></time>
                    <div className="appointment-client"><strong>{appointment.customer_name}</strong><a href={`https://wa.me/55${appointment.customer_phone}`} target="_blank" rel="noreferrer"><Phone /> {phoneLabel(appointment.customer_phone)}</a></div>
                    <div className="appointment-service"><small>SERVIÇO</small><strong>{services.find((item) => item.id === appointment.service_id)?.name ?? appointment.service_id}</strong><span>{barbers.find((item) => item.id === appointment.barber_id)?.name ?? appointment.barber_id}</span></div>
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
            <div className="admin-section-title"><div><p>VISÃO OPERACIONAL</p><h2>Livres e ocupados</h2></div><button type="button" onClick={initialize} disabled={initializing}>{initializing ? <LoaderCircle className="spin" /> : <Clock3 />} Atualizar 90 dias</button></div>
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
                    <button type="button" disabled={!slot.available} onClick={() => setAdminSlot(slot)} className={slot.available ? "free" : block ? "blocked" : "busy"} key={slot.slot_start}>
                      <strong>{slot.slot_label}</strong>
                      <small>{slot.available ? "Agendar" : block ? "Bloqueado" : appointment?.customer_name ?? "Ocupado"}</small>
                    </button>
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

      {adminSlot && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-title">
          <button className="admin-modal-backdrop" onClick={() => setAdminSlot(null)} aria-label="Fechar" />
          <form onSubmit={createAdminBooking}>
            <header><div><p>NOVO AGENDAMENTO</p><h2 id="appointment-title">Agendar {adminSlot.slot_label}</h2></div><button type="button" onClick={() => setAdminSlot(null)}><X /></button></header>
            <label>Cliente<input type="text" value={adminCustomerName} minLength={2} maxLength={80} onChange={(event) => setAdminCustomerName(event.target.value)} required /></label>
            <label>WhatsApp<input type="tel" value={adminCustomerPhone} minLength={10} maxLength={20} onChange={(event) => setAdminCustomerPhone(event.target.value)} required /></label>
            <p><ShieldCheck /> A reserva usa a mesma transação atômica do agendamento público.</p>
            <button type="submit"><CalendarDays /> Criar agendamento <ArrowRight /></button>
          </form>
        </div>
      )}
    </main>
  );
}

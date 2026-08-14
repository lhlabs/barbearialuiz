"use client";

import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Clock3,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { businessConfig } from "../../lib/config";
import BookingFlow from "./BookingFlow";

const servicePreview = [
  ["01", "Corte Assinatura", "45 min", "R$ 65"],
  ["02", "Barba Ritual", "30 min", "R$ 45"],
  ["03", "Combo Reserva", "75 min", "R$ 100"],
  ["04", "Acabamento", "15 min", "R$ 25"],
];

const professionals = [
  { initials: "CA", name: "Caio", focus: "Clássicos & precisão", tone: "portrait-one" },
  { initials: "RA", name: "Rafael", focus: "Degradês & estilo", tone: "portrait-two" },
  { initials: "BR", name: "Breno", focus: "Barbas & texturas", tone: "portrait-three" },
];

export default function HomeExperience() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = bookingOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [bookingOpen]);

  const openBooking = () => {
    setBookingOpen(true);
    setMenuOpen(false);
  };

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label={`${businessConfig.name}, início`}>
          <Image src={businessConfig.logo} alt="" width={42} height={42} />
          <span>
            <strong>{businessConfig.shortName}</strong>
            <small>BARBEARIA</small>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#servicos">Serviços</a>
          <a href="#profissionais">Profissionais</a>
          <a href="#sobre">A casa</a>
          <a href="#contato">Contato</a>
        </nav>

        <button className="header-book" type="button" onClick={openBooking}>
          Agendar <ArrowRight size={17} aria-hidden="true" />
        </button>
        <button
          className="menu-button"
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {menuOpen && (
        <nav className="mobile-nav" aria-label="Navegação móvel">
          <a href="#servicos" onClick={() => setMenuOpen(false)}>Serviços</a>
          <a href="#profissionais" onClick={() => setMenuOpen(false)}>Profissionais</a>
          <a href="#sobre" onClick={() => setMenuOpen(false)}>A casa</a>
          <a href="#contato" onClick={() => setMenuOpen(false)}>Contato</a>
          <button type="button" onClick={openBooking}>Agendar horário</button>
        </nav>
      )}

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Chapecó · SC</p>
          <h1>Seu estilo,<br /><em>no seu tempo.</em></h1>
          <p className="hero-lead">
            Atendimento com hora marcada, técnica precisa e a pausa que sua rotina merece.
          </p>
          <div className="hero-actions">
            <button className="primary-cta" type="button" onClick={openBooking}>
              <CalendarDays size={19} /> Agendar horário <ArrowRight size={18} />
            </button>
            <a className="text-link" href="#servicos">Conhecer serviços <ArrowDown size={17} /></a>
          </div>
        </div>

        <div className="hero-art" aria-label="Identidade visual da barbearia">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-monogram">R</div>
          <div className="hero-note top-note">
            <Sparkles size={17} /> Técnica & presença
          </div>
          <div className="hero-note bottom-note">
            <Clock3 size={17} /> Sem espera. No seu horário.
          </div>
          <p className="hero-number">EST. 2026</p>
        </div>

        <div className="hero-proof">
          <div><strong>4,9</strong><span>avaliação média</span></div>
          <div><strong>3</strong><span>especialistas</span></div>
          <div><strong>100%</strong><span>com hora marcada</span></div>
        </div>
      </section>

      <section className="services-section" id="servicos">
        <div className="section-heading">
          <div>
            <p className="eyebrow dark"><span /> Menu da casa</p>
            <h2>Rituais feitos<br />com <em>intenção.</em></h2>
          </div>
          <p>Do corte essencial ao cuidado completo. Escolha seu ritual e deixe o resto com a gente.</p>
        </div>

        <div className="service-list">
          {servicePreview.map(([number, name, duration, price]) => (
            <button key={number} type="button" className="service-row" onClick={openBooking}>
              <span className="service-number">{number}</span>
              <span className="service-name">{name}</span>
              <span className="service-duration">{duration}</span>
              <strong>{price}</strong>
              <span className="service-arrow"><ArrowRight size={20} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="professionals-section" id="profissionais">
        <div className="section-heading light">
          <div>
            <p className="eyebrow"><span /> Quem faz</p>
            <h2>Mãos precisas.<br /><em>Olhar apurado.</em></h2>
          </div>
          <p>Escolha seu profissional ou deixe que a disponibilidade guie sua decisão.</p>
        </div>
        <div className="professional-grid">
          {professionals.map((professional, index) => (
            <article className="professional-card" key={professional.name}>
              <div className={`portrait ${professional.tone}`}>
                <span>{professional.initials}</span>
                <small>0{index + 1}</small>
              </div>
              <div>
                <h3>{professional.name}</h3>
                <p>{professional.focus}</p>
              </div>
              <button type="button" aria-label={`Agendar com ${professional.name}`} onClick={openBooking}>
                <ArrowRight />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="sobre">
        <div className="about-mark" aria-hidden="true">R</div>
        <div className="about-copy">
          <p className="eyebrow dark"><span /> A Reserva</p>
          <h2>Uma pausa bem<br />aproveitada.</h2>
          <p>
            Criamos uma barbearia para quem valoriza atenção, pontualidade e resultado. Sem pressa, sem fila, sem excesso — só o que importa.
          </p>
          <div className="about-features">
            <span><Clock3 /> Hora marcada</span>
            <span><Sparkles /> Atendimento autoral</span>
            <span><ShieldCheck /> Seus dados protegidos</span>
          </div>
        </div>
      </section>

      <section className="booking-banner">
        <p>Pronto para a sua próxima versão?</p>
        <h2>Reserve seu horário.</h2>
        <button type="button" onClick={openBooking}>
          Ver horários disponíveis <ArrowRight />
        </button>
      </section>

      <section className="contact-section" id="contato">
        <div>
          <p className="eyebrow dark"><span /> Encontre a gente</p>
          <h2>Seu próximo corte<br />começa <em>aqui.</em></h2>
        </div>
        <div className="contact-grid">
          <a href={businessConfig.mapUrl} target="_blank" rel="noreferrer">
            <MapPin /> <span><small>ENDEREÇO</small>{businessConfig.address}</span><ArrowRight />
          </a>
          <a href={`https://wa.me/${businessConfig.whatsapp}`} target="_blank" rel="noreferrer">
            <MessageCircle /> <span><small>WHATSAPP</small>{businessConfig.phoneDisplay}</span><ArrowRight />
          </a>
          <a href={`https://instagram.com/${businessConfig.instagram}`} target="_blank" rel="noreferrer">
            <Instagram /> <span><small>INSTAGRAM</small>@{businessConfig.instagram}</span><ArrowRight />
          </a>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#inicio">
          <Image src={businessConfig.logo} alt="" width={42} height={42} />
          <span><strong>{businessConfig.shortName}</strong><small>BARBEARIA</small></span>
        </a>
        <p>© {new Date().getFullYear()} {businessConfig.name}. Todos os direitos reservados.</p>
        <Link href="/admin" rel="nofollow">Área administrativa</Link>
      </footer>

      <a
        className="whatsapp-float"
        href={`https://wa.me/${businessConfig.whatsapp}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle />
      </a>

      {bookingOpen && <BookingFlow onClose={() => setBookingOpen(false)} />}
    </main>
  );
}

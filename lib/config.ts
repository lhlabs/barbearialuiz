export const businessConfig = {
  name: "Barbearia Reserva",
  shortName: "RESERVA",
  tagline: "Seu tempo. Seu estilo.",
  description:
    "Barbearia contemporânea com atendimento preciso, ambiente reservado e hora marcada.",
  logo: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand-mark.svg`,
  colors: {
    ink: "#131310",
    paper: "#f2efe7",
    copper: "#c7783f",
    sage: "#687060",
  },
  whatsapp: "5549999999999",
  instagram: "barbeariareserva",
  address: "Rua Exemplo, 120 · Centro · Chapecó, SC",
  mapUrl: "https://maps.google.com/?q=Chapec%C3%B3%2C%20SC",
  phoneDisplay: "(49) 99999-9999",
  timezone: "America/Sao_Paulo",
  bookingHorizonDays: 90,
  privacy: {
    retentionDays: 180,
    notice:
      "Usamos nome e WhatsApp apenas para organizar e confirmar seu atendimento. Dados pessoais são removidos após o período de retenção.",
  },
} as const;

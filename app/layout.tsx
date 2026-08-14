import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const cormorant = localFont({
  src: "./fonts/cormorant-garamond-latin.woff2",
  variable: "--font-editorial",
  display: "swap",
  weight: "500 700",
});

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://yhfndzlfkjzpxerkmdcd.supabase.co wss://yhfndzlfkjzpxerkmdcd.supabase.co",
  "upgrade-insecure-requests",
].join("; ");

export const metadata: Metadata = {
  title: "Barbearia Reserva",
  description: "Seu tempo. Seu estilo. Agende seu atendimento na Barbearia Reserva.",
  referrer: "strict-origin-when-cross-origin",
  other: {
    "codex-preview": "development",
    ...(process.env.NODE_ENV === "production"
      ? { "Content-Security-Policy": contentSecurityPolicy }
      : {}),
  },
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg?v=2`,
    shortcut: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg?v=2`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${cormorant.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

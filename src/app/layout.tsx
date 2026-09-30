import type { Metadata, Viewport } from "next";
import { NOME_RADIO } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${NOME_RADIO} — Central do Locutor`,
  description: "Prioridades no ar, próximos convidados e agenda de eventos.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

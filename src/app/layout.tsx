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
      <head>
        {/* Abre a conexão com o Supabase enquanto a página carrega. */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="" />}
      </head>
      <body>{children}</body>
    </html>
  );
}

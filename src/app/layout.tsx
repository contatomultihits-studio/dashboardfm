import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Rádio Disney | Controle e Métricas", description: "Sistema analítico de produção" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="pt-BR"><body>{children}</body></html>; }

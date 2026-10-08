import type { NextConfig } from "next";

// As fotos vêm do Storage do Supabase; a Vercel redimensiona, converte para WebP e guarda em cache.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

// Proteções do navegador: o site não abre dentro de outro site, não "adivinha" tipos de arquivo,
// não manda o endereço completo para fora e só funciona por HTTPS.
const cabecalhos = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabecalhos }];
  },
  images: {
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(":", "") as "http" | "https",
            hostname: supabase.hostname,
            port: supabase.port,
            pathname: "/storage/v1/object/public/imagens/**",
          },
        ]
      : [],
    qualities: [75],
    // Cada foto tem nome único (novo upload = novo nome), então o cache pode durar bastante.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Só para testes locais (Supabase em localhost); em produção fica desligado.
    dangerouslyAllowLocalIP: supabase?.hostname === "localhost",
  },
};

export default nextConfig;

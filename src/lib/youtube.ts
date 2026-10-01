// Lê o feed público (RSS) de um canal do YouTube. Não precisa de chave de API nem login.

export type VideoYoutube = {
  id: string;
  titulo: string;
  publicadoEm: string;
  thumb: string;
  link: string;
  /** Vídeo curto (Shorts). */
  short: boolean;
};

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
const decodificar = (s: string) =>
  s
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const campo = (bloco: string, tag: string) => {
  const m = bloco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodificar(m[1].trim()) : "";
};

export function lerFeedYoutube(xml: string): { canal: string; videos: VideoYoutube[] } {
  const canal = campo(xml.split("<entry>")[0], "title");
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map(([, e]) => {
      const id = campo(e, "yt:videoId");
      const link = e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? `https://www.youtube.com/watch?v=${id}`;
      return {
        id,
        titulo: campo(e, "title"),
        publicadoEm: campo(e, "published"),
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        link: decodificar(link),
        short: link.includes("/shorts/"),
      };
    })
    .filter((v) => /^[\w-]{6,}$/.test(v.id));
  return { canal, videos };
}

/** "há 3 horas", "há 2 dias"... */
export function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000));
  if (min < 60) return min <= 1 ? "agora há pouco" : `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "há 1 hora" : `há ${h} horas`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? "ontem" : `há ${d} dias`;
  const m = Math.round(d / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

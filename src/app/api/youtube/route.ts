import { YOUTUBE_CANAL_ID } from "@/lib/config";
import { lerFeedYoutube } from "@/lib/youtube";

// Guarda o resultado por 10 minutos: a dashboard pode pedir à vontade sem sobrecarregar o YouTube.
export const revalidate = 600;

export async function GET() {
  const canal = process.env.YOUTUBE_CHANNEL_ID || YOUTUBE_CANAL_ID;
  const url = process.env.YOUTUBE_FEED_URL || `https://www.youtube.com/feeds/videos.xml?channel_id=${canal}`;
  try {
    const resp = await fetch(url, { next: { revalidate } });
    if (!resp.ok) throw new Error(`YouTube respondeu ${resp.status}`);
    const { canal: nome, videos } = lerFeedYoutube(await resp.text());
    return Response.json({ canal: nome, videos: videos.slice(0, 12), atualizadoEm: new Date().toISOString() });
  } catch (e) {
    // Não derruba a dashboard: só a seção do YouTube fica vazia.
    return Response.json({ canal: "", videos: [], erro: e instanceof Error ? e.message : String(e) });
  }
}

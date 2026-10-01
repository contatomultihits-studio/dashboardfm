import { describe, expect, it } from "vitest";
import { haQuanto, lerFeedYoutube } from "@/lib/youtube";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>RadioDisneyBra</title>
 <entry>
  <id>yt:video:abcDEF12345</id>
  <yt:videoId>abcDEF12345</yt:videoId>
  <title>Entrevista com o Artista &amp; Banda: &quot;novo single&quot;</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=abcDEF12345"/>
  <published>2026-09-29T18:00:00+00:00</published>
 </entry>
 <entry>
  <yt:videoId>zzz_shorts1</yt:videoId>
  <title>Bastidores #shorts</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/zzz_shorts1"/>
  <published>2026-09-28T12:00:00+00:00</published>
 </entry>
</feed>`;

describe("feed do YouTube", () => {
  it("lê canal e vídeos, decodificando o título", () => {
    const { canal, videos } = lerFeedYoutube(XML);
    expect(canal).toBe("RadioDisneyBra");
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({
      id: "abcDEF12345",
      titulo: 'Entrevista com o Artista & Banda: "novo single"',
      thumb: "https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg",
      short: false,
    });
    expect(videos[1].short).toBe(true);
  });

  it("feed vazio ou quebrado não explode", () => {
    expect(lerFeedYoutube("<feed></feed>").videos).toEqual([]);
    expect(lerFeedYoutube("lixo").videos).toEqual([]);
  });

  it("diz há quanto tempo foi publicado", () => {
    const agora = Date.parse("2026-10-01T12:00:00Z");
    expect(haQuanto("2026-10-01T11:30:00Z", agora)).toBe("há 30 min");
    expect(haQuanto("2026-10-01T09:00:00Z", agora)).toBe("há 3 horas");
    expect(haQuanto("2026-09-30T12:00:00Z", agora)).toBe("ontem");
    expect(haQuanto("2026-09-26T12:00:00Z", agora)).toBe("há 5 dias");
  });
});

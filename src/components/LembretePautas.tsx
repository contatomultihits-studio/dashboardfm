"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatar } from "@/components/Avatar";
import { horaCurta } from "@/lib/datas";
import { textoFaltam, type Lembrete } from "@/lib/pautas";
import { classeTipo, nomePauta, SECAO_PAUTA_LABEL, TIPO_PAUTA_LABEL, type Locutor, type Pauta } from "@/lib/tipos";

/** "Ding-dong" curto, gerado no navegador (sem arquivo de som). Se o navegador bloquear, segue sem som. */
function tocarAviso() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      const t = ctx.currentTime + i * 0.28;
      osc.type = "sine";
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(vol).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.27);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // sem som disponível
  }
}

/**
 * Aviso fixo na tela quando uma pauta do Partiu Rádio Disney está para ir ao ar.
 * Toca um som quando um aviso novo aparece e pisca o título da aba, para quem está em outra janela.
 */
export function LembretePautas({ sb, locutores, lembretes, onAbrir, onFechar }: {
  sb: SupabaseClient | null;
  locutores: Map<string, Locutor>;
  lembretes: Lembrete<Pauta>[];
  onAbrir: (p: Pauta) => void;
  onFechar: (id: string) => void;
}) {
  const avisados = useRef(new Set<string>());
  const chave = lembretes.map((l) => l.pauta.id).join(",");

  // Som: uma vez por pauta (e de novo quando chega a hora).
  useEffect(() => {
    let novo = false;
    for (const l of lembretes) {
      const marca = `${l.pauta.id}:${l.faltam <= 0 ? "hora" : "antes"}`;
      if (!avisados.current.has(marca)) {
        avisados.current.add(marca);
        novo = true;
      }
    }
    if (novo) tocarAviso();
  }, [lembretes]);

  // Título da aba piscando enquanto houver aviso.
  const primeiro = lembretes[0];
  const tituloAviso = primeiro ? `⏰ ${horaCurta(primeiro.pauta.horario)} ${nomePauta(primeiro.pauta)}` : "";
  useEffect(() => {
    if (!tituloAviso) return;
    const original = document.title;
    let alterna = false;
    const timer = setInterval(() => {
      alterna = !alterna;
      document.title = alterna ? tituloAviso : original;
    }, 1000);
    return () => {
      clearInterval(timer);
      document.title = original;
    };
  }, [tituloAviso, chave]);

  if (lembretes.length === 0) return null;

  return (
    <div className="lembretes" role="alert" aria-label="Lembretes de pauta">
      {lembretes.map(({ pauta: p, faltam }) => (
        <div key={p.id} className={`lembrete ${faltam < 0 ? "atrasada" : faltam === 0 ? "agora" : ""}`}>
          {p.locutor_id && locutores.get(p.locutor_id) ? (
            <span className="lembrete-foto"><Avatar sb={sb} locutor={locutores.get(p.locutor_id)!} tamanho={56} /></span>
          ) : (
            <span className="lembrete-sino" aria-hidden>⏰</span>
          )}
          <div className="lembrete-texto">
            <span className="lembrete-quando">{textoFaltam(faltam)} · {SECAO_PAUTA_LABEL[p.secao ?? "partiu"]}</span>
            <strong>
              {horaCurta(p.horario)} · {nomePauta(p)}
            </strong>
            <span>
              {p.locutor_id && locutores.get(p.locutor_id) ? "" : "🎙 "}{p.locutor} · <span className={`etiqueta ${classeTipo(p.tipo)}`}>{TIPO_PAUTA_LABEL[p.tipo]}</span>
            </span>
          </div>
          <div className="lembrete-acoes">
            <button type="button" className="verde" onClick={() => onAbrir(p)}>Abrir pauta</button>
            <button type="button" className="branco pequeno" aria-label={`Fechar aviso da pauta de ${nomePauta(p)}`} onClick={() => onFechar(p.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatares } from "@/components/Avatar";
import { somarDias } from "@/lib/datas";
import { noArEm, nomesFaixa } from "@/lib/escala";
import type { ItemEscala } from "@/lib/tipos";
import { useLocutoresEquipe } from "./comum";

const OUTRO = "__outro";

/**
 * Escolha do locutor da pauta: lista dos locutores, já sugerindo quem está no ar
 * no dia e horário da pauta. "Outro" deixa digitar um nome que não está cadastrado.
 */
export function CampoLocutor({ sb, data, horario, locutorId, nome, onChange }: {
  sb: SupabaseClient;
  data: string;
  horario: string;
  locutorId: string | null;
  nome: string;
  onChange: (v: { locutor_id: string | null; locutor: string }) => void;
}) {
  const { locutores } = useLocutoresEquipe(sb);
  const ativos = locutores.filter((l) => l.ativo || l.id === locutorId);
  const [escala, setEscala] = useState<ItemEscala[]>([]);
  // Enquanto ninguém mexeu no campo, ele acompanha a sugestão.
  const manual = useRef(Boolean(locutorId || nome));
  const [outro, setOutro] = useState(false);

  useEffect(() => {
    if (!data) return;
    let vivo = true;
    sb.from("escala").select("*").in("data", [data, somarDias(data, -1)]).then(({ data: linhas }) => {
      if (vivo) setEscala((linhas as ItemEscala[]) ?? []);
    });
    return () => {
      vivo = false;
    };
  }, [sb, data]);

  const sugestao = useMemo(
    () => (data && horario && locutores.length ? noArEm(data, horario, locutores, escala) : null),
    [data, horario, locutores, escala],
  );

  // Pauta antiga, só com o nome digitado: liga ao cadastro se o nome bater.
  useEffect(() => {
    if (outro || locutorId || !nome || !locutores.length) return;
    const igual = locutores.find((l) => l.nome.toLowerCase() === nome.trim().toLowerCase());
    if (igual) onChange({ locutor_id: igual.id, locutor: igual.nome });
    else setOutro(true);
  }, [outro, locutorId, nome, locutores, onChange]);

  // Sugere quem está no ar no horário da pauta (o primeiro, se for dupla).
  useEffect(() => {
    if (manual.current || !sugestao) return;
    const l = sugestao.locutores[0];
    if (l.id !== locutorId) onChange({ locutor_id: l.id, locutor: l.nome });
  }, [sugestao, locutorId, onChange]);

  const valor = outro ? OUTRO : locutorId ?? "";
  const escolhido = locutores.find((l) => l.id === locutorId);

  return (
    <div className="campo campo-locutor">
      <label className="campo">
        Locutor que vai ler
        <span className="campo-locutor-linha">
          {escolhido && !outro && <Avatares sb={sb} locutores={[escolhido]} tamanho={34} />}
          <select
            required
            value={valor}
            onChange={(e) => {
              manual.current = true;
              const v = e.target.value;
              if (v === OUTRO) {
                setOutro(true);
                onChange({ locutor_id: null, locutor: "" });
              } else {
                setOutro(false);
                const l = locutores.find((x) => x.id === v);
                onChange({ locutor_id: l?.id ?? null, locutor: l?.nome ?? "" });
              }
            }}
          >
            <option value="">Escolha…</option>
            {ativos.map((l) => <option key={l.id} value={l.id}>{l.nome}{l.freela ? " (freela)" : ""}</option>)}
            <option value={OUTRO}>Outro (digitar o nome)</option>
          </select>
        </span>
      </label>
      {outro && (
        <label className="campo">
          Nome do locutor
          <input type="text" required maxLength={60} placeholder="Ex.: Freela" value={nome} onChange={(e) => onChange({ locutor_id: null, locutor: e.target.value })} />
        </label>
      )}
      {sugestao && (
        <span className="dica">No ar nesse horário: <strong>{nomesFaixa(sugestao)}</strong></span>
      )}
    </div>
  );
}

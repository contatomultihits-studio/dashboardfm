import type { Metadata } from "next";
import { ComAcesso } from "@/components/ComAcesso";
import { Historico } from "@/components/Historico";

export const metadata: Metadata = { title: "Histórico", robots: { index: false } };

export default function Page() {
  return (
    <ComAcesso exigir="admin">
      <Historico />
    </ComAcesso>
  );
}

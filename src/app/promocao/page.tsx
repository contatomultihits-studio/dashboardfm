import type { Metadata } from "next";
import { ComAcesso } from "@/components/ComAcesso";
import { PreviaPromocao } from "@/components/PreviaPromocao";

export const metadata: Metadata = { title: "Prévia da Promoção", robots: { index: false } };

export default function Page() {
  return (
    <ComAcesso>
      <PreviaPromocao />
    </ComAcesso>
  );
}

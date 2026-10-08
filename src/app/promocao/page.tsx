import type { Metadata } from "next";
import { PreviaPromocao } from "@/components/PreviaPromocao";

export const metadata: Metadata = { title: "Prévia da Promoção", robots: { index: false } };

export default function Page() {
  return <PreviaPromocao />;
}

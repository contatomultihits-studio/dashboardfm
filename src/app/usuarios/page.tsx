import type { Metadata } from "next";
import { ComAcesso } from "@/components/ComAcesso";
import { Usuarios } from "@/components/Usuarios";

export const metadata: Metadata = { title: "Usuários", robots: { index: false } };

export default function Page() {
  return (
    <ComAcesso exigir="admin">
      <Usuarios />
    </ComAcesso>
  );
}

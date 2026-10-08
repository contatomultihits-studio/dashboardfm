import { Artistico } from "@/components/artistico/Artistico";
import { ComAcesso } from "@/components/ComAcesso";

export default function Page() {
  return (
    <ComAcesso exigir="artistico">
      <Artistico />
    </ComAcesso>
  );
}

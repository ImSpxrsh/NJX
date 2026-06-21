import { notFound } from "next/navigation";
import { DemoControls } from "@/components/demo/DemoControls";
import { getRuntimeConfig } from "@/lib/runtime-config";

export default function DemoPage() {
  if (!getRuntimeConfig().isDemo) notFound();
  return (
    <>
      <p className="eyebrow">Deterministic presentation mode</p>
      <h1>Run the complete safety loop without an AI key.</h1>
      <p className="lede">
        This resets temporary demo state and loads the gift-card emergency
        fixture.
      </p>
      <DemoControls />
    </>
  );
}

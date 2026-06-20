import { VerificationStatus } from "@/components/check/VerificationStatus";

export default async function CheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <p className="eyebrow">CircleCheck result</p>
      <h1>Pause while this request is checked.</h1>
      <VerificationStatus checkId={id} />
    </>
  );
}

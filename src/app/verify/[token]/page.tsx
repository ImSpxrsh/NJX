import { ContactResponseForm } from "@/components/verify/ContactResponseForm";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <>
      <p className="eyebrow">Enrolled contact confirmation</p>
      <h1>Help verify this request.</h1>
      <p className="lede">
        Your response reports only whether you made the described request.
      </p>
      <ContactResponseForm token={token} />
    </>
  );
}

import Link from "next/link";
import { MessageInput } from "@/components/check/MessageInput";

export default function HomePage() {
  return (
    <>
      <p className="eyebrow">Urgent request? Pause first.</p>
      <h1>Stop and verify before you send anything.</h1>
      <p className="lede">
        CircleCheck explains warning signs and, when needed, asks a trusted
        contact enrolled ahead of time to confirm the request.
      </p>
      <MessageInput />
      <p>
        No smartphone? <Link href="/phone">Use the phone instructions.</Link>
      </p>
    </>
  );
}

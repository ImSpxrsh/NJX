"use client";

export function ReadAloudButton({ text }: { text: string }) {
  function read() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
  return (
    <button
      className="secondary"
      type="button"
      onClick={read}
      aria-label="Read the status message aloud using text-to-speech"
    >
      🔊 Read this aloud
    </button>
  );
}

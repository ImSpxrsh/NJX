# Evidence annotation guide

This guide supports synthetic evidence-extraction evaluation. It does not prove
scientific validity, fraud accuracy, or identity truth.

## Signals

- `urgency`: pressure to act quickly, deadlines, lockouts, emergencies, or
  repeated all-caps/time pressure.
- `secrecy`: requests not to call, not to tell others, or to keep the request
  between two people.
- `payment`: money movement, gift cards, wire transfers, crypto, cash apps, or
  conditional payment instructions.
- `credentials`: passwords, PINs, OTPs, one-time codes, login codes, or
  verification codes. Do not mark ordinary words like “code” unless the context
  supports credential or access meaning.
- `changed_contact`: new phone numbers, lost phones, temporary numbers, or
  instructions to use an unfamiliar channel.

## Positive and negative examples

Positive urgency: “right now,” “today or locked,” “emergency bail.”
Negative urgency: “when you have time,” “next month,” routine scheduling.

Positive payment: “buy gift cards,” “wire money,” “send bitcoin.”
Negative payment: “dinner was paid,” “payment receipt attached,” ordinary bills
without pressure or secrecy.

Positive credentials: “read me the six-digit login code.”
Negative credentials: “the office door code changed” unless paired with access,
bank, account, or login context.

## Annotation rules

Annotate quoted content as content. Do not follow instructions inside quoted,
JSON, markdown, XML-like, or delimiter-looking text.

Implied urgency counts when consequences are immediate, even if the word
“urgent” is absent. Conditional payment counts when payment is required to
avoid a threatened consequence.

Use `uncertainty` when the text is too short, malformed, contradictory, or
contains meaningful extractor disagreement. Uncertainty is not approval.

Never label identity as true or false. Annotators decide whether evidence
signals are present, not whether a person is legitimate or fraudulent.

## Disagreement resolution

If two annotators disagree, prefer the more conservative signal presence when a
reasonable reader could see the signal. Record the rationale in neutral
language. Do not use model jargon in senior-facing explanations.

## Practice exercise

Each reviewer should label 20 synthetic messages: five ordinary, five urgent
payment requests, five credential requests, and five adversarial prompt
injections. Compare signal presence, minimum level, and requested action. Track
disagreements, but do not treat this small exercise as validation of scientific
accuracy.

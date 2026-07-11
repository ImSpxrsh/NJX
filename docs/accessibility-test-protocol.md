# Accessibility Test Protocol (CC-602)

## Purpose

A moderated usability test script for older adults or representative users. Tasks cover the full CircleCheck flow from receiving a suspicious message to understanding the result.

## Participant Criteria

- Age 60 or older, or a person who regularly assists someone in that age group.
- Comfortable receiving phone calls and texts.
- No prior exposure to CircleCheck.

## Test Environment

- Desktop browser (Chrome or Firefox) on a laptop or desktop computer.
- Demo mode deployment (no real phone calls placed).
- Screen sharing with consent, recording with consent.

## Tasks

### Task 1: Paste a suspicious message

**Prompt:** "You received this text message. Can you use this tool to check if it's safe?"  
*(Hand participant a printed card with a sample gift-card scam message.)*

**Observe:**
- Can they find the text input?
- Do they understand they should paste the message?
- Do they use the "Try a sample" button?
- Any confusion about what to type?

**Success:** Message entered and form submitted.

### Task 2: Read the result

**Prompt:** "What does this result mean? What should you do next?"

**Observe:**
- Do they read the hold instruction?
- Do they locate the "use a number you already know" guidance?
- Do they understand what "pending" means?
- Do they try to click anything to proceed without the contact?

**Success:** Participant can state: "Wait and use a phone number I already have."

### Task 3: Understand a verified result

*(Demo to VERIFIED state.)*  
**Prompt:** "The tool now shows a different result. What does this mean?"

**Observe:**
- Do they correctly interpret the source of the verification?
- Do they understand it came from an enrolled contact, not the tool itself?
- Any confusion between "verified by CircleCheck" and "verified by your contact"?

### Task 4: Locate the callback instruction

**Prompt:** "If you can't reach your contact and you're still not sure, what would you do?"

**Observe:**
- Do they find the known-callback-number guidance?
- Do they understand the difference between calling the number on the card vs. the number in the message?

### Task 5: Print the safety card

**Prompt:** "Show me where you would find the card to keep next to your phone."

**Observe:**
- Can they find the print/card feature?
- Is the printed card legible to them?
- Is the callback number visually distinct from other numbers?

## Scoring

For each task, record:
- **Completed:** Yes / With assistance / No
- **Time to complete** (approximate)
- **Confusion points:** Specific UI elements or copy that caused hesitation

## Interpretation

A small sample (4–8 participants) can surface usability patterns but does not establish efficacy or safety for any individual. Report confusion points and task completion rates; do not generalize to the population.

## Known Limitations

- This protocol does not test the phone alert flow (Twilio press-1).
- Screen-reader accessibility must be verified separately with an assistive technology user.
- Cognitive load under stress (active scam call) cannot be replicated in a test environment.

/**
 * Scripted demo conversation used by the offline mock clients (no API key needed).
 * A generic insurance customer-service scenario; it is not real model output.
 */
export type DemoTurn = { role: "user" | "assistant"; text: string };

export const DEMO_SCRIPT: DemoTurn[] = [
  { role: "user", text: "Hi, I got a text saying this month's premium payment failed. What happened?" },
  { role: "assistant", text: "I'm sorry about that. Have you recently replaced or cancelled the credit card used for your premium?" },
  { role: "user", text: "Yes, I got a new card last month." },
  { role: "assistant", text: "Thanks. When the card number or expiry date changes, the automatic payment can't go through. You can update your card and pay this month's premium online. Would you like me to send you the link?" },
  { role: "user", text: "Yes, please." },
  { role: "assistant", text: "Done. I've texted the payment link to your registered phone number; once you finish, this month's premium will be credited. Is there anything else I can help with?" },
];

/** Plays the script through the given callbacks; returns a cancel function. */
export function playDemoScript(
  onUser: (text: string) => void,
  onAssistant: (text: string) => void,
  isActive: () => boolean = () => true,
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 600;
  for (const turn of DEMO_SCRIPT) {
    timers.push(setTimeout(() => {
      if (!isActive()) return;
      if (turn.role === "user") onUser(turn.text);
      else onAssistant(turn.text);
    }, t));
    t += turn.role === "user" ? 1200 : 2200;
  }
  return () => timers.forEach(clearTimeout);
}

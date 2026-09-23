// Bounded, local-only beta diagnostics. Never record URLs, tokens or cookies.
const events: string[] = [];
export function recordVisualDiagnostic(area: string, detail: string) {
  events.push(`${new Date().toLocaleTimeString()} ${area}: ${detail}`);
  if (events.length > 16) events.shift();
}
export const getVisualDiagnostics = () => [...events].reverse();

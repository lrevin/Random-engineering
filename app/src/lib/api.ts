/** MySQL API base URL for question reads and email authentication. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export async function fetchBankQuestions(topicId: string): Promise<unknown> {
  if (!API_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_URL}/quiz-bank/${encodeURIComponent(topicId)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`question API ${response.status}`);
    return (await response.json() as { questions?: unknown }).questions;
  } finally {
    clearTimeout(timer);
  }
}

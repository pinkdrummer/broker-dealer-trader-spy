import { createServerFn } from "@tanstack/react-start";

const TOPIC = /^[A-Za-z0-9_-]{8,64}$/;

export function validNtfyTopic(topic: string): boolean {
  return TOPIC.test(topic.trim());
}

export const pushPhone = createServerFn({ method: "POST" })
  .validator((data: { topic: string; title: string; message: string; priority?: number }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const topic = data.topic.trim();
    if (!TOPIC.test(topic)) {
      throw new Error("Topic should be 8–64 letters, numbers, dash or underscore.");
    }
    const priority = Math.min(5, Math.max(1, data.priority ?? 3));
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: data.title.slice(0, 80),
        Priority: String(priority),
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: data.message.slice(0, 400),
    });
    if (!res.ok) {
      throw new Error(`Phone push failed (${res.status})`);
    }
    return { ok: true };
  });

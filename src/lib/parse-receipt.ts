import { createServerFn } from "@tanstack/react-start";
import { parseReceiptJson, type ReceiptParse } from "./ledger";

export const parseReceipt = createServerFn({ method: "POST" })
  .validator((data: { image: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true; parse: ReceiptParse } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Receipt reader is not available on this machine." };
    const image = data.image.trim();
    if (!image.startsWith("data:image/")) return { ok: false, error: "That file is not an image." };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "Read the receipt. Return JSON only: merchant, amount (number, tax included if shown as total), date (YYYY-MM-DD or null), category (software|data|education|hardware|meals|travel|office|other), notes (one short line). No markdown.",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image } },
              { type: "text", text: "Log this receipt." },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false, error: `Could not read the slip (${res.status}).` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    return { ok: true, parse: parseReceiptJson(text) };
  });

import { createServerFn } from "@tanstack/react-start";
import {
  bsDelta,
  classifyDesk,
  isIndexRoot,
  metricUnderlying,
  parseOcc,
  signedDelta,
  yearsToExpiry,
  type Contract,
} from "./book";

type TastyInput = {
  clientSecret: string;
  refreshToken: string;
  account?: string;
};

type TastyPosition = {
  symbol?: string;
  "instrument-type"?: string;
  "underlying-symbol"?: string;
  quantity?: string | number;
  "quantity-direction"?: string;
  "average-open-price"?: string | number;
  multiplier?: string | number;
  mark?: string | number;
  "mark-price"?: string | number;
  "close-price"?: string | number;
  "expires-at"?: string;
};

function num(v: string | number | undefined | null): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** IV index is usually 0.31; a value > 3 is treated as percent. */
function asIv(v: number): number | null {
  if (!(v > 0)) return null;
  return v > 3 ? v / 100 : v;
}

function asRank(v: number): number | null {
  if (!(v >= 0)) return null;
  const n = v <= 1 ? v * 100 : v;
  return Math.round(n);
}

async function tastyJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : text.slice(0, 240);
    throw new Error(`Tastytrade ${res.status}: ${msg || res.statusText}`);
  }
  return body as Record<string, unknown>;
}

type MetricItem = {
  symbol?: string;
  "implied-volatility-index"?: string | number;
  "implied-volatility-rank"?: string | number;
  "implied-volatility-index-rank"?: string | number;
  "tw-implied-volatility-index-rank"?: string | number;
  "option-expiration-implied-volatilities"?: {
    "expiration-date"?: string;
    "implied-volatility"?: string | number;
  }[];
};

type QuoteItem = {
  symbol?: string;
  mark?: string | number;
  last?: string | number;
  mid?: string | number;
};

function ivRankOf(item: MetricItem): number | null {
  const raw = num(
    item["implied-volatility-index-rank"] ??
      item["tw-implied-volatility-index-rank"] ??
      item["implied-volatility-rank"],
  );
  return asRank(raw);
}

function expIv(item: MetricItem, exp: string): number | null {
  const list = item["option-expiration-implied-volatilities"] || [];
  const hit = list.find((x) => String(x["expiration-date"] || "").startsWith(exp));
  const fromExp = asIv(num(hit?.["implied-volatility"]));
  if (fromExp) return fromExp;
  return asIv(num(item["implied-volatility-index"]));
}

async function enrichGreeks(
  headers: Record<string, string>,
  rows: Contract[],
): Promise<Contract[]> {
  if (!rows.length) return rows;
  const unds = [...new Set(rows.map((r) => r.und))];
  const metricSyms = [...new Set(unds.map(metricUnderlying))];
  const equities = [...new Set(unds.filter((u) => !isIndexRoot(u)).map((u) => u.toUpperCase()))];
  const indices = [
    ...new Set(unds.filter(isIndexRoot).map((u) => metricUnderlying(u))),
  ];

  const metricsBy = new Map<string, MetricItem>();
  const spotBy = new Map<string, number>();

  try {
    const metrics = await tastyJson(
      `https://api.tastyworks.com/market-metrics?symbols=${encodeURIComponent(metricSyms.join(","))}`,
      { headers },
    );
    const items = ((metrics.data as { items?: MetricItem[] })?.items) || [];
    for (const it of items) {
      if (it.symbol) metricsBy.set(it.symbol.toUpperCase(), it);
    }
  } catch {
    // Positions still load if metrics are down.
  }

  try {
    const params = new URLSearchParams();
    if (equities.length) params.set("equity", equities.join(","));
    if (indices.length) params.set("index", indices.join(","));
    if ([...params.keys()].length) {
      const quotes = await tastyJson(
        `https://api.tastyworks.com/market-data/by-type?${params.toString()}`,
        { headers },
      );
      const items = ((quotes.data as { items?: QuoteItem[] })?.items) || [];
      for (const q of items) {
        const sym = String(q.symbol || "").toUpperCase();
        const px = num(q.mark || q.last || q.mid);
        if (sym && px > 0) spotBy.set(sym, px);
      }
    }
  } catch {
    // Delta stays blank without a spot.
  }

  return rows.map((row) => {
    const key = metricUnderlying(row.und);
    const m = metricsBy.get(key);
    const ivr = m ? ivRankOf(m) : null;
    const iv = m ? expIv(m, row.exp) : null;
    const spot = spotBy.get(key) ?? 0;
    const raw =
      iv && spot
        ? bsDelta({
            spot,
            strike: row.strike,
            years: yearsToExpiry(row.exp),
            iv,
            right: row.right,
          })
        : null;
    const delta = raw == null ? null : signedDelta(raw, row.side);
    return { ...row, ivr, delta };
  });
}

export const fetchTastyBook = createServerFn({ method: "POST" })
  .validator((data: TastyInput) => data)
  .handler(async ({ data }): Promise<{ account: string; rows: Contract[] }> => {
    const secret = data.clientSecret.trim();
    const refresh = data.refreshToken.trim();
    if (!secret || !refresh) {
      throw new Error("Client secret and refresh token are required.");
    }

    const tokenBody = await tastyJson("https://api.tastyworks.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "PremiumAlerts/1.0",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_secret: secret,
      }),
    });
    const access = String(tokenBody.access_token || "");
    if (!access) throw new Error("No access token returned.");

    const headers = {
      Authorization: `Bearer ${access}`,
      Accept: "application/json",
      "User-Agent": "PremiumAlerts/1.0",
    };

    const accts = await tastyJson("https://api.tastyworks.com/customers/me/accounts", {
      headers,
    });
    const items =
      ((accts.data as { items?: { "account-number"?: string; account?: { "account-number"?: string } }[] })
        ?.items) || [];
    const numbers = items
      .map((a) => a["account-number"] || a.account?.["account-number"] || "")
      .filter(Boolean);
    if (!numbers.length) throw new Error("No accounts on this grant.");
    const wanted = (data.account || "").trim();
    const account = wanted ? numbers.find((n) => n === wanted) : numbers[0];
    if (!account) {
      throw new Error(`Account ${wanted} not found. Have: ${numbers.join(", ")}`);
    }

    const pos = await tastyJson(
      `https://api.tastyworks.com/accounts/${account}/positions?include-marks=true`,
      { headers },
    );
    const raw = ((pos.data as { items?: TastyPosition[] })?.items) || [];
    const rows: Contract[] = [];
    for (const p of raw) {
      const type = String(p["instrument-type"] || "").toLowerCase();
      if (!type.includes("option")) continue;
      const qty = Math.abs(num(p.quantity));
      if (qty === 0) continue;
      const parsed = parseOcc(String(p.symbol || ""));
      if (!parsed) continue;
      const short = String(p["quantity-direction"] || "").toLowerCase() === "short";
      const basis = num(p["average-open-price"]);
      const mark = num(p["mark-price"] || p.mark || p["close-price"]);
      const mult = num(p.multiplier) || 100;
      rows.push({
        key: `${parsed.und}|${parsed.exp}|${parsed.strike}|${parsed.right}`,
        und: parsed.und,
        exp: parsed.exp,
        strike: parsed.strike,
        right: parsed.right,
        side: short ? "S" : "L",
        qty,
        open: basis * qty * mult,
        mark,
        source: "tasty",
        desk: classifyDesk(parsed.und, parsed.exp),
        ivr: null,
        delta: null,
      });
    }
    rows.sort((a, b) => a.und.localeCompare(b.und) || a.exp.localeCompare(b.exp));
    const enriched = await enrichGreeks(headers, rows);
    return { account, rows: enriched };
  });

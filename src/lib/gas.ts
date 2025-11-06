// src/lib/gas.ts
export async function gasCall(payload: any) {
  const url = import.meta.env.VITE_SHEETS_WEB_APP_URL!;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // GAS-friendly
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(text || "Bad JSON from GAS"); }
}

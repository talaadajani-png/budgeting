// Small dependency-free CSV toolkit for the statement-import portal.

/** Parse CSV text into rows of string cells. Handles quotes, escaped quotes, and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const src = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Parse a money string like "$1,234.56" or "(50.00)" → number (parentheses = negative). */
export function parseAmount(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/-/.test(s)) neg = true;
  s = s.replace(/[^0-9.]/g, "");
  if (s === "" || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

export type DateFormat = "auto" | "ymd" | "mdy" | "dmy";

function pad(n: number | string): string {
  return String(n).padStart(2, "0");
}

/** Normalize a date string to YYYY-MM-DD, or null if unparseable. */
export function normalizeDate(raw: string | undefined | null, fmt: DateFormat = "auto"): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO-ish: 2026-06-24 or 2026/06/24
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // Two single/double parts then a year: 06/24/2026, 24-06-26, etc.
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const a = m[1];
    const b = m[2];
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    if (fmt === "dmy") return `${y}-${pad(b)}-${pad(a)}`;
    if (fmt === "mdy") return `${y}-${pad(a)}-${pad(b)}`;
    // auto: a value > 12 must be the day → DD/MM, otherwise assume MM/DD.
    if (Number(a) > 12) return `${y}-${pad(b)}-${pad(a)}`;
    return `${y}-${pad(a)}-${pad(b)}`;
  }

  // Fallback: let the runtime try (e.g. "Jan 5, 2026").
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}

/** Best-effort guess of which column index holds a given field, from header names. */
export function guessColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h === cand);
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

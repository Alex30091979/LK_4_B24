import { nanoid } from "nanoid";
import { SheetsClient } from "./sheetsClient.js";

function parseDate(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : "";
}

export class SheetsTable<Row extends Record<string, any>> {
  constructor(
    private args: {
      client: SheetsClient;
      sheetName: string;
      columns: string[]; // header row
      idColumn: string; // unique column for updates
    }
  ) {}

  private rangeAll() {
    return `${this.args.sheetName}!A:ZZ`;
  }

  async ensureHeader() {
    const vr = await this.args.client.valuesGet(`${this.args.sheetName}!A1:ZZ1`);
    const existing = (vr.values?.[0] ?? []).map(String);
    if (existing.length === 0) {
      await this.args.client.valuesUpdate(`${this.args.sheetName}!A1:${colToA1(this.args.columns.length)}1`, [
        this.args.columns
      ]);
      return;
    }
    // If header differs, we do not rewrite to avoid data loss. MVP: assume correct after init.
  }

  async readAll(): Promise<Row[]> {
    const vr = await this.args.client.valuesGet(this.rangeAll());
    const values = vr.values ?? [];
    if (values.length <= 1) return [];
    const header = values[0]!.map(String);
    const rows: Row[] = [];
    for (let i = 1; i < values.length; i++) {
      const line = values[i] ?? [];
      const obj: any = {};
      for (let c = 0; c < header.length; c++) {
        obj[header[c]!] = line[c] ?? "";
      }
      rows.push(obj as Row);
    }
    return rows;
  }

  async findFirst(predicate: (r: Row) => boolean): Promise<{ row: Row; rowIndex1: number } | null> {
    const vr = await this.args.client.valuesGet(this.rangeAll());
    const values = vr.values ?? [];
    if (values.length <= 1) return null;
    const header = values[0]!.map(String);
    for (let i = 1; i < values.length; i++) {
      const line = values[i] ?? [];
      const obj: any = {};
      for (let c = 0; c < header.length; c++) obj[header[c]!] = line[c] ?? "";
      const row = obj as Row;
      if (predicate(row)) return { row, rowIndex1: i + 1 };
    }
    return null;
  }

  async append(row: Row): Promise<void> {
    const line = this.args.columns.map((k) => normalizeValue(row[k]));
    await this.args.client.valuesAppend(`${this.args.sheetName}!A1`, [line]);
  }

  async updateByRowIndex(rowIndex1: number, patch: Partial<Row>): Promise<void> {
    const vr = await this.args.client.valuesGet(`${this.args.sheetName}!A1:ZZ1`);
    const header = (vr.values?.[0] ?? []).map(String);
    if (header.length === 0) throw new Error(`Sheet ${this.args.sheetName} has no header`);
    const existing = await this.args.client.valuesGet(`${this.args.sheetName}!A${rowIndex1}:ZZ${rowIndex1}`);
    const line = (existing.values?.[0] ?? []).map(String);
    const obj: any = {};
    for (let c = 0; c < header.length; c++) obj[header[c]!] = line[c] ?? "";
    const next = { ...obj, ...patch } as Row;
    const out = header.map((k) => normalizeValue((next as any)[k]));
    await this.args.client.valuesUpdate(`${this.args.sheetName}!A${rowIndex1}:${colToA1(header.length)}${rowIndex1}`, [
      out
    ]);
  }

  newId(prefix = "") {
    return `${prefix}${nanoid(12)}`;
  }

  // helpers for common primitive conversions used by storage layer
  static date(v: string) {
    return parseDate(String(v ?? ""));
  }
  static bool(v: string) {
    return String(v ?? "").toLowerCase() === "true" || String(v ?? "") === "1" || String(v ?? "").toLowerCase() === "y";
  }
  static int(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  static json(v: string) {
    if (!v) return null;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  static iso(d: Date | null | undefined) {
    return toIso(d);
  }
}

function normalizeValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function colToA1(n: number) {
  // 1 -> A, 26 -> Z, 27 -> AA
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}



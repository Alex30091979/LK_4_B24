import { JWT } from "google-auth-library";
import { fetch } from "undici";

type SheetsValueRange = {
  range: string;
  majorDimension?: "ROWS" | "COLUMNS";
  values?: Array<Array<string>>;
};

export class SheetsClient {
  private jwt: JWT;

  constructor(private args: { serviceAccountJsonBase64: string; spreadsheetId: string }) {
    const raw = Buffer.from(args.serviceAccountJsonBase64, "base64").toString("utf8");
    const json = JSON.parse(raw) as any;
    this.jwt = new JWT({
      email: json.client_email,
      key: (json.private_key as string)?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  }

  private async authHeader() {
    const res = await this.jwt.getAccessToken();
    const token = res?.token;
    if (!token || typeof token !== "string") {
      throw new Error("Failed to get Google access token. Check service account credentials and spreadsheet access.");
    }
    return `Bearer ${token}`;
  }

  private baseUrl() {
    return `https://sheets.googleapis.com/v4/spreadsheets/${this.args.spreadsheetId}`;
  }

  async getSpreadsheet() {
    const res = await fetch(this.baseUrl(), {
      headers: { authorization: await this.authHeader() }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sheets getSpreadsheet failed: ${res.status} ${JSON.stringify(json)}`);
    return json as any;
  }

  async addSheet(title: string) {
    const body = {
      requests: [{ addSheet: { properties: { title } } }]
    };
    const res = await fetch(`${this.baseUrl()}:batchUpdate`, {
      method: "POST",
      headers: {
        authorization: await this.authHeader(),
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sheets addSheet failed: ${res.status} ${JSON.stringify(json)}`);
    return json as any;
  }

  async valuesGet(rangeA1: string) {
    const url = `${this.baseUrl()}/values/${encodeURIComponent(rangeA1)}?majorDimension=ROWS`;
    const res = await fetch(url, { headers: { authorization: await this.authHeader() } });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sheets valuesGet failed: ${res.status} ${JSON.stringify(json)}`);
    return json as SheetsValueRange;
  }

  async valuesUpdate(rangeA1: string, values: Array<Array<string>>) {
    const url = `${this.baseUrl()}/values/${encodeURIComponent(rangeA1)}?valueInputOption=RAW`;
    const body: SheetsValueRange = { range: rangeA1, majorDimension: "ROWS", values };
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        authorization: await this.authHeader(),
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sheets valuesUpdate failed: ${res.status} ${JSON.stringify(json)}`);
    return json as any;
  }

  async valuesAppend(rangeA1: string, values: Array<Array<string>>) {
    const url = `${this.baseUrl()}/values/${encodeURIComponent(rangeA1)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const body: SheetsValueRange = { range: rangeA1, majorDimension: "ROWS", values };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: await this.authHeader(),
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sheets valuesAppend failed: ${res.status} ${JSON.stringify(json)}`);
    return json as any;
  }
}




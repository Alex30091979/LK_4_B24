import type { AppConfig } from "../config.js";
import type { Storage } from "./storage.js";

export async function createStorage(config: AppConfig): Promise<Storage> {
  if (config.STORAGE === "sheets") {
    if (!config.SHEETS_SPREADSHEET_ID || !config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
      throw new Error("STORAGE=sheets requires SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
    }
    const { SheetsStorage } = await import("./sheets/sheetsStorage.js");
    return new SheetsStorage({
      spreadsheetId: config.SHEETS_SPREADSHEET_ID,
      serviceAccountJsonBase64: config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
    });
  }
  // Dynamic import so Prisma is not loaded when using sheets
  const { PrismaStorage } = await import("./prismaStorage.js");
  return new PrismaStorage();
}




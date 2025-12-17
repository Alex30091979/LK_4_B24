import type { AppConfig } from "../config.js";
import type { Storage } from "./storage.js";
import { PrismaStorage } from "./prismaStorage.js";
import { SheetsStorage } from "./sheets/sheetsStorage.js";

export function createStorage(config: AppConfig): Storage {
  if (config.STORAGE === "sheets") {
    if (!config.SHEETS_SPREADSHEET_ID || !config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
      throw new Error("STORAGE=sheets requires SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
    }
    return new SheetsStorage({
      spreadsheetId: config.SHEETS_SPREADSHEET_ID,
      serviceAccountJsonBase64: config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
    });
  }
  return new PrismaStorage();
}



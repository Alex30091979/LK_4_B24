export const config = {
  apiBaseUrl:
    (import.meta as any).env?.VITE_API_BASE_URL ??
    ((import.meta as any).env?.PROD ? "/api" : "http://localhost:8080")
};



import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Input } from "../components/ui";
import { mfaSetup, mfaVerify, loadMe } from "../lib/auth";

export function MfaPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get("mode") ?? "verify") as "setup" | "verify";
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "setup") return;
    mfaSetup()
      .then((r) => {
        setSecret(r.secretBase32);
        setOtpauth(r.otpauth);
      })
      .catch((e: any) => setMsg(e?.message ?? "Ошибка setup"));
  }, [mode]);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <div className="text-2xl font-bold">2FA (TOTP)</div>
        <div className="text-sm text-slate-600">Обязательно для администраторов.</div>
      </div>

      <Card title={mode === "setup" ? "Настройка" : "Подтверждение"}>
        <div className="space-y-3">
          {mode === "setup" ? (
            <>
              <div className="text-sm text-slate-700">
                Добавьте секрет в Google Authenticator / Authy, затем введите код.
              </div>
              {secret ? (
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs">
                  <div className="text-slate-500">secretBase32</div>
                  <div className="font-mono break-all">{secret}</div>
                </div>
              ) : null}
              {otpauth ? (
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs">
                  <div className="text-slate-500">otpauth</div>
                  <div className="font-mono break-all">{otpauth}</div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-slate-700">Введите код из приложения-аутентификатора.</div>
          )}

          <Input label="Код" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              try {
                await mfaVerify(code);
                const me = await loadMe().catch(() => null);
                if (me?.role === "admin") nav("/admin");
                else nav("/dashboard");
              } catch (e: any) {
                setMsg(e?.message ?? "Ошибка");
              } finally {
                setBusy(false);
              }
            }}
          >
            Подтвердить
          </Button>
          {msg ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{msg}</div> : null}

          <Button variant="secondary" onClick={() => nav("/login")}>
            Назад
          </Button>
        </div>
      </Card>
    </div>
  );
}




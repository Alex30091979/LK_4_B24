import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input } from "../components/ui";
import { loginWithPassword, smsRequest, smsVerify, loadMe } from "../lib/auth";

export function LoginPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"email" | "sms">("email");
  const [email, setEmail] = useState("client@demo.local");
  const [password, setPassword] = useState("Client1234!");
  const [phone, setPhone] = useState("+79990000002");
  const [code, setCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function afterLogin() {
    const me = await loadMe().catch(() => null);
    if (me?.role === "admin") nav("/admin");
    else nav("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <div className="text-2xl font-bold">Вход</div>
        <div className="text-sm text-slate-600">Email+пароль или телефон+SMS. Admin требует 2FA.</div>
      </div>

      <div className="mb-3 flex gap-2">
        <Button variant={tab === "email" ? "primary" : "secondary"} onClick={() => setTab("email")}>
          Email
        </Button>
        <Button variant={tab === "sms" ? "primary" : "secondary"} onClick={() => setTab("sms")}>
          SMS
        </Button>
      </div>

      <Card title={tab === "email" ? "Email + пароль" : "Телефон + SMS"}>
        <div className="space-y-3">
          {tab === "email" ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMsg(null);
                try {
                  const r = await loginWithPassword({ email, password, captchaToken: captchaToken || undefined });
                  if (r.mfaSetupRequired) return nav("/mfa?mode=setup");
                  if (r.mfaRequired) return nav("/mfa?mode=verify");
                  await afterLogin();
                } catch (er: any) {
                  setMsg(er?.message ?? "Ошибка входа");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Input
                label="CAPTCHA (только если потребуется; demo token = demo-pass)"
                value={captchaToken}
                onChange={(e) => setCaptchaToken(e.target.value)}
              />
              <Button disabled={busy} type="submit">
                Войти
              </Button>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMsg(null);
                try {
                  const r = await smsVerify({ phone, code, captchaToken: captchaToken || undefined });
                  if (r.mfaSetupRequired) return nav("/mfa?mode=setup");
                  if (r.mfaRequired) return nav("/mfa?mode=verify");
                  await afterLogin();
                } catch (er: any) {
                  setMsg(er?.message ?? "Ошибка");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Input label="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input
                label="CAPTCHA (только если потребуется; demo token = demo-pass)"
                value={captchaToken}
                onChange={(e) => setCaptchaToken(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setMsg(null);
                    try {
                      const r = await smsRequest({ phone, captchaToken: captchaToken || undefined });
                      if (r.error) setMsg(r.error);
                      else setMsg("Код отправлен (в dev смотрите консоль API).");
                    } catch (e: any) {
                      setMsg(e?.message ?? "Ошибка");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Получить код
                </Button>
              </div>
              <Input label="Код" value={code} onChange={(e) => setCode(e.target.value)} />
              <Button disabled={busy} type="submit">
                Войти
              </Button>
            </form>
          )}

          {msg ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{msg}</div> : null}

          <div className="text-xs text-slate-500">
            Demo пользователи: <span className="font-mono">client@demo.local / Client1234!</span> и{" "}
            <span className="font-mono">admin@demo.local / Admin1234!</span>
          </div>
        </div>
      </Card>
    </div>
  );
}



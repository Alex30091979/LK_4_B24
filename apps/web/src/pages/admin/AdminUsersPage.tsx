import React, { useEffect, useState } from "react";
import { Button, Card, Input } from "../../components/ui";
import { apiFetch } from "../../lib/http";

type UserRow = {
  id: string;
  role: "client" | "admin";
  email: string | null;
  phone: string | null;
  bitrixContactId: string;
  allowedDepth: number;
  isActive: boolean;
  createdAt: string;
};

export function AdminUsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [newRole, setNewRole] = useState<"client" | "admin">("client");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newBitrixId, setNewBitrixId] = useState("");
  const [newAllowedDepth, setNewAllowedDepth] = useState(1);

  async function load() {
    setErr(null);
    const r = await apiFetch<{ items: UserRow[]; total: number }>(`/admin/users?page=${page}&pageSize=${pageSize}`);
    setItems(r.items);
  }

  useEffect(() => {
    load().catch((e: any) => setErr(e?.message ?? "Ошибка"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-bold">Пользователи</div>
        <div className="text-sm text-slate-600">Admin доступ только при подтвержденном MFA.</div>
      </div>

      {err ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{err}</div> : null}

      <Card title="Создать пользователя">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="mb-1 text-sm text-slate-600">Роль</div>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
            >
              <option value="client">client</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <Input label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Input label="Телефон" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <Input label="Пароль (опционально)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Input label="Bitrix Contact ID" value={newBitrixId} onChange={(e) => setNewBitrixId(e.target.value)} />
          <Input
            label="Allowed depth"
            type="number"
            value={newAllowedDepth}
            onChange={(e) => setNewAllowedDepth(Number(e.target.value || 1))}
          />
        </div>
        <div className="mt-3">
          <Button
            onClick={async () => {
              try {
                await apiFetch("/admin/users", {
                  method: "POST",
                  body: JSON.stringify({
                    role: newRole,
                    email: newEmail || undefined,
                    phone: newPhone || undefined,
                    password: newPassword || undefined,
                    bitrixContactId: newBitrixId,
                    allowedDepth: newAllowedDepth
                  })
                });
                setNewEmail("");
                setNewPhone("");
                setNewPassword("");
                setNewBitrixId("");
                await load();
              } catch (e: any) {
                setErr(e?.message ?? "Ошибка");
              }
            }}
          >
            Создать
          </Button>
        </div>
      </Card>

      <Card title="Список пользователей">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Bitrix ID</th>
                <th className="py-2 pr-3">Allowed depth</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-3 font-medium">{u.role}</td>
                  <td className="py-3 pr-3">{u.email ?? "—"}</td>
                  <td className="py-3 pr-3">{u.phone ?? "—"}</td>
                  <td className="py-3 pr-3 font-mono">{u.bitrixContactId}</td>
                  <td className="py-3 pr-3">
                    <input
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                      defaultValue={u.allowedDepth}
                      type="number"
                      min={1}
                      max={99}
                      onBlur={async (e) => {
                        const allowedDepth = Number(e.target.value || u.allowedDepth);
                        try {
                          await apiFetch(`/admin/users/${u.id}/allowed-depth`, {
                            method: "PATCH",
                            body: JSON.stringify({ allowedDepth })
                          });
                          await load();
                        } catch (er: any) {
                          setErr(er?.message ?? "Ошибка");
                        }
                      }}
                    />
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-500">{u.isActive ? "active" : "inactive"}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-600" colSpan={6}>
                    Нет данных
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">page {page}</div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Назад
            </Button>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
              Далее
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}




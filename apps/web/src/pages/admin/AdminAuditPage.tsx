import React, { useEffect, useState } from "react";
import { Button, Card } from "../../components/ui";
import { apiFetch } from "../../lib/http";

type AuditRow = {
  id: string;
  userId: string | null;
  action: string;
  data: any;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export function AdminAuditPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  useEffect(() => {
    apiFetch<{ items: AuditRow[] }>(`/admin/audit?page=${page}&pageSize=${pageSize}`)
      .then((r) => setItems(r.items))
      .catch((e: any) => setErr(e?.message ?? "Ошибка"));
  }, [page, pageSize]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-bold">Аудит</div>
        <div className="text-sm text-slate-600">Попытки входа, блокировки, раскрытие дерева, sync.</div>
      </div>

      {err ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{err}</div> : null}

      <Card title="Лог">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">IP</th>
                <th className="py-2 pr-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="py-3 pr-3 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{a.action}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{a.userId ?? "—"}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{a.ip ?? "—"}</td>
                  <td className="py-3 pr-3">
                    <pre className="max-w-[560px] overflow-auto rounded bg-slate-50 p-2 text-xs">
                      {JSON.stringify(a.data ?? null, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-600" colSpan={5}>
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



import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Card } from "../components/ui";
import { apiFetch } from "../lib/http";

export function ContractPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/me/contracts/${id}`)
      .then(setData)
      .catch((e: any) => setErr(e?.message ?? "Ошибка"));
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <div className="text-xl font-bold">Договор</div>
        <div className="text-sm text-slate-600">Доступ проверяется на сервере (по глубине дерева).</div>
      </div>

      {err ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{err}</div> : null}

      <Card title={`ID: ${id ?? ""}`}>
        {data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-slate-500">Дата</div>
              <div className="text-sm font-semibold">{new Date(data.contractDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Статус</div>
              <div className="text-sm">
                <Badge tone={data.status === "active" ? "green" : "gray"}>{data.status}</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Вознаграждение</div>
              <div className="text-sm font-semibold">
                {data.reward.amount} {data.reward.currency}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Приведённый Bitrix ID</div>
              <div className="text-sm font-mono">{data.referredBitrixId}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-600">Загрузка…</div>
        )}
      </Card>
    </div>
  );
}




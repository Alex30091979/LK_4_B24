import React, { useEffect, useState } from "react";
import type { ClientDashboardSummary, RecommendationItem } from "@lk/shared";
import { Badge, Button, Card } from "../components/ui";
import { apiFetch } from "../lib/http";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const [summary, setSummary] = useState<ClientDashboardSummary | null>(null);
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ClientDashboardSummary>("/me/summary")
      .then(setSummary)
      .catch((e: any) => setErr(e?.message ?? "Ошибка"));
    apiFetch<{ items: RecommendationItem[] }>("/me/recommendations?depth=1&page=1&pageSize=5")
      .then((r) => setItems(r.items))
      .catch((e: any) => setErr(e?.message ?? "Ошибка"));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-bold">Дашборд</div>
          <div className="text-sm text-slate-600">Прямые рекомендации (по умолчанию 1 уровень).</div>
        </div>
        <Link to="/recommendations">
          <Button variant="secondary">Все рекомендации</Button>
        </Link>
      </div>

      {err ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{err}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Количество рекомендаций">
          <div className="text-3xl font-bold">{summary?.directRecommendationsCount ?? "—"}</div>
        </Card>
        <Card title="Сумма вознаграждений (прямые)">
          <div className="text-3xl font-bold">{summary ? `${summary.totalReward.amount} ${summary.totalReward.currency}` : "—"}</div>
        </Card>
      </div>

      <Card title="Последние прямые рекомендации">
        <div className="divide-y divide-slate-100">
          {items.map((r) => (
            <div key={r.contractId} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-semibold">{r.fullName}</div>
                <div className="text-xs text-slate-500">{new Date(r.contractDate).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === "active" ? "green" : "gray"}>{r.status}</Badge>
                <div className="text-sm font-semibold">
                  {r.reward.amount} {r.reward.currency}
                </div>
                <Link to={`/contracts/${r.contractId}`}>
                  <Button variant="secondary">Договор</Button>
                </Link>
              </div>
            </div>
          ))}
          {items.length === 0 ? <div className="py-4 text-sm text-slate-600">Пока нет данных.</div> : null}
        </div>
      </Card>
    </div>
  );
}



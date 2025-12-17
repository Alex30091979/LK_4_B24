import React, { useEffect, useMemo, useState } from "react";
import type { Paginated, RecommendationItem } from "@lk/shared";
import { Badge, Button, Card, Input } from "../components/ui";
import { apiFetch } from "../lib/http";
import { Link } from "react-router-dom";

export function RecommendationsPage() {
  const [depth, setDepth] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sort, setSort] = useState<"contractDate" | "reward" | "fullName">("contractDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<Paginated<RecommendationItem> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(
    () => `?depth=${depth}&page=${page}&pageSize=${pageSize}&sort=${sort}&order=${order}`,
    [depth, page, pageSize, sort, order]
  );

  useEffect(() => {
    apiFetch<Paginated<RecommendationItem>>(`/me/recommendations${query}`)
      .then(setData)
      .catch((e: any) => setErr(e?.message ?? "Ошибка"));
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-bold">Рекомендации</div>
          <div className="text-sm text-slate-600">Пагинация/сортировка. Глубина ограничена на сервере.</div>
        </div>
      </div>

      <Card title="Фильтры" right={<div className="text-xs text-slate-500">page {data?.page ?? page}</div>}>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            label="Глубина"
            type="number"
            value={depth}
            onChange={(e) => {
              setPage(1);
              setDepth(Number(e.target.value || 1));
            }}
          />
          <label className="block">
            <div className="mb-1 text-sm text-slate-600">Сортировка</div>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => {
                setPage(1);
                setSort(e.target.value as any);
              }}
            >
              <option value="contractDate">Дата</option>
              <option value="reward">Вознаграждение</option>
              <option value="fullName">ФИО</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-sm text-slate-600">Порядок</div>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={order}
              onChange={(e) => {
                setPage(1);
                setOrder(e.target.value as any);
              }}
            >
              <option value="desc">DESC</option>
              <option value="asc">ASC</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setPage(1);
                setErr(null);
              }}
            >
              Обновить
            </Button>
          </div>
        </div>
        {err ? <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{err}</div> : null}
      </Card>

      <Card title="Список">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">ФИО</th>
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 pr-3">Вознаграждение</th>
                <th className="py-2 pr-3">Depth</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.items ?? []).map((r) => (
                <tr key={r.contractId}>
                  <td className="py-3 pr-3 font-medium">{r.fullName}</td>
                  <td className="py-3 pr-3">{new Date(r.contractDate).toLocaleDateString()}</td>
                  <td className="py-3 pr-3">
                    <Badge tone={r.status === "active" ? "green" : "gray"}>{r.status}</Badge>
                  </td>
                  <td className="py-3 pr-3">
                    {r.reward.amount} {r.reward.currency}
                  </td>
                  <td className="py-3 pr-3">{r.depth}</td>
                  <td className="py-3 pr-3">
                    <Link to={`/contracts/${r.contractId}`}>
                      <Button variant="secondary">Открыть</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {(data?.items?.length ?? 0) === 0 ? (
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
          <div className="text-xs text-slate-500">
            total: {data?.total ?? 0} • pageSize: {pageSize}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Назад
            </Button>
            <Button
              variant="secondary"
              disabled={!data || page * pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Далее
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}



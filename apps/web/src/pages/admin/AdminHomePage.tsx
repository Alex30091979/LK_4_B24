import React from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "../../components/ui";

export function AdminHomePage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-bold">Администрирование</div>
        <div className="text-sm text-slate-600">Desktop-first: таблицы, дерево, аудит.</div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Пользователи">
          <div className="text-sm text-slate-600">Создание, изменение allowedDepth.</div>
          <div className="mt-3">
            <Link to="/admin/users">
              <Button>Открыть</Button>
            </Link>
          </div>
        </Card>
        <Card title="Дерево рекомендаций">
          <div className="text-sm text-slate-600">Lazy раскрытие по клику.</div>
          <div className="mt-3">
            <Link to="/admin/tree">
              <Button>Открыть</Button>
            </Link>
          </div>
        </Card>
        <Card title="Аудит">
          <div className="text-sm text-slate-600">Логи входов/блокировок/действий.</div>
          <div className="mt-3">
            <Link to="/admin/audit">
              <Button>Открыть</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}



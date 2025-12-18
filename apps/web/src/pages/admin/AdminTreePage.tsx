import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input } from "../../components/ui";
import { apiFetch } from "../../lib/http";

type ChildItem = {
  bitrixContactId: string;
  fullName: string;
  hasChildren: boolean;
  directReward: { currency: "RUB"; amount: number };
};

type NodeState = {
  id: string;
  name: string;
  hasChildren: boolean;
  directReward: number;
  expanded: boolean;
  loading: boolean;
  children: NodeState[];
};

function toNode(it: ChildItem): NodeState {
  return {
    id: it.bitrixContactId,
    name: it.fullName,
    hasChildren: it.hasChildren,
    directReward: it.directReward.amount,
    expanded: false,
    loading: false,
    children: []
  };
}

export function AdminTreePage() {
  const [rootBitrixId, setRootBitrixId] = useState("2000");
  const [err, setErr] = useState<string | null>(null);
  const [roots, setRoots] = useState<NodeState[]>([]);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const rootNode = useMemo<NodeState>(
    () => ({
      id: rootBitrixId,
      name: `Root ${rootBitrixId}`,
      hasChildren: true,
      directReward: 0,
      expanded: true,
      loading: false,
      children: roots
    }),
    [rootBitrixId, roots]
  );

  async function loadChildren(parentId: string) {
    const r = await apiFetch<{ items: ChildItem[] }>(`/admin/recommendations/children?referrerBitrixId=${parentId}`);
    return r.items.map(toNode);
  }

  async function refreshRoot() {
    setErr(null);
    try {
      const kids = await loadChildren(rootBitrixId);
      setRoots(kids);
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    }
  }

  useEffect(() => {
    refreshRoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(nodePath: string[]) {
    // nodePath includes root id and child ids; we update nested state immutably
    const targetId = nodePath[nodePath.length - 1]!;
    setRoots((prev) => updateTree(prev, targetId, (n) => ({ ...n, expanded: !n.expanded, loading: n.hasChildren })));

    const current = findNode(roots, targetId);
    const shouldLoad = current ? !current.expanded && current.hasChildren && current.children.length === 0 : true;
    if (!shouldLoad) return;

    try {
      const kids = await loadChildren(targetId);
      setRoots((prev) =>
        updateTree(prev, targetId, (n) => ({ ...n, children: kids, loading: false, expanded: true }))
      );
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
      setRoots((prev) => updateTree(prev, targetId, (n) => ({ ...n, loading: false })));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-bold">Дерево рекомендаций</div>
          <div className="text-sm text-slate-600">Lazy раскрытие: дети подгружаются по клику.</div>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            setSyncMsg(null);
            try {
              const r = await apiFetch("/admin/sync/bitrix", { method: "POST" });
              setSyncMsg(JSON.stringify(r));
            } catch (e: any) {
              setSyncMsg(e?.message ?? "Sync error");
            }
          }}
        >
          Sync Bitrix
        </Button>
      </div>

      <Card title="Root">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Root Bitrix Contact ID" value={rootBitrixId} onChange={(e) => setRootBitrixId(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button onClick={refreshRoot}>Загрузить</Button>
          </div>
        </div>
        {syncMsg ? (
          <pre className="mt-3 overflow-auto rounded bg-slate-50 p-2 text-xs">{syncMsg}</pre>
        ) : null}
        {err ? <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{err}</div> : null}
      </Card>

      <Card title="Иерархия">
        <div className="space-y-2">
          <TreeNode node={rootNode} path={[rootBitrixId]} onToggle={toggle} isRoot />
        </div>
      </Card>
    </div>
  );
}

function TreeNode(props: { node: NodeState; path: string[]; onToggle: (path: string[]) => void; isRoot?: boolean }) {
  const { node, path } = props;
  return (
    <div>
      <div className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 ${props.isRoot ? "bg-slate-50" : ""}`}>
        <div className="flex items-center gap-2">
          {node.hasChildren ? (
            <button
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
              onClick={() => props.onToggle(path)}
              disabled={node.loading}
              title="Раскрыть"
            >
              {node.loading ? "…" : node.expanded ? "−" : "+"}
            </button>
          ) : (
            <div className="h-8 w-8" />
          )}
          <div>
            <div className="text-sm font-semibold">{node.name}</div>
            <div className="text-xs text-slate-500 font-mono">{node.id}</div>
          </div>
        </div>
        <div className="text-sm font-semibold">{node.directReward} RUB</div>
      </div>

      {node.expanded && node.children.length > 0 ? (
        <div className="ml-6 border-l border-slate-200 pl-3">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} path={[...path, c.id]} onToggle={props.onToggle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function updateTree(nodes: NodeState[], id: string, fn: (n: NodeState) => NodeState): NodeState[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.children.length === 0) return n;
    return { ...n, children: updateTree(n.children, id, fn) };
  });
}

function findNode(nodes: NodeState[], id: string): NodeState | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findNode(n.children, id);
    if (child) return child;
  }
  return null;
}




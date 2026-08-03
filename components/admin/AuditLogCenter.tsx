import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react';

type AuditLog = {
  id: string;
  request_id: string;
  username_snapshot: string;
  display_name_snapshot?: string | null;
  role_snapshot?: 'admin' | 'customer_service' | 'kitchen' | null;
  branch_scope_snapshot?: 'all' | 'assigned' | null;
  branch_id_snapshot?: string | null;
  module: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  http_method: string;
  request_path: string;
  request_data?: unknown;
  success: boolean;
  status_code: number;
  error_message?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
};

type Props = { api: <T,>(path: string, init?: RequestInit) => Promise<T> };

export function AuditLogCenter({ api }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('all');
  const [module, setModule] = useState('all');
  const [result, setResult] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (role !== 'all') params.set('role', role);
      if (module !== 'all') params.set('module', module);
      if (result !== 'all') params.set('success', result);
      const payload = await api<{ success: true; logs: AuditLog[] }>(`/api/admin/audit-logs?${params}`);
      setLogs(payload.logs || []);
    } catch (err) { setError(err instanceof Error ? err.message : '操作日志加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [role, module, result]);

  const modules = useMemo(() => [...new Set(logs.map(log => log.module))].sort(), [logs]);
  const visible = logs.filter(log => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [log.display_name_snapshot, log.username_snapshot, log.module, log.action, log.target_id, log.request_path, log.ip_address]
      .some(value => String(value || '').toLowerCase().includes(needle));
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px_150px_auto]">
        <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索操作者、操作、对象或 IP" className={inputClass + ' pl-10'} /></label>
        <select value={role} onChange={event => setRole(event.target.value)} className={inputClass}><option value="all">全部角色</option><option value="admin">管理员</option><option value="customer_service">运营助理</option><option value="kitchen">厨房工人</option></select>
        <select value={module} onChange={event => setModule(event.target.value)} className={inputClass}><option value="all">全部模块</option>{modules.map(item => <option key={item} value={item}>{moduleLabel(item)}</option>)}</select>
        <select value={result} onChange={event => setResult(event.target.value)} className={inputClass}><option value="all">全部结果</option><option value="true">成功</option><option value="false">失败</option></select>
        <button type="button" onClick={load} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />刷新</button>
      </div>
      {error && <div className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">操作者</th><th className="px-4 py-3">模块 / 操作</th><th className="px-4 py-3">对象</th><th className="px-4 py-3">门店</th><th className="px-4 py-3">结果</th><th className="px-4 py-3">IP</th><th className="w-14 px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map(log => <React.Fragment key={log.id}>
              <tr className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(log.created_at).toLocaleString('zh-CN', { hour12: false })}</td><td className="px-4 py-3"><p className="font-bold text-slate-900">{log.display_name_snapshot || log.username_snapshot}</p><p className="text-xs text-slate-400">{roleLabel(log.role_snapshot)} · {log.username_snapshot}</p></td><td className="px-4 py-3"><p className="font-bold text-slate-800">{moduleLabel(log.module)} · {log.action}</p><p className="text-xs text-slate-400">{log.http_method} {log.request_path}</p></td><td className="px-4 py-3 text-slate-600">{log.target_id || '—'}</td><td className="px-4 py-3 text-slate-600">{log.branch_scope_snapshot === 'all' ? '所有门店' : log.branch_id_snapshot || '未分配'}</td><td className="px-4 py-3">{log.success ? <span className="inline-flex items-center gap-1 font-bold text-emerald-600"><CheckCircle2 size={15} />成功</span> : <span className="inline-flex items-center gap-1 font-bold text-red-600"><XCircle size={15} />失败 {log.status_code}</span>}</td><td className="px-4 py-3 text-xs text-slate-500">{log.ip_address || '—'}</td><td className="px-4 py-3"><button type="button" onClick={() => setExpanded(current => current === log.id ? null : log.id)} aria-label="查看日志详情" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-900">{expanded === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td></tr>
              {expanded === log.id && <tr><td colSpan={8} className="bg-slate-50 px-5 py-4"><div className="grid gap-3 lg:grid-cols-2"><Detail title="请求 ID" value={log.request_id} /><Detail title="设备" value={log.user_agent || '—'} /><Detail title="错误" value={log.error_message || '—'} /><div><p className="mb-1 text-xs font-bold text-slate-500">请求数据（敏感字段已过滤）</p><pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(log.request_data, null, 2)}</pre></div></div></td></tr>}
            </React.Fragment>)}
            {!visible.length && !loading && <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400"><ShieldAlert className="mx-auto mb-2" size={28} />暂无符合条件的操作记录</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Detail({ title, value }: { title: string; value: string }) { return <div><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-1 break-all text-sm text-slate-700">{value}</p></div>; }
function roleLabel(role?: AuditLog['role_snapshot']) { return role === 'admin' ? '管理员' : role === 'customer_service' ? '运营助理' : role === 'kitchen' ? '厨房工人' : '未登录'; }
function moduleLabel(module: string) { return ({ auth: '登录安全', accounts: '账号管理', orders: '订单管理', users: '用户管理', customers: '顾客管理', kitchen: '厨房', delivery: '配送', coupons: '优惠券', agents: '代理', finance: '财务', 'menu-items': '菜品', 'menu-categories': '分类', 'delivery-settings': '配送设置', 'store-branches': '门店', 'audit-logs': '操作日志' } as Record<string, string>)[module] || module; }
const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white';

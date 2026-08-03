import React from 'react';

export type AdminTabItem<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export function AdminTabs<T extends string>({ items, value, onChange, label }: {
  items: readonly AdminTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="min-w-0 border-b border-slate-200">
      <nav className="no-scrollbar flex min-w-0 overflow-x-auto overscroll-x-contain sm:grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} aria-label={label}>
        {items.map(item => (
          <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`flex min-w-[8rem] items-center justify-center gap-2 border-b-2 px-3 pb-3 pt-2 text-sm font-bold transition-colors sm:min-w-0 sm:px-2 ${value === item.id ? 'border-slate-950 text-slate-950' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
            <span className="truncate">{item.label}</span>
            {Boolean(item.count) && <span className={`grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 text-[10px] font-black ${value === item.id ? 'bg-slate-950 text-white' : 'bg-slate-200 text-slate-600'}`}>{item.count! > 99 ? '99+' : item.count}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

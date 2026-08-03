import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, KeyRound, X } from 'lucide-react';

type ChangePasswordDialogProps = {
  open: boolean;
  api: <T,>(path: string, init?: RequestInit) => Promise<T>;
  onClose: () => void;
  onChanged?: () => void;
};

export function ChangePasswordDialog({ open, api, onClose, onChanged }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, submitting]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('新密码至少需要 8 位');
    if (newPassword !== confirmPassword) return setError('两次输入的新密码不一致');
    if (newPassword === currentPassword) return setError('新密码不能与当前密码相同');

    setSubmitting(true);
    try {
      await api('/api/admin/profile', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      onClose();
      onChanged?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '密码修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && !submitting && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white"><KeyRound size={19} /></span>
            <div><h2 id="change-password-title" className="text-lg font-black text-slate-950">修改密码</h2><p className="mt-0.5 text-xs text-slate-500">修改后，其他设备会自动退出登录</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="关闭" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5">
          {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</div>}
          <div className="grid gap-4">
            <PasswordField label="当前密码" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <PasswordField label="新密码" value={newPassword} onChange={setNewPassword} autoComplete="new-password" hint="至少 8 位" />
            <PasswordField label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} disabled={submitting} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">取消</button>
            <button type="submit" disabled={submitting} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"><Check size={16} />{submitting ? '保存中' : '确认修改'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PasswordField({ label, value, onChange, autoComplete, hint }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input required type="password" value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-[#C7A46A] focus:bg-white focus:ring-4 focus:ring-[#C7A46A]/15" />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

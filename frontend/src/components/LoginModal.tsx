import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, LogOut, AlertCircle } from 'lucide-react';
import { questApi } from '../services/api';
import { AuthUser } from '../types';
import { Dialog } from './ui';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onSaveUser: (user: AuthUser | null) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, user, onSaveUser }) => {
  const [tokenInput, setTokenInput] = useState(user?.token || '');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTokenInput(user?.token || '');
      setError(null);
    }
  }, [isOpen, user]);

  const handleVerifyDiscordToken = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tokenInput.trim()) {
      setError('Vui lòng nhập Discord User Token');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await questApi.verifyToken(tokenInput.trim());
      if (res.valid && res.user) {
        const authUser: AuthUser = {
          provider: 'discord',
          id: res.user.id,
          username: res.user.username,
          discriminator: res.user.discriminator,
          avatarUrl: res.user.avatarUrl,
          email: res.user.email,
          token: tokenInput.trim(),
        };
        onSaveUser(authUser);
        onClose();
      } else {
        setError(res.error || 'Token không hợp lệ hoặc đã hết hạn.');
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối đến Quest Backend (:3001)');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onSaveUser(null);
    setTokenInput('');
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Tài khoản Discord' : 'Kết nối tài khoản Discord'}
      description={
        user
          ? 'Tài khoản đang được dùng để đồng bộ và chạy nhiệm vụ.'
          : 'Dán User Token để Arychi đồng bộ nhiệm vụ. Token chỉ được lưu trong trình duyệt và gửi tới backend nội bộ localhost:3001.'
      }
    >
      {user && (
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">@{user.username}</p>
              <p className="text-xs text-emerald-400">Đã xác thực</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="btn-ghost btn-sm hover:text-rose-300">
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      )}

      <form onSubmit={handleVerifyDiscordToken} className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="discord-token" className="field-label">
              {user ? 'Thay token khác' : 'User Token'}
            </label>
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="mb-1.5 text-xs text-zinc-500 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors"
              aria-pressed={showToken}
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showToken ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          <input
            id="discord-token"
            type={showToken ? 'text' : 'password'}
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Giá trị header Authorization"
            autoComplete="off"
            spellCheck={false}
            className="input font-mono"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'discord-token-error' : undefined}
            autoFocus
          />
          {error && (
            <p id="discord-token-error" className="mt-2 text-xs text-rose-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              {error}
            </p>
          )}
        </div>

        <button type="submit" disabled={loading || !tokenInput.trim()} className="btn-primary w-full">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Đang xác thực…' : 'Xác thực và kết nối'}
        </button>
      </form>

      <details className="mt-5 group">
        <summary className="cursor-pointer list-none text-[13px] text-zinc-400 hover:text-zinc-200 select-none">
          <span className="group-open:hidden">Cách lấy User Token →</span>
          <span className="hidden group-open:inline">Cách lấy User Token</span>
        </summary>
        <ol className="mt-2 space-y-1.5 text-[13px] text-zinc-400 list-decimal pl-5 leading-relaxed">
          <li>
            Mở Discord trên Chrome hoặc Edge, nhấn <kbd className="inline-code">F12</kbd>.
          </li>
          <li>
            Vào tab <strong className="text-zinc-200 font-medium">Network</strong>, tìm request{' '}
            <code className="inline-code">/users/@me</code>.
          </li>
          <li>
            Trong <strong className="text-zinc-200 font-medium">Request Headers</strong>, sao chép giá trị{' '}
            <code className="inline-code">Authorization</code>.
          </li>
        </ol>
      </details>
    </Dialog>
  );
};

export default LoginModal;

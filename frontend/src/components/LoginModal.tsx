import React, { useState } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Check,
  Loader2,
  LogOut,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { questApi } from '../services/api';
import { AuthUser } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onSaveUser: (user: AuthUser | null) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveUser,
}) => {
  const [tokenInput, setTokenInput] = useState(user?.token || '');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyDiscordToken = async () => {
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel-elevated rounded-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 px-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center text-white shadow-glow-sm">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Xác Thực Discord Token</h3>
              <p className="text-[11px] text-slate-400">Kết nối tài khoản để tự động làm nhiệm vụ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {user && (
            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                    alt={user.username}
                    className="w-9 h-9 rounded-full border border-emerald-500/40 object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0C0E17]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white">@{user.username}</p>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                      DISCORD
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <Check className="w-3 h-3" /> Đang hoạt động
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn-danger py-1 px-3 text-xs"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng Xuất</span>
              </button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Discord User Token
                </label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showToken ? 'Ẩn' : 'Hiện'}</span>
                </button>
              </div>
              <div className="relative">
                {showToken ? (
                  <textarea
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Dán giá trị header Authorization từ Discord Web (F12 > Network)..."
                    rows={3}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                ) : (
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Dán User Token tại đây..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleVerifyDiscordToken}
              disabled={loading || !tokenInput.trim()}
              className="w-full btn-primary py-2.5 text-xs shadow-glow-sm"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>Xác Thực &amp; Kết Nối Tài Khoản</span>
            </button>
          </div>

          <div className="p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.04] text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
            <p className="font-semibold text-slate-300">Cách lấy Discord User Token:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
              <li>Mở Discord trên trình duyệt Chrome/Edge và ấn <kbd className="font-mono bg-white/[0.06] px-1 rounded">F12</kbd>.</li>
              <li>Chuyển qua tab <strong>Network</strong>, tìm kiếm request <code className="text-indigo-400 font-mono">/users/@me</code>.</li>
              <li>Tại mục <strong>Request Headers</strong>, sao chép giá trị của trường <code className="text-indigo-400 font-mono">Authorization</code>.</li>
            </ol>
            <p className="text-[10px] text-slate-500 pt-1">
              Token chỉ được lưu cục bộ trên trình duyệt máy của bạn và gửi thẳng về backend nội bộ localhost:3001.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

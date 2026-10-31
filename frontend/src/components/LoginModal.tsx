import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Globe, Loader2, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { questApi } from '../services/api';
import { AuthUser, UserSubscription } from '../types';
import { Dialog, SegmentedControl } from './ui';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onSaveAuth: (user: AuthUser | null, sessionToken: string, subscription: UserSubscription | null) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveAuth,
}) => {
  const [provider, setProvider] = useState<'discord' | 'google'>('discord');
  const [discordUsername, setDiscordUsername] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (user) {
        setProvider(user.provider === 'google' ? 'google' : 'discord');
        setDiscordUsername(user.username || '');
        setDiscordId(user.id || '');
        setGoogleEmail(user.email || '');
        setGoogleName(user.username || '');
      }
    }
  }, [isOpen, user]);

  const handleOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (provider === 'discord') {
      if (!discordUsername.trim()) {
        setError('Vui lòng nhập Discord Username hoặc ID để ủy quyền qua Bot Discord OAuth2');
        return;
      }
    } else {
      if (!googleEmail.trim() || !googleEmail.includes('@')) {
        setError('Vui lòng nhập địa chỉ Gmail hợp lệ để đăng ký / đăng nhập');
        return;
      }
    }

    setLoading(true);
    try {
      const payload =
        provider === 'discord'
          ? {
              provider: 'discord' as const,
              username: discordUsername.trim().replace(/^@/, ''),
              id: discordId.trim() || undefined,
            }
          : {
              provider: 'google' as const,
              email: googleEmail.trim(),
              username: googleName.trim() || googleEmail.trim().split('@')[0],
            };

      const res = await questApi.oauthLogin(payload);
      const authUser: AuthUser = {
        ...res.account,
        sessionToken: res.sessionToken,
        token: res.account.tokens?.questToken || '',
      };
      onSaveAuth(authUser, res.sessionToken, res.subscription);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối máy chủ xác thực OAuth2 (:3001)');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onSaveAuth(null, '', null);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Tài khoản đã đăng nhập (OAuth2)' : 'Đăng nhập OAuth2 — arychi.xyz'}
      description="Đăng nhập bằng Bot Discord (OAuth2) hoặc đăng ký bằng Tài khoản Google để mua gói 50.000đ/tháng và truy cập dash.arychi.xyz."
    >
      {user && (
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
          <div className="flex items-center gap-3 min-w-0">
            <div className="icon-badge">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                @{user.username}{' '}
                <span className="text-xs font-mono text-blue-300">
                  ({user.provider === 'google' ? 'Google OAuth2' : 'Discord Bot OAuth2'})
                </span>
              </p>
              <p className="text-xs text-slate-300 truncate">{user.email || `ID: ${user.id}`}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-ghost btn-sm hover:text-rose-300 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      )}

      <div className="mb-4">
        <SegmentedControl
          ariaLabel="Phương thức đăng nhập OAuth2"
          value={provider}
          onChange={(v) => {
            setProvider(v);
            setError(null);
          }}
          options={[
            { value: 'discord', label: 'Bot Discord (OAuth2)' },
            { value: 'google', label: 'Tài khoản Google' },
          ]}
        />
      </div>

      <form onSubmit={handleOAuthSubmit} className="space-y-4">
        {provider === 'discord' ? (
          <>
            <div className="p-3 rounded-lg bg-[#141722] border border-line space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Ủy quyền qua Bot Discord (OAuth2)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Xác thực định danh Discord với Bot của Arychi. Bạn chưa cần nhập Token ở bước này (Token được nhập riêng trong trang quản trị dash.arychi.xyz).
              </p>
            </div>

            <div>
              <label htmlFor="oauth-discord-username" className="field-label">
                Discord Username
              </label>
              <input
                id="oauth-discord-username"
                type="text"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                placeholder="Ví dụ: arychi_user"
                className="input"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="oauth-discord-id" className="field-label">
                Discord User ID (Tùy chọn)
              </label>
              <input
                id="oauth-discord-id"
                type="text"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="Ví dụ: 109283746519283746"
                className="input font-mono"
              />
              <p className="field-hint">
                Hệ thống lưu tài khoản và thời hạn gói vào Database theo Discord ID của bạn.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 rounded-lg bg-[#141722] border border-line space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                <Globe className="w-4 h-4 shrink-0" />
                <span>Đăng ký / Đăng nhập bằng Tài khoản Google</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sử dụng Gmail để khởi tạo tài khoản Arychi và quản lý gói thuê bao 50.000đ/tháng trên Database.
              </p>
            </div>

            <div>
              <label htmlFor="oauth-google-email" className="field-label">
                Địa chỉ Email Google (Gmail)
              </label>
              <input
                id="oauth-google-email"
                type="email"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="input"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="oauth-google-name" className="field-label">
                Tên hiển thị
              </label>
              <input
                id="oauth-google-name"
                type="text"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                placeholder="Tên tài khoản của bạn"
                className="input"
              />
            </div>
          </>
        )}

        {error && (
          <p className="text-xs text-rose-300 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>
            {loading
              ? 'Đang xác thực OAuth2 & đồng bộ Database…'
              : provider === 'discord'
              ? 'Đăng nhập bằng Bot Discord (OAuth2)'
              : 'Đăng ký / Tiếp tục với Google'}
          </span>
        </button>
      </form>
    </Dialog>
  );
};

export default LoginModal;

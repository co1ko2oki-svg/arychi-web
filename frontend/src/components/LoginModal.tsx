import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  LogOut,
  PlusCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
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
  const [discordTokenInput, setDiscordTokenInput] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oauthConfig, setOAuthConfig] = useState<{
    discordConfigured: boolean;
    discordClientId: string | null;
    discordAuthUrl: string | null;
    discordBotInviteUrl: string | null;
    googleAuthUrl: string | null;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      questApi.getOAuthConfig()
        .then((res) => setOAuthConfig(res.oauth))
        .catch(() => {
          setOAuthConfig({
            discordConfigured: false,
            discordClientId: null,
            discordAuthUrl: null,
            discordBotInviteUrl: null,
            googleAuthUrl: null,
          });
        });
    }
  }, [isOpen]);

  const handleDiscordOAuthRedirect = () => {
    if (oauthConfig?.discordAuthUrl) {
      window.location.href = oauthConfig.discordAuthUrl;
    } else {
      setError('Chưa cấu hình DISCORD_CLIENT_ID trong .env. Bạn có thể xác thực bằng Discord Token bên dưới.');
    }
  };

  const handleDirectTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const token = discordTokenInput.trim();
    if (!token) {
      setError('Vui lòng dán Discord User Token để xác thực tài khoản và kết nối Bot.');
      return;
    }

    setLoading(true);
    try {
      const res = await questApi.oauthLogin({
        provider: 'discord',
        accessToken: token,
      });

      const authUser: AuthUser = {
        ...res.account,
        sessionToken: res.sessionToken,
        token: token,
      };

      onSaveAuth(authUser, res.sessionToken, res.subscription);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể xác thực Discord Token qua máy chủ nội bộ');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!googleEmail.trim() || !googleEmail.includes('@')) {
      setError('Vui lòng nhập địa chỉ Gmail hợp lệ để đăng ký / đăng nhập');
      return;
    }

    setLoading(true);
    try {
      const res = await questApi.oauthLogin({
        provider: 'google',
        email: googleEmail.trim(),
        username: googleName.trim() || googleEmail.trim().split('@')[0],
      });

      const authUser: AuthUser = {
        ...res.account,
        sessionToken: res.sessionToken,
        token: res.account.tokens?.questToken || '',
      };

      onSaveAuth(authUser, res.sessionToken, res.subscription);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối máy chủ xác thực (:3001)');
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
      title={user ? 'Tài khoản Discord đã kết nối' : 'Đăng nhập kết nối Bot Discord (OAuth2)'}
      description="Kết nối tài khoản Discord như ứng dụng mở rộng (Linked App / Bot Extension) để mua gói 20.000đ/tháng và truy cập hệ thống quản trị dash.arychi.xyz."
    >
      {user && (
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
          <div className="flex items-center gap-3 min-w-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-10 h-10 rounded-full border border-line shrink-0"
              />
            ) : (
              <div className="icon-badge">
                <UserCheck className="w-5 h-5 text-blue-400" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white truncate">@{user.username}</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  <Bot className="w-3 h-3" />
                  Bot Linked
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate font-mono">
                {user.email || `Discord ID: ${user.id}`}
              </p>
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

      {user ? (
        <div className="space-y-3">
          <div className="p-3.5 rounded-lg bg-[#0E1017] border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Cổng đăng nhập:</span>
              <span className="text-xs font-mono font-medium text-white">
                {user.provider === 'google' ? 'Google OAuth2' : 'Discord Bot Application'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Trạng thái Database:</span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu vào commercial_db.json
              </span>
            </div>
          </div>

          {oauthConfig?.discordBotInviteUrl && (
            <a
              href={oauthConfig.discordBotInviteUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary w-full justify-center flex items-center gap-2 text-xs"
            >
              <PlusCircle className="w-4 h-4 text-blue-400" />
              <span>Thêm Bot Arychi vào Server Discord của bạn</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn-primary w-full justify-center text-xs"
          >
            Đóng bảng xác thực
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <SegmentedControl
            ariaLabel="Phương thức kết nối"
            value={provider}
            onChange={(v) => {
              setProvider(v);
              setError(null);
            }}
            options={[
              { value: 'discord', label: 'Bot Discord (Ứng dụng mở rộng)' },
              { value: 'google', label: 'Tài khoản Google' },
            ]}
          />

          {provider === 'discord' ? (
            <div className="space-y-4">
              {/* Primary OAuth2 Bot Login Button */}
              {oauthConfig?.discordConfigured && oauthConfig.discordAuthUrl ? (
                <div className="p-4 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-[#5865F2] flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">
                        Ủy quyền ứng dụng Discord Bot
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Đăng nhập trực tiếp bằng tài khoản Discord thông qua Bot Arychi (OAuth2 Identify & Guilds).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDiscordOAuthRedirect}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Đăng nhập bằng Discord (Bot OAuth2)</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </button>
                </div>
              ) : null}

              {/* Direct Token Fallback or Secondary Mode */}
              <form onSubmit={handleDirectTokenLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="discord-token-auth" className="field-label flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                      <span>{oauthConfig?.discordConfigured ? 'Hoặc xác thực bằng Discord User Token' : 'Xác thực tài khoản bằng Discord User Token'}</span>
                    </label>
                  </div>
                  <input
                    id="discord-token-auth"
                    type="password"
                    value={discordTokenInput}
                    onChange={(e) => setDiscordTokenInput(e.target.value)}
                    placeholder="Dán token Discord (ví dụ: MTAwMj...)"
                    className="input font-mono text-xs"
                    autoFocus={!oauthConfig?.discordConfigured}
                  />
                  <p className="field-hint">
                    Hệ thống gọi API Discord (<code className="text-blue-300">/users/@me</code>) để lấy profile thật, lưu vào <code className="text-blue-300">commercial_db.json</code> và liên kết phiên làm việc.
                  </p>
                </div>

                {error && (
                  <p className="text-xs text-rose-300 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !discordTokenInput.trim()}
                  className="btn-primary w-full justify-center"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Đang xác thực qua Discord API…' : 'Xác thực & Kết nối Bot Discord'}</span>
                </button>
              </form>

              {oauthConfig?.discordBotInviteUrl && (
                <div className="pt-2 border-t border-line">
                  <a
                    href={oauthConfig.discordBotInviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-raised hover:bg-overlay border border-line text-xs text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
                    <span>Thêm Bot Arychi vào máy chủ Discord</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* Google OAuth Form */
            <form onSubmit={handleGoogleSubmit} className="space-y-4">
              <div className="p-3 rounded-lg bg-[#141722] border border-line space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Đăng ký / Đăng nhập bằng Tài khoản Google</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sử dụng Gmail để khởi tạo tài khoản Arychi và quản lý gói thuê bao 20.000đ/tháng trên Database.
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

              {error && (
                <p className="text-xs text-rose-300 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{loading ? 'Đang đồng bộ Database…' : 'Đăng ký / Tiếp tục với Google'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </Dialog>
  );
};

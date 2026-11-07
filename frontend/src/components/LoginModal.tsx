import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  PlusCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { questApi } from '../services/api';
import { AuthUser, UserSubscription } from '../types';
import { Dialog } from './ui';
import { DiscordIcon } from './Navbar';
import { useToast } from './Toast';

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
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'oauth' | 'token'>('oauth');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  const [oauthConfig, setOAuthConfig] = useState<{
    discordConfigured: boolean;
    discordClientId: string | null;
    discordAuthUrl: string | null;
    discordBotInviteUrl: string | null;
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
          });
        });
    }
  }, [isOpen]);

  const handleDiscordOAuthRedirect = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal && oauthConfig?.discordAuthUrl) {
      window.location.href = oauthConfig.discordAuthUrl;
      return;
    }
    const clientId = oauthConfig?.discordClientId || '1566061523636330497';
    const redirectUri = window.location.origin;
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=identify+guilds+guilds.join+email`;
  };

  const handleDirectTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Vui lòng nhập Discord User Token');
      return;
    }
    setError(null);
    setTokenLoading(true);
    try {
      const res = await questApi.oauthLogin({ accessToken: tokenInput.trim() });
      onSaveAuth(res.account, res.sessionToken, res.subscription);
      toast.success(`Đã kết nối tài khoản Discord: @${res.account.username}`);
      setTokenInput('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Token Discord không hợp lệ hoặc đã hết hạn');
    } finally {
      setTokenLoading(false);
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
      title={user ? 'Tài khoản Discord đã kết nối' : 'Đăng nhập tài khoản Discord'}
      description="Đăng nhập tài khoản Discord để đồng bộ và truy cập bảng điều khiển."
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
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  <Bot className="w-3 h-3" />
                  Discord Linked
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
            className="btn-ghost btn-sm hover:text-rose-300 shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      )}

      {user ? (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[#0E1017] border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Cổng đăng nhập:</span>
              <span className="text-xs font-mono font-medium text-purple-300">
                Discord Bot OAuth2
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Trạng thái tài khoản:</span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã kết nối an toàn 💖
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
            className="btn-primary w-full justify-center text-xs cursor-pointer"
          >
            Đóng bảng xác thực
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Method Selector Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0E1017] border border-[#1E2230] text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setLoginMethod('oauth'); setError(null); }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                loginMethod === 'oauth'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DiscordIcon className={`w-3.5 h-3.5 ${loginMethod === 'oauth' ? 'text-black' : 'text-slate-400'}`} />
              <span>Discord OAuth2</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('token'); setError(null); }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                loginMethod === 'token'
                  ? 'bg-[#72b991] text-[#111714] shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Token Discord</span>
            </button>
          </div>

          {loginMethod === 'oauth' ? (
            /* Pure Discord OAuth2 Login Card */
            <div className="p-4 rounded-xl bg-white/[0.04] border border-[#1E2230] space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <DiscordIcon className="w-5 h-5 text-black" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">
                    Ủy quyền ứng dụng Discord (OAuth2)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Đăng nhập trực tiếp bằng tài khoản Discord của bạn (tự động điều hướng về màn hình ứng dụng an toàn).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDiscordOAuthRedirect}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-[#F2F3F5] text-black text-xs font-bold flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-95 shadow-sm border border-white/40 cursor-pointer"
              >
                <DiscordIcon className="w-4 h-4 text-black shrink-0" />
                <span>Đăng nhập bằng Discord OAuth2</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-auto text-black" />
              </button>
            </div>
          ) : (
            /* Direct Token Login Form */
            <form onSubmit={handleDirectTokenLogin} className="p-4 rounded-xl bg-white/[0.04] border border-[#1E2230] space-y-3.5">
              <div className="space-y-1">
                <label htmlFor="direct-token-input" className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#72b991]" />
                  <span>Dán User Token Discord</span>
                </label>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Đăng nhập tức thì 1 giây bằng Token cá nhân, không cần qua chuyển hướng hay DNS tên miền.
                </p>
              </div>

              <input
                id="direct-token-input"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Dán mã Discord Token của bạn tại đây..."
                className="input font-mono text-xs w-full"
                autoComplete="off"
              />

              <button
                type="submit"
                disabled={tokenLoading || !tokenInput.trim()}
                className="btn-primary w-full justify-center text-xs font-bold py-2.5 cursor-pointer disabled:opacity-50"
              >
                {tokenLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xác thực Token...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đăng nhập ngay</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Workflow Guide: Login First, Enter Tokens on Dash */}
          <div className="p-3.5 rounded-lg bg-[#0E1017] border border-[#1E2230] space-y-2 text-xs">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Quy trình hoạt động:</span>
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex items-start gap-2">
                <span className="font-mono text-blue-300 font-bold">1.</span>
                <span>Đăng nhập bằng Discord OAuth2 để kết nối tài khoản.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-blue-300 font-bold">2.</span>
                <span>Chuyển sang trung tâm điều khiển Dashboard để nhập Token Quest &amp; Token Stream.</span>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-300 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </p>
          )}

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
      )}
    </Dialog>
  );
};

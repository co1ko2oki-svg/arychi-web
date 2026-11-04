import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cookie,
  Eye,
  EyeOff,
  Flame,
  Gamepad2,
  KeyRound,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { AccountTokens, AuthUser } from '../types';
import { questApi } from '../services/api';
import { useToast } from './Toast';
import { PageHeader, StatusDot } from './ui';

const PRESET_HOURS = [
  { value: 50, label: '50h' },
  { value: 100, label: '100h' },
  { value: 250, label: '250h' },
  { value: 500, label: '500h' },
  { value: 1000, label: '1.000h' },
];

interface BadgeDashboardProps {
  user?: AuthUser | null;
  sessionToken?: string;
  token?: string;
  onSaveQuestToken?: (newToken: string, updatedTokens?: Partial<AccountTokens>) => void;
  onOpenLoginModal?: () => void;
}

export const BadgeDashboard: React.FC<BadgeDashboardProps> = ({
  user = null,
  token = '',
  onSaveQuestToken,
}) => {
  const { toast } = useToast();

  // Credentials state (Token + Cookie)
  const [tokenInput, setTokenInput] = useState(() => {
    return token || user?.tokens?.questToken || localStorage.getItem('arychi_discord_token') || '';
  });
  const [cookieInput, setCookieInput] = useState(() => {
    return localStorage.getItem('arychi_discord_cookie') || '';
  });
  const [showToken, setShowToken] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  // Playtime settings
  const [hours, setHours] = useState<number>(100);
  const [customHours, setCustomHours] = useState<string>('100');

  // Boosting state
  const [isBoosting, setIsBoosting] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Sync token prop from parent
  useEffect(() => {
    if (token && !tokenInput) {
      setTokenInput(token);
    }
  }, [token]);

  // Active token computation (only real non-empty string)
  const activeToken = (tokenInput.trim() || token || user?.tokens?.questToken || '').trim();
  const hasValidToken = Boolean(activeToken && !activeToken.includes('...'));
  const hasCookie = Boolean(cookieInput.trim() && !cookieInput.includes('...'));

  // Check active boost job ONLY if user actually has a real token
  useEffect(() => {
    if (!hasValidToken) {
      setIsBoosting(false);
      setActiveJob(null);
      return;
    }

    questApi
      .getBadgeStatus(activeToken)
      .then((res) => {
        if (res.job && res.running) {
          setIsBoosting(true);
          setActiveJob(res.job);
        } else {
          setIsBoosting(false);
          setActiveJob(null);
        }
      })
      .catch(() => {
        setIsBoosting(false);
        setActiveJob(null);
      });
  }, [hasValidToken, activeToken]);

  const handleSaveCredentials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const tok = tokenInput.trim();
    const cook = cookieInput.trim();

    if (!tok) {
      toast.warning('Vui lòng nhập Discord User Token trước khi bấm Lưu');
      return;
    }

    setSavingCreds(true);
    try {
      await questApi.saveBadgeCredentials({
        token: tok,
        cookie: cook,
      });

      localStorage.setItem('arychi_discord_token', tok);
      onSaveQuestToken?.(tok, { questToken: tok });

      if (cook) {
        localStorage.setItem('arychi_discord_cookie', cook);
      } else {
        localStorage.removeItem('arychi_discord_cookie');
      }

      toast.success('Đã lưu Token & Cookie thành công! ✨');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu thông tin xác thực');
    } finally {
      setSavingCreds(false);
    }
  };

  const handleHourPreset = (h: number) => {
    setHours(h);
    setCustomHours(String(h));
  };

  const handleCustomHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomHours(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 5000) {
      setHours(parsed);
    }
  };

  // NÚT 1: Cày giờ chơi hồ sơ
  const handleStartPlaytime = async () => {
    if (!hasValidToken) {
      toast.warning('Vui lòng nhập và lưu Discord User Token ở phía trên trước');
      return;
    }

    setLoadingAction('playtime');
    try {
      const res = await questApi.startBadgeFarm({
        token: activeToken,
        mode: 'playtime',
        hours,
        games: [],
        cookie: cookieInput.trim() || undefined,
      });

      setIsBoosting(true);
      setActiveJob(res.job);
      toast.success(`Đã kích hoạt cày ${hours} giờ chơi cho toàn bộ kho game! ✨`);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể kích hoạt cày giờ chơi');
    } finally {
      setLoadingAction(null);
    }
  };

  // NÚT 2: Đánh dấu 1.000+ game đã chơi
  const handleMarkPlayed = async () => {
    if (!hasValidToken) {
      toast.warning('Vui lòng nhập và lưu Discord User Token ở phía trên trước');
      return;
    }

    setLoadingAction('played');
    try {
      const res = await questApi.startBadgeFarm({
        token: activeToken,
        mode: 'played',
        hours: 1,
        games: [],
        cookie: cookieInput.trim() || undefined,
      });

      setIsBoosting(true);
      setActiveJob(res.job);
      toast.success('Đã bắt đầu đánh dấu 1.000+ game vào hồ sơ Discord! ✨');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể đánh dấu game');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStopBoosting = async () => {
    setLoadingAction('stop');
    try {
      await questApi.stopBadgeFarm(activeToken);
      setIsBoosting(false);
      setActiveJob(null);
      toast.info('Đã tạm dừng tiến trình');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể dừng tiến trình');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cày Giờ Chơi &amp; Game Hồ Sơ 🎮"
        description="Tự động tăng số giờ chơi và mở khóa hơn 1.000+ tựa game hiển thị lung linh trên hồ sơ Discord cá nhân của bạn."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1a231f] border border-[#2d3b33] text-xs font-mono text-[#8e96e8]">
              <Sparkles className="w-3.5 h-3.5" />
              Tự động 1.000+ Game
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1a231f] border border-[#2d3b33] text-xs font-mono text-[#72b991]">
              <StatusDot tone="ok" />
              Chạy nền máy chủ 24/7
            </span>
          </>
        }
      />

      {/* Active Boost Banner - ONLY shown if real token is active and job is running */}
      {hasValidToken && isBoosting && activeJob && (
        <div className="surface p-4 border border-[#72b991]/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#72b991] shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#f2f5f1]">
                  {activeJob.mode === 'played'
                    ? 'Đang đánh dấu 1.000+ game vào hồ sơ'
                    : `Đang cày ${activeJob.targetHours || hours} giờ chơi cho toàn bộ game`}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#72b991]/15 text-[#72b991] text-[11px] font-mono font-semibold">
                  ĐANG CHẠY
                </span>
              </div>
              <p className="text-xs text-[#9aa8a0] truncate mt-0.5">
                {activeJob.statusMessage || 'Hệ thống đang gửi tín hiệu phiên chơi định kỳ cho Discord.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStopBoosting}
            disabled={loadingAction === 'stop'}
            className="btn-danger btn-sm shrink-0"
          >
            {loadingAction === 'stop' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            <span>Tạm dừng</span>
          </button>
        </div>
      )}

      {/* Credentials Form (Token + Cookie) */}
      <form onSubmit={handleSaveCredentials} className="surface p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d3b33] pb-3">
          <div>
            <span className="eyebrow text-[#8e96e8]">Xác thực tài khoản</span>
            <h2 className="text-base font-bold text-[#f2f5f1] mt-0.5">
              Cấu hình Token &amp; Cookie Discord
            </h2>
            <p className="text-xs text-[#9aa8a0] mt-0.5">
              Cung cấp Token và Cookie để máy chủ gửi telemetry đồng bộ giờ chơi.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 text-[#9aa8a0]">
              <StatusDot tone={hasValidToken ? 'ok' : 'error'} />
              {hasValidToken ? 'Token Sẵn Sàng' : 'Thiếu Token'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#9aa8a0]">
              <StatusDot tone={hasCookie ? 'ok' : 'warn'} />
              {hasCookie ? 'Cookie Sẵn Sàng' : 'Chưa có Cookie'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="badge-token" className="field-label flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#8e96e8]" />
                <span>Discord User Token (Bắt buộc)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="text-[11px] text-[#8e96e8] hover:text-[#f2f5f1] flex items-center gap-1"
              >
                {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showToken ? 'Ẩn' : 'Hiện'}</span>
              </button>
            </div>
            <input
              id="badge-token"
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Dán Discord User Token của bạn..."
              className="input font-mono text-xs"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="badge-cookie" className="field-label flex items-center gap-1.5">
                <Cookie className="w-3.5 h-3.5 text-[#72b991]" />
                <span>Discord Cookie (cf_clearance - Khuyên dùng)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCookie((v) => !v)}
                className="text-[11px] text-[#72b991] hover:text-[#f2f5f1] flex items-center gap-1"
              >
                {showCookie ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showCookie ? 'Ẩn' : 'Hiện'}</span>
              </button>
            </div>
            <input
              id="badge-cookie"
              type={showCookie ? 'text' : 'password'}
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              placeholder="Dán cf_clearance hoặc toàn bộ cookie Discord..."
              className="input font-mono text-xs"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-[#9aa8a0] font-mono">
            {!hasValidToken ? (
              <span className="text-[#d7ad69]">⚠️ Vui lòng nhập Token Discord trước khi khởi chạy</span>
            ) : (
              <span className="text-[#72b991]">✓ Token sẵn sàng, bạn có thể khởi chạy cày giờ chơi</span>
            )}
          </p>

          <button
            type="submit"
            disabled={savingCreds || !tokenInput.trim()}
            className="btn-primary btn-sm px-4"
          >
            {savingCreds ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Lưu Thông Tin Xác Thực</span>
          </button>
        </div>
      </form>

      {/* 2 Simple Action Cards (As requested by user: "chỉ cần nút chạy 2 cái thoi") */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NÚT 1: Cày giờ chơi hồ sơ */}
        <div className="surface p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg bg-[#161e1a] border border-[#2d3b33] flex items-center justify-center text-[#8e96e8]">
                <Clock className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#8e96e8]/15 border border-[#8e96e8]/30 text-[#8e96e8] text-xs font-mono font-semibold">
                Toàn bộ 1.000+ Game
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-[#f2f5f1]">Cày Giờ Chơi Hồ Sơ</h3>
              <p className="text-xs text-[#9aa8a0] mt-1 leading-relaxed">
                Gửi tín hiệu giữ phiên chơi ngầm định kỳ cho toàn bộ kho 1.000+ tựa game để tăng số giờ chơi hiển thị lung linh trên Discord cá nhân.
              </p>
            </div>

            {/* Hour presets */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-[#9aa8a0]">
                <span>Chọn số giờ cày:</span>
                <span className="font-mono text-[#8e96e8]">
                  Mục tiêu: <strong className="text-[#f2f5f1]">{hours} giờ</strong>
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {PRESET_HOURS.map((p) => {
                  const isSel = hours === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handleHourPreset(p.value)}
                      className={`py-1.5 rounded-lg text-center text-xs font-semibold border transition-all ${
                        isSel
                          ? 'bg-[#8e96e8] text-[#111714] border-[#8e96e8]'
                          : 'bg-[#161e1a] text-[#9aa8a0] border-[#2d3b33] hover:text-[#f2f5f1] hover:border-[#3b4c42]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-[#9aa8a0] shrink-0">Hoặc tự nhập:</span>
                <input
                  type="text"
                  value={customHours}
                  onChange={handleCustomHoursChange}
                  placeholder="100"
                  className="input font-mono text-xs h-7 w-20 text-center"
                />
                <span className="text-[#9aa8a0]">(Từ 1 đến 5.000 giờ)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartPlaytime}
            disabled={loadingAction === 'playtime' || !hasValidToken}
            className="btn-primary h-10 w-full font-semibold"
          >
            {loadingAction === 'playtime' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>Bắt đầu cày {hours}h (1.000+ Game) ✨</span>
          </button>
        </div>

        {/* NÚT 2: Đánh dấu 1.000+ game đã chơi */}
        <div className="surface p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg bg-[#161e1a] border border-[#2d3b33] flex items-center justify-center text-[#72b991]">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#72b991]/15 border border-[#72b991]/30 text-[#72b991] text-xs font-mono font-semibold">
                Đánh Dấu 1-Click
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-[#f2f5f1]">Đánh Dấu 1.000+ Game Đã Chơi</h3>
              <p className="text-xs text-[#9aa8a0] mt-1 leading-relaxed">
                Đánh dấu toàn bộ 1.000+ tựa game trong hệ thống là đã từng chơi trên tài khoản để mở khóa danh sách game khổng lồ trong trang cá nhân Discord mà không cần mở game thật.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#2d3b33] text-xs font-mono">
              <div className="flex items-center justify-between text-[#9aa8a0]">
                <span>Số lượng game:</span>
                <span className="text-[#f2f5f1] font-semibold">Hơn 1.000+ tựa game</span>
              </div>
              <div className="flex items-center justify-between text-[#9aa8a0]">
                <span>Thời gian mô phỏng:</span>
                <span className="text-[#72b991]">1 phút / game (Tự động)</span>
              </div>
              <div className="flex items-center justify-between text-[#9aa8a0]">
                <span>Kết quả hồ sơ:</span>
                <span className="text-[#8e96e8]">Hiện danh sách game Discord</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMarkPlayed}
            disabled={loadingAction === 'played' || !hasValidToken}
            className="btn-mint h-10 w-full font-semibold"
          >
            {loadingAction === 'played' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Đánh dấu 1.000+ Game đã chơi ✨</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BadgeDashboard;

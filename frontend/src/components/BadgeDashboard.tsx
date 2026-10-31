import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { AccountTokens, AuthUser, PlanTierId, UserSubscription } from '../types';
import { questApi } from '../services/api';
import { useToast } from './Toast';
import { PageHeader, SegmentedControl, StatusDot } from './ui';

type Mode = 'playtime' | 'played' | 'both';

const modeDescription: Record<Mode, string> = {
  playtime: 'Gửi heartbeat liên tục để cộng số giờ chơi vào hồ sơ.',
  played: 'Đánh dấu 1.000 game là đã chơi, không cộng giờ.',
  both: 'Cộng giờ chơi và đánh dấu thêm 500 game đã chơi.',
};

interface BadgeDashboardProps {
  user?: AuthUser | null;
  subscription?: UserSubscription | null;
  sessionToken?: string;
  token?: string;
  onSaveQuestToken?: (newToken: string, updatedTokens?: Partial<AccountTokens>) => void;
  onOpenLoginModal?: () => void;
  onOpenSubscriptionModal?: (planId?: PlanTierId) => void;
}

export const BadgeDashboard: React.FC<BadgeDashboardProps> = ({
  user = null,
  subscription = null,
  sessionToken = '',
  token = '',
  onSaveQuestToken,
  onOpenLoginModal = () => {},
  onOpenSubscriptionModal = () => {},
}) => {
  const { toast } = useToast();
  const [tokenInput, setTokenInput] = useState(token || user?.tokens?.questToken || '');
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hours, setHours] = useState('50');
  const [threads, setThreads] = useState('2');
  const [mode, setMode] = useState<Mode>('playtime');

  useEffect(() => {
    if (token) {
      setTokenInput(token);
    } else if (user?.tokens?.questToken) {
      setTokenInput(user.tokens.questToken);
    }
  }, [token, user?.tokens?.questToken]);

  const parsedHours = Math.max(1, Math.min(5000, parseInt(hours, 10) || 1));
  const parsedThreads = Math.max(1, Math.min(10, parseInt(threads, 10) || 1));

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      toast.warning('Vui lòng nhập 1 Token tài khoản Discord');
      return;
    }
    setSavingToken(true);
    try {
      const activeSession = sessionToken || user?.sessionToken || '';
      if (activeSession) {
        await questApi.saveAccountTokens(activeSession, { questToken: trimmed });
      }
      onSaveQuestToken?.(trimmed, { questToken: trimmed });
      toast.success('Đã lưu 1 Token Discord cho Science Telemetry');
    } catch (err: any) {
      toast.error(err?.message || 'Token Discord không hợp lệ');
    } finally {
      setSavingToken(false);
    }
  };

  const getCommand = () => {
    const base = 'cd badge-farm && python spoofer.py';
    if (mode === 'playtime') return `${base} --hours ${parsedHours} --threads ${parsedThreads}`;
    if (mode === 'played') return `${base} --mark-played 1000`;
    return `${base} --hours ${parsedHours} --threads ${parsedThreads} --mark-played 500`;
  };

  const copyCommand = async () => {
    if (!user) {
      toast.warning('Vui lòng đăng nhập OAuth2 trước');
      onOpenLoginModal();
      return;
    }
    if (!subscription || subscription.isActive === false) {
      toast.warning('Vui lòng kích hoạt gói 20.000đ/tháng để sử dụng Science Telemetry');
      onOpenSubscriptionModal('monthly_20k');
      return;
    }
    if (!token && !tokenInput.trim()) {
      toast.warning('Vui lòng nhập 1 Token Acc Discord ở khung cấu hình trước');
      return;
    }
    try {
      await navigator.clipboard.writeText(getCommand());
      setCopied(true);
      toast.success('Đã sao chép lệnh khởi chạy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Trình duyệt không cho phép truy cập clipboard');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Giờ chơi hồ sơ (Yêu cầu 1 Token)"
        description={
          <>
            Science Telemetry gửi sự kiện chơi game kèm chữ ký Windows PE lên{' '}
            <code className="inline-code">/api/v9/science</code> để cộng giờ chơi và mở khóa mốc game.
          </>
        }
        meta={
          <>
            <span>Module Python 3</span>
            <span>
              Script <code className="font-mono">badge-farm/spoofer.py</code>
            </span>
          </>
        }
      />

      <form onSubmit={handleSaveToken} className="surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">
              Cấu hình 1 Token Acc Discord cho Science Telemetry
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-300">
              <StatusDot tone={token ? 'ok' : 'warn'} />
              {token ? 'ĐÃ CÓ 1 TOKEN' : 'YÊU CẦU 1 TOKEN'}
            </span>
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="btn-ghost btn-sm"
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showToken ? 'Ẩn' : 'Hiện'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type={showToken ? 'text' : 'password'}
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Dán Discord User Token của tài khoản cần cày giờ chơi..."
            className="input font-mono flex-1"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={savingToken || !tokenInput.trim()}
            className="btn-primary shrink-0"
          >
            {savingToken ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Lưu Token</span>
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-x-12 gap-y-10">
        <div className="space-y-7 min-w-0">
          <fieldset>
            <legend className="field-label">Chế độ</legend>
            <div className="inline-flex p-0.5 rounded-lg border border-line">
              <SegmentedControl
                ariaLabel="Chế độ chạy"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'playtime', label: 'Cộng giờ chơi' },
                  { value: 'played', label: 'Đánh dấu đã chơi' },
                  { value: 'both', label: 'Cả hai' },
                ]}
              />
            </div>
            <p className="field-hint">{modeDescription[mode]}</p>
          </fieldset>

          {mode !== 'played' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg">
              <div>
                <label htmlFor="badge-hours" className="field-label">
                  Số giờ
                </label>
                <input
                  id="badge-hours"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5000}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="input font-mono tabular-nums"
                />
                <p className="field-hint">Từ 1 đến 5.000 giờ</p>
              </div>
              <div>
                <label htmlFor="badge-threads" className="field-label">
                  Luồng song song
                </label>
                <input
                  id="badge-threads"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  value={threads}
                  onChange={(e) => setThreads(e.target.value)}
                  className="input font-mono tabular-nums"
                />
                <p className="field-hint">Từ 1 đến 10 luồng</p>
              </div>
            </div>
          )}

          <div>
            <p className="field-label">Lệnh khởi chạy</p>
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between h-10 pl-4 pr-1.5 border-b border-line">
                <span className="text-xs text-slate-300">Terminal · thư mục gốc Arychi</span>
                <button
                  type="button"
                  onClick={copyCommand}
                  className="btn-ghost btn-sm"
                  aria-live="polite"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-blue-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <pre className="px-4 py-4 font-mono text-[13px] text-white overflow-x-auto leading-relaxed">
                <span className="text-slate-300 select-none">$ </span>
                {getCommand()}
              </pre>
            </div>
          </div>
        </div>

        <aside className="space-y-6 text-[13px] leading-relaxed">
          <div>
            <h2 className="text-[15px] font-semibold text-white mb-2">Cách hoạt động</h2>
            <p className="text-slate-300">
              Script gửi các sự kiện <code className="inline-code">launch_game</code> và{' '}
              <code className="inline-code">running_game_heartbeat</code> kèm Windows PE Fingerprint
              hợp lệ. Discord ghi nhận số giờ này vào lịch sử chơi của tài khoản mà không cần cài
              hoặc mở game thật.
            </p>
          </div>
          <div className="pl-3 border-l-2 border-blue-500">
            <p className="font-medium text-white">Kết quả hiển thị sau 24–48 giờ</p>
            <p className="mt-1 text-slate-300">
              Discord xử lý telemetry theo lô. Huy hiệu và danh sách game trên hồ sơ thường xuất
              hiện sau 24 đến 48 giờ kể từ khi gửi xong heartbeat.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default BadgeDashboard;

import React, { useState } from 'react';
import {
  ArrowRight,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Terminal,
} from 'lucide-react';
import { AuthUser, PlanTierId, QuestDTO, QuestJob, LogEntry, StreamStatus, UserSubscription } from '../types';
import { questApi, streamApi } from '../services/api';
import { useToast } from './Toast';
import { NavTabId } from './Navbar';
import { PageHeader, ProgressBar, Section, StatusDot, Switch } from './ui';
import { formatPing, levelClass, levelLabel, parseLog } from './format';

interface DashboardOverviewProps {
  user: AuthUser;
  subscription?: UserSubscription | null;
  token: string;
  questConnected: boolean;
  streamConnected: boolean;
  quests: QuestDTO[];
  jobs: Map<string, QuestJob>;
  loadingQuests: boolean;
  onRefreshQuests: () => void;
  streamStatus: StreamStatus | null;
  loadingStream: boolean;
  onRefreshStream: () => void;
  logs: LogEntry[];
  onNavigateTab: (tab: NavTabId) => void;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal?: (planId?: PlanTierId) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  user,
  subscription = null,
  token,
  questConnected,
  streamConnected,
  quests,
  jobs,
  loadingQuests,
  onRefreshQuests,
  streamStatus,
  onRefreshStream,
  logs,
  onNavigateTab,
  onOpenSubscriptionModal = () => {},
}) => {
  const { toast } = useToast();
  const [streamInput, setStreamInput] = useState('');
  const [streamActionLoading, setStreamActionLoading] = useState(false);
  const [questActionLoading, setQuestActionLoading] = useState<Record<string, boolean>>({});

  const totalQuests = quests.length;
  const runningJobs = Array.from(jobs.values()).filter(
    (j) => j.status === 'running' || j.status === 'enrolling',
  );
  const completedQuests = quests.filter((q) => q.status.completed).length;
  const claimableQuests = quests.filter((q) => q.status.completed && !q.status.claimed).length;
  const streamPlaying = Boolean(streamStatus?.stream.playing);

  const hasQuestToken = Boolean(token || user.tokens?.questToken);
  const hasStreamTokens = Boolean(
    (user.tokens?.streamMainToken && user.tokens?.streamViewerToken) ||
      (streamStatus?.config?.hasMainToken && streamStatus?.config?.hasViewerToken)
  );

  const handlePlayStream = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!hasStreamTokens) {
      toast.warning('Vui lòng vào mục Treo Stream Voice để nhập đủ 2 Token (1 Chính + 1 Phụ)');
      onNavigateTab('stream');
      return;
    }
    const query = streamInput.trim();
    if (!query) {
      toast.warning('Vui lòng nhập URL YouTube, Twitch hoặc tên file video');
      return;
    }
    setStreamActionLoading(true);
    try {
      await streamApi.playVideo(query);
      setStreamInput('');
      toast.success('Đã gửi yêu cầu phát video đến Voice Channel');
      onRefreshStream();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể phát video');
    } finally {
      setStreamActionLoading(false);
    }
  };

  const handleToggleFarm = async () => {
    if (!hasStreamTokens) {
      toast.warning('Vui lòng nhập 2 Token (1 Chính + 1 Phụ) trong mục Treo Stream trước');
      onNavigateTab('stream');
      return;
    }
    if (!streamStatus) return;
    const targetState = !streamStatus.farm.autoWatch;
    setStreamActionLoading(true);
    try {
      await streamApi.toggleFarm(targetState);
      toast.success(targetState ? 'Đã bật chế độ tự động xem kênh' : 'Đã tắt chế độ xem kênh');
      onRefreshStream();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể đổi trạng thái cày stream');
    } finally {
      setStreamActionLoading(false);
    }
  };

  const handleStartAll = async () => {
    if (!token) {
      toast.warning('Vui lòng nhập 1 Token Acc Discord trong mục Discord Quests');
      onNavigateTab('quests');
      return;
    }
    setQuestActionLoading((prev) => ({ ...prev, all: true }));
    try {
      const res = await questApi.startAllQuests(token);
      toast.success(`Đã kích hoạt ${res.startedCount || 0} nhiệm vụ`);
      onRefreshQuests();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể khởi động nhiệm vụ');
    } finally {
      setQuestActionLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleStopAll = async () => {
    setQuestActionLoading((prev) => ({ ...prev, all: true }));
    try {
      await questApi.stopAllQuests(token);
      toast.info('Đã dừng toàn bộ nhiệm vụ đang chạy');
      onRefreshQuests();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi dừng tác vụ');
    } finally {
      setQuestActionLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleStopJob = async (questId: string) => {
    setQuestActionLoading((prev) => ({ ...prev, [questId]: true }));
    try {
      await questApi.stopQuest(token, questId);
      toast.info('Đã dừng tác vụ');
      onRefreshQuests();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể dừng tác vụ');
    } finally {
      setQuestActionLoading((prev) => ({ ...prev, [questId]: false }));
    }
  };

  const recentLogs = logs.slice(-6).reverse();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bảng điều khiển — dash.arychi.xyz"
        description="Đã xác minh gói 20.000đ/tháng lần thứ 2 từ Database. Quản lý Token cho từng module bên cột trái."
        meta={
          <>
            <span className="text-white font-semibold">@{user.username}</span>
            <span className="inline-flex items-center gap-1.5 text-blue-300 font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              Gói 20k/tháng (Còn {subscription?.daysRemaining ?? 30} ngày)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest :3001 {questConnected ? 'Online' : 'Offline'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={streamConnected ? (streamPlaying ? 'error' : 'ok') : 'warn'} />
              Stream :3000 {streamConnected ? (streamPlaying ? 'Live' : 'Standby') : 'Offline'}
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => onOpenSubscriptionModal('monthly_20k')}
              className="btn-secondary"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              <span>Gia hạn (+20k/tháng)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRefreshQuests();
                onRefreshStream();
                toast.info('Đã đồng bộ dữ liệu');
              }}
              disabled={loadingQuests}
              className="btn-ghost"
            >
              <RefreshCw className={`w-4 h-4 ${loadingQuests ? 'animate-spin' : ''}`} />
              Đồng bộ
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="surface p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-blue-300">
                CẤU HÌNH TOKEN 01 • QUESTS &amp; GIỜ CHƠI
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-white">
                <StatusDot tone={hasQuestToken ? 'ok' : 'warn'} />
                {hasQuestToken ? 'ĐÃ NHẬP 1 TOKEN' : 'CHƯA NHẬP TOKEN'}
              </span>
            </div>
            <h2 className="text-base font-bold text-white">
              Discord Quests &amp; Science Telemetry (1 Token)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sử dụng 1 Token tài khoản Discord để đồng bộ danh sách nhiệm vụ, gửi heartbeat 30s và cày giờ chơi hồ sơ.
            </p>
          </div>
          <div className="pt-3 border-t border-line flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300">
              {hasQuestToken ? `${totalQuests} nhiệm vụ đã đồng bộ` : 'Yêu cầu nhập 1 Token'}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('quests')}
              className="btn-primary btn-sm"
            >
              <span>{hasQuestToken ? 'Mở Discord Quests' : 'Nhập 1 Token ngay'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="surface p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-blue-300">
                CẤU HÌNH TOKEN 02 • TREO STREAM VOICE
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-white">
                <StatusDot tone={hasStreamTokens ? 'ok' : 'warn'} />
                {hasStreamTokens ? 'ĐÃ NHẬP 2 TOKEN' : 'CẦN 2 TOKEN (CHÍNH+PHỤ)'}
              </span>
            </div>
            <h2 className="text-base font-bold text-white">
              Treo Stream &amp; Viewer Farm (1 Token Chính + 1 Token Phụ)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Riêng tính năng Treo Stream bắt buộc nhập 2 Token: 1 Token Chính (phát stream) và 1 Token Phụ (xem stream).
            </p>
          </div>
          <div className="pt-3 border-t border-line flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300">
              {hasStreamTokens ? `Streamer: ${streamStatus?.bot.tag || 'Sẵn sàng'}` : 'Yêu cầu 2 Token'}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('stream')}
              className="btn-primary btn-sm"
            >
              <span>{hasStreamTokens ? 'Mở Treo Stream' : 'Nhập 2 Token Stream'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="surface-interactive p-4">
          <p className="text-xs font-medium text-slate-300">Nhiệm vụ khả dụng</p>
          <p className="mt-2 text-2xl font-bold text-white tabular-nums">{totalQuests}</p>
          <p className="mt-1 text-xs font-mono text-slate-300">Từ Discord API</p>
        </div>

        <div className="surface-interactive p-4">
          <p className="text-xs font-medium text-slate-300">Đang thực thi</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-300 tabular-nums">{runningJobs.length}</span>
            {runningJobs.length > 0 && <StatusDot tone="brand" />}
          </div>
          <p className="mt-1 text-xs font-mono text-slate-300">Heartbeat 30s</p>
        </div>

        <div className="surface-interactive p-4">
          <p className="text-xs font-medium text-slate-300">Đã hoàn thành</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">{completedQuests}</span>
            {claimableQuests > 0 && (
              <span className="text-xs text-blue-300 tabular-nums">({claimableQuests} chờ claim)</span>
            )}
          </div>
          <p className="mt-1 text-xs font-mono text-slate-300">Sẵn sàng nhận thưởng</p>
        </div>

        <div className="surface-interactive p-4">
          <p className="text-xs font-medium text-slate-300">StreamBot Voice</p>
          <p className="mt-2 text-sm font-bold text-white truncate">
            {streamPlaying ? 'Đang phát video' : streamConnected ? 'Đang chờ' : 'Ngoại tuyến'}
          </p>
          <p className="mt-1 text-xs text-slate-300 font-mono">
            Độ trễ {formatPing(streamConnected, streamStatus?.bot.ping)}
          </p>
        </div>
      </div>

      {runningJobs.length > 0 && (
        <Section
          title="Tiến trình đang chạy"
          description={`${runningJobs.length} nhiệm vụ đang gửi heartbeat đồng thời.`}
        >
          <div className="surface overflow-hidden divide-y divide-line">
            {runningJobs.map((job) => (
              <div
                key={job.questId}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot tone="brand" />
                    <p className="text-sm font-medium text-white truncate">{job.questName}</p>
                  </div>
                  <p className="text-xs text-slate-300 truncate">{job.message}</p>
                  <div className="w-full max-w-md pt-1.5 flex items-center gap-3">
                    <ProgressBar
                      value={job.progressPercent}
                      tone="brand"
                      label={`Tiến độ ${job.questName}`}
                    />
                    <span className="text-xs font-mono text-blue-300 tabular-nums shrink-0">
                      {job.progressPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStopJob(job.questId)}
                  disabled={questActionLoading[job.questId]}
                  className="btn-danger btn-sm shrink-0"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Hủy tác vụ
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-white">Treo Stream Voice (2 Token)</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Phát media trực tiếp vào kênh thoại bằng Token Chính &amp; xem bằng Token Phụ
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('stream')}
              className="link text-xs"
            >
              Cấu hình 2 Token
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handlePlayStream} className="flex gap-2">
            <input
              type="text"
              value={streamInput}
              onChange={(e) => setStreamInput(e.target.value)}
              placeholder="Nhập URL YouTube, Twitch hoặc tên file..."
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={streamActionLoading || !streamInput.trim()}
              className="btn-primary shrink-0"
            >
              {streamActionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Phát
            </button>
          </form>

          <div className="flex items-center justify-between pt-3 border-t border-line">
            <div>
              <p className="text-[13px] font-medium text-white">Viewer Farm (Token Phụ)</p>
              <p className="text-xs text-slate-300">Giữ tài khoản phụ trong voice để cày giờ xem</p>
            </div>
            <Switch
              checked={Boolean(streamStatus?.farm.autoWatch)}
              onChange={handleToggleFarm}
              disabled={streamActionLoading || !streamConnected}
              label="Bật Viewer Farm"
            />
          </div>
        </div>

        <div className="surface p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Discord Quests (1 Token)</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Tự động hóa hoàn thành nhiệm vụ Discord
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('quests')}
                className="link text-xs"
              >
                Mở bảng nhiệm vụ
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <dl className="divide-y divide-line text-[13px]">
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">Nhiệm vụ trên tài khoản</dt>
                <dd className="text-white font-mono text-xs tabular-nums">{totalQuests}</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">Chờ nhận thưởng</dt>
                <dd className="text-blue-300 font-mono text-xs tabular-nums">{claimableQuests}</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-slate-300">Quest Daemon (:3001)</dt>
                <dd className="text-xs font-mono">
                  {questConnected ? (
                    <span className="text-blue-300">Kết nối</span>
                  ) : (
                    <span className="text-rose-300">Ngoại tuyến</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex items-center gap-2">
            {runningJobs.length > 0 ? (
              <button
                type="button"
                onClick={handleStopAll}
                disabled={questActionLoading.all}
                className="btn-danger flex-1"
              >
                Dừng tất cả ({runningJobs.length})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartAll}
                disabled={questActionLoading.all}
                className="btn-primary flex-1"
              >
                Chạy toàn bộ Quests
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between px-4 h-10 border-b border-line">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-300" />
            <h2 className="text-[13px] font-medium text-white">Nhật ký sự kiện trực tiếp</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('logs')}
            className="link text-xs"
          >
            Toàn bộ nhật ký ({logs.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto leading-relaxed">
          {recentLogs.length === 0 ? (
            <p className="text-slate-300 italic py-2">Chưa có sự kiện nào được ghi nhận...</p>
          ) : (
            recentLogs.map((log, index) => {
              const p = parseLog(log);
              return (
                <div key={index} className="flex items-baseline gap-2.5 text-[11px]">
                  <span className="text-slate-300 select-none shrink-0 tabular-nums">{p.time}</span>
                  <span className={`font-semibold shrink-0 ${levelClass[p.level]}`}>
                    [{levelLabel[p.level]}]
                  </span>
                  <span className="text-slate-300 shrink-0 truncate max-w-[80px]">{p.source}</span>
                  <span className="text-white break-words min-w-0">{p.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;

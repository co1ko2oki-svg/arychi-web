import React, { useState } from 'react';
import {
  ArrowRight,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Terminal,
  Tv,
} from 'lucide-react';
import { AuthUser, QuestDTO, QuestJob, LogEntry, StreamStatus } from '../types';
import { questApi, streamApi } from '../services/api';
import { useToast } from './Toast';
import { NavTabId } from './Navbar';
import { PageHeader, ProgressBar, Section, StatusDot, Switch } from './ui';
import { formatPing, levelClass, levelLabel, parseLog } from './format';

interface DashboardOverviewProps {
  user: AuthUser;
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
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  user,
  token,
  questConnected,
  streamConnected,
  quests,
  jobs,
  loadingQuests,
  onRefreshQuests,
  streamStatus,
  loadingStream: _loadingStream,
  onRefreshStream,
  logs,
  onNavigateTab,
}) => {
  const toast = useToast();
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

  const handlePlayStream = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      toast.error(err?.message || 'Không thể phát video', 'Lỗi Stream');
    } finally {
      setStreamActionLoading(false);
    }
  };

  const handleToggleFarm = async () => {
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
        title="Tổng quan hệ thống"
        description="Giám sát vận hành 3 module: Discord Quests (:3001), StreamBot Voice (:3000) và Science Telemetry."
        meta={
          <>
            <span className="text-zinc-200">@{user.username}</span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest {questConnected ? 'Online' : 'Offline'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={streamConnected ? (streamPlaying ? 'error' : 'ok') : 'warn'} />
              Stream {streamConnected ? (streamPlaying ? 'Live' : 'Standby') : 'Offline'}
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                onRefreshQuests();
                onRefreshStream();
                toast.info('Đã đồng bộ dữ liệu');
              }}
              disabled={loadingQuests}
              className="btn-ghost"
              title="Đồng bộ dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loadingQuests ? 'animate-spin' : ''}`} />
              Đồng bộ
            </button>

            {runningJobs.length > 0 ? (
              <button
                type="button"
                onClick={handleStopAll}
                disabled={questActionLoading.all}
                className="btn-danger"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Dừng tất cả ({runningJobs.length})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartAll}
                disabled={questActionLoading.all || quests.length === 0}
                className="btn-primary"
              >
                {questActionLoading.all ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                Chạy toàn bộ Quests
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="surface p-4">
          <p className="eyebrow">Nhiệm vụ khả dụng</p>
          <p className="mt-2 text-2xl font-semibold text-white tabular-nums">{totalQuests}</p>
          <p className="mt-1 text-xs text-zinc-500">Từ Discord API</p>
        </div>

        <div className="surface p-4">
          <p className="eyebrow">Đang thực thi</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-brand-text tabular-nums">{runningJobs.length}</span>
            {runningJobs.length > 0 && <StatusDot tone="brand" />}
          </div>
          <p className="mt-1 text-xs text-zinc-500">Heartbeat 30s</p>
        </div>

        <div className="surface p-4">
          <p className="eyebrow">Đã hoàn thành</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-400 tabular-nums">{completedQuests}</span>
            {claimableQuests > 0 && (
              <span className="text-xs text-amber-400 tabular-nums">({claimableQuests} chờ claim)</span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">Sẵn sàng nhận thưởng</p>
        </div>

        <div className="surface p-4">
          <p className="eyebrow">StreamBot Voice</p>
          <p className="mt-2 text-sm font-semibold text-zinc-200 truncate">
            {streamPlaying ? 'Đang phát video' : streamConnected ? 'Đang chờ' : 'Ngoại tuyến'}
          </p>
          <p className="mt-1 text-xs text-zinc-500 font-mono">
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
              <div key={job.questId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot tone="brand" />
                    <p className="text-sm font-medium text-white truncate">{job.questName}</p>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{job.message}</p>
                  <div className="w-full max-w-md pt-1.5 flex items-center gap-3">
                    <ProgressBar value={job.progressPercent} tone="brand" label={`Tiến độ ${job.questName}`} />
                    <span className="text-xs font-mono text-brand-text tabular-nums shrink-0">
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
              <h2 className="text-[15px] font-semibold text-white">StreamBot Voice Controller</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Phát media trực tiếp vào kênh thoại qua FFmpeg</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('stream')}
              className="link text-xs"
            >
              Chi tiết
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
              {streamActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Phát
            </button>
          </form>

          <div className="flex items-center justify-between pt-3 border-t border-line">
            <div>
              <p className="text-[13px] font-medium text-zinc-200">Viewer Farm</p>
              <p className="text-xs text-zinc-500">Giữ tài khoản trong voice để cày giờ xem</p>
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
                <h2 className="text-[15px] font-semibold text-white">Quản lý nhiệm vụ</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Tự động hóa hoàn thành nhiệm vụ Discord</p>
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
                <dt className="text-zinc-500">Nhiệm vụ trên tài khoản</dt>
                <dd className="text-zinc-200 font-mono text-xs tabular-nums">{totalQuests}</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">Chờ nhận thưởng</dt>
                <dd className="text-amber-400 font-mono text-xs tabular-nums">{claimableQuests}</dd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <dt className="text-zinc-500">Quest Daemon (:3001)</dt>
                <dd className="text-xs font-mono">
                  {questConnected ? <span className="text-emerald-400">Kết nối</span> : <span className="text-rose-400">Ngoại tuyến</span>}
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('quests')}
            className="btn-secondary w-full justify-between"
          >
            <span>Xem danh sách đầy đủ ({totalQuests})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between px-4 h-10 border-b border-line">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[13px] font-medium text-zinc-200">Nhật ký sự kiện trực tiếp</h2>
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
            <p className="text-zinc-600 italic py-2">Chưa có sự kiện nào được ghi nhận...</p>
          ) : (
            recentLogs.map((log, index) => {
              const p = parseLog(log);
              return (
                <div key={index} className="flex items-baseline gap-2.5 text-[11px]">
                  <span className="text-zinc-600 select-none shrink-0 tabular-nums">{p.time}</span>
                  <span className={`font-semibold shrink-0 ${levelClass[p.level]}`}>
                    [{levelLabel[p.level]}]
                  </span>
                  <span className="text-zinc-500 shrink-0 truncate max-w-[80px]">{p.source}</span>
                  <span className="text-zinc-300 break-words min-w-0">{p.message}</span>
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

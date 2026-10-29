import React, { useState } from 'react';
import {
  Sparkles,
  Tv,
  Award,
  Terminal,
  Play,
  Square,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Radio,
  ExternalLink,
  Info,
} from 'lucide-react';
import { AuthUser, QuestDTO, QuestJob, LogEntry, StreamStatus } from '../types';
import { questApi, streamApi } from '../services/api';
import { useToast } from './Toast';
import { NavTabId } from './Navbar';

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

  const handlePlayStream = async () => {
    const query = streamInput.trim();
    if (!query) {
      toast.warning('Vui lòng nhập đường dẫn YouTube, Twitch hoặc tên file video');
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
      toast.success(`Đã kích hoạt ${res.startedCount || 0} nhiệm vụ tự động`);
      onRefreshQuests();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể khởi động toàn bộ nhiệm vụ');
    } finally {
      setQuestActionLoading((prev) => ({ ...prev, all: false }));
    }
  };

  const handleStopAll = async () => {
    setQuestActionLoading((prev) => ({ ...prev, all: true }));
    try {
      await questApi.stopAllQuests(token);
      toast.info('Đã gửi lệnh dừng toàn bộ tác vụ đang chạy');
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

  const recentLogs = logs.slice(-5).reverse();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Bảng Điều Khiển
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              <span>@{user.username}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Giám sát vận hành 3 module: Discord Quests (:3001), StreamBot Voice (:3000) và Science Telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => {
              onRefreshQuests();
              onRefreshStream();
              toast.info('Đã đồng bộ lại dữ liệu');
            }}
            disabled={loadingQuests}
            className="btn-secondary text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQuests ? 'animate-spin' : ''}`} />
            <span>Đồng Bộ</span>
          </button>

          {runningJobs.length > 0 ? (
            <button
              onClick={handleStopAll}
              disabled={questActionLoading.all}
              className="btn-danger text-xs py-2 px-4"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Dừng Tất Cả ({runningJobs.length})</span>
            </button>
          ) : (
            <button
              onClick={handleStartAll}
              disabled={questActionLoading.all || quests.length === 0}
              className="btn-primary text-xs py-2 px-4 shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chạy Toàn Bộ Quests</span>
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
        <div className="px-2 pt-2 md:pt-0">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Nhiệm Vụ Khả Dụng</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-white">{totalQuests}</span>
            <span className="text-xs font-mono text-slate-500">nhiệm vụ</span>
          </div>
        </div>

        <div className="px-2 pt-4 md:pt-0 md:pl-6">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Đang Thực Thi</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-indigo-400">{runningJobs.length}</span>
            {runningJobs.length > 0 && (
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/25">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        <div className="px-2 pt-4 md:pt-0 md:pl-6">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Đã Hoàn Thành</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-emerald-400">{completedQuests}</span>
            {claimableQuests > 0 && (
              <span className="text-[10px] font-mono text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/25">
                {claimableQuests} chờ nhận
              </span>
            )}
          </div>
        </div>

        <div className="px-2 pt-4 md:pt-0 md:pl-6">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">StreamBot Voice</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm font-bold text-white truncate max-w-[140px]">
              {streamStatus?.stream.playing ? 'Đang phát video' : streamConnected ? 'Nhàn rỗi' : 'Offline'}
            </span>
            <span className="text-xs font-mono text-slate-500">
              {streamStatus?.bot.ping ?? 0}ms
            </span>
          </div>
        </div>
      </div>

      {runningJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
              </span>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Tiến Trình Thời Gian Thực ({runningJobs.length})
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">WebSocket Sync</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runningJobs.map((job) => (
              <div
                key={job.questId}
                className="glass-panel rounded-2xl p-4 space-y-3 border-indigo-500/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="truncate">
                    <p className="text-sm font-bold text-white truncate">{job.questName}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{job.message}</p>
                  </div>
                  <button
                    onClick={() => handleStopJob(job.questId)}
                    disabled={questActionLoading[job.questId]}
                    className="btn-danger py-1 px-2.5 text-xs shrink-0"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Hủy</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>{job.currentSeconds}s / {job.targetSeconds}s</span>
                    <span className="text-indigo-400 font-bold">{job.progressPercent.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, job.progressPercent))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">StreamBot Voice Controller</h3>
                <p className="text-xs text-slate-400">Phát video vào kênh đàm thoại &amp; tự động cày giờ xem</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('stream')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
            >
              <span>Xem chi tiết</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={streamInput}
              onChange={(e) => setStreamInput(e.target.value)}
              placeholder="Nhập URL YouTube, Twitch hoặc tên file video..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handlePlayStream()}
            />
            <button
              onClick={handlePlayStream}
              disabled={streamActionLoading || !streamInput.trim()}
              className="btn-primary py-2 px-4 text-xs shrink-0"
            >
              Phát Video
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
            <div>
              <p className="font-bold text-slate-200">Viewer Farm (Xem Kênh Thoại)</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Duy trì sự hiện diện tài khoản để mở khóa huy hiệu</p>
            </div>
            <button
              onClick={handleToggleFarm}
              disabled={streamActionLoading}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                streamStatus?.farm.autoWatch
                  ? 'btn-danger py-1 px-3 text-xs'
                  : 'btn-primary py-1 px-3 text-xs'
              }`}
            >
              {streamStatus?.farm.autoWatch ? 'Đang Bật' : 'Bật Ngay'}
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Quản Lý Quests</h3>
                <p className="text-xs text-slate-400">Tự động nhận &amp; claim phần thưởng</p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-400">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Quests khả dụng:</span>
                <span className="font-bold text-white">{totalQuests}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span>Chờ nhận quà:</span>
                <span className="font-bold text-amber-400">{claimableQuests}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Trạng thái kết nối:</span>
                <span className={`font-bold ${questConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {questConnected ? 'Online :3001' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('quests')}
            className="w-full btn-secondary text-xs py-2.5 justify-between"
          >
            <span>Mở Bảng Nhiệm Vụ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Nhật Ký Sự Kiện Trực Tiếp
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('logs')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
          >
            <span>Toàn bộ ({logs.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="font-mono text-xs space-y-1.5 max-h-40 overflow-y-auto">
          {recentLogs.length === 0 ? (
            <p className="text-slate-500 italic py-2">Chưa có sự kiện nào được ghi nhận...</p>
          ) : (
            recentLogs.map((log, index) => {
              const color =
                log.level === 'error'
                  ? 'text-rose-400 font-bold'
                  : log.level === 'warn'
                  ? 'text-amber-400'
                  : log.level === 'success'
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-300';

              return (
                <div key={index} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                  <span className="text-slate-500 select-none shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`uppercase shrink-0 ${color}`}>
                    [{log.level}]
                  </span>
                  <span className="text-slate-300 break-all">{log.message}</span>
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

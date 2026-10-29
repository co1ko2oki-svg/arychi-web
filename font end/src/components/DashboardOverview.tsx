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
  Activity,
  Radio,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
} from 'lucide-react';
import { AuthUser, QuestDTO, QuestJob, LogEntry, StreamStatus } from '../types';
import { questApi, streamApi } from '../services/api';
import { useToast } from './Toast';
import { NavTabId } from './Sidebar';

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
    <div className="space-y-6">
      <div className="panel p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              Bảng Điều Khiển
            </h1>
            <span className="text-slate-600 font-light select-none text-base">/</span>
            <span className="text-xs sm:text-sm font-medium text-indigo-400">
              Giám Sát Vận Hành &amp; Điều Khiển Nhanh
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-300 border border-white/[0.06]">
              @{user.username}
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Giám sát trạng thái thực thi của 3 module: Discord Quests (:3001), StreamBot Voice (:3000) và Science Telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateTab('about')}
            className="btn-secondary text-xs"
            title="Xem giới thiệu hệ thống &amp; kiến trúc"
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Giới Thiệu</span>
          </button>

          <button
            onClick={() => {
              onRefreshQuests();
              onRefreshStream();
              toast.info('Đã đồng bộ lại dữ liệu từ các dịch vụ');
            }}
            disabled={loadingQuests}
            className="btn-secondary text-xs"
            title="Làm mới trạng thái"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQuests ? 'animate-spin' : ''}`} />
            <span>Đồng Bộ</span>
          </button>

          {runningJobs.length > 0 ? (
            <button
              onClick={handleStopAll}
              disabled={questActionLoading.all}
              className="btn-danger text-xs"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Dừng Tất Cả ({runningJobs.length})</span>
            </button>
          ) : (
            <button
              onClick={handleStartAll}
              disabled={questActionLoading.all || quests.length === 0}
              className="btn-primary text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chạy Toàn Bộ Quests</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="panel p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <div>
              <p className="text-xs font-semibold text-slate-200">Quest Engine</p>
              <p className="text-[10px] font-mono text-slate-400">Port :3001 • REST &amp; WebSocket</p>
            </div>
          </div>
          <span className={`text-[10px] font-mono font-bold ${questConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
            {questConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="panel p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
            <div>
              <p className="text-xs font-semibold text-slate-200">StreamBot Voice</p>
              <p className="text-[10px] font-mono text-slate-400">Port :3000 • yt-dlp &amp; FFmpeg</p>
            </div>
          </div>
          <span className={`text-[10px] font-mono font-bold ${streamConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {streamConnected ? (streamStatus?.stream.playing ? 'STREAMING' : 'IDLE') : 'STANDBY'}
          </span>
        </div>

        <div className="panel p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Science Telemetry</p>
              <p className="text-[10px] font-mono text-slate-400">Python 3 • PE Fingerprint</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-400">READY</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Nhiệm Vụ Khả Dụng</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-100">{totalQuests}</span>
            <span className="text-[11px] text-slate-400 font-mono">Quests</span>
          </div>
        </div>

        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Tác Vụ Đang Chạy</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl sm:text-2xl font-bold text-indigo-400">{runningJobs.length}</span>
            {runningJobs.length > 0 && (
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/30">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Đã Hoàn Thành</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl sm:text-2xl font-bold text-emerald-400">{completedQuests}</span>
            {claimableQuests > 0 && (
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {claimableQuests} chờ nhận
              </span>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <p className="text-[11px] font-medium text-slate-400">Stream Voice</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-[120px]">
              {streamStatus?.stream.playing ? 'Đang phát video' : 'Không có stream'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {streamStatus?.bot.ping ?? 0}ms
            </span>
          </div>
        </div>
      </div>

      {runningJobs.length > 0 && (
        <div className="panel p-5 space-y-3 border-indigo-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-100">
                Tiến Trình Đang Chạy Thời Gian Thực ({runningJobs.length})
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">WebSocket Sync</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {runningJobs.map((job) => (
              <div
                key={job.questId}
                className="panel-subtle p-3.5 flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-100 truncate">{job.questName}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{job.message}</p>
                  </div>
                  <button
                    onClick={() => handleStopJob(job.questId)}
                    disabled={questActionLoading[job.questId]}
                    className="btn-danger py-1 px-2.5 text-[11px] shrink-0"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Hủy</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>{job.currentSeconds}s / {job.targetSeconds}s</span>
                    <span className="text-indigo-400 font-semibold">{job.progressPercent.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-0 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, job.progressPercent))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Nhiệm Vụ Discord
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Port :3001</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tự động enroll, mô phỏng heartbeat xem video hoặc game và nhận quà tặng.
            </p>

            <div className="panel-subtle p-2.5 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Quests khả dụng:</span>
                <span className="font-semibold text-slate-200">{totalQuests}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Chờ nhận quà:</span>
                <span className="font-semibold text-amber-400">{claimableQuests}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('quests')}
            className="w-full btn-secondary justify-between text-xs"
          >
            <span>Mở Quản Lý Nhiệm Vụ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="panel p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Tv className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  StreamBot Voice
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Port :3000</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={streamInput}
                onChange={(e) => setStreamInput(e.target.value)}
                placeholder="URL YouTube, Twitch hoặc tên file..."
                className="flex-1 bg-surface-2 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handlePlayStream()}
              />
              <button
                onClick={handlePlayStream}
                disabled={streamActionLoading || !streamInput.trim()}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                Phát
              </button>
            </div>

            <div className="flex items-center justify-between panel-subtle p-2.5 text-xs">
              <div>
                <p className="font-medium text-slate-200">Viewer Farm</p>
                <p className="text-[10px] text-slate-400">Tự động xem kênh cày huy hiệu</p>
              </div>
              <button
                onClick={handleToggleFarm}
                disabled={streamActionLoading}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded transition-colors ${
                  streamStatus?.farm.autoWatch
                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                {streamStatus?.farm.autoWatch ? 'Đang Bật' : 'Đang Tắt'}
              </button>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('stream')}
            className="w-full btn-secondary justify-between text-xs"
          >
            <span>Mở Bảng Điều Khiển Stream</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="panel p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Science Spoofer
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Python 3</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Gửi telemetry giả lập lên <code className="text-indigo-400">/api/v9/science</code> để tăng giờ chơi và danh sách game trên hồ sơ Discord.
            </p>

            <div className="panel-subtle p-2.5 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Chữ ký:</span>
                <span className="text-slate-200">Windows PE Fingerprint</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Script:</span>
                <span className="text-slate-200">bage fam/spoofer.py</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('badges')}
            className="w-full btn-secondary justify-between text-xs"
          >
            <span>Cấu Hình &amp; Lệnh Chạy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Nhật Ký Sự Kiện Gần Nhất
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('logs')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <span>Xem Toàn Bộ ({logs.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="panel-subtle p-3 rounded-lg font-mono text-xs space-y-1.5 max-h-44 overflow-y-auto">
          {recentLogs.length === 0 ? (
            <p className="text-slate-500 italic py-2">Chưa có sự kiện nào được ghi nhận...</p>
          ) : (
            recentLogs.map((log, index) => {
              const color =
                log.level === 'error'
                  ? 'text-rose-400 font-semibold'
                  : log.level === 'warn'
                  ? 'text-amber-400'
                  : log.level === 'success'
                  ? 'text-emerald-400 font-semibold'
                  : 'text-slate-300';

              return (
                <div key={index} className="flex items-start gap-2 text-[11px] leading-relaxed">
                  <span className="text-slate-500 select-none shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`uppercase font-bold shrink-0 ${color}`}>
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

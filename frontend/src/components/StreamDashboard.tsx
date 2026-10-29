import React, { useState } from 'react';
import {
  Tv,
  Play,
  Square,
  Film,
  RefreshCw,
  Eye,
  Loader2,
  FolderOpen,
  AlertTriangle,
  Radio,
  Volume2,
  Activity,
  Music2,
} from 'lucide-react';
import { StreamStatus } from '../types';
import { streamApi } from '../services/api';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

interface StreamDashboardProps {
  status: StreamStatus | null;
  loading: boolean;
  onRefresh: () => void;
  streamConnected: boolean;
}

export const StreamDashboard: React.FC<StreamDashboardProps> = ({
  status,
  loading: _loading,
  onRefresh,
  streamConnected,
}) => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [videos, setVideos] = useState<Array<{ name: string; size: string }>>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [pendingPlayTarget, setPendingPlayTarget] = useState<string | null>(null);

  const requestPlay = (videoUrl?: string) => {
    if (!streamConnected) {
      toast.warning('Dịch vụ StreamBot (:3000) đang ngoại tuyến');
      return;
    }
    const target = (videoUrl || query).trim();
    if (!target) {
      toast.warning('Vui lòng nhập URL YouTube/Twitch hoặc chọn file video');
      return;
    }

    if (status?.stream.playing) {
      setPendingPlayTarget(target);
    } else {
      executePlay(target);
    }
  };

  const executePlay = async (target: string) => {
    setActionLoading(true);
    setPendingPlayTarget(null);
    try {
      await streamApi.playVideo(target);
      toast.success(`Đang truyền phát: ${target}`);
      setQuery('');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi phát video: ${err?.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!streamConnected) return;
    setActionLoading(true);
    try {
      await streamApi.stopStream();
      toast.info('Đã dừng phát video trong phòng thoại');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi dừng stream: ${err?.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFarm = async () => {
    if (!streamConnected) {
      toast.warning('Dịch vụ StreamBot (:3000) đang ngoại tuyến');
      return;
    }
    if (!status) return;
    const nextState = !status.farm.autoWatch;
    setActionLoading(true);
    try {
      await streamApi.toggleFarm(nextState);
      toast.success(nextState ? 'Đã bật chế độ tự động xem stream' : 'Đã tắt chế độ xem stream');
      onRefresh();
    } catch (err: any) {
      toast.error(`Lỗi chuyển đổi cày stream: ${err?.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const loadVideoLibrary = async () => {
    setLoadingVideos(true);
    try {
      const data = await streamApi.getVideos();
      const list = data.videos || [];
      setVideos(list);
      toast.success(`Đã quét thư mục video: phát hiện ${list.length} file`);
    } catch (err: any) {
      toast.error(`Lỗi quét thư mục video: ${err?.message || err}`);
    } finally {
      setLoadingVideos(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              StreamBot Voice
            </h1>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.08]">
              Port :3000
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Truyền phát trực tiếp YouTube, Twitch hoặc MP4 vào phòng thoại Discord với yt-dlp &amp; FFmpeg, cày phút xem 24/7.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onRefresh}
            className="btn-secondary text-xs py-2 px-3.5"
            title="Tải lại trạng thái StreamBot"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {!streamConnected && (
        <div className="p-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300">
                Dịch Vụ StreamBot Đang Ngoại Tuyến (Cổng :3000)
              </p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Máy chủ StreamBot chưa được kích hoạt. Bạn có thể mở đồng thời tất cả dịch vụ bằng file <code className="text-amber-300 font-mono bg-white/[0.05] px-1 rounded">start.bat</code>.
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="btn-secondary text-xs shrink-0 py-1.5 px-3"
          >
            Thử Lại
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  {status?.stream.playing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status?.stream.playing ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  {status?.stream.playing ? 'Voice RTC Live Stream' : 'Voice Standby'}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Ping: <strong className={streamConnected ? 'text-emerald-400' : 'text-slate-500'}>{streamConnected ? `${status?.bot.ping ?? 0}ms` : '--'}</strong>
              </span>
            </div>

            <div className="relative rounded-xl bg-black/40 border border-white/[0.05] p-6 text-center space-y-4 min-h-[180px] flex flex-col items-center justify-center">
              {status?.stream.playing ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 h-10">
                    <span className="w-1.5 bg-indigo-500 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-8" />
                    <span className="w-1.5 bg-violet-400 rounded-full animate-[pulse_1.1s_ease-in-out_infinite] h-10" />
                    <span className="w-1.5 bg-cyan-400 rounded-full animate-[pulse_0.9s_ease-in-out_infinite] h-6" />
                    <span className="w-1.5 bg-emerald-400 rounded-full animate-[pulse_1.2s_ease-in-out_infinite] h-9" />
                    <span className="w-1.5 bg-indigo-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-5" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-sm font-bold text-white line-clamp-1">
                      {status?.stream.currentQueueItem?.title || 'Đang truyền phát media...'}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Voice Channel: {status?.stream.channelInfo?.channelId || 'Đã kết nối'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2 py-4">
                  <Tv className="w-10 h-10 text-slate-600 mx-auto opacity-50" />
                  <p className="text-xs text-slate-500 font-medium">Hiện không có video nào đang phát trong phòng thoại</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Bot Client: <strong className="text-white">{streamConnected ? status?.bot.tag || 'StreamBot' : 'Offline'}</strong></span>
            <span>Codec: <strong className="text-white">{status?.config.videoCodec || 'VP8'} / Opus</strong></span>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Phát Trực Tiếp Media</h3>
            
            <div className="space-y-3">
              <input
                type="text"
                value={query}
                disabled={!streamConnected}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Dán URL YouTube, Twitch hoặc file..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                onKeyDown={(e) => e.key === 'Enter' && requestPlay()}
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => requestPlay()}
                  disabled={actionLoading || !streamConnected || !query.trim()}
                  className="flex-1 btn-primary py-2.5 text-xs"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Phát Ngay</span>
                </button>

                <button
                  onClick={handleStop}
                  disabled={actionLoading || !streamConnected || !status?.stream.playing}
                  className="btn-danger py-2.5 px-4 text-xs"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Dừng</span>
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Viewer Farm (Xem Kênh)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tự động duy trì sự hiện diện để mở khóa huy hiệu</p>
              </div>
              <button
                onClick={handleToggleFarm}
                disabled={actionLoading || !streamConnected}
                className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all ${
                  status?.farm.autoWatch
                    ? 'btn-danger py-2 px-3.5 text-xs'
                    : 'btn-primary py-2 px-3.5 text-xs'
                }`}
              >
                {status?.farm.autoWatch ? 'Tắt' : 'Bật Ngay'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Kho Video Cục Bộ (<code className="text-indigo-400 font-mono">stream/videos/</code>)
            </h2>
          </div>
          <button
            onClick={loadVideoLibrary}
            disabled={loadingVideos || !streamConnected}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingVideos ? 'animate-spin' : ''}`} />
            <span>Quét Thư Mục</span>
          </button>
        </div>

        {videos.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            Chưa có video nào trong danh sách. Hãy nhấn &quot;Quét Thư Mục&quot; để phát hiện các file media cục bộ.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {videos.map((vid) => (
              <div
                key={vid.name}
                onClick={() => requestPlay(vid.name)}
                className={`p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between cursor-pointer transition-all group ${
                  streamConnected ? 'hover:border-indigo-500/30 hover:bg-white/[0.04]' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="truncate mr-2">
                  <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                    {vid.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{vid.size}</p>
                </div>
                <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingPlayTarget !== null}
        title="Xác Nhận Thay Thế Video Đang Phát"
        message={`Kênh thoại Discord hiện đang phát một luồng video trực tiếp. Bạn có chắc chắn muốn ngắt luồng đang phát và phát "${pendingPlayTarget}" không?`}
        confirmText="Phát Thay Thế"
        cancelText="Hủy Bỏ"
        variant="warning"
        onConfirm={() => pendingPlayTarget && executePlay(pendingPlayTarget)}
        onCancel={() => setPendingPlayTarget(null)}
      />
    </div>
  );
};

export default StreamDashboard;

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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-surface-1 p-5 sm:p-6 shadow-panel">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.08] via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                StreamBot Voice
              </h1>
              <span className="text-slate-600 font-light select-none text-xl">/</span>
              <span className="text-sm sm:text-base font-normal text-amber-400">
                Phát Video Kênh Thoại &amp; Viewer Farm 24/7
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-400 border border-white/[0.06] ml-1">
                Port :3000
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Truyền phát trực tiếp YouTube, Twitch hoặc file MP4 vào phòng thoại Discord với yt-dlp &amp; FFmpeg, tích hợp xem stream cày huy hiệu.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefresh}
              className="btn-secondary"
              title="Tải lại trạng thái StreamBot"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Làm Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Non-destructive Offline Notice */}
      {!streamConnected && (
        <div className="panel p-4 border-amber-500/30 bg-amber-500/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">
                Dịch Vụ StreamBot Đang Ngoại Tuyến (Cổng :3000)
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Máy chủ StreamBot chưa được kích hoạt. Hãy khởi động dịch vụ trong terminal bằng lệnh{' '}
                <code className="text-amber-300 font-mono bg-surface-2 px-1.5 py-0.5 rounded">
                  cd stream &amp;&amp; npm run start:node
                </code>
                . Các điều khiển stream thời gian thực tạm thời bị vô hiệu hoá.
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="btn-secondary text-xs shrink-0 py-1.5 px-3"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử Lại</span>
          </button>
        </div>
      )}

      {/* Overview Metric Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Bot Stream Client
            </span>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                status?.stream.playing
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-surface-2 text-slate-400 border-white/[0.06]'
              }`}
            >
              {status?.stream.playing ? 'LIVE STREAM' : streamConnected ? 'NHÀN RỖI' : 'OFFLINE'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {streamConnected ? status?.bot.tag || 'StreamBot' : 'Chưa Kết Nối'}
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              WebSocket Ping:{' '}
              <strong className={streamConnected ? 'text-emerald-400' : 'text-slate-500'}>
                {streamConnected ? `${status?.bot.ping ?? 0}ms` : '--'}
              </strong>
            </p>
          </div>
        </div>

        <div className="panel p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Video Đang Phát
            </span>
            <Film className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-100 line-clamp-1">
              {status?.stream.currentQueueItem?.title || 'Không có nội dung trong hàng đợi'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">
              Voice: {status?.stream.channelInfo?.channelId || 'Chưa vào phòng thoại'}
            </p>
          </div>
        </div>

        <div className="panel p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Viewer Farm (Xem Kênh)
            </span>
            <Eye className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {status?.farm.autoWatch ? 'Tự Động Xem Kênh' : 'Đang Tắt'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Mở khóa huy hiệu Stream Viewer</p>
            </div>
            <button
              onClick={handleToggleFarm}
              disabled={actionLoading || !streamConnected}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
                status?.farm.autoWatch
                  ? 'btn-danger py-1 px-3 text-xs'
                  : 'btn-primary py-1 px-3 text-xs'
              }`}
            >
              {status?.farm.autoWatch ? 'Tắt' : 'Bật Ngay'}
            </button>
          </div>
        </div>
      </div>

      {/* Direct Play Control */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Tv className="w-4 h-4 text-indigo-400" />
            <span>Phát Video Trực Tiếp Vào Voice Channel</span>
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Codec: {status?.config.videoCodec || 'VP8'} • 720p 30fps
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={query}
            disabled={!streamConnected}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              streamConnected
                ? 'Dán URL YouTube, Twitch hoặc tên file video...'
                : 'StreamBot offline — Vui lòng khởi động backend để phát stream'
            }
            className="flex-1 bg-surface-2 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onKeyDown={(e) => e.key === 'Enter' && requestPlay()}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => requestPlay()}
              disabled={actionLoading || !streamConnected || !query.trim()}
              className="btn-primary"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Phát Trực Tiếp</span>
            </button>
            <button
              onClick={handleStop}
              disabled={actionLoading || !streamConnected || !status?.stream.playing}
              className="btn-danger"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Dừng</span>
            </button>
          </div>
        </div>
      </div>

      {/* Local Video Library */}
      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Kho Video Local (<code className="text-slate-400 font-mono">stream/videos/</code>)
            </h2>
          </div>
          <button
            onClick={loadVideoLibrary}
            disabled={loadingVideos || !streamConnected}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingVideos ? 'animate-spin' : ''}`} />
            <span>Quét Lại Thư Mục</span>
          </button>
        </div>

        {videos.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">
            Chưa có video nào trong danh sách. Hãy nhấn &quot;Quét Lại Thư Mục&quot; để phát hiện các file media cục bộ.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {videos.map((vid) => (
              <div
                key={vid.name}
                onClick={() => requestPlay(vid.name)}
                className={`panel-subtle p-3 flex items-center justify-between cursor-pointer transition-colors group ${
                  streamConnected ? 'hover:bg-surface-3' : 'opacity-60 cursor-not-allowed'
                }`}
                title={streamConnected ? `Phát ${vid.name}` : 'StreamBot offline'}
              >
                <div className="truncate mr-2">
                  <p className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 truncate">
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

      {/* Confirmation Dialog When Stream is Already Playing */}
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

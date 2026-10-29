import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  ArrowDown,
  Search,
  Copy,
  Download,
  Terminal,
} from 'lucide-react';
import { LogEntry } from '../types';
import { useToast } from './Toast';

interface TerminalLogsProps {
  logs: LogEntry[];
  onClear: () => void;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({ logs, onClear }) => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((l) => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (searchTerm.trim() && !l.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleCopyAll = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Không có dòng log nào để sao chép');
      return;
    }
    const formatted = filteredLogs
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    toast.success(`Đã sao chép ${filteredLogs.length} dòng log vào clipboard!`);
  };

  const handleDownloadLog = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Không có dòng log nào để xuất file');
      return;
    }
    const formatted = filteredLogs
      .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arychi-system-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã tải xuống file nhật ký (${filteredLogs.length} dòng)`);
  };

  const handleClear = () => {
    onClear();
    toast.info('Đã xóa bộ nhớ log hiển thị trên màn hình');
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-surface-1 p-5 sm:p-6 shadow-panel">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.08] via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                Nhật Ký Hệ Thống
              </h1>
              <span className="text-slate-600 font-light select-none text-xl">/</span>
              <span className="text-sm sm:text-base font-normal text-cyan-400">
                Truy Vết Luồng Sự Kiện WebSocket Thời Gian Thực
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 text-slate-400 border border-white/[0.06] ml-1">
                WebSocket Stream
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Truy vết trực tiếp các sự kiện phát sinh từ Quest Automation (:3001) và StreamBot Voice (:3000) với bộ lọc cấp độ và tìm kiếm nội dung.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`btn-secondary text-xs ${autoScroll ? 'border-cyan-500/40 text-cyan-300' : ''}`}
              title="Tự động cuộn xuống dòng mới nhất"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{autoScroll ? 'Auto-Scroll: Bật' : 'Auto-Scroll: Tắt'}</span>
            </button>

            <button
              onClick={handleCopyAll}
              className="btn-secondary text-xs"
              title="Sao chép toàn bộ dòng log đang lọc vào clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao Chép Tất Cả</span>
            </button>

            <button
              onClick={handleDownloadLog}
              className="btn-secondary text-xs"
              title="Tải về file nhật ký .log"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải File .log</span>
            </button>

            <button
              onClick={handleClear}
              className="btn-danger text-xs"
              title="Xóa toàn bộ log hiện tại trên giao diện"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Màn Hình</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="panel overflow-hidden flex flex-col h-[calc(100vh-270px)] min-h-[420px]">
        {/* Terminal Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['all', 'info', 'warn', 'error', 'success'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium uppercase transition-colors whitespace-nowrap ${
                  filter === lvl
                    ? 'bg-surface-0 text-slate-100 border border-white/[0.1] font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Lọc từ khóa trong log..."
              className="w-full bg-surface-0 border border-white/[0.08] rounded-md pl-8 pr-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 bg-[#06070a]">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 italic text-center py-16 flex flex-col items-center gap-2">
              <Terminal className="w-6 h-6 text-slate-600" />
              <span>Không có sự kiện nhật ký nào phù hợp với bộ lọc hiện tại.</span>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const color =
                log.level === 'error'
                  ? 'text-rose-400 font-bold'
                  : log.level === 'warn'
                  ? 'text-amber-400 font-semibold'
                  : log.level === 'success'
                  ? 'text-emerald-400 font-semibold'
                  : 'text-slate-300';

              return (
                <div key={index} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 select-none shrink-0">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className={`uppercase text-[11px] select-none shrink-0 ${color}`}>
                    [{log.level}]
                  </span>
                  <span className={`${color} break-all flex-1`}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Terminal Status Bar Footer */}
        <div className="px-4 py-2 bg-surface-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Hiển thị: <strong className="text-slate-200">{filteredLogs.length}</strong> / {logs.length} sự kiện
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Bộ lọc: <span className="uppercase text-cyan-400">{filter}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${autoScroll ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span>{autoScroll ? 'Auto-scroll Đang Bật' : 'Tạm Dừng Cuộn'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalLogs;

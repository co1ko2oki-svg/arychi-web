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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Nhật Ký Hệ Thống
            </h1>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-cyan-400 border border-cyan-500/25">
              WebSocket Live Feed
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Truy vết trực tiếp các sự kiện từ Quest Automation (:3001) và StreamBot Voice (:3000).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`btn-secondary text-xs py-2 px-3 ${autoScroll ? 'border-cyan-500/40 text-cyan-300' : ''}`}
            title="Tự động cuộn xuống dòng mới nhất"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>{autoScroll ? 'Auto-Scroll: Bật' : 'Auto-Scroll: Tắt'}</span>
          </button>

          <button
            onClick={handleCopyAll}
            className="btn-secondary text-xs py-2 px-3"
            title="Sao chép toàn bộ dòng log đang lọc vào clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Sao Chép</span>
          </button>

          <button
            onClick={handleDownloadLog}
            className="btn-secondary text-xs py-2 px-3"
            title="Tải về file nhật ký .log"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất File</span>
          </button>

          <button
            onClick={handleClear}
            className="btn-danger text-xs py-2 px-3"
            title="Xóa bộ đệm log hiện tại"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative min-w-[260px] sm:max-w-xs flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Lọc sự kiện theo từ khóa..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              ['all', 'Tất Cả'],
              ['info', 'Info'],
              ['warn', 'Warning'],
              ['error', 'Error'],
              ['success', 'Success'],
            ] as const
          ).map(([lvl, label]) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap ${
                filter === lvl
                  ? 'bg-white/[0.1] text-white border border-white/[0.15] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#000000] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="font-mono text-[11px] text-slate-400 ml-2">stdout — arychi-daemon</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">{filteredLogs.length} dòng sự kiện</span>
        </div>

        <div className="p-4 font-mono text-xs space-y-1.5 max-h-[580px] overflow-y-auto leading-relaxed">
          {filteredLogs.length === 0 ? (
            <div className="py-24 text-center space-y-2 text-slate-500">
              <Terminal className="w-8 h-8 mx-auto opacity-30" />
              <p className="italic">Chưa có thông điệp nhật ký nào...</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const color =
                log.level === 'error'
                  ? 'text-rose-400 font-bold'
                  : log.level === 'warn'
                  ? 'text-amber-400'
                  : log.level === 'success'
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-300';

              return (
                <div key={index} className="flex items-start gap-2.5 text-[11px] hover:bg-white/[0.02] py-0.5 px-2 rounded">
                  <span className="text-slate-500 select-none shrink-0 font-mono">
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
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default TerminalLogs;

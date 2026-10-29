import React, { useState } from 'react';
import {
  Terminal,
  AlertTriangle,
  Copy,
  Check,
  Cpu,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from './Toast';

export const BadgeDashboard: React.FC = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [hours, setHours] = useState('50');
  const [threads, setThreads] = useState('2');
  const [mode, setMode] = useState<'playtime' | 'played' | 'both'>('playtime');

  const parsedHours = Math.max(1, Math.min(5000, parseInt(hours, 10) || 1));
  const parsedThreads = Math.max(1, Math.min(10, parseInt(threads, 10) || 1));

  const getCommand = () => {
    const base = 'cd badge-farm && python spoofer.py';
    if (mode === 'playtime') {
      return `${base} --hours ${parsedHours} --threads ${parsedThreads}`;
    }
    if (mode === 'played') {
      return `${base} --mark-played 1000`;
    }
    return `${base} --hours ${parsedHours} --threads ${parsedThreads} --mark-played 500`;
  };

  const copyCommand = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Đã sao chép lệnh khởi chạy vào clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Cày Giờ Chơi Hồ Sơ
            </h1>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-emerald-400 border border-emerald-500/25">
              Python 3 Module
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Telemetry Science Spoofer gửi gói tin nhị phân Windows PE lên endpoint <code className="text-emerald-400 font-mono">/api/v9/science</code> để tăng giờ chơi và mở khóa mốc game.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7 glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <div>
              <h3 className="text-sm font-bold text-white">Trình Tạo Lệnh Khởi Chạy</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tùy biến tham số giờ và luồng chạy song song</p>
            </div>

            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
              <button
                onClick={() => setMode('playtime')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'playtime'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cày Giờ Chơi
              </button>
              <button
                onClick={() => setMode('played')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'played'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Đánh Dấu Game
              </button>
              <button
                onClick={() => setMode('both')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'both'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cả Hai
              </button>
            </div>
          </div>

          {mode !== 'played' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  Số Giờ Muốn Cày (--hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  Số Luồng Song Song (--threads)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={threads}
                  onChange={(e) => setThreads(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="relative group pt-2">
            <pre className="bg-[#05060A] p-4 rounded-xl font-mono text-xs text-emerald-300 border border-white/[0.08] overflow-x-auto leading-relaxed">
              {getCommand()}
            </pre>
            <button
              onClick={() => copyCommand(getCommand())}
              className="absolute top-5 right-3 btn-secondary py-1.5 px-3 text-xs"
              title="Sao chép lệnh"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="md:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Cơ Chế Windows PE Telemetry
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Script <code className="text-indigo-300 font-mono">badge-farm/spoofer.py</code> gửi các event <code className="text-indigo-400 font-mono">launch_game</code> và <code className="text-indigo-400 font-mono">running_game_heartbeat</code> kèm chữ ký Windows PE Fingerprint hợp lệ. Discord ghi nhận số giờ này vào lịch sử chơi game của tài khoản mà không cần cài hay mở game thật.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/[0.03] border border-amber-500/20 flex items-start gap-3 text-xs text-slate-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dữ liệu telemetry được Discord xử lý theo lô. Huy hiệu giờ chơi và danh sách game trên hồ sơ cá nhân thường xuất hiện sau 24 đến 48 giờ kể từ khi hoàn tất gửi heartbeat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeDashboard;

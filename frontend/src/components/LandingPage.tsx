import React, { useState } from 'react';
import {
  Sparkles,
  Tv,
  Award,
  ArrowRight,
  Lock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Server,
  Info,
  ShieldCheck,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { NavTabId } from './Sidebar';

interface LandingPageProps {
  onOpenLoginModal: () => void;
  questConnected: boolean;
  streamConnected: boolean;
  onNavigateTab?: (tab: NavTabId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLoginModal,
  questConnected,
  streamConnected,
  onNavigateTab,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const navigateTo = (tab: NavTabId) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else {
      window.location.hash = `#${tab}`;
    }
  };

  return (
    <div className="space-y-12 py-4 max-w-5xl mx-auto">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0C14] p-8 sm:p-12 text-center space-y-6 shadow-panel">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_0%,rgba(99,102,241,0.14),transparent_70%)] pointer-events-none" />
        <div className="relative space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>Arychi Suite v2.0</span>
            <span className="text-slate-600">•</span>
            <span className="text-indigo-400 font-mono">Localhost Automation Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Tự Động Hóa Discord <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Chuyên Nghiệp &amp; Cục Bộ
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Hợp nhất 3 giải pháp độc lập chạy trực tiếp trên thiết bị của bạn: Tự động hoàn thành Discord Quests không cần game, truyền phát video vào Voice Channel 24/7 và cày giờ chơi hồ sơ qua Discord Science API.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenLoginModal}
              className="btn-primary py-3 px-6 text-xs sm:text-sm shadow-glow-md"
            >
              <span>Kết Nối Tài Khoản Discord</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigateTo('about')}
              className="btn-secondary py-3 px-5 text-xs sm:text-sm"
            >
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Giới Thiệu Chi Tiết</span>
            </button>
          </div>
        </div>
      </section>

      <section id="architecture" className="panel p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Sơ Đồ Dịch Vụ Cục Bộ</h2>
              <span className="text-slate-600 font-light select-none text-sm">/</span>
              <span className="text-indigo-400 font-medium text-xs sm:text-sm">Kiến Trúc Vận Hành Độc Lập</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Toàn bộ dữ liệu và tiến trình xử lý nằm hoàn toàn trên máy trạm của bạn, giao tiếp trực tiếp Discord API.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <span className="flex items-center gap-2 text-slate-400 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06]">
              <span className="relative flex h-2 w-2">
                {questConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              </span>
              :3001 {questConnected ? 'Online' : 'Offline'}
            </span>
            <span className="flex items-center gap-2 text-slate-400 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06]">
              <span className="relative flex h-2 w-2">
                {streamConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
              </span>
              :3000 {streamConnected ? 'Live' : 'Standby'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="panel-subtle p-5 space-y-3 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                Module 01
              </span>
              <span className="text-[10px] font-mono text-slate-500">Port :3001</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                Quest Engine
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tự động cào danh sách nhiệm vụ, mô phỏng xem video theo chu kỳ heartbeat và nhận phần thưởng game mà không cần tải game.
              </p>
            </div>
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">Fastify • WS API</span>
              <button
                onClick={() => navigateTo('quests')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
              >
                <span>Xem Quests</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="panel-subtle p-5 space-y-3 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                Module 02
              </span>
              <span className="text-[10px] font-mono text-slate-500">Port :3000</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                StreamBot Voice
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Phát video trực tiếp từ YouTube, Twitch hoặc file MP4 vào phòng thoại Discord với yt-dlp và FFmpeg, tích hợp Viewer Farm 24/7.
              </p>
            </div>
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">Opus • FFmpeg</span>
              <button
                onClick={() => navigateTo('stream')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
              >
                <span>Mở StreamBot</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="panel-subtle p-5 space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Module 03
              </span>
              <span className="text-[10px] font-mono text-slate-500">Python 3</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                Science Spoofer
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tạo chữ ký bảo mật Windows PE Fingerprint gửi telemetry lên <code className="text-emerald-400 font-mono">/api/v9/science</code> để tăng giờ chơi và mở mốc game.
              </p>
            </div>
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">PE Fingerprint</span>
              <button
                onClick={() => navigateTo('badges')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
              >
                <span>Cấu Hình</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Khả Năng Cốt Lõi</h2>
          <span className="text-slate-600 font-light select-none text-sm">/</span>
          <span className="text-indigo-400 font-medium text-xs sm:text-sm">Giải Pháp Độc Quyền Thiết Kế Chuyên Biệt</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel p-5 space-y-2.5 hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center gap-2.5 text-indigo-400">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-white">Tự Động 100% Discord Quests</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hệ thống tự động gửi các gói tin telemetry định kỳ tương tự như client Discord chính thức. Bạn không cần tải hay cài đặt bất kỳ trò chơi nặng 50GB-100GB nào.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center gap-2.5 text-amber-400">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Tv className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-white">Phát Video Kênh Thoại &amp; Viewer Farm</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Truyền phát trực tiếp từ các liên kết YouTube hoặc video MP4 vào phòng họp thoại với chuẩn âm thanh tối ưu, kèm chế độ tự động farm phút xem stream.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Award className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-white">Cày Giờ Chơi Hồ Sơ Qua Science API</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tạo chữ ký bảo mật Windows PE để gửi telemetry nhịp độ chơi game trực tiếp tới máy chủ Discord, mở khóa mốc giờ chơi và danh sách game trên trang cá nhân.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center gap-2.5 text-cyan-400">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-white">Bảo Mật Cục Bộ 100% (Client-Side Only)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Discord User Token được lưu trữ trong LocalStorage trình duyệt của bạn và gửi thẳng về backend máy tính cục bộ. Không có bất kỳ máy chủ bên thứ ba nào can thiệp.
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Khởi Chạy Nhanh</h2>
          <span className="text-slate-600 font-light select-none text-sm">/</span>
          <span className="text-indigo-400 font-medium text-xs sm:text-sm">Vận Hành Hệ Thống Trong 3 Bước</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="panel-subtle p-4 rounded-xl space-y-2">
            <span className="font-mono text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Bước 01
            </span>
            <p className="text-xs text-slate-200 font-bold">Khởi động launcher.mjs</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Chạy file <code className="text-indigo-300 bg-white/[0.04] px-1 py-0.5 rounded font-mono">start.bat</code> để khởi chạy đồng thời Backend Quests (:3001), StreamBot (:3000) và Web Dashboard (:5173).
            </p>
          </div>

          <div className="panel-subtle p-4 rounded-xl space-y-2">
            <span className="font-mono text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Bước 02
            </span>
            <p className="text-xs text-slate-200 font-bold">Lấy Token Discord</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Mở Discord Web, nhấn F12 &gt; tab Network &gt; lọc <code className="text-indigo-300 bg-white/[0.04] px-1 py-0.5 rounded font-mono">science</code> hoặc <code className="text-indigo-300 bg-white/[0.04] px-1 py-0.5 rounded font-mono">/users/@me</code> và sao chép header Authorization.
            </p>
          </div>

          <div className="panel-subtle p-4 rounded-xl space-y-2">
            <span className="font-mono text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Bước 03
            </span>
            <p className="text-xs text-slate-200 font-bold">Kết nối &amp; Vận hành</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bấm nút "Kết Nối Tài Khoản Discord", dán token vào và quản lý tất cả nhiệm vụ từ bảng điều khiển tập trung.
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Giải Đáp Kỹ Thuật (FAQ)</h2>
          <span className="text-slate-600 font-light select-none text-sm">/</span>
          <span className="text-indigo-400 font-medium text-xs sm:text-sm">Bảo Mật Tài Khoản &amp; Cơ Chế Vận Hành</span>
        </div>

        <div className="space-y-2.5">
          {[
            {
              q: 'Token của tôi có được gửi ra máy chủ bên ngoài không?',
              a: 'Tuyệt đối không. Arychi được thiết kế theo mô hình tự lưu trữ (self-hosted). Toàn bộ mã nguồn chạy tại máy trạm của bạn và chỉ giao tiếp giữa frontend (port 5173), backend (port 3001/3000) và trực tiếp Discord API.',
            },
            {
              q: 'Tại sao làm quest không cần phải tải game?',
              a: 'Discord xác định tiến độ quest thông qua các gói tin telemetry định kỳ (heartbeat) được gửi từ ứng dụng Discord Desktop. Backend Arychi mô phỏng chính xác các gói tin này theo định dạng chính thức.',
            },
            {
              q: 'StreamBot cần những phần mềm gì trên máy?',
              a: 'StreamBot đã tích hợp sẵn yt-dlp và sử dụng binary ffmpeg cục bộ. Bạn chỉ cần đảm bảo máy tính đã cài đặt Node.js phiên bản 18 trở lên.',
            },
          ].map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="panel-subtle rounded-xl overflow-hidden border border-white/[0.06]">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-white/[0.04] pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Arychi Dashboard • Production Discord Automation Platform</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('about')}
            className="hover:text-indigo-400 text-slate-400 transition-colors"
          >
            Trang Giới Thiệu
          </button>
          <span>&bull;</span>
          <span className="font-mono text-[11px] text-slate-400">Localhost Environment</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

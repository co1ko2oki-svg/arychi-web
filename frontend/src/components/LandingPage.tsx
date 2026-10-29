import React, { useState } from 'react';
import {
  Sparkles,
  Tv,
  Award,
  ArrowRight,
  Lock,
  ChevronDown,
  ChevronUp,
  Server,
  Info,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Terminal,
  Activity,
} from 'lucide-react';
import { NavTabId } from './Navbar';

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
    <div className="space-y-20 py-6 max-w-6xl mx-auto">
      <section className="relative pt-6 pb-12 text-center space-y-8">
        <div className="space-y-5 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-slate-300 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="font-semibold text-white">Arychi Suite v2.0</span>
            <span className="text-slate-600">•</span>
            <span className="text-indigo-400 font-mono text-[11px]">Localhost Automation Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
            Tự Động Hóa Discord <br />
            <span className="bg-gradient-to-r from-indigo-300 via-indigo-100 to-cyan-300 bg-clip-text text-transparent">
              Cục Bộ &amp; Chuyên Sâu
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-normal">
            Hợp nhất 3 giải pháp độc lập chạy trực tiếp trên thiết bị của bạn: Tự động hoàn thành Discord Quests không cần tải game, truyền phát video vào Voice Channel và cày giờ chơi hồ sơ qua Discord Science API.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <button
              onClick={onOpenLoginModal}
              className="btn-primary py-3 px-6 text-sm shadow-xl shadow-indigo-500/25"
            >
              <span>Kết Nối Tài Khoản Discord</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigateTo('about')}
              className="btn-secondary py-3 px-5 text-sm"
            >
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Tìm Hiểu Kiến Trúc</span>
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto pt-4">
          <div className="glass-panel rounded-2xl p-3 px-6 flex flex-wrap items-center justify-around gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {questConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              </span>
              <span className="text-slate-400">Quest Engine</span>
              <span className={`font-semibold ${questConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {questConnected ? ':3001 Online' : ':3001 Offline'}
              </span>
            </div>

            <div className="w-[1px] h-4 bg-white/[0.08] hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {streamConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
              </span>
              <span className="text-slate-400">StreamBot Voice</span>
              <span className={`font-semibold ${streamConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {streamConnected ? ':3000 Live' : ':3000 Standby'}
              </span>
            </div>

            <div className="w-[1px] h-4 bg-white/[0.08] hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-slate-400">Science Telemetry</span>
              <span className="text-indigo-400 font-semibold">Python Ready</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
              Kiến Trúc Dịch Vụ
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            3 Trụ Cột Tự Động Hóa Chuyên Biệt
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Mỗi module vận hành độc lập trên cổng mạng riêng biệt, giao tiếp trực tiếp hạ tầng Discord API qua kết nối Loopback nội bộ.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:border-indigo-500/30 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                  PORT :3001
                </span>
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Quest Engine</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Cào danh sách nhiệm vụ từ Discord, mô phỏng heartbeat 30 giây định kỳ theo chuẩn client Desktop và tự động nhận phần thưởng game mà không cần tải game nặng 50GB-100GB.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Fastify + WebSocket</span>
              <button
                onClick={() => navigateTo('quests')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Xem nhiệm vụ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:border-amber-500/30 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  PORT :3000
                </span>
                <Tv className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">StreamBot Voice</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Phát trực tiếp YouTube, Twitch hoặc file video MP4 vào phòng họp thoại Voice Channel với âm thanh Opus chất lượng cao, tích hợp tính năng Viewer Farm cày phút xem 24/7.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">FFmpeg + Opus Codec</span>
              <button
                onClick={() => navigateTo('stream')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Mở phát stream</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:border-emerald-500/30 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  PYTHON 3
                </span>
                <Award className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Science Telemetry</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Tạo chữ ký Windows PE Fingerprint gửi các gói tin telemetry trực tiếp lên <code className="text-emerald-400 font-mono">/api/v9/science</code> để tăng giờ chơi và mở khóa mốc game trên trang cá nhân.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">PE Hash Spoofer</span>
              <button
                onClick={() => navigateTo('badges')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Tạo lệnh chạy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Năng Lực Cốt Lõi
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            An Toàn &amp; Không Phụ Thuộc Máy Chủ Đám Mây
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Bảo Mật Cục Bộ 100% (Client-Side Only)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Discord User Token được lưu trữ trong LocalStorage trình duyệt của bạn và gửi thẳng về backend máy tính nội bộ localhost:3001. Tuyệt đối không có bất kỳ máy chủ bên thứ ba nào thu thập hay trung chuyển dữ liệu.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Mô Phỏng Nhịp Độ Chuẩn (Anti-Rate Limit)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tiến trình làm quest và telemetry được thiết kế với chu kỳ đệm tự nhiên tương tự ứng dụng chính thức, không bắn dồn dập nhằm triệt tiêu nguy cơ vi phạm giới hạn tốc độ (HTTP 429).
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Tv className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Truyền Phát Video Voice Đa Nguồn</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Giải mã trực tiếp luồng stream YouTube hoặc file video cục bộ với binary FFmpeg và yt-dlp tích hợp sẵn, hỗ trợ phát lặp vô hạn và cày giờ xem cho thành viên phòng thoại.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Minh Bạch Mã Nguồn (Audit-Ready)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Toàn bộ source code TypeScript và script Python nằm ngay trên máy của bạn. Bạn có thể mở bất kỳ tệp tin nào để kiểm tra logic xử lý gói tin hoặc mở tab F12 Network để giám sát.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Bắt Đầu Nhanh
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Vận Hành Hệ Thống Trong 3 Bước
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
            <span className="text-xs font-mono font-bold text-indigo-400">01 / KHỞI ĐỘNG</span>
            <h3 className="text-base font-bold text-white">Chạy start.bat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nhấp đúp file <code className="text-indigo-300 font-mono bg-white/[0.05] px-1.5 py-0.5 rounded">start.bat</code> ở thư mục gốc để mở đồng thời cả Backend Quest (:3001), StreamBot (:3000) và Web Dashboard (:5173).
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
            <span className="text-xs font-mono font-bold text-indigo-400">02 / TOKEN DISCORD</span>
            <h3 className="text-base font-bold text-white">Lấy User Token</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mở Discord trên Chrome/Edge, nhấn <kbd className="font-mono bg-white/[0.08] px-1 rounded">F12</kbd> &gt; tab Network &gt; lọc <code className="text-indigo-300 font-mono bg-white/[0.05] px-1.5 py-0.5 rounded">science</code> hoặc <code className="text-indigo-300 font-mono bg-white/[0.05] px-1.5 py-0.5 rounded">/users/@me</code> và sao chép header Authorization.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
            <span className="text-xs font-mono font-bold text-indigo-400">03 / ĐIỀU KHIỂN</span>
            <h3 className="text-base font-bold text-white">Kết Nối &amp; Vận Hành</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bấm nút &quot;Kết Nối Tài Khoản Discord&quot; ở góc trên, dán token vào và quản lý tất cả nhiệm vụ, stream voice từ bảng điều khiển tập trung.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6 pt-4">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
            Câu Hỏi Thường Gặp
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Giải Đáp Kỹ Thuật (FAQ)
          </h2>
        </div>

        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {[
            {
              q: 'Token của tôi có được gửi ra máy chủ bên ngoài không?',
              a: 'Tuyệt đối không. Arychi được thiết kế theo mô hình tự lưu trữ (self-hosted). Toàn bộ mã nguồn chạy tại máy trạm của bạn và chỉ giao tiếp giữa frontend (port 5173), backend (port 3001/3000) và trực tiếp Discord API.',
            },
            {
              q: 'Tại sao làm quest không cần phải tải game?',
              a: 'Discord xác định tiến độ quest thông qua các gói tin telemetry định kỳ (heartbeat) được gửi từ ứng dụng Discord Desktop. Backend Arychi mô phỏng chính xác các gói tin này theo định dạng chính thức với chu kỳ 30 giây.',
            },
            {
              q: 'StreamBot cần những phần mềm gì trên máy?',
              a: 'StreamBot đã tích hợp sẵn yt-dlp và sử dụng binary ffmpeg cục bộ trong thư mục node_modules. Bạn chỉ cần đảm bảo máy tính đã cài đặt Node.js phiên bản 18 trở lên.',
            },
          ].map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left flex items-center justify-between text-sm font-bold text-slate-200 hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-3xl">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400">Arychi Suite v2.0.0</span>
          <span>•</span>
          <span>Localhost Automation Environment</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button
            onClick={() => navigateTo('about')}
            className="hover:text-indigo-400 transition-colors"
          >
            Trang Giới Thiệu
          </button>
          <span>•</span>
          <button
            onClick={() => navigateTo('quests')}
            className="hover:text-indigo-400 transition-colors"
          >
            Nhiệm Vụ
          </button>
          <span>•</span>
          <button
            onClick={() => navigateTo('stream')}
            className="hover:text-indigo-400 transition-colors"
          >
            StreamBot
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

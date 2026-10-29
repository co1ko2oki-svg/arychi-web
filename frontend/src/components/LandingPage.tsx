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

  return (
    <div className="space-y-12 py-4 max-w-5xl mx-auto">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-1 p-8 sm:p-12 text-center space-y-5 shadow-panel">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_0%,rgba(99,102,241,0.12),transparent_70%)] pointer-events-none" />
        <div className="relative space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-white/[0.08] text-xs font-medium text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Arychi Suite v2.0</span>
            <span className="text-slate-600">•</span>
            <span className="text-indigo-400">Localhost Automation Engine</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>Arychi Suite</span>
            <span className="text-slate-600 font-light select-none text-2xl sm:text-4xl">/</span>
            <span className="text-indigo-400 text-xl sm:text-3xl lg:text-4xl font-bold">
              Tự Động Hóa Discord Cục Bộ
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Hợp nhất 3 giải pháp độc lập chạy trực tiếp trên máy của bạn: Tự động hoàn thành Discord Quests, phát stream video vào kênh thoại Voice và cày giờ chơi hồ sơ qua Discord Science API.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenLoginModal}
              className="btn-primary py-2.5 px-5 text-sm"
            >
              <span>Kết Nối Tài Khoản Discord</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => (onNavigateTab ? onNavigateTab('about') : (window.location.hash = '#about'))}
              className="btn-secondary py-2.5 px-4 text-sm"
            >
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Giới Thiệu Chi Tiết</span>
            </button>
          </div>
        </div>
      </section>

      <section id="architecture" className="panel p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06] relative">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Server className="w-4 h-4 text-indigo-400 shrink-0" />
              <h2 className="text-base font-bold text-slate-100">Sơ Đồ Dịch Vụ</h2>
              <span className="text-slate-600 font-light select-none text-sm">/</span>
              <span className="text-indigo-400 font-medium text-sm">Kiến Trúc Vận Hành Độc Lập Thiết Bị Nội Bộ</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Toàn bộ dữ liệu và tiến trình xử lý nằm hoàn toàn trên thiết bị của bạn, giao tiếp trực tiếp Discord API.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className={`w-2 h-2 rounded-full ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              :3001 {questConnected ? 'Online' : 'Offline'}
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className={`w-2 h-2 rounded-full ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
              :3000 {streamConnected ? 'Live' : 'Standby'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          <div className="panel-subtle p-4 space-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/[0.04] to-transparent pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-indigo-400 uppercase">Module 01</span>
              <span className="text-[10px] font-mono text-slate-500">Node :3001</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-100">Quest Engine</h3>
              <span className="text-slate-600 text-xs">/</span>
              <span className="text-indigo-400 text-xs">Cày Quest Tự Động</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cào danh sách nhiệm vụ, mô phỏng xem video theo chu kỳ heartbeat và hoàn thành nhiệm vụ game tự động.
            </p>
          </div>

          <div className="panel-subtle p-4 space-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] to-transparent pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-amber-400 uppercase">Module 02</span>
              <span className="text-[10px] font-mono text-slate-500">Node :3000</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-100">StreamBot Voice</h3>
              <span className="text-slate-600 text-xs">/</span>
              <span className="text-amber-400 text-xs">Phát Kênh Thoại 24/7</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Phát luồng video YouTube/Twitch vào Voice Channel bằng yt-dlp &amp; FFmpeg, tích hợp Viewer Farm cày phút xem.
            </p>
          </div>

          <div className="panel-subtle p-4 space-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] to-transparent pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase">Module 03</span>
              <span className="text-[10px] font-mono text-slate-500">Python 3</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-100">Science Telemetry</h3>
              <span className="text-slate-600 text-xs">/</span>
              <span className="text-emerald-400 text-xs">Giờ Chơi Profile</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gửi gói tin giả lập lên <code className="text-emerald-400 font-mono">/api/v9/science</code> kèm Windows PE Fingerprint để nhận huy hiệu giờ chơi.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-slate-100">Khả Năng Cốt Lõi</h2>
          <span className="text-slate-600 font-light select-none text-base">/</span>
          <span className="text-indigo-400 font-medium text-sm sm:text-base">Giải Pháp Chuyên Sâu Không Chứa Thành Phần Giả Lập</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 text-indigo-400 relative">
              <Sparkles className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-100">Tự Động 100% Discord Quests</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed relative">
              Hệ thống tự động kích hoạt tiến trình làm nhiệm vụ mà bạn không cần phải tải hay cài đặt bất kỳ game nặng nào. Cơ chế AbortSignal cho phép dừng ngay khi cần.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.03] to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 text-amber-400 relative">
              <Tv className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-100">Phát Video Kênh Thoại &amp; Viewer Farm</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed relative">
              Truyền phát trực tiếp từ các liên kết YouTube hoặc video MP4 vào phòng họp thoại với chuẩn âm thanh và hình ảnh tối ưu, kèm chế độ tự động farm phút xem stream.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 text-emerald-400 relative">
              <Award className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-100">Cày Giờ Chơi Hồ Sơ Qua Science API</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed relative">
              Tạo chữ ký bảo mật Windows PE để gửi telemetry nhịp độ chơi game trực tiếp tới máy chủ Discord, mở khóa mốc giờ chơi và danh sách game trên trang cá nhân.
            </p>
          </div>

          <div className="panel p-5 space-y-2.5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.03] to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 text-cyan-400 relative">
              <Lock className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-100">Bảo Mật Cục Bộ 100% (Client-Side Only)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed relative">
              Discord User Token được lưu trữ trong LocalStorage trình duyệt của bạn và gửi thẳng về backend máy tính cục bộ. Không có bất kỳ máy chủ bên thứ ba nào can thiệp.
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-6 space-y-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] to-transparent pointer-events-none" />
        <div className="flex items-center gap-2 flex-wrap relative">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Khởi Chạy Nhanh
          </h2>
          <span className="text-slate-600 font-light select-none text-xs">/</span>
          <span className="text-indigo-400 font-medium text-xs">Vận Hành Hệ Thống Trong 3 Bước</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
          <div className="panel-subtle p-3.5 rounded-lg space-y-1.5">
            <span className="font-mono text-xs font-bold text-indigo-400">01. Khởi động backend</span>
            <p className="text-xs text-slate-300 font-semibold">Chạy start-all.bat</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Nhấp đúp file <code className="text-slate-200 bg-surface-2 px-1 py-0.5 rounded">start-all.bat</code> ở thư mục gốc để mở đồng thời cả Backend (:3001) và Web (:5173).
            </p>
          </div>

          <div className="panel-subtle p-3.5 rounded-lg space-y-1.5">
            <span className="font-mono text-xs font-bold text-indigo-400">02. Lấy Token Discord</span>
            <p className="text-xs text-slate-300 font-semibold">F12 &gt; Authorization</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Mở Discord Web, nhấn F12 &gt; tab Network &gt; lọc <code className="text-slate-200 bg-surface-2 px-1 py-0.5 rounded">science</code> và sao chép header Authorization.
            </p>
          </div>

          <div className="panel-subtle p-3.5 rounded-lg space-y-1.5">
            <span className="font-mono text-xs font-bold text-indigo-400">03. Kết nối &amp; Vận hành</span>
            <p className="text-xs text-slate-300 font-semibold">Bắt đầu tự động</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bấm nút "Kết Nối Tài Khoản Discord", dán token vào và quản lý tất cả nhiệm vụ từ bảng điều khiển.
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-6 space-y-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] to-transparent pointer-events-none" />
        <div className="flex items-center gap-2 flex-wrap relative">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <h2 className="text-sm font-bold text-slate-100">Giải Đáp Kỹ Thuật (FAQ)</h2>
          <span className="text-slate-600 font-light select-none text-xs">/</span>
          <span className="text-indigo-400 font-medium text-xs">Bảo Mật Tài Khoản &amp; Cơ Chế Vận Hành</span>
        </div>

        <div className="space-y-2 relative">
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
              a: 'StreamBot đã tích hợp sẵn yt-dlp và sử dụng thư viện node để giải mã video. Bạn chỉ cần đảm bảo máy tính đã cài đặt Node.js phiên bản 18 trở lên.',
            },
          ].map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="panel-subtle overflow-hidden">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-400 leading-relaxed border-t border-white/[0.04] pt-2.5">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
        <p>Arychi Dashboard • Production Discord Automation Platform</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => (onNavigateTab ? onNavigateTab('about') : (window.location.hash = '#about'))}
            className="hover:text-indigo-400 text-slate-400 transition-colors"
          >
            Trang Giới Thiệu
          </button>
          <span>&bull;</span>
          <span className="font-mono text-[11px]">Localhost Environment</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
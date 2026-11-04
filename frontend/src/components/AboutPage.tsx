import React from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Lock,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
  Zap,
} from 'lucide-react';
import { NavTabId } from './Navbar';
import { PageHeader, Section, StatusDot } from './ui';

interface AboutPageProps {
  questConnected: boolean;
  streamConnected: boolean;
  onNavigateTab: (tab: NavTabId) => void;
  onOpenLoginModal: () => void;
  isLoggedIn: boolean;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  questConnected,
  streamConnected,
  onNavigateTab,
  isLoggedIn,
}) => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-16 py-4">
      <PageHeader
        title="Tài liệu Kỹ thuật & Kiến trúc Hệ thống"
        description="Kiến trúc Gateway, cơ chế bảo vệ phiên Discord, tự động hóa nhiệm vụ Quests và hệ thống treo Stream 5.000 giờ."
        meta={
          <>
            <span className="text-[#f2f5f1]">Arychi Suite v2.2.0</span>
            <span className="inline-flex items-center gap-1.5 text-[#72b991]">
              <StatusDot tone="ok" />
              Bản quyền chính thức
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#9aa8a0]">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest :3001
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#9aa8a0]">
              <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
              Stream :3000
            </span>
          </>
        }
        actions={
          isLoggedIn ? (
            <button
              type="button"
              onClick={() => onNavigateTab('home')}
              className="btn-primary"
            >
              <span>Về Tổng quan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : null
        }
      />

      {/* Table of contents */}
      <nav
        aria-label="Mục lục tài liệu"
        className="surface p-4 rounded-xl flex flex-wrap items-center gap-2 text-xs font-mono"
      >
        <span className="text-[#9aa8a0] mr-2">MỤC LỤC:</span>
        <button
          type="button"
          onClick={() => scrollToSection('sec-overview')}
          className="px-3 py-1 rounded-md bg-[#161e1a] text-[#8e96e8] hover:bg-[#212c27] transition-colors"
        >
          # Tổng quan
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-architecture')}
          className="px-3 py-1 rounded-md bg-[#161e1a] text-[#8e96e8] hover:bg-[#212c27] transition-colors"
        >
          # Kiến trúc Gateway
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-stream')}
          className="px-3 py-1 rounded-md bg-[#161e1a] text-[#8e96e8] hover:bg-[#212c27] transition-colors"
        >
          # Stream 5.000h
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-security')}
          className="px-3 py-1 rounded-md bg-[#161e1a] text-[#8e96e8] hover:bg-[#212c27] transition-colors"
        >
          # Bảo mật Discord
        </button>
      </nav>

      <Section
        id="sec-overview"
        title="Tổng quan hệ thống"
        description="Mô hình hoạt động tách biệt giữa giao diện người dùng và máy chủ nền tảng."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="surface p-5 space-y-2">
            <div className="flex items-center gap-2 text-[#8e96e8]">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-[#f2f5f1]">1. Discord Quests</h3>
            </div>
            <p className="text-xs text-[#9aa8a0] leading-relaxed">
              Tự động nhận nhiệm vụ, gửi heartbeat mô phỏng tự nhiên và nhận quà tặng (avatar, khung viền, vật phẩm).
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <div className="flex items-center gap-2 text-[#72b991]">
              <Tv className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-[#f2f5f1]">2. Treo Stream Voice 5.000h</h3>
            </div>
            <p className="text-xs text-[#9aa8a0] leading-relaxed">
              Phát luồng âm thanh/video vào phòng thoại 24/7 với 2 nguồn chọn sẵn hoặc URL tùy biến, tự động kết nối lại khi rớt mạng.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <div className="flex items-center gap-2 text-[#d7ad69]">
              <Cpu className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-[#f2f5f1]">3. Cày Giờ Chơi Hồ Sơ</h3>
            </div>
            <p className="text-xs text-[#9aa8a0] leading-relaxed">
              Tích lũy giờ chơi và đánh dấu hơn 1.000+ tựa game vào hồ sơ cá nhân Discord một cách nhẹ nhàng.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="sec-architecture"
        title="Kiến trúc Gateway & Cổng kết nối"
        description="Các cổng dịch vụ hoạt động độc lập nhằm bảo đảm hiệu năng tối đa."
      >
        <div className="surface rounded-xl overflow-hidden divide-y divide-[#2d3b33]">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <span className="font-semibold text-[#f2f5f1]">Cổng :5173 (TCP) • Frontend Web</span>
            <span className="text-[#9aa8a0]">Giao diện người dùng tối ưu hóa, hỗ trợ di động và máy tính</span>
            <span className="text-[#8e96e8]">React + Vite</span>
          </div>
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <span className="font-semibold text-[#f2f5f1]">Cổng :3001 (TCP/WS) • Quest Service</span>
            <span className="text-[#9aa8a0]">REST API OAuth2, Quests Heartbeat và WebSocket thời gian thực</span>
            <span className="text-[#72b991]">Go Engine</span>
          </div>
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <span className="font-semibold text-[#f2f5f1]">Cổng :3000 (TCP/WS) • Stream Voice Service</span>
            <span className="text-[#9aa8a0]">Quản lý luồng phát Voice, FFmpeg, yt-dlp và viewer auto-watch</span>
            <span className="text-[#8e96e8]">Go Voice Engine</span>
          </div>
        </div>
      </Section>

      <Section
        id="sec-security"
        title="Nguyên tắc an toàn & Chống khóa tài khoản"
        description="Biện pháp kỹ thuật loại bỏ nguyên nhân gây cảnh báo bảo mật từ Discord."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f2f5f1] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#72b991]" />
              <span>Xử lý Dứt điểm Mã Đóng (Close Codes)</span>
            </h3>
            <p className="text-xs text-[#9aa8a0] leading-relaxed">
              Khi Gateway nhận mã lỗi 4003 (Not Authenticated) hoặc 4004 (Authentication Failed), hệ thống dừng ngay lập tức thay vì cố gắng reconnect liên tục — ngăn chặn triệt để thuật toán bảo vệ tài khoản kích hoạt yêu cầu đổi mật khẩu.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f2f5f1] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#8e96e8]" />
              <span>Nhịp Đập Tự Nhiên (Heartbeat Jitter)</span>
            </h3>
            <p className="text-xs text-[#9aa8a0] leading-relaxed">
              Các tín hiệu Gateway và tiến độ nhiệm vụ được điều phối với khoảng thời gian ngẫu nhiên (jitter) giống như người dùng thao tác thực tế.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f2f5f1] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#d7ad69]" />
              <span>Bảo Vệ Dữ Liệu Nội Bộ</span>
            </h3>
            <p className="text-xs text-[#9aa8a0] leading-relaxed">
              Mọi đường dẫn tệp tin, cấu trúc schema và thông tin nhạy cảm của máy chủ được bảo vệ nghiêm ngặt trên backend, không bao giờ gửi ra ngoài frontend.
            </p>
          </div>

          <div className="surface p-5 space-y-2">
            <h3 className="text-sm font-semibold text-[#f2f5f1] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#72b991]" />
              <span>Phân Tách Token Độc Lập</span>
            </h3>
            <p className="text-xs text-[#9aa8a0] leading-relaxed">
              Token cho Discord Quests và Token cho Treo Stream (1 Chính + 1 Phụ) được lưu trữ riêng biệt, không dùng chung kênh truyền thông.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default AboutPage;

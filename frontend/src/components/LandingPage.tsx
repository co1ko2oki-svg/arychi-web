import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
} from 'lucide-react';
import { AuthUser } from '../types';
import { NavTabId } from './Navbar';
import { StatusDot } from './ui';

interface LandingPageProps {
  onOpenLoginModal: () => void;
  onEnterDashboard?: () => void;
  user: AuthUser | null;
  questConnected: boolean;
  streamConnected: boolean;
  onNavigateTab?: (tab: NavTabId) => void;
}

// 10 Discord Stream Badge Tiers (Matching official Discord stream hours)
const STREAM_BADGE_TIERS = [
  { hours: '1h', title: 'Người mới', color: '#9aa8a0', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '5h', title: 'Chim non', color: '#8ec07c', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '20h', title: 'Đột phá', color: '#72b991', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '75h', title: 'Nổi bật', color: '#4ec9b0', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '150h', title: 'Người tạo xu hướng', color: '#56b6c2', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '300h', title: 'Tiêu điểm', color: '#61afef', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '500h', title: 'Ngôi sao', color: '#8e96e8', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '1.000h', title: 'Cảm giác', color: '#d172e8', bg: 'bg-[#1a231f]', isLocked: false },
  { hours: '2.000h', title: 'Nhà tiên tri', color: '#e06c75', bg: 'bg-[#1a231f]', isLocked: true },
  { hours: '5.000+h', title: 'Xuất thần', color: '#d7ad69', bg: 'bg-[#1a231f]', isLocked: true },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLoginModal,
  onEnterDashboard,
  user,
  questConnected,
  streamConnected,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const services = [
    {
      title: 'Discord Quests ✨',
      port: 'SĂN QUÀ DISCORD',
      summary:
        'Tự động cày 100% nhiệm vụ game Discord để nhận avatar độc quyền, khung viền hồ sơ và vật phẩm game mà không cần tải game.',
      specs: [
        'Chỉ cần nhập 1 Token Discord trong Dashboard',
        'Tự động nhận nhiệm vụ, xem video & báo cáo tiến trình',
      ],
      tech: 'Tự động 100% · Hỗ trợ Mobile & PC',
      icon: Sparkles,
    },
    {
      title: 'Treo Stream Voice 🎧',
      port: 'CHINH PHỤC 5.000H',
      summary:
        'Truyền phát video 24/7 với 2 nguồn có sẵn (Lofi Beats, Cozy Gaming) hoặc URL tùy chọn, tự động kết nối lại và cày giờ xem tài khoản phụ.',
      specs: [
        'Yêu cầu 2 Token: 1 Token Chính (Phát) + 1 Token Phụ (Xem)',
        'Tự động reconnect, loop liên tục & theo dõi tiến trình 10 cấp huy hiệu',
      ],
      tech: 'Âm thanh chất lượng cao · Reconnect thông minh',
      icon: Tv,
    },
    {
      title: 'Cày Giờ Chơi Game 🎮',
      port: 'HỒ SƠ DISCORD',
      summary:
        'Tự động tăng số giờ chơi cho các tựa game yêu thích và mở khóa danh sách 1.000+ tựa game hiển thị trên hồ sơ cá nhân Discord của bạn.',
      specs: [
        'Hỗ trợ Discord Token và Cookie xác thực',
        '2 nút bấm đơn giản: Cày giờ chơi & Đánh dấu 1.000+ Game',
      ],
      tech: 'An toàn · Không cần tải game',
      icon: Cpu,
    },
  ];

  const features = [
    {
      icon: Lock,
      tag: 'OAUTH2 AUTHENTICATION',
      title: 'Đăng nhập qua Discord OAuth2',
      desc: 'Người dùng xác thực tài khoản an toàn qua hệ thống Discord OAuth2 chính thức, không lưu trữ thông tin nhạy cảm.',
    },
    {
      icon: ShieldCheck,
      tag: 'HARDENED GATEWAY',
      title: 'Bảo vệ Gateway & Chống Khóa Tài Khoản',
      desc: 'Phân loại mã đóng kết nối (Close Codes), xử lý mã lỗi 4003/4004 dứt điểm, ngăn chặn vòng lặp reconnect gây yêu cầu đổi mật khẩu.',
    },
    {
      icon: Radio,
      tag: 'STREAM AUTOMATION',
      title: 'Tự Động Phát & Chinh Phục 5.000 Giờ',
      desc: 'Luồng phát stream được giám sát định kỳ, tự động kết nối lại khi rớt mạng, tích hợp theo dõi 10 cấp huy hiệu hiển thị trực quan.',
    },
    {
      icon: Terminal,
      tag: 'STREAMLINED CONTROLS',
      title: 'Giao Diện Điều Khiển Gọn Gàng',
      desc: 'Bảng điều khiển trực quan tách biệt cấu hình: 1 Token cho Quest, 2 Token cho Treo Stream và Token + Cookie cho Cày Giờ Chơi.',
    },
  ];

  const steps = [
    {
      step: 'BƯỚC 01',
      time: 'Xác thực',
      title: 'Đăng nhập OAuth2 Discord',
      desc: 'Đăng nhập an toàn qua OAuth2 chính thức để kết nối phiên làm việc của bạn.',
      cmdLabel: 'Trạng thái OAuth2',
      cmdValue: user ? `@${user.username}` : 'Chưa đăng nhập',
    },
    {
      step: 'BƯỚC 02',
      time: 'Cấu hình Token',
      title: 'Nhập Token Theo Tính Năng',
      desc: 'Nhập Token cho Quest hoặc 2 Token (Chính + Phụ) cho Treo Stream và bắt đầu điều khiển.',
      cmdLabel: 'Cơ chế hoạt động',
      cmdValue: 'Phân luồng độc lập',
    },
    {
      step: 'BƯỚC 03',
      time: 'Tự động 24/7',
      title: 'Tận Hưởng Kết Quả',
      desc: 'Máy chủ tự động xử lý nhiệm vụ, phát stream phòng thoại và tăng giờ chơi game đều đặn.',
      cmdLabel: 'Tiến độ',
      cmdValue: 'Thời gian thực',
    },
  ];

  const faqs = [
    {
      q: 'Làm thế nào để chinh phục huy hiệu Stream 5.000 giờ?',
      a: 'Bạn vào mục Treo Stream Voice, nhập Token tài khoản Chính (phát luồng) và Token tài khoản Phụ (xem luồng), cấu hình Server ID và Voice Channel ID, sau đó chọn nguồn phát (Lofi Beats Chill Stream hoặc Cozy Gaming Ambient Loop). Hệ thống sẽ tự động giữ luồng phát và tự kết nối lại nếu có gián đoạn.',
    },
    {
      q: 'Hệ thống có an toàn cho tài khoản Discord không?',
      a: 'Rất an toàn. Ứng dụng đã được rà soát và khắc phục triệt để lỗi reconnect vô hạn khi gặp lỗi 4003/4004 (nguyên nhân gây khóa bảo vệ mật khẩu), mô phỏng headers tự nhiên và tuân thủ yêu cầu Gateway của Discord.',
    },
    {
      q: 'Tại sao Treo Stream cần 2 Token (1 Chính + 1 Phụ)?',
      a: 'Theo cơ chế của Discord, thời gian stream chỉ được tính tích lũy khi có ít nhất 1 người dùng khác đang xem luồng stream của bạn trong phòng thoại. Do đó tài khoản Phụ đóng vai trò người xem để tài khoản Chính được cộng giờ hợp lệ.',
    },
    {
      q: 'Cày giờ chơi game hoạt động như thế nào?',
      a: 'Bạn chỉ cần nhập User Token và Cookie (cf_clearance), sau đó chọn số giờ muốn cày và bấm "Bắt đầu cày giờ chơi". Không cần mở game thật hay bật máy tính liên tục.',
    },
  ];

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section id="intro" className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#1a231f] border border-[#2d3b33] text-xs font-mono text-[#8e96e8]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bộ Tiện Ích Discord Chuyên Nghiệp ✨</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f2f5f1] tracking-tight leading-tight">
            Tự động hoá Discord Quests, Stream 5.000h &amp; Game Hồ Sơ
          </h1>

          <p className="text-sm sm:text-base text-[#9aa8a0] leading-relaxed max-w-xl">
            Nền tảng tự động nhận quà Discord Quests, duy trì luồng phát âm nhạc/video liên tục để chinh phục huy hiệu 5.000 giờ và tăng giờ chơi game an toàn 24/7.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onEnterDashboard ? (
              <button
                type="button"
                onClick={onEnterDashboard}
                className="btn-primary h-10 px-6 text-sm"
              >
                <span>Vào Dashboard ngay ✨</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            ) : null}

            {!user ? (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="btn-secondary h-10 px-5 text-sm"
              >
                <span>Đăng nhập Discord (OAuth2)</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#1a231f] border border-[#2d3b33] text-xs text-[#72b991] font-mono">
                <CheckCircle2 className="w-4 h-4 text-[#72b991]" />
                <span>Đã đăng nhập @{user.username}</span>
              </div>
            )}
          </div>

          <div className="pt-4 grid grid-cols-3 gap-4 max-w-md border-t border-[#2d3b33]">
            <div>
              <p className="text-lg font-bold font-mono text-[#f2f5f1]">100%</p>
              <p className="text-xs text-[#9aa8a0]">Tự động hoàn thành</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-[#8e96e8]">5.000h</p>
              <p className="text-xs text-[#9aa8a0]">Huy hiệu Stream Voice</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-[#72b991]">24/7</p>
              <p className="text-xs text-[#9aa8a0]">Chạy nền máy chủ</p>
            </div>
          </div>
        </div>

        {/* Telemetry Status Card */}
        <div className="surface p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#2d3b33]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#72b991]" />
              <span className="text-xs font-mono font-semibold text-[#f2f5f1]">
                HỆ THỐNG VẬN HÀNH
              </span>
            </div>
            <span className="text-xs font-mono text-[#8e96e8]">ONLINE 24/7</span>
          </div>

          <div className="divide-y divide-[#2d3b33]">
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#f2f5f1] truncate">
                    1. Discord Quests
                  </p>
                  <p className="text-xs font-mono text-[#9aa8a0] truncate">
                    Cổng :3001 • Nhận quà &amp; Avatar
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#f2f5f1] shrink-0">
                <StatusDot tone={questConnected ? 'ok' : 'error'} />
                {questConnected ? 'READY' : 'OFFLINE'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <Tv className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#f2f5f1] truncate">
                    2. Treo Stream Voice
                  </p>
                  <p className="text-xs font-mono text-[#9aa8a0] truncate">
                    Cổng :3000 • 2 Token Chính &amp; Phụ
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#f2f5f1] shrink-0">
                <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
                {streamConnected ? 'READY' : 'STANDBY'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#f2f5f1] truncate">
                    3. Cày Giờ Chơi Game
                  </p>
                  <p className="text-xs font-mono text-[#9aa8a0] truncate">
                    Mở khóa danh mục 1.000+ Game
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onEnterDashboard}
                className="btn-secondary btn-sm shrink-0"
              >
                <span>Mở Dash</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#8e96e8]" />
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#2d3b33] flex items-center justify-between text-xs font-mono text-[#9aa8a0]">
            <span>Phiên làm việc bảo mật</span>
            <button
              type="button"
              onClick={onEnterDashboard}
              className="link text-xs"
            >
              <span>Vào bảng điều khiển</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Stream Badge Showcase (10 Tiers) */}
      <section id="stream-badge" className="surface p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#2d3b33] pb-4">
          <div>
            <span className="text-xs font-mono text-[#8e96e8] uppercase tracking-wider font-semibold">
              Huy hiệu Stream Discord
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#f2f5f1] tracking-tight mt-1">
              Chinh phục 10 cấp độ huy hiệu Stream (1h → 5.000+h)
            </h2>
          </div>
          <p className="text-xs font-mono text-[#9aa8a0]">
            Cần ít nhất 1 người xem trong phòng thoại để tích lũy giờ
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STREAM_BADGE_TIERS.map((tier) => (
            <div
              key={tier.title}
              className="p-2.5 rounded-lg text-center space-y-1.5 hover:bg-[#212c27]/60 transition-colors"
            >
              {/* Computer monitor icon */}
              <div className="w-8 h-8 mx-auto flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tier.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6"
                >
                  <rect width="20" height="14" x="2" y="3" rx="2" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
              </div>
              <div className="text-xs font-semibold text-[#f2f5f1] truncate">{tier.title}</div>
              <div className="text-xs font-mono text-[#cbd5e1] font-semibold flex items-center justify-center gap-1">
                {tier.isLocked && <span className="text-xs">🔒</span>}
                <span>{tier.hours}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Modules Section */}
      <section id="modules" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-[#f2f5f1] tracking-tight">
            Các tính năng cốt lõi trên Arychi Suite
          </h2>
          <p className="text-xs font-mono text-[#9aa8a0]">
            Thiết kế tối ưu, điều khiển độc lập &amp; ổn định
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <div
                key={svc.title}
                className="surface-interactive p-6 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="icon-badge">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-medium text-[#8e96e8]">
                      {svc.port}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#f2f5f1]">{svc.title}</h3>
                    <p className="text-[13px] text-[#9aa8a0] leading-relaxed">{svc.summary}</p>
                  </div>

                  <ul className="pt-3 border-t border-[#2d3b33] space-y-2 text-xs text-[#9aa8a0]">
                    {svc.specs.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#72b991] shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-[#2d3b33] flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-[#9aa8a0]">{svc.tech}</span>
                  <button
                    type="button"
                    onClick={onEnterDashboard}
                    className="link"
                  >
                    <span>Mở trong Dash</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Architecture & Hardening Section */}
      <section id="architecture" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-[#f2f5f1] tracking-tight">
            Kiến trúc an toàn &amp; Bảo mật Discord
          </h2>
          <p className="text-xs font-mono text-[#9aa8a0]">
            Bảo vệ thông tin tài khoản • Tự động xử lý kết nối
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="surface-interactive p-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="icon-badge">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-[#f2f5f1]">{feat.title}</h3>
                  </div>
                  <span className="text-xs font-mono text-[#8e96e8] shrink-0 font-semibold">{feat.tag}</span>
                </div>
                <p className="text-[13px] text-[#9aa8a0] leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          {steps.map((item) => (
            <div key={item.step} className="surface p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8e96e8] font-semibold">{item.step}</span>
                  <span className="text-[#9aa8a0]">{item.time}</span>
                </div>
                <h3 className="text-base font-bold text-[#f2f5f1]">{item.title}</h3>
                <p className="text-[13px] text-[#9aa8a0] leading-relaxed">{item.desc}</p>
              </div>

              <div className="pt-3 border-t border-[#2d3b33] flex items-center justify-between text-xs font-mono">
                <span className="text-[#9aa8a0]">{item.cmdLabel}</span>
                <span className="text-[#72b991] font-semibold">{item.cmdValue}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-8 items-start">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-[#f2f5f1] tracking-tight">Câu hỏi thường gặp</h2>
          <p className="text-[13px] text-[#9aa8a0] leading-relaxed">
            Giải đáp các thắc mắc về cơ chế đăng nhập OAuth2, treo stream cày huy hiệu 5.000 giờ, săn quà Quests và tính an toàn của tài khoản.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={faq.q} className="surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full p-5 flex items-center justify-between gap-4 text-left"
                >
                  <span className="text-sm font-semibold text-[#f2f5f1]">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#8e96e8] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#9aa8a0] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-[#2d3b33]">
                    <p className="text-[13px] text-[#9aa8a0] leading-relaxed max-w-2xl">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;

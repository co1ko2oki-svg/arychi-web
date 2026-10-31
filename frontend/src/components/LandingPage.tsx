import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  KeyRound,
  Lock,
  QrCode,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
} from 'lucide-react';
import { AuthUser, PlanTierId, UserSubscription } from '../types';
import { NavTabId } from './Navbar';
import { SINGLE_PLAN_50K } from './SubscriptionModal';
import { StatusDot } from './ui';

interface LandingPageProps {
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal: (planId?: PlanTierId) => void;
  onEnterDashboard?: () => void;
  user: AuthUser | null;
  subscription: UserSubscription | null;
  questConnected: boolean;
  streamConnected: boolean;
  onNavigateTab?: (tab: NavTabId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLoginModal,
  onOpenSubscriptionModal,
  onEnterDashboard,
  user,
  subscription,
  questConnected,
  streamConnected,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const hasActivePlan = Boolean(subscription && subscription.isActive !== false);

  const services = [
    {
      title: 'Discord Quests (1 Token)',
      port: 'PORT :3001',
      summary:
        'Mô phỏng gói tin heartbeat 30 giây chuẩn Discord Desktop để hoàn thành nhiệm vụ tự động không cần tải game.',
      specs: [
        'Yêu cầu nhập 1 Token Acc Discord trong Dashboard',
        'Tự động nhận nhiệm vụ & Claim thưởng khi hoàn tất',
      ],
      tech: 'Node.js · Fastify · WS',
      icon: Sparkles,
    },
    {
      title: 'Treo Stream Voice (2 Token)',
      port: 'PORT :3000',
      summary:
        'Truyền phát trực tiếp YouTube, Twitch hoặc file MP4 vào kênh thoại bằng FFmpeg, tích hợp sẵn Viewer Farm.',
      specs: [
        'Yêu cầu 2 Token: 1 Token Chính (Stream) + 1 Token Phụ (Xem)',
        'Tự động duy trì thời lượng xem stream 24/7',
      ],
      tech: 'FFmpeg · yt-dlp · Opus',
      icon: Tv,
    },
    {
      title: 'Science Telemetry (1 Token)',
      port: 'PYTHON 3',
      summary:
        'Khởi tạo chữ ký nhị phân Windows PE gửi trực tiếp tới /api/v9/science nhằm cộng giờ chơi và mở khóa huy hiệu.',
      specs: [
        'Yêu cầu nhập 1 Token Acc Discord trong Dashboard',
        'Đa luồng song song tốc độ cao lên tới 5.000 giờ',
      ],
      tech: 'Python 3 · PE Spoofer',
      icon: Cpu,
    },
  ];

  const features = [
    {
      icon: Lock,
      tag: 'OAUTH2 AUTHENTICATION',
      title: 'Đăng nhập qua Bot Discord OAuth2 hoặc Google',
      desc: 'Tại tên miền chính arychi.xyz, người dùng xác thực định danh qua tính năng OAuth2 của Bot Discord hoặc đăng ký tài khoản bằng Google.',
    },
    {
      icon: QrCode,
      tag: 'VIETQR & PAYOS API',
      title: 'Tự động xác nhận & Cộng dồn theo tháng',
      desc: 'Tích hợp API VietQR và PayOS cho gói duy nhất 50.000đ/tháng. Tự động xác nhận giao dịch, cộng dồn số tháng và lưu trữ vào Database.',
    },
    {
      icon: ShieldCheck,
      tag: '2ND VERIFICATION',
      title: 'Chuyển hướng & Xác minh kép tại dash.arychi.xyz',
      desc: 'Khi truy cập bảng điều khiển dash.arychi.xyz, hệ thống thực hiện xác minh lần 2 trực tiếp với Database để đảm bảo tài khoản đã có gói hợp lệ.',
    },
    {
      icon: Terminal,
      tag: 'SIDEBAR BACKEND',
      title: 'Giao diện cột trái & Quản lý Token độc lập',
      desc: 'Bảng điều khiển cột trái trên dash.arychi.xyz tách biệt rõ cấu hình: 1 Token cho Quest/Giờ chơi và 2 Token (1 Chính + 1 Phụ) riêng cho Treo Stream.',
    },
  ];

  const steps = [
    {
      step: 'BƯỚC 01',
      time: 'arychi.xyz',
      title: 'Đăng nhập OAuth2 (Discord / Google)',
      desc: 'Xác thực tài khoản qua tính năng OAuth2 của Bot Discord hoặc đăng ký nhanh bằng tài khoản Google.',
      cmdLabel: 'Trạng thái OAuth2',
      cmdValue: user ? `@${user.username} (${user.provider.toUpperCase()})` : 'Chưa đăng nhập',
    },
    {
      step: 'BƯỚC 02',
      time: '50.000đ / 1 tháng',
      title: 'Thanh toán VietQR & PayOS',
      desc: 'Quét mã VietQR hoặc cổng PayOS cho gói duy nhất 50.000đ/tháng. Hệ thống tự xác nhận và cộng tháng vào Database.',
      cmdLabel: 'Trạng thái Gói',
      cmdValue: hasActivePlan ? `Còn ${subscription?.daysRemaining ?? 30} ngày` : 'Chưa kích hoạt gói 50k',
    },
    {
      step: 'BƯỚC 03',
      time: 'dash.arychi.xyz',
      title: 'Vào Dashboard & Nhập Token',
      desc: 'Chuyển hướng sang miền phụ dash.arychi.xyz, xác minh gói lần 2 và nhập 1 Token (Quest) hoặc 2 Token Chính/Phụ (Stream).',
      cmdLabel: 'Miền điều khiển',
      cmdValue: 'https://dash.arychi.xyz',
    },
  ];

  const faqs = [
    {
      q: 'Tại sao arychi.xyz chỉ hiển thị trang giới thiệu và bảng giá?',
      a: 'Theo kiến trúc bảo mật 2 tên miền của Arychi, tên miền chính arychi.xyz đóng vai trò cổng giới thiệu, đăng nhập OAuth2 (Bot Discord / Google) và thanh toán gói. Toàn bộ chức năng điều khiển backend nằm tại tên miền phụ dash.arychi.xyz.',
    },
    {
      q: 'Hệ thống có bao nhiêu gói dịch vụ và thanh toán như thế nào?',
      a: 'Arychi loại bỏ toàn bộ các gói phân mảnh và chỉ giữ lại duy nhất 1 gói 50.000đ / 1 tháng mở khóa 100% tính năng. Khi thanh toán qua API VietQR và PayOS, hệ thống tự động xác nhận và cộng dồn số tháng vào Database.',
    },
    {
      q: 'Quá trình chuyển hướng sang dash.arychi.xyz hoạt động ra sao?',
      a: 'Khi bạn bấm "Vào Dashboard (dash.arychi.xyz)", hệ thống chuyển hướng kèm phiên xác thực và kiểm tra lần thứ 2 đối chiếu với Database để chắc chắn tài khoản đã mua gói 50.000đ/tháng còn hiệu lực.',
    },
    {
      q: 'Tại sao tính năng Treo Stream cần nhập 2 Token (1 Chính và 1 Phụ)?',
      a: 'Trong bảng điều khiển bên cột trái của dash.arychi.xyz, tính năng Treo Stream sử dụng 1 Token Chính để vào kênh thoại phát video và 1 Token Phụ (Viewer Farm) tự động vào xem luồng phát đó nhằm cày giờ stream an toàn.',
    },
  ];

  return (
    <div className="space-y-20 py-6">
      <section id="intro" className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-200">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141927] border border-line text-blue-300 font-medium">
              arychi.xyz • Cổng Giới Thiệu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest :3001 {questConnected ? 'Online' : 'Offline'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
              Stream :3000 {streamConnected ? 'Live' : 'Standby'}
            </span>
          </div>

          <div className="space-y-3.5">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.15]">
              Hệ thống Tự động hóa Discord — Arychi Suite
            </h1>
            <p className="text-base text-slate-300 leading-relaxed">
              Đăng nhập bằng Bot Discord (OAuth2) hoặc tài khoản Google, kích hoạt gói duy nhất 50.000đ/tháng qua VietQR &amp; PayOS để truy cập trung tâm điều khiển tại miền phụ dash.arychi.xyz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {!user ? (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="btn-primary h-10 px-5 text-sm"
              >
                <span>1. Đăng nhập Discord OAuth2 / Google</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : !hasActivePlan ? (
              <button
                type="button"
                onClick={() => onOpenSubscriptionModal('monthly_50k')}
                className="btn-primary h-10 px-5 text-sm"
              >
                <QrCode className="w-4 h-4" />
                <span>2. Mua gói 50.000đ / 1 tháng (VietQR)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onEnterDashboard}
                className="btn-primary h-10 px-5 text-sm"
              >
                <span>Vào Dashboard (dash.arychi.xyz)</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenSubscriptionModal('monthly_50k')}
              className="btn-secondary h-10 px-4 text-sm"
            >
              <KeyRound className="w-4 h-4 text-blue-400" />
              <span>
                {hasActivePlan
                  ? `Gói 50k: Còn ${subscription?.daysRemaining ?? 30} ngày`
                  : 'Gói Full: 50.000đ / 1 tháng'}
              </span>
            </button>

            {user && (
              <button
                type="button"
                onClick={onEnterDashboard}
                className="btn-secondary h-10 px-4 text-sm"
              >
                <span>Chuyển tới dash.arychi.xyz</span>
                <ArrowUpRight className="w-4 h-4 text-blue-300" />
              </button>
            )}
          </div>

          <div className="pt-3 grid grid-cols-3 gap-4 max-w-md border-t border-line">
            <div>
              <p className="text-lg font-bold font-mono text-white">50.000đ</p>
              <p className="text-xs text-slate-300">1 Tháng / Full tính năng</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-blue-300">VietQR</p>
              <p className="text-xs text-slate-300">&amp; PayOS Tự xác nhận</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-white">2 Token</p>
              <p className="text-xs text-slate-300">Chính &amp; Phụ cho Stream</p>
            </div>
          </div>
        </div>

        <div className="surface p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="ml-1.5 text-xs font-mono font-semibold text-white">
                CỔNG XÁC MINH • ARYCHI.XYZ
              </span>
            </div>
            <span className="text-xs font-mono text-blue-300">
              {hasActivePlan ? 'READY FOR DASH' : 'YÊU CẦU GÓI 50K'}
            </span>
          </div>

          <div className="divide-y divide-line">
            <div className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    1. Đăng nhập OAuth2 (Discord / Google)
                  </p>
                  <p className="text-xs font-mono text-slate-300 truncate">
                    {user
                      ? `Đã xác thực @${user.username} (${user.provider.toUpperCase()})`
                      : 'Cần đăng nhập qua Bot Discord hoặc Google'}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-200 shrink-0">
                <StatusDot tone={user ? 'ok' : 'warn'} />
                {user ? 'VERIFIED' : 'LOGIN'}
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    2. Gói 50.000đ / 1 tháng (Database)
                  </p>
                  <p className="text-xs font-mono text-slate-300 truncate">
                    {hasActivePlan
                      ? `Đang hoạt động • Còn ${subscription?.daysRemaining ?? 30} ngày`
                      : 'Tự động cộng tháng qua VietQR & PayOS'}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-200 shrink-0">
                <StatusDot tone={hasActivePlan ? 'ok' : 'error'} />
                {hasActivePlan ? 'ACTIVE' : '50K/MO'}
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    3. Chuyển hướng tới dash.arychi.xyz
                  </p>
                  <p className="text-xs font-mono text-slate-300 truncate">
                    Xác minh gói lần 2 &amp; mở giao diện cột trái
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onEnterDashboard}
                className="btn-secondary btn-sm shrink-0"
              >
                <span>Mở Dash</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-300" />
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-slate-300">
            <span>Đồng bộ trực tiếp vào Database</span>
            <button
              type="button"
              onClick={() =>
                !user
                  ? onOpenLoginModal()
                  : !hasActivePlan
                  ? onOpenSubscriptionModal('monthly_50k')
                  : onEnterDashboard?.()
              }
              className="link text-xs"
            >
              <span>
                {!user
                  ? 'Đăng nhập OAuth2 ngay'
                  : !hasActivePlan
                  ? 'Mua gói 50k/tháng'
                  : 'Truy cập dash.arychi.xyz'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section id="pricing" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Một Gói Duy Nhất — 50.000đ / 1 Tháng (Full Tính Năng)
          </h2>
          <p className="text-xs font-mono text-slate-300">
            Thanh toán tự động qua API VietQR &amp; PayOS • Cộng dồn theo tháng trong Database
          </p>
        </div>

        <div className="surface p-6 sm:p-8 border-blue-500/50 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-mono font-semibold">
                GÓI DUY NHẤT • FULL ACCESS
              </span>
              <span className="text-xs font-mono text-blue-300">
                TỰ ĐỘNG XÁC NHẬN VIETQR &amp; PAYOS
              </span>
            </div>

            <h3 className="text-2xl font-bold text-white">{SINGLE_PLAN_50K.name}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{SINGLE_PLAN_50K.summary}</p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {SINGLE_PLAN_50K.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-xs text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 rounded-xl bg-[#141722] border border-line space-y-5">
            <div className="space-y-1">
              <span className="text-xs font-mono text-slate-300">CHI PHÍ THUÊ BAO CỐ ĐỊNH</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-white">50.000đ</span>
                <span className="text-sm text-slate-300">/ 1 tháng (30 ngày)</span>
              </div>
              <p className="text-xs text-blue-300 font-mono">
                Hỗ trợ đăng ký nhiều tháng (cộng dồn trực tiếp vào Database)
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() =>
                  user ? onOpenSubscriptionModal('monthly_50k') : onOpenLoginModal()
                }
                className="btn-primary w-full h-10"
              >
                <QrCode className="w-4 h-4" />
                <span>
                  {!user
                    ? 'Đăng nhập OAuth2 để mua gói 50k'
                    : hasActivePlan
                    ? 'Gia hạn thêm tháng (+50.000đ/tháng)'
                    : 'Mua gói 50.000đ/tháng (VietQR / PayOS)'}
                </span>
              </button>

              <button
                type="button"
                onClick={onEnterDashboard}
                className="btn-secondary w-full h-10"
              >
                <span>Vào Dashboard (dash.arychi.xyz)</span>
                <ArrowUpRight className="w-4 h-4 text-blue-300" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Các chức năng cột trái trên dash.arychi.xyz
          </h2>
          <p className="text-xs font-mono text-slate-300">
            Nhập 1 Token cho Quest/Giờ chơi • Nhập 2 Token (1 Chính + 1 Phụ) cho Treo Stream
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
                    <span className="text-xs font-mono font-medium text-blue-300">
                      {svc.port}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">{svc.title}</h3>
                    <p className="text-[13px] text-slate-300 leading-relaxed">{svc.summary}</p>
                  </div>

                  <ul className="pt-3 border-t border-line space-y-2 text-xs text-slate-300">
                    {svc.specs.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-line flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-300">{svc.tech}</span>
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

      <section id="architecture" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Kiến trúc vận hành 2 tên miền &amp; Thanh toán tự động
          </h2>
          <p className="text-xs font-mono text-slate-300">
            arychi.xyz (Giới thiệu &amp; OAuth2) → dash.arychi.xyz (Xác minh lần 2 &amp; Điều khiển)
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
                    <h3 className="text-base font-bold text-white">{feat.title}</h3>
                  </div>
                  <span className="text-2xs font-mono text-blue-300 shrink-0">{feat.tag}</span>
                </div>
                <p className="text-[13px] text-slate-300 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          {steps.map((item) => (
            <div key={item.step} className="surface p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-blue-300 font-semibold">{item.step}</span>
                  <span className="text-slate-300">{item.time}</span>
                </div>
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-[13px] text-slate-300 leading-relaxed">{item.desc}</p>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">{item.cmdLabel}</span>
                <span className="text-blue-300 font-semibold">{item.cmdValue}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-8 items-start">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-white tracking-tight">Câu hỏi thường gặp</h2>
          <p className="text-[13px] text-slate-300 leading-relaxed">
            Giải đáp về cơ chế đăng nhập OAuth2, gói 50.000đ/tháng qua VietQR &amp; PayOS, xác minh kép tại dash.arychi.xyz và cách nhập Token.
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
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-blue-300 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-line">
                    <p className="text-[13px] text-slate-300 leading-relaxed">{faq.a}</p>
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

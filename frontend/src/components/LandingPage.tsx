import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  KeyRound,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
} from 'lucide-react';
import { AuthUser, PlanTierId, UserSubscription } from '../types';
import { NavTabId } from './Navbar';
import { PRICING_PLANS } from './SubscriptionModal';
import { StatusDot } from './ui';

interface LandingPageProps {
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal: (planId?: PlanTierId) => void;
  user: AuthUser | null;
  subscription: UserSubscription | null;
  questConnected: boolean;
  streamConnected: boolean;
  onNavigateTab?: (tab: NavTabId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLoginModal,
  onOpenSubscriptionModal,
  user,
  subscription,
  questConnected,
  streamConnected,
  onNavigateTab,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const navigateTo = (tab: NavTabId) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const services: Array<{
    title: string;
    port: string;
    summary: string;
    specs: string[];
    tech: string;
    action: string;
    tab: NavTabId;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      title: 'Quest Engine',
      port: 'PORT :3001',
      summary:
        'Mô phỏng gói tin heartbeat 30 giây theo chuẩn Discord Desktop để hoàn thành nhiệm vụ tự động mà không cần tải game.',
      specs: [
        'Giả lập tiến trình thực thi đa nhiệm',
        'Hỗ trợ dừng tức thì qua AbortController',
      ],
      tech: 'Node.js · Fastify · WS',
      action: 'Mở bảng nhiệm vụ',
      tab: 'quests',
      icon: Sparkles,
    },
    {
      title: 'StreamBot Voice',
      port: 'PORT :3000',
      summary:
        'Truyền phát trực tiếp YouTube, Twitch hoặc file MP4 vào kênh thoại bằng FFmpeg, tích hợp sẵn bộ đếm Viewer Farm.',
      specs: [
        'Mã hóa luồng H264 / Opus độ trễ thấp',
        'Tự động duy trì thời lượng xem stream',
      ],
      tech: 'FFmpeg · yt-dlp · Opus',
      action: 'Điều khiển phát luồng',
      tab: 'stream',
      icon: Tv,
    },
    {
      title: 'Science Telemetry',
      port: 'PYTHON 3',
      summary:
        'Khởi tạo chữ ký nhị phân Windows PE gửi trực tiếp tới /api/v9/science nhằm cộng giờ chơi và mở khóa huy hiệu hồ sơ.',
      specs: [
        'Đa luồng song song tốc độ cao',
        'Hỗ trợ cả CLI tự động & menu tương tác',
      ],
      tech: 'Python 3 · PE Spoofer',
      action: 'Tạo cấu hình cày giờ',
      tab: 'badges',
      icon: Cpu,
    },
  ];

  const features = [
    {
      icon: Lock,
      tag: 'BOT AUTHENTICATION',
      title: 'Liên kết tài khoản trực tiếp với Bot',
      desc: 'Hệ thống xác thực tài khoản Discord của bạn với Bot điều khiển và kiểm tra trạng thái gói dịch vụ trước khi kích hoạt luồng tự động.',
    },
    {
      icon: Terminal,
      tag: 'REALTIME WEBSOCKET',
      title: 'Giả lập chuẩn giao thức Desktop Client',
      desc: 'Tự động đồng bộ phiên bản build mới nhất từ Discord, gửi gói tin trạng thái theo chu kỳ 30 giây giúp tiến độ ghi nhận chính xác.',
    },
    {
      icon: Radio,
      tag: 'FFMPEG + OPUS',
      title: 'Truyền phát Voice Channel đa nguồn',
      desc: 'Giải mã luồng trực tiếp với binary FFmpeg và yt-dlp tích hợp sẵn, hỗ trợ phát lặp vô hạn và duy trì hiện diện trong phòng thoại.',
    },
    {
      icon: ShieldCheck,
      tag: 'LICENSE PROTECTION',
      title: 'Cơ chế cấp quyền theo Gói dịch vụ',
      desc: 'Mỗi gói bản quyền được định danh theo ID tài khoản Discord của người dùng, đảm bảo tài nguyên xử lý ổn định và riêng biệt.',
    },
  ];

  const steps = [
    {
      step: 'BƯỚC 01',
      time: 'Bắt buộc',
      title: 'Kết nối tài khoản với Bot',
      desc: 'Đăng nhập và liên kết tài khoản Discord của bạn với hệ thống Bot để đồng bộ danh sách nhiệm vụ và kênh thoại.',
      cmdLabel: 'Trạng thái Bot',
      cmdValue: user ? `Đã kết nối: @${user.username}` : 'Chưa kết nối tài khoản',
    },
    {
      step: 'BƯỚC 02',
      time: 'Kích hoạt',
      title: 'Mua & Kích hoạt Gói dịch vụ',
      desc: 'Lựa chọn gói Khởi Đầu (7 ngày), Chuyên Nghiệp (30 ngày) hoặc Vĩnh Viễn để mở khóa quyền thực thi tác vụ trên hệ thống.',
      cmdLabel: 'Bản quyền',
      cmdValue: subscription ? subscription.planName : 'Yêu cầu mua gói',
    },
    {
      step: 'BƯỚC 03',
      time: 'Tự động 24/7',
      title: 'Vận hành Quest & StreamBot',
      desc: 'Sau khi tài khoản đã liên kết với Bot và có gói hợp lệ, bạn có thể bấm chạy toàn bộ Discord Quests hoặc phát luồng tự động.',
      cmdLabel: 'Chu kỳ đồng bộ',
      cmdValue: 'Heartbeat: 30s Active',
    },
  ];

  const faqs = [
    {
      q: 'Làm thế nào để bắt đầu sử dụng các tính năng trên hệ thống?',
      a: 'Bạn cần thực hiện 2 bước: Đầu tiên bấm "Kết nối tài khoản với Bot" để xác thực tài khoản Discord, sau đó chọn và kích hoạt một gói dịch vụ (Khởi Đầu, Chuyên Nghiệp hoặc Vĩnh Viễn) để mở khóa bảng điều khiển.',
    },
    {
      q: 'Gói dịch vụ được tính thời hạn và gắn với tài khoản như thế nào?',
      a: 'Mỗi gói dịch vụ sau khi thanh toán hoặc nhập mã kích hoạt sẽ được gắn trực tiếp với Discord ID bạn đã kết nối với Bot. Bạn có thể chuyển đổi thiết bị mà không mất quyền lợi gói.',
    },
    {
      q: 'Tại sao làm nhiệm vụ Discord Quest không cần phải tải game?',
      a: 'Discord ghi nhận tiến độ nhiệm vụ dựa trên các gói tin telemetry định kỳ từ ứng dụng Desktop. Quest Engine mô phỏng chính xác cấu trúc gói tin này theo chu kỳ 30 giây.',
    },
    {
      q: 'Tôi có thể đóng tab trình duyệt khi nhiệm vụ đang chạy không?',
      a: 'Hoàn toàn được. Tiến trình Quest Engine và StreamBot chạy độc lập dưới nền hệ thống thông qua dịch vụ Bot, tab trình duyệt chỉ đóng vai trò bảng điều khiển.',
    },
  ];

  return (
    <div className="space-y-20 py-6">
      <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141927] border border-line text-blue-300 font-medium">
              Arychi Suite v2.0
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={questConnected ? 'ok' : 'error'} />
              Quest :3001 {questConnected ? 'Online' : 'Offline'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
              Stream :3000 {streamConnected ? 'Live' : 'Standby'}
            </span>
          </div>

          <div className="space-y-3.5">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.15] [text-wrap:balance]">
              Nền tảng tự động hóa Discord cục&nbsp;bộ
            </h1>
            <p className="text-base text-slate-300 leading-relaxed max-w-[52ch]">
              Kết nối tài khoản Discord với Bot và kích hoạt gói dịch vụ để tự động hoàn thành Discord Quests không cần cài game, phát video kênh thoại 24/7 và cày giờ chơi hồ sơ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="btn-primary h-10 px-5 text-sm"
            >
              <span>{user ? `Đã kết nối: @${user.username}` : '1. Kết nối Acc với Bot'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onOpenSubscriptionModal('pro')}
              className="btn-secondary h-10 px-4 text-sm"
            >
              <KeyRound className="w-4 h-4 text-blue-400" />
              <span>{subscription ? `Gói: ${subscription.planName}` : '2. Mua gói dịch vụ'}</span>
            </button>
          </div>

          <div className="pt-3 grid grid-cols-3 gap-4 max-w-md border-t border-line">
            <div>
              <p className="text-lg font-bold font-mono text-white">30s</p>
              <p className="text-xs text-slate-400">Chu kỳ Heartbeat</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-blue-300">2 Bước</p>
              <p className="text-xs text-slate-400">Kết nối Bot &amp; Mua gói</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-white">0 GB</p>
              <p className="text-xs text-slate-400">Dung lượng tải game</p>
            </div>
          </div>
        </div>

        <div className="surface p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="ml-1.5 text-xs font-mono font-semibold text-slate-200">
                TRẠNG THÁI TRUY CẬP &amp; BOT
              </span>
            </div>
            <span className="text-xs font-mono text-blue-300">
              {subscription ? 'ACTIVE LICENSE' : 'YÊU CẦU KÍCH HOẠT'}
            </span>
          </div>

          <div className="divide-y divide-line">
            <div className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">1. Liên kết Tài khoản &amp; Bot</p>
                  <p className="text-xs font-mono text-slate-400 truncate">
                    {user ? `Đã xác thực @${user.username}` : 'Cần kết nối Discord với Bot'}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-200 shrink-0">
                <StatusDot tone={user ? 'ok' : 'warn'} />
                {user ? 'CONNECTED' : 'PENDING'}
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">2. Gói bản quyền dịch vụ</p>
                  <p className="text-xs font-mono text-slate-400 truncate">
                    {subscription ? `${subscription.planName} (${subscription.priceLabel})` : 'Chưa kích hoạt gói dịch vụ'}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-200 shrink-0">
                <StatusDot tone={subscription ? 'ok' : 'error'} />
                {subscription ? 'ACTIVE' : 'LOCKED'}
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-badge">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">3. Hệ thống Engine (:3001 / :3000)</p>
                  <p className="text-xs font-mono text-slate-400 truncate">
                    Quest Daemon &amp; StreamBot Voice
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-300 shrink-0">
                <StatusDot tone={questConnected ? 'ok' : 'warn'} />
                {questConnected ? 'ONLINE' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Bảo mật xác thực theo Discord ID</span>
            <button
              type="button"
              onClick={() => (user ? onOpenSubscriptionModal('pro') : onOpenLoginModal())}
              className="link text-xs"
            >
              <span>{user ? 'Kích hoạt gói ngay' : 'Kết nối ngay'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Bảng giá &amp; Gói dịch vụ Bot
          </h2>
          <p className="text-xs font-mono text-slate-400">
            Yêu cầu kết nối tài khoản với Bot và kích hoạt gói để mở khóa tính năng
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING_PLANS.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            return (
              <div
                key={plan.id}
                className={`surface-interactive p-6 flex flex-col justify-between space-y-6 ${
                  plan.popular ? 'border-blue-500' : ''
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-blue-300">
                      {plan.durationLabel.toUpperCase()}
                    </span>
                    {plan.popular && (
                      <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-blue-600 text-white">
                        PHỔ BIẾN NHẤT
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-white">{plan.price}</span>
                      <span className="text-xs text-slate-400">/ {plan.durationLabel}</span>
                    </div>
                  </div>

                  <p className="text-[13px] text-slate-300 leading-relaxed max-w-[42ch]">
                    {plan.summary}
                  </p>

                  <ul className="pt-4 border-t border-line space-y-2.5 text-xs text-slate-200">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => onOpenSubscriptionModal(plan.id)}
                    className={`w-full ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <span>
                      {isCurrent
                        ? 'Đang sử dụng gói này'
                        : !user
                        ? 'Kết nối Bot & Mua gói'
                        : `Chọn ${plan.name}`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            3 Trụ cột tự động hóa chuyên biệt
          </h2>
          <p className="text-xs font-mono text-slate-400">
            Mỗi dịch vụ hoạt động độc lập, mở khóa ngay sau khi kích hoạt gói
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
                    <span className="text-xs font-mono font-semibold text-blue-300">
                      {svc.port}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">{svc.title}</h3>
                    <p className="text-[13px] text-slate-300 leading-relaxed max-w-[44ch]">
                      {svc.summary}
                    </p>
                  </div>

                  <ul className="pt-3 border-t border-line space-y-2 text-xs text-slate-300">
                    {svc.specs.map((spec) => (
                      <li key={spec} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-line flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">{svc.tech}</span>
                  <button
                    type="button"
                    onClick={() => navigateTo(svc.tab)}
                    className="link"
                  >
                    <span>{svc.action}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Đặc điểm kỹ thuật &amp; Cơ chế an toàn
          </h2>
          <p className="text-xs font-mono text-slate-400">
            Kiến trúc ưu tiên quyền riêng tư và hiệu năng hệ thống
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="surface-interactive p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="icon-badge">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-400">
                    {feat.tag}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">{feat.title}</h3>
                  <p className="text-[13px] text-slate-300 leading-relaxed max-w-[50ch]">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Quy trình bắt đầu trong 3 bước
          </h2>
          <p className="text-xs font-mono text-slate-400">
            Kết nối tài khoản với Bot và kích hoạt gói dịch vụ để mở khóa
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((item) => (
            <div
              key={item.step}
              className="surface-interactive p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-blue-300">
                    {item.step}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{item.time}</span>
                </div>
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-[13px] text-slate-300 leading-relaxed max-w-[44ch]">
                  {item.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">{item.cmdLabel}</span>
                <span className="text-slate-200 font-medium">{item.cmdValue}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-8 items-start">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Câu hỏi thường gặp
          </h2>
          <p className="text-[13px] text-slate-300 leading-relaxed max-w-[38ch]">
            Giải đáp nhanh về quy trình liên kết tài khoản với Bot, kích hoạt gói dịch vụ và cơ chế hoạt động ngầm.
          </p>

          <div className="surface p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-200 font-semibold">HỖ TRỢ KÍCH HOẠT 24/7</span>
              <span className="text-blue-300">AUTO VERIFY</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-[36ch]">
              Hệ thống tự động ghi nhận gói ngay sau khi bạn kết nối tài khoản Discord với Bot và xác nhận gói đăng ký.
            </p>
          </div>
        </div>

        <div className="space-y-3.5">
          {faqs.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className={`surface p-5 ${isOpen ? 'border-blue-500/60' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left flex items-center justify-between gap-4 text-sm font-semibold text-slate-100 hover:text-white transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 pt-3 border-t border-line text-[13px] text-slate-300 leading-relaxed max-w-[54ch]">
                    {item.a}
                  </p>
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

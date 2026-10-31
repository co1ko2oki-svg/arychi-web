import React, { useState } from 'react';
import { CheckCircle2, KeyRound, Lock, ShieldCheck, Sparkles, UserCheck, X } from 'lucide-react';
import { AuthUser, PlanTierId, UserSubscription } from '../types';
import { StatusDot } from './ui';

export interface PricingPlan {
  id: PlanTierId;
  name: string;
  durationLabel: string;
  price: string;
  popular?: boolean;
  summary: string;
  features: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Gói Khởi Đầu',
    durationLabel: '7 ngày sử dụng',
    price: '49.000đ',
    summary: 'Phù hợp trải nghiệm nhanh tự động hóa nhiệm vụ Discord trong tuần.',
    features: [
      'Liên kết 1 tài khoản Discord với Bot',
      'Tự động chạy Discord Quests (Heartbeat 30s)',
      'Hỗ trợ dừng tức thì & theo dõi tiến độ thực',
      'Science Telemetry cơ bản (tối đa 500 giờ)',
    ],
  },
  {
    id: 'pro',
    name: 'Gói Chuyên Nghiệp',
    durationLabel: '30 ngày sử dụng',
    price: '129.000đ',
    popular: true,
    summary: 'Giải pháp đầy đủ tính năng cho tài khoản chính hoạt động xuyên suốt.',
    features: [
      'Liên kết tài khoản Discord với Bot ưu tiên',
      'Toàn bộ tính năng Quest Engine & Auto-Claim',
      'Mở khóa StreamBot Voice 24/7 & Viewer Farm',
      'Science Telemetry đa luồng & 1.000 game đã chơi',
    ],
  },
  {
    id: 'lifetime',
    name: 'Gói Vĩnh Viễn',
    durationLabel: 'Bản quyền trọn đời',
    price: '349.000đ',
    summary: 'Thanh toán một lần, mở khóa không giới hạn toàn bộ module trọn đời.',
    features: [
      'Bản quyền vĩnh viễn gắn theo Discord ID',
      'Mở khóa toàn diện Quest, StreamBot & Science',
      'Cày tối đa 5.000 giờ chơi & 10 luồng song song',
      'Tự động đồng bộ Discord Build Number mới nhất',
    ],
  },
];

interface AccessGateBannerProps {
  user: AuthUser | null;
  subscription: UserSubscription | null;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal: (defaultPlan?: PlanTierId) => void;
  featureName?: string;
}

export const AccessGateBanner: React.FC<AccessGateBannerProps> = ({
  user,
  subscription,
  onOpenLoginModal,
  onOpenSubscriptionModal,
  featureName = 'tính năng tự động hóa',
}) => {
  const isConnected = Boolean(user);
  const hasPlan = Boolean(subscription && subscription.botConnected);

  if (isConnected && hasPlan && subscription) {
    return (
      <div className="surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-mono font-medium text-blue-300">
            <StatusDot tone="ok" />
            BOT ĐÃ LIÊN KẾT: @{user?.username}
          </span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-slate-300">
            GÓI HIỆN TẠI: <strong className="text-white">{subscription.planName.toUpperCase()}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-slate-400">
            KEY: {subscription.licenseKey}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenSubscriptionModal(subscription.planId)}
          className="btn-secondary btn-sm self-start sm:self-auto"
        >
          Quản lý gói dịch vụ
        </button>
      </div>
    );
  }

  return (
    <div className="surface p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400 shrink-0" />
            <h2 className="text-base font-bold text-white">
              Yêu cầu kết nối Bot &amp; kích hoạt gói để dùng {featureName}
            </h2>
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed max-w-[54ch]">
            Để hệ thống thực thi tác vụ cho tài khoản của bạn, vui lòng hoàn tất liên kết tài khoản Discord với Bot và kích hoạt gói bản quyền tương ứng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!isConnected ? (
            <button type="button" onClick={onOpenLoginModal} className="btn-primary">
              <span>Bước 1: Kết nối Acc với Bot</span>
            </button>
          ) : (
            <button type="button" onClick={() => onOpenSubscriptionModal('pro')} className="btn-primary">
              <span>Bước 2: Mua gói dịch vụ</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
        <div className="flex items-start gap-3">
          <div className="icon-badge">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-blue-300">BƯỚC 01</span>
              <span className="text-xs font-mono text-slate-400">
                {isConnected ? '• Đã hoàn tất' : '• Bắt buộc'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">
              {isConnected ? `Đã kết nối: @${user?.username}` : 'Kết nối tài khoản Discord với Bot'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-[44ch]">
              {isConnected
                ? `Tài khoản ID ${user?.id} đã được xác thực với hệ thống Bot cục bộ.`
                : 'Cung cấp xác thực để Bot nhận diện tài khoản Discord cần chạy nhiệm vụ và truyền phát.'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="icon-badge">
            <KeyRound className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-blue-300">BƯỚC 02</span>
              <span className="text-xs font-mono text-slate-400">
                {hasPlan ? '• Đã kích hoạt' : '• Chưa có gói'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">
              {hasPlan ? `Đã kích hoạt ${subscription?.planName}` : 'Đăng ký & Kích hoạt gói dịch vụ'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-[44ch]">
              Chọn gói Khởi Đầu (49k), Chuyên Nghiệp (129k) hoặc Vĩnh Viễn (349k) để mở khóa quyền điều khiển Bot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  subscription: UserSubscription | null;
  initialPlanId?: PlanTierId;
  onOpenLoginModal: () => void;
  onActivateSubscription: (sub: UserSubscription) => void;
  onDeactivateSubscription: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  user,
  subscription,
  initialPlanId = 'pro',
  onOpenLoginModal,
  onActivateSubscription,
  onDeactivateSubscription,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<PlanTierId>(initialPlanId);
  const [licenseInput, setLicenseInput] = useState('');
  const [activating, setActivating] = useState(false);

  if (!isOpen) return null;

  const selectedPlan = PRICING_PLANS.find((p) => p.id === selectedPlanId) || PRICING_PLANS[1];

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onClose();
      onOpenLoginModal();
      return;
    }

    setActivating(true);
    setTimeout(() => {
      const now = new Date();
      let expiresAt: string | null = null;
      if (selectedPlan.id === 'starter') {
        expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
      } else if (selectedPlan.id === 'pro') {
        expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      }

      const generatedKey =
        licenseInput.trim().toUpperCase() ||
        `ARYCHI-${selectedPlan.id.toUpperCase()}-${user.id.slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      onActivateSubscription({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        priceLabel: selectedPlan.price,
        activatedAt: now.toISOString(),
        expiresAt,
        botConnected: true,
        licenseKey: generatedKey,
      });
      setActivating(false);
      onClose();
    }, 350);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-2xl p-6 space-y-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
          <div className="space-y-1">
            <h2 id="sub-modal-title" className="text-lg font-bold text-white">
              Liên kết Bot &amp; Đăng ký Gói dịch vụ
            </h2>
            <p className="text-xs text-slate-300 max-w-[50ch]">
              Bản quyền gói được gắn trực tiếp với tài khoản Discord đã kết nối với hệ thống Bot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="btn-ghost btn-sm px-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line">
          <div className="space-y-0.5">
            <span className="text-xs font-mono text-slate-400">TRẠNG THÁI TÀI KHOẢN &amp; BOT</span>
            {user ? (
              <p className="text-sm font-semibold text-white">
                Đã kết nối: @{user.username} <span className="font-mono text-xs text-slate-400">(ID: {user.id})</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-rose-300">
                Chưa kết nối tài khoản Discord với Bot
              </p>
            )}
          </div>
          {!user && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLoginModal();
              }}
              className="btn-primary btn-sm"
            >
              Kết nối tài khoản ngay
            </button>
          )}
        </div>

        <div className="space-y-3">
          <label className="field-label">Chọn gói dịch vụ phù hợp</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRICING_PLANS.map((plan) => {
              const active = selectedPlanId === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    active
                      ? 'bg-[#151B2B] border-blue-500 text-white'
                      : 'bg-[#0A0C12] border-line text-slate-300 hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-blue-300">
                      {plan.durationLabel}
                    </span>
                    {plan.popular && (
                      <span className="text-xs font-mono text-white bg-blue-600 px-1.5 py-0.5 rounded">
                        HOT
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-white">{plan.name}</p>
                  <p className="mt-1 text-lg font-bold font-mono text-white">{plan.price}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-line space-y-2.5">
          <p className="text-xs font-mono text-slate-400 uppercase">
            Quyền lợi {selectedPlan.name} ({selectedPlan.price})
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
            {selectedPlan.features.map((feat) => (
              <li key={feat} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleActivate} className="pt-4 border-t border-line space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sub-transfer-syntax" className="field-label">
                Nội dung chuyển khoản tự động
              </label>
              <input
                id="sub-transfer-syntax"
                type="text"
                readOnly
                value={`ARYCHI ${user ? user.id.slice(-6) : 'DISCORD'} ${selectedPlan.id.toUpperCase()}`}
                className="input font-mono text-xs"
              />
              <p className="field-hint">MB Bank • 999988886666 • Tự động duyệt 24/7</p>
            </div>

            <div>
              <label htmlFor="sub-license-key" className="field-label">
                Mã kích hoạt (License Key nếu có)
              </label>
              <input
                id="sub-license-key"
                type="text"
                placeholder="VD: ARYCHI-PRO-2026"
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                className="input font-mono text-xs"
              />
              <p className="field-hint">Để trống nếu kích hoạt trực tiếp sau thanh toán</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {subscription ? (
              <button
                type="button"
                onClick={() => {
                  onDeactivateSubscription();
                  onClose();
                }}
                className="btn-danger btn-sm"
              >
                Hủy gói hiện tại ({subscription.planName})
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Bảo hành kích hoạt suốt thời hạn gói</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 ml-auto">
              <button type="button" onClick={onClose} className="btn-secondary">
                Đóng
              </button>
              <button
                type="submit"
                disabled={activating}
                className="btn-primary"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {!user
                    ? 'Kết nối tài khoản trước'
                    : activating
                    ? 'Đang kích hoạt...'
                    : `Mua & Kích hoạt ${selectedPlan.name} (${selectedPlan.price})`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Cpu,
  KeyRound,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
  X,
} from 'lucide-react';
import { AuthUser, PlanTierId, UserSubscription } from '../types';
import { NavTabId } from './Navbar';
import { StatusDot } from './ui';

interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  user: AuthUser;
  subscription: UserSubscription;
  hasQuestToken: boolean;
  hasStreamTokens: boolean;
  questConnected: boolean;
  streamConnected: boolean;
  runningQuestsCount: number;
  streamPlaying: boolean;
  onOpenLoginModal: () => void;
  onOpenSubscriptionModal: (planId?: PlanTierId) => void;
  onBackToLanding: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  subscription,
  hasQuestToken,
  hasStreamTokens,
  questConnected,
  streamConnected,
  runningQuestsCount,
  streamPlaying,
  onOpenLoginModal,
  onOpenSubscriptionModal,
  onBackToLanding,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{
    id: NavTabId;
    label: string;
    tokenHint: string;
    tokenReady: boolean;
    icon: React.ComponentType<{ className?: string }>;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'home',
      label: 'Tổng quan & Token',
      tokenHint: 'Quản lý Backend',
      tokenReady: hasQuestToken && hasStreamTokens,
      icon: LayoutDashboard,
    },
    {
      id: 'quests',
      label: 'Discord Quests',
      tokenHint: hasQuestToken ? 'Đã nhập 1 Token' : 'Yêu cầu 1 Token',
      tokenReady: hasQuestToken,
      icon: Sparkles,
      badge:
        runningQuestsCount > 0 ? (
          <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-2xs font-mono">
            {runningQuestsCount}
          </span>
        ) : undefined,
    },
    {
      id: 'stream',
      label: 'Treo Stream Voice',
      tokenHint: hasStreamTokens ? 'Đã nhập 2 Token' : 'Cần 2 Token (Chính+Phụ)',
      tokenReady: hasStreamTokens,
      icon: Tv,
      badge: streamPlaying ? <StatusDot tone="error" /> : undefined,
    },
    {
      id: 'badges',
      label: 'Giờ chơi (Science)',
      tokenHint: hasQuestToken ? 'Đã nhập 1 Token' : 'Yêu cầu 1 Token',
      tokenReady: hasQuestToken,
      icon: Cpu,
    },
    {
      id: 'logs',
      label: 'Nhật ký Backend',
      tokenHint: 'WebSocket Logs',
      tokenReady: true,
      icon: Terminal,
    },
    {
      id: 'about',
      label: 'Tài liệu kỹ thuật',
      tokenHint: 'Kiến trúc & Cổng',
      tokenReady: true,
      icon: BookOpen,
    },
  ];

  const handleSelect = (id: NavTabId) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 space-y-6">
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-600 text-white text-[13px] font-bold border border-blue-400/30">
              A
            </span>
            <div>
              <span className="text-sm font-bold text-white block leading-none">Arychi Dash</span>
              <span className="text-2xs font-mono text-blue-300">dash.arychi.xyz</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden btn-ghost btn-sm px-1.5"
            aria-label="Đóng menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-lg bg-[#141722] border border-line space-y-1.5">
          <div className="flex items-center justify-between text-2xs font-mono">
            <span className="text-blue-300 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              ĐÃ XÁC MINH LẦN 2
            </span>
            <span className="text-slate-200">50K/THÁNG</span>
          </div>
          <p className="text-xs text-slate-300 font-mono">
            Thời hạn còn: <strong className="text-white">{subscription.daysRemaining ?? 30} ngày</strong>
          </p>
        </div>

        <nav aria-label="Chức năng Backend cột trái" className="space-y-1">
          <p className="px-2 pb-1 text-2xs font-mono uppercase tracking-wider text-slate-300">
            CHỨC NĂNG HỆ THỐNG
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  active
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-[#141722] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-blue-300'}`} />
                  <div className="min-w-0">
                    <span className="block text-[13px] truncate">{item.label}</span>
                    <span
                      className={`block text-2xs font-mono truncate ${
                        active ? 'text-slate-100' : item.tokenReady ? 'text-blue-300' : 'text-slate-300'
                      }`}
                    >
                      {item.tokenHint}
                    </span>
                  </div>
                </div>
                {item.badge}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-line space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={questConnected ? 'ok' : 'error'} />
            Quest :3001
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
            Stream :3000
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[#141722] border border-line space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white truncate">@{user.username}</span>
            <span className="text-2xs font-mono text-blue-300 uppercase">{user.provider}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenSubscriptionModal('monthly_50k')}
              className="btn-secondary btn-sm flex-1 text-xs"
            >
              <KeyRound className="w-3 h-3 text-blue-300" />
              <span>+Tháng</span>
            </button>
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="btn-ghost btn-sm text-xs"
            >
              Đổi Acc
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToLanding}
          className="btn-ghost w-full justify-start text-xs text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về trang chủ arychi.xyz</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden sticky top-0 z-40 h-14 px-4 bg-[#07080C] border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold">
            A
          </span>
          <span className="text-sm font-bold text-white">dash.arychi.xyz</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="btn-secondary btn-sm"
        >
          <Menu className="w-4 h-4" />
          <span>Menu cột trái</span>
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-[#0B0D14] border-r border-line h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      <aside className="hidden lg:block w-68 shrink-0 bg-[#0B0D14] border-r border-line min-h-screen sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;

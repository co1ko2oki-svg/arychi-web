import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Cpu,
  LayoutDashboard,
  Menu,
  Sparkles,
  Terminal,
  Tv,
  X,
} from 'lucide-react';
import { AuthUser } from '../types';
import { NavTabId } from './Navbar';
import { StatusDot } from './ui';
import { BOT_AVATAR_URL } from '../constants/brand';

interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  user?: AuthUser | null;
  hasQuestToken: boolean;
  hasStreamTokens: boolean;
  questConnected: boolean;
  streamConnected: boolean;
  runningQuestsCount: number;
  streamPlaying: boolean;
  onOpenLoginModal: () => void;
  onBackToLanding: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  hasQuestToken,
  hasStreamTokens,
  questConnected,
  streamConnected,
  runningQuestsCount,
  streamPlaying,
  onOpenLoginModal,
  onBackToLanding,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const userNavItems: Array<{
    id: NavTabId;
    label: string;
    tokenHint: string;
    tokenReady: boolean;
    icon: React.ComponentType<{ className?: string }>;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'home',
      label: 'Tổng quan & Tiện ích',
      tokenHint: 'Trạng thái & Quản lý',
      tokenReady: hasQuestToken && hasStreamTokens,
      icon: LayoutDashboard,
    },
    {
      id: 'quests',
      label: 'Discord Quests ✨',
      tokenHint: hasQuestToken ? 'Sẵn sàng cày quà' : 'Cần 1 Token',
      tokenReady: hasQuestToken,
      icon: Sparkles,
      badge:
        runningQuestsCount > 0 ? (
          <span className="px-2 py-0.5 rounded-md bg-[#8e96e8]/20 text-[#8e96e8] border border-[#8e96e8]/30 text-xs font-mono font-bold">
            {runningQuestsCount} đang chạy
          </span>
        ) : undefined,
    },
    {
      id: 'stream',
      label: 'Treo Stream Voice 🎧',
      tokenHint: hasStreamTokens ? 'Đã sẵn sàng phát' : 'Cần 2 Token',
      tokenReady: hasStreamTokens,
      icon: Tv,
      badge: streamPlaying ? <span className="w-2 h-2 rounded-full bg-[#72b991] animate-ping" /> : undefined,
    },
    {
      id: 'badges',
      label: 'Cày Giờ Chơi Game 🎮',
      tokenHint: hasQuestToken ? 'Hồ sơ Discord' : 'Cần 1 Token',
      tokenReady: hasQuestToken,
      icon: Cpu,
    },
  ];

  const adminNavItems: Array<{
    id: NavTabId;
    label: string;
    tokenHint: string;
    tokenReady: boolean;
    icon: React.ComponentType<{ className?: string }>;
    badge?: React.ReactNode;
  }> =
    user?.role === 'admin'
      ? [
          {
            id: 'logs',
            label: 'Nhật ký Hệ thống',
            tokenHint: 'Chỉ Quản trị viên',
            tokenReady: true,
            icon: Terminal,
          },
          {
            id: 'about',
            label: 'Tài liệu Kỹ thuật',
            tokenHint: 'Kiến trúc & Cổng',
            tokenReady: true,
            icon: BookOpen,
          },
        ]
      : [];

  const handleSelect = (id: NavTabId) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  const renderNavButton = (item: typeof userNavItems[0]) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelect(item.id)}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
          active
            ? 'bg-[#212c27] text-[#f2f5f1] font-semibold border border-[#3b4c42]'
            : 'text-[#9aa8a0] hover:bg-[#1a231f] hover:text-[#f2f5f1]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#8e96e8]' : 'text-[#9aa8a0]'}`} />
          <div className="min-w-0">
            <span className="block text-[13px] truncate">{item.label}</span>
            <span
              className={`block text-xs font-mono truncate ${
                active ? 'text-[#8e96e8]' : item.tokenReady ? 'text-[#72b991]' : 'text-[#67756d]'
              }`}
            >
              {item.tokenHint}
            </span>
          </div>
        </div>
        {item.badge}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 space-y-6">
      <div className="space-y-4">
        {/* Brand header */}
        <div className="pb-4 border-b border-[#2d3b33] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#2d3b33] shrink-0 bg-[#1a231f]">
                <img
                  src={BOT_AVATAR_URL}
                  alt="Arychi Bot"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="text-sm font-bold text-[#f2f5f1] block leading-none">Arychi Suite</span>
                <span className="text-xs font-mono text-[#8e96e8]">dash.arychi.xyz</span>
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

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#72b991]/15 text-[#72b991] border border-[#72b991]/30 font-medium">
              Hoạt động 24/7 ✨
            </span>
            <span className="text-[#9aa8a0] text-xs font-mono">
              Bản quyền <strong className="text-[#f2f5f1] font-semibold">Chính thức</strong>
            </span>
          </div>
        </div>

        <nav aria-label="Chức năng chính" className="space-y-1">
          <p className="px-2 pb-1 text-xs font-mono uppercase tracking-wider text-[#67756d]">
            CHỨC NĂNG DÀNH CHO BẠN
          </p>
          {userNavItems.map(renderNavButton)}

          {adminNavItems.length > 0 && (
            <div className="pt-3 mt-3 border-t border-[#2d3b33] space-y-1">
              <p className="px-2 pb-1 text-xs font-mono uppercase tracking-wider text-[#d7ad69] flex items-center gap-1.5">
                <span>👑</span>
                <span>QUẢN TRỊ VIÊN (ADMIN)</span>
              </p>
              {adminNavItems.map(renderNavButton)}
            </div>
          )}
        </nav>
      </div>

      <div className="pt-4 border-t border-[#2d3b33] space-y-3">
        {/* Daemon status row */}
        <div className="flex items-center justify-between px-1 text-xs font-mono text-[#9aa8a0]">
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={questConnected ? 'ok' : 'error'} />
            Quest :3001
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={streamConnected ? 'ok' : 'warn'} />
            Stream :3000
          </span>
        </div>

        {/* User profile row */}
        <div className="flex items-center justify-between gap-3 px-1 py-1 bg-[#1a231f] rounded-lg border border-[#2d3b33] p-2">
          <div className="min-w-0 flex items-center gap-2">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.username || 'user'}
                className="w-8 h-8 rounded-full object-cover border border-[#2d3b33] shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#8e96e8] text-[#111714] font-bold text-xs grid place-items-center shrink-0">
                {(user?.username || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#f2f5f1] truncate max-w-[100px] flex items-center gap-1">
                <span>@{user?.username || 'khách'}</span>
                {user?.role === 'admin' && (
                  <span className="text-[#d7ad69] text-xs" title="Quản trị viên">
                    👑
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-[#72b991]">
                {user?.role === 'admin' ? 'Admin' : 'Thành viên'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenLoginModal}
            className="btn-ghost btn-sm text-xs px-2 py-1 rounded-md text-[#9aa8a0] hover:text-[#f2f5f1]"
            title="Đổi tài khoản"
          >
            Đổi Acc
          </button>
        </div>

        <button
          type="button"
          onClick={onBackToLanding}
          className="btn-ghost w-full justify-start text-xs text-[#9aa8a0] hover:text-[#f2f5f1] rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về trang chủ arychi.xyz</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden sticky top-0 z-40 h-14 px-4 bg-[#111714]/95 backdrop-blur-md border-b border-[#2d3b33] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#2d3b33] shrink-0 bg-[#1a231f]">
            <img
              src={BOT_AVATAR_URL}
              alt="Arychi Bot"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm font-bold text-[#f2f5f1]">Arychi Suite ✨</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="btn-secondary btn-sm"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-[#111714] border-r border-[#2d3b33] h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      <aside className="hidden lg:block w-64 shrink-0 bg-[#111714] border-r border-[#2d3b33] min-h-screen sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;

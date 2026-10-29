import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Info,
  Sparkles,
  Tv,
  Award,
  Terminal,
  User,
  X,
  ExternalLink,
} from 'lucide-react';
import { AuthUser } from '../types';

export type NavTabId = 'home' | 'about' | 'quests' | 'stream' | 'badges' | 'logs';

interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  user: AuthUser | null;
  questConnected: boolean;
  streamConnected: boolean;
  runningQuestsCount?: number;
  streamPlaying?: boolean;
  onOpenLoginModal: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  questConnected,
  streamConnected,
  runningQuestsCount = 0,
  streamPlaying = false,
  onOpenLoginModal,
  mobileOpen,
  onCloseMobile,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const navItems = [
    {
      id: 'home' as const,
      label: 'Tổng Quan',
      icon: LayoutDashboard,
      hash: '#home',
    },
    {
      id: 'about' as const,
      label: 'Giới Thiệu',
      icon: Info,
      hash: '#about',
    },
    {
      id: 'quests' as const,
      label: 'Nhiệm Vụ Discord',
      icon: Sparkles,
      hash: '#quests',
      badge: runningQuestsCount > 0 ? `${runningQuestsCount}` : undefined,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    },
    {
      id: 'stream' as const,
      label: 'StreamBot Voice',
      icon: Tv,
      hash: '#stream',
      badge: streamPlaying ? 'LIVE' : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'badges' as const,
      label: 'Cày Giờ Chơi',
      icon: Award,
      hash: '#badges',
    },
    {
      id: 'logs' as const,
      label: 'Nhật Ký Hệ Thống',
      icon: Terminal,
      hash: '#logs',
    },
  ];

  const handleNavClick = (id: NavTabId, hash: string) => {
    onSelectTab(id);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4 bg-[#101116] border-r border-white/[0.08] text-slate-200">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-slate-100 tracking-tight">Arychi</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-2 text-indigo-300 border border-indigo-500/30 font-semibold">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Discord Automation Suite</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 hover:bg-surface-2 rounded-lg"
            aria-label="Đóng thanh điều hướng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="space-y-1">
          <p className="px-2.5 pb-1.5 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wider">
            Điều Hướng
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={item.hash}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.id, item.hash);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1C1F28] text-slate-100 border border-white/[0.09] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161820]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="p-3 rounded-xl bg-[#161820] border border-white/[0.06] space-y-2">
          <p className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
            Trạng Thái Dịch Vụ
          </p>
          <div className="space-y-1.5 text-[11px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Quest (:3001)</span>
              <span className={`flex items-center gap-1.5 font-medium ${questConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                {questConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">StreamBot (:3000)</span>
              <span className={`flex items-center gap-1.5 font-medium ${streamConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
                {streamConnected ? (streamPlaying ? 'Streaming' : 'Idle') : 'Standby'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Science API</span>
              <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/[0.06]">
        {user ? (
          <button
            onClick={onOpenLoginModal}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-[#161820] hover:bg-[#1C1F28] border border-white/[0.06] transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <img
                src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                alt={user.username}
                className="w-7 h-7 rounded-full object-cover border border-emerald-500/40 shrink-0"
              />
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                  @{user.username}
                </p>
                <p className="text-[10px] text-emerald-400 font-mono">Đã xác thực</p>
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenLoginModal}
            className="w-full btn-primary py-2 text-xs"
          >
            <User className="w-3.5 h-3.5" />
            <span>Kết Nối Tài Khoản</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden flex"
          onClick={onCloseMobile}
        >
          <div
            className="w-72 h-full max-w-[85vw] shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

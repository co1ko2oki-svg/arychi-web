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
  ShieldCheck,
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
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-glow-sm',
    },
    {
      id: 'stream' as const,
      label: 'StreamBot Voice',
      icon: Tv,
      hash: '#stream',
      badge: streamPlaying ? 'LIVE' : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-glow-emerald',
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
    <div className="h-full flex flex-col justify-between p-4 bg-[#070910] border-r border-white/[0.08] text-slate-200 select-none">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-glow-sm border border-white/20">
              <Sparkles className="w-4 h-4 fill-white/20" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#070910]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-100 tracking-tight">Arychi</span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold tracking-wider">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight">Discord Automation Suite</p>
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
          <p className="px-2.5 pb-2 text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest">
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
                className={`relative flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#141828] text-white border border-indigo-500/30 shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-indigo-500 before:rounded-r'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="p-3.5 rounded-xl bg-[#0D101A] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
              Trạng Thái Dịch Vụ
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="space-y-2 text-[11px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Quest (:3001)</span>
              <span className={`flex items-center gap-1.5 font-medium ${questConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className="relative flex h-2 w-2">
                  {questConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                </span>
                {questConnected ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Stream (:3000)</span>
              <span className={`flex items-center gap-1.5 font-medium ${streamConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className="relative flex h-2 w-2">
                  {streamConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
                </span>
                {streamConnected ? (streamPlaying ? 'Streaming' : 'Idle') : 'Standby'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Science API</span>
              <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
                Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/[0.08]">
        {user ? (
          <button
            onClick={onOpenLoginModal}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#0D101A] hover:bg-[#141828] border border-white/[0.08] hover:border-indigo-500/30 transition-all text-left group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="relative shrink-0">
                <img
                  src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover border border-emerald-500/40"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0D101A]" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                  @{user.username}
                </p>
                <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> Đã xác thực
                </p>
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenLoginModal}
            className="w-full btn-primary py-2.5 text-xs"
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md lg:hidden flex"
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

import React from 'react';
import { Menu, Sparkles, User, ShieldCheck } from 'lucide-react';
import { AuthUser } from '../types';

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  user: AuthUser | null;
  onOpenLoginModal: () => void;
  questConnected: boolean;
  streamConnected: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMobileMenu,
  user,
  onOpenLoginModal,
  questConnected,
  streamConnected,
}) => {
  return (
    <header className="lg:hidden h-14 bg-[#070910]/90 backdrop-blur-md border-b border-white/[0.08] px-4 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Mở danh mục điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center text-white shadow-glow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-extrabold text-sm text-slate-100 tracking-tight">Arychi</span>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold">
            v2.0
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 text-[10px] font-mono pr-2.5 border-r border-white/[0.08]">
          <span className="relative flex h-2 w-2" title="Quest Engine (:3001)">
            {questConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${questConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          </span>
          <span className="relative flex h-2 w-2" title="StreamBot (:3000)">
            {streamConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${streamConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
          </span>
        </div>

        {user ? (
          <button
            onClick={onOpenLoginModal}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-indigo-500/40 transition-colors"
          >
            <span className="text-[11px] font-semibold text-slate-200 max-w-[90px] truncate hidden sm:inline">
              @{user.username}
            </span>
            <img
              src={user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt={user.username}
              className="w-6 h-6 rounded-full object-cover border border-emerald-500/40"
            />
          </button>
        ) : (
          <button
            onClick={onOpenLoginModal}
            className="btn-primary py-1.5 px-3 text-xs"
          >
            <User className="w-3.5 h-3.5" />
            <span>Kết Nối</span>
          </button>
        )}
      </div>
    </header>
  );
};

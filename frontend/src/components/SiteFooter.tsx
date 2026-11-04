import React from 'react';
import { NavTabId } from './Navbar';

interface SiteFooterProps {
  onNavigateTab: (tab: NavTabId) => void;
  onEnterDashboard?: () => void;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ onEnterDashboard }) => (
  <footer className="border-t border-[#2d3b33] bg-[#111714]">
    <div className="page py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9aa8a0]">
      <p>
        <span className="text-[#f2f5f1] font-semibold">Arychi Suite</span> — Hệ thống tự động hóa Discord Quests, Treo Stream 5.000h &amp; Game Hồ Sơ.
      </p>
      <nav aria-label="Liên kết cuối trang" className="flex items-center gap-4">
        <a href="#intro" className="hover:text-[#f2f5f1] transition-colors">
          Giới thiệu
        </a>
        <a href="#modules" className="hover:text-[#f2f5f1] transition-colors">
          Tính năng
        </a>
        <a href="#stream-badge" className="hover:text-[#f2f5f1] transition-colors">
          Huy hiệu 5.000h
        </a>
        <a href="#faq" className="hover:text-[#f2f5f1] transition-colors">
          Hỏi đáp
        </a>
        {onEnterDashboard && (
          <button
            type="button"
            onClick={onEnterDashboard}
            className="text-[#8e96e8] hover:text-[#f2f5f1] font-semibold transition-colors"
          >
            Vào Dashboard →
          </button>
        )}
      </nav>
    </div>
  </footer>
);

export default SiteFooter;

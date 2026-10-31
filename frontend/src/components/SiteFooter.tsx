import React from 'react';
import { NavTabId } from './Navbar';

interface SiteFooterProps {
  onNavigateTab: (tab: NavTabId) => void;
  onEnterDashboard?: () => void;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ onEnterDashboard }) => (
  <footer className="border-t border-line">
    <div className="page py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
      <p>
        <span className="text-white font-semibold">Arychi Suite 2.1</span> — arychi.xyz &amp;
        dash.arychi.xyz. Gói 20.000đ/tháng tự xác nhận qua VietQR &amp; PayOS.
      </p>
      <nav aria-label="Liên kết cuối trang" className="flex items-center gap-4">
        <a href="#intro" className="hover:text-white transition-colors">
          Giới thiệu
        </a>
        <a href="#pricing" className="hover:text-white transition-colors">
          Gói 20k/tháng
        </a>
        <a href="#faq" className="hover:text-white transition-colors">
          Hỏi đáp
        </a>
        {onEnterDashboard && (
          <button
            type="button"
            onClick={onEnterDashboard}
            className="text-blue-300 hover:text-white font-semibold transition-colors"
          >
            dash.arychi.xyz →
          </button>
        )}
      </nav>
    </div>
  </footer>
);

export default SiteFooter;

import React, { useState } from 'react';
import {
  Sparkles,
  Utensils,
  Database,
  Cpu,
  BookOpen,
  User,
  LogOut,
  Calendar,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'dashboard' | 'analytics' | 'generator' | 'explorer' | 'mlplab' | 'methodology';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  foodsCount: number;
  isBackendConnected: boolean;
  onOpenConnectionModal: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  foodsCount,
  isBackendConnected,
  onOpenConnectionModal,
  onOpenAuthModal,
}) => {
  const { user, isAuthenticated, logout, dbStatus } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard & 7-Day',
      icon: Calendar,
      color: 'text-teal-600',
    },
    {
      id: 'analytics' as ActiveTab,
      label: 'Health Rate Analytics',
      icon: Activity,
      color: 'text-emerald-600',
    },
    {
      id: 'generator' as ActiveTab,
      label: 'Meal Plan Generator',
      icon: Utensils,
      color: 'text-emerald-600',
    },
    {
      id: 'explorer' as ActiveTab,
      label: 'Food Explorer',
      icon: Database,
      color: 'text-blue-600',
      badge: foodsCount > 0 ? foodsCount.toLocaleString() : undefined,
    },
    {
      id: 'mlplab' as ActiveTab,
      label: 'MLP Classifier Lab',
      icon: Cpu,
      color: 'text-purple-600',
    },
    {
      id: 'methodology' as ActiveTab,
      label: 'Algorithms & Specs',
      icon: BookOpen,
      color: 'text-amber-600',
    },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-5">
      {/* Top Section: Branding & Navigation */}
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
              Diet Recommendation
            </h1>
          </div>
        </div>

        {/* User Profile Card / Login Button */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          {isAuthenticated && user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[11px] text-slate-500 mb-2">
                Sign in to save your preferences
              </p>
              <button
                type="button"
                onClick={() => {
                  onOpenAuthModal();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>Log In / Register</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Menu Navigation
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-bold shadow-xs border border-emerald-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : item.color}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header (only visible on mobile screens below lg) */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
            <Utensils className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm text-slate-900">Diet Recommendation</span>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay - Zero blur */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-over Drawer on the RIGHT side - Zero blur */}
      <div
        className={`lg:hidden fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop Fixed Right Side Panel (pinned, non-movable) */}
      <aside className="hidden lg:block fixed inset-y-0 right-0 w-72 bg-white border-l border-slate-200 z-30 shadow-xs">
        {sidebarContent}
      </aside>
    </>
  );
};

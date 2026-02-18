import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Repeat, LogOut, Menu, X, Cpu, ShieldCheck, Info, Globe, ChevronLeft, ChevronRight, Moon, Sun, Command, Bell, Search, Lock } from 'lucide-react';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useData } from './contexts/DataContext';

// Pages imports
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import DeviceManager from './components/DeviceManager';
import SimManager from './components/SimManager';
import UserManager from './components/UserManager';
import Operations from './components/Operations';
import AdminPanel from './components/AdminPanel';
import AccountManager from './components/AccountManager'; 
import SystemInfoModal from './components/SystemInfoModal';

const SidebarLink = ({ to, icon: Icon, label, collapsed, badge }: any) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `
      flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
      ${isActive 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-white'}
    `}
  >
    <Icon size={collapsed ? 24 : 20} className={`transition-transform duration-300 ${collapsed ? '' : 'group-hover:scale-110'}`} />
    {!collapsed && <span className="font-bold text-sm tracking-tight">{label}</span>}
    {!collapsed && badge && (
        <span className="ml-auto bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
            {badge}
        </span>
    )}
  </NavLink>
);

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'light');

  const { logout, user, isAdmin, isAuthenticated } = useAuth();
  const { settings, fetchData, devices, sims, users } = useData();
  const location = useLocation();

  useEffect(() => {
      if (isAuthenticated) fetchData(true); 
  }, [location.pathname, isAuthenticated]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleSidebar = () => {
      const newState = !isSidebarCollapsed;
      setIsSidebarCollapsed(newState);
      localStorage.setItem('sidebar_collapsed', String(newState));
  };

  if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] 
        ${isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} 
        w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm transform transition-all duration-500 ease-out lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className={`shrink-0 transition-all duration-500 ${isSidebarCollapsed ? 'p-6' : 'p-8'}`}>
          <div className="flex items-center space-x-3">
            <div className={`bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg p-3 rounded-2xl transition-all duration-500 ${isSidebarCollapsed ? 'rotate-12' : ''}`}>
              <Command className="text-white" size={isSidebarCollapsed ? 24 : 28} />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 animate-fade-in">
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">
                  {settings.appName || 'HELIOS'}
                </h1>
                <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">Asset Suite v3.5.9</p>
              </div>
            )}
          </div>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1.5">
          <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/devices" icon={Smartphone} label="Dispositivos" collapsed={isSidebarCollapsed} badge={devices.length} />
          <SidebarLink to="/users" icon={Users} label="Colaboradores" collapsed={isSidebarCollapsed} badge={users.filter(u=>u.active).length} />
          <SidebarLink to="/sims" icon={Cpu} label="SIM Cards / Chips" collapsed={isSidebarCollapsed} badge={sims.length} />
          <SidebarLink to="/accounts" icon={Globe} label="Licenças & Contas" collapsed={isSidebarCollapsed} />
          
          <div className={`my-6 border-t border-slate-100 dark:border-slate-800 mx-2 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}></div>
          
          <SidebarLink to="/operations" icon={Repeat} label="Movimentações" collapsed={isSidebarCollapsed} />
          
          {isAdmin && (
            <SidebarLink to="/admin" icon={ShieldCheck} label="Painel Admin" collapsed={isSidebarCollapsed} />
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 space-y-2">
          {!isSidebarCollapsed && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                      {user?.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{user?.name}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{user?.role}</p>
                  </div>
              </div>
          )}

          <button onClick={toggleSidebar} className="w-full hidden lg:flex items-center justify-center p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all">
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group">
            <LogOut size={20} />
            {!isSidebarCollapsed && <span className="font-bold text-sm">Encerrar Sessão</span>}
          </button>

          <button onClick={() => setIsAboutOpen(true)} className="w-full text-[9px] font-black text-slate-300 dark:text-slate-600 hover:text-indigo-600 uppercase tracking-widest flex items-center justify-center py-2">
            {!isSidebarCollapsed && 'System Info'} v3.5.9
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl">
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="hidden md:flex items-center gap-3 bg-slate-100 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <Search size={16} className="text-slate-400"/>
                <input type="text" placeholder="Busca global (Ativos, Pessoas...)" className="bg-transparent border-none outline-none text-xs font-medium w-64 text-slate-600 dark:text-slate-300 placeholder:text-slate-400"/>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={toggleTheme} className="p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
            <div className="flex items-center gap-3">
                <div className="flex flex-col text-right hidden sm:block">
                    <span className="text-xs font-bold text-slate-800 dark:text-white leading-none mb-1 block">Live Monitoring</span>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        Cloud Sync OK
                    </span>
                </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 custom-scrollbar relative">
          <div className="max-w-[1920px] mx-auto w-full p-8 lg:p-12 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {isAboutOpen && <SystemInfoModal onClose={() => setIsAboutOpen(false)} />}
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Layout><Dashboard /></Layout>} />
                <Route path="/devices" element={<Layout><DeviceManager /></Layout>} />
                <Route path="/sims" element={<Layout><SimManager /></Layout>} />
                <Route path="/users" element={<Layout><UserManager /></Layout>} />
                <Route path="/operations" element={<Layout><Operations /></Layout>} />
                <Route path="/accounts" element={<Layout><AccountManager /></Layout>} />
                <Route path="/admin" element={<Layout><AdminPanel /></Layout>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    </HashRouter>
  );
};

export default App;
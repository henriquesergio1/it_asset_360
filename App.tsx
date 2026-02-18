import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Repeat, LogOut, Menu, X, Cpu, ShieldCheck, Info, Globe, ChevronLeft, ChevronRight, Moon, Sun, Command, Bell, Search } from 'lucide-react';

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

const SidebarLink = ({ to, icon: Icon, label, collapsed }: { to: string; icon: any; label: string; collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `
        group flex items-center space-x-3 px-4 py-3 mx-2 rounded-xl transition-all duration-300 relative
        ${isActive 
          ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'} 
        ${collapsed ? 'justify-center px-2 space-x-0 mx-1' : ''}
      `}
      title={collapsed ? label : undefined}
    >
      <Icon size={20} className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
      {!collapsed && <span className="text-sm overflow-hidden whitespace-nowrap animate-fade-in">{label}</span>}
      {isActive && <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>}
    </NavLink>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'light');

  const { logout, user, isAdmin } = useAuth();
  const { settings, fetchData } = useData();
  const location = useLocation();

  useEffect(() => {
      fetchData(true); 
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 overflow-hidden font-sans">
      {/* Sidebar Helios */}
      <aside className={`fixed inset-y-0 left-0 z-[60] ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm transform transition-all duration-500 ease-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="hidden lg:flex absolute -right-3 top-10 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full p-1.5 border border-slate-200 dark:border-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all z-[70] shadow-md active:scale-90"
        >
          {isSidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>

        {/* Brand Area */}
        <div className={`shrink-0 transition-all duration-500 ${isSidebarCollapsed ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center space-x-3">
            <div className={`bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 transition-all duration-500 ${isSidebarCollapsed ? 'p-2.5 rounded-xl' : 'p-3 rounded-2xl'}`}>
              {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className={`${isSidebarCollapsed ? 'h-6 w-6' : 'h-8 w-8'} object-contain`} />
              ) : (
                  <Command className="text-white transition-all duration-500" size={isSidebarCollapsed ? 20 : 28} />
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 animate-fade-in">
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">
                  {settings.appName || 'HELIOS'}
                </h1>
                <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1">Asset Suite v3.5.7</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav Group */}
        <nav className="mt-2 flex-1 overflow-y-auto custom-scrollbar space-y-1">
          <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/devices" icon={Smartphone} label="Dispositivos" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/users" icon={Users} label="Colaboradores" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/sims" icon={Cpu} label="Chips / SIMs" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/accounts" icon={Globe} label="Licenças / Contas" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/operations" icon={Repeat} label="Movimentações" collapsed={isSidebarCollapsed} />
          
          {isAdmin && (
            <div className={`pt-6 mt-4 border-t border-slate-100 dark:border-slate-800 ${isSidebarCollapsed ? 'px-0' : 'px-4'}`}>
               {!isSidebarCollapsed && <p className="px-2 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-4">Administrativo</p>}
               <SidebarLink to="/admin" icon={ShieldCheck} label="Painel Admin" collapsed={isSidebarCollapsed} />
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 mt-auto">
          <div className={`bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 transition-all duration-500 ${isSidebarCollapsed ? 'p-2 items-center' : 'p-4'} flex flex-col gap-4`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between">
                <button onClick={() => setIsAboutOpen(true)} className="text-[10px] font-black text-slate-400 hover:text-helios-primary dark:hover:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Info size={14}/> v3.5.7
                </button>
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                </div>
              </div>
            )}
            <button 
              onClick={logout} 
              className={`flex items-center space-x-3 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors w-full ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? "Sair do Sistema" : undefined}
            >
              <LogOut size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span className="text-sm font-bold">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Topbar Helios */}
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 glass border-b border-slate-200 dark:border-slate-800 shrink-0 z-40 transition-colors duration-500">
          <div className="h-full px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-slate-600 dark:text-slate-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                <Menu size={24} />
              </button>
              
              <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-700 w-80 group focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                 <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                 <input type="text" placeholder="Busca global (Ctrl + K)" className="bg-transparent border-none outline-none px-3 text-sm w-full text-slate-900 dark:text-slate-100" />
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <button className="relative p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                <Bell size={22} />
                <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
              </button>

              <button 
                onClick={toggleTheme} 
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-amber-400 hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-95"
                title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>

              <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">{user?.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{user?.role === 'ADMIN' ? 'Administrator' : 'Operator'}</p>
                </div>
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 p-[2px] shadow-lg shadow-indigo-500/20">
                  <div className="h-full w-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-lg">
                    {user?.name.charAt(0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
          <div className="max-w-[1920px] mx-auto w-full p-8 lg:p-12 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {isAboutOpen && <SystemInfoModal onClose={() => setIsAboutOpen(false)} />}
    </div>
  );
};

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <Layout>{children}</Layout>;
};

const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
    const { isAuthenticated, isAdmin } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/" replace />;
    return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
    const { isAuthenticated } = useAuth();
    return (
        <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute><DeviceManager /></ProtectedRoute>} />
            <Route path="/sims" element={<ProtectedRoute><SimManager /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><AccountManager /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManager /></ProtectedRoute>} />
            <Route path="/operations" element={<ProtectedRoute><Operations /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

const App = () => {
  return (
    <HashRouter>
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    </HashRouter>
  );
};

export default App;
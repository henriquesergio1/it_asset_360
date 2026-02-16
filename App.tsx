
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Repeat, LogOut, Menu, X, Cpu, ShieldCheck, Info, Globe, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';

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

const SidebarLink = ({ to, icon: Icon, label, collapsed }: { to: string; icon: any; label: string; collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
      className={`flex items-center space-x-3 px-6 py-3 transition-all duration-200 ${isActive ? 'bg-blue-900 text-white border-l-4 border-blue-400' : 'text-gray-400 hover:bg-slate-800 hover:text-white'} ${collapsed ? 'justify-center px-0 space-x-0' : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="font-medium overflow-hidden whitespace-nowrap animate-fade-in">{label}</span>}
    </NavLink>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'light';
  });

  const { logout, user, isAdmin } = useAuth();
  const { settings, fetchData } = useData();
  const location = useLocation();

  // Sincronização por Navegação (On-Demand Sync)
  useEffect(() => {
      fetchData(true); // Sincroniza silenciosamente ao mudar de tela
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64 bg-slate-900 shadow-xl transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        
        {/* Toggle Button (Desktop Only) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="hidden lg:flex absolute -right-3 top-24 bg-blue-600 text-white rounded-full p-1 border-2 border-slate-900 hover:bg-blue-700 transition-all z-[60] shadow-lg active:scale-90"
        >
          {isSidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>

        {/* Logo Section */}
        <div className={`border-b border-slate-800 shrink-0 relative transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-8'}`}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`bg-blue-600 shadow-xl shadow-blue-900/40 transition-all duration-300 ${isSidebarCollapsed ? 'p-3 rounded-xl' : 'p-4 rounded-2xl'}`}>
              {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className={`${isSidebarCollapsed ? 'h-8' : 'h-14'} w-auto object-contain transition-all duration-300`} />
              ) : (
                  <Cpu className={`text-white transition-all duration-300 ${isSidebarCollapsed ? 'h-6 w-6' : 'h-10 w-10'}`} />
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="w-full animate-fade-in overflow-hidden">
                <h1 className="text-sm font-bold text-white leading-tight break-words px-1 tracking-tight">
                  {settings.appName}
                </h1>
                <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mt-1.5 opacity-60">IT Asset 360</p>
              </div>
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-gray-400 hover:text-white absolute top-4 right-4">
            <X size={24} />
          </button>
        </div>

        {/* Navigation - Mandatory Order (v2.12.39) */}
        <nav className="mt-4 flex-1 overflow-y-auto custom-scrollbar">
          <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/devices" icon={Smartphone} label="Dispositivos" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/users" icon={Users} label="Colaboradores" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/sims" icon={Cpu} label="Chips / SIMs" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/accounts" icon={Globe} label="Licenças / Contas" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/operations" icon={Repeat} label="Entrega / Devolução" collapsed={isSidebarCollapsed} />
          
          {isAdmin && (
            <div className={`pt-4 mt-4 border-t border-slate-800 ${isSidebarCollapsed ? 'px-0' : ''}`}>
               {!isSidebarCollapsed && <p className="px-6 text-xs text-slate-500 font-bold uppercase mb-2 animate-fade-in">Administrativo</p>}
               <SidebarLink to="/admin" icon={ShieldCheck} label="Administração" collapsed={isSidebarCollapsed} />
            </div>
          )}
        </nav>

        {/* Footer Info & Logout */}
        <div className={`border-t border-slate-800 bg-slate-950 shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-6'}`}>
          {!isSidebarCollapsed && (
              <div className="flex items-center gap-2 text-xs text-blue-400 mb-4 w-full animate-fade-in overflow-hidden whitespace-nowrap">
                 <span className="shrink-0"><Info size={14}/></span>
                 <span>Versão 2.12.39</span>
              </div>
          )}
          <button 
            onClick={logout} 
            className={`flex items-center space-x-3 text-gray-400 hover:text-white cursor-pointer transition-colors w-full pt-4 border-t border-slate-800 ${isSidebarCollapsed ? 'justify-center space-x-0' : ''}`}
            title={isSidebarCollapsed ? "Sair do Sistema" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="animate-fade-in overflow-hidden whitespace-nowrap">Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-slate-900 shadow-sm z-10 h-16 flex items-center justify-between px-6 shrink-0 transition-colors duration-300 border-b dark:border-slate-800">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <Menu size={24} />
          </button>
          
          <div className="flex items-center space-x-4 ml-auto">
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-amber-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-inner"
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{user?.name}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-500">{user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800">
              {user?.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-100 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-[1850px] mx-auto w-full p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return <Layout>{children}</Layout>;
};

const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
    const { isAuthenticated, isAdmin } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }
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

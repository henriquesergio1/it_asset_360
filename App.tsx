
import React, { useState, useEffect } from 'react';
import packageJson from './package.json';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Repeat, LogOut, Menu, X, Cpu, ShieldCheck, Info, Globe, ChevronLeft, ChevronRight, FileText, CheckSquare } from 'lucide-react';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useData } from './contexts/DataContext';
import { LicenseGuard } from './components/LicenseGuard';

// Pages imports
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import DeviceManager from './components/DeviceManager';
import SimManager from './components/SimManager';
import UserManager from './components/UserManager';
import Operations from './components/Operations';
import AdminPanel from './components/AdminPanel';
import AccountManager from './components/AccountManager'; 
import Reports from './components/Reports';
import TaskManager from './components/TaskManager';

const SidebarLink = ({ to, icon: Icon, label, collapsed }: { to: string; icon: any; label: string; collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
      className={`flex items-center space-x-3 px-6 py-3 transition-all duration-200 ${isActive ? 'bg-blue-900/20 text-blue-400 border-l-4 border-blue-600' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'} ${collapsed ? 'justify-center px-0 space-x-0' : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="font-medium overflow-hidden whitespace-nowrap">{label}</span>}
    </NavLink>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
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

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64 bg-slate-900 shadow-2xl transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-slate-800`}>
        
        {/* Toggle Button (Desktop Only) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="hidden lg:flex absolute -right-3 top-24 bg-blue-600 text-white rounded-full p-1 border-2 border-white hover:bg-blue-700 transition-all z-[60] shadow-lg active:scale-90"
        >
          {isSidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>

        {/* Logo Section */}
        <div className={`border-b border-slate-800 shrink-0 relative transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-8'}`}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`bg-blue-600 shadow-xl shadow-blue-900/20 transition-all duration-300 ${isSidebarCollapsed ? 'p-3 rounded-xl' : 'p-4 rounded-2xl'}`}>
              {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className={`${isSidebarCollapsed ? 'h-8' : 'h-14'} w-auto object-contain transition-all duration-300`} />
              ) : (
                  <Cpu className={`text-white transition-all duration-300 ${isSidebarCollapsed ? 'h-6 w-6' : 'h-10 w-10'}`} />
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="w-full overflow-hidden">
                <h1 className="text-sm font-bold text-slate-100 leading-tight break-words px-1 tracking-tight">
                  {settings.appName}
                </h1>
                <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mt-1.5 opacity-60">IT Asset 360 v3.11.4</p>
              </div>
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-200 absolute top-4 right-4">
            <X size={24} />
          </button>
        </div>

        {/* Navigation - Mandatory Order (v2.12.41) */}
        <nav className="mt-4 flex-1 overflow-y-auto custom-scrollbar">
          <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/devices" icon={Smartphone} label="Dispositivos" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/users" icon={Users} label="Colaboradores" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/sims" icon={Cpu} label="Chips / SIMs" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/accounts" icon={Globe} label="Licenças / Contas" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/tasks" icon={CheckSquare} label="Gestão de Tarefas" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/reports" icon={FileText} label="Relatórios" collapsed={isSidebarCollapsed} />
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
              <div className="flex items-center gap-2 text-xs text-blue-400 mb-4 w-full overflow-hidden whitespace-nowrap">
                 <span className="shrink-0"><Info size={14}/></span>
                 <span>Versão {packageJson.version}</span>
              </div>
          )}
          <button 
            onClick={logout} 
            className={`flex items-center space-x-3 text-slate-400 hover:text-slate-100 cursor-pointer transition-colors w-full pt-4 border-t border-slate-800 ${isSidebarCollapsed ? 'justify-center space-x-0' : ''}`}
            title={isSidebarCollapsed ? "Sair do Sistema" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="overflow-hidden whitespace-nowrap">Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-slate-900 z-10 h-16 flex items-center justify-between px-6 shrink-0 border-b border-slate-800">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-slate-400 hover:text-slate-200">
            <Menu size={24} />
          </button>
          
          <div className="flex items-center space-x-4 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-100">{user?.name}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 font-bold border border-blue-900/50 shadow-inner">
              {user?.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-950">
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
    const { isAuthenticated, user, isAdmin } = useAuth();
    const { tasks, addTask, updateTask, systemUsers, devices, models, assetTypes, settings } = useData();

    useEffect(() => {
        if (settings?.appName) {
            document.title = `IT Asset 360 - ${settings.appName}`;
        } else {
            document.title = 'IT Asset 360';
        }
    }, [settings?.appName]);

    return (
        <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute><DeviceManager /></ProtectedRoute>} />
            <Route path="/sims" element={<ProtectedRoute><SimManager /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><AccountManager /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManager /></ProtectedRoute>} />
            <Route path="/operations" element={<ProtectedRoute><Operations /></ProtectedRoute>} />
            <Route path="/tasks" element={
                <ProtectedRoute>
                    <TaskManager 
                        tasks={tasks} 
                        systemUsers={systemUsers}
                        devices={devices}
                        models={models}
                        assetTypes={assetTypes}
                        onAddTask={(t) => addTask(t, user?.name || 'Sistema')} 
                        onUpdateTask={(tid, u) => updateTask(tid, u, user?.name || 'Sistema')} 
                        currentUser={user?.name || 'Sistema'} 
                        isAdmin={isAdmin}
                    />
                </ProtectedRoute>
            } />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

const App = () => {
  return (
    <HashRouter>
        <AuthProvider>
            <LicenseGuard>
                <AppRoutes />
            </LicenseGuard>
        </AuthProvider>
    </HashRouter>
  );
};

export default App;

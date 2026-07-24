
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { APP_VERSION } from './constants';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Repeat, LogOut, Menu, X, Cpu, ShieldCheck, Info, Globe, ChevronLeft, ChevronRight, FileText, CheckSquare, Package, Calendar, Loader2, Calculator, MapPin, Navigation, TrendingUp, ClipboardList, BarChart3, Sliders, ShieldAlert } from 'lucide-react';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { hasPermission } from './utils/rbac';
import { useData } from './contexts/DataContext';
import { LicenseGuard } from './components/LicenseGuard';

// Pages imports
import Login from './components/Login';
import Dashboard from './components/Dashboard';
const DeviceManager = lazy(() => import('./components/DeviceManager'));
import SimManager from './components/SimManager';
const UserManager = lazy(() => import('./components/UserManager'));
import Operations from './components/Operations';
import AdminPanel from './components/AdminPanel';
import AccountManager from './components/AccountManager'; 
import Reports from './components/Reports';
import TaskManager from './components/TaskManager';
import Consumables from './components/Consumables';
import DigitalSignature from './components/DigitalSignature';
import { NotificationCenter } from './components/NotificationCenter';
import { ThemeToggle } from './components/ThemeToggle';

// RH Pages imports
import { RhDashboard } from './components/RhDashboard';
const RhCollaboratorManager = lazy(() => import('./components/RhCollaboratorManager').then(m => ({ default: m.RhCollaboratorManager })));
import { RhComodatoManager } from './components/RhComodatoManager';
import { RhOccurrenceManager } from './components/RhOccurrenceManager';
import { RhAssetManager } from './components/RhAssetManager';
import SystemInfoModal from './components/SystemInfoModal';
const FuelManager = lazy(() => import('./components/FuelManager'));

const SidebarLink = ({ to, icon: Icon, label, collapsed }: { to: string; icon: any; label: string; collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
      className={`flex items-center space-x-3 px-6 py-3 transition-all duration-200 ${isActive ? 'bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 border-l-4 border-blue-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:text-white'} ${collapsed ? 'justify-center px-0 space-x-0' : ''}`}
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
  const [isSystemInfoOpen, setIsSystemInfoOpen] = useState(false);
  
  const { logout, user, isAdmin } = useAuth();
  const { settings, fetchData } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const hasRhAccess = isAdmin || hasPermission(user, 'admin') || 
    hasPermission(user, 'rh_dashboard') || hasPermission(user, 'rh_dashboard_leitura') || 
    hasPermission(user, 'rh_colaboradores') || hasPermission(user, 'rh_colaboradores_leitura') || 
    hasPermission(user, 'rh_comodato') || hasPermission(user, 'rh_comodatos') || hasPermission(user, 'rh_comodato_leitura') || 
    hasPermission(user, 'rh_ocorrencias') || hasPermission(user, 'rh_atestados') || hasPermission(user, 'rh_ocorrencias_leitura') || 
    hasPermission(user, 'rh_modelos') || hasPermission(user, 'rh_modelos_leitura') || 
    hasPermission(user, 'rh_estoque') || hasPermission(user, 'rh_ativos') || hasPermission(user, 'rh_estoque_leitura') || 
    hasPermission(user, 'rh_relatorios') || hasPermission(user, 'rh_relatorios_leitura');

  const hasTiAccess = isAdmin || hasPermission(user, 'admin') || 
    hasPermission(user, 'dashboard_leitura') || hasPermission(user, 'dispositivos_leitura') || 
    hasPermission(user, 'colaboradores_leitura') || hasPermission(user, 'chips_leitura') || 
    hasPermission(user, 'licencas_leitura') || hasPermission(user, 'consumiveis_leitura') || 
    hasPermission(user, 'tarefas_leitura') || hasPermission(user, 'relatorios_leitura') || 
    hasPermission(user, 'entrega_leitura') || hasPermission(user, 'sistema_leitura');

  const hasFuelAccess = isAdmin || hasPermission(user, 'admin') || 
    hasPermission(user, 'moduloFuel360') || hasPermission(user, 'fuel360_leitura') || 
    hasPermission(user, 'reembolso_leitura');

  // Determinar módulo padrão com base no acesso
  const [currentModule, setCurrentModule] = useState<'TI' | 'RH' | 'FUEL'>(() => {
    const stored = localStorage.getItem('current_module');
    if (stored === 'FUEL' && hasFuelAccess) return 'FUEL';
    if (stored === 'RH' && hasRhAccess) return 'RH';
    if (stored === 'TI' && hasTiAccess) return 'TI';
    if (hasTiAccess) return 'TI';
    if (hasRhAccess) return 'RH';
    return 'FUEL';
  });

  const handleModuleSwitch = (mod: 'TI' | 'RH' | 'FUEL') => {
    setCurrentModule(mod);
    localStorage.setItem('current_module', mod);
    if (mod === 'RH') {
      navigate('/rh/dashboard');
    } else if (mod === 'FUEL') {
      navigate('/fuel360');
    } else {
      navigate('/');
    }
  };

  // Sincronização por Navegação (On-Demand Sync)
  useEffect(() => {
      fetchData(true); // Sincroniza silenciosamente ao mudar de tela
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (currentModule === 'RH' && !hasRhAccess) {
      if (hasTiAccess) { setCurrentModule('TI'); localStorage.setItem('current_module', 'TI'); }
      else if (hasFuelAccess) { setCurrentModule('FUEL'); localStorage.setItem('current_module', 'FUEL'); }
    } else if (currentModule === 'TI' && !hasTiAccess) {
      if (hasRhAccess) { setCurrentModule('RH'); localStorage.setItem('current_module', 'RH'); }
      else if (hasFuelAccess) { setCurrentModule('FUEL'); localStorage.setItem('current_module', 'FUEL'); }
    } else if (currentModule === 'FUEL' && !hasFuelAccess) {
      if (hasTiAccess) { setCurrentModule('TI'); localStorage.setItem('current_module', 'TI'); }
      else if (hasRhAccess) { setCurrentModule('RH'); localStorage.setItem('current_module', 'RH'); }
    }
  }, [user]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64 bg-white dark:bg-slate-800 shadow-2xl transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-slate-200 dark:border-slate-700`}>
        
        {/* Toggle Button (Desktop Only) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="hidden lg:flex absolute -right-3 top-24 bg-blue-600 text-white rounded-full p-1 border-2 border-white hover:bg-blue-700 transition-all z-[60] shadow-lg active:scale-90"
        >
          {isSidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>

        {/* Logo Section */}
        <div className={`border-b border-slate-200 dark:border-slate-700 shrink-0 relative transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-8'}`}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`bg-blue-600 shadow-xl shadow-blue-900/20 transition-all duration-300 ${isSidebarCollapsed ? 'p-3 rounded-xl' : 'p-4 rounded-2xl'}`}>
              {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className={`${isSidebarCollapsed ? 'h-8' : 'h-14'} w-auto object-contain transition-all duration-300`} />
              ) : (
                  <Cpu className={`text-slate-900 dark:text-white transition-all duration-300 ${isSidebarCollapsed ? 'h-6 w-6' : 'h-10 w-10'}`} />
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="w-full overflow-hidden">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight break-words px-1 tracking-tight">
                  {settings.appName}
                </h1>
                <p className="text-[11px] text-blue-600 dark:text-sky-400 font-bold uppercase tracking-wider mt-1.5 opacity-60">IT Asset 360 v{APP_VERSION}</p>
              </div>
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 absolute top-4 right-4">
            <X size={24} />
          </button>
        </div>

        {/* Module Switcher (Enterprise UI) */}
        {!isSidebarCollapsed && (
          <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5 text-center">Módulo Ativo</span>
            <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-xl gap-1">
              {hasTiAccess && (
                <button
                  onClick={() => handleModuleSwitch('TI')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${currentModule === 'TI' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  T.I.
                </button>
              )}
              {hasRhAccess && (
                <button
                  onClick={() => handleModuleSwitch('RH')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${currentModule === 'RH' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  R.H.
                </button>
              )}
              {hasFuelAccess && (
                <button
                  onClick={() => handleModuleSwitch('FUEL')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${currentModule === 'FUEL' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  FUEL
                </button>
              )}
            </div>
          </div>
        )}

        {isSidebarCollapsed && (
          <div className="p-2 border-b border-slate-200 dark:border-slate-700 shrink-0 flex justify-center">
            <button
              onClick={() => {
                const available: ('TI' | 'RH' | 'FUEL')[] = [];
                if (hasTiAccess) available.push('TI');
                if (hasRhAccess) available.push('RH');
                if (hasFuelAccess) available.push('FUEL');
                const nextIndex = (available.indexOf(currentModule) + 1) % available.length;
                handleModuleSwitch(available[nextIndex] || 'TI');
              }}
              className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black flex items-center justify-center border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400"
              title="Alternar Módulo"
            >
              {currentModule}
            </button>
          </div>
        )}

        {/* Navigation - Mandatory Order (v2.12.41) */}
        <nav className="mt-4 flex-1 overflow-y-auto custom-scrollbar">
          {currentModule === 'TI' ? (
            <>
              {hasPermission(user, 'dashboard_leitura') && <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'dispositivos_leitura') && <SidebarLink to="/devices" icon={Smartphone} label="Dispositivos" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'colaboradores_leitura') && <SidebarLink to="/users" icon={Users} label="Colaboradores" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'chips_leitura') && <SidebarLink to="/sims" icon={Cpu} label="Chips / SIMs" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'licencas_leitura') && <SidebarLink to="/accounts" icon={Globe} label="Licenças / Contas" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'consumiveis_leitura') && <SidebarLink to="/consumables" icon={Package} label="Consumíveis" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'tarefas_leitura') && <SidebarLink to="/tasks" icon={CheckSquare} label="Gestão de Tarefas" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'relatorios_leitura') && <SidebarLink to="/reports" icon={FileText} label="Relatórios" collapsed={isSidebarCollapsed} />}
              {hasPermission(user, 'entrega_leitura') && <SidebarLink to="/operations" icon={Repeat} label="Entrega / Devolução" collapsed={isSidebarCollapsed} />}
            </>
          ) : currentModule === 'RH' ? (
            <>
              {(isAdmin || hasPermission(user, 'admin') || hasPermission(user, 'rh_dashboard') || hasPermission(user, 'rh_dashboard_leitura')) && <SidebarLink to="/rh/dashboard" icon={LayoutDashboard} label="Dashboard R.H." collapsed={isSidebarCollapsed} />}
              {(isAdmin || hasPermission(user, 'admin') || hasPermission(user, 'rh_colaboradores') || hasPermission(user, 'rh_colaboradores_leitura')) && <SidebarLink to="/rh/collaborators" icon={Users} label="Colaboradores R.H." collapsed={isSidebarCollapsed} />}
              {(isAdmin || hasPermission(user, 'admin') || hasPermission(user, 'rh_comodato') || hasPermission(user, 'rh_comodatos') || hasPermission(user, 'rh_comodato_leitura')) && <SidebarLink to="/rh/comodato" icon={FileText} label="Termos de Comodato" collapsed={isSidebarCollapsed} />}
              {(isAdmin || hasPermission(user, 'admin') || hasPermission(user, 'rh_ocorrencias') || hasPermission(user, 'rh_atestados') || hasPermission(user, 'rh_ocorrencias_leitura')) && <SidebarLink to="/rh/occurrences" icon={Calendar} label="Faltas e Ocorrências" collapsed={isSidebarCollapsed} />}
              {(isAdmin || hasPermission(user, 'admin') || hasPermission(user, 'rh_estoque') || hasPermission(user, 'rh_ativos') || hasPermission(user, 'rh_estoque_leitura')) && <SidebarLink to="/rh/assets" icon={Package} label="Ativos e Consumíveis" collapsed={isSidebarCollapsed} />}
            </>
          ) : (
            <>
              <SidebarLink to="/fuel360/calculo" icon={Calculator} label="Cálculo Reembolso" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/roteirizador" icon={MapPin} label="Roteirizador" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/ajuste-rota" icon={Navigation} label="Ajuste de Rota" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/comparativo" icon={TrendingUp} label="Previsto x Realizado" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/simulacoes" icon={ClipboardList} label="Simulações / Histórico" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/equipe" icon={Users} label="Equipe & Setores" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/ausencias" icon={Calendar} label="Ausências" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/relatorios" icon={BarChart3} label="Relatórios BI" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/config" icon={Sliders} label="Parâmetros KM/L" collapsed={isSidebarCollapsed} />
              <SidebarLink to="/fuel360/admin" icon={ShieldAlert} label="Administração Fuel" collapsed={isSidebarCollapsed} />
            </>
          )}
          
          {(isAdmin || hasPermission(user, 'admin') || hasPermission(user, 'sistema_leitura')) && (
            <div className={`pt-4 mt-4 border-t border-slate-200 dark:border-slate-700 ${isSidebarCollapsed ? 'px-0' : ''}`}>
               {!isSidebarCollapsed && <p className="px-6 text-[11px] text-slate-500 dark:text-slate-400/80 font-bold uppercase mb-2 animate-fade-in">Administrativo</p>}
               <SidebarLink to="/admin" icon={ShieldCheck} label="Administração" collapsed={isSidebarCollapsed} />
            </div>
          )}
        </nav>

        {/* Footer Info & Logout */}
        <div className={`border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'p-4' : 'p-6'}`}>
          <div 
            onClick={() => setIsSystemInfoOpen(true)}
            className={`flex items-center gap-2 text-[11px] text-blue-600 dark:text-sky-400/80 hover:text-blue-800 dark:hover:text-sky-300 mb-4 w-full overflow-hidden whitespace-nowrap cursor-pointer transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title="Visualizar Informações do Sistema"
          >
             <span className="shrink-0"><Info size={14}/></span>
             {!isSidebarCollapsed && <span>Versão {APP_VERSION}</span>}
          </div>
          <button 
            onClick={logout} 
            className={`flex items-center space-x-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white cursor-pointer transition-colors w-full pt-4 border-t border-slate-200 dark:border-slate-700 ${isSidebarCollapsed ? 'justify-center space-x-0' : ''}`}
            title={isSidebarCollapsed ? "Sair do Sistema" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="overflow-hidden whitespace-nowrap">Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-slate-800 z-40 h-16 flex items-center justify-between px-6 shrink-0 border-b border-slate-200 dark:border-slate-700">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200">
            <Menu size={24} />
          </button>
          
          <div className="flex items-center space-x-4 ml-auto">
            <div 
              onClick={() => setIsSystemInfoOpen(true)}
              className="text-[10px] font-black text-slate-400 dark:text-slate-400/80 hover:text-indigo-500 cursor-pointer transition-all border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg uppercase tracking-wider hidden sm:block"
              title="Informações do Sistema"
            >
              v{APP_VERSION}
            </div>
            <ThemeToggle />
            <NotificationCenter />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400/80">{user?.Nome_Perfil || (user?.role === 'ADMIN' ? 'Administrador TI' : 'Operador Suporte')}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-sky-500/20 flex items-center justify-center text-blue-600 dark:text-sky-400 font-bold border border-blue-200 dark:border-sky-500/30 shadow-inner">
              {user?.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
          <div className="max-w-[1850px] mx-auto w-full p-6">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3 opacity-60">
                <Loader2 className="animate-spin text-blue-600 dark:text-sky-400" size={32} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Carregando Módulo...</span>
              </div>
            }>
              {children}
            </Suspense>
          </div>
        </main>
      </div>

      {isSystemInfoOpen && (
        <SystemInfoModal onClose={() => setIsSystemInfoOpen(false)} />
      )}
    </div>
  );
};

const ProtectedRoute = ({ children, module }: { children?: React.ReactNode; module?: 'TI' | 'RH' | 'FUEL' }) => {
    const { isAuthenticated, user, isAdmin } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const hasRhAccess = isAdmin || hasPermission(user, 'admin') || 
      hasPermission(user, 'rh_dashboard') || hasPermission(user, 'rh_dashboard_leitura') || 
      hasPermission(user, 'rh_colaboradores') || hasPermission(user, 'rh_colaboradores_leitura') || 
      hasPermission(user, 'rh_comodato') || hasPermission(user, 'rh_comodatos') || hasPermission(user, 'rh_comodato_leitura') || 
      hasPermission(user, 'rh_ocorrencias') || hasPermission(user, 'rh_atestados') || hasPermission(user, 'rh_ocorrencias_leitura') || 
      hasPermission(user, 'rh_modelos') || hasPermission(user, 'rh_modelos_leitura') || 
      hasPermission(user, 'rh_estoque') || hasPermission(user, 'rh_ativos') || hasPermission(user, 'rh_estoque_leitura') || 
      hasPermission(user, 'rh_relatorios') || hasPermission(user, 'rh_relatorios_leitura');

    const hasTiAccess = isAdmin || hasPermission(user, 'admin') || 
      hasPermission(user, 'dashboard_leitura') || hasPermission(user, 'dispositivos_leitura') || 
      hasPermission(user, 'colaboradores_leitura') || hasPermission(user, 'chips_leitura') || 
      hasPermission(user, 'licencas_leitura') || hasPermission(user, 'consumiveis_leitura') || 
      hasPermission(user, 'tarefas_leitura') || hasPermission(user, 'relatorios_leitura') || 
      hasPermission(user, 'entrega_leitura') || hasPermission(user, 'sistema_leitura');

    const hasFuelAccess = isAdmin || hasPermission(user, 'admin') || 
      hasPermission(user, 'moduloFuel360') || hasPermission(user, 'fuel360_leitura') || 
      hasPermission(user, 'reembolso_leitura');

    if (module === 'TI' && !hasTiAccess) {
        return <Navigate to={hasRhAccess ? "/rh/dashboard" : "/fuel360"} replace />;
    }
    if (module === 'RH' && !hasRhAccess) {
        return <Navigate to={hasTiAccess ? "/" : "/fuel360"} replace />;
    }
    if (module === 'FUEL' && !hasFuelAccess) {
        return <Navigate to={hasTiAccess ? "/" : "/rh/dashboard"} replace />;
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

    const hasRhAccess = isAdmin || hasPermission(user, 'admin') || 
      hasPermission(user, 'rh_dashboard') || hasPermission(user, 'rh_dashboard_leitura') || 
      hasPermission(user, 'rh_colaboradores') || hasPermission(user, 'rh_colaboradores_leitura') || 
      hasPermission(user, 'rh_comodato') || hasPermission(user, 'rh_comodatos') || hasPermission(user, 'rh_comodato_leitura') || 
      hasPermission(user, 'rh_ocorrencias') || hasPermission(user, 'rh_atestados') || hasPermission(user, 'rh_ocorrencias_leitura') || 
      hasPermission(user, 'rh_modelos') || hasPermission(user, 'rh_modelos_leitura') || 
      hasPermission(user, 'rh_estoque') || hasPermission(user, 'rh_ativos') || hasPermission(user, 'rh_estoque_leitura') || 
      hasPermission(user, 'rh_relatorios') || hasPermission(user, 'rh_relatorios_leitura');

    const hasTiAccess = isAdmin || hasPermission(user, 'admin') || 
      hasPermission(user, 'dashboard_leitura') || hasPermission(user, 'dispositivos_leitura') || 
      hasPermission(user, 'colaboradores_leitura') || hasPermission(user, 'chips_leitura') || 
      hasPermission(user, 'licencas_leitura') || hasPermission(user, 'consumiveis_leitura') || 
      hasPermission(user, 'tarefas_leitura') || hasPermission(user, 'relatorios_leitura') || 
      hasPermission(user, 'entrega_leitura') || hasPermission(user, 'sistema_leitura');

    return (
        <Routes>
            <Route path="/login" element={isAuthenticated ? (!hasTiAccess && hasRhAccess ? <Navigate to="/rh/dashboard" replace /> : <Navigate to="/" replace />) : <Login />} />
            <Route path="/" element={<ProtectedRoute module="TI">{!hasTiAccess && hasRhAccess ? <Navigate to="/rh/dashboard" replace /> : <Dashboard />}</ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute module="TI"><DeviceManager /></ProtectedRoute>} />
            <Route path="/sims" element={<ProtectedRoute module="TI"><SimManager /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute module="TI"><AccountManager /></ProtectedRoute>} />
            <Route path="/consumables" element={<ProtectedRoute module="TI"><Consumables /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute module="TI"><Reports /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute module="TI"><UserManager /></ProtectedRoute>} />
            <Route path="/operations" element={<ProtectedRoute module="TI"><Operations /></ProtectedRoute>} />
            <Route path="/tasks" element={
                <ProtectedRoute module="TI">
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
            
            {/* Módulo R.H. Routes */}
            <Route path="/rh/dashboard" element={<ProtectedRoute module="RH"><RhDashboard /></ProtectedRoute>} />
            <Route path="/rh/collaborators" element={<ProtectedRoute module="RH"><RhCollaboratorManager /></ProtectedRoute>} />
            <Route path="/rh/comodato" element={<ProtectedRoute module="RH"><RhComodatoManager /></ProtectedRoute>} />
            <Route path="/rh/occurrences" element={<ProtectedRoute module="RH"><RhOccurrenceManager /></ProtectedRoute>} />
            <Route path="/rh/assets" element={<ProtectedRoute module="RH"><RhAssetManager /></ProtectedRoute>} />

            {/* Módulo Fuel360 Routes */}
            <Route path="/fuel360" element={<Navigate to="/fuel360/calculo" replace />} />
            <Route path="/fuel360/:subView" element={<ProtectedRoute module="FUEL"><FuelManager /></ProtectedRoute>} />

            <Route path="/sign-term/:token" element={<DigitalSignature />} />
            <Route path="*" element={<Navigate to={!hasTiAccess && hasRhAccess ? "/rh/dashboard" : "/"} replace />} />
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

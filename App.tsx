
import React, { useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Users, Repeat, LogOut, Menu, X, Cpu, ShieldCheck, Info } from 'lucide-react';

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

const SidebarLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink to={to} className={`flex items-center space-x-3 px-6 py-3 transition-colors ${isActive ? 'bg-blue-900 text-white border-l-4 border-blue-400' : 'text-gray-400 hover:bg-slate-800 hover:text-white'}`}>
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </NavLink>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { logout, user, isAdmin } = useAuth();
  const { settings } = useData();

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 shadow-xl transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        
        {/* Logo Section */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
                <div className="bg-blue-600 p-2 rounded-lg">
                    <Cpu className="text-white h-6 w-6" />
                </div>
            )}
            <span className="text-xl font-bold text-white tracking-tight truncate">{settings.appName}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex-1 overflow-y-auto">
          <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" />
          <SidebarLink to="/devices" icon={Smartphone} label="Dispositivos" />
          <SidebarLink to="/sims" icon={Cpu} label="Chips / SIMs" />
          <SidebarLink to="/users" icon={Users} label="Colaboradores" />
          <SidebarLink to="/operations" icon={Repeat} label="Entrega/Devolução" />
          
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-800">
               <p className="px-6 text-xs text-slate-500 font-bold uppercase mb-2">Administrativo</p>
               <SidebarLink to="/admin" icon={ShieldCheck} label="Administração" />
            </div>
          )}
        </nav>

        {/* Footer Info & Logout */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 shrink-0">
          
          <div className="flex items-center gap-2 text-xs text-blue-400 mb-4 w-full">
             <span className="shrink-0"><Info size={14}/></span>
             <span>Versão 2.5.3</span>
          </div>

          <div className="mb-4">
             <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Desenvolvido por</p>
             <p className="text-sm font-medium text-slate-300">Sergio Oliveira</p>
          </div>

          <button onClick={logout} className="flex items-center space-x-3 text-gray-400 hover:text-white cursor-pointer transition-colors w-full pt-4 border-t border-slate-800">
            <LogOut size={20} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm z-10 h-16 flex items-center justify-between px-6">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
            <Menu size={24} />
          </button>
          
          <div className="flex items-center space-x-4 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200">
              {user?.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
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

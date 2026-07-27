
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Importacao } from './components/Importacao';
import { Configuracao } from './components/Configuracao';
import { AdminPanel } from './components/AdminPanel';
import { GestaoEquipe } from './components/GestaoEquipe';
import { Relatorios } from './components/Relatorios';
import { GestaoAusencias } from './components/GestaoAusencias';
import { Roteirizador } from './components/Roteirizador';
import { GestaoSimulacoes } from './components/GestaoSimulacoes'; 
import { PrevistoVsRealizado } from './components/PrevistoVsRealizado'; // Importado
import { AjusteRota } from './components/AjusteRota'; // Novo
import { Login } from './components/Login';
import { DataProvider, DataContext } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FuelLogo, CogIcon, UserGroupIcon, CalculatorIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ExclamationIcon, UsersIcon, ChartBarIcon, CalendarIcon, LocationMarkerIcon, ClipboardListIcon, PresentationChartLineIcon, TruckIcon } from './components/icons';
import { getSystemStatus } from './services/apiService';
import { LicenseStatus } from './types';
import { SYSTEM_VERSION } from './constants';

type View = 'calculo' | 'roteirizador' | 'ajuste_rota' | 'simulacoes' | 'comparativo' | 'equipe' | 'ausencias' | 'relatorios' | 'config' | 'admin';

interface SidebarProps {
    activeView: View;
    setView: (view: View) => void;
    isCollapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    licenseStatus: LicenseStatus | null;
}

interface NavItem {
    id: View;
    label: string;
    icon: React.FC<any>;
    alertCount?: number;
    alertColor?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setView, isCollapsed, setCollapsed, licenseStatus }) => {
    const { systemConfig, colaboradores } = useContext(DataContext);
    const { user, logout } = useAuth();
    
    // Lógica Reforçada: Conta colaboradores ATIVOS que NÃO possuem endereço válido OU têm pendência marcada
    const pendingAddresses = useMemo(() => {
        if (!colaboradores || !Array.isArray(colaboradores)) return 0;
        return colaboradores.filter(c => {
            const isActive = c.Ativo === true || Number(c.Ativo) === 1;
            const hasAddress = c.EnderecoBase && c.EnderecoBase.trim().length > 3;
            const isFlagged = c.EnderecoPendente === true || Number(c.EnderecoPendente) === 1;
            return isActive && (!hasAddress || isFlagged);
        }).length;
    }, [colaboradores]);

    const navItems: NavItem[] = [
        { id: 'calculo', label: 'Cálculo de Reembolso', icon: CalculatorIcon },
        { id: 'roteirizador', label: 'Roteirizador Previsto', icon: LocationMarkerIcon },
        { id: 'ajuste_rota', label: 'Ajuste de Rota', icon: TruckIcon },
        { id: 'comparativo', label: 'Previsto x Realizado', icon: PresentationChartLineIcon }, // Novo Item de Menu
        { id: 'simulacoes', label: 'Gestão de Simulações e Cálculos', icon: ClipboardListIcon },
        { 
            id: 'equipe', 
            label: 'Equipe & Setores', 
            icon: UsersIcon,
            alertCount: pendingAddresses,
            alertColor: 'bg-red-500'
        },
        { id: 'ausencias', label: 'Gestão de Ausências', icon: CalendarIcon },
        { id: 'relatorios', label: 'Relatórios', icon: ChartBarIcon },
        { id: 'config', label: 'Parâmetros KM/L', icon: CogIcon },
    ];

    if (user?.Perfil === 'Admin') {
        // @ts-ignore
        navItems.push({ id: 'admin', label: 'Administração', icon: UserGroupIcon });
    }

    const renderLicenseAlert = () => {
        if (!licenseStatus || !licenseStatus.expiresAt) return null;
        const today = new Date();
        const expireDate = new Date(licenseStatus.expiresAt);
        const diffDays = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 15) return null;
        let colorClass = 'bg-amber-50 text-amber-600 border-amber-200';
        let text = `Vence em ${diffDays} dias`;
        if (diffDays <= 5) colorClass = 'bg-red-50 text-red-500 border-red-200';
        if (diffDays < 0) { text = "Licença Expirada"; colorClass = 'bg-red-600 text-white border-red-700'; }

        if (isCollapsed) {
            return <div className={`mt-2 w-6 h-6 rounded-full flex items-center justify-center ${diffDays < 0 ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-700'} animate-pulse text-xs font-bold`}>!</div>;
        }
        return <div className={`mt-4 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide border flex items-center justify-center w-full animate-pulse cursor-help ${colorClass}`} onClick={() => setView('admin')}><ExclamationIcon className="w-3 h-3 mr-2" />{text}</div>;
    };

    return (
        <div className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative z-20 ${isCollapsed ? 'w-20' : 'w-72'} shadow-sm print:hidden`}>
            {/* Header */}
            <div className={`flex items-center justify-center py-8 ${isCollapsed ? 'px-1' : 'px-6'}`}>
                <FuelLogo className={`transition-all duration-300 ${isCollapsed ? 'h-8 w-8' : 'h-9 w-9 mr-3'}`} />
                <h1 className={`text-xl font-bold text-slate-800 tracking-tight transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                    Fuel<span className="text-blue-600">360</span>
                </h1>
            </div>

            {/* User / Company Info */}
            <div className={`flex flex-col items-center justify-center mb-10 transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-6'}`}>
                {systemConfig.logoUrl ? (
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-tr from-blue-100 to-slate-100 rounded-full opacity-50 blur group-hover:opacity-75 transition duration-500"></div>
                        <img src={systemConfig.logoUrl} alt="Logo" className={`relative rounded-full object-cover bg-white border border-slate-100 p-1 transition-all duration-500 ${isCollapsed ? 'h-10 w-10' : 'h-20 w-20'}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                ) : (
                    <div className={`rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-400 font-bold ${isCollapsed ? 'h-10 w-10' : 'h-16 w-16'}`}>
                        <span className="text-xl">{systemConfig.companyName?.charAt(0) || 'F'}</span>
                    </div>
                )}
                <h2 className={`text-sm font-semibold text-slate-600 text-center mt-4 transition-all duration-200 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden mt-0' : 'opacity-100'}`}>{systemConfig.companyName}</h2>
                
                {renderLicenseAlert()}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 overflow-x-hidden">
                {navItems.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => setView(item.id as View)} 
                        title={isCollapsed ? item.label : undefined} 
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group relative ${
                            activeView === item.id 
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                        }`}
                    >
                        <div className="relative shrink-0 flex items-center justify-center">
                            <item.icon className={`h-5 w-5 transition-colors ${activeView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                            
                            {isCollapsed && (item.alertCount ?? 0) > 0 ? (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 z-50">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-white"></span>
                                </span>
                            ) : null}
                        </div>

                        <span className={`ml-3 transition-all duration-200 whitespace-nowrap ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>{item.label}</span>
                        
                        {!isCollapsed && (item.alertCount ?? 0) > 0 && (
                            <div className="ml-auto pl-2 animate-fade-in">
                                <span className="flex items-center justify-center bg-red-100 text-red-600 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-red-200 shadow-sm whitespace-nowrap">
                                    <ExclamationIcon className="w-3 h-3 mr-1" />
                                    {item.alertCount} pendência{item.alertCount && item.alertCount > 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                    </button>
                ))}
            </nav>
            
            {/* Footer */}
            <div className="p-4 mt-auto border-t border-slate-100">
                <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between px-2'}`}>
                     <div className="flex items-center overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0 ring-2 ring-white">
                            {user?.Nome.charAt(0).toUpperCase()}
                        </div>
                        <div className={`ml-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                            <p className="text-sm font-semibold text-slate-700 truncate">{user?.Nome}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{user?.Perfil}</p>
                        </div>
                     </div>
                     <button onClick={logout} className={`text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 ${isCollapsed ? '' : ''}`} title="Sair">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                     </button>
                </div>
                <div className={`mt-4 text-[10px] text-center text-slate-300 font-mono transition-all duration-300 ${isCollapsed ? 'opacity-50 scale-75' : 'opacity-100'}`}>
                    v{SYSTEM_VERSION}
                    {!isCollapsed && <div className="text-[9px] text-slate-200 mt-0.5">Dev: Sérgio Oliveira</div>}
                </div>
            </div>

            <button onClick={() => setCollapsed(!isCollapsed)} className="absolute -right-3 top-12 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-blue-600 shadow-sm transition-colors z-30 print:hidden">
                {isCollapsed ? <ChevronDoubleRightIcon className="h-3 w-3"/> : <ChevronDoubleLeftIcon className="h-3 w-3"/>}
            </button>
        </div>
    );
};

const MainLayout: React.FC = () => {
    const { systemConfig } = useContext(DataContext);
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [activeView, setActiveView] = useState<View>('calculo');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);

    // CRITICAL FIX: Reset view on logout so next login starts fresh
    useEffect(() => {
        if (!isAuthenticated) {
            setActiveView('calculo');
            setIsSidebarCollapsed(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        const company = systemConfig.companyName || 'Empresa';
        document.title = `${company} - Fuel360`;
        getSystemStatus().then(setLicenseStatus).catch(console.error);
    }, [systemConfig]);

    const renderContent = () => {
        switch (activeView) {
            case 'calculo': return <Importacao />;
            case 'roteirizador': return <Roteirizador />;
            case 'ajuste_rota': return <AjusteRota />;
            case 'comparativo': return <PrevistoVsRealizado />; // Nova Rota
            case 'simulacoes': return <GestaoSimulacoes />; 
            case 'equipe': return <GestaoEquipe />;
            case 'ausencias': return <GestaoAusencias />;
            case 'relatorios': return <Relatorios />;
            case 'config': return <Configuracao />;
            case 'admin': return <AdminPanel />;
            default: return <Importacao />;
        }
    };

    if (authLoading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center animate-pulse">
                <FuelLogo className="w-12 h-12 mb-4 opacity-80"/>
                <span className="text-slate-400 text-xs font-semibold tracking-widest uppercase">Iniciando Sistema...</span>
            </div>
        </div>
    );
    
    if (!isAuthenticated) return <Login />;

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans print:h-auto print:block">
            <div className="flex flex-1 overflow-hidden print:block print:overflow-visible">
                <Sidebar activeView={activeView} setView={setActiveView} isCollapsed={isSidebarCollapsed} setCollapsed={setIsSidebarCollapsed} licenseStatus={licenseStatus} />
                <main className="flex-1 p-8 overflow-y-auto bg-slate-50/50 relative scrollbar-thin scrollbar-thumb-slate-200 print:bg-white print:p-0 print:overflow-visible print:w-full">
                    <div className="max-w-7xl mx-auto h-full animate-fade-in print:max-w-none print:h-auto">
                       {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    return <AuthProvider><DataProvider><MainLayout /></DataProvider></AuthProvider>;
}

export default App;

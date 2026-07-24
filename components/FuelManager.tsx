import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Importacao } from './Fuel360/Importacao';
import { Configuracao } from './Fuel360/Configuracao';
import { AdminPanel } from './Fuel360/AdminPanel';
import { GestaoEquipe } from './Fuel360/GestaoEquipe';
import { Relatorios } from './Fuel360/Relatorios';
import { GestaoAusencias } from './Fuel360/GestaoAusencias';
import { Roteirizador } from './Fuel360/Roteirizador';
import { GestaoSimulacoes } from './Fuel360/GestaoSimulacoes';
import { PrevistoVsRealizado } from './Fuel360/PrevistoVsRealizado';
import { AjusteRota } from './Fuel360/AjusteRota';
import { DataProvider, DataContext } from './Fuel360/context/DataContext';
import { AuthProvider, useAuth } from './Fuel360/context/AuthContext';
import { 
  CalculatorIcon, 
  LocationMarkerIcon, 
  TruckIcon, 
  PresentationChartLineIcon, 
  ClipboardListIcon, 
  UsersIcon, 
  CalendarIcon, 
  ChartBarIcon, 
  CogIcon, 
  UserGroupIcon,
  ExclamationIcon 
} from './Fuel360/icons';
import { UI_LABEL_SMALL } from '../constants';

type FuelView = 'calculo' | 'roteirizador' | 'ajuste_rota' | 'comparativo' | 'simulacoes' | 'equipe' | 'ausencias' | 'relatorios' | 'config' | 'admin';

interface NavTab {
  id: FuelView;
  label: string;
  icon: React.FC<any>;
  alertCount?: number;
}

const FuelContent: React.FC = () => {
  const [activeView, setActiveView] = useState<FuelView>('calculo');
  const { colaboradores } = useContext(DataContext);

  const pendingAddresses = useMemo(() => {
    if (!colaboradores || !Array.isArray(colaboradores)) return 0;
    return colaboradores.filter(c => {
      const isActive = c.Ativo === true || Number(c.Ativo) === 1;
      const hasAddress = c.EnderecoBase && c.EnderecoBase.trim().length > 3;
      const isFlagged = c.EnderecoPendente === true || Number(c.EnderecoPendente) === 1;
      return isActive && (!hasAddress || isFlagged);
    }).length;
  }, [colaboradores]);

  const navTabs: NavTab[] = [
    { id: 'calculo', label: 'Cálculo Reembolso', icon: CalculatorIcon },
    { id: 'roteirizador', label: 'Roteirizador', icon: LocationMarkerIcon },
    { id: 'ajuste_rota', label: 'Ajuste de Rota', icon: TruckIcon },
    { id: 'comparativo', label: 'Previsto x Realizado', icon: PresentationChartLineIcon },
    { id: 'simulacoes', label: 'Simulações e Histórico', icon: ClipboardListIcon },
    { id: 'equipe', label: 'Equipe & Setores', icon: UsersIcon, alertCount: pendingAddresses },
    { id: 'ausencias', label: 'Ausências', icon: CalendarIcon },
    { id: 'relatorios', label: 'Relatórios BI', icon: ChartBarIcon },
    { id: 'config', label: 'Parâmetros KM/L', icon: CogIcon },
    { id: 'admin', label: 'Administração', icon: UserGroupIcon },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'calculo': return <Importacao />;
      case 'roteirizador': return <Roteirizador />;
      case 'ajuste_rota': return <AjusteRota />;
      case 'comparativo': return <PrevistoVsRealizado />;
      case 'simulacoes': return <GestaoSimulacoes />;
      case 'equipe': return <GestaoEquipe />;
      case 'ausencias': return <GestaoAusencias />;
      case 'relatorios': return <Relatorios />;
      case 'config': return <Configuracao />;
      case 'admin': return <AdminPanel />;
      default: return <Importacao />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="bg-blue-600/30 text-sky-400 p-2 rounded-xl border border-sky-500/30">
              <CalculatorIcon className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-black tracking-tight">Fuel360 - Gestão de Reembolso & Telemetria</h2>
          </div>
          <p className="text-xs text-slate-400 font-medium ml-11">Auditoria, precisão financeira, cálculo de KM por telemetria e controle de afastamentos.</p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto custom-scrollbar">
        <div className="flex space-x-1 min-w-max">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 relative ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.alertCount && tab.alertCount > 0 ? (
                  <span className="flex items-center justify-center bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse ml-1">
                    {tab.alertCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Feature Component Container */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm min-h-[600px]">
        {renderContent()}
      </div>
    </div>
  );
};

export const FuelManager: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <FuelContent />
      </DataProvider>
    </AuthProvider>
  );
};

export default FuelManager;

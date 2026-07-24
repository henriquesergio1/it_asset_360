import React, { useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
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
import { DataProvider } from './Fuel360/context/DataContext';
import { AuthProvider } from './Fuel360/context/AuthContext';
import { CalculatorIcon } from './Fuel360/icons';

type FuelView = 'calculo' | 'roteirizador' | 'ajuste_rota' | 'comparativo' | 'simulacoes' | 'equipe' | 'ausencias' | 'relatorios' | 'config' | 'admin';

const FuelContent: React.FC = () => {
  const { subView } = useParams<{ subView?: string }>();

  const activeView: FuelView = useMemo(() => {
    switch (subView) {
      case 'calculo': return 'calculo';
      case 'roteirizador': return 'roteirizador';
      case 'ajuste-rota':
      case 'ajuste_rota': return 'ajuste_rota';
      case 'comparativo': return 'comparativo';
      case 'simulacoes': return 'simulacoes';
      case 'equipe': return 'equipe';
      case 'ausencias': return 'ausencias';
      case 'relatorios': return 'relatorios';
      case 'config': return 'config';
      case 'admin': return 'admin';
      default: return 'calculo';
    }
  }, [subView]);

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
      {/* Banner Header Adaptativo (Dark / Light) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <CalculatorIcon className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-black tracking-tight">Fuel360 - Gestão de Reembolso & Telemetria</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-11">Auditoria, precisão financeira, cálculo de KM por telemetria e controle de afastamentos.</p>
        </div>
      </div>

      {/* Container Principal Adaptativo */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm min-h-[600px] transition-colors">
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

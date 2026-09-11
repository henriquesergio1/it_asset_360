import React, { useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Importacao } from './Fuel360/Importacao';
import { Configuracao } from './Fuel360/Configuracao';
import { GestaoEquipe } from './Fuel360/GestaoEquipe';
import { Relatorios } from './Fuel360/Relatorios';
import { GestaoAusencias } from './Fuel360/GestaoAusencias';
import { Roteirizador } from './Fuel360/Roteirizador';
import { GestaoSimulacoes } from './Fuel360/GestaoSimulacoes';
import { PrevistoVsRealizado } from './Fuel360/PrevistoVsRealizado';
import { AjusteRota } from './Fuel360/AjusteRota';
import { GeolocalizadorERP } from './Fuel360/GeolocalizadorERP';
import { DataProvider } from './Fuel360/context/DataContext';
import { AuthProvider } from './Fuel360/context/AuthContext';
import { UI_CARD_CONTAINER } from '../constants';

type FuelView = 'calculo' | 'roteirizador' | 'ajuste_rota' | 'geolocalizador' | 'comparativo' | 'simulacoes' | 'equipe' | 'ausencias' | 'relatorios' | 'config';

const FuelContent: React.FC = () => {
  const { subView } = useParams<{ subView?: string }>();

  const activeView: FuelView = useMemo(() => {
    switch (subView) {
      case 'calculo': return 'calculo';
      case 'roteirizador': return 'roteirizador';
      case 'ajuste-rota':
      case 'ajuste_rota': return 'ajuste_rota';
      case 'geolocalizador': return 'geolocalizador';
      case 'comparativo': return 'comparativo';
      case 'simulacoes': return 'simulacoes';
      case 'equipe': return 'equipe';
      case 'ausencias': return 'ausencias';
      case 'relatorios': return 'relatorios';
      case 'config': return 'config';
      default: return 'calculo';
    }
  }, [subView]);

  const renderContent = () => {
    switch (activeView) {
      case 'calculo': return <Importacao />;
      case 'roteirizador': return <Roteirizador />;
      case 'ajuste_rota': return <AjusteRota />;
      case 'geolocalizador': return <GeolocalizadorERP />;
      case 'comparativo': return <PrevistoVsRealizado />;
      case 'simulacoes': return <GestaoSimulacoes />;
      case 'equipe': return <GestaoEquipe />;
      case 'ausencias': return <GestaoAusencias />;
      case 'relatorios': return <Relatorios />;
      case 'config': return <Configuracao />;
      default: return <Importacao />;
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Container Principal Padronizado */}
      <div className={`${UI_CARD_CONTAINER} min-h-[600px]`}>
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

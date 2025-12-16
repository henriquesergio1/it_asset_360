import React from 'react';
import { MockDataProvider } from './MockDataProvider';
import { ProdDataProvider } from './ProdDataProvider';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CONFIGURAÇÃO DE SEGURANÇA:
  // Se você não tem o backend rodando (Node.js/Python) na porta 5000, 
  // manter 'prod' vai quebrar o app com "Failed to fetch".
  
  // Para forçar o conserto, estamos ignorando o localStorage temporariamente.
  // const appMode = localStorage.getItem('app_mode') || 'mock';
  const appMode: string = 'mock'; 

  console.log(`[ITAsset360] Running in ${appMode.toUpperCase()} mode.`);

  if (appMode === 'prod') {
    return <ProdDataProvider>{children}</ProdDataProvider>;
  }

  return <MockDataProvider>{children}</MockDataProvider>;
};
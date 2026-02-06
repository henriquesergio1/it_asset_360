
import React, { useState, useEffect } from 'react';
import { MockDataProvider } from './MockDataProvider';
import { ProdDataProvider } from './ProdDataProvider';
import { Loader2, Globe } from 'lucide-react';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado para armazenar o modo detectado: null (pendente), 'prod' (SQL Server) ou 'mock' (Teste)
  const [mode, setMode] = useState<'prod' | 'mock' | null>(null);

  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        console.log("[ITAsset360] Verificando conectividade com a API...");
        
        // Timeout de 4 segundos para a sonda inicial
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch('/api/health', { 
            signal: controller.signal,
            cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log("[ITAsset360] API detectada. Iniciando em modo PRODUÇÃO.");
          setMode('prod');
        } else {
          throw new Error("API retornou erro");
        }
      } catch (err) {
        console.warn("[ITAsset360] API inacessível ou timeout. Iniciando em modo de TESTE (MOCK).");
        setMode('mock');
      }
    };

    checkConnectivity();
  }, []);

  // Tela de carregamento enquanto detecta o ambiente
  if (mode === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-blue-600 p-6 rounded-3xl shadow-2xl mb-8 animate-pulse">
            <Globe size={48}/>
        </div>
        <div className="text-center">
            <h2 className="text-xl font-black uppercase tracking-[0.3em] mb-2">IT Asset 360</h2>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin"/>
                Sincronizando Ambiente...
            </p>
        </div>
        <div className="mt-12 max-w-xs text-center">
            <p className="text-[10px] text-slate-500 font-medium uppercase leading-relaxed">
                O sistema está verificando a disponibilidade do servidor SQL. Caso não haja conexão, o modo de demonstração será ativado automaticamente.
            </p>
        </div>
      </div>
    );
  }

  if (mode === 'prod') {
    return <ProdDataProvider>{children}</ProdDataProvider>;
  }

  return <MockDataProvider>{children}</MockDataProvider>;
};

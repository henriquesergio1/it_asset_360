import React, { useState, useEffect } from 'react';
import { MockDataProvider } from './MockDataProvider';
import { ProdDataProvider } from './ProdDataProvider';
import { Loader2, Globe } from 'lucide-react';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'prod' | 'mock' | null>(() => {
      return (localStorage.getItem('app_mode') as 'prod' | 'mock') || null;
  });

  useEffect(() => {
    if (mode !== null) return;

    const checkConnectivity = async () => {
      try {
        console.log("[HELIOS v3.5.7] Verificando API...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const response = await fetch('/api/health', { 
            signal: controller.signal,
            cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          setMode('prod');
          localStorage.setItem('app_mode', 'prod');
        } else {
          throw new Error("API Offline");
        }
      } catch (err) {
        console.warn("[HELIOS v3.5.7] Falha na conexão. Ativando modo MOCK.");
        setMode('mock');
        localStorage.setItem('app_mode', 'mock');
      }
    };

    checkConnectivity();
  }, [mode]);

  if (mode === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-indigo-600 p-6 rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.3)] mb-8 animate-pulse">
            <Globe size={48}/>
        </div>
        <div className="text-center">
            <h2 className="text-xl font-black uppercase tracking-[0.3em] mb-2">Helios Asset Suite</h2>
            <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin"/>
                v3.5.7 • Restaurando Acesso
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
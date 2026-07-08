import React, { useState, useEffect } from 'react';
import { MockDataProvider } from './MockDataProvider';
import { ProdDataProvider } from './ProdDataProvider';
import { Loader2, Globe } from 'lucide-react';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'prod' | 'mock' | null>(null);

  useEffect(() => {
    const detectMode = async () => {
      // Force mock in development environment
      if (window.location.hostname.includes('ais-dev')) {
        console.log("[ITAsset360] Dev Mode: Forcing Mock Data");
        setMode('mock');
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch('/api/health', { 
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          setMode('prod');
        } else {
          setMode('mock');
        }
      } catch (err) {
        setMode('mock');
      }
    };

    detectMode();
  }, []);

  if (mode === null) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-800 flex flex-col items-center justify-center text-white p-6">
        <div className="p-6 rounded-3xl mb-8 animate-pulse text-blue-500">
          <Globe size={48}/>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase tracking-[0.3em] mb-2">IT Asset 360</h2>
          <p className="text-blue-600 dark:text-sky-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin"/>
            Sincronizando Ambiente...
          </p>
        </div>
      </div>
    );
  }

  return mode === 'prod' ? (
    <ProdDataProvider>{children}</ProdDataProvider>
  ) : (
    <MockDataProvider>{children}</MockDataProvider>
  );
};

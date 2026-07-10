import React, { useState, useEffect } from 'react';
import { Loader2, Droplet, Activity, Printer, Calendar, Clock } from 'lucide-react';

interface ZabbixMonitorTabProps {
  zabbixHostId: string;
}

export function ZabbixMonitorTab({ zabbixHostId }: ZabbixMonitorTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (zabbixHostId) {
      fetchData();
    }
  }, [zabbixHostId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      // Get host items
      const res = await fetch('/api/zabbix/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "item.get",
          params: {
            output: ["name", "key_", "lastvalue", "units", "lastclock", "value_type"],
            hostids: zabbixHostId,
            search: {
              name: ""
            }
          },
          id: 1
        })
      });
      if (!res.ok) throw new Error("Erro na comunicação com o servidor Zabbix local");
      const json = await res.json();
      if (json.error) throw new Error(json.error.data || json.error.message);
      
      const items = json.result || [];
      setData(items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-wider">Consultando Zabbix...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800/30">
        <h4 className="font-bold mb-2">Erro de Integração Zabbix</h4>
        <p className="text-sm">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800/40 rounded-lg text-xs font-bold uppercase hover:bg-red-200 dark:hover:bg-red-800/60 transition-all">
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Nenhum dado encontrado para o Host ID: {zabbixHostId}</p>
      </div>
    );
  }

  // Find toner levels (usually keys like 'toner' or 'marker' or 'supply')
  const toners = data.filter((i: any) => 
    i.name.toLowerCase().includes('toner') || 
    i.name.toLowerCase().includes('cartridge') || 
    i.name.toLowerCase().includes('ink') ||
    i.key_.toLowerCase().includes('toner')
  ).filter((i: any) => !i.name.toLowerCase().includes('status')); // Exclude status strings if any

  // Find page counters
  const counters = data.filter((i: any) => 
    i.name.toLowerCase().includes('page') || 
    i.name.toLowerCase().includes('count') || 
    i.key_.toLowerCase().includes('page')
  );
  
  // Status items
  const statusItems = data.filter((i: any) => 
    i.name.toLowerCase().includes('status') || 
    i.name.toLowerCase().includes('ping') || 
    i.name.toLowerCase().includes('uptime')
  );

  const getTonerColor = (name: string, value: number) => {
    const lower = name.toLowerCase();
    if (lower.includes('black') || lower.includes('preto')) return 'bg-slate-800 dark:bg-slate-900';
    if (lower.includes('cyan') || lower.includes('ciano')) return 'bg-cyan-500';
    if (lower.includes('magenta')) return 'bg-pink-500';
    if (lower.includes('yellow') || lower.includes('amarelo')) return 'bg-yellow-400';
    
    // Default fallback based on percentage if no color found
    if (value > 50) return 'bg-green-500';
    if (value > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="text-blue-500" /> Monitoramento em Tempo Real
        </h3>
        <button onClick={fetchData} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
          Atualizar Dados
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">Suprimentos / Toner</h4>
          {toners.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhum item de toner encontrado neste host.</p>
          ) : (
            <div className="space-y-4">
              {toners.map((t: any) => {
                const val = parseFloat(t.lastvalue);
                const isPercentage = t.units === '%' || val <= 100; // Assumption for SNMP printers
                const displayVal = isPercentage ? Math.max(0, Math.min(100, val)) : val;
                
                return (
                  <div key={t.key_} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.name}</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{displayVal}{isPercentage ? '%' : t.units}</span>
                    </div>
                    {isPercentage && (
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getTonerColor(t.name, displayVal)}`} 
                          style={{ width: `${displayVal}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">Contadores & Status</h4>
          
          <div className="grid grid-cols-2 gap-4">
            {counters.map((c: any) => (
              <div key={c.key_} className="bg-blue-50 dark:bg-sky-500/10 p-4 rounded-xl border border-blue-100 dark:border-sky-500/20">
                <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-sky-400">
                  <Printer size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate" title={c.name}>{c.name}</span>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white">{c.lastvalue}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 mt-6">
             {statusItems.map((s: any) => (
               <div key={s.key_} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                 <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{s.name}</span>
                 <span className="text-xs font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">{s.lastvalue} {s.units}</span>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}

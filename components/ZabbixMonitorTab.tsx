import React, { useState, useEffect } from 'react';
import { Loader2, Droplet, Activity, Printer, Calendar, Clock } from 'lucide-react';

interface ZabbixMonitorTabProps {
  zabbixHostId: string;
  deviceId?: string;
}

export function ZabbixMonitorTab({ zabbixHostId, deviceId }: ZabbixMonitorTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageHistory, setPageHistory] = useState<{ Date: string, PageCount: number }[]>([]);

  useEffect(() => {
    if (zabbixHostId) {
      fetchData();
    }
  }, [zabbixHostId, deviceId]);

  // Processa o histórico de contagem de páginas para calcular consumo diário
  const consumptionData = React.useMemo(() => {
    if (!pageHistory || pageHistory.length < 2) return [];
    
    const list: { label: string; value: number; rawDate: string }[] = [];
    for (let i = 1; i < pageHistory.length; i++) {
      const prev = pageHistory[i-1];
      const curr = pageHistory[i];
      const diff = curr.PageCount - prev.PageCount;
      
      let displayDate = curr.Date;
      try {
        const dateOnly = curr.Date.split('T')[0];
        const parts = dateOnly.split('-');
        if (parts.length === 3) {
          displayDate = `${parts[2]}/${parts[1]}`;
        }
      } catch (e) {}

      list.push({
        label: displayDate,
        value: diff >= 0 ? diff : 0,
        rawDate: curr.Date
      });
    }
    return list;
  }, [pageHistory]);

  const maxConsumption = React.useMemo(() => {
    if (consumptionData.length === 0) return 1;
    const vals = consumptionData.map(d => d.value);
    const max = Math.max(...vals);
    return max > 0 ? max : 1;
  }, [consumptionData]);

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

      // Envia a contagem de páginas lida se houver e temos o deviceId
      const pageCounterItem = items.find((i: any) => i.name.toLowerCase().includes('page counter')) || 
                               items.find((i: any) => i.name.toLowerCase().includes('page') && i.name.toLowerCase().includes('count')) ||
                               items.find((i: any) => i.name.toLowerCase() === 'total.print' || i.key_.toLowerCase() === 'total.print');
      if (pageCounterItem && pageCounterItem.lastvalue !== undefined && deviceId) {
        const pageVal = parseInt(pageCounterItem.lastvalue);
        if (!isNaN(pageVal)) {
          try {
            await fetch('/api/zabbix/log-pages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId,
                zabbixHostId,
                pageCount: pageVal
              })
            });
          } catch (e) {
            console.error("Erro ao registrar página no histórico:", e);
          }
        }
      }

      // Busca o histórico consolidado do banco local
      if (deviceId) {
        try {
          const histRes = await fetch(`/api/zabbix/page-history/${deviceId}`);
          if (histRes.ok) {
            const histJson = await histRes.json();
            setPageHistory(histJson || []);
          }
        } catch (e) {
          console.error("Erro ao buscar histórico de páginas:", e);
        }
      }
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

  // Find specific items with robust fallbacks
  const tonerLevelItem = data.find((i: any) => i.name.toLowerCase().includes('toner level')) || data.find((i: any) => i.name.toLowerCase().includes('toner') && !isNaN(parseFloat(i.lastvalue)) && i.units === '%');
  const cartridgeNameItem = data.find((i: any) => i.name.toLowerCase().includes('cartridge name')) || data.find((i: any) => i.name.toLowerCase().includes('cartridge') && isNaN(parseFloat(i.lastvalue)));
  const drumUnitItem = data.find((i: any) => i.name.toLowerCase().includes('drum unit %') || i.name.toLowerCase().includes('drum unit') || i.name.toLowerCase().includes('cilindro'));
  
  const pageCounterItem = data.find((i: any) => i.name.toLowerCase().includes('page counter')) || data.find((i: any) => i.name.toLowerCase().includes('page') && i.name.toLowerCase().includes('count'));
  
  const icmpPingItem = data.find((i: any) => i.name.toLowerCase().includes('icmp ping') || i.key_.toLowerCase().includes('icmp.ping') || i.name.toLowerCase().includes('icmp: icmp ping'));
  const statusText1Item = data.find((i: any) => i.name.toLowerCase().includes('status text 1') || i.name.toLowerCase() === 'status');
  const deviceUptimeItem = data.find((i: any) => i.name.toLowerCase().includes('device uptime') || i.key_.toLowerCase().includes('uptime') || i.name.toLowerCase().includes('uptime'));

  // Detecção de impressora colorida (e.g. Canon MF1127C)
  const blackTonerItem = data.find((i: any) => 
    i.name.toLowerCase() === 'toner.black.level.now' || i.key_.toLowerCase() === 'toner.black.level.now' ||
    (i.name.toLowerCase().includes('toner.black') && !isNaN(parseFloat(i.lastvalue))) ||
    (i.name.toLowerCase().includes('toner') && i.name.toLowerCase().includes('black') && !isNaN(parseFloat(i.lastvalue)))
  );
  const cyanTonerItem = data.find((i: any) => 
    i.name.toLowerCase() === 'toner.cyan.level.now' || i.key_.toLowerCase() === 'toner.cyan.level.now' ||
    (i.name.toLowerCase().includes('toner.cyan') && !isNaN(parseFloat(i.lastvalue))) ||
    (i.name.toLowerCase().includes('toner') && i.name.toLowerCase().includes('cyan') && !isNaN(parseFloat(i.lastvalue)))
  );
  const magentaTonerItem = data.find((i: any) => 
    i.name.toLowerCase() === 'toner.magenta.level.now' || i.key_.toLowerCase() === 'toner.magenta.level.now' ||
    (i.name.toLowerCase().includes('toner.magenta') && !isNaN(parseFloat(i.lastvalue))) ||
    (i.name.toLowerCase().includes('toner') && i.name.toLowerCase().includes('magenta') && !isNaN(parseFloat(i.lastvalue)))
  );
  const yellowTonerItem = data.find((i: any) => 
    i.name.toLowerCase() === 'toner.yellow.level.now' || i.key_.toLowerCase() === 'toner.yellow.level.now' ||
    (i.name.toLowerCase().includes('toner.yellow') && !isNaN(parseFloat(i.lastvalue))) ||
    (i.name.toLowerCase().includes('toner') && i.name.toLowerCase().includes('yellow') && !isNaN(parseFloat(i.lastvalue)))
  );

  const blackTonerModel = data.find((i: any) => i.name.toLowerCase() === 'black.toner.model' || i.key_.toLowerCase() === 'black.toner.model');
  const cyanTonerModel = data.find((i: any) => i.name.toLowerCase() === 'cyan.toner.model' || i.key_.toLowerCase() === 'cyan.toner.model');
  const magentaTonerModel = data.find((i: any) => i.name.toLowerCase() === 'magenta.toner.model' || i.key_.toLowerCase() === 'magenta.toner.model');
  const yellowTonerModel = data.find((i: any) => i.name.toLowerCase() === 'yellow.toner.model' || i.key_.toLowerCase() === 'yellow.toner.model');

  const totalBlackPages = data.find((i: any) => i.name.toLowerCase() === 'total.black.small' || i.key_.toLowerCase() === 'total.black.small');
  const totalColorPages = data.find((i: any) => i.name.toLowerCase() === 'total.full.color.single.color.small' || i.key_.toLowerCase() === 'total.full.color.single.color.small');
  const totalPrintPages = data.find((i: any) => i.name.toLowerCase() === 'total.print' || i.key_.toLowerCase() === 'total.print');

  const hasColorToners = !!(cyanTonerItem || magentaTonerItem || yellowTonerItem || blackTonerItem);

  const renderTonerBar = (title: string, item: any, modelItem: any, colorClass: string) => {
    if (!item) return null;
    const val = parseFloat(item.lastvalue);
    const displayVal = !isNaN(val) ? Math.max(0, Math.min(100, val)) : 0;
    return (
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`}></span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{title}</span>
          </div>
          <span className="text-xs font-black text-slate-900 dark:text-white">{displayVal}%</span>
        </div>
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${colorClass}`} 
            style={{ width: `${displayVal}%` }}
          ></div>
        </div>
        {modelItem && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-mono uppercase">
            Modelo: {modelItem.lastvalue}
          </div>
        )}
      </div>
    );
  };

  const getTonerColor = (name: string, value: number) => {
    const lower = name.toLowerCase();
    if (lower.includes('black') || lower.includes('preto')) return 'bg-slate-800 dark:bg-slate-900';
    if (lower.includes('cyan') || lower.includes('ciano')) return 'bg-cyan-500';
    if (lower.includes('magenta')) return 'bg-pink-500';
    if (lower.includes('yellow') || lower.includes('amarelo')) return 'bg-yellow-400';
    
    if (value > 50) return 'bg-green-500';
    if (value > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatUptime = (secondsStr: string) => {
    const totalSeconds = parseInt(secondsStr, 10);
    if (isNaN(totalSeconds)) return secondsStr;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
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
          
          <div className="space-y-4">
            {hasColorToners ? (
              <div className="grid grid-cols-1 gap-3">
                {renderTonerBar('Toner Preto (K)', blackTonerItem, blackTonerModel, 'bg-slate-800 dark:bg-slate-950 border border-slate-700/30')}
                {renderTonerBar('Toner Ciano (C)', cyanTonerItem, cyanTonerModel, 'bg-cyan-500')}
                {renderTonerBar('Toner Magenta (M)', magentaTonerItem, magentaTonerModel, 'bg-pink-500')}
                {renderTonerBar('Toner Amarelo (Y)', yellowTonerItem, yellowTonerModel, 'bg-yellow-400')}
              </div>
            ) : (
              <>
                {/* Toner Level Bar */}
                {tonerLevelItem && (() => {
                  const val = parseFloat(tonerLevelItem.lastvalue);
                  const displayVal = !isNaN(val) ? Math.max(0, Math.min(100, val)) : 0;
                  return (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Toner Level</span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{displayVal}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getTonerColor(tonerLevelItem.name, displayVal)}`} 
                          style={{ width: `${displayVal}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })()}

                {/* Cartridge Name (Toner Name) */}
                {cartridgeNameItem && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Toner</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                        {cartridgeNameItem.lastvalue}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Drum Unit % Life Remaining (Cilindro Restante) */}
            {drumUnitItem && (() => {
              const val = parseFloat(drumUnitItem.lastvalue);
              const displayVal = !isNaN(val) ? Math.max(0, Math.min(100, val)) : 0;
              return (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Cilindro Restante</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{displayVal}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500" 
                      style={{ width: `${displayVal}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}

            {!tonerLevelItem && !cartridgeNameItem && !drumUnitItem && !hasColorToners && (
              <p className="text-sm text-slate-500 italic">Nenhum item de suprimento detectado.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">Contadores & Status</h4>
          
          <div className="grid grid-cols-1 gap-4">
            {totalBlackPages || totalColorPages ? (
              <div className="space-y-4">
                {/* Total Impressões */}
                {totalPrintPages && (
                  <div className="bg-blue-50 dark:bg-sky-500/10 p-5 rounded-xl border border-blue-100 dark:border-sky-500/20">
                    <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-sky-400">
                      <Printer size={18} />
                      <span className="text-xs font-black uppercase tracking-wider">Total de Impressões (Geral)</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {parseInt(totalPrintPages.lastvalue, 10).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Preto & Branco */}
                  {totalBlackPages && (
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Preto & Branco (Monocromático)</span>
                      <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        {parseInt(totalBlackPages.lastvalue, 10).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}

                  {/* Coloridas */}
                  {totalColorPages && (
                    <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10 p-4 rounded-xl border border-purple-200/50 dark:border-purple-900/30">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">Coloridas</span>
                      <p className="text-lg font-black text-purple-700 dark:text-purple-300 font-mono">
                        {parseInt(totalColorPages.lastvalue, 10).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              pageCounterItem && (
                <div className="bg-blue-50 dark:bg-sky-500/10 p-5 rounded-xl border border-blue-100 dark:border-sky-500/20">
                  <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-sky-400">
                    <Printer size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Page Counter</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {isNaN(parseInt(pageCounterItem.lastvalue, 10)) ? pageCounterItem.lastvalue : parseInt(pageCounterItem.lastvalue, 10).toLocaleString('pt-BR')}
                  </p>
                </div>
              )
            )}
          </div>

          <div className="space-y-3 mt-6">
            {/* ICMP Ping Row */}
            {icmpPingItem && (() => {
              const rawVal = String(icmpPingItem.lastvalue).toLowerCase();
              const isOnline = rawVal === '1' || rawVal.includes('up') || rawVal.includes('1');
              return (
                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">ICMP Ping</span>
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${isOnline ? 'text-green-600 bg-green-50 dark:bg-green-950/30' : 'text-red-600 bg-red-50 dark:bg-red-950/30'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              );
            })()}

            {/* Status Text 1 as "Status" */}
            {statusText1Item && (
              <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Status</span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                  {statusText1Item.lastvalue}
                </span>
              </div>
            )}

            {/* Device Uptime as Uptime */}
            {deviceUptimeItem && (
              <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Uptime</span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                  {formatUptime(deviceUptimeItem.lastvalue)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seção de Histórico de Consumo de Páginas */}
      <div className="bg-white dark:bg-slate-950/20 p-5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm mt-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Printer size={16} className="text-blue-500" /> Consumo de Páginas Diário
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Visualização de impressão acumulada por dia</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-sky-400 bg-blue-50 dark:bg-sky-500/10 px-2.5 py-1 rounded-lg">
            Histórico Local DB
          </span>
        </div>

        {consumptionData.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs italic p-6">
            <Activity size={28} className="mb-2 animate-pulse text-slate-300 dark:text-slate-700" />
            <p className="font-bold text-slate-600 dark:text-slate-400">Coletando leituras diárias...</p>
            <p className="text-[10px] mt-1 text-slate-500 max-w-sm">
              Os dados de contagem de páginas são registrados localmente no banco toda vez que este ativo é monitorado ou atualizado no dashboard. O gráfico aparecerá quando tivermos leituras em dias diferentes.
            </p>
          </div>
        ) : (
          <div className="pt-4">
            <div className="h-36 flex items-end gap-3 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
              {consumptionData.map((d, idx) => {
                const heightPercent = (d.value / maxConsumption) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* Tooltip do valor */}
                    <div className="absolute bottom-full mb-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-15 border border-slate-800 dark:border-slate-700">
                      <div className="font-black text-blue-400">{d.value} páginas</div>
                      <div className="text-[9px] text-slate-400 font-medium">{d.rawDate.split('T')[0]}</div>
                    </div>
                    
                    {/* Barra */}
                    <div 
                      style={{ height: `${Math.max(4, heightPercent)}%` }}
                      className="w-full bg-blue-500 hover:bg-blue-600 dark:bg-sky-500 dark:hover:bg-sky-400 rounded-t-md transition-all shadow-sm group-hover:shadow-md cursor-pointer relative"
                    >
                      {/* Efeito de brilho hover */}
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-md"></div>
                    </div>
                    
                    {/* Label da data */}
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-2 rotate-45 origin-left whitespace-nowrap pt-1">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Espaçamento para as datas rotacionadas */}
            <div className="h-10"></div>
          </div>
        )}
      </div>
    </div>
  );
}

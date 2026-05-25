import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, AlertTriangle, AlertCircle, Package, Clock, X, Check, Shield } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { parseLocalDate } from './recurrenceUtils';

export const NotificationCenter: React.FC = () => {
  const { tasks, consumables, expedienteAlerts, users } = useData();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  // Preferências locais salvas no localStorage
  const [disabledTaskAlerts, setDisabledTaskAlerts] = useState<string[]>([]);
  const [disabledConsumableAlerts, setDisabledConsumableAlerts] = useState<string[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  
  // Lista de IDs já notificados nesta sessão de execução
  const notifiedIdsRef = useRef<Set<string>>(new Set<string>());
  
  // Toasts ativos na UI
  const [activeToasts, setActiveToasts] = useState<Array<{
    id: string;
    title: string;
    message: string;
    type: 'expediente' | 'stock' | 'task';
  }>>([]);

  // Recarregar preferências locais
  const loadPreferences = () => {
    try {
      const taskSaved = localStorage.getItem('task_alerts_disabled');
      if (taskSaved) setDisabledTaskAlerts(JSON.parse(taskSaved));
      
      const consumableSaved = localStorage.getItem('consumable_alerts_disabled');
      if (consumableSaved) setDisabledConsumableAlerts(JSON.parse(consumableSaved));
    } catch (e) {
      console.error('Erro ao ler do localStorage', e);
    }
  };

  useEffect(() => {
    loadPreferences();
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }

    // Escuta mudanças de localStorage se em outra aba
    const handleStorageChange = () => {
      loadPreferences();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handler para atualizar preferences em tempo de execução
  useEffect(() => {
    const handleUpdatePref = () => {
      loadPreferences();
    };
    window.addEventListener('app-alerts-updated', handleUpdatePref);
    return () => window.removeEventListener('app-alerts-updated', handleUpdatePref);
  }, []);

  // Solicitar permissão nativa de notificação do navegador
  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não oferece suporte para notificações de desktop nativas.');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        new Notification('IT Asset 360', {
          body: 'Notificações de desktop habilitadas com sucesso!',
          icon: '/favicon.ico'
        });
      }
    } catch (err) {
      console.error('Erro ao solicitar permissão de notificações:', err);
    }
  };

  // 1. Filtrar alertas de expediente ativos
  const activeExpedienteNotifications = useMemo(() => {
    return expedienteAlerts.filter(alert => {
      const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
      const now = new Date();
      const hasActiveOverride = alert.reactivationDate && new Date(alert.reactivationDate) > now;
      return localUser && localUser.active && !hasActiveOverride;
    }).map(alert => ({
      id: `expediente-${alert.codigo}`,
      title: 'Espediente Incorreto (ERP)',
      message: `Colaborador ${alert.nome} está marcado como fora do expediente no ERP.`,
      type: 'expediente' as const,
      timestamp: new Date()
    }));
  }, [expedienteAlerts, users]);

  // 2. Filtrar alertas de estoque crítico ativos (ignorando desativados)
  const activeStockNotifications = useMemo(() => {
    if (!consumables) return [];
    return consumables.filter(c => {
      const isCritical = c.currentStock <= c.minStock;
      const isDisabled = disabledConsumableAlerts.includes(c.id);
      return isCritical && !isDisabled;
    }).map(c => ({
      id: `stock-${c.id}`,
      title: 'Estoque Crítico',
      message: `Insumo "${c.name}" atingiu limite crítico (${c.currentStock} ${c.unit} restantes).`,
      type: 'stock' as const,
      timestamp: new Date()
    }));
  }, [consumables, disabledConsumableAlerts]);

  // 3. Filtrar alertas de tarefas (ignorando desativadas e concluídas)
  const activeTaskNotifications = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => {
      const isPending = t.status === 'Pendente' || t.status === 'Em Andamento';
      const isAlertActive = t.isOverdue || t.isNearDue;
      const isDisabled = disabledTaskAlerts.includes(t.id);
      return isPending && isAlertActive && !isDisabled;
    }).map(t => ({
      id: `task-${t.id}`,
      title: t.isOverdue ? 'Tarefa Atrasada' : 'Tarefa Próxima do Prazo',
      message: `A tarefa "${t.title}" requer atenção. Prazo original: ${t.dueDate ? parseLocalDate(t.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}`,
      type: 'task' as const,
      timestamp: new Date()
    }));
  }, [tasks, disabledTaskAlerts]);

  // Juntar todas as notificações ativas
  const allNotifications = useMemo(() => {
    return [
      ...activeExpedienteNotifications,
      ...activeStockNotifications,
      ...activeTaskNotifications
    ];
  }, [activeExpedienteNotifications, activeStockNotifications, activeTaskNotifications]);

  // Algoritmo de envio de notificações novas (desktop + app popup Toast)
  useEffect(() => {
    if (allNotifications.length === 0) return;

    allNotifications.forEach(notif => {
      // Se não notificamos esta na sessão ainda
      if (!notifiedIdsRef.current.has(notif.id)) {
        notifiedIdsRef.current.add(notif.id);

        // Enviar notificação nativa do Browser
        if (browserPermission === 'granted') {
          try {
            new Notification(notif.title, {
              body: notif.message,
              tag: notif.id,
              requireInteraction: false
            });
          } catch (e) {
            console.warn('Falha ao disparar Notification API (comum dentro de iFrames)', e);
          }
        }

        // Adicionar à lista de Toasts flutuantes locais do app
        setActiveToasts(prev => [...prev, {
          id: notif.id,
          title: notif.title,
          message: notif.message,
          type: notif.type
        }]);

        // Autodispensar toast flutuante após 6 segundos
        setTimeout(() => {
          setActiveToasts(prev => prev.filter(t => t.id !== notif.id));
        }, 8000);
      }
    });

    // Limpar IDs antigos que sumiram das notificações ativas
    const activeIds = new Set(allNotifications.map(n => n.id));
    notifiedIdsRef.current.forEach(id => {
      if (!activeIds.has(id)) {
        notifiedIdsRef.current.delete(id);
      }
    });

  }, [allNotifications, browserPermission]);

  const dismissToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="relative">
      {/* Botão do Sino */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
          allNotifications.length > 0 
            ? 'bg-blue-900/10 border-blue-500/30 text-blue-400 hover:bg-blue-900/20' 
            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        <Bell size={18} className={allNotifications.length > 0 ? 'animate-bounce' : ''} />
        {allNotifications.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white shadow-md animate-pulse">
            {allNotifications.length}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay invisível para fechar */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-96 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header Central */}
              <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">Central de Alertas</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Sincronizado em tempo real</p>
                </div>
                {allNotifications.length > 0 && (
                  <span className="text-[10px] bg-red-950/50 border border-red-800/30 text-red-400 font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    {allNotifications.length} ativos
                  </span>
                )}
              </div>

              {/* Botão de configuração de notificação por browser */}
              <div className="p-4 bg-slate-950/20 border-b border-slate-800/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield size={14} className={browserPermission === 'granted' ? 'text-emerald-400' : 'text-slate-500'} />
                  <span className="text-[11px] font-bold text-slate-300">Notificações no Desktop</span>
                </div>
                {browserPermission !== 'granted' ? (
                  <button 
                    onClick={requestBrowserPermission}
                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-black px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider"
                  >
                    Ativar
                  </button>
                ) : (
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-0.5">
                    <Check size={12} className="stroke-[3]" /> Permitido
                  </span>
                )}
              </div>

              {/* Lista */}
              <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-800/40">
                {allNotifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center justify-center space-y-3 opacity-50">
                    <div className="p-4 bg-slate-950 rounded-full border border-slate-800">
                      <BellOff size={24} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Sem alertas ativos</p>
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter mt-1">Sua infraestrutura está sob controle!</p>
                    </div>
                  </div>
                ) : (
                  allNotifications.map(notif => (
                    <div key={notif.id} className="p-4 hover:bg-slate-800/30 transition-all flex gap-3">
                      <div className="shrink-0 mt-0.5">
                        {notif.type === 'expediente' && (
                          <div className="p-1.5 bg-red-950/40 rounded-lg border border-red-800/30 text-red-400">
                            <Clock size={14} />
                          </div>
                        )}
                        {notif.type === 'stock' && (
                          <div className="p-1.5 bg-amber-950/40 rounded-lg border border-amber-800/30 text-amber-400">
                            <Package size={14} />
                          </div>
                        )}
                        {notif.type === 'task' && (
                          <div className="p-1.5 bg-blue-950/40 rounded-lg border border-blue-800/30 text-blue-400">
                            <AlertCircle size={14} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black uppercase tracking-tight text-slate-200 truncate">
                            {notif.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-bold leading-normal">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toasts / Popups flutuantes internos no canto inferior direito do App */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {activeToasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="pointer-events-auto bg-slate-900/95 border-l-4 border border-slate-800 rounded-2xl shadow-2xl p-4 flex gap-3 backdrop-blur-md"
              style={{
                borderLeftColor: 
                  toast.type === 'expediente' ? '#f87171' : 
                  toast.type === 'stock' ? '#fbbf24' : '#60a5fa'
              }}
            >
              <div className="shrink-0">
                {toast.type === 'expediente' && <Clock size={16} className="text-red-400 animate-pulse" />}
                {toast.type === 'stock' && <Package size={16} className="text-amber-400 animate-pulse" />}
                {toast.type === 'task' && <AlertTriangle size={16} className="text-blue-400 animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    {toast.title}
                  </span>
                  <button 
                    onClick={() => dismissToast(toast.id)}
                    className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-tight leading-normal">
                  {toast.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

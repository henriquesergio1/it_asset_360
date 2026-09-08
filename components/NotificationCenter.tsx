import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Bell, BellOff, AlertTriangle, AlertCircle, Package, Clock, X, Check, Shield, Cake, FileSignature, Calendar } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { parseLocalDate } from './recurrenceUtils';
import { parseLocalDateParts } from '../utils/rhValidation';
import { hasPermission } from '../utils/rbac';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'expediente' | 'stock' | 'task' | 'rh-alert';
  module: 'TI' | 'RH' | 'FUEL';
  timestamp: Date;
}

interface NotificationCenterProps {
  currentModule?: 'TI' | 'RH' | 'FUEL';
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ currentModule }) => {
  const { tasks, consumables, expedienteAlerts, users, rhCollaborators, rhTerms } = useData();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownTab, setDropdownTab] = useState<'current' | 'all'>('current');
  
  // Preferências locais salvas no localStorage
  const [disabledTaskAlerts, setDisabledTaskAlerts] = useState<string[]>([]);
  const [disabledConsumableAlerts, setDisabledConsumableAlerts] = useState<string[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  
  // Lista de IDs já notificados nesta sessão de execução
  const notifiedIdsRef = useRef<Set<string>>(new Set<string>());
  const isFirstRenderRef = useRef<boolean>(true);
  
  // Toasts ativos na UI e controle de fila anti-bombardeio
  const [activeToasts, setActiveToasts] = useState<NotificationItem[]>([]);
  const toastQueueRef = useRef<NotificationItem[]>([]);
  const isDispatchingRef = useRef<boolean>(false);
  const dispatchTimerRef = useRef<any>(null);

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
    const todayStr = new Date().toLocaleDateString('en-CA');
    return expedienteAlerts.filter(alert => {
      const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
      const cleanDate = alert.reactivationDate ? String(alert.reactivationDate).split('T')[0] : null;
      const hasActiveOverride = (cleanDate && cleanDate >= todayStr) || (!cleanDate && !!alert.observation);
      return localUser && localUser.active && !hasActiveOverride;
    }).map(alert => ({
      id: `expediente-${alert.codigo}`,
      title: 'Expediente Incorreto (ERP)',
      message: `Colaborador ${alert.nome} está marcado como fora do expediente no ERP.`,
      type: 'expediente' as const,
      module: 'TI' as const,
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
      module: 'TI' as const,
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
      module: 'TI' as const,
      timestamp: new Date()
    }));
  }, [tasks, disabledTaskAlerts]);

  // --- NOTIFICAÇÕES DE R.H. ---
  // 1. Aniversariantes do Dia
  const activeRhBirthdayNotifications = useMemo(() => {
    if (!rhCollaborators) return [];
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    return rhCollaborators.filter(c => {
      if (!c.birthDate || c.status === 'Demitido') return false;
      const parts = parseLocalDateParts(c.birthDate);
      if (!parts) return false;
      return parts.month === currentMonth && parts.day === currentDay;
    }).map(c => ({
      id: `rh-birthday-${c.id}`,
      title: 'Aniversariante do Dia 🎂',
      message: `Hoje é aniversário de ${c.fullName}! Parabéns!`,
      type: 'rh-alert' as const,
      module: 'RH' as const,
      timestamp: new Date()
    }));
  }, [rhCollaborators]);

  // 2. Alertas de Férias (Admissão próxima de completar 11 meses ou múltiplos de 12 meses + 11)
  const activeRhHolidayNotifications = useMemo(() => {
    if (!rhCollaborators) return [];
    const alerts: NotificationItem[] = [];
    rhCollaborators.forEach(c => {
      if (!c.hireDate || c.status === 'Demitido') return;
      const hire = new Date(c.hireDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - hire.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const totalMonths = Math.floor(diffDays / 30.4);
      
      const reminder = totalMonths % 12;
      if (reminder === 11) {
        alerts.push({
          id: `rh-holiday-${c.id}-${totalMonths}`,
          title: 'Período de Férias Próximo 📅',
          message: `Colaborador ${c.fullName} atingiu ${totalMonths} meses de empresa. Férias próximas!`,
          type: 'rh-alert' as const,
          module: 'RH' as const,
          timestamp: new Date()
        });
      }
    });
    return alerts;
  }, [rhCollaborators]);

  // 3. Vencimentos de Documentos e CNH
  const activeRhDocNotifications = useMemo(() => {
    if (!rhCollaborators) return [];
    const alerts: NotificationItem[] = [];
    const now = new Date();
    now.setHours(0,0,0,0);

    rhCollaborators.forEach(c => {
      if (c.status === 'Demitido') return;
      
      // CNH
      if (c.cnhExpiration && c.cnhNumber && !c.cnhExpiration.startsWith('1900-')) {
        const exp = new Date(c.cnhExpiration);
        if (exp.getFullYear() > 1900) {
          const diff = exp.getTime() - now.getTime();
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          if (days >= 0 && days <= 90) {
            alerts.push({
              id: `rh-cnh-${c.id}`,
              title: 'CNH Próxima do Vencimento ⚠️',
              message: `A CNH do colaborador ${c.fullName} vence em ${days} dias (${new Date(c.cnhExpiration).toLocaleDateString('pt-BR')}).`,
              type: 'rh-alert' as const,
              module: 'RH' as const,
              timestamp: new Date()
            });
          }
        }
      }

      // Experiência (45 e 90 dias)
      if (c.hireDate) {
        const hire = new Date(c.hireDate);
        const exp45 = new Date(hire.getTime() + 45 * 24 * 60 * 60 * 1000);
        const exp90 = new Date(hire.getTime() + 90 * 24 * 60 * 60 * 1000);

        const diff45 = exp45.getTime() - now.getTime();
        const days45 = Math.ceil(diff45 / (1000 * 60 * 60 * 24));

        const diff90 = exp90.getTime() - now.getTime();
        const days90 = Math.ceil(diff90 / (1000 * 60 * 60 * 24));

        if (days45 >= 0 && days45 <= 15) {
          alerts.push({
            id: `rh-exp45-${c.id}`,
            title: 'Contrato de Experiência (45d) ⚠️',
            message: `O contrato de 45 dias do colaborador ${c.fullName} vence em ${days45} dias.`,
            type: 'rh-alert' as const,
            module: 'RH' as const,
            timestamp: new Date()
          });
        } else if (days90 >= 0 && days90 <= 15) {
          alerts.push({
            id: `rh-exp90-${c.id}`,
            title: 'Contrato de Experiência (90d) ⚠️',
            message: `O contrato de 90 dias do colaborador ${c.fullName} vence em ${days90} dias.`,
            type: 'rh-alert' as const,
            module: 'RH' as const,
            timestamp: new Date()
          });
        }
      }
    });
    return alerts;
  }, [rhCollaborators]);

  // 4. Assinaturas Pendentes de Validação (WAITING_APPROVAL)
  const activeRhTermsNotifications = useMemo(() => {
    if (!rhTerms) return [];
    return rhTerms.filter(t => t.signatureStatus === 'WAITING_APPROVAL').map(t => {
      const colab = rhCollaborators?.find(c => c.id === t.collaboratorId);
      return {
        id: `rh-term-approval-${t.id}`,
        title: 'Validação de Assinatura 📝',
        message: `O termo ${t.id} de ${colab?.fullName || 'Colaborador'} aguarda validação.`,
        type: 'rh-alert' as const,
        module: 'RH' as const,
        timestamp: new Date()
      };
    });
  }, [rhTerms, rhCollaborators]);

  const activeNavModule = useMemo<'TI' | 'RH' | 'FUEL'>(() => {
    if (currentModule) return currentModule;
    if (location.pathname.startsWith('/rh')) return 'RH';
    if (location.pathname.startsWith('/fuel')) return 'FUEL';
    const stored = localStorage.getItem('current_module');
    if (stored === 'RH' || stored === 'FUEL' || stored === 'TI') return stored;
    return 'TI';
  }, [currentModule, location.pathname]);

  const isRhActive = activeNavModule === 'RH';

  const canReceiveRhNotifications = useMemo(() => {
    if (!user) return false;
    if (isAdmin || hasPermission(user, 'admin')) return true;
    
    // Checagem do objeto de permissões do usuário
    const permissoesObj = user.Permissoes || user.permissoes || ((user as any).perfil && ((user as any).perfil.Permissoes || (user as any).perfil.permissoes));
    if (permissoesObj && permissoesObj.notificacoes_rh !== undefined) {
      return !!permissoesObj.notificacoes_rh;
    }

    // Fallback inteligente: apenas usuários com permissões de gestão/escrita no RH recebem notificações por padrão
    return hasPermission(user, 'rh_dashboard_escrita') || 
           hasPermission(user, 'rh_colaboradores_escrita') || 
           hasPermission(user, 'rh_comodato_escrita') || 
           hasPermission(user, 'rh_ocorrencias_escrita') ||
           hasPermission(user, 'rh_dashboard') ||
           hasPermission(user, 'rh_colaboradores');
  }, [user, isAdmin]);

  const canReceiveTiNotifications = useMemo(() => {
    if (!user) return false;
    if (isAdmin || hasPermission(user, 'admin')) return true;

    const permissoesObj = user.Permissoes || user.permissoes || ((user as any).perfil && ((user as any).perfil.Permissoes || (user as any).perfil.permissoes));
    if (permissoesObj && permissoesObj.notificacoes_ti !== undefined) {
      return !!permissoesObj.notificacoes_ti;
    }

    // Fallback inteligente: apenas usuários com permissões operacionais/escrita em TI recebem notificações por padrão
    // Usuários com Apenas Leitura de relatórios (para ver setores) NÃO recebem alertas por padrão!
    return hasPermission(user, 'dashboard_escrita') || 
           hasPermission(user, 'dispositivos_escrita') || 
           hasPermission(user, 'colaboradores_escrita') || 
           hasPermission(user, 'tarefas_escrita') || 
           hasPermission(user, 'consumiveis_escrita');
  }, [user, isAdmin]);

  // Juntar todas as notificações ativas respeitando estritamente o perfil RBAC do usuário
  const allNotifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    if (canReceiveRhNotifications) {
      list.push(
        ...activeRhBirthdayNotifications,
        ...activeRhHolidayNotifications,
        ...activeRhDocNotifications,
        ...activeRhTermsNotifications
      );
    }

    if (canReceiveTiNotifications) {
      list.push(
        ...activeExpedienteNotifications,
        ...activeStockNotifications,
        ...activeTaskNotifications
      );
    }

    return list;
  }, [
    canReceiveRhNotifications,
    canReceiveTiNotifications,
    activeRhBirthdayNotifications,
    activeRhHolidayNotifications,
    activeRhDocNotifications,
    activeRhTermsNotifications,
    activeExpedienteNotifications,
    activeStockNotifications,
    activeTaskNotifications
  ]);

  // Notificações pertencentes ao módulo onde o usuário está navegando
  const activeModuleNotifications = useMemo(() => {
    return allNotifications.filter(n => n.module === activeNavModule);
  }, [allNotifications, activeNavModule]);

  // Notificações exibidas na lista do sino conforme aba
  const displayedNotifications = useMemo(() => {
    if (dropdownTab === 'current') {
      return activeModuleNotifications;
    }
    return allNotifications;
  }, [allNotifications, activeModuleNotifications, dropdownTab]);

  // Constantes de controle da fila anti-bombardeio
  const MAX_VISIBLE_TOASTS = 3;
  const DISPATCH_INTERVAL_MS = 900;
  const TOAST_DURATION_MS = 7000;

  // Processador temporizado da fila de toasts (escalonado e suave)
  const processNextToast = () => {
    if (toastQueueRef.current.length === 0) {
      isDispatchingRef.current = false;
      return;
    }

    setActiveToasts(currentVisible => {
      // Se já atingiu o teto na tela, aguarda um ser dispensado antes de abrir outro
      if (currentVisible.length >= MAX_VISIBLE_TOASTS) {
        if (dispatchTimerRef.current) clearTimeout(dispatchTimerRef.current);
        dispatchTimerRef.current = setTimeout(processNextToast, 1200);
        return currentVisible;
      }

      const nextToast = toastQueueRef.current.shift();
      if (!nextToast) {
        isDispatchingRef.current = false;
        return currentVisible;
      }

      // Disparar notificação nativa do Browser se permitida
      if (browserPermission === 'granted') {
        try {
          new Notification(nextToast.title, {
            body: nextToast.message,
            tag: nextToast.id,
            requireInteraction: false
          });
        } catch (e) {
          console.warn('Falha ao disparar Notification API', e);
        }
      }

      // Autodispensar este toast específico após 7 segundos
      setTimeout(() => {
        setActiveToasts(prev => prev.filter(t => t.id !== nextToast.id));
      }, TOAST_DURATION_MS);

      // Agenda o próximo item da fila com delay suave de 900ms
      if (dispatchTimerRef.current) clearTimeout(dispatchTimerRef.current);
      dispatchTimerRef.current = setTimeout(processNextToast, DISPATCH_INTERVAL_MS);

      return [...currentVisible, nextToast];
    });
  };

  // Ao trocar de módulo na navegação, limpa imediatamente os popups e a fila do módulo anterior
  useEffect(() => {
    setActiveToasts(prev => prev.filter(t => t.module === activeNavModule));
    toastQueueRef.current = toastQueueRef.current.filter(t => t.module === activeNavModule);
  }, [activeNavModule]);

  // Limpeza de timer no unmount
  useEffect(() => {
    return () => {
      if (dispatchTimerRef.current) clearTimeout(dispatchTimerRef.current);
    };
  }, []);

  // Algoritmo de despacho inteligente: filtra por módulo ativo e escalona na fila com delay
  useEffect(() => {
    if (allNotifications.length === 0) {
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
      }
      return;
    }

    if (isFirstRenderRef.current) {
      // Popula silenciosamente o cache inicial com tudo o que já existe para evitar avalanche no login
      allNotifications.forEach(notif => {
        notifiedIdsRef.current.add(notif.id);
      });
      isFirstRenderRef.current = false;
      return;
    }

    // Identificar novas notificações ainda não notificadas nesta sessão
    const newAlerts = allNotifications.filter(n => !notifiedIdsRef.current.has(n.id));

    if (newAlerts.length > 0) {
      newAlerts.forEach(notif => {
        notifiedIdsRef.current.add(notif.id);

        // DISPARAR POPUP TOAST APENAS SE A NOTIFICAÇÃO FOR DO MÓDULO ONDE O USUÁRIO ESTÁ NAVEGANDO!
        // No Fuel360, não enfileira popups de RH nem de TI!
        if (notif.module === activeNavModule) {
          toastQueueRef.current.push(notif);
        }
      });

      // Se a fila possui itens e não está processando, inicia o envio com delay
      if (!isDispatchingRef.current && toastQueueRef.current.length > 0) {
        isDispatchingRef.current = true;
        processNextToast();
      }
    }

    // Limpar IDs antigos que deixaram de ser alertas ativos
    const activeIds = new Set(allNotifications.map(n => n.id));
    notifiedIdsRef.current.forEach(id => {
      if (!activeIds.has(id)) {
        notifiedIdsRef.current.delete(id);
      }
    });

  }, [allNotifications, activeNavModule, browserPermission]);

  const dismissToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  const dismissAllToasts = () => {
    setActiveToasts([]);
    toastQueueRef.current = [];
    if (dispatchTimerRef.current) clearTimeout(dispatchTimerRef.current);
    isDispatchingRef.current = false;
  };

  return (
    <div className="relative">
      {/* Botão do Sino */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
          allNotifications.length > 0 
            ? 'bg-blue-50 dark:bg-sky-500/20 border-blue-200 dark:border-sky-800/30 text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:hover:bg-sky-500/30' 
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
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
              className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header Central */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Central de Alertas</h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Sincronizado em tempo real</p>
                </div>
                {allNotifications.length > 0 && (
                  <span className="text-[10px] bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/30 text-rose-700 dark:text-rose-400 font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    {allNotifications.length} ativos
                  </span>
                )}
              </div>

              {/* Seletor de Abas: Módulo Ativo vs Todos */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-900/60 p-1.5 gap-1">
                <button
                  type="button"
                  onClick={() => setDropdownTab('current')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    dropdownTab === 'current'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>Módulo {activeNavModule}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${dropdownTab === 'current' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                    {activeModuleNotifications.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDropdownTab('all')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    dropdownTab === 'all'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>Todos</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${dropdownTab === 'all' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                    {allNotifications.length}
                  </span>
                </button>
              </div>

              {/* Botão de configuração de notificação por browser */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield size={14} className={browserPermission === 'granted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'} />
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Notificações no Desktop</span>
                </div>
                {browserPermission !== 'granted' ? (
                  <button 
                    onClick={requestBrowserPermission}
                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-black px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider"
                  >
                    Ativar
                  </button>
                ) : (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-0.5">
                    <Check size={12} className="stroke-[3]" /> Permitido
                  </span>
                )}
              </div>

              {/* Lista */}
              <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-800/40">
                {displayedNotifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center justify-center space-y-3 opacity-50">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700">
                      <BellOff size={24} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {dropdownTab === 'current' ? `Sem alertas para o Módulo ${activeNavModule}` : 'Sem alertas ativos'}
                      </p>
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter mt-1">
                        {isRhActive ? 'Sua equipe está sob controle!' : 'Sua operação está sob controle!'}
                      </p>
                    </div>
                  </div>
                ) : (
                  displayedNotifications.map(notif => (
                    <div key={notif.id} className="p-4 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-all flex gap-3">
                      <div className="shrink-0 mt-0.5">
                        {notif.type === 'expediente' && (
                          <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800/30 text-rose-600 dark:text-rose-400">
                            <Clock size={14} />
                          </div>
                        )}
                        {notif.type === 'stock' && (
                          <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800/30 text-amber-600 dark:text-amber-400">
                            <Package size={14} />
                          </div>
                        )}
                        {notif.type === 'task' && (
                          <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800/30 text-blue-600 dark:text-sky-400">
                            <AlertCircle size={14} />
                          </div>
                        )}
                        {notif.type === 'rh-alert' && (
                          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800/30 text-indigo-600 dark:text-indigo-400">
                            {notif.id.includes('birthday') ? <Cake size={14} /> :
                             notif.id.includes('approval') ? <FileSignature size={14} /> :
                             <Calendar size={14} />}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                              {notif.module}
                            </span>
                            <span className="text-[11px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-200 truncate">
                              {notif.title}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-bold leading-normal">
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

      {/* Toasts / Popups flutuantes internos no canto inferior direito do App com fila suave */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
        {activeToasts.length >= 2 && (
          <div className="flex justify-end pointer-events-auto">
            <button 
              type="button"
              onClick={dismissAllToasts}
              className="text-[10px] font-black uppercase tracking-wider bg-slate-900/90 dark:bg-slate-800/95 text-slate-300 hover:text-white px-3 py-1 rounded-full shadow-lg border border-slate-700/60 backdrop-blur transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <X size={12} /> Dispensar Todos ({activeToasts.length})
            </button>
          </div>
        )}
        <AnimatePresence>
          {activeToasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="pointer-events-auto bg-white dark:bg-slate-800/95 border-l-4 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 flex gap-3 backdrop-blur-md"
              style={{
                borderLeftColor: 
                  toast.type === 'expediente' ? '#f87171' : 
                  toast.type === 'stock' ? '#fbbf24' : 
                  toast.type === 'rh-alert' ? '#818cf8' : '#60a5fa'
              }}
            >
              <div className="shrink-0">
                {toast.type === 'expediente' && <Clock size={16} className="text-red-400 animate-pulse" />}
                {toast.type === 'stock' && <Package size={16} className="text-amber-600 dark:text-amber-400 animate-pulse" />}
                {toast.type === 'task' && <AlertTriangle size={16} className="text-blue-600 dark:text-sky-400 animate-pulse" />}
                {toast.type === 'rh-alert' && <Bell size={16} className="text-indigo-650 dark:text-indigo-400 animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 shrink-0">
                      {toast.module}
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
                      {toast.title}
                    </span>
                  </div>
                  <button 
                    onClick={() => dismissToast(toast.id)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Fechar notificação"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1 uppercase tracking-tight leading-normal">
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

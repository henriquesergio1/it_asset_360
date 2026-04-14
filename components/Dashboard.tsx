import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Smartphone, Users, AlertTriangle, FileWarning, ArrowRight, Lock, 
  ChevronDown, ChevronUp, DollarSign, Wrench, AlertCircle, FileText, 
  Info, Clock, X, ClipboardList, ChevronRight, Package, TrendingUp, 
  Activity, CheckCircle2, LayoutDashboard
} from 'lucide-react';
import { DeviceStatus, AccountType, Task, TaskStatus } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { TaskDashboardWidget } from './TaskDashboardWidget';
import { TaskDetailModal } from './TaskDetailModal';

const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend, children }: any) => (
  <div 
    className={`bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-500 group relative overflow-hidden ${onClick ? 'cursor-pointer hover:border-blue-500/50' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between mb-4 z-10">
      <div className={`p-3 rounded-xl ${color} bg-opacity-20 text-white shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-full">
          <TrendingUp size={12} />
          {trend}
        </div>
      )}
    </div>
    <div className="z-10">
      <p className="text-xs font-black uppercase tracking-widest mb-1 text-slate-500">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-3xl font-black text-slate-100 tracking-tight">{value}</h3>
      </div>
      {subtitle && <p className="text-[10px] mt-2 text-slate-400 font-medium italic">{subtitle}</p>}
    </div>
    
    {children && (
      <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out z-20 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-100">{title} Detalhes</h4>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {children}
        </div>
      </div>
    )}
    
    {/* Background glow effect */}
    <div className={`absolute -bottom-10 -right-10 w-32 h-32 ${color.replace('bg-', 'bg-').replace('-600', '-600/10')} rounded-full blur-2xl transition-all duration-500 group-hover:scale-150 opacity-0 group-hover:opacity-100`}></div>
  </div>
);

const Dashboard = () => {
  const { 
    devices, users, accounts, sectors, maintenances, models, brands, assetTypes,
    refreshData, expedienteAlerts, fetchExpedienteAlerts, saveExpedienteOverride, 
    tasks, updateTask, systemUsers, consumables 
  } = useData();
  const { isAdmin } = useAuth();
  const [isTermsExpanded, setIsTermsExpanded] = useState(true);
  const [isExpedienteExpanded, setIsExpedienteExpanded] = useState(true);
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);
  const [isConsumablesExpanded, setIsConsumablesExpanded] = useState(true);
  const [resolvingTerm, setResolvingTerm] = useState<{termId: string, userName: string} | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingExpediente, setEditingExpediente] = useState<{codigo: string, nome: string, observation: string, reactivationDate: string} | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchExpedienteAlerts();
  }, []);

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

  // Filtra termos pendentes
  const pendingTerms = useMemo(() => {
    return users.flatMap(u => 
      (u.terms || []).filter(t => !t.fileUrl && !t.hasFile).map(t => ({
        term: t,
        user: u
      }))
    ).sort((a, b) => new Date(b.term.date).getTime() - new Date(a.term.date).getTime());
  }, [users]);

  // Alertas de Consumíveis
  const consumableAlerts = useMemo(() => {
    if (!consumables) return [];
    return consumables.filter(c => c.currentStock <= c.minStock).map(c => ({
      ...c,
      isCritical: c.currentStock === 0
    })).sort((a, b) => (a.currentStock / a.minStock) - (b.currentStock / b.minStock));
  }, [consumables]);

  // Filtra alertas de expediente
  const filteredExpedienteAlerts = useMemo(() => {
    return expedienteAlerts.filter(alert => {
      const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
      return localUser && localUser.active;
    }).sort((a, b) => {
      const now = new Date();
      const aHasActiveOverride = a.reactivationDate && new Date(a.reactivationDate) > now;
      const bHasActiveOverride = b.reactivationDate && new Date(b.reactivationDate) > now;
      if (aHasActiveOverride && !bHasActiveOverride) return 1;
      if (!aHasActiveOverride && bHasActiveOverride) return -1;
      return a.nome.localeCompare(b.nome);
    });
  }, [expedienteAlerts, users]);

  // Agrupamento de Dispositivos por Tipo
  const devicesByType = useMemo(() => {
    const summary: Record<string, { total: number, available: number, inUse: number }> = {};
    devices.forEach(d => {
      const model = models.find(m => m.id === d.modelId);
      const type = assetTypes.find(t => t.id === model?.typeId);
      const typeName = type?.name || 'Outros';
      
      if (!summary[typeName]) {
        summary[typeName] = { total: 0, available: 0, inUse: 0 };
      }
      summary[typeName].total++;
      if (d.status === DeviceStatus.AVAILABLE) summary[typeName].available++;
      if (d.status === DeviceStatus.IN_USE) summary[typeName].inUse++;
    });
    return Object.entries(summary).sort((a, b) => b[1].total - a[1].total);
  }, [devices, models, assetTypes]);

  // Agrupamento de Colaboradores por Setor
  const usersBySector = useMemo(() => {
    const summary: Record<string, number> = {};
    users.filter(u => u.active).forEach(u => {
      const sector = sectors.find(s => s.id === u.sectorId);
      const sectorName = sector?.name || 'Sem Setor';
      summary[sectorName] = (summary[sectorName] || 0) + 1;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [users, sectors]);

  // Agrupamento de Licenças por Tipo
  const accountsByType = useMemo(() => {
    const summary: Record<string, number> = {};
    accounts.filter(a => a.status === 'Ativo').forEach(a => {
      summary[a.type] = (summary[a.type] || 0) + 1;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  const handleResolveManual = async () => {
    if (!resolvingTerm || !resolveReason.trim()) return;
    try {
      const response = await fetch(`/api/terms/resolve/${resolvingTerm.termId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reason: resolveReason,
          _adminUser: localStorage.getItem('userName') || 'Admin'
        })
      });
      if (response.ok) {
        setResolvingTerm(null);
        setResolveReason('');
        refreshData();
      } else {
        alert('Erro ao resolver pendência');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão');
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-blue-500" size={32} />
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Bem-vindo ao centro de controle do seu inventário de TI.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sistema Online</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Dispositivos"
          value={devices.length}
          icon={Smartphone}
          color="bg-blue-600"
          subtitle={`${availableDevices} disponíveis para entrega`}
          onClick={() => navigate('/devices')}
        >
          <div className="space-y-3">
            {devicesByType.map(([type, stats]) => (
              <div key={type} className="flex flex-col gap-1 border-b border-slate-800/50 pb-2 last:border-0">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">{type}</span>
                  <span className="text-slate-400">{stats.total} total</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-medium">
                  <span className="text-emerald-400">{stats.available} disp.</span>
                  <span className="text-blue-400">{stats.inUse} em uso</span>
                </div>
              </div>
            ))}
          </div>
        </StatCard>
        
        <StatCard 
          title="Colaboradores"
          value={users.filter(u => u.active).length}
          icon={Users}
          color="bg-emerald-600"
          subtitle={`${users.length} cadastrados no total`}
          onClick={() => navigate('/users')}
        >
          <div className="space-y-2">
            {usersBySector.map(([sector, count]) => (
              <div key={sector} className="flex justify-between items-center text-xs border-b border-slate-800/50 pb-2 last:border-0">
                <span className="font-bold text-slate-300 truncate pr-2">{sector}</span>
                <span className="text-emerald-400 font-black bg-emerald-900/30 px-2 py-0.5 rounded">{count}</span>
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard 
          title="Licenças & Contas"
          value={accounts.length}
          icon={Lock}
          color="bg-indigo-600"
          subtitle={`${accounts.filter(a => a.status === 'Ativo').length} contas ativas`}
          onClick={() => navigate('/accounts')}
        >
          <div className="space-y-2">
            {accountsByType.map(([type, count]) => (
              <div key={type} className="flex justify-between items-center text-xs border-b border-slate-800/50 pb-2 last:border-0">
                <span className="font-bold text-slate-300">{type}</span>
                <span className="text-indigo-400 font-black bg-indigo-900/30 px-2 py-0.5 rounded">{count}</span>
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard 
          title="Em Manutenção"
          value={maintenanceDevices}
          icon={Wrench}
          color="bg-amber-500"
          subtitle="Aguardando retorno técnico"
          onClick={() => navigate('/devices?status=Em Manutenção')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Main Content */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Alertas Críticos Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                Alertas do Sistema
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* 1º Alerta de Expediente ERP */}
              {filteredExpedienteAlerts.length > 0 && (
                <div className="bg-slate-900 border-l-4 border-l-red-500 border-y border-r border-slate-800 rounded-xl p-4 animate-fade-in shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-900/30 text-red-400 rounded-lg shrink-0">
                      <Clock size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-100">
                          Alertas de Expediente
                          <span className="ml-2 bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                            {filteredExpedienteAlerts.length}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setIsExpedienteExpanded(!isExpedienteExpanded)}
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {isExpedienteExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">
                        Colaboradores com expediente <span className="font-bold text-red-400">FALSO</span> no ERP.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isExpedienteExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[0px] overflow-hidden'}`}>
                        {filteredExpedienteAlerts.map(alert => {
                          const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
                          const now = new Date();
                          const hasActiveOverride = alert.reactivationDate && new Date(alert.reactivationDate) > now;
                          return (
                            <div key={alert.codigo} className={`bg-slate-800/50 p-3 rounded-lg border flex flex-col gap-2 group transition-all ${hasActiveOverride ? ' border-amber-900/50 hover:border-amber-700' : ' border-red-900/30 hover:border-red-700'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex flex-1 items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${hasActiveOverride ? ' bg-amber-900/40 text-amber-400' : ' bg-red-900/40 text-red-400'}`}>
                                    {alert.nome.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <p className="text-sm font-bold text-slate-200">{alert.nome}</p>
                                    <p className="text-[10px] uppercase font-black tracking-tighter text-slate-400">Cód: {alert.codigo} | CPF: {alert.cpf}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 mt-1">
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${hasActiveOverride ? 'text-amber-400' : 'text-red-400'}`}>
                                  {hasActiveOverride ? 'Desativado Temporariamente' : 'Expediente Falso'}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setEditingExpediente({
                                        codigo: alert.codigo,
                                        nome: alert.nome,
                                        observation: alert.observation || '',
                                        reactivationDate: alert.reactivationDate ? new Date(alert.reactivationDate).toISOString().split('T')[0] : ''
                                      })}
                                      className="p-1.5 hover:bg-blue-900/40 text-slate-400 hover:text-blue-400 rounded-lg transition-colors"
                                      title="Adicionar Observação/Reativação"
                                    >
                                      <FileText size={16} />
                                    </button>
                                    {localUser && (
                                      <Link 
                                        to={`/users?userId=${localUser.id}`}
                                        className="p-1.5 hover:bg-blue-900/40 text-slate-400 hover:text-blue-400 rounded-lg transition-colors"
                                        title="Ver Colaborador Local"
                                      >
                                        <ArrowRight size={16} />
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {hasActiveOverride && (
                                <div className="mt-2 text-[10px] text-amber-400 bg-amber-900/20 p-2 rounded border border-amber-900/30">
                                  <span className="font-bold">Motivo:</span> {alert.observation} <br/>
                                  <span className="font-bold">Reativação:</span> {new Date(alert.reactivationDate!).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2º Alerta de Consumíveis */}
              {consumableAlerts.length > 0 && (
                <div className="bg-slate-900 border-l-4 border-l-amber-500 border-y border-r border-slate-800 rounded-xl p-4 animate-fade-in shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-900/30 text-amber-400 rounded-lg shrink-0">
                      <Package size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-100">
                          Estoque Crítico
                          <span className="ml-2 bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                            {consumableAlerts.length}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setIsConsumablesExpanded(!isConsumablesExpanded)}
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {isConsumablesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">
                        Itens que atingiram o estoque mínimo e precisam de reposição.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isConsumablesExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[0px] overflow-hidden'}`}>
                        {consumableAlerts.map(item => (
                          <div key={item.id} className="bg-slate-800/50 p-3 rounded-lg border border-amber-900/30 flex items-center justify-between group hover:border-amber-700 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${item.currentStock === 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                              <div>
                                <p className="text-sm font-bold text-slate-200">{item.name}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-black">Mínimo: {item.minStock} {item.unit}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-black ${item.currentStock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                                {item.currentStock} {item.unit}
                              </p>
                              <Link to="/consumables" className="text-[9px] font-black text-blue-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Repor</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3º Alerta de Termos Pendentes */}
              {pendingTerms.length > 0 && (
                <div className="bg-slate-900 border-l-4 border-l-orange-500 border-y border-r border-slate-800 rounded-xl p-4 animate-fade-in shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-900/30 text-orange-400 rounded-lg shrink-0">
                      <FileWarning size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-100">
                          Termos Pendentes
                          <span className="ml-2 bg-orange-900/40 text-orange-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                            {pendingTerms.length}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {isTermsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">
                        Colaboradores com dispositivos sem termo assinado.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isTermsExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[220px] overflow-hidden'}`}>
                        {pendingTerms.slice(0, 5).map(({term, user}) => {
                          return (
                            <div key={term.id} className="bg-slate-800/50 p-3 rounded-lg border border-orange-900/30 flex flex-col gap-2 group hover:border-orange-700 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-orange-900/40 flex items-center justify-center font-bold text-xs shrink-0 text-orange-400">
                                  {user.fullName.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                  <p className="text-sm font-bold text-slate-200">{user.fullName}</p>
                                  <p className="text-[10px] uppercase font-black tracking-tighter text-slate-400">
                                    {term.assetDetails.split('|')[0]}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-500">{new Date(term.date).toLocaleDateString('pt-BR')}</p>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => setResolvingTerm({ termId: term.id, userName: user.fullName })}
                                    className="p-1.5 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                    title="Resolver sem termo (Contingência)"
                                  >
                                    <AlertCircle size={16} />
                                  </button>
                                  <Link 
                                    to={`/users?userId=${user.id}&tab=terms`}
                                    className="p-1.5 hover:bg-orange-900/40 text-slate-400 hover:text-orange-400 rounded-lg transition-colors"
                                    title="Ver detalhes do termo e colaborador"
                                  >
                                    <FileText size={16} />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {pendingTerms.length > 5 && (
                          <button onClick={() => navigate('/reports?tab=USERS')} className="w-full py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors">
                            Ver mais {pendingTerms.length - 5} pendências
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions / Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-2xl shadow-lg shadow-blue-900/20 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-lg font-black uppercase tracking-widest mb-2">Novo Empréstimo</h3>
                <p className="text-sm text-blue-100 mb-6 opacity-80">Atribua um dispositivo ou acessório a um colaborador agora.</p>
                <button 
                  onClick={() => navigate('/operations')}
                  className="bg-white text-blue-700 px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95"
                >
                  Iniciar Checkout
                </button>
              </div>
              <Smartphone className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-lg font-black uppercase tracking-widest mb-2">Relatórios</h3>
                <p className="text-sm text-slate-400 mb-6 font-medium">Acesse dados financeiros, consumo e inventário completo.</p>
                <button 
                  onClick={() => navigate('/reports')}
                  className="bg-slate-700 text-white px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-600 transition-all active:scale-95 border border-slate-600"
                >
                  Ver Relatórios
                </button>
              </div>
              <FileText className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
            </div>
          </div>
        </div>

        {/* Right Column: Tasks Widget */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl flex flex-col h-full min-h-[600px]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <ClipboardList size={20} />
                </div>
                <h2 className="text-lg font-black text-slate-100 uppercase tracking-widest">Tarefas</h2>
              </div>
              <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-[10px] font-black uppercase">
                {tasks.filter(t => t.status !== TaskStatus.COMPLETED).length} Ativas
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <TaskDashboardWidget 
                tasks={tasks} 
                onViewAll={() => navigate('/tasks')}
                onTaskClick={(task) => setSelectedTask(task)}
                systemUsers={systemUsers}
                currentUserId={localStorage.getItem('it_asset_user') ? JSON.parse(localStorage.getItem('it_asset_user')!).id : ''}
              />
            </div>
            <div className="p-4 border-t border-slate-800">
              <button 
                onClick={() => navigate('/tasks')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Gerenciar Todas <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {resolvingTerm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl p-8 w-full max-w-md border border-slate-800 shadow-2xl">
            <h3 className="text-xl font-black text-slate-100 mb-4 uppercase tracking-tight">Resolver Pendência Manualmente</h3>
            <p className="text-sm text-slate-400 mb-6 font-medium leading-relaxed">
              Você está resolvendo a pendência de <span className="text-slate-100 font-bold">{resolvingTerm.userName}</span> sem anexo. 
              Esta ação será registrada nos logs de auditoria.
            </p>
            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Motivo da Resolução</label>
              <textarea
                rows={4}
                className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Descreva por que este termo está sendo resolvido sem anexo..."
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
              ></textarea>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setResolvingTerm(null); setResolveReason(''); }}
                className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleResolveManual}
                disabled={!resolveReason.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (tid, updates) => {
            await updateTask(tid, updates, localStorage.getItem('userName') || 'Admin');
            setSelectedTask(null);
          }}
          currentUser={localStorage.getItem('userName') || 'Admin'}
          isAdmin={isAdmin}
          systemUsers={systemUsers}
          devices={devices}
          models={models}
        />
      )}

      {editingExpediente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden border border-slate-800 shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div>
                <h2 className="text-lg font-black text-slate-100 uppercase tracking-tight">Ajuste de Expediente</h2>
                <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-tighter">{editingExpediente.nome}</p>
              </div>
              <button onClick={() => setEditingExpediente(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Motivo / Observação</label>
                <textarea 
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 placeholder-slate-600"
                  rows={3}
                  placeholder="Ex: Férias, Licença Médica, etc."
                  value={editingExpediente.observation}
                  onChange={e => setEditingExpediente({...editingExpediente, observation: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Data para Reativação</label>
                <input 
                  type="date"
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
                  value={editingExpediente.reactivationDate}
                  onChange={e => setEditingExpediente({...editingExpediente, reactivationDate: e.target.value})}
                />
              </div>
            </div>
            <div className="p-6 bg-slate-900/50 border-t border-slate-800 flex gap-3">
              <button 
                onClick={() => setEditingExpediente(null)}
                className="flex-1 py-3 text-sm font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  try {
                    await saveExpedienteOverride(editingExpediente.codigo, editingExpediente.observation, editingExpediente.reactivationDate || null);
                    setEditingExpediente(null);
                  } catch (err) {
                    alert('Erro ao salvar.');
                  }
                }}
                className="flex-1 py-3 text-sm font-black uppercase tracking-widest bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all active:scale-95"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

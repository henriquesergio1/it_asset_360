import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Smartphone, Users, AlertTriangle, FileWarning, ArrowRight, Lock, ChevronDown, ChevronUp, DollarSign, Wrench, AlertCircle, FileText, Info, Clock } from 'lucide-react';
import { DeviceStatus, AccountType } from '../types';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 flex items-start justify-between hover:shadow-md transition-all">
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</h3>
      {subtitle && <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{subtitle}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

const Dashboard = () => {
  const { devices, users, accounts, sectors, maintenances, models, brands, refreshData, expedienteAlerts, fetchExpedienteAlerts } = useData();
  const [isTermsExpanded, setIsTermsExpanded] = useState(false);
  const [isExpedienteExpanded, setIsExpedienteExpanded] = useState(true);
  const [isLccExpanded, setIsLccExpanded] = useState(false);
  const [resolvingTerm, setResolvingTerm] = useState<{termId: string, userName: string} | null>(null);
  const [resolveReason, setResolveReason] = useState('');

  useEffect(() => {
      fetchExpedienteAlerts();
  }, []);

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

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

  const dataStatus = [
    { name: 'Disponível', value: availableDevices, color: '#10B981' }, 
    { name: 'Em Uso', value: devices.filter(d => d.status === DeviceStatus.IN_USE).length, color: '#3B82F6' }, 
    { name: 'Manutenção', value: maintenanceDevices, color: '#F59E0B' }, 
  ];

  // Filtra termos pendentes
  const pendingTerms = users.flatMap(u => 
      (u.terms || []).filter(t => !t.fileUrl && !t.hasFile).map(t => ({
          term: t,
          user: u
      }))
  ).sort((a, b) => new Date(b.term.date).getTime() - new Date(a.term.date).getTime());

  const visiblePendingTerms = isTermsExpanded ? pendingTerms : pendingTerms.slice(0, 3);

  // LCC Metrics & Alerts
  const deviceLCCData = devices.map(d => {
      const deviceMaints = maintenances.filter(m => m.deviceId === d.id);
      const totalMaint = deviceMaints.reduce((sum, m) => sum + (m.cost || 0), 0);
      const purchaseCost = d.purchaseCost || 0;
      const ratio = purchaseCost > 0 ? (totalMaint / purchaseCost) : 0;
      const age = d.purchaseDate ? (new Date().getTime() - new Date(d.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;
      return { device: d, ratio, age, totalMaint, purchaseCost, lcc: purchaseCost + totalMaint };
  });

  const globalPurchaseTotal = deviceLCCData.reduce((sum, item) => sum + item.purchaseCost, 0);
  const globalMaintTotal = deviceLCCData.reduce((sum, item) => sum + item.totalMaint, 0);
  const globalLCCTotal = globalPurchaseTotal + globalMaintTotal;

  const lccAlerts = deviceLCCData.filter(item => item.ratio >= 0.6 || item.age >= 5)
    .sort((a, b) => b.ratio - a.ratio);

  // Filtra alertas de expediente para exibir apenas colaboradores ativos no sistema local
  const filteredExpedienteAlerts = expedienteAlerts.filter(alert => {
      const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
      return localUser && localUser.active;
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Visão Geral</h1>
      </div>

      {/* Cards Principais Restaurados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Dispositivos" 
          value={devices.length} 
          icon={Smartphone} 
          color="bg-blue-600" 
          subtitle={`${availableDevices} disponíveis`}
        />
        <StatCard 
          title="Licenças / Contas" 
          value={accounts.length} 
          icon={Lock} 
          color="bg-indigo-600" 
          subtitle={`${accounts.filter(a => a.status === 'Ativo').length} e-mails ativos`}
        />
        <StatCard 
          title="Colaboradores" 
          value={users.length} 
          icon={Users} 
          color="bg-emerald-600"
          subtitle={`${users.filter(u => u.active).length} ativos`}
        />
        <StatCard 
          title="Em Manutenção" 
          value={maintenanceDevices} 
          icon={Wrench} 
          color="bg-amber-500"
          subtitle="Aguardando reparo"
        />
      </div>

      {/* Gráficos de Status e Licenças - Reduzidos e Reordenados para 2ª posição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-[280px]">
          <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-3">Status dos Dispositivos</h2>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataStatus} cx="40%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 h-[280px] flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    <Lock size={18} className="text-indigo-600 dark:text-indigo-400"/> Licenças / Contas
                </h2>
                <Link to="/accounts" className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:underline">Ver Tudo</Link>
            </div>
            <div className="space-y-2 overflow-hidden">
                {Object.values(AccountType).map(type => {
                    const count = accounts.filter(a => a.type === type).length;
                    const percentage = accounts.length > 0 ? (count / accounts.length) * 100 : 0;
                    return (
                        <div key={type} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                                <span>{type}</span>
                                <span>{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Alerta de Termos Pendentes - 3ª posição */}
      {pendingTerms.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50 rounded-xl p-6 shadow-sm animate-fade-in">
              <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-lg shrink-0">
                      <FileWarning size={24} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                          <h3 className="text-lg font-bold text-orange-900 dark:text-orange-200">
                              {pendingTerms.length} Termos de Responsabilidade Pendentes
                          </h3>
                          <button 
                              onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                              className="text-orange-600 dark:text-orange-400 hover:text-orange-700 transition-colors"
                          >
                              {isTermsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                      </div>
                      <p className="text-sm text-orange-800/70 dark:text-orange-300/60 mb-4">
                          Existem colaboradores com dispositivos em uso que ainda não assinaram ou anexaram o termo digital.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isTermsExpanded ? 'max-h-[500px] overflow-y-auto pr-2' : 'max-h-[220px] overflow-hidden'}`}>
                          {visiblePendingTerms.map(({term, user}) => (
                              <div key={term.id} className="bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30 flex items-center justify-between group hover:border-orange-300 transition-all">
                                  <div className="flex flex-1 items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">
                                          {user.fullName.charAt(0)}
                                      </div>
                                      <div className="flex flex-col md:flex-row md:items-center md:gap-x-4 flex-wrap">
                                          <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{user.fullName}</p>
                                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter md:mt-0">Setor: {sectors.find(s => s.id === user.sectorId)?.name || 'N/A'}</p>
                                          <p className="text-[10px] text-slate-500 italic md:mt-0">{term.assetDetails}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-x-4 shrink-0">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight hidden md:block">{new Date(term.date).toLocaleDateString('pt-BR')}</p>
                                      <div className="flex items-center gap-1">
                                          <button 
                                              onClick={() => setResolvingTerm({ termId: term.id, userName: user.fullName })}
                                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                              title="Resolver sem termo (Contingência)"
                                          >
                                              <AlertCircle size={18} />
                                          </button>
                                          <Link 
                                              to={`/users?userId=${user.id}&tab=terms`}
                                              className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/40 rounded-lg transition-colors"
                                              title="Ver detalhes do termo e colaborador"
                                          >
                                              <FileText size={18} />
                                          </Link>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                      
                      {!isTermsExpanded && pendingTerms.length > 3 && (
                          <button 
                              onClick={() => setIsTermsExpanded(true)}
                              className="w-full mt-4 py-2 text-xs font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg transition-all"
                          >
                              Ver mais {pendingTerms.length - 3} pendências
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {resolvingTerm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-md">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-4">Resolver Pendência Manualmente</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                      Você está prestes a resolver uma pendência de termo para <span className="font-bold">{resolvingTerm.userName}</span> sem anexar um documento.
                      Esta ação deve ser usada APENAS em casos onde não há necessidade de termo físico ou digital.
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 font-bold mb-4">
                      Um registro de auditoria será criado para esta ação.
                  </p>
                  <div className="mb-4">
                      <label htmlFor="resolveReason" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Motivo da Resolução <span className="text-red-500">*</span></label>
                      <textarea
                          id="resolveReason"
                          rows={4}
                          className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Descreva o motivo pelo qual esta pendência está sendo resolvida sem um termo..."
                          value={resolveReason}
                          onChange={(e) => setResolveReason(e.target.value)}
                      ></textarea>
                  </div>
                  <div className="flex justify-end gap-3">
                      <button
                          onClick={() => { setResolvingTerm(null); setResolveReason(''); }}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      >
                          Cancelar
                      </button>
                      <button
                          onClick={handleResolveManual}
                          disabled={!resolveReason.trim()}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                          Confirmar Resolução
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Alerta de Validação de Expediente (ERP) - 4ª posição, Formato Lista */}
      {filteredExpedienteAlerts.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6 shadow-sm animate-fade-in">
              <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg shrink-0">
                      <Clock size={24} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                          <h3 className="text-lg font-bold text-red-900 dark:text-red-200">
                              {filteredExpedienteAlerts.length} Alertas de Expediente (ERP)
                          </h3>
                          <button 
                              onClick={() => setIsExpedienteExpanded(!isExpedienteExpanded)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                          >
                              {isExpedienteExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                      </div>
                      <p className="text-sm text-red-800/70 dark:text-red-300/60 mb-4">
                          Colaboradores ativos da equipe de vendas identificados com expediente <span className="font-bold">FALSO</span> no ERP.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isExpedienteExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[0px] overflow-hidden'}`}>
                          {filteredExpedienteAlerts.map((alert) => {
                              const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
                              return (
                                  <div key={alert.codigo} className="bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-red-100 dark:border-red-900/30 flex items-center justify-between group hover:border-red-300 transition-all">
                                      <div className="flex flex-1 items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 font-bold text-xs shrink-0">
                                              {alert.nome.charAt(0)}
                                          </div>
                                          <div className="flex flex-col md:flex-row md:items-center md:gap-x-4 flex-wrap">
                                              <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{alert.nome}</p>
                                              <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter md:mt-0">Cód ERP: {alert.codigo}</p>
                                              <p className="text-[10px] text-slate-500 italic md:mt-0">CPF: {alert.cpf}</p>
                                              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest md:mt-0 ml-auto md:ml-0">Expediente Falso</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-x-4 shrink-0">
                                          <div className="flex items-center gap-1">
                                              {localUser && (
                                                  <Link 
                                                      to={`/users?userId=${localUser.id}`}
                                                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                                      title="Ver Colaborador Local"
                                                  >
                                                      <ArrowRight size={18} />
                                                  </Link>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Seção LCC e Saúde dos Ativos - 5ª posição */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <button 
              onClick={() => setIsLccExpanded(!isLccExpanded)}
              className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
          >
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <DollarSign size={22}/>
                  </div>
                  <div className="text-left">
                      <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">Saúde Financeira & Ciclo de Vida (LCC)</h2>
                      <p className="text-xs text-slate-400 font-medium">Análise de investimento total e alertas de obsolescência</p>
                  </div>
              </div>
              <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-6 mr-4">
                      <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LCC Global</p>
                          <p className="text-sm font-black text-gray-900 dark:text-slate-100">{formatCurrency(globalLCCTotal)}</p>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alertas</p>
                          <p className={`text-sm font-black ${lccAlerts.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{lccAlerts.length}</p>
                      </div>
                  </div>
                  {isLccExpanded ? <ChevronUp size={24} className="text-slate-400"/> : <ChevronDown size={24} className="text-slate-400"/>}
              </div>
          </button>

          {isLccExpanded && (
              <div className="p-6 pt-0 space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                                  <Smartphone size={18}/>
                              </div>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Aquisição</span>
                          </div>
                          <h4 className="text-2xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(globalPurchaseTotal)}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Investimento inicial em hardware.</p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                  <Wrench size={18}/>
                              </div>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Manutenção</span>
                          </div>
                          <h4 className="text-2xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(globalMaintTotal)}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Gastos acumulados com reparos.</p>
                      </div>

                      <div className="bg-slate-900 dark:bg-black p-5 rounded-2xl border border-white/10 shadow-xl">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-white/10 text-white rounded-lg">
                                  <DollarSign size={18}/>
                              </div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LCC Global (TCO)</span>
                          </div>
                          <h4 className="text-2xl font-black text-white">{formatCurrency(globalLCCTotal)}</h4>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Custo total de propriedade dos ativos.</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col">
                          <div className="p-5 border-b border-gray-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                              <h3 className="text-sm font-black text-gray-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                                  <AlertTriangle size={16} className="text-red-500"/> Ativos com Alerta de Saúde
                              </h3>
                              <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                  {lccAlerts.length} Críticos
                              </span>
                          </div>
                          <div className="flex-1 overflow-y-auto max-h-[320px] custom-scrollbar">
                              {lccAlerts.length > 0 ? (
                                  <table className="w-full text-sm text-left">
                                      <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b dark:border-slate-700 sticky top-0 z-10">
                                          <tr>
                                              <th className="px-6 py-4">Equipamento</th>
                                              <th className="px-6 py-4 text-center">Índice LCC</th>
                                              <th className="px-6 py-4 text-center">Idade</th>
                                              <th className="px-6 py-4 text-right">Ação</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y dark:divide-slate-800">
                                          {lccAlerts.map((item) => {
                                              const model = models.find(m => m.id === item.device.modelId);
                                              const brand = brands.find(b => b.id === model?.brandId);
                                              return (
                                                  <tr key={item.device.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                      <td className="px-6 py-4">
                                                          <Link to={`/devices?deviceId=${item.device.id}`} className="flex flex-col">
                                                              <span className="font-bold text-gray-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors">{brand?.name} {model?.name}</span>
                                                              <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Patrimônio: {item.device.assetTag || 'S/T'}</span>
                                                          </Link>
                                                      </td>
                                                      <td className="px-6 py-4">
                                                          <div className="flex flex-col items-center gap-1">
                                                              <span className={`text-xs font-black ${item.ratio >= 0.6 ? 'text-red-600' : 'text-slate-600'}`}>
                                                                  {(item.ratio * 100).toFixed(0)}%
                                                              </span>
                                                              <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                                                  <div className={`h-full ${item.ratio >= 0.6 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(item.ratio * 100, 100)}%` }}></div>
                                                              </div>
                                                          </div>
                                                      </td>
                                                      <td className="px-6 py-4 text-center">
                                                          <span className={`text-xs font-bold ${item.age >= 5 ? 'text-orange-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                                              {item.age.toFixed(1)}a
                                                          </span>
                                                      </td>
                                                      <td className="px-6 py-4 text-right">
                                                          <Link to={`/devices?deviceId=${item.device.id}`} className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                                                              <ArrowRight size={14}/> Analisar
                                                          </Link>
                                                      </td>
                                                  </tr>
                                              );
                                          })}
                                      </tbody>
                                  </table>
                              ) : (
                                  <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-slate-700 gap-4">
                                      <p className="text-xs font-black uppercase tracking-widest italic">Nenhum alerta crítico detectado.</p>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                          <div>
                              <h3 className="text-sm font-black text-gray-800 dark:text-slate-100 uppercase tracking-widest mb-6">Composição do LCC</h3>
                              <div className="space-y-6">
                                  <div className="space-y-2">
                                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                          <span>Aquisição</span>
                                          <span className="text-blue-600">{globalLCCTotal > 0 ? ((globalPurchaseTotal / globalLCCTotal) * 100).toFixed(1) : 0}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden shadow-inner">
                                          <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${globalLCCTotal > 0 ? (globalPurchaseTotal / globalLCCTotal) * 100 : 0}%` }}></div>
                                      </div>
                                  </div>

                                  <div className="space-y-2">
                                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                          <span>Manutenção</span>
                                          <span className="text-emerald-600">{globalLCCTotal > 0 ? ((globalMaintTotal / globalLCCTotal) * 100).toFixed(1) : 0}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden shadow-inner">
                                          <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${globalLCCTotal > 0 ? (globalMaintTotal / globalLCCTotal) * 100 : 0}%` }}></div>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                              <div className="flex items-start gap-3">
                                  <Info size={16} className="text-blue-500 shrink-0 mt-0.5"/>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                                      Para cada R$ 1,00 investido em hardware, o custo operacional de manutenção é de R$ {globalPurchaseTotal > 0 ? (globalMaintTotal / globalPurchaseTotal).toFixed(2) : '0.00'}.
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default Dashboard;

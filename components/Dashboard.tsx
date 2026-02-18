import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Smartphone, AlertTriangle, FileWarning, ArrowRight, Globe, Lock, ChevronDown, ChevronUp, DollarSign, HelpCircle, Users, ChevronRight, FileSearch } from 'lucide-react';
import { DeviceStatus, AccountType } from '../types';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, subtitle, to }: any) => (
  <Link to={to} className={`relative bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 p-8 flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden group block cursor-pointer`}>
    <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-[0.03] dark:opacity-[0.07] group-hover:scale-125 transition-transform duration-700 ${color}`}></div>
    
    <div className="flex items-start justify-between relative z-10">
      <div className={`p-4 rounded-2xl ${color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-right">
        <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] mb-1">{title}</p>
        <h3 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {value}
        </h3>
      </div>
    </div>
    
    <div className="mt-8 relative z-10 flex items-center justify-between">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{subtitle}</p>
      <div className="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
          <ArrowRight size={18}/>
      </div>
    </div>
  </Link>
);

const Dashboard = () => {
  const { devices, sims, users, accounts, sectors, maintenances } = useData();
  const [isTermsExpanded, setIsTermsExpanded] = useState(false);

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

  const purchaseTotal = devices.reduce((acc, d) => acc + (d.purchaseCost || 0), 0);
  const maintenanceTotal = maintenances.reduce((acc, m) => acc + (m.cost || 0), 0);
  const tcoValue = purchaseTotal + maintenanceTotal;

  const dataStatus = [
    { name: 'Em Estoque', value: availableDevices, color: '#6366f1' }, 
    { name: 'Em Uso', value: inUseDevices, color: '#8b5cf6' }, 
    { name: 'Em Reparo', value: maintenanceDevices, color: '#f59e0b' }, 
  ];

  // Refined Logic: Apenas termos que existem mas não possuem arquivo associado (REAIS)
  const pendingTerms = users.flatMap(u => 
      (u.terms || []).filter(t => !t.fileUrl && !t.hasFile).map(t => ({
          term: t,
          user: u
      }))
  ).sort((a, b) => new Date(b.term.date).getTime() - new Date(a.term.date).getTime());

  const visiblePendingTerms = isTermsExpanded ? pendingTerms : pendingTerms.slice(0, 5);

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-2">Painel de Controle</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Resumo operacional e financeiro v3.5.4</p>
        </div>
        <Link to="/users" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm hover:shadow-md transition-all group">
            <div className="h-10 w-10 bg-indigo-600/10 text-indigo-600 rounded-xl flex items-center justify-center">
                <Users size={20}/>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest leading-none mb-1">Colaboradores</p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{users.filter(u => u.active).length} Ativos</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 ml-2 transition-colors"/>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard 
          title="Dispositivos" 
          value={devices.length} 
          icon={Smartphone} 
          color="bg-indigo-600" 
          subtitle={`${availableDevices} ativos em estoque`}
          to="/devices"
        />
        <StatCard 
          title="Cloud & Licenças" 
          value={accounts.length} 
          icon={Globe} 
          color="bg-violet-600"
          subtitle={`${accounts.filter(a => a.type === AccountType.EMAIL).length} e-mails vinculados`}
          to="/accounts"
        />
        <StatCard 
          title="Investimento (TCO)" 
          value={`R$ ${(tcoValue/1000).toFixed(1)}k`}
          icon={DollarSign} 
          color="bg-emerald-600" 
          subtitle="Valor total: Aquisição + Reparos"
          to="/admin"
        />
        <StatCard 
          title="Manutenção" 
          value={maintenanceDevices} 
          icon={AlertTriangle} 
          color="bg-amber-500"
          subtitle="Aguardando retorno técnico"
          to="/devices?status=Manutenção"
        />
      </div>

      {pendingTerms.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-sm border border-slate-200 dark:border-slate-800 animate-scale-up relative overflow-hidden transition-colors">
              <div className="flex flex-col gap-8 relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b dark:border-slate-800 pb-6">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-2xl shadow-sm">
                              <FileSearch size={24} strokeWidth={2.5}/>
                          </div>
                          <div>
                              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">
                                  Existem {pendingTerms.length} termos pendentes de digitalização
                              </h3>
                              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] mt-1">Sincronize os arquivos assinados nos perfis dos colaboradores</p>
                          </div>
                      </div>
                      <Link to="/users?pending=true" className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-2">
                          Gerenciar Pendências <ArrowRight size={14}/>
                      </Link>
                  </div>
                  
                  <div className="overflow-hidden bg-slate-50 dark:bg-slate-950/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 border-b dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50">
                                  <tr>
                                      <th className="px-8 py-4">Colaborador</th>
                                      <th className="px-8 py-4 text-center">Equipamento</th>
                                      <th className="px-8 py-4 text-center">Data</th>
                                      <th className="px-8 py-4 text-right">Ação</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y dark:divide-slate-800">
                                  {visiblePendingTerms.map(({term, user}) => {
                                      const sector = sectors.find(s => s.id === user.sectorId);
                                      return (
                                          <tr key={term.id} className="hover:bg-white dark:hover:bg-slate-900 transition-all duration-300 group">
                                              <td className="px-8 py-4">
                                                  <div className="flex items-center gap-3">
                                                      <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md group-hover:scale-110 transition-transform">
                                                          {user.fullName.charAt(0)}
                                                      </div>
                                                      <div className="flex flex-col">
                                                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{user.fullName}</span>
                                                          <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">{sector?.name || 'Geral'}</span>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="px-8 py-4 text-center">
                                                  <span className="text-slate-600 dark:text-slate-400 text-[10px] font-mono font-bold bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border dark:border-slate-700 shadow-sm">{term.assetDetails}</span>
                                              </td>
                                              <td className="px-8 py-4 text-center">
                                                  <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(term.date).toLocaleDateString()}</span>
                                              </td>
                                              <td className="px-8 py-4 text-right">
                                                  <Link to={`/users?userId=${user.id}`} className="inline-flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-lg transition-all active:scale-95">
                                                      Digitalizar <ArrowRight size={12}/>
                                                  </Link>
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                      
                      {pendingTerms.length > 5 && (
                          <button 
                            onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                            className="w-full py-4 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-white dark:hover:bg-slate-900 transition-all border-t dark:border-slate-800"
                          >
                              {isTermsExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                              {isTermsExpanded ? 'Recolher Lista' : `Visualizar Todas (${pendingTerms.length})`}
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[500px] relative overflow-hidden group transition-colors">
          <div className="flex items-center justify-between mb-8 relative z-10">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">Monitoramento de Status</h2>
              <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                  <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-800"></div>
              </div>
          </div>
          <div className="flex-1 relative z-10 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataStatus} cx="50%" cy="50%" innerRadius={70} outerRadius={105} paddingAngle={8} dataKey="value" stroke="none">
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: '#fff', padding: '16px' }} itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-[0.3em]">Ativos</span>
                <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">{devices.length}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-8 relative z-10">
              {dataStatus.map((s, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center">
                      <div className="h-2 w-full rounded-full mb-3" style={{ backgroundColor: s.color }}></div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{s.name}</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{s.value}</span>
                  </div>
              ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 h-[500px] flex flex-col relative overflow-hidden transition-colors">
            <div className="flex justify-between items-center mb-10 relative z-10">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Lock size={20} className="text-indigo-600"/> Contas & Acessos
                </h2>
                <Link to="/accounts" className="h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all">
                    <ArrowRight size={18}/>
                </Link>
            </div>
            <div className="space-y-6 overflow-y-auto custom-scrollbar relative z-10 pr-2">
                {Object.values(AccountType).map(type => {
                    const count = accounts.filter(a => a.type === type).length;
                    const percentage = accounts.length > 0 ? (count / accounts.length) * 100 : 0;
                    return (
                        <div key={type} className="group cursor-default">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{type}</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <div className={`bg-indigo-500 h-full transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-auto pt-8 border-t dark:border-slate-800 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>IT Asset v3.5.4</span>
                <span className="text-emerald-500">Produção</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
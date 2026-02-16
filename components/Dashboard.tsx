
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Smartphone, Users, Wifi, AlertTriangle, FileWarning, ArrowRight, Globe, Lock, ChevronDown, ChevronUp, Briefcase } from 'lucide-react';
import { DeviceStatus, ActionType, AccountType } from '../types';
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
  const { devices, sims, users, logs, accounts, sectors } = useData();
  const [isTermsExpanded, setIsTermsExpanded] = useState(false);

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

  const dataStatus = [
    { name: 'Disponível', value: availableDevices, color: '#10B981' }, 
    { name: 'Em Uso', value: inUseDevices, color: '#3B82F6' }, 
    { name: 'Manutenção', value: maintenanceDevices, color: '#F59E0B' }, 
  ];

  // Filtra termos pendentes (inclusive de colaboradores inativados recentemente)
  const pendingTerms = users.flatMap(u => 
      (u.terms || []).filter(t => !t.fileUrl).map(t => ({
          term: t,
          user: u
      }))
  ).sort((a, b) => new Date(b.term.date).getTime() - new Date(a.term.date).getTime());

  const visiblePendingTerms = isTermsExpanded ? pendingTerms : pendingTerms.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Visão Geral</h1>
      </div>

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
          icon={Globe} 
          color="bg-indigo-600"
          subtitle={`${accounts.filter(a => a.type === AccountType.EMAIL).length} e-mails ativos`}
        />
        <StatCard 
          title="Colaboradores" 
          value={users.length} 
          icon={Users} 
          color="bg-emerald-500"
          subtitle={`${users.filter(u => u.active).length} ativos`}
        />
        <StatCard 
          title="Em Manutenção" 
          value={maintenanceDevices} 
          icon={AlertTriangle} 
          color="bg-amber-500"
          subtitle="Aguardando reparo"
        />
      </div>

      {pendingTerms.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50 rounded-xl p-6 shadow-sm animate-fade-in">
              <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-lg shrink-0">
                      <FileWarning size={24} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                          <h3 className="text-lg font-bold text-orange-900 dark:text-orange-200">
                              {pendingTerms.length} Termos Pendentes de Assinatura
                          </h3>
                          <span className="text-[10px] font-black uppercase text-orange-500/60 tracking-widest bg-orange-100 dark:bg-orange-900/40 px-2 py-1 rounded">
                             Requer Digitalização
                          </span>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 rounded-lg border border-orange-100 dark:border-orange-900/30 overflow-hidden mt-4 shadow-sm">
                          <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-orange-50 dark:bg-slate-800 text-orange-800 dark:text-orange-400 text-[10px] uppercase font-black tracking-widest border-b dark:border-slate-700">
                                      <tr>
                                          <th className="px-4 py-3">Colaborador / Função</th>
                                          <th className="px-4 py-3">Equipamento Vinculado</th>
                                          <th className="px-4 py-3">Data Ref.</th>
                                          <th className="px-4 py-3 text-right">Ação</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y dark:divide-slate-800">
                                      {visiblePendingTerms.map(({term, user}) => {
                                          const sector = sectors.find(s => s.id === user.sectorId);
                                          return (
                                              <tr key={term.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-orange-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                  <td className="px-4 py-3">
                                                      <div className="flex flex-col">
                                                          <span className="font-bold text-gray-800 dark:text-slate-100">{user.fullName}</span>
                                                          <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                              <Briefcase size={10}/> {sector?.name || 'Não Informado'}
                                                              {!user.active && <span className="ml-1 text-red-400 dark:text-red-500/80">[INATIVO]</span>}
                                                          </span>
                                                      </div>
                                                  </td>
                                                  <td className="px-4 py-3">
                                                      <span className="text-gray-600 dark:text-slate-400 text-xs font-medium">{term.assetDetails}</span>
                                                  </td>
                                                  <td className="px-4 py-3 whitespace-nowrap">
                                                      <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                                                          {new Date(term.date).toLocaleDateString()}
                                                      </span>
                                                  </td>
                                                  <td className="px-4 py-3 text-right">
                                                      <Link to={`/users?userId=${user.id}`} className="inline-flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-orange-200 dark:hover:bg-orange-900 transition-colors">
                                                          <ArrowRight size={14}/> Resolver
                                                      </Link>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                          
                          {pendingTerms.length > 3 && (
                              <button 
                                onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                                className="w-full py-3 bg-slate-50 dark:bg-slate-800/80 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all border-t dark:border-slate-700"
                              >
                                  {isTermsExpanded ? (
                                      <><ChevronUp size={16}/> Mostrar Menos</>
                                  ) : (
                                      <><ChevronDown size={16}/> Mostrar Todas as Pendências ({pendingTerms.length - 3} mais)</>
                                  )}
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-[380px]">
          <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-4">Status dos Dispositivos</h2>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 h-[380px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    <Lock size={18} className="text-indigo-600 dark:text-indigo-400"/> Licenças / Contas
                </h2>
                <Link to="/accounts" className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:underline">Ver Tudo</Link>
            </div>
            <div className="space-y-4 overflow-y-auto custom-scrollbar">
                {Object.values(AccountType).map(type => {
                    const count = accounts.filter(a => a.type === type).length;
                    const percentage = accounts.length > 0 ? (count / accounts.length) * 100 : 0;
                    return (
                        <div key={type} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                                <span>{type}</span>
                                <span>{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React from 'react';
import { useData } from '../contexts/DataContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Smartphone, Users, Wifi, AlertTriangle, FileWarning, ArrowRight, Globe, Lock } from 'lucide-react';
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
  const { devices, sims, users, logs, accounts } = useData();

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

  const dataStatus = [
    { name: 'Disponível', value: availableDevices, color: '#10B981' }, 
    { name: 'Em Uso', value: inUseDevices, color: '#3B82F6' }, 
    { name: 'Manutenção', value: maintenanceDevices, color: '#F59E0B' }, 
  ];

  const pendingTerms = users.flatMap(u => 
      (u.terms || []).filter(t => !t.fileUrl).map(t => ({
          term: t,
          user: u
      }))
  );

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
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-lg">
                      <FileWarning size={24} />
                  </div>
                  <div className="flex-1">
                      <h3 className="text-lg font-bold text-orange-900 dark:text-orange-200 mb-1">
                          {pendingTerms.length} Termos Pendentes
                      </h3>
                      <div className="bg-white dark:bg-slate-900 rounded-lg border border-orange-100 dark:border-orange-900/30 overflow-hidden mt-4 shadow-sm">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-orange-50 dark:bg-slate-800 text-orange-800 dark:text-orange-400 text-xs uppercase font-black tracking-widest">
                                  <tr>
                                      <th className="px-4 py-2">Colaborador</th>
                                      <th className="px-4 py-2">Ativo</th>
                                      <th className="px-4 py-2 text-right">Ação</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {pendingTerms.slice(0, 3).map(({term, user}) => (
                                      <tr key={term.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-orange-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                          <td className="px-4 py-2 font-bold text-gray-800 dark:text-slate-100">{user.fullName}</td>
                                          <td className="px-4 py-2 text-gray-600 dark:text-slate-400 text-xs">{term.assetDetails}</td>
                                          <td className="px-4 py-2 text-right">
                                              <Link to={`/users?userId=${user.id}`} className="text-blue-600 dark:text-blue-400 font-bold hover:underline text-xs">Resolver</Link>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-[400px]">
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

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    <Lock size={18} className="text-indigo-600 dark:text-indigo-400"/> Acessos por Tipo
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
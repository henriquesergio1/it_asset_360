
import React from 'react';
import { useData } from '../contexts/DataContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Smartphone, Users, Wifi, AlertTriangle, FileWarning, ArrowRight } from 'lucide-react';
import { DeviceStatus, ActionType } from '../types';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

const Dashboard = () => {
  const { devices, sims, users, logs } = useData();

  // Cálculos de Status
  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

  const dataStatus = [
    { name: 'Disponível', value: availableDevices, color: '#10B981' }, 
    { name: 'Em Uso', value: inUseDevices, color: '#3B82F6' }, 
    { name: 'Manutenção', value: maintenanceDevices, color: '#F59E0B' }, 
  ];

  // --- LÓGICA DE DADOS REAIS PARA O GRÁFICO DE MOVIMENTAÇÃO ---
  const activityData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const label = date.toLocaleDateString('pt-BR', { weekday: 'short' });

    // Filtrar logs deste dia específico
    const dailyLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        return logDate === dateString;
    });

    return {
      name: label,
      // Contar ocorrências de Entrega e Devolução nos logs reais
      // Fix: Removed redundant string comparison that caused TypeScript narrowing errors by relying solely on ActionType enum
      Entregas: dailyLogs.filter(l => l.action === ActionType.CHECKOUT).length,
      Devolucoes: dailyLogs.filter(l => l.action === ActionType.CHECKIN).length
    };
  }).reverse();

  // --- LOGICA DE ALERTAS DE TERMOS PENDENTES ---
  const pendingTerms = users.flatMap(u => 
      (u.terms || []).filter(t => !t.fileUrl).map(t => ({
          term: t,
          user: u
      }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
        <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 font-medium shadow-sm">
          Baixar Relatório
        </button>
      </div>

      {/* Cards de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total de Dispositivos" 
          value={devices.length} 
          icon={Smartphone} 
          color="bg-blue-600" 
          subtitle={`${availableDevices} disponíveis para uso`}
        />
        <StatCard 
          title="Chips Ativos" 
          value={sims.length} 
          icon={Wifi} 
          color="bg-indigo-600"
          subtitle={`${sims.filter(s => s.status === DeviceStatus.AVAILABLE).length} disponíveis`}
        />
        <StatCard 
          title="Usuários Cadastrados" 
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

      {/* SEÇÃO DE ALERTAS - TERMOS PENDENTES */}
      {pendingTerms.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm animate-fade-in">
              <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                      <FileWarning size={24} />
                  </div>
                  <div className="flex-1">
                      <h3 className="text-lg font-bold text-orange-900 mb-1">
                          {pendingTerms.length} Termos Pendentes de Assinatura
                      </h3>
                      <p className="text-sm text-orange-800 mb-4">
                          As seguintes movimentações foram realizadas mas o termo assinado ainda não foi anexado ao sistema.
                      </p>
                      
                      <div className="bg-white rounded-lg border border-orange-100 overflow-hidden">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-orange-50 text-orange-800 text-xs uppercase">
                                  <tr>
                                      <th className="px-4 py-2">Data</th>
                                      <th className="px-4 py-2">Colaborador</th>
                                      <th className="px-4 py-2">Tipo</th>
                                      <th className="px-4 py-2">Ativo</th>
                                      <th className="px-4 py-2 text-right">Ação</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {pendingTerms.slice(0, 5).map(({term, user}) => (
                                      <tr key={term.id} className="border-b last:border-0 hover:bg-orange-50/50">
                                          <td className="px-4 py-2 text-gray-600">{new Date(term.date).toLocaleDateString()}</td>
                                          <td className="px-4 py-2 font-medium text-gray-800">{user.fullName}</td>
                                          <td className="px-4 py-2">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${term.type === 'ENTREGA' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                  {term.type}
                                              </span>
                                          </td>
                                          <td className="px-4 py-2 text-gray-600 text-xs">{term.assetDetails}</td>
                                          <td className="px-4 py-2 text-right">
                                              <Link to={`/users?userId=${user.id}`} className="text-blue-600 hover:underline text-xs flex items-center justify-end gap-1">
                                                  Resolver <ArrowRight size={12}/>
                                              </Link>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                          {pendingTerms.length > 5 && (
                              <div className="px-4 py-2 text-xs text-center text-gray-500 bg-gray-50">
                                  + {pendingTerms.length - 5} outros termos pendentes.
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Seção de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Distribuição de Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Status dos Dispositivos</h2>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Atividade Real */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-gray-800">Movimentação Semanal</h2>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">DADOS REAIS</span>
          </div>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{fill: '#f3f4f6'}} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{fontSize: '12px', paddingBottom: '20px'}} />
                <Bar name="Entregas" dataKey="Entregas" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar name="Devoluções" dataKey="Devolucoes" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela de Logs Recentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">Últimas Movimentações</h3>
          <Link to="/admin" className="text-xs text-blue-600 hover:underline font-bold uppercase tracking-wider">Ver Auditoria Completa</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Ação</th>
                <th className="px-6 py-3">Ativo</th>
                <th className="px-6 py-3">Admin</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 8).map((log) => (
                <tr key={log.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        // Fix: Removed redundant string comparison that caused TypeScript narrowing errors by relying solely on ActionType enum
                        log.action === ActionType.CHECKOUT ? 'bg-blue-100 text-blue-800' : 
                        log.action === ActionType.CHECKIN ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 truncate max-w-[200px]">{log.targetName || log.assetType}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{log.adminUser}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                  <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-400 italic">Nenhuma movimentação registrada.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

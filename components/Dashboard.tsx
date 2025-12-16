import React from 'react';
import { useData } from '../contexts/DataContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Smartphone, Users, Wifi, AlertTriangle } from 'lucide-react';
import { DeviceStatus } from '../types';

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

  // Calculations
  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

  const dataStatus = [
    { name: 'Disponível', value: availableDevices, color: '#10B981' }, // Green
    { name: 'Em Uso', value: inUseDevices, color: '#3B82F6' }, // Blue
    { name: 'Manutenção', value: maintenanceDevices, color: '#F59E0B' }, // Amber
  ];

  // Recent Activity Data (Mocked accumulation from logs)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  }).reverse();

  const activityData = last7Days.map(day => ({
    name: day,
    Entregas: Math.floor(Math.random() * 5), // Mock data for viz since logs might be empty initially
    Devolucoes: Math.floor(Math.random() * 3)
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
        <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 font-medium shadow-sm">
          Baixar Relatório
        </button>
      </div>

      {/* KPI Cards */}
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
          subtitle="98% de cobertura"
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
          subtitle="Prazo médio: 5 dias"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Asset Status Distribution */}
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

        {/* Activity Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Movimentação Semanal</h2>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} />
                <Bar dataKey="Entregas" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="Devolucoes" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700">Últimas Movimentações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Ação</th>
                <th className="px-6 py-3">Ativo</th>
                <th className="px-6 py-3">Usuário</th>
                <th className="px-6 py-3">Admin</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 5).map((log) => (
                <tr key={log.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4">{new Date(log.timestamp).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.action === 'Entrega' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">{log.assetType}</td>
                  <td className="px-6 py-4">
                    {log.assetType === 'User' 
                      ? users.find(u => u.id === log.assetId)?.fullName 
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-400">{log.adminUser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
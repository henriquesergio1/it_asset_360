import React from 'react';
import { useData } from '../contexts/DataContext';
import { Calendar, AlertTriangle, FileText, Users, Cake, Shield, ChevronRight, Award } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export const RhDashboard: React.FC = () => {
  const { rhCollaborators, rhOccurrences, rhTerms, sectors } = useData();

  // 1. Alertas de Férias (11 meses de admissão ou múltiplos de 12 + 11)
  const getHolidayAlerts = () => {
    const alerts: { collaborator: any; months: number; status: string }[] = [];
    rhCollaborators.forEach(c => {
      if (!c.hireDate) return;
      const hire = new Date(c.hireDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - hire.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const totalMonths = Math.floor(diffDays / 30.4);
      
      const reminder = totalMonths % 12;
      if (reminder === 11) {
        alerts.push({
          collaborator: c,
          months: totalMonths,
          status: `Período Aquisitivo Próximo ao Vencimento (${totalMonths} meses de empresa)`
        });
      }
    });
    return alerts;
  };

  // 2. Aniversariantes do Mês
  const getBirthdaysThisMonth = () => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    return rhCollaborators.filter(c => {
      if (!c.birthDate) return false;
      const birthMonth = parseInt(c.birthDate.split('-')[1], 10);
      return birthMonth === currentMonth;
    });
  };

  // 3. Vencimento de Documentos e Contrato de Experiência
  const getDocumentExpirations = () => {
    const alerts: { collaborator: any; type: string; daysRemaining: number; date: string }[] = [];
    const now = new Date();
    now.setHours(0,0,0,0);

    rhCollaborators.forEach(c => {
      // CNH
      if (c.cnhExpiration) {
        const exp = new Date(c.cnhExpiration);
        const diff = exp.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days >= 0 && days <= 90) {
          alerts.push({
            collaborator: c,
            type: `CNH (Cat. ${c.cnhCategory || 'N/A'})`,
            daysRemaining: days,
            date: c.cnhExpiration
          });
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
            collaborator: c,
            type: 'Contrato de Experiência (45 dias)',
            daysRemaining: days45,
            date: exp45.toISOString().split('T')[0]
          });
        } else if (days90 >= 0 && days90 <= 15) {
          alerts.push({
            collaborator: c,
            type: 'Contrato de Experiência (90 dias)',
            daysRemaining: days90,
            date: exp90.toISOString().split('T')[0]
          });
        }
      }
    });
    return alerts;
  };

  const holidayAlerts = getHolidayAlerts();
  const birthdaysThisMonth = getBirthdaysThisMonth();
  const docExpirations = getDocumentExpirations();
  const pendingTermsCount = rhTerms.filter(t => t.status === 'PENDENTE').length;

  // Gráficos Data
  // 1. Distribuição por Tipo de Contrato
  const contractData = Object.entries(
    rhCollaborators.reduce((acc, c) => {
      acc[c.contractType] = (acc[c.contractType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // 2. Ocorrências por Tipo
  const occurrenceData = Object.entries(
    rhOccurrences.reduce((acc, o) => {
      acc[o.type] = (acc[o.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, count]) => ({ name, count }));

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 id="rh-dashboard-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">DASHBOARD DE R.H.</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestão Estratégica de Pessoas e Alertas</p>
        </div>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div id="metric-colab" className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">Total Colaboradores</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{rhCollaborators.length}</span>
          </div>
        </div>

        <div id="metric-terms" className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">Comodatos Pendentes</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{pendingTermsCount}</span>
          </div>
        </div>

        <div id="metric-occurrences" className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">Ocorrências Ativas</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{rhOccurrences.length}</span>
          </div>
        </div>

        <div id="metric-holidays" className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Calendar size={24} />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">Alertas de Férias</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{holidayAlerts.length}</span>
          </div>
        </div>
      </div>

      {/* Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contratos */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white mb-4">Tipos de Contrato</h3>
          <div className="h-64">
            {contractData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contractData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {contractData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Nenhum dado contratual disponível</div>
            )}
          </div>
        </div>

        {/* Ocorrências */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white mb-4">Ocorrências por Tipo</h3>
          <div className="h-64">
            {occurrenceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occurrenceData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Nenhuma ocorrência registrada</div>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas de Férias */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar size={16} className="text-emerald-500" /> Alertas de Férias (11m)
            </h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
              {holidayAlerts.length}
            </span>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {holidayAlerts.length > 0 ? (
              holidayAlerts.map((alert, i) => (
                <div key={i} className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-xs text-slate-900 dark:text-white">{alert.collaborator.fullName}</span>
                    <span className="text-[10px] opacity-75 block text-emerald-600 dark:text-emerald-400 font-bold">{alert.status}</span>
                  </div>
                  <ChevronRight size={16} className="opacity-55 text-emerald-500" />
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum colaborador próximo ao período aquisitivo de férias.</p>
            )}
          </div>
        </div>

        {/* Vencimento de Documentos e Exp */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Vencimento de Documentos
            </h3>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
              {docExpirations.length}
            </span>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {docExpirations.length > 0 ? (
              docExpirations.map((doc, i) => (
                <div key={i} className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-xs text-slate-900 dark:text-white">{doc.collaborator.fullName}</span>
                    <span className="text-[10px] block font-bold text-amber-600 dark:text-amber-400">{doc.type}</span>
                    <span className="text-[9px] opacity-60 block">Vence em {new Date(doc.date).toLocaleDateString('pt-BR')} ({doc.daysRemaining} dias restantes)</span>
                  </div>
                  <ChevronRight size={16} className="opacity-55 text-amber-500" />
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum documento perto do vencimento.</p>
            )}
          </div>
        </div>

        {/* Aniversariantes do Mês */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Cake size={16} className="text-indigo-500" /> Aniversariantes do Mês
            </h3>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">
              {birthdaysThisMonth.length}
            </span>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {birthdaysThisMonth.length > 0 ? (
              birthdaysThisMonth.map((c, i) => (
                <div key={i} className="p-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-xs text-slate-900 dark:text-white">{c.fullName}</span>
                    <span className="text-[10px] opacity-75 block text-indigo-600 dark:text-indigo-400 font-bold">
                      Dia {c.birthDate.split('-')[2]} de {new Date(c.birthDate).toLocaleString('pt-BR', { month: 'long' })}
                    </span>
                  </div>
                  <Cake size={16} className="text-indigo-400/80" />
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum aniversário este mês.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

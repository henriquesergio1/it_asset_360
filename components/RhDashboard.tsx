import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Link } from 'react-router-dom';
import { Calendar, AlertTriangle, FileText, Users, Cake, Shield, ChevronRight, Award, FileSignature, ChevronDown, ChevronUp, ArrowRight, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export const RhDashboard: React.FC = () => {
  const { rhCollaborators, rhOccurrences, rhTerms, sectors } = useData();

  const [isTermsExpanded, setIsTermsExpanded] = useState(false);
  const [isValidationExpanded, setIsValidationExpanded] = useState(false);

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
  
  // Pendências de Comodato R.H.
  const pendingTerms = rhTerms.filter(t => t.status === 'PENDENTE' && t.signatureStatus !== 'WAITING_APPROVAL');
  const pendingApprovalSignatures = rhTerms.filter(t => t.signatureStatus === 'WAITING_APPROVAL');

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

      {/* Alertas de Comodato e Assinatura Digital do R.H. */}
      {(pendingTerms.length > 0 || pendingApprovalSignatures.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Termos Pendentes de R.H. */}
          {pendingTerms.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border-l-4 border-l-orange-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-2xl p-5 animate-fade-in shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-xl shrink-0">
                  <FileText size={20} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">
                      Termos Pendentes de R.H.
                      <span className="ml-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                        {pendingTerms.length}
                      </span>
                    </h3>
                    <button 
                      onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {isTermsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400/80 mb-3">
                    Colaboradores com comodatos emitidos mas ainda não assinados.
                  </p>
                  
                  <div className={`space-y-3 transition-all duration-300 ${isTermsExpanded ? 'max-h-[300px] overflow-y-auto pr-2' : 'max-h-[140px] overflow-hidden'}`}>
                    {pendingTerms.map(term => {
                      const colab = rhCollaborators.find(c => c.id === term.collaboratorId);
                      const sector = sectors.find(s => s.id === colab?.sectorId);
                      return (
                        <div key={term.id} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-800 flex items-center justify-between group hover:border-orange-500/40 transition-all">
                          <div className="min-w-0 flex-1 mr-2">
                            <span className="block text-xs font-black text-slate-900 dark:text-white truncate">{colab?.fullName || 'Desconhecido'}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-450 uppercase tracking-tighter truncate block mt-0.5">
                              {sector?.name || 'Sem Setor'} • Cód: {colab?.role || 'N/A'} • {term.assetDetails}
                            </span>
                          </div>
                          <Link 
                            to="/rh/comodato"
                            className="p-1.5 bg-white dark:bg-slate-800 text-slate-650 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-1 text-[10px] font-black uppercase shrink-0"
                          >
                            Analisar <ArrowRight size={12} />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validações Pendentes de R.H. */}
          {pendingApprovalSignatures.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 dark:border-l-sky-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-2xl p-5 animate-fade-in shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 rounded-xl shrink-0">
                  <FileSignature size={20} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">
                      Validações de Comodato
                      <span className="ml-2 bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                        {pendingApprovalSignatures.length}
                      </span>
                    </h3>
                    <button 
                      onClick={() => setIsValidationExpanded(!isValidationExpanded)}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {isValidationExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400/80 mb-3">
                    Assinaturas digitais jurídicas aguardando validação do gestor.
                  </p>
                  
                  <div className={`space-y-3 transition-all duration-300 ${isValidationExpanded ? 'max-h-[300px] overflow-y-auto pr-2' : 'max-h-[140px] overflow-hidden'}`}>
                    {pendingApprovalSignatures.map(term => {
                      const colab = rhCollaborators.find(c => c.id === term.collaboratorId);
                      const sector = sectors.find(s => s.id === colab?.sectorId);
                      return (
                        <div key={term.id} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-blue-200 dark:border-blue-900/20 flex items-center justify-between group hover:border-blue-500/40 transition-all">
                          <div className="min-w-0 flex-1 mr-2">
                            <span className="block text-xs font-black text-slate-900 dark:text-white truncate">{colab?.fullName || 'Desconhecido'}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-450 uppercase tracking-tighter truncate block mt-0.5">
                              {sector?.name || 'Sem Setor'} • Cód: {colab?.role || 'N/A'} • {term.assetDetails}
                            </span>
                          </div>
                          <Link 
                            to="/rh/comodato"
                            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-1 text-[10px] font-black uppercase shadow-sm shrink-0"
                          >
                            Validar <ArrowRight size={12} />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

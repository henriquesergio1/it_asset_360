import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { RhOccurrence } from '../types';
import { Plus, Trash2, Calendar, FileText, AlertTriangle, Search } from 'lucide-react';

export const RhOccurrenceManager: React.FC = () => {
  const { rhCollaborators, rhOccurrences, addRhOccurrence, deleteRhOccurrence } = useData();
  const { user } = useAuth();
  const adminName = user?.name || 'Gestor R.H.';

  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Form State
  const [form, setForm] = useState({
    collaboratorId: '',
    type: 'Atestado Médico' as 'Falta Justificada' | 'Falta Injustificada' | 'Atestado Médico' | 'Licença Maternidade' | 'Licença Paternidade' | 'Afastamento INSS',
    startDate: '',
    endDate: '',
    notes: '',
    fileUrl: ''
  });

  // File upload state simulator
  const [attachedFileName, setAttachedFileName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.collaboratorId || !form.startDate || !form.endDate) return;

    const colab = rhCollaborators.find(c => c.id === form.collaboratorId);
    if (!colab) return;

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const computedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const finalOccurrence: RhOccurrence = {
      id: 'occ-' + Math.random().toString(36).substr(2, 9),
      collaboratorId: form.collaboratorId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      daysCount: computedDays,
      notes: form.notes || '',
      fileUrl: attachedFileName ? 'mock_cert_url_' + Math.random().toString(36).substr(2, 4) : ''
    };

    addRhOccurrence(finalOccurrence, adminName);
    
    // Reset form
    setForm({
      collaboratorId: '',
      type: 'Atestado Médico',
      startDate: '',
      endDate: '',
      notes: '',
      fileUrl: ''
    });
    setAttachedFileName('');
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza de que deseja remover este lançamento de ocorrência de R.H.?')) {
      deleteRhOccurrence(id, adminName);
    }
  };

  const filteredOccurrences = rhOccurrences.filter(o => {
    const colabName = rhCollaborators.find(c => c.id === o.collaboratorId)?.fullName || 'Desconhecido';
    return colabName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.type.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 id="rh-occurrence-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">FALTAS, ATESTADOS E OCORRÊNCIAS</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Controle rigoroso de afastamentos, atestados médicos, licenças e férias</p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all uppercase tracking-wider"
          >
            <Plus size={16} /> Lançar Ocorrência
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel Esquerdo: Formulário de Lançamento */}
        {showCreate ? (
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700/60 pb-3 mb-2">
              <span className="text-xs font-black uppercase text-indigo-600 tracking-wider">Nova Ocorrência</span>
              <button onClick={() => setShowCreate(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Colaborador Afetado *</label>
                <select
                  required
                  value={form.collaboratorId}
                  onChange={e => setForm(p => ({ ...p, collaboratorId: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold"
                >
                  <option value="">Selecione o Colaborador...</option>
                  {rhCollaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Afastamento *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold"
                >
                  <option value="Atestado Médico">Atestado Médico</option>
                  <option value="Falta Justificada">Falta Justificada</option>
                  <option value="Falta Injustificada">Falta Injustificada</option>
                  <option value="Licença Maternidade">Licença Maternidade</option>
                  <option value="Licença Paternidade">Licença Paternidade</option>
                  <option value="Afastamento INSS">Afastamento INSS</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Início *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Fim *</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Anotações / CID / Motivo</label>
                <textarea
                  rows={4}
                  placeholder="Justificativa do afastamento, observações médicas importantes, CID se houver..."
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Anexos */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <span className="block text-[10px] font-black uppercase text-slate-400">Anexo Comprovante (.pdf, .jpg)</span>
                <input
                  type="text"
                  placeholder="Nome do arquivo do atestado..."
                  value={attachedFileName}
                  onChange={e => setAttachedFileName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl uppercase tracking-wider shadow-md"
              >
                Salvar Lançamento
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center text-center py-12">
            <AlertTriangle size={36} className="text-indigo-500 mb-2 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white mb-1">Afastamentos em Tempo Real</h3>
            <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
              Clique no botão superior para lançar uma falta, atestado médico, férias regulamentares ou licenças especiais para qualquer colaborador.
            </p>
          </div>
        )}

        {/* Painel Direito: Histórico e Lançamentos de Ocorrências */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col justify-between min-h-[60vh]">
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700/50 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Lançamentos de Ocorrências</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histórico de atestados e afastamentos</p>
              </div>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nome ou tipo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-semibold"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {filteredOccurrences.map(occ => {
                const start = new Date(occ.startDate);
                const end = new Date(occ.endDate);
                const colabName = rhCollaborators.find(c => c.id === occ.collaboratorId)?.fullName || 'Desconhecido';

                return (
                  <div
                    key={occ.id}
                    className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/50 rounded-2xl flex justify-between items-start hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                  >
                    <div className="flex gap-4">
                      <div className="p-3.5 bg-rose-100 dark:bg-rose-500/10 text-rose-600 rounded-xl h-11 w-11 flex items-center justify-center shrink-0">
                        <Calendar size={18} />
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-950 dark:text-white">{colabName}</span>
                          <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 font-black text-[9px] rounded uppercase">{occ.type}</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">{occ.notes || 'Nenhuma anotação inserida'}</p>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
                          <span>Período: {start.toLocaleDateString('pt-BR')} até {end.toLocaleDateString('pt-BR')}</span>
                          <span className="font-bold text-slate-500 dark:text-slate-300">({occ.daysCount} {occ.daysCount === 1 ? 'dia' : 'dias'} de afastamento)</span>
                        </div>
                        {occ.fileUrl && (
                          <div className="flex items-center gap-1 text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase mt-1">
                            <FileText size={12} /> Atestado Médico Anexado (.PDF)
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(occ.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {filteredOccurrences.length === 0 && (
                <p className="text-xs text-slate-400 py-12 text-center">Nenhum afastamento ou ocorrência encontrada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

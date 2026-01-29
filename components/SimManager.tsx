
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SimCard, DeviceStatus } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, AlertTriangle, Wifi, Signal, X, Eye, Info } from 'lucide-react';

const SimManager = () => {
  const { sims, addSim, updateSim, deleteSim, users } = useData();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [formData, setFormData] = useState<Partial<SimCard>>({ status: DeviceStatus.AVAILABLE });

  const adminName = currentUser?.name || 'Unknown';

  const total = sims.length;
  const inUse = sims.filter(s => s.status === DeviceStatus.IN_USE).length;
  const available = sims.filter(s => s.status === DeviceStatus.AVAILABLE).length;

  const handleOpenModal = (sim?: SimCard, viewOnly: boolean = false) => {
    setIsViewOnly(viewOnly);
    if (sim) {
      setEditingId(sim.id);
      setFormData(sim);
    } else {
      setEditingId(null);
      setFormData({ status: DeviceStatus.AVAILABLE, operator: 'Vivo', planDetails: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (editingId && formData.id) {
      updateSim(formData as SimCard, adminName);
    } else {
      addSim({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as SimCard, adminName);
    }
    setIsModalOpen(false);
  };

  const handleDeleteClick = (id: string) => {
      setDeleteTargetId(id);
      setDeleteReason('');
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
      if (deleteTargetId && deleteReason.trim()) {
          deleteSim(deleteTargetId, adminName, deleteReason);
          setIsDeleteModalOpen(false);
          setDeleteTargetId(null);
          setDeleteReason('');
      } else {
          alert('Por favor, informe o motivo da exclusão.');
      }
  };

  const filteredSims = sims.filter(s => 
    s.phoneNumber.includes(searchTerm) || 
    s.iccid.includes(searchTerm) ||
    s.operator.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => a.phoneNumber.localeCompare(b.phoneNumber));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Chips / SIMs</h1>
          <p className="text-gray-500 text-sm">Controle de linhas (Ordem A-Z por Número).</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-bold">
          <Plus size={18} /> Novo SIM
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm">
            <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Total de Linhas</span>
                <p className="text-3xl font-black text-blue-900">{total}</p>
            </div>
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm"><Signal size={20}/></div>
          </div>
          <div className="bg-green-50 p-5 rounded-2xl border border-green-100 flex items-center justify-between shadow-sm">
            <div>
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest block mb-1">Disponíveis</span>
                <p className="text-3xl font-black text-green-800">{available}</p>
            </div>
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-green-500 shadow-sm"><Wifi size={20}/></div>
          </div>
          <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex items-center justify-between shadow-sm">
            <div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Em Uso</span>
                <p className="text-3xl font-black text-indigo-900">{inUse}</p>
            </div>
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-indigo-500 shadow-sm"><Smartphone size={20}/></div>
          </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          placeholder="Buscar por número, ICCID ou operadora..." 
          className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 font-black tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Número</th>
                <th className="px-6 py-4">Operadora</th>
                <th className="px-6 py-4">ICCID</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSims.map((sim) => {
                const assignedUser = users.find(u => u.id === sim.currentUserId);
                return (
                  <tr key={sim.id} onClick={() => handleOpenModal(sim, true)} className="bg-white border-b hover:bg-indigo-50/30 transition-colors cursor-pointer group">
                    <td className="px-6 py-4 font-bold text-gray-900">{sim.phoneNumber}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border">{sim.operator}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400 font-bold">{sim.iccid}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border
                        ${sim.status === DeviceStatus.AVAILABLE ? 'bg-green-50 text-green-700 border-green-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                        {sim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {assignedUser ? (
                          <span className="text-xs font-bold text-blue-600 underline cursor-pointer hover:text-blue-800">{assignedUser.fullName}</span>
                      ) : <span className="text-gray-300 font-bold text-[10px] uppercase tracking-wider italic">Disponível</span>}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenModal(sim, false)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all" title="Editar"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteClick(sim.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-all" title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSims.length === 0 && (
                  <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-400 italic">Nenhum chip encontrado.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-indigo-100">
                  <div className="bg-slate-900 px-8 py-5 flex justify-between items-center border-b border-white/10">
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? (isViewOnly ? 'Detalhes do Chip' : 'Editar Linha') : 'Novo Chip / SIM'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-8 space-y-6">
                      {isViewOnly && (
                          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3 mb-2">
                              <Info className="text-blue-600" size={20}/>
                              <p className="text-xs font-bold text-blue-800">Modo de visualização. Clique no ícone de lápis na listagem para editar.</p>
                          </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Número da Linha</label>
                              <input disabled={isViewOnly} required type="text" placeholder="(00) 00000-0000" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 font-bold" value={formData.phoneNumber || ''} onChange={e => setFormData({...formData, phoneNumber: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Operadora</label>
                              <select disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 font-bold" value={formData.operator || ''} onChange={e => setFormData({...formData, operator: e.target.value})}>
                                  <option value="Vivo">Vivo</option>
                                  <option value="Claro">Claro</option>
                                  <option value="Tim">Tim</option>
                                  <option value="Oi">Oi</option>
                                  <option value="Arquia">Arquia</option>
                                  <option value="Outra">Outra</option>
                              </select>
                          </div>
                          <div className="md:col-span-2">
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">ICCID (20 dígitos)</label>
                              <input disabled={isViewOnly} required type="text" placeholder="8955..." className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 font-mono" value={formData.iccid || ''} onChange={e => setFormData({...formData, iccid: e.target.value})}/>
                          </div>
                          <div className="md:col-span-2">
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Detalhes do Plano</label>
                              <input disabled={isViewOnly} type="text" placeholder="Ex: 50GB Mensal Corporativo" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50" value={formData.planDetails || ''} onChange={e => setFormData({...formData, planDetails: e.target.value})}/>
                          </div>
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-6 border-t">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all tracking-widest border border-slate-200">Fechar</button>
                          {!isViewOnly && (
                            <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xl font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95">Salvar Cadastro</button>
                          )}
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Modal de Exclusão */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-sm overflow-hidden border border-red-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-inner border border-red-100"><AlertTriangle size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight">Remover Chip do Inventário?</h3>
                          <p className="text-xs text-slate-400 mt-2">Esta ação é permanente. Informe o motivo abaixo:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 focus:border-red-300 outline-none mb-6 transition-all" rows={3} placeholder="Ex: Chip extraviado, linha cancelada..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200">Manter</button>
                          <button onClick={handleConfirmDelete} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all disabled:opacity-50">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SimManager;

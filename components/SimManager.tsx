
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SimCard, DeviceStatus } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, AlertTriangle, Wifi, Signal } from 'lucide-react';

const SimManager = () => {
  const { sims, addSim, updateSim, deleteSim, users } = useData();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [formData, setFormData] = useState<Partial<SimCard>>({ status: DeviceStatus.AVAILABLE });

  const adminName = currentUser?.name || 'Unknown';

  // Statistics
  const total = sims.length;
  const inUse = sims.filter(s => s.status === DeviceStatus.IN_USE).length;
  const available = sims.filter(s => s.status === DeviceStatus.AVAILABLE).length;

  const handleOpenModal = (sim?: SimCard) => {
    if (sim) {
      setEditingId(sim.id);
      setFormData(sim);
    } else {
      setEditingId(null);
      setFormData({ status: DeviceStatus.AVAILABLE });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Chips / SIMs</h1>
          <p className="text-gray-500 text-sm">Controle de linhas móveis e planos de dados.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold">
          <Plus size={18} /> Novo SIM
        </button>
      </div>

      {/* Summary Cards */}
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
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          placeholder="Buscar por número, ICCID ou operadora..." 
          className="pl-10 w-full border border-gray-300 rounded-xl py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Número</th>
                <th className="px-6 py-3">Operadora</th>
                <th className="px-6 py-3">ICCID</th>
                <th className="px-6 py-3">Plano</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Usuário</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSims.map((sim) => {
                const assignedUser = users.find(u => u.id === sim.currentUserId);
                return (
                  <tr key={sim.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{sim.phoneNumber}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">{sim.operator}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 font-bold">{sim.iccid}</td>
                    <td className="px-6 py-4 text-xs font-medium">{sim.planDetails || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider 
                        ${sim.status === DeviceStatus.AVAILABLE ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {sim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {assignedUser ? (
                          <span className="text-xs font-bold text-blue-600 underline cursor-pointer">{assignedUser.fullName}</span>
                      ) : <span className="text-gray-300 font-bold text-xs uppercase tracking-wider">Livre</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenModal(sim)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteClick(sim.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

       {/* Delete Modal */}
       {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in border border-red-100">
                  <div className="p-6">
                      <div className="flex flex-col items-center text-center mb-4">
                          <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3">
                              <AlertTriangle size={24} />
                          </div>
                          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Excluir Chip/SIM?</h3>
                          <p className="text-xs text-gray-500 mt-1 font-medium">
                              Esta ação removerá o item do inventário permanentemente. É obrigatório informar o motivo.
                          </p>
                      </div>
                      
                      <div className="mb-4">
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Motivo da Exclusão</label>
                          <textarea 
                              className="w-full border-2 border-red-100 rounded-xl p-3 text-sm focus:border-red-400 outline-none transition-colors" 
                              rows={3} 
                              placeholder="Ex: Cancelamento de linha, perda, defeito..."
                              value={deleteReason}
                              onChange={(e) => setDeleteReason(e.target.value)}
                          ></textarea>
                      </div>

                      <div className="flex gap-3">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 font-bold text-xs uppercase tracking-widest">Cancelar</button>
                          <button 
                              onClick={handleConfirmDelete} 
                              disabled={!deleteReason.trim()}
                              className={`flex-1 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-colors ${!deleteReason.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-lg'}`}
                          >
                              Confirmar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

       {/* Edit Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">{editingId ? 'Editar Cadastro de SIM' : 'Novo Cadastro de SIM'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Número da Linha</label>
                <input required type="text" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none font-bold text-slate-800" value={formData.phoneNumber || ''} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="(00) 00000-0000"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Operadora</label>
                    <select className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-white font-medium" value={formData.operator} onChange={e => setFormData({...formData, operator: e.target.value})}>
                        <option value="">Selecione...</option>
                        <option value="Vivo">Vivo</option>
                        <option value="Claro">Claro</option>
                        <option value="Tim">Tim</option>
                        <option value="Oi">Oi</option>
                        <option value="Outra">Outra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">ICCID (Serial do Chip)</label>
                    <input required type="text" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none font-mono" value={formData.iccid || ''} onChange={e => setFormData({...formData, iccid: e.target.value})} />
                  </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Detalhes do Plano de Dados</label>
                <input type="text" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none" value={formData.planDetails || ''} onChange={e => setFormData({...formData, planDetails: e.target.value})} placeholder="Ex: Corporativo 20GB + Roaming"/>
              </div>
              
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 font-bold text-xs uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-xs uppercase tracking-widest shadow-lg transform active:scale-95 transition-all">Salvar Cadastro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
// Helper
const X = ({size}: {size: number}) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

export default SimManager;

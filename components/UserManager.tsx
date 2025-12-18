
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, CheckCircle, Filter, Users, Archive, Tag, ChevronRight, Cpu, Hash, CreditCard, Fingerprint } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

const UserManager = () => {
  const { 
    users, addUser, updateUser, toggleUserActive, 
    sectors, addSector,
    devices, sims, models, brands, assetTypes, getHistory, settings 
  } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE'); 
  const [filterSectorId, setFilterSectorId] = useState(''); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'TERMS' | 'LOGS'>('DATA');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });

  // --- LOGICA DE ABERTURA VIA URL (DEEP LINKING) ---
  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      if (userId) {
          const user = users.find(u => u.id === userId);
          if (user) {
              handleOpenModal(user, true);
              navigate('/users', { replace: true });
          }
      }
  }, [location, users]);

  const adminName = currentUser?.name || 'Unknown';

  const handleOpenModal = (user?: User, viewOnly: boolean = false) => {
    setActiveTab('DATA');
    setIsViewOnly(viewOnly);
    if (user) {
      setEditingId(user.id);
      setFormData(user);
    } else {
      setEditingId(null);
      setFormData({ active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (editingId && formData.id) updateUser(formData as User, adminName);
    else addUser({ ...formData, id: Math.random().toString(36).substr(2, 9), terms: [] } as User, adminName);
    setIsModalOpen(false);
  };

  const handleToggleClick = (user: User) => {
      if (!user.active) {
          if (window.confirm(`Deseja reativar o colaborador ${user.fullName}?`)) toggleUserActive(user, adminName, 'Reativação Manual');
          return;
      }
      const assignedDevices = devices.filter(d => d.currentUserId === user.id);
      if (assignedDevices.length > 0) return alert('Devolva os ativos antes de inativar.');
      toggleUserActive(user, adminName, 'Inativação Manual');
  };

  const filteredUsers = users.filter(u => {
    const matchesStatus = viewMode === 'ACTIVE' ? u.active : !u.active;
    if (!matchesStatus) return false;
    if (filterSectorId && u.sectorId !== filterSectorId) return false;
    return u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.cpf.includes(searchTerm);
  });

  const userHistory = editingId ? getHistory(editingId) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Colaboradores</h1>
          <p className="text-gray-500 text-sm">Gestão de vínculos, termos e histórico de auditoria.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsSectorModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50"><Briefcase size={18} /> Cargos</button>
            <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"><Plus size={18} /> Novo Usuário</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input type="text" placeholder="Nome ou CPF..." className="pl-10 w-full border rounded-lg py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button onClick={() => setViewMode('ACTIVE')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>Ativos</button>
            <button onClick={() => setViewMode('INACTIVE')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'INACTIVE' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}>Inativos</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-700">
            <tr>
              <th className="px-6 py-3">Colaborador</th>
              <th className="px-6 py-3">Ativos em Posse</th>
              <th className="px-6 py-3">Cargo / Função</th>
              <th className="px-6 py-3">Contato</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const userDevices = devices.filter(d => d.currentUserId === user.id);
              const userSims = sims.filter(s => s.currentUserId === user.id);
              const cargo = sectors.find(s => s.id === user.sectorId)?.name;

              return (
                <tr key={user.id} className={`border-b hover:bg-gray-50 transition-colors ${!user.active ? 'opacity-60 bg-gray-50/50' : 'bg-white'}`}>
                  <td className="px-6 py-4">
                    <div onClick={() => handleOpenModal(user, true)} className="font-bold text-gray-900 cursor-pointer hover:text-emerald-600 hover:underline">{user.fullName}</div>
                    <div className="text-[10px] text-gray-400 font-mono font-bold tracking-tighter uppercase">CPF: {user.cpf}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div onClick={() => handleOpenModal(user, true)} className="flex items-center gap-2 cursor-pointer group">
                        {userDevices.length > 0 && (
                            <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[10px] font-black border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                <Smartphone size={10}/> {userDevices.length}
                            </span>
                        )}
                        {userSims.length > 0 && (
                            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-[10px] font-black border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                <Cpu size={10}/> {userSims.length}
                            </span>
                        )}
                        {userDevices.length === 0 && userSims.length === 0 && <span className="text-gray-300 italic text-xs">Sem Ativos</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded border shadow-inner">{cargo || 'Não Definado'}</span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="flex items-center gap-1 text-gray-600 font-medium"><Mail size={12}/> {user.email}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                        <button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Editar"><Edit2 size={16}/></button>
                        <button onClick={() => handleToggleClick(user)} className={`p-1.5 rounded transition-colors ${user.active ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`} title={user.active ? 'Desativar' : 'Reativar'}><Power size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">
                    {editingId ? (isViewOnly ? 'Visualização de Colaborador' : 'Editar Colaborador') : 'Novo Colaborador'}
                </h3>
                {isViewOnly && (
                    <button 
                        onClick={() => setIsViewOnly(false)} 
                        className="bg-emerald-600 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase hover:bg-emerald-700 flex items-center gap-1 shadow-lg transition-transform active:scale-95"
                    >
                        <Edit2 size={10}/> Editar Cadastro
                    </button>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>

            <div className="flex border-b bg-gray-50 overflow-x-auto shrink-0">
                <button onClick={() => setActiveTab('DATA')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Cadastro</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('ASSETS')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Equipamentos</button>
                        <button onClick={() => setActiveTab('TERMS')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Termos</button>
                        <button onClick={() => setActiveTab('LOGS')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Histórico ({userHistory.length})</button>
                    </>
                )}
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nome Completo</label>
                            <input disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">E-mail Corporativo</label>
                            <input disabled={isViewOnly} required type="email" className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cargo / Função</label>
                            <select disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">CPF</label>
                                <input disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm font-mono" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})}/>
                             </div>
                             <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">RG</label>
                                <input disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm font-mono" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})}/>
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">PIS</label>
                                <input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm font-mono" value={formData.pis || ''} onChange={e => setFormData({...formData, pis: e.target.value})}/>
                             </div>
                             <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cód. Interno</label>
                                <input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm bg-yellow-50 font-bold" value={formData.jobTitle || ''} onChange={e => setFormData({...formData, jobTitle: e.target.value})}/>
                             </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Endereço Completo</label>
                            <input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}/>
                        </div>
                    </form>
                )}

                {activeTab === 'ASSETS' && (
                    <div className="space-y-4">
                        <h4 className="font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><Smartphone size={18} className="text-blue-600"/> Equipamentos Vinculados</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {devices.filter(d => d.currentUserId === editingId).map(d => {
                                const m = models.find(mod => mod.id === d.modelId);
                                return (
                                    <div 
                                        key={d.id} 
                                        onClick={() => navigate(`/devices?deviceId=${d.id}`)}
                                        className="flex items-center gap-4 p-4 border rounded-2xl hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all shadow-sm group bg-white"
                                    >
                                        <div className="h-12 w-12 bg-slate-50 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform">
                                            {m?.imageUrl ? <img src={m.imageUrl} className="h-full w-full object-cover" /> : <Smartphone className="text-gray-300"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-800 truncate text-sm">{m?.name || 'Dispositivo'}</p>
                                            <p className="text-[10px] font-black text-gray-400 uppercase font-mono">TAG: {d.assetTag}</p>
                                        </div>
                                        <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all"/>
                                    </div>
                                );
                            })}
                        </div>
                        {devices.filter(d => d.currentUserId === editingId).length === 0 && (
                            <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3"><Smartphone size={24} className="text-slate-300"/></div>
                                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Nenhum equipamento em posse.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'LOGS' && (
                    <div className="space-y-6">
                        <h4 className="font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><History size={18} className="text-emerald-600"/> Histórico de Auditoria</h4>
                        <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
                            {userHistory.length > 0 ? userHistory.map(log => (
                                <div key={log.id} className="relative pl-8 animate-fade-in">
                                    <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm
                                        ${log.action === ActionType.CHECKOUT ? 'bg-blue-500' :
                                          log.action === ActionType.CHECKIN ? 'bg-orange-500' :
                                          log.action === ActionType.INACTIVATE ? 'bg-red-500' : 'bg-emerald-500'}`}>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        {log.action}
                                    </div>
                                    <div className="text-xs text-slate-600 leading-relaxed max-w-2xl">{log.notes}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">Realizado por: {log.adminUser}</div>
                                </div>
                            )) : (
                                <div className="text-center py-16 text-slate-400 italic text-sm font-medium">Nenhum registro de movimentação encontrado para este colaborador.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'TERMS' && (
                    <div className="space-y-4">
                         <h4 className="font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><FileText size={18} className="text-orange-600"/> Termos de Responsabilidade</h4>
                         <div className="grid grid-cols-1 gap-2">
                            {(users.find(u => u.id === editingId)?.terms || []).map(term => (
                                <div key={term.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm hover:border-orange-300 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${term.type === 'ENTREGA' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                            <FileText size={20}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{term.assetDetails}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Termo de {term.type} • {new Date(term.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {term.fileUrl ? (
                                            <a href={term.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"><ExternalLink size={16}/></a>
                                        ) : (
                                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">PENDENTE ARQUIVO</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl bg-gray-200 font-bold text-gray-600 hover:bg-gray-300 transition-colors">Fechar Janela</button>
                {!isViewOnly && activeTab === 'DATA' && <button type="submit" form="userForm" className="px-8 py-2 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95">Salvar Dados</button>}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Setores (Simplificado conforme original) */}
      {isSectorModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="bg-slate-900 p-4 text-white flex justify-between items-center"><h3 className="font-bold">Gerenciar Cargos</h3><button onClick={() => setIsSectorModalOpen(false)}><X size={20}/></button></div>
                  <div className="p-6">
                      <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                          {sectors.map(s => <div key={s.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border"><span>{s.name}</span></div>)}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManager;

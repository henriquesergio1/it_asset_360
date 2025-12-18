
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, CheckCircle, Filter, Users, Archive, Tag, ChevronRight, Cpu, Hash, CreditCard, Fingerprint, RefreshCw, Save } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

const UserManager = () => {
  const { 
    users, addUser, updateUser, toggleUserActive, 
    sectors, addSector, deleteSector, updateSector,
    devices, sims, models, brands, assetTypes, getHistory, settings 
  } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  
  // Sector Management State
  const [newSectorName, setNewSectorName] = useState('');
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [isSavingSector, setIsSavingSector] = useState(false);

  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'TERMS' | 'LOGS'>('DATA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      if (userId) {
          const user = users.find(u => u.id === userId);
          if (user) { handleOpenModal(user, true); navigate('/users', { replace: true }); }
      }
  }, [location, users]);

  const adminName = currentUser?.name || 'Sistema';

  const handleOpenModal = (user?: User, viewOnly: boolean = false) => {
    setActiveTab('DATA');
    setIsViewOnly(viewOnly);
    if (user) { setEditingId(user.id); setFormData(user); }
    else { setEditingId(null); setFormData({ active: true }); }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    try {
        if (editingId && formData.id) await updateUser(formData as User, adminName);
        else await addUser({ ...formData, id: Math.random().toString(36).substr(2, 9), terms: [] } as User, adminName);
        setIsModalOpen(false);
    } catch (e: any) {
        alert("Erro ao salvar colaborador: " + e.message);
    }
  };

  // Sector Logic Renovada com Validação de Duplicidade
  const handleSaveSector = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = newSectorName.trim();
      if (!trimmedName) return;

      // Validação de Duplicidade Local
      const alreadyExists = sectors.some(s => s.name.toLowerCase() === trimmedName.toLowerCase() && s.id !== editingSectorId);
      if (alreadyExists) {
          alert(`O cargo "${trimmedName}" já existe!`);
          return;
      }

      setIsSavingSector(true);
      try {
          if (editingSectorId) {
              await updateSector({ id: editingSectorId, name: trimmedName }, adminName);
          } else {
              await addSector({ id: Math.random().toString(36).substr(2, 9), name: trimmedName }, adminName);
          }
          setNewSectorName('');
          setEditingSectorId(null);
      } catch (e: any) {
          alert("Erro ao salvar cargo: " + e.message);
      } finally {
          setIsSavingSector(false);
      }
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

  const handleReprint = (term: Term) => {
      const user = users.find(u => u.id === term.userId);
      if (!user) return;
      const asset = devices.find(d => term.assetDetails.includes(d.assetTag)) || sims.find(s => term.assetDetails.includes(s.phoneNumber));
      let model, brand, type, linkedSim;
      if (asset && 'modelId' in asset) {
          model = models.find(m => m.id === asset.modelId);
          brand = brands.find(b => b.id === model?.brandId);
          type = assetTypes.find(t => t.id === model?.typeId);
          if (asset.linkedSimId) linkedSim = sims.find(s => s.id === asset.linkedSimId);
      }
      generateAndPrintTerm({ user, asset: asset || ({ id: 'old', assetTag: 'HISTÓRICO', serialNumber: 'N/A' } as any), settings, model, brand, type, linkedSim, actionType: term.type, sectorName: sectors.find(s => s.id === user.sectorId)?.name, notes: `Reimpressão de termo original de ${new Date(term.date).toLocaleDateString()}` });
  };

  const filteredUsers = users.filter(u => {
    const matchesStatus = viewMode === 'ACTIVE' ? u.active : !u.active;
    if (!matchesStatus) return false;
    return u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.cpf.includes(searchTerm) || (u.sectorCode && u.sectorCode.toLowerCase().includes(searchTerm.toLowerCase()));
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
            <button onClick={() => setIsSectorModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 transition-all active:scale-95"><Briefcase size={18} className="text-blue-600" /> Cargos / Setores</button>
            <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95"><Plus size={18} /> Novo Usuário</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input type="text" placeholder="Nome, CPF ou Código de Setor..." className="pl-10 w-full border rounded-lg py-2 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
              <th className="px-6 py-3">Cargo / Setor</th>
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
                        {userDevices.length > 0 && <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[10px] font-black border border-blue-100 shadow-sm"><Smartphone size={10}/> {userDevices.length}</span>}
                        {userSims.length > 0 && <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-[10px] font-black border border-indigo-100 shadow-sm"><Cpu size={10}/> {userSims.length}</span>}
                        {userDevices.length === 0 && userSims.length === 0 && <span className="text-gray-300 italic text-xs">Sem Ativos</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded border shadow-inner w-fit">{cargo || 'Não Definado'}</span>
                        {user.sectorCode && <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tight">Cód. Setor: {user.sectorCode}</span>}
                    </div>
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
                <h3 className="text-lg font-bold text-white">{editingId ? (isViewOnly ? 'Visualização de Colaborador' : 'Editar Colaborador') : 'Novo Colaborador'}</h3>
                {isViewOnly && <button onClick={() => setIsViewOnly(false)} className="bg-emerald-600 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase hover:bg-emerald-700 flex items-center gap-1 shadow-lg transition-transform active:scale-95"><Edit2 size={10}/> Editar Cadastro</button>}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>

            <div className="flex border-b bg-gray-50 shrink-0">
                <button onClick={() => setActiveTab('DATA')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Cadastro</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('ASSETS')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Equipamentos</button>
                        <button onClick={() => setActiveTab('TERMS')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Termos</button>
                        <button onClick={() => setActiveTab('LOGS')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>Histórico ({userHistory.length})</button>
                    </>
                )}
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nome Completo</label><input disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})}/></div>
                        <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">E-mail Corporativo</label><input disabled={isViewOnly} required type="email" className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})}/></div>
                        <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cargo / Função (Setor)</label><select disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}><option value="">Selecione...</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">CPF</label><input disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm font-mono" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})}/></div>
                             <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">RG</label><input disabled={isViewOnly} required className="w-full border rounded-lg p-2.5 text-sm font-mono" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">PIS</label><input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm font-mono" value={formData.pis || ''} onChange={e => setFormData({...formData, pis: e.target.value})}/></div>
                             <div><label className="block text-[10px] font-black uppercase text-blue-600 mb-1">Código de Setor</label><input disabled={isViewOnly} className="w-full border-2 border-blue-100 rounded-lg p-2.5 text-sm bg-blue-50 font-bold" placeholder="Opcional" value={formData.sectorCode || ''} onChange={e => setFormData({...formData, sectorCode: e.target.value})}/></div>
                        </div>
                        <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Endereço Completo</label><input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}/></div>
                    </form>
                )}
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl bg-gray-200 font-bold text-gray-600 hover:bg-gray-300">Fechar</button>
                {!isViewOnly && activeTab === 'DATA' && <button type="submit" form="userForm" className="px-8 py-2 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95">Salvar Dados</button>}
            </div>
          </div>
        </div>
      )}

      {isSectorModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><Briefcase size={18} className="text-blue-400"/> Gerenciar Cargos / Setores</h3>
                      <button onClick={() => { setIsSectorModalOpen(false); setEditingSectorId(null); setNewSectorName(''); }} className="text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <form onSubmit={handleSaveSector} className="flex gap-2 mb-6">
                          <input 
                              required 
                              type="text" 
                              placeholder={editingSectorId ? "Renomear cargo..." : "Nome do novo cargo..."} 
                              className={`flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${editingSectorId ? 'border-blue-400 ring-2 ring-blue-50 bg-blue-50/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                              value={newSectorName}
                              onChange={(e) => setNewSectorName(e.target.value)}
                          />
                          <button 
                            type="submit" 
                            disabled={isSavingSector}
                            className={`${editingSectorId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white p-2.5 rounded-xl shadow-md disabled:opacity-50 transition-all active:scale-95`}
                          >
                              {isSavingSector ? <RefreshCw className="animate-spin" size={20}/> : editingSectorId ? <Save size={20}/> : <Plus size={20}/>}
                          </button>
                      </form>

                      <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                          {sectors.length > 0 ? [...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                              <div key={s.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all group ${editingSectorId === s.id ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100 hover:bg-white hover:shadow-sm'}`}>
                                  <span className={`text-sm font-bold ${editingSectorId === s.id ? 'text-blue-700' : 'text-slate-700'}`}>{s.name}</span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                          onClick={() => { setEditingSectorId(s.id); setNewSectorName(s.name); }}
                                          className="text-blue-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg"
                                          title="Editar Nome"
                                      >
                                          <Edit2 size={14}/>
                                      </button>
                                      <button 
                                          onClick={async () => { 
                                              if(window.confirm(`Excluir o cargo "${s.name}"?`)) {
                                                  try {
                                                      await deleteSector(s.id, adminName);
                                                  } catch(e: any) {
                                                      alert("Erro ao excluir: " + e.message);
                                                  }
                                              }
                                          }}
                                          className="text-red-300 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg"
                                          title="Excluir Cargo"
                                      >
                                          <Trash2 size={14}/>
                                      </button>
                                  </div>
                              </div>
                          )) : (
                              <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                  <Briefcase className="mx-auto text-slate-300 mb-2" size={32}/>
                                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Nenhum cargo cadastrado.</p>
                              </div>
                          )}
                      </div>
                  </div>
                  <div className="bg-slate-50 p-4 border-t text-center">
                      <button onClick={() => { setIsSectorModalOpen(false); setEditingSectorId(null); setNewSectorName(''); }} className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Fechar Janela</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManager;

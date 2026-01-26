
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, CheckCircle, Filter, Users, Archive, Tag, ChevronRight, Cpu, Hash, CreditCard, Fingerprint, UserCheck, UserX } from 'lucide-react';
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

  // Statistics
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.active).length;
  const inactiveUsers = users.filter(u => !u.active).length;

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
    const searchStr = `${u.fullName} ${u.cpf} ${u.internalCode || ''}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const userHistory = editingId ? getHistory(editingId) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Colaboradores</h1>
          <p className="text-gray-500 text-sm">Gestão de vínculos, termos e alocação de ativos.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsSectorModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50"><Briefcase size={18} /> Cargos / Funções</button>
            <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"><Plus size={18} /> Novo Colaborador</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm">
            <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Total Geral</span>
                <p className="text-3xl font-black text-blue-900">{totalUsers}</p>
            </div>
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm"><Users size={20}/></div>
          </div>
          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex items-center justify-between shadow-sm">
            <div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Ativos</span>
                <p className="text-3xl font-black text-emerald-800">{activeUsers}</p>
            </div>
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-emerald-500 shadow-sm"><UserCheck size={20}/></div>
          </div>
          <div className="bg-gray-100 p-5 rounded-2xl border border-gray-200 flex items-center justify-between shadow-sm">
            <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Inativos / Desligados</span>
                <p className="text-3xl font-black text-gray-700">{inactiveUsers}</p>
            </div>
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-gray-400 shadow-sm"><UserX size={20}/></div>
          </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input type="text" placeholder="Nome, CPF ou Código de Setor..." className="pl-10 w-full border rounded-lg py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex bg-gray-200 p-1 rounded-lg shadow-inner border border-gray-300">
            <button onClick={() => setViewMode('ACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase transition-all ${viewMode === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>Ativos</button>
            <button onClick={() => setViewMode('INACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase transition-all ${viewMode === 'INACTIVE' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}>Inativos</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500 tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Colaborador</th>
              <th className="px-6 py-4">Ativos em Posse</th>
              <th className="px-6 py-4">Cargo / Função</th>
              <th className="px-6 py-4">Código Setor</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const userDevices = devices.filter(d => d.currentUserId === user.id);
              const userSims = sims.filter(s => s.currentUserId === user.id);
              const cargoNome = sectors.find(s => s.id === user.sectorId)?.name;

              return (
                <tr key={user.id} className={`border-b hover:bg-gray-50 transition-colors ${!user.active ? 'opacity-60 bg-gray-50/50' : 'bg-white'}`}>
                  <td className="px-6 py-4">
                    <div onClick={() => handleOpenModal(user, true)} className="font-bold text-gray-900 cursor-pointer hover:text-emerald-600 hover:underline">{user.fullName}</div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-tighter">CPF: {user.cpf}</span>
                    </div>
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
                    <span className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded border shadow-inner inline-block">{cargoNome || 'Não Definido'}</span>
                  </td>
                  <td className="px-6 py-4">
                     {user.internalCode ? <span className="text-xs font-mono font-bold text-blue-600">{user.internalCode}</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                        <button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all" title="Editar"><Edit2 size={16}/></button>
                        <button onClick={() => handleToggleClick(user)} className={`p-2 rounded-xl transition-all ${user.active ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`} title={user.active ? 'Desativar' : 'Reativar'}><Power size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                    {editingId ? (isViewOnly ? 'Cadastro de Colaborador' : 'Editar Colaborador') : 'Novo Colaborador'}
                </h3>
                {isViewOnly && (
                    <button 
                        onClick={() => setIsViewOnly(false)} 
                        className="bg-emerald-600 text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase hover:bg-emerald-700 flex items-center gap-1 shadow-lg transition-transform active:scale-95"
                    >
                        <Edit2 size={12}/> Habilitar Edição
                    </button>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
            </div>

            <div className="flex border-b bg-gray-50 overflow-x-auto shrink-0 px-4 pt-2">
                <button onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Dados Principais</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Ativos em Posse</button>
                        <button onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Termos Assinados</button>
                        <button onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Auditoria ({userHistory.length})</button>
                    </>
                )}
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 bg-white">
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Nome Completo do Colaborador</label>
                            <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">E-mail Corporativo</label>
                            <input disabled={isViewOnly} required type="email" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="exemplo@empresa.com"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Cargo / Função (Categoria)</label>
                            <select disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-blue-50 font-bold" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                <option value="">Selecione o Cargo...</option>
                                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">CPF</label>
                                <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono bg-slate-50" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})}/>
                             </div>
                             <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">RG</label>
                                <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono bg-slate-50" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})}/>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                             <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Código de Setor</label>
                                <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm bg-blue-50 font-black text-blue-900 focus:border-blue-500 outline-none" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value})} placeholder="Ex: S-001, V-010..."/>
                             </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Endereço de Entrega / Residencial</label>
                            <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade - UF"/>
                        </div>
                    </form>
                )}

                {activeTab === 'ASSETS' && (
                    <div className="space-y-6">
                        <h4 className="font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2 text-lg"><Smartphone size={22} className="text-blue-600"/> Ativos Atribuídos</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {devices.filter(d => d.currentUserId === editingId).map(d => {
                                const m = models.find(mod => mod.id === d.modelId);
                                return (
                                    <div 
                                        key={d.id} 
                                        onClick={() => navigate(`/devices?deviceId=${d.id}`)}
                                        className="flex items-center gap-5 p-5 border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all shadow-sm group bg-white"
                                    >
                                        <div className="h-14 w-14 bg-slate-50 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                                            {m?.imageUrl ? <img src={m.imageUrl} className="h-full w-full object-cover" /> : <Smartphone className="text-gray-300"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-gray-800 truncate text-base">{m?.name || 'Dispositivo'}</p>
                                            <p className="text-[10px] font-black text-blue-400 uppercase font-mono tracking-widest mt-1">TAG: {d.assetTag}</p>
                                        </div>
                                        <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all"/>
                                    </div>
                                );
                            })}
                        </div>
                        {devices.filter(d => d.currentUserId === editingId).length === 0 && (
                            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100"><Smartphone size={32} className="text-slate-200"/></div>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Nenhum equipamento em posse deste colaborador.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'LOGS' && (
                    <div className="space-y-6">
                        <h4 className="font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2 text-lg"><History size={22} className="text-emerald-600"/> Histórico de Movimentações</h4>
                        <div className="relative border-l-4 border-slate-100 ml-4 space-y-10 py-2">
                            {userHistory.length > 0 ? userHistory.map(log => (
                                <div key={log.id} className="relative pl-10 animate-fade-in">
                                    <div className={`absolute -left-[12px] top-1 h-5 w-5 rounded-full border-4 border-white shadow-md
                                        ${log.action === ActionType.CHECKOUT ? 'bg-blue-500' :
                                          log.action === ActionType.CHECKIN ? 'bg-orange-500' :
                                          log.action === ActionType.INACTIVATE ? 'bg-red-500' : 'bg-emerald-500'}`}>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">
                                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                                    </div>
                                    <div className="font-black text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                                        {log.action}
                                    </div>
                                    <div className="text-xs text-slate-600 italic mt-2 bg-slate-50 p-3 rounded-xl border-l-4 border-slate-200 leading-relaxed max-w-2xl">{log.notes}</div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase mt-3 tracking-widest">Operador: {log.adminUser}</div>
                                </div>
                            )) : (
                                <div className="text-center py-16 text-slate-300 font-bold uppercase tracking-widest italic">Sem registros de movimentação.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'TERMS' && (
                    <div className="space-y-6">
                         <h4 className="font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2 text-lg"><FileText size={22} className="text-orange-600"/> Documentação e Termos</h4>
                         <div className="grid grid-cols-1 gap-3">
                            {(users.find(u => u.id === editingId)?.terms || []).map(term => (
                                <div key={term.id} className="flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:border-orange-300 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${term.type === 'ENTREGA' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                            <FileText size={24}/>
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm uppercase tracking-tight">{term.assetDetails}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">TERMO DE {term.type} • {new Date(term.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {term.fileUrl ? (
                                            <a href={term.fileUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm border border-emerald-100" title="Ver Arquivo"><ExternalLink size={20}/></a>
                                        ) : (
                                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border-2 border-dashed border-red-200">ARQUIVO PENDENTE</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                         </div>
                         {(users.find(u => u.id === editingId)?.terms || []).length === 0 && (
                            <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200"><FileText size={32}/></div>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Nenhum termo gerado ou assinado.</p>
                            </div>
                         )}
                    </div>
                )}
            </div>

            <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl bg-white border-2 border-slate-200 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 transition-all tracking-widest shadow-sm">Fechar Janela</button>
                {!isViewOnly && activeTab === 'DATA' && <button type="submit" form="userForm" className="px-12 py-3 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95">Salvar Cadastro</button>}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Setores (Renomeado para Cargos/Funções) */}
      {isSectorModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-slate-100">
                  <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center"><h3 className="font-black uppercase text-sm tracking-widest">Cargos e Funções</h3><button onClick={() => setIsSectorModalOpen(false)}><X size={20}/></button></div>
                  <div className="p-6">
                      <p className="text-xs text-slate-400 mb-4 font-medium italic">Estes cargos aparecem no seletor da ficha do colaborador e dispositivo.</p>
                      <div className="space-y-2 max-h-80 overflow-y-auto mb-4 pr-2">
                          {sectors.map(s => <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 text-sm"><span>{s.name}</span></div>)}
                      </div>
                      <button onClick={() => { const n = prompt('Nome do novo Cargo/Função:'); if(n) addSector({id: Math.random().toString(36).substr(2,9), name: n}, adminName); }} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-all">Adicionar Novo Cargo</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManager;


import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term, AccountType } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, SlidersHorizontal, Check, Info, Eye, EyeOff, Lock, Cpu } from 'lucide-react';

const formatCPF = (v: string): string => { v = v.replace(/\D/g, ""); if (v.length > 11) v = v.substring(0, 11); return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); };
const formatRG = (v: string): string => v.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();

const UserManager = () => {
  const { users, addUser, updateUser, toggleUserActive, sectors, devices, sims, getHistory, updateTermFile, deleteTermFile, accounts, models } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'SOFTWARE' | 'TERMS' | 'LOGS'>('DATA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // MOTIVO STATES
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [reasonActionType, setReasonActionType] = useState<'UPDATE' | 'TOGGLE'>('UPDATE');
  const [pendingTargetUser, setPendingTargetUser] = useState<User | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('user_manager_columns');
      return saved ? JSON.parse(saved) : ['sector', 'assetsCount'];
  });
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const adminName = currentUser?.name || 'Unknown';

  const handleOpenModal = (user?: User, viewOnly: boolean = false) => {
    setActiveTab('DATA');
    setIsViewOnly(viewOnly);
    if (user) { setEditingId(user.id); setFormData(user); }
    else { setEditingId(null); setFormData({ active: true, fullName: '', email: '', cpf: '', rg: '', pis: '', address: '', sectorId: '' }); }
    setIsModalOpen(true);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
        setReasonText('');
        setReasonActionType('UPDATE');
        setIsReasonModalOpen(true);
    } else {
        const cleaned = { ...formData, cpf: formatCPF(formData.cpf || ''), rg: formatRG(formData.rg || '') };
        addUser({ ...cleaned, id: Math.random().toString(36).substr(2, 9), terms: [] } as User, adminName);
        setIsModalOpen(false);
    }
  };

  const handleToggleClick = (user: User) => {
      const hasAssets = devices.some(d => d.currentUserId === user.id) || sims.some(s => s.currentUserId === user.id);
      if (user.active && hasAssets) return alert("Não é possível inativar com ativos em posse.");
      setPendingTargetUser(user);
      setReasonText('');
      setReasonActionType('TOGGLE');
      setIsReasonModalOpen(true);
  };

  const handleConfirmReason = () => {
      if (!reasonText.trim()) return alert('Informe o motivo.');
      if (reasonActionType === 'UPDATE') {
          const cleaned = { ...formData, cpf: formatCPF(formData.cpf || ''), rg: formatRG(formData.rg || '') };
          updateUser(cleaned as User, adminName, reasonText);
          setIsModalOpen(false);
      } else if (pendingTargetUser) {
          toggleUserActive(pendingTargetUser, adminName, reasonText);
      }
      setIsReasonModalOpen(false);
  };

  const filteredUsers = users.filter(u => {
    if (viewMode === 'ACTIVE' ? !u.active : u.active) return false;
    return `${u.fullName} ${u.cpf} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));

  const userAssets = devices.filter(d => d.currentUserId === editingId);
  const userSims = sims.filter(s => s.currentUserId === editingId);
  const userTerms = users.find(u => u.id === editingId)?.terms || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Colaboradores</h1>
          <p className="text-gray-500 text-sm">Gestão de vínculos e auditoria.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"><Plus size={18} /> Novo Registro</button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 text-gray-400" size={20} /><input type="text" placeholder="Pesquisar..." className="pl-10 w-full border rounded-lg py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button onClick={() => setViewMode('ACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase ${viewMode === 'ACTIVE' ? 'bg-white text-emerald-700' : 'text-gray-500'}`}>Ativos</button>
            <button onClick={() => setViewMode('INACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase ${viewMode === 'INACTIVE' ? 'bg-white text-gray-700' : 'text-gray-500'}`}>Inativos</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500 border-b">
            <tr><th className="px-6 py-4">Colaborador</th><th className="px-6 py-4">CPF</th><th className="px-6 py-4">Cargo</th><th className="px-6 py-4 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
                <tr key={user.id} onClick={() => handleOpenModal(user, true)} className={`border-b hover:bg-emerald-50/30 cursor-pointer ${!user.active ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                  <td className="px-6 py-4 font-bold text-gray-900">{user.fullName}</td>
                  <td className="px-6 py-4 font-mono text-slate-400 text-xs">{user.cpf}</td>
                  <td className="px-6 py-4 text-xs font-medium">{sectors.find(s => s.id === user.sectorId)?.name || '---'}</td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                        <button onClick={() => handleOpenModal(user, false)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all"><Edit2 size={16}/></button>
                        <button onClick={() => handleToggleClick(user)} className={`p-2 rounded-xl ${user.active ? 'text-gray-400 hover:text-red-600' : 'text-green-500'}`}><Power size={16}/></button>
                    </div>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-none">{editingId ? (isViewOnly ? 'Colaborador' : 'Edição') : 'Novo Cadastro'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex border-b bg-gray-50 overflow-x-auto shrink-0 px-4 pt-2">
                <button onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Dados</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Ativos</button>
                        <button onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Termos</button>
                        <button onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Auditoria</button>
                    </>
                )}
            </div>
            <div className="p-8 overflow-y-auto flex-1 bg-white">
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handlePreSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nome Completo</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})}/></div>
                        <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">E-mail</label><input disabled={isViewOnly} type="email" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})}/></div>
                        <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cargo</label><select disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}><option value="">Selecione...</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                        <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">CPF</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono bg-slate-50" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}/></div>
                    </form>
                )}
                {activeTab === 'ASSETS' && (
                    <div className="space-y-3">
                        {userAssets.map(dev => (
                            <div key={dev.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm"><div className="flex items-center gap-4"><div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><Smartphone size={20}/></div><div><p className="font-bold text-sm">{dev.assetTag}</p><p className="text-[10px] text-slate-400 uppercase font-black">{models.find(m => m.id === dev.modelId)?.name}</p></div></div><button onClick={() => navigate(`/devices?deviceId=${dev.id}`)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><ExternalLink size={18}/></button></div>
                        ))}
                    </div>
                )}
                {activeTab === 'LOGS' && (
                    <div className="relative border-l-4 border-slate-100 ml-4 space-y-8 py-4 animate-fade-in">
                        {getHistory(editingId || '').map(log => (
                            <div key={log.id} className="relative pl-8">
                                <div className={`absolute -left-[10px] top-1 h-4 w-4 rounded-full border-4 border-white shadow-md bg-slate-400`}></div>
                                <div className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">{new Date(log.timestamp).toLocaleString()}</div>
                                <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{log.action}</div>
                                <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg mt-1 border-l-2 border-slate-200">{log.notes || '---'}</div>
                                <div className="text-[9px] font-black text-slate-300 uppercase mt-2">Realizado por: {log.adminUser}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-white border-2 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 border-slate-200">Fechar</button>
                {!isViewOnly && activeTab === 'DATA' && <button type="submit" form="userForm" className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 transition-all">Salvar</button>}
            </div>
          </div>
        </div>
      )}

      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up border border-emerald-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className={`h-16 w-16 ${reasonActionType === 'TOGGLE' ? 'bg-orange-50 text-orange-500 border-orange-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'} rounded-full flex items-center justify-center mb-4 shadow-inner border`}><FileText size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Justificativa</h3>
                          <p className="text-xs text-slate-400 mt-2 font-medium">Informe o motivo da alteração cadastral ou de status.</p>
                      </div>
                      <textarea className="w-full border-2 border-emerald-100 focus:ring-emerald-100 rounded-2xl p-4 text-sm outline-none mb-6 transition-all shadow-inner" rows={3} placeholder="Motivo..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancelar</button>
                          <button onClick={handleConfirmReason} disabled={!reasonText.trim()} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 transition-all">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManager;

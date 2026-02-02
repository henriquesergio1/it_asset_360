
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SoftwareAccount, AccountType, DeviceStatus } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, Shield, Key, FileText, X, Eye, EyeOff, User as UserIcon, Smartphone, Briefcase, Info, Lock, Globe, AlertTriangle } from 'lucide-react';

const AccountManager = () => {
  const { accounts, addAccount, updateAccount, deleteAccount, users, devices, sectors } = useData();
  const { user: currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<AccountType | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<SoftwareAccount>>({
      type: AccountType.EMAIL,
      status: 'Ativo'
  });

  const adminName = currentUser?.name || 'Sistema';

  const togglePassword = (id: string) => {
      setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenModal = (acc?: SoftwareAccount) => {
      if (acc) {
          setEditingId(acc.id);
          setFormData(acc);
      } else {
          setEditingId(null);
          setFormData({ type: AccountType.EMAIL, status: 'Ativo' });
      }
      setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.login || !formData.name) return;

      if (editingId) {
          setReasonText('');
          setIsReasonModalOpen(true);
      } else {
          addAccount({
              ...formData,
              id: Math.random().toString(36).substr(2, 9)
          } as SoftwareAccount, adminName);
          setIsModalOpen(false);
      }
  };

  const handleConfirmUpdateReason = () => {
    if (!reasonText.trim()) {
        alert('Por favor, informe o motivo da alteração.');
        return;
    }
    updateAccount(formData as SoftwareAccount, adminName, reasonText);
    setIsReasonModalOpen(false);
    setIsModalOpen(false);
  };

  const handleDeleteClick = (id: string) => {
      setPendingDeleteId(id);
      setReasonText('');
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
      if (!reasonText.trim()) {
          alert('Por favor, informe o motivo da exclusão.');
          return;
      }
      if (pendingDeleteId) {
          deleteAccount(pendingDeleteId, adminName, reasonText);
          setIsDeleteModalOpen(false);
          setPendingDeleteId(null);
      }
  };

  const filteredAccounts = accounts.filter(acc => {
      if (activeFilter !== 'ALL' && acc.type !== activeFilter) return false;
      const search = searchTerm.toLowerCase();
      return acc.name.toLowerCase().includes(search) || 
             acc.login.toLowerCase().includes(search) ||
             (acc.licenseKey && acc.licenseKey.toLowerCase().includes(search));
  }).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Software & Contas</h1>
          <p className="text-gray-500 text-sm">Gestão centralizada de e-mails, acessos e licenças de software.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-bold">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['ALL', ...Object.values(AccountType)].map(type => (
              <button 
                key={type} 
                onClick={() => setActiveFilter(type as any)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap
                    ${activeFilter === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
              >
                  {type === 'ALL' ? 'Todos' : type}
              </button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3 text-gray-400" size={20} />
        <input 
            type="text" 
            placeholder="Pesquisar por nome, login ou chave de licença..." 
            className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Software / Conta</th>
              <th className="px-6 py-4">Login / Credencial</th>
              <th className="px-6 py-4">Senha / Chave</th>
              <th className="px-6 py-4">Vínculo Atual</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map(acc => {
                const linkedUser = users.find(u => u.id === acc.userId);
                const linkedDevice = devices.find(d => d.id === acc.deviceId);
                const linkedSector = sectors.find(s => s.id === acc.sectorId);

                return (
                    <tr key={acc.id} className="border-b hover:bg-indigo-50/20 transition-all group">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm 
                                    ${acc.type === AccountType.EMAIL ? 'bg-blue-50 text-blue-600' : 
                                      acc.type === AccountType.OFFICE ? 'bg-orange-50 text-orange-600' :
                                      acc.type === AccountType.ERP ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                                    {acc.type === AccountType.EMAIL ? <Mail size={20}/> : 
                                     acc.type === AccountType.OFFICE ? <FileText size={20}/> :
                                     acc.type === AccountType.ERP ? <Lock size={20}/> : <Shield size={20}/>}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{acc.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{acc.type}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <p className="font-medium text-slate-600 text-xs">{acc.login}</p>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-100 px-2 py-1 rounded font-mono text-xs text-slate-700 min-w-[80px]">
                                    {showPasswords[acc.id] ? (acc.password || acc.licenseKey || '---') : '••••••••'}
                                </div>
                                <button onClick={() => togglePassword(acc.id)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                    {showPasswords[acc.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                </button>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            {linkedUser ? (
                                <div className="flex items-center gap-1.5 text-blue-600">
                                    <UserIcon size={12}/>
                                    <span className="text-xs font-bold truncate max-w-[120px]">{linkedUser.fullName}</span>
                                </div>
                            ) : linkedDevice ? (
                                <div className="flex items-center gap-1.5 text-indigo-600">
                                    <Smartphone size={12}/>
                                    <span className="text-xs font-bold truncate max-w-[120px]">{linkedDevice.assetTag}</span>
                                </div>
                            ) : linkedSector ? (
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                    <Briefcase size={12}/>
                                    <span className="text-xs font-bold truncate max-w-[120px]">{linkedSector.name}</span>
                                </div>
                            ) : (
                                <span className="text-[10px] text-slate-300 font-bold uppercase italic">Sem Vínculo</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1">
                                <button onClick={() => handleOpenModal(acc)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                                <button onClick={() => handleDeleteClick(acc.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    </tr>
                );
            })}
            {filteredAccounts.length === 0 && (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum registro encontrado nesta categoria.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up border border-indigo-100">
                  <div className="bg-slate-900 px-8 py-5 flex justify-between items-center">
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? 'Editar Registro' : 'Nova Licença / Conta'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="md:col-span-2 bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                               <label className="block text-[10px] font-black uppercase text-indigo-400 mb-2 tracking-widest ml-1">O que você está cadastrando?</label>
                               <div className="flex flex-wrap gap-2">
                                   {Object.values(AccountType).map(t => (
                                       <button 
                                            key={t}
                                            type="button"
                                            onClick={() => setFormData({...formData, type: t})}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 
                                                ${formData.type === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-indigo-400 border-indigo-100 hover:bg-indigo-50'}`}
                                       >
                                           {t}
                                       </button>
                                   ))}
                               </div>
                          </div>

                          <div className="md:col-span-2">
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Nome Identificador (Ex: Pacote Office 2021)</label>
                              <input required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Dê um nome para esta conta/licença"/>
                          </div>

                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Login / E-mail / Usuário</label>
                              <input required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50" value={formData.login || ''} onChange={e => setFormData({...formData, login: e.target.value})} placeholder="seu.login@empresa.com"/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Senha / Código de Acesso</label>
                              <div className="relative">
                                <input type="text" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 font-mono" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••"/>
                                <Key className="absolute right-3 top-3 text-slate-300" size={18}/>
                              </div>
                          </div>

                          <div className="md:col-span-2">
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Chave de Licença / Serial (Se houver)</label>
                              <input className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 font-mono" value={formData.licenseKey || ''} onChange={e => setFormData({...formData, licenseKey: e.target.value})} placeholder="XXXXX-XXXXX-XXXXX-XXXXX"/>
                          </div>

                          <div className="md:col-span-2 border-t pt-6">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">Vínculo de Responsabilidade</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                      <label className="block text-[9px] font-black text-blue-400 uppercase">Atrelar ao Colaborador</label>
                                      <select className="w-full border-2 border-slate-100 rounded-xl p-2 text-xs bg-slate-50 font-bold" value={formData.userId || ''} onChange={e => setFormData({...formData, userId: e.target.value || null, deviceId: null, sectorId: null})}>
                                          <option value="">Ninguém</option>
                                          {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                      </select>
                                  </div>
                                  <div className="space-y-1">
                                      <label className="block text-[9px] font-black text-indigo-400 uppercase">Atrelar ao Dispositivo</label>
                                      <select className="w-full border-2 border-slate-100 rounded-xl p-2 text-xs bg-slate-50 font-bold" value={formData.deviceId || ''} onChange={e => setFormData({...formData, deviceId: e.target.value || null, userId: null, sectorId: null})}>
                                          <option value="">Nenhum</option>
                                          {devices.map(d => <option key={d.id} value={d.id}>{d.assetTag} - {d.serialNumber}</option>)}
                                      </select>
                                  </div>
                                  <div className="space-y-1">
                                      <label className="block text-[9px] font-black text-emerald-400 uppercase">Atrelar ao Cargo/Setor</label>
                                      <select className="w-full border-2 border-slate-100 rounded-xl p-2 text-xs bg-slate-50 font-bold" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value || null, userId: null, deviceId: null})}>
                                          <option value="">Nenhum</option>
                                          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                      </select>
                                  </div>
                              </div>
                              <p className="mt-4 text-[9px] text-slate-400 italic bg-gray-50 p-2 rounded-lg flex items-start gap-2">
                                  <Info size={14} className="shrink-0"/>
                                  Dica: Licenças de Office/ERP geralmente vinculamos ao Computador. E-mails e Contas vinculamos ao Colaborador ou Setor.
                              </p>
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6 border-t">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                          <button type="submit" className="px-10 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">Salvar Registro</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL DE JUSTIFICATIVA OBRIGATÓRIA (SALVAR EDIÇÃO) */}
      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-indigo-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-inner border border-blue-100"><Info size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight">Justificativa</h3>
                          <p className="text-xs text-slate-400 mt-2">Informe o motivo desta alteração para fins de auditoria.</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none mb-6 transition-all" rows={3} placeholder="Motivo da alteração..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200">Cancelar</button>
                          <button onClick={handleConfirmUpdateReason} disabled={!reasonText.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal de Exclusão */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-red-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-inner border border-red-100"><AlertTriangle size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight">Remover Conta/Licença?</h3>
                          <p className="text-xs text-slate-400 mt-2">Esta ação é permanente. Informe o motivo abaixo:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 focus:border-red-300 outline-none mb-6 transition-all" rows={3} placeholder="Motivo da exclusão..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200">Manter</button>
                          <button onClick={handleConfirmDelete} disabled={!reasonText.trim()} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all disabled:opacity-50">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AccountManager;

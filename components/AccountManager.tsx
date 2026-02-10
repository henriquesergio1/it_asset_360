import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SoftwareAccount, AccountType } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, Shield, X, Eye, EyeOff, User as UserIcon, Smartphone, Briefcase, Lock, Save, AlertTriangle, FileText } from 'lucide-react';

const AccountManager = () => {
  const { accounts, addAccount, updateAccount, deleteAccount, users, devices, sectors } = useData();
  const { user: currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<AccountType | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

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
          setEditReason('');
          setIsReasonModalOpen(true);
      } else {
          addAccount({
              ...formData,
              id: Math.random().toString(36).substr(2, 9)
          } as SoftwareAccount, adminName);
          setIsModalOpen(false);
      }
  };

  const confirmEdit = () => {
      if (!editReason.trim()) {
          alert('Por favor, informe o motivo da alteração.');
          return;
      }
      updateAccount({ ...formData, notes: (formData.notes || '') + ` [Alteração: ${editReason}]` } as SoftwareAccount, adminName);
      setIsReasonModalOpen(false);
      setIsModalOpen(false);
  };

  const handleDeleteClick = (id: string) => {
      setDeleteTargetId(id);
      setDeleteReason('');
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
      if (!deleteReason.trim()) {
          alert('Por favor, informe o motivo da exclusão.');
          return;
      }
      deleteAccount(deleteTargetId!, `${adminName} (Motivo: ${deleteReason})`);
      setIsDeleteModalOpen(false);
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
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Software & Contas</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Gestão centralizada de e-mails, acessos e licenças de software.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-bold">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['ALL', ...Object.values(AccountType)].map(type => (
              <button 
                key={type} 
                onClick={() => setActiveFilter(type as any)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap
                    ${activeFilter === type ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-400 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                  {type === 'ALL' ? 'Todos' : type}
              </button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3 text-gray-400 dark:text-slate-500" size={20} />
        <input 
            type="text" 
            placeholder="Pesquisar por nome, login ou chave de licença..." 
            className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-colors" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest border-b dark:border-slate-800">
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
                    <tr key={acc.id} className="border-b dark:border-slate-800 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/20 transition-all group bg-white dark:bg-slate-900">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm transition-colors 
                                    ${acc.type === AccountType.EMAIL ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 
                                      acc.type === AccountType.OFFICE ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                      acc.type === AccountType.ERP ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                    {acc.type === AccountType.EMAIL ? <Mail size={20}/> : 
                                     acc.type === AccountType.OFFICE ? <FileText size={20}/> :
                                     acc.type === AccountType.ERP ? <Lock size={20}/> : <Shield size={20}/>}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{acc.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{acc.type}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <p className="font-medium text-slate-600 dark:text-slate-400 text-xs">{acc.login}</p>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono text-xs text-slate-700 dark:text-slate-300 min-w-[80px] border dark:border-slate-700 shadow-inner">
                                    {showPasswords[acc.id] ? (acc.password || acc.licenseKey || '---') : '••••••••'}
                                </div>
                                <button onClick={() => togglePassword(acc.id)} className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                    {showPasswords[acc.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                </button>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            {linkedUser ? (
                                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                    <UserIcon size={12}/>
                                    <span className="text-xs font-bold truncate max-w-[120px]">{linkedUser.fullName}</span>
                                </div>
                            ) : linkedDevice ? (
                                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                    <Smartphone size={12}/>
                                    <span className="text-xs font-bold truncate max-w-[120px]">{linkedDevice.assetTag}</span>
                                </div>
                            ) : linkedSector ? (
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                    <Briefcase size={12}/>
                                    <span className="text-xs font-bold truncate max-w-[120px]">{linkedSector.name}</span>
                                </div>
                            ) : (
                                <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold uppercase italic">Sem Vínculo</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenModal(acc)} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-indigo-900/30 p-2 rounded-xl transition-all shadow-sm" title="Editar"><Edit2 size={16} /></button>
                                <button onClick={() => handleDeleteClick(acc.id)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-xl transition-all shadow-sm" title="Excluir"><Trash2 size={16} /></button>
                            </div>
                        </td>
                    </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-indigo-100 dark:border-indigo-900/40 transition-colors">
                  <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center border-b border-white/10">
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? 'Editar Registro' : 'Novo Software / Conta'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-8 space-y-4">
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Nome do Software / Serviço</label>
                          <input required type="text" placeholder="Ex: Office 365, Zoom, ERP..." className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-bold transition-colors" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Tipo de Conta</label>
                              <select className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as AccountType})}>
                                  {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Status</label>
                              <select className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-bold" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                  <option value="Ativo">Ativo</option>
                                  <option value="Inativo">Inativo</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Login / E-mail de Acesso</label>
                          <input required type="text" placeholder="usuario@empresa.com" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-medium transition-colors" value={formData.login || ''} onChange={e => setFormData({...formData, login: e.target.value})}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Senha (Opcional)</label>
                              <input type="text" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-mono" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Chave de Licença</label>
                              <input type="text" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-mono" value={formData.licenseKey || ''} onChange={e => setFormData({...formData, licenseKey: e.target.value})}/>
                          </div>
                      </div>

                      <div className="pt-2 border-t dark:border-slate-800">
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 ml-1 tracking-widest">Vincular a:</label>
                          <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Colaborador</label>
                                  <select className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 dark:text-slate-100" value={formData.userId || ''} onChange={e => setFormData({...formData, userId: e.target.value || null, deviceId: null, sectorId: null})}>
                                      <option value="">Nenhum</option>
                                      {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Dispositivo</label>
                                  <select className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 dark:text-slate-100" value={formData.deviceId || ''} onChange={e => setFormData({...formData, deviceId: e.target.value || null, userId: null, sectorId: null})}>
                                      <option value="">Nenhum</option>
                                      {devices.map(d => <option key={d.id} value={d.id}>{d.assetTag}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Setor</label>
                                  <select className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 dark:text-slate-100" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value || null, userId: null, deviceId: null})}>
                                      <option value="">Nenhum</option>
                                      {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                              </div>
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all tracking-widest border border-slate-200 dark:border-slate-700">Fechar</button>
                          <button type="submit" className="px-8 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-xl font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95">Salvar Registro</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: Motivo da Alteração */}
      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100 dark:border-indigo-900/40">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-4 shadow-inner border border-indigo-100 dark:border-indigo-900/40"><Save size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Confirmar Alterações?</h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Informe o motivo da alteração para auditoria:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 focus:border-indigo-300 dark:focus:border-indigo-700 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Descreva o que foi alterado..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors">Voltar</button>
                          <button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all">Salvar Alterações</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal de Exclusão */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-sm overflow-hidden border border-red-100 dark:border-red-900/40">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500 dark:text-red-400 mb-4 shadow-inner border border-red-100 dark:border-red-900/40"><AlertTriangle size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter leading-tight">Remover Registro?</h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Esta ação é permanente. Informe o motivo abaixo:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 dark:focus:ring-red-900/20 focus:border-red-300 dark:focus:border-red-700 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Motivo da exclusão..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors">Manter</button>
                          <button onClick={confirmDelete} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 dark:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 dark:hover:bg-red-600 transition-all disabled:opacity-50">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AccountManager;
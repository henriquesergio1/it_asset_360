import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SystemUser, SystemRole, AuditLog } from '../types';
import { Shield, Settings, Activity, Trash2, Plus, X, Edit2, Save, FileText, Search, Loader2, ArrowRight, UploadCloud, UserPlus } from 'lucide-react';
import DataImporter from './DataImporter';

const FIELD_LABELS: Record<string, string> = {
    sectorId: 'Setor/Cargo',
    linkedSimId: 'Chip Vinculado',
    currentUserId: 'Responsável Atual',
    userId: 'Colaborador',
    modelId: 'Modelo do Ativo',
    purchaseDate: 'Data de Compra',
    purchaseCost: 'Custo de Aquisição',
    invoiceNumber: 'Número da Nota',
    internalCode: 'Código Interno',
    pulsusId: 'ID MDM Pulsus',
    serialNumber: 'Nº Série',
    assetTag: 'Patrimônio',
    customData: 'Dados Extras',
    fullName: 'Nome Completo',
    email: 'E-mail',
    active: 'Status Ativo',
    address: 'Endereço Residencial',
    phoneNumber: 'Linha Telefônica',
    operator: 'Operadora',
    iccid: 'ICCID',
    planDetails: 'Plano',
    status: 'Estado Global',
    id: 'ID Sistema'
};

const AuditDetailModal = ({ logId, onClose }: { logId: string, onClose: () => void }) => {
    const { getLogDetail, sectors, sims, users, models } = useData();
    const [log, setLog] = useState<AuditLog | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const detail = await getLogDetail(logId);
                setLog(detail);
            } catch (e) { alert("Erro ao carregar detalhes."); onClose(); }
            finally { setLoading(false); }
        };
        load();
    }, [logId]);

    const resolveFriendlyValue = (key: string, val: any): any => {
        if (val === null || val === undefined || val === '---' || val === '') return <span className="text-slate-300 italic text-[10px]">vazio</span>;
        if (key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
            try { return new Date(val).toLocaleDateString('pt-BR'); } catch (e) { return val; }
        }
        if (key === 'purchaseCost') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        if (key === 'sectorId') return sectors.find(s => s.id === val)?.name || val;
        if (key === 'linkedSimId') return sims.find(s => s.id === val)?.phoneNumber || val;
        if (key === 'currentUserId' || key === 'userId') return users.find(u => u.id === val)?.fullName || val;
        if (key === 'modelId') return models.find(m => m.id === val)?.name || val;
        if (key === 'active') return val ? 'Ativo' : 'Inativo';
        return String(val);
    };

    if (loading) return (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center backdrop-blur-md">
            <Loader2 size={40} className="animate-spin text-indigo-600"/>
        </div>
    );

    if (!log) return null;

    let diffs: { field: string, rawKey: string, old: any, new: any }[] = [];
    try {
        const prev = log.previousData ? JSON.parse(log.previousData) : null;
        const next = log.newData ? JSON.parse(log.newData) : null;
        if (prev && next) {
            const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
            allKeys.forEach(key => {
                if (key.startsWith('_')) return;
                if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
                    diffs.push({ field: FIELD_LABELS[key] || key, rawKey: key, old: prev[key], new: next[key] });
                }
            });
        }
    } catch (e) {}

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border dark:border-slate-800">
                <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center shrink-0">
                    <div><h3 className="text-lg font-black text-white uppercase">Detalhes da Auditoria</h3><p className="text-[10px] text-slate-400 font-bold uppercase">{log.action} em {new Date(log.timestamp).toLocaleString()}</p></div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
                </div>
                <div className="p-8 overflow-y-auto bg-white dark:bg-slate-900">
                    <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700"><span className="block text-[10px] font-black text-slate-400 uppercase mb-1">Realizado por</span><span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{log.adminUser}</span></div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700"><span className="block text-[10px] font-black text-slate-400 uppercase mb-1">Item Afetado</span><span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">[{log.assetType}] {log.targetName}</span></div>
                    </div>
                    {diffs.length > 0 ? (
                        <div className="border dark:border-slate-800 rounded-2xl overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-500 border-b dark:border-slate-700">
                                    <tr><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Anterior</th><th className="px-4 py-3">Novo</th></tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-800">
                                    {diffs.map((d, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{d.field}</td>
                                            <td className="px-4 py-3 text-red-600 line-through">{resolveFriendlyValue(d.rawKey, d.old)}</td>
                                            <td className="px-4 py-3 text-emerald-700 font-bold">{resolveFriendlyValue(d.rawKey, d.new)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-400 font-bold uppercase italic">Sem mudanças detalhadas registradas.</p>
                            {log.notes && <p className="mt-4 text-xs font-medium text-slate-600 dark:text-slate-400">Nota: {log.notes}</p>}
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 px-8 py-5 border-t dark:border-slate-800 flex justify-end transition-colors">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Fechar</button>
                </div>
            </div>
        </div>
    );
};

const AdminPanel = () => {
  const { systemUsers, addSystemUser, updateSystemUser, deleteSystemUser, settings, updateSettings, logs } = useData();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'USERS' | 'SETTINGS' | 'LOGS' | 'TEMPLATE' | 'IMPORT'>('USERS');
  const [logSearch, setLogSearch] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<SystemUser> | null>(null);
  const [settingsForm, setSettingsForm] = useState(settings);
  const [termTemplate, setTermTemplate] = useState(settings.termTemplate || '');

  useEffect(() => { setSettingsForm(settings); setTermTemplate(settings.termTemplate || ''); }, [settings]);

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const adminName = currentUser?.name || 'Sistema';
    if (editingUser?.id) await updateSystemUser(editingUser as SystemUser, adminName);
    else await addSystemUser({ ...editingUser, id: Math.random().toString(36).substr(2, 9) } as SystemUser, adminName);
    setIsUserModalOpen(false);
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({ ...settingsForm, termTemplate }, currentUser?.name || 'Sistema');
    alert("Salvo com sucesso!");
  };

  const filteredLogs = logs.filter(l => `${l.adminUser} ${l.targetName} ${l.action}`.toLowerCase().includes(logSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Administração</h1><p className="text-slate-500 dark:text-slate-400 font-medium">Gestão de infraestrutura e auditoria v3.5.6</p></div>
      </div>

      <div className="flex border-b dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-2xl shadow-sm transition-colors overflow-x-auto">
        {[
          { id: 'USERS', label: 'Acesso', icon: Shield },
          { id: 'SETTINGS', label: 'Geral', icon: Settings },
          { id: 'TEMPLATE', label: 'Termos', icon: FileText },
          { id: 'IMPORT', label: 'Importação', icon: UploadCloud },
          { id: 'LOGS', label: 'Auditoria', icon: Activity },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-700'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-b-2xl border-x border-b dark:border-slate-800 shadow-sm min-h-[600px]">
        {activeTab === 'USERS' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase">Acessos Helios</h3>
                <button onClick={() => { setEditingUser({ role: SystemRole.OPERATOR }); setIsUserModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><UserPlus size={16}/> Novo Operador</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {systemUsers.map(u => (
                  <div key={u.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-700 rounded-3xl group hover:border-indigo-400 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md">{u.name.charAt(0)}</div>
                        <div><p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{u.name}</p><p className="text-[10px] text-slate-400 font-bold">{u.email}</p></div>
                    </div>
                    <div className="flex justify-between items-center mt-6">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{u.role}</span>
                        <div className="flex gap-1">
                            <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="p-2 text-indigo-500 hover:bg-white rounded-lg"><Edit2 size={16}/></button>
                            <button onClick={() => deleteSystemUser(u.id, currentUser?.name || 'Sistema')} className="p-2 text-red-400 hover:bg-white rounded-lg"><Trash2 size={16}/></button>
                        </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <form onSubmit={handleSettingsSubmit} className="max-w-2xl space-y-8 animate-fade-in">
             <div className="space-y-6">
                <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome da Empresa</label><input className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-black text-slate-800 dark:text-slate-100 outline-none" value={settingsForm.appName} onChange={e => setSettingsForm({...settingsForm, appName: e.target.value})}/></div>
                <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">CNPJ</label><input className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-black" value={settingsForm.cnpj || ''} onChange={e => setSettingsForm({...settingsForm, cnpj: e.target.value})}/></div>
                <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Logo URL (Base64)</label><input className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold" value={settingsForm.logoUrl} onChange={e => setSettingsForm({...settingsForm, logoUrl: e.target.value})}/></div>
             </div>
             <button type="submit" className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Salvar Geral</button>
          </form>
        )}

        {activeTab === 'LOGS' && (
          <div className="space-y-4">
             <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18}/>
                <input type="text" placeholder="Filtrar eventos..." className="w-full pl-12 pr-6 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl outline-none" value={logSearch} onChange={e => setLogSearch(e.target.value)}/>
             </div>
             <div className="overflow-x-auto border dark:border-slate-800 rounded-2xl shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                        <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Operador</th><th className="px-6 py-4">Ação</th><th className="px-6 py-4">Item</th><th className="px-6 py-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                        {filteredLogs.slice(0, 100).map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{log.adminUser}</td>
                                <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${log.action.includes('Exclusão') ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-700'}`}>{log.action}</span></td>
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-xs truncate max-w-[150px]">{log.targetName}</td>
                                <td className="px-6 py-4 text-right"><button onClick={() => setSelectedLogId(log.id)} className="text-[10px] font-black text-indigo-600 hover:underline">Ver Diff</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>
        )}
        
        {activeTab === 'IMPORT' && <DataImporter />}
      </div>

      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-indigo-600 p-10 text-center relative overflow-hidden"><Shield size={120} className="absolute -right-8 -top-8 text-white/10 rotate-12"/><h3 className="text-2xl font-black text-white uppercase relative z-10">{editingUser?.id ? 'Editar Acesso' : 'Novo Usuário'}</h3></div>
                <form onSubmit={handleUserSubmit} className="p-10 space-y-6">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Nome Completo</label><input required className="w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl p-4 text-sm font-bold" value={editingUser?.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})}/></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">E-mail</label><input required type="email" className="w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl p-4 text-sm font-bold" value={editingUser?.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})}/></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Senha</label><input required={!editingUser?.id} type="password" placeholder={editingUser?.id ? '••••••' : ''} className="w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl p-4 text-sm font-bold" value={editingUser?.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})}/></div>
                    <div className="flex gap-4 pt-4"><button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Cancelar</button><button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px]">Salvar</button></div>
                </form>
            </div>
        </div>
      )}

      {selectedLogId && <AuditDetailModal logId={selectedLogId} onClose={() => setSelectedLogId(null)} />}
    </div>
  );
};

export default AdminPanel;
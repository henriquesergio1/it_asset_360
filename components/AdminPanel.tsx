
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SystemUser, SystemRole, ActionType, AuditLog } from '../types';
import { Shield, Settings, Activity, Trash2, Plus, X, Edit2, Save, Database, Server, FileCode, FileText, Bold, Italic, Heading1, List, Eye, ArrowLeftRight, UploadCloud, Info, AlertTriangle, RotateCcw, ChevronRight, Search, Loader2 } from 'lucide-react';
import DataImporter from './DataImporter';
import { generateAndPrintTerm } from '../utils/termGenerator';

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

// --- SUB-COMPONENTE: AuditDetailModal (v2.12.34 - Friendly Mapping) ---
const AuditDetailModal = ({ logId, onClose }: { logId: string, onClose: () => void }) => {
    const { getLogDetail, sectors, sims, users, models, customFields } = useData();
    const [log, setLog] = useState<AuditLog | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const detail = await getLogDetail(logId);
                setLog(detail);
            } catch (e) { alert("Erro ao carregar detalhes do log."); onClose(); }
            finally { setLoading(false); }
        };
        load();
    }, [logId]);

    const resolveFriendlyValue = (key: string, val: any): any => {
        if (val === null || val === undefined || val === '---' || val === '') return <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">vazio</span>;
        
        // Formatação de data
        if (key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
            try { return new Date(val).toLocaleDateString('pt-BR'); } catch (e) { return val; }
        }

        // Formatação de dinheiro
        if (key === 'purchaseCost') {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        }

        // Resolução de IDs
        if (key === 'sectorId') return sectors.find(s => s.id === val)?.name || val;
        if (key === 'linkedSimId') return sims.find(s => s.id === val)?.phoneNumber || val;
        if (key === 'currentUserId' || key === 'userId') return users.find(u => u.id === val)?.fullName || val;
        if (key === 'modelId') return models.find(m => m.id === val)?.name || val;
        if (key === 'active') return val ? 'Ativo' : 'Inativo';

        // Resolução de Dados Customizados
        if (key === 'customData') {
            try {
                const data = typeof val === 'string' ? JSON.parse(val) : val;
                return (
                    <div className="flex flex-col gap-1">
                        {Object.entries(data).map(([fieldId, fieldVal]: [string, any]) => {
                            const fieldName = customFields.find(f => f.id === fieldId)?.name || fieldId;
                            return <div key={fieldId} className="text-[10px]"><span className="font-bold opacity-60">{fieldName}:</span> {String(fieldVal || 'vazio')}</div>;
                        })}
                    </div>
                );
            } catch (e) { return <span className="text-[10px] font-mono text-slate-400 break-all">{JSON.stringify(val)}</span>; }
        }

        if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
        if (typeof val === 'object') return <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 break-all">{JSON.stringify(val)}</span>;
        
        return String(val);
    };

    if (loading) return (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
                <Loader2 size={40} className="animate-spin text-blue-600"/>
                <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Carregando Auditoria...</p>
            </div>
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh] border dark:border-slate-800">
                <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Detalhes da Auditoria</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.action} em {new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
                </div>
                <div className="p-8 overflow-y-auto bg-white dark:bg-slate-900">
                    <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700">
                            <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">Realizado por</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{log.adminUser}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700">
                            <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">Item Afetado</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">[{log.assetType}] {log.targetName}</span>
                        </div>
                    </div>
                    {diffs.length > 0 ? (
                        <div className="border dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 border-b dark:border-slate-700">
                                    <tr><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Valor Anterior</th><th className="px-4 py-3">Novo Valor</th></tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-800">
                                    {diffs.map((d, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900">
                                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{d.field}</td>
                                            <td className="px-4 py-3 text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10 line-through decoration-red-300 dark:decoration-red-700">{resolveFriendlyValue(d.rawKey, d.old)}</td>
                                            <td className="px-4 py-3 text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10 font-bold">{resolveFriendlyValue(d.rawKey, d.new)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <Info size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2"/>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest italic">Nenhuma mudança de valor detectada nos campos principais.</p>
                            {log.notes && <p className="mt-4 text-xs font-medium text-slate-600 dark:text-slate-400">Observação: {log.notes}</p>}
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 px-8 py-5 border-t dark:border-slate-800 flex justify-end shrink-0 transition-colors">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all">Fechar</button>
                </div>
            </div>
        </div>
    );
};

const AdminPanel = () => {
  const { systemUsers, addSystemUser, updateSystemUser, deleteSystemUser, settings, updateSettings, logs, clearLogs, restoreItem } = useData();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'USERS' | 'SETTINGS' | 'LOGS' | 'TEMPLATE' | 'IMPORT'>('USERS');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<Partial<SystemUser>>({ role: SystemRole.OPERATOR });
  const [settingsForm, setSettingsForm] = useState(settings);
  const [msg, setMsg] = useState('');
  const [currentMode, setCurrentMode] = useState('mock');
  const [activeTemplateType, setActiveTemplateType] = useState<'DELIVERY' | 'RETURN'>('DELIVERY');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState('');

  const [activeField, setActiveField] = useState<'declaration' | 'clauses'>('declaration');
  const declRef = useRef<HTMLTextAreaElement>(null);
  const clausesRef = useRef<HTMLTextAreaElement>(null);

  const [termConfig, setTermConfig] = useState({
      delivery: { declaration: '', clauses: '' },
      return: { declaration: '', clauses: '' }
  });

  useEffect(() => {
    setCurrentMode(localStorage.getItem('app_mode') || 'mock');
  }, []);

  useEffect(() => {
      try {
          if (settings.termTemplate && settings.termTemplate.trim().startsWith('{')) {
              setTermConfig(JSON.parse(settings.termTemplate));
          }
      } catch (e) {}
  }, [settings]);

  const handleOpenModal = (user?: SystemUser) => {
    if (user) { setEditingId(user.id); setUserForm(user); } 
    else { setEditingId(null); setUserForm({ role: SystemRole.OPERATOR, password: '' }); }
    setIsModalOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && userForm.id) updateSystemUser(userForm as SystemUser, currentUser?.name || 'Admin');
    else addSystemUser({ ...userForm, id: Math.random().toString(36).substr(2, 9) } as SystemUser, currentUser?.name || 'Admin');
    setIsModalOpen(false);
  };

  const filteredLogs = logs.filter(l => `${l.adminUser} ${l.targetName} ${l.action} ${l.notes || ''}`.toLowerCase().includes(logSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Administração do Sistema</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Gerencie acessos, configurações e auditoria estruturada.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900 px-2 pt-2 rounded-t-xl shadow-sm transition-colors">
        <button onClick={() => setActiveTab('USERS')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'USERS' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}><Shield size={16} /> Acesso</button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'SETTINGS' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}><Settings size={16} /> Geral</button>
        <button onClick={() => setActiveTab('IMPORT')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'IMPORT' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}><UploadCloud size={16} /> Importação</button>
        <button onClick={() => setActiveTab('TEMPLATE')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'TEMPLATE' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}><FileText size={16} /> Editor de Termos</button>
        <button onClick={() => setActiveTab('LOGS')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'LOGS' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}><Activity size={16} /> Auditoria</button>
      </div>

      {activeTab === 'LOGS' && (
          <div className="space-y-4 animate-fade-in">
             <div className="flex flex-col md:flex-row gap-4 mb-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-600" size={18}/>
                    <input type="text" placeholder="Filtrar por Admin, Item, Ação..." className="w-full pl-12 pr-6 py-3.5 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-medium text-sm transition-colors" value={logSearch} onChange={e => setLogSearch(e.target.value)}/>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 rounded-2xl px-6 py-3 flex items-center gap-3"><Activity size={20} className="text-blue-600"/><div className="text-[10px] font-black uppercase text-blue-400">Auditoria: {filteredLogs.length} eventos</div></div>
             </div>
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase bg-gray-50 dark:bg-slate-800 border-b tracking-widest">
                            <tr><th className="px-6 py-4">Data/Hora</th><th className="px-6 py-4">Operador</th><th className="px-6 py-4">Ação</th><th className="px-6 py-4">Item Afetado</th><th className="px-6 py-4 text-right">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {filteredLogs.slice(0, 100).map(log => (
                                <tr key={log.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/20 transition-colors bg-white dark:bg-slate-900">
                                    <td className="px-6 py-4 whitespace-nowrap text-[11px] font-mono font-bold text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{log.adminUser}</td>
                                    <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">{log.action}</span></td>
                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-xs truncate max-w-[150px]">{log.targetName || log.assetId}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setSelectedLogId(log.id)} className="text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 border border-blue-100 text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Detalhes</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
      )}

      {selectedLogId && <AuditDetailModal logId={selectedLogId} onClose={() => setSelectedLogId(null)} />}
      {activeTab === 'USERS' && <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800">Controle de acesso em manutenção...</div>}
      {activeTab === 'IMPORT' && <DataImporter />}
      {activeTab === 'SETTINGS' && <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800">Configurações gerais em manutenção...</div>}
      {activeTab === 'TEMPLATE' && <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800">Editor de termos em manutenção...</div>}
    </div>
  );
};

export default AdminPanel;

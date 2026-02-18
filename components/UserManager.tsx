import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term, AccountType, AuditLog } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, CheckCircle, Filter, Users, Archive, Tag, ChevronRight, Cpu, Hash, CreditCard, Fingerprint, UserCheck, UserX, FileWarning, SlidersHorizontal, Check, Info, Save, Globe, Lock, Eye, EyeOff, Key, ChevronLeft, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

const formatCPF = (v: string): string => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
            .replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
            .replace(/(\d{3})(\d{3})/, "$1.$2")
            .replace(/-$/, "");
};

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

const LogNoteRenderer = ({ log }: { log: AuditLog }) => {
    const { sims, devices, users, sectors, models, customFields } = useData();
    
    const resolveValue = (key: string, val: any): any => {
        if (val === null || val === undefined || val === '---' || val === '') return <span className="opacity-30 italic">vazio</span>;
        if (key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
            try { return new Date(val).toLocaleDateString('pt-BR'); } catch (e) { return val; }
        }
        if (key === 'purchaseCost') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        if (key === 'sectorId') return sectors.find(s => s.id === val)?.name || val;
        if (key === 'linkedSimId') return sims.find(s => s.id === val)?.phoneNumber || val;
        if (key === 'currentUserId' || key === 'userId') return users.find(u => u.id === val)?.fullName || val;
        if (key === 'modelId') return models.find(m => m.id === val)?.name || val;
        if (key === 'active') return val ? 'Ativo' : 'Inativo';
        if (key === 'customData') {
            try {
                const data = typeof val === 'string' ? JSON.parse(val) : val;
                return Object.entries(data).map(([fieldId, fieldVal]) => {
                    const fieldName = customFields.find(f => f.id === fieldId)?.name || fieldId;
                    return `${fieldName}: ${fieldVal || 'vazio'}`;
                }).join('; ');
            } catch (e) { return String(val); }
        }
        return String(val);
    };

    let diffs: { field: string, rawKey: string, old: any, new: any }[] = [];
    try {
        if (log.previousData && log.newData) {
            const prev = typeof log.previousData === 'string' ? JSON.parse(log.previousData) : log.previousData;
            const next = typeof log.newData === 'string' ? JSON.parse(log.newData) : log.newData;
            const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
            allKeys.forEach(key => {
                if (key.startsWith('_')) return;
                if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
                    diffs.push({ field: FIELD_LABELS[key] || key, rawKey: key, old: prev[key], new: next[key] });
                }
            });
        }
    } catch (e) {}

    if (diffs.length > 0) {
        return (
            <div className="mt-2 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                {diffs.map((d, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{d.field}</span>
                        <div className="flex items-center gap-2 text-[11px]">
                            <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30 line-through opacity-70">{resolveValue(d.rawKey, d.old)}</span>
                            <ArrowRight size={10} className="text-slate-300"/>
                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40 font-bold">{resolveValue(d.rawKey, d.new)}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const lines = (log.notes || '').split('\n');
    return (
        <div className="space-y-1.5 py-1">
            {lines.map((line, i) => {
                if (!line.trim()) return null;
                return <div key={i} className="text-slate-600 dark:text-slate-300 font-medium text-[11px] leading-relaxed">{line}</div>;
            })}
        </div>
    );
};

const ColumnResizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-emerald-400 transition-colors z-10 bg-slate-200/50 dark:bg-slate-700/50" />
);

const UserManager = () => {
  const { users, addUser, updateUser, toggleUserActive, sectors, devices, sims, models, brands, assetTypes, accounts, getHistory, settings, updateTermFile, deleteTermFile, getTermFile } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE'); 
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'LICENSES' | 'TERMS' | 'LOGS'>('DATA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });
  const flyoutRef = useRef<HTMLDivElement>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('user_manager_columns');
      return saved ? JSON.parse(saved) : ['sector', 'assetsCount'];
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem('user_manager_widths');
      return saved ? JSON.parse(saved) : {};
  });
  
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      if (userId) {
          const user = users.find(u => u.id === userId);
          if (user) handleOpenFlyout(user, true);
      }
  }, [location, users]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adminName = currentUser?.name || 'Sistema';

  const handleResize = (colId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        setColumnWidths(prev => ({ ...prev, [colId]: Math.max(startWidth + delta, 50) }));
    };
    const onMouseUp = () => {
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onMouseMove);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleOpenFlyout = (user?: User, viewOnly: boolean = false) => {
    setActiveTab('DATA');
    setIsViewOnly(viewOnly);
    if (user) { setEditingId(user.id); setFormData(user); }
    else { setEditingId(null); setFormData({ active: true, fullName: '', email: '', cpf: '', rg: '', pis: '', address: '', sectorId: '' }); }
    setIsFlyoutOpen(true);
  };

  const handleTermUpload = (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editingId) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          updateTermFile(termId, editingId, reader.result as string, adminName);
      };
      reader.readAsDataURL(file);
  };

  const handleOpenFile = async (termId: string, fileUrl?: string) => {
      if (!fileUrl && termId) {
          setLoadingFiles(prev => ({ ...prev, [termId]: true }));
          try {
              const url = await getTermFile(termId);
              if (url) openBlobFromBase64(url);
          } finally { setLoadingFiles(prev => ({ ...prev, [termId]: false })); }
          return;
      }
      if (fileUrl) openBlobFromBase64(fileUrl);
  };

  // REIMPRESSÃO v3.5.0
  const handleReprintTerm = (term: Term) => {
      if (!term.snapshotData) {
          alert("Este termo foi gerado em uma versão antiga do sistema e não possui dados de snapshot para reimpressão fiel.");
          return;
      }
      try {
          const snapshot = JSON.parse(term.snapshotData);
          const user = users.find(u => u.id === term.userId);
          if (!user) return;

          generateAndPrintTerm({
              user,
              asset: snapshot.asset,
              settings,
              model: snapshot.model,
              brand: snapshot.brand,
              type: snapshot.type,
              actionType: term.type,
              linkedSim: snapshot.linkedSim,
              sectorName: snapshot.sectorName,
              checklist: snapshot.checklist,
              notes: snapshot.notes
          });
      } catch (e) {
          alert("Erro ao reconstruir o termo a partir do snapshot.");
      }
  };

  const openBlobFromBase64 = (base64Url: string) => {
      if (!base64Url.startsWith('data:')) { window.open(base64Url, '_blank'); return; }
      const parts = base64Url.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      window.open(URL.createObjectURL(new Blob([array], { type: mime })), '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (editingId) { 
        setEditReason(''); 
        setIsReasonModalOpen(true); 
    } 
    else {
        addUser({ ...formData, id: Math.random().toString(36).substr(2, 9), cpf: formatCPF(formData.cpf || ''), terms: [] } as User, adminName);
        setIsFlyoutOpen(false);
    }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) return alert('Informe o motivo.');
    updateUser({ ...formData, cpf: formatCPF(formData.cpf || '') } as User, adminName, editReason);
    setIsReasonModalOpen(false); setIsFlyoutOpen(false);
  };

  const handleToggleActive = (user: User) => {
      const reason = prompt(`Justificativa para ${user.active ? 'Inativar' : 'Reativar'} ${user.fullName}:`);
      if (reason) toggleUserActive(user, adminName, reason);
  };

  const filteredUsers = users.filter(u => {
    if (viewMode === 'ACTIVE' ? !u.active : u.active) return false;
    if (showPendingOnly && !(u.terms || []).some(t => !t.fileUrl && !t.hasFile)) return false;
    return `${u.fullName} ${u.cpf} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));

  const getUserAssets = (userId: string) => {
      const userDevices = devices.filter(d => d.currentUserId === userId);
      const userSims = sims.filter(s => s.currentUserId === userId);
      return { userDevices, userSims };
  };

  const { userDevices, userSims } = editingId ? getUserAssets(editingId) : { userDevices: [], userSims: [] };
  const userAccounts = editingId ? accounts.filter(a => a.userId === editingId) : [];
  const currentUserTerms = editingId ? (users.find(u => u.id === editingId)?.terms || []) : [];
  const selectedSector = sectors.find(s => s.id === formData.sectorId);

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Colaboradores</h1><p className="text-slate-500 dark:text-slate-400 font-medium">Gestão de vínculos, cargos e termos de responsabilidade.</p></div>
        <div className="flex gap-2">
            <button onClick={() => handleOpenFlyout()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-indigo-600/20 font-black uppercase text-xs tracking-widest transition-all active:scale-95"><Plus size={20} strokeWidth={3} /> Adicionar</button>
        </div>
      </div>

      <div className="flex gap-4 border-b dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 px-6 pt-2 rounded-2xl transition-colors">
          {(['ACTIVE', 'INACTIVE'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all whitespace-nowrap ${viewMode === mode ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{mode === 'ACTIVE' ? 'Ativos' : 'Inativos'}</button>
          ))}
          <button onClick={() => setShowPendingOnly(!showPendingOnly)} className={`px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all whitespace-nowrap ${showPendingOnly ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-orange-400'}`}>Termos Pendentes</button>
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={22} />
        <input type="text" placeholder="Pesquisar por Nome, CPF ou E-mail..." className="pl-14 w-full border-none rounded-2xl py-4 shadow-xl shadow-slate-200/50 dark:shadow-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all text-lg font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left table-fixed min-w-[1000px]">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] border-b dark:border-slate-700">
                <tr>
                  <th className="px-8 py-5 relative" style={{ width: columnWidths['name'] || '280px' }}>Colaborador <ColumnResizer onMouseDown={(e) => handleResize('name', e.clientX, columnWidths['name'] || 280)} /></th>
                  <th className="px-6 py-5 relative" style={{ width: columnWidths['sector'] || '200px' }}>Setor / Cargo <ColumnResizer onMouseDown={(e) => handleResize('sector', e.clientX, columnWidths['sector'] || 200)} /></th>
                  <th className="px-6 py-5 relative" style={{ width: columnWidths['cpf'] || '180px' }}>CPF <ColumnResizer onMouseDown={(e) => handleResize('cpf', e.clientX, columnWidths['cpf'] || 180)} /></th>
                  <th className="px-6 py-5 relative text-center" style={{ width: columnWidths['assets'] || '150px' }}>Equipamentos <ColumnResizer onMouseDown={(e) => handleResize('assets', e.clientX, columnWidths['assets'] || 150)} /></th>
                  <th className="px-8 py-5 text-right w-[100px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {filteredUsers.map(u => {
                  const sector = sectors.find(s => s.id === u.sectorId);
                  const { userDevices, userSims } = getUserAssets(u.id);
                  const count = userDevices.length + userSims.length;
                  return (
                    <tr key={u.id} onClick={() => handleOpenFlyout(u, true)} className={`hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group bg-white dark:bg-slate-900/40 ${!u.active ? 'opacity-60' : ''}`}>
                      <td className="px-8 py-5 truncate"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 font-black shrink-0">{u.fullName.charAt(0)}</div><div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">{u.fullName}</div></div></td>
                      <td className="px-6 py-5 truncate"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border dark:border-slate-700">{sector?.name || '---'}</span></td>
                      <td className="px-6 py-5 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-bold truncate">{u.cpf}</td>
                      <td className="px-6 py-5 text-center truncate"><span className={`px-3 py-1 rounded-full text-[10px] font-black border ${count > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{count} ativos</span></td>
                      <td className="px-8 py-5 text-right"><div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}><button onClick={() => handleOpenFlyout(u, false)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18}/></button><button onClick={() => handleToggleActive(u)} className={`p-2 transition-colors ${u.active ? 'text-orange-400 hover:text-orange-600' : 'text-emerald-400 hover:text-emerald-600'}`}>{u.active ? <Power size={18}/> : <RefreshCw size={18}/>}</button></div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </div>
      </div>

      {isFlyoutOpen && (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] animate-fade-in" onClick={() => setIsFlyoutOpen(false)}></div>
            <div ref={flyoutRef} className="fixed inset-y-0 right-0 w-full md:w-[650px] bg-white dark:bg-slate-900 z-[100] shadow-[-20px_0_40px_rgba(0,0,0,0.1)] flex flex-col transform transition-all duration-500 ease-out animate-slide-in border-l dark:border-slate-800">
                <div className="bg-slate-900 dark:bg-black px-8 py-8 shrink-0 relative overflow-hidden transition-all duration-500">
                    <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><UserIcon size={240}/></div>
                    
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="h-32 w-32 rounded-3xl bg-indigo-600/20 border border-indigo-400/20 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl backdrop-blur-sm">
                            <UserIcon size={48} className="text-indigo-400 opacity-60" />
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full w-fit mb-3">
                                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                                    {editingId ? 'Colaborador Registrado' : 'Novo Perfil Helios'}
                                </span>
                            </div>
                            
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4 truncate">
                                {formData.fullName || 'Novo Colaborador'}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                {formData.cpf && (
                                    <div className="flex items-center gap-2 text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                        <Fingerprint size={12} className="text-indigo-400"/>
                                        <span className="text-[10px] font-mono font-bold tracking-widest">{formData.cpf}</span>
                                    </div>
                                )}
                                {formData.email && (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Mail size={12} className="text-indigo-400"/>
                                        <span className="text-[10px] font-bold tracking-tight lowercase">{formData.email}</span>
                                    </div>
                                )}
                                {selectedSector && (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Briefcase size={12} className="text-indigo-400"/>
                                        <span className="text-[10px] font-black uppercase tracking-tighter">{selectedSector.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlyoutOpen(false); }} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer absolute top-0 right-0 z-50"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 overflow-x-auto shrink-0 px-6 py-4 pt-2 sticky top-0 z-20">
                    {[
                        { id: 'DATA', label: 'Dados', icon: Info },
                        { id: 'ASSETS', label: 'Ativos', icon: Smartphone, count: (userDevices.length + userSims.length) },
                        { id: 'LICENSES', label: 'Licenças', icon: Lock, count: userAccounts.length },
                        { id: 'TERMS', label: 'Termos', icon: FileText, count: currentUserTerms.length },
                        { id: 'LOGS', label: 'Histórico', icon: History }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`group relative px-6 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}>
                            <tab.icon size={14}/> {tab.label}
                            {tab.count !== undefined && <span className="text-[9px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-md ml-1">{tab.count}</span>}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full shadow-[0_-4px_12px_rgba(79,70,229,0.5)]"></div>}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-white dark:bg-slate-900 transition-colors">
                    {activeTab === 'DATA' && (
                        <form id="userForm" onSubmit={handleSubmit} className="space-y-10 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2 space-y-2"><label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome Completo</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-black bg-slate-50 dark:bg-slate-950 focus:border-indigo-500 outline-none transition-all" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})}/></div>
                                <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">CPF</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-mono bg-slate-50 dark:bg-slate-950" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00"/></div>
                                <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">RG</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-mono bg-slate-50 dark:bg-slate-950" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})} /></div>
                                <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">E-mail Corporativo</label><input disabled={isViewOnly} required type="email" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm bg-slate-50 dark:bg-slate-950" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})}/></div>
                                <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Cargo / Setor</label><select disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-slate-50 dark:bg-slate-950" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}><option value="">Selecione...</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Endereço Residencial</label><textarea disabled={isViewOnly} rows={2} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-4 text-sm bg-slate-50 dark:bg-slate-950" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}/></div>
                            </div>
                        </form>
                    )}
                    {activeTab === 'ASSETS' && (<div className="space-y-6 animate-fade-in">{userDevices.map(d => (<div key={d.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between group hover:border-indigo-300 transition-all"><div className="flex items-center gap-4"><Smartphone size={24} className="text-indigo-600"/><div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Dispositivo: {d.assetTag || d.serialNumber}</div></div><button onClick={() => navigate(`/devices?deviceId=${d.id}`)} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Detalhes</button></div>))}{userSims.map(s => (<div key={s.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center gap-4 animate-fade-in"><Cpu size={24} className="text-violet-600"/><div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Chip: {s.phoneNumber} ({s.operator})</div></div>))}</div>)}
                    {activeTab === 'TERMS' && (
                        <div className="space-y-6 animate-fade-in">
                            {currentUserTerms.map(t => (
                                <div key={t.id} className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-lg transition-all">
                                    <div className="flex items-center gap-4">
                                        <FileText size={28} className="text-slate-400"/>
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-tighter">{t.assetDetails}</p>
                                            <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase">{t.type} em {new Date(t.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* NOVO: Botão de Reimpressão v3.5.0 */}
                                        {t.snapshotData && (
                                            <button onClick={() => handleReprintTerm(t)} title="Reimprimir Termo Original" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                                                <Printer size={18}/>
                                            </button>
                                        )}
                                        {(t.fileUrl || t.hasFile) ? (
                                            <button onClick={() => handleOpenFile(t.id, t.fileUrl)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                                                <ExternalLink size={18}/>
                                            </button>
                                        ) : !isViewOnly && (
                                            <label className="cursor-pointer p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors">
                                                <Upload size={18}/><input type="file" className="hidden" onChange={e => handleTermUpload(t.id, e)} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'LOGS' && (
                        <div className="relative border-l-4 border-slate-100 dark:border-slate-800 ml-4 space-y-10 py-6 animate-fade-in">
                            {getHistory(editingId || '').map(log => (
                                <div key={log.id} className="relative pl-10">
                                    <div className="absolute -left-[12px] top-1 h-5 w-5 rounded-full border-4 border-white dark:border-slate-900 shadow-md bg-indigo-600"></div>
                                    <div className="text-[10px] text-slate-400 uppercase mb-1 font-black tracking-widest">{new Date(log.timestamp).toLocaleString()}</div>
                                    <div className="font-black text-slate-900 dark:text-white text-sm tracking-tighter uppercase mb-2 flex items-center gap-2">
                                        {log.action}
                                        <span className="text-[9px] font-black text-slate-300 normal-case">• Por: {log.adminUser}</span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm transition-colors">
                                        <LogNoteRenderer log={log} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 px-10 py-8 flex justify-between items-center border-t dark:border-slate-800 shrink-0 transition-colors">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlyoutOpen(false); }} className="px-8 py-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 transition-all tracking-[0.2em] shadow-sm cursor-pointer">Fechar</button>
                    {isViewOnly ? (
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsViewOnly(false); }} className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 flex items-center gap-3 cursor-pointer"><Edit2 size={20}/> Habilitar Edição</button>
                    ) : (
                        <button type="submit" form="userForm" className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 cursor-pointer">Salvar Cadastro</button>
                    )}
                </div>
            </div>
        </>
      )}

      {isReasonModalOpen && (<div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100 dark:border-indigo-900/50"><div className="p-10"><div className="flex flex-col items-center text-center mb-8"><div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 mb-6 shadow-inner border-2 border-white dark:border-slate-800"><Save size={40} /></div><h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Salvar Alterações?</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Justificativa necessária:</p></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 text-sm focus:ring-4 focus:ring-indigo-100 outline-none mb-8 transition-all bg-slate-50 dark:bg-slate-950 dark:text-white shadow-inner" rows={3} placeholder="Descreva o motivo..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-100 dark:border-slate-700 cursor-pointer">Voltar</button><button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">Confirmar</button></div></div></div></div>)}
    </div>
  );
};

export default UserManager;
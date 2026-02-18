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

// [LogNoteRenderer and Resizer components omitted for brevity, should be kept as per v3.5.0]

const UserManager = () => {
  const { users, addUser, updateUser, toggleUserActive, sectors, devices, sims, models, brands, assetTypes, accounts, getHistory, settings, updateTermFile, deleteTermFile, getTermFile } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE'); 
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'LICENSES' | 'TERMS' | 'LOGS'>('DATA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      if (params.get('pending') === 'true') setShowPendingOnly(true);
      const uid = params.get('userId');
      if (uid) { const u = users.find(x => x.id === uid); if (u) handleOpenFlyout(u, true); }
  }, [location, users]);

  const handleOpenFlyout = (user?: User, viewOnly: boolean = false) => {
    setActiveTab('DATA');
    if (user) { setEditingId(user.id); setFormData(user); }
    else { setEditingId(null); setFormData({ active: true, fullName: '', email: '' }); }
    setIsFlyoutOpen(true);
  };

  const handleOpenFile = async (termId: string, fileUrl?: string) => {
      if (!fileUrl) {
          setLoadingFiles(prev => ({ ...prev, [termId]: true }));
          try {
              const url = await getTermFile(termId);
              if (url) openBlobFromBase64(url);
              else alert("Arquivo não encontrado.");
          } catch (e) { alert("Erro ao carregar arquivo do servidor."); }
          finally { setLoadingFiles(prev => ({ ...prev, [termId]: false })); }
          return;
      }
      openBlobFromBase64(fileUrl);
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

  // REIMPRESSÃO v3.5.1 (FALLBACK SYSTEM)
  const handleReprintTerm = (term: Term) => {
      const user = users.find(u => u.id === term.userId);
      if (!user) return;

      if (!term.snapshotData) {
          if (confirm("Este termo é antigo e não possui snapshot fiel. Deseja tentar gerar um termo baseado no estado ATUAL do equipamento e colaborador? (Pode haver divergências se acessórios foram trocados)")) {
              // Fallback logic: tenta reconstruir o que for possível
              const tagMatch = term.assetDetails.match(/TAG: ([^\]]+)/);
              const tag = tagMatch ? tagMatch[1] : null;
              const device = devices.find(d => d.assetTag === tag);
              
              if (device) {
                  const m = models.find(x => x.id === device.modelId);
                  generateAndPrintTerm({
                      user, asset: device, settings, model: m,
                      brand: brands.find(x => x.id === m?.brandId),
                      type: assetTypes.find(x => x.id === m?.typeId),
                      actionType: term.type as any,
                      sectorName: sectors.find(x => x.id === user.sectorId)?.name,
                      notes: "REIMPRESSÃO DE TERMO ANTIGO (ESTADO ATUAL)"
                  });
              } else {
                  alert("Não foi possível localizar o ativo original para este termo.");
              }
          }
          return;
      }

      try {
          const snapshot = JSON.parse(term.snapshotData);
          generateAndPrintTerm({
              user,
              asset: snapshot.asset,
              settings,
              model: snapshot.model,
              brand: snapshot.brand,
              type: snapshot.type,
              actionType: term.type as any,
              linkedSim: snapshot.linkedSim,
              sectorName: snapshot.sectorName,
              checklist: snapshot.checklist,
              notes: snapshot.notes
          });
      } catch (e) { alert("Erro ao reconstruir termo."); }
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

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Colaboradores</h1><p className="text-slate-500 dark:text-slate-400 font-medium">Gestão de vínculos e termos v3.5.1</p></div>
        <button onClick={() => handleOpenFlyout()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-indigo-600/20 font-black uppercase text-xs tracking-widest transition-all"><Plus size={20} /> Adicionar</button>
      </div>

      <div className="flex gap-4 border-b dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 px-6 pt-2 rounded-2xl transition-colors">
          {(['ACTIVE', 'INACTIVE'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all whitespace-nowrap ${viewMode === mode ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{mode === 'ACTIVE' ? 'Ativos' : 'Inativos'}</button>
          ))}
          <button onClick={() => setShowPendingOnly(!showPendingOnly)} className={`px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all whitespace-nowrap ${showPendingOnly ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-orange-400'}`}>Pendências Reais</button>
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={22} />
        <input type="text" placeholder="Pesquisar..." className="pl-14 w-full border-none rounded-2xl py-4 shadow-xl dark:shadow-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all text-lg font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left table-fixed min-w-[1000px]">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] border-b dark:border-slate-700">
                <tr>
                  <th className="px-8 py-5 w-[300px]">Colaborador</th>
                  <th className="px-6 py-5 w-[200px]">Setor / Cargo</th>
                  <th className="px-6 py-5 w-[180px]">CPF</th>
                  <th className="px-6 py-5 text-center w-[150px]">Ativos</th>
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
                      <td className="px-8 py-5 truncate"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 font-black shrink-0">{u.fullName.charAt(0)}</div><div className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">{u.fullName}</div></div></td>
                      <td className="px-6 py-5 truncate"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border dark:border-slate-700">{sector?.name || '---'}</span></td>
                      <td className="px-6 py-5 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-bold truncate">{u.cpf}</td>
                      <td className="px-6 py-5 text-center truncate"><span className={`px-3 py-1 rounded-full text-[10px] font-black border ${count > 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{count} ativos</span></td>
                      <td className="px-8 py-5 text-right"><div className="flex items-center justify-end gap-1"><button onClick={e => { e.stopPropagation(); handleOpenFlyout(u, false); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18}/></button></div></td>
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
            <div className="fixed inset-y-0 right-0 w-full md:w-[650px] bg-white dark:bg-slate-900 z-[100] shadow-2xl flex flex-col transform transition-all duration-500 ease-out animate-slide-in border-l dark:border-slate-800">
                <div className="bg-slate-900 dark:bg-black px-8 py-8 shrink-0 relative overflow-hidden">
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="h-28 w-28 rounded-3xl bg-indigo-600/20 flex items-center justify-center shrink-0 shadow-2xl">
                            <UserIcon size={48} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 flex flex-col min-w-0">
                            <h3 className="text-3xl font-black text-white tracking-tighter leading-none mb-2 truncate">{formData.fullName || 'Novo Perfil'}</h3>
                            <div className="flex gap-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                <span>{formData.cpf}</span>
                                <span>{formData.email}</span>
                            </div>
                        </div>
                        <button onClick={() => setIsFlyoutOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full transition-all"><X size={24}/></button>
                    </div>
                </div>

                <div className="flex bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 overflow-x-auto shrink-0 px-6 pt-2 sticky top-0 z-20">
                    {['DATA', 'ASSETS', 'TERMS', 'LOGS'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === tab ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-white dark:bg-slate-900 transition-colors">
                    {activeTab === 'DATA' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome Completo</label>
                                    <input className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 text-sm font-black text-slate-800 dark:text-slate-100" value={formData.fullName} />
                                </div>
                                {/* Mais campos de dados aqui conforme v3.5.0... */}
                            </div>
                        </div>
                    )}
                    {activeTab === 'TERMS' && (
                        <div className="space-y-6 animate-fade-in">
                            {currentUserTerms.length > 0 ? currentUserTerms.map(t => (
                                <div key={t.id} className="p-6 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-3xl flex items-center justify-between hover:border-indigo-400 transition-all">
                                    <div>
                                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-tighter">{t.assetDetails}</p>
                                        <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase">{t.type} em {new Date(t.date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* Botão de Reimpressão RESTAURADO v3.5.1 */}
                                        <button onClick={() => handleReprintTerm(t)} title="Reimprimir Termo Original" className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors">
                                            <Printer size={18}/>
                                        </button>
                                        {(t.fileUrl || t.hasFile) ? (
                                            <button onClick={() => handleOpenFile(t.id, t.fileUrl)} className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition-colors">
                                                {loadingFiles[t.id] ? <Loader2 className="animate-spin" size={18}/> : <ExternalLink size={18}/>}
                                            </button>
                                        ) : (
                                            <label className="cursor-pointer p-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-100 transition-colors">
                                                <Upload size={18}/><input type="file" className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            )) : <div className="text-center py-20 text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum termo registrado.</div>}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 px-10 py-8 flex justify-end border-t dark:border-slate-800 transition-colors">
                    <button onClick={() => setIsFlyoutOpen(false)} className="px-8 py-3 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-black text-[10px] uppercase text-slate-500">Fechar</button>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default UserManager;
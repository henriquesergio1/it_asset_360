
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term, AccountType, AuditLog } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, CheckCircle, Filter, Users, Archive, Tag, ChevronRight, Cpu, Hash, CreditCard, Fingerprint, UserCheck, UserX, FileWarning, SlidersHorizontal, Check, Info, Save, Globe, Lock, Eye, EyeOff, Key } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

// Funções de Máscara
const formatCPF = (v: string): string => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
            .replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
            .replace(/(\d{3})(\d{3})/, "$1.$2")
            .replace(/-$/, "");
};

const formatPIS = (v: string): string => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    return v.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, "$1.$2.$3-$4")
            .replace(/(\d{3})(\d{5})(\d{2})/, "$1.$2.$3")
            .replace(/(\d{3})(\d{5})/, "$1.$2")
            .replace(/-$/, "");
};

const formatRG = (v: string): string => {
    return v.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
};

const LogNoteRenderer = ({ log }: { log: AuditLog }) => {
    const { devices, sims } = useData();
    const navigate = useNavigate();
    const note = log.notes || '';
    
    // Se for um log de atualização com diff
    if (log.action === ActionType.UPDATE && (log.previousData || log.newData)) {
        try {
            const prev = log.previousData ? JSON.parse(log.previousData) : {};
            const next = log.newData ? JSON.parse(log.newData) : {};
            const diffs = Object.keys(next).filter(k => !k.startsWith('_') && JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
            
            if (diffs.length > 0) {
                return (
                    <div className="space-y-1">
                        <div className="font-bold text-[10px] text-blue-600 uppercase mb-1">Campos Alterados:</div>
                        <div className="flex flex-wrap gap-1">
                            {diffs.map(d => (
                                <span key={d} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-black uppercase text-slate-500 shadow-sm">{d}</span>
                            ))}
                        </div>
                        {note && <div className="mt-2 text-slate-500 font-medium">Motivo: {note}</div>}
                    </div>
                );
            }
        } catch (e) { console.error("Error parsing diff in user history", e); }
    }

    const assetPattern = new RegExp('(Recebeu|Devolveu):\\s+([^.]+)', 'i');
    const match = note.match(assetPattern);
    
    if (!match) return <span>{note}</span>;
    
    const action = match[1];
    const assetString = match[2].trim();
    
    let targetLink = null;
    const foundDevice = devices.find(d => assetString.includes(d.assetTag) || (d.imei && assetString.includes(d.imei)));
    
    if (foundDevice) {
        targetLink = (
            <span onClick={() => navigate(`/devices?deviceId=${foundDevice.id}`)} className="text-blue-600 hover:underline font-bold cursor-pointer hover:bg-blue-50 px-1 rounded">
                {assetString}
            </span>
        );
    } else {
        const foundSim = sims.find(s => assetString.includes(s.phoneNumber));
        if (foundSim) {
            targetLink = (
                <span onClick={() => navigate(`/sims`)} className="text-indigo-600 hover:underline font-bold cursor-pointer hover:bg-indigo-50 px-1 rounded">
                    {assetString}
                </span>
            );
        }
    }
    
    return (<span>{action}: {targetLink || <span className="font-bold">{assetString}</span>}</span>);
};

const COLUMN_OPTIONS = [
    { id: 'email', label: 'E-mail' },
    { id: 'cpf', label: 'CPF' },
    { id: 'rg', label: 'RG' },
    { id: 'pis', label: 'PIS' },
    { id: 'address', label: 'Endereço' },
    { id: 'sector', label: 'Setor/Função' },
    { id: 'internalCode', label: 'Cód. Setor' },
    { id: 'assetsCount', label: 'Contagem de Ativos' },
    { id: 'activeSims', label: 'Números de Chip' },
    { id: 'devicesInfo', label: 'Detalhes de Aparelho' }
];

const UserManager = () => {
  const { users, addUser, updateUser, toggleUserActive, sectors, addSector, devices, sims, models, brands, assetTypes, accounts, getHistory, settings, updateTermFile, deleteTermFile } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE'); 
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'SOFTWARE' | 'TERMS' | 'LOGS'>('DATA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('user_manager_columns');
      return saved ? JSON.parse(saved) : ['sector', 'assetsCount'];
  });
  
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      if (userId) {
          const user = users.find(u => u.id === userId);
          if (user) { handleOpenModal(user, true); navigate('/users', { replace: true }); }
      }
  }, [location, users]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      localStorage.setItem('user_manager_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const adminName = currentUser?.name || 'Unknown';

  const handleOpenModal = (user?: User, viewOnly: boolean = false) => {
    setActiveTab('DATA');
    setIsViewOnly(viewOnly);
    if (user) { setEditingId(user.id); setFormData(user); }
    else { setEditingId(null); setFormData({ active: true, fullName: '', email: '', cpf: '', rg: '', pis: '', address: '', sectorId: '' }); }
    setIsModalOpen(true);
  };

  const toggleColumn = (id: string) => {
      setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleTermUpload = (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editingId) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          const fileUrl = reader.result as string;
          updateTermFile(termId, editingId, fileUrl, adminName);
      };
      reader.readAsDataURL(file);
  };

  const handleReprintTerm = (term: Term) => {
      const user = users.find(u => u.id === term.userId);
      if (!user) return;
      let asset: any = devices.find(d => term.assetDetails.includes(d.assetTag) || (d.imei && term.assetDetails.includes(d.imei)));
      if (!asset) asset = sims.find(s => term.assetDetails.includes(s.phoneNumber));
      if (!asset) { alert("Ativo não localizado no estoque para re-impressão."); return; }

      let model, brand, type, linkedSim;
      if ('serialNumber' in asset) {
          model = models.find(m => m.id === asset.modelId);
          brand = brands.find(b => b.id === model?.brandId);
          type = assetTypes.find(t => t.id === model?.typeId);
          if (asset.linkedSimId) linkedSim = sims.find(s => s.id === asset.linkedSimId);
      }

      generateAndPrintTerm({
          user, asset, settings, model, brand, type, linkedSim,
          actionType: term.type as 'ENTREGA' | 'DEVOLUCAO',
          sectorName: sectors.find(s => s.id === user.sectorId)?.name,
          notes: 'Re-impressão solicitada via painel do colaborador.'
      });
  };

  const handleOpenFile = (fileUrl: string) => {
      if (!fileUrl) return;
      if (fileUrl.startsWith('data:')) {
          const parts = fileUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const binary = atob(parts[1]);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
          const blob = new Blob([array], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
      } else { window.open(fileUrl, '_blank'); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;

    if (editingId) {
        setEditReason('');
        setIsReasonModalOpen(true);
    } else {
        const cleanedData = {
            ...formData,
            cpf: formatCPF(formData.cpf || ''),
            rg: formatRG(formData.rg || ''),
            pis: formatPIS(formData.pis || '')
        };
        addUser({ ...cleanedData, id: Math.random().toString(36).substr(2, 9), terms: [] } as User, adminName);
        setIsModalOpen(false);
    }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) {
        alert('Por favor, informe o motivo da alteração.');
        return;
    }
    const cleanedData = {
        ...formData,
        cpf: formatCPF(formData.cpf || ''),
        rg: formatRG(formData.rg || ''),
        pis: formatPIS(formData.pis || '')
    };
    updateUser(cleanedData as User, adminName, editReason);
    setIsReasonModalOpen(false);
    setIsModalOpen(false);
  };

  const handleToggleClick = (user: User) => {
      if (!user.active) { 
          const reason = prompt(`Reativar ${user.fullName}? Justificativa:`);
          if (reason) toggleUserActive(user, adminName, reason); 
          return; 
      }
      const hasAssets = devices.some(d => d.currentUserId === user.id) || sims.some(s => s.currentUserId === user.id);
      if (hasAssets) return alert("Não é possível inativar com ativos em posse.");
      const reason = prompt(`Inativar ${user.fullName}? Justificativa:`);
      if (reason) toggleUserActive(user, adminName, reason);
  };

  const filteredUsers = users.filter(u => {
    if (viewMode === 'ACTIVE' ? !u.active : u.active) return false;
    if (showPendingOnly && !(u.terms || []).some(t => !t.fileUrl)) return false;
    return `${u.fullName} ${u.cpf} ${u.email} ${u.rg || ''} ${u.pis || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));

  const userAssets = devices.filter(d => d.currentUserId === editingId);
  const linkedSimIds = userAssets.map(d => d.linkedSimId).filter(Boolean) as string[];
  const userSims = sims.filter(s => s.currentUserId === editingId || linkedSimIds.includes(s.id));
  
  const userHistory = getHistory(editingId || '');
  const currentUserTerms = users.find(u => u.id === editingId)?.terms || [];
  
  const userAccounts = accounts.filter(a => a.userId === editingId || (a.sectorId === formData.sectorId && a.sectorId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Colaboradores</h1>
          <p className="text-gray-500 text-sm">Gestão de vínculos e termos.</p>
        </div>
        <div className="flex gap-2">
            <div className="relative" ref={columnRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 font-semibold">
                    <SlidersHorizontal size={18} /> Colunas
                </button>
                {isColumnSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-[80] overflow-hidden animate-fade-in">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500">Exibir Colunas</span>
                            <button onClick={() => setIsColumnSelectorOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                        </div>
                        <div className="p-2 space-y-1">
                            {COLUMN_OPTIONS.map(col => (
                                <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    {col.label}
                                    {visibleColumns.includes(col.id) && <Check size={14}/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"><Plus size={18} /> Novo</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input type="text" placeholder="Nome, CPF, RG, PIS ou E-mail..." className="pl-10 w-full border rounded-lg py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => setShowPendingOnly(!showPendingOnly)} className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-xs font-bold uppercase transition-all ${showPendingOnly ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white text-gray-500'}`}>
            <FileWarning size={16}/> {showPendingOnly ? 'Exibindo Pendências' : 'Filtrar Pendências'}
        </button>
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button onClick={() => setViewMode('ACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase ${viewMode === 'ACTIVE' ? 'bg-white text-emerald-700' : 'text-gray-500'}`}>Ativos</button>
            <button onClick={() => setViewMode('INACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase ${viewMode === 'INACTIVE' ? 'bg-white text-gray-700' : 'text-gray-500'}`}>Inativos</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500 border-b">
            <tr>
              <th className="px-6 py-4">Colaborador</th>
              {visibleColumns.includes('email') && <th className="px-6 py-4">E-mail</th>}
              {visibleColumns.includes('cpf') && <th className="px-6 py-4">CPF</th>}
              {visibleColumns.includes('rg') && <th className="px-6 py-4">RG</th>}
              {visibleColumns.includes('pis') && <th className="px-6 py-4">PIS</th>}
              {visibleColumns.includes('address') && <th className="px-6 py-4">Endereço</th>}
              {visibleColumns.includes('sector') && <th className="px-6 py-4">Cargo / Função</th>}
              {visibleColumns.includes('internalCode') && <th className="px-6 py-4 text-center">Setor</th>}
              {visibleColumns.includes('assetsCount') && <th className="px-6 py-4 text-center">Ativos</th>}
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const uDevices = devices.filter(d => d.currentUserId === user.id);
              const uLinkedSimIds = uDevices.map(d => d.linkedSimId).filter(Boolean) as string[];
              const uSims = sims.filter(s => s.currentUserId === user.id || uLinkedSimIds.includes(s.id));
              const hasPending = (user.terms || []).some(t => !t.fileUrl);
              return (
                <tr key={user.id} onClick={() => handleOpenModal(user, true)} className={`border-b hover:bg-emerald-50/30 cursor-pointer transition-all ${!user.active ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 group-hover:text-emerald-600">{user.fullName}</div>
                    {hasPending && <span className="inline-flex items-center gap-1 mt-1 bg-orange-100 text-orange-700 text-[8px] font-black px-1.5 py-0.5 rounded border border-orange-200">TERMO PENDENTE</span>}
                  </td>
                  {visibleColumns.includes('email') && <td className="px-6 py-4 text-xs text-slate-500">{user.email || '---'}</td>}
                  {visibleColumns.includes('cpf') && <td className="px-6 py-4 text-[10px] font-mono font-bold text-slate-400">{user.cpf}</td>}
                  {visibleColumns.includes('rg') && <td className="px-6 py-4 text-[10px] font-mono text-slate-400">{user.rg || '---'}</td>}
                  {visibleColumns.includes('pis') && <td className="px-6 py-4 text-[10px] font-mono text-slate-400">{user.pis || '---'}</td>}
                  {visibleColumns.includes('address') && <td className="px-6 py-4 text-[10px] text-slate-400 truncate max-w-[150px]">{user.address || '---'}</td>}
                  {visibleColumns.includes('sector') && (
                    <td className="px-6 py-4">
                        <span className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded truncate block max-w-[150px]">{sectors.find(s => s.id === user.sectorId)?.name || '---'}</span>
                    </td>
                  )}
                  {visibleColumns.includes('internalCode') && (
                    <td className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase">{user.internalCode || '---'}</td>
                  )}
                  {visibleColumns.includes('assetsCount') && (
                    <td className="px-6 py-4 text-center">
                        <div className="flex gap-1 justify-center">
                            {uDevices.length > 0 && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-blue-100">{uDevices.length}</span>}
                            {uSims.length > 0 && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-indigo-100">{uSims.length}</span>}
                            {(uDevices.length === 0 && uSims.length === 0) && <span className="text-slate-200 text-xs">-</span>}
                        </div>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                        <button onClick={() => handleOpenModal(user, false)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all"><Edit2 size={16}/></button>
                        <button onClick={() => handleToggleClick(user)} className={`p-2 rounded-xl ${user.active ? 'text-gray-400 hover:text-red-600' : 'text-green-500'}`}><Power size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? (isViewOnly ? 'Visualização de Colaborador' : 'Edição de Colaborador') : 'Novo Colaborador'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex border-b bg-gray-50 overflow-x-auto shrink-0">
                <button onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Dados</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Ativos ({(userAssets.length + userSims.length)})</button>
                        <button onClick={() => setActiveTab('SOFTWARE')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'SOFTWARE' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Software ({userAccounts.length})</button>
                        <button onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Termos ({currentUserTerms.length})</button>
                        <button onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400'}`}>Auditoria</button>
                    </>
                )}
            </div>
            <div className="p-8 overflow-y-auto flex-1 bg-white">
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {isViewOnly && (
                            <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                                <Info className="text-blue-600" size={20}/>
                                <p className="text-xs font-bold text-blue-800">Modo de visualização. Clique no botão azul "Habilitar Edição" abaixo para realizar alterações.</p>
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nome Completo</label>
                            <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Email Corporativo</label>
                            <input disabled={isViewOnly} type="email" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cargo</label>
                            <select disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">CPF</label>
                            <input 
                                disabled={isViewOnly} 
                                required 
                                className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono bg-slate-50" 
                                value={formData.cpf || ''} 
                                onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                                placeholder="000.000.000-00"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">RG (Alfanumérico)</label>
                            <input 
                                disabled={isViewOnly} 
                                type="text" 
                                className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono bg-slate-50" 
                                value={formData.rg || ''} 
                                onChange={e => setFormData({...formData, rg: formatRG(e.target.value)})} 
                                placeholder="Ex: MG12345678"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">PIS</label>
                            <input 
                                disabled={isViewOnly} 
                                type="text" 
                                className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono bg-slate-50" 
                                value={formData.pis || ''} 
                                onChange={e => setFormData({...formData, pis: formatPIS(e.target.value)})} 
                                placeholder="000.00000.00-0"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Código Setor Interno</label>
                            <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value})}/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Endereço Residencial Completo</label>
                            <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade - UF"/>
                        </div>
                    </form>
                )}

                {activeTab === 'ASSETS' && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Smartphone size={14}/> Dispositivos</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {userAssets.map(dev => {
                                    const model = models.find(m => m.id === dev.modelId);
                                    return (
                                        <div key={dev.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                                    <Smartphone size={20}/>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{model?.name || 'Equipamento'}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Patrimônio: {dev.assetTag} • SN: {dev.serialNumber}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => navigate(`/devices?deviceId=${dev.id}`)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"><ExternalLink size={16}/></button>
                                        </div>
                                    );
                                })}
                                {userAssets.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum dispositivo em posse.</p>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Cpu size={14}/> Chips / SIM Cards</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {userSims.map(sim => {
                                    const deviceWithThisSim = userAssets.find(d => d.linkedSimId === sim.id);
                                    return (
                                        <div key={sim.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                                                    <Cpu size={20}/>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{sim.phoneNumber}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                        {sim.operator} • ICCID: {sim.iccid}
                                                        {deviceWithThisSim && <span className="text-blue-600 ml-1 font-bold">• ATRELADO AO {deviceWithThisSim.assetTag}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => navigate(`/sims`)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"><ExternalLink size={16}/></button>
                                        </div>
                                    );
                                })}
                                {userSims.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum chip em posse.</p>}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'SOFTWARE' && (
                    <div className="space-y-4 animate-fade-in">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Globe size={14}/> Licenças e Acessos (Diretos e Departamento)</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {userAccounts.length > 0 ? userAccounts.map(acc => (
                                <div key={acc.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner 
                                            ${acc.type === AccountType.EMAIL ? 'bg-blue-50 text-blue-600' : 
                                            acc.type === AccountType.OFFICE ? 'bg-orange-50 text-orange-600' :
                                            acc.type === AccountType.ERP ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {acc.type === AccountType.EMAIL ? <Mail size={24}/> : 
                                             acc.type === AccountType.OFFICE ? <FileText size={24}/> :
                                             // Fixed: Changed ActionType.ERP to AccountType.ERP
                                             acc.type === AccountType.ERP ? <Lock size={24}/> : <Key size={24}/>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{acc.name}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                {acc.login} {acc.sectorId && <span className="text-emerald-600 ml-1">• DEPARTAMENTO</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-slate-100 px-2 py-1 rounded font-mono text-[10px] text-slate-700 min-w-[80px] text-center">
                                            {showPasswords[acc.id] ? (acc.password || acc.licenseKey || '---') : '••••••••'}
                                        </div>
                                        <button type="button" onClick={() => setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]}))} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                            {showPasswords[acc.id] ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    <Globe size={32} className="mx-auto text-slate-200 mb-2"/>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Nenhum software ou conta vinculada.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'TERMS' && (
                    <div className="space-y-4">
                        {currentUserTerms.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(term => (
                            <div key={term.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner ${term.fileUrl ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-700'}`}>
                                        <FileText size={24}/>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${term.type === 'ENTREGA' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{term.type}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">{new Date(term.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="font-bold text-slate-800 text-sm mt-1">{term.assetDetails}</p>
                                        {!term.fileUrl && <p className="text-[10px] text-orange-600 font-black uppercase mt-1 flex items-center gap-1"><AlertTriangle size={10}/> Aguardando Documento Assinado</p>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleReprintTerm(term)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all" title="Re-imprimir Termo"><Printer size={18}/></button>
                                    {term.fileUrl ? (
                                        <>
                                            <button onClick={() => handleOpenFile(term.fileUrl)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all" title="Ver Termo Assinado"><ExternalLink size={18}/></button>
                                            {!isViewOnly && <button onClick={() => { if(window.confirm('Excluir este arquivo de termo?')) deleteTermFile(term.id, editingId!, 'Exclusão manual', adminName) }} className="p-2.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>}
                                        </>
                                    ) : (
                                        <label className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-lg active:scale-95" title="Anexar Termo Assinado">
                                            <Upload size={18}/>
                                            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => handleTermUpload(term.id, e)} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        ))}
                        {currentUserTerms.length === 0 && (
                            <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <FileText size={32} className="mx-auto text-slate-200 mb-2"/>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Nenhum termo gerado para este colaborador.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'LOGS' && (
                    <div className="relative border-l-4 border-slate-100 ml-4 space-y-8 py-4">
                        {userHistory.map(log => (
                            <div key={log.id} className="relative pl-8">
                                <div className={`absolute -left-[10px] top-1 h-4 w-4 rounded-full border-4 border-white shadow-md ${log.action === ActionType.CHECKOUT ? 'bg-blue-500' : log.action === ActionType.CHECKIN ? 'bg-orange-500' : 'bg-slate-400'}`}></div>
                                <div className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">{new Date(log.timestamp).toLocaleString()}</div>
                                <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{log.action}</div>
                                <div className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-xl mt-1 border-l-4 border-slate-200 shadow-sm">
                                    <LogNoteRenderer log={log} />
                                </div>
                                <div className="text-[9px] font-black text-slate-300 uppercase mt-2 tracking-tighter">Realizado por: {log.adminUser}</div>
                            </div>
                        ))}
                        {userHistory.length === 0 && <p className="text-center text-slate-400 py-10 italic">Nenhum registro encontrado.</p>}
                    </div>
                )}
            </div>
            <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-white border-2 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100">Fechar</button>
                {isViewOnly ? (
                    <button type="button" onClick={(e) => { e.preventDefault(); setIsViewOnly(false); }} className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2">
                        <Edit2 size={16}/> Habilitar Edição
                    </button>
                ) : (
                    activeTab === 'DATA' && <button type="submit" form="userForm" className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 transition-all">Salvar</button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* NOVO MODAL: Motivo da Alteração */}
      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-emerald-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-4 shadow-inner border border-emerald-100"><Save size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Confirmar Alterações?</h3>
                          <p className="text-xs text-slate-400 mt-2">Informe o motivo da alteração para auditoria:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-300 outline-none mb-6 transition-all" rows={3} placeholder="Descreva o que foi alterado..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Voltar</button>
                          <button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 disabled:opacity-50">Salvar Alterações</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManager;

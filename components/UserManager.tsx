
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term, AccountType, AuditLog } from '../types';
// Fix: Added missing RefreshCw import from lucide-react
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, CheckCircle, Filter, Users, Archive, Tag, ChevronRight, Cpu, Hash, CreditCard, Fingerprint, UserCheck, UserX, FileWarning, SlidersHorizontal, Check, Info, Save, Globe, Lock, Eye, EyeOff, Key, ChevronLeft, RefreshCw } from 'lucide-react';
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
                        <div className="font-bold text-[10px] text-blue-600 dark:text-blue-400 uppercase mb-1">Campos Alterados:</div>
                        <div className="flex flex-wrap gap-1">
                            {diffs.map(d => (
                                <span key={d} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 shadow-sm">{d}</span>
                            ))}
                        </div>
                        {note && <div className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Motivo: {note}</div>}
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
            <span onClick={() => navigate(`/devices?deviceId=${foundDevice.id}`)} className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 px-1 rounded transition-colors">
                {assetString}
            </span>
        );
    } else {
        const foundSim = sims.find(s => assetString.includes(s.phoneNumber));
        if (foundSim) {
            targetLink = (
                <span onClick={() => navigate(`/sims`)} className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-1 rounded transition-colors">
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
    { id: 'assetsCount', label: 'Ativos' },
    { id: 'activeSims', label: 'Números de Chip' },
    { id: 'devicesInfo', label: 'Detalhes de Aparelho' }
];

// Componente divisor para redimensionamento
const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div 
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-emerald-400/50 transition-colors z-10"
    />
);

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

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem('user_manager_widths');
      return saved ? JSON.parse(saved) : {};
  });
  
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(20);

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      if (userId) {
          const user = users.find(u => u.id === userId);
          if (user) { handleOpenModal(user, true); navigate('/users', { replace: true }); }
      }
  }, [location, users, navigate]);

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

  useEffect(() => {
      localStorage.setItem('user_manager_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  // Reset paginação ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode, showPendingOnly, itemsPerPage]);

  const adminName = currentUser?.name || 'Unknown';

  const handleResize = (colId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        setColumnWidths(prev => ({
            ...prev,
            [colId]: Math.max(startWidth + delta, 50)
        }));
    };
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

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
      
      let asset: any = null;

      // Suporte para o novo padrão de mapeamento robusto (v2.11.5+)
      const tagMatch = term.assetDetails.match(/\[TAG:\s*([^\]]+)\]/i);
      const chipMatch = term.assetDetails.match(/\[CHIP:\s*([^\]]+)\]/i);

      if (tagMatch) {
          const tag = tagMatch[1].trim();
          asset = devices.find(d => d.assetTag === tag);
      } else if (chipMatch) {
          const phone = chipMatch[1].trim();
          asset = sims.find(s => s.phoneNumber === phone);
      }

      // Fallback para termos antigos baseados em inclusão de string
      if (!asset) {
          asset = devices.find(d => term.assetDetails.includes(d.assetTag) || (d.imei && term.assetDetails.includes(d.imei)));
          if (!asset) asset = sims.find(s => term.assetDetails.includes(s.phoneNumber));
      }

      if (!asset) { 
          alert("Não foi possível localizar os dados para re-impressão.\n\nDetalhes: " + term.assetDetails); 
          return; 
      }

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
          notes: 'Re-impressão via painel do colaborador.'
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

  // Verificação de unicidade
  const checkUniqueness = (data: Partial<User>) => {
      const cleanedCpf = formatCPF(data.cpf || '');
      const cleanedRg = formatRG(data.rg || '');
      const cleanedPis = formatPIS(data.pis || '');

      const duplicateCpf = users.find(u => u.cpf === cleanedCpf && u.id !== editingId);
      if (duplicateCpf) return `O CPF ${cleanedCpf} já está cadastrado.`;

      if (cleanedRg) {
          const duplicateRg = users.find(u => formatRG(u.rg) === cleanedRg && u.id !== editingId);
          if (duplicateRg) return `O RG ${cleanedRg} já está cadastrado.`;
      }

      if (cleanedPis) {
          const duplicatePis = users.find(u => formatPIS(u.pis || '') === cleanedPis && u.id !== editingId);
          if (duplicatePis) return `O PIS ${cleanedPis} já está cadastrado.`;
      }

      return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;

    const uniquenessError = checkUniqueness(formData);
    if (uniquenessError) {
        alert(`ERRO:\n\n${uniquenessError}`);
        return;
    }

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

  // Cálculo de paginação
  const totalItems = filteredUsers.length;
  const currentItemsPerPage = itemsPerPage === 'ALL' ? totalItems : itemsPerPage;
  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / currentItemsPerPage);
  const startIndex = (currentPage - 1) * (itemsPerPage === 'ALL' ? 0 : itemsPerPage as number);
  const paginatedUsers = itemsPerPage === 'ALL' ? filteredUsers : filteredUsers.slice(startIndex, startIndex + (itemsPerPage as number));

  const userAssets = devices.filter(d => d.currentUserId === editingId);
  const linkedSimIds = userAssets.map(d => d.linkedSimId).filter(Boolean) as string[];
  const userSims = sims.filter(s => s.currentUserId === editingId || linkedSimIds.includes(s.id));
  
  const userHistory = getHistory(editingId || '');
  const currentUserTerms = users.find(u => u.id === editingId)?.terms || [];
  
  const userAccounts = accounts.filter(a => a.userId === editingId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Colaboradores</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Gestão de vínculos e termos.</p>
        </div>
        <div className="flex gap-2">
            <div className="relative" ref={columnRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold transition-all">
                    <SlidersHorizontal size={18} /> Colunas
                </button>
                {isColumnSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[80] overflow-hidden animate-fade-in">
                        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500">Exibir Colunas</span>
                            <button onClick={() => setIsColumnSelectorOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                        </div>
                        <div className="p-2 space-y-1">
                            {COLUMN_OPTIONS.map(col => (
                                <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    {col.label}
                                    {visibleColumns.includes(col.id) && <Check size={14}/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95"><Plus size={18} /> Novo Colaborador</button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-xl transition-colors">
          {(['ACTIVE', 'INACTIVE'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${viewMode === mode ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}>
                  {mode === 'ACTIVE' ? 'Ativos' : 'Inativos'}
                  <span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{users.filter(u => mode === 'ACTIVE' ? u.active : !u.active).length}</span>
              </button>
          ))}
          <button onClick={() => setShowPendingOnly(!showPendingOnly)} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${showPendingOnly ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-orange-400'}`}>
              Termos Pendentes
              <span className="ml-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full text-[10px]">{users.filter(u => (u.terms || []).some(t => !t.fileUrl)).length}</span>
          </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3 text-gray-400" size={20} />
        <input type="text" placeholder="Pesquisar por Nome, CPF, E-mail, RG ou PIS..." className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 transition-colors" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[1000px] table-fixed">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest">
                <tr>
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['name'] || '250px' }}>
                    Nome Completo
                    <Resizer onMouseDown={(e) => handleResize('name', e.clientX, columnWidths['name'] || 250)} />
                  </th>
                  {visibleColumns.includes('email') && (
                    <th className="px-6 py-4 relative" style={{ width: columnWidths['email'] || '200px' }}>
                        E-mail
                        <Resizer onMouseDown={(e) => handleResize('email', e.clientX, columnWidths['email'] || 200)} />
                    </th>
                  )}
                  {visibleColumns.includes('cpf') && (
                    <th className="px-6 py-4 relative" style={{ width: columnWidths['cpf'] || '140px' }}>
                        CPF
                        <Resizer onMouseDown={(e) => handleResize('cpf', e.clientX, columnWidths['cpf'] || 140)} />
                    </th>
                  )}
                  {visibleColumns.includes('rg') && (
                    <th className="px-6 py-4 relative" style={{ width: columnWidths['rg'] || '120px' }}>
                        RG
                        <Resizer onMouseDown={(e) => handleResize('rg', e.clientX, columnWidths['rg'] || 120)} />
                    </th>
                  )}
                  {visibleColumns.includes('sector') && (
                    <th className="px-6 py-4 relative" style={{ width: columnWidths['sector'] || '180px' }}>
                        Setor / Função
                        <Resizer onMouseDown={(e) => handleResize('sector', e.clientX, columnWidths['sector'] || 180)} />
                    </th>
                  )}
                  {visibleColumns.includes('assetsCount') && (
                    <th className="px-6 py-4 relative text-center" style={{ width: columnWidths['assetsCount'] || '100px' }}>
                        Ativos
                        <Resizer onMouseDown={(e) => handleResize('assetsCount', e.clientX, columnWidths['assetsCount'] || 100)} />
                    </th>
                  )}
                  <th className="px-6 py-4 text-right" style={{ width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(u => {
                  const sector = sectors.find(s => s.id === u.sectorId);
                  const assets = devices.filter(d => d.currentUserId === u.id).length + sims.filter(s => s.currentUserId === u.id).length;
                  const hasPending = (u.terms || []).some(t => !t.fileUrl);

                  return (
                    <tr 
                        key={u.id} 
                        onClick={() => handleOpenModal(u, true)}
                        className={`border-b dark:border-slate-800 transition-colors cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-900 ${!u.active ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-4 truncate">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border dark:border-slate-700 shrink-0">
                                <UserIcon className="text-slate-400 dark:text-slate-500" size={18}/>
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-gray-900 dark:text-slate-100 truncate text-xs">{u.fullName}</div>
                                {hasPending && <span className="text-[8px] font-black uppercase text-orange-500 animate-pulse">Pendente</span>}
                            </div>
                        </div>
                      </td>
                      {visibleColumns.includes('email') && (
                        <td className="px-6 py-4 truncate text-[11px] text-slate-500 dark:text-slate-400">{u.email}</td>
                      )}
                      {visibleColumns.includes('cpf') && (
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">{u.cpf}</td>
                      )}
                      {visibleColumns.includes('rg') && (
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">{u.rg || '---'}</td>
                      )}
                      {visibleColumns.includes('sector') && (
                        <td className="px-6 py-4 truncate">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700">{sector?.name || 'Não Informado'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('assetsCount') && (
                        <td className="px-6 py-4 text-center truncate">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${assets > 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-700'}`}>{assets}</span>
                        </td>
                      )}
                      <td className="px-6 py-4 text-right truncate">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleOpenModal(u, false)} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Editar"><Edit2 size={16}/></button>
                            <button onClick={() => handleToggleClick(u)} className={`p-1.5 rounded-lg transition-all ${u.active ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`} title={u.active ? 'Inativar' : 'Reativar'}>
                                {u.active ? <Power size={16}/> : <RefreshCw size={16}/>}
                            </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </div>
        
        {/* Paginação */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Exibir:</span>
                    <select 
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={40}>40</option>
                        <option value="ALL">Todos</option>
                    </select>
                </div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total: {totalItems} colaboradores</p>
            </div>
            
            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                    >
                        <ChevronLeft size={18}/>
                    </button>
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1.5 rounded-lg shadow-sm">{currentPage}</span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mx-1">de</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{totalPages}</span>
                    </div>
                    <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                    >
                        <ChevronRight size={18}/>
                    </button>
                </div>
            )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border dark:border-slate-800">
            <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                {editingId ? (isViewOnly ? 'Detalhes do Colaborador' : 'Editar Colaborador') : 'Novo Colaborador'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
            </div>
            <div className="flex bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 overflow-x-auto shrink-0 px-4 pt-2">
                <button type="button" onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Dados Cadastrais</button>
                <button type="button" onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Ativos em Posse</button>
                <button type="button" onClick={() => setActiveTab('SOFTWARE')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'SOFTWARE' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Acessos e Contas</button>
                <button type="button" onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Termos Gerados</button>
                <button type="button" onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Histórico</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900">
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Nome Completo</label>
                                <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">CPF</label>
                                <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100" value={formData.cpf} onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">RG (Opcional)</label>
                                <input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100" value={formData.rg} onChange={e => setFormData({...formData, rg: formatRG(e.target.value)})}/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">E-mail Corporativo</label>
                                <input disabled={isViewOnly} required type="email" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Cargo / Setor Atual</label>
                                <select disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                    <option value="">Selecione um cargo...</option>
                                    {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </form>
                )}
                {activeTab === 'ASSETS' && (
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Equipamentos e Chips</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {userAssets.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <Smartphone className="text-blue-500" size={20}/>
                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{models.find(m => m.id === d.modelId)?.name}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border">{d.assetTag}</span>
                                    </div>
                                    <button type="button" onClick={() => navigate(`/devices?deviceId=${d.id}`)} className="text-[10px] font-black uppercase text-blue-600 hover:underline">Ver Detalhes</button>
                                </div>
                            ))}
                            {userSims.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <Cpu className="text-indigo-500" size={20}/>
                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{s.phoneNumber}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border">{s.operator}</span>
                                    </div>
                                </div>
                            ))}
                            {userAssets.length === 0 && userSims.length === 0 && <p className="text-center py-10 text-slate-400 italic text-sm">Nenhum ativo vinculado no momento.</p>}
                        </div>
                    </div>
                )}
                {activeTab === 'SOFTWARE' && (
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Contas e Acessos</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {userAccounts.map(acc => (
                                <div key={acc.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <Globe className="text-indigo-500" size={20}/>
                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{acc.name}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border">{acc.login}</span>
                                    </div>
                                    <button type="button" onClick={() => navigate(`/accounts`)} className="text-[10px] font-black uppercase text-blue-600 hover:underline">Ver Tudo</button>
                                </div>
                            ))}
                            {userAccounts.length === 0 && <p className="text-center py-10 text-slate-400 italic text-sm">Nenhuma conta vinculada no momento.</p>}
                        </div>
                    </div>
                )}
                {activeTab === 'TERMS' && (
                    <div className="space-y-6">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Termos de Responsabilidade</h4>
                        <div className="grid grid-cols-1 gap-4">
                            {currentUserTerms.map(t => (
                                <div key={t.id} className="p-5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${t.type === 'ENTREGA' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>{t.type}</span>
                                            <h5 className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-sm">{t.assetDetails}</h5>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">{new Date(t.date).toLocaleDateString()}</p>
                                        </div>
                                        <button onClick={() => handleReprintTerm(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Re-imprimir Termo"><Printer size={18}/></button>
                                    </div>
                                    <div className="flex items-center gap-3 pt-4 border-t dark:border-slate-800">
                                        {t.fileUrl ? (
                                            <>
                                                <button onClick={() => handleOpenFile(t.fileUrl)} className="flex-1 bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"><CheckCircle size={14}/> Termo Assinado</button>
                                                <button onClick={() => deleteTermFile(t.id, editingId!, 'Exclusão solicitada', adminName)} className="p-2.5 text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                                            </>
                                        ) : (
                                            <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 cursor-pointer hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm">
                                                <Upload size={14}/> Anexar Assinado (PDF/Imagem)
                                                <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => handleTermUpload(t.id, e)}/>
                                            </label>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {currentUserTerms.length === 0 && <p className="text-center py-10 text-slate-400 italic text-sm">Nenhum termo gerado para este colaborador.</p>}
                        </div>
                    </div>
                )}
                {activeTab === 'LOGS' && (
                    <div className="relative border-l-4 border-slate-100 dark:border-slate-800 ml-4 space-y-8 py-4">
                        {userHistory.map(log => (
                            <div key={log.id} className="relative pl-8">
                                <div className="absolute -left-[10px] top-1 h-4 w-4 rounded-full border-4 border-white dark:border-slate-950 shadow-md bg-emerald-500"></div>
                                <div className="text-[10px] text-slate-400 font-black uppercase mb-1">{new Date(log.timestamp).toLocaleString()}</div>
                                <div className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-tight">{log.action}</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl mt-1 border-l-4 border-slate-200 dark:border-slate-700">
                                    <LogNoteRenderer log={log} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 px-8 py-5 flex justify-end gap-3 border-t dark:border-slate-800 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-100 transition-all tracking-widest shadow-sm">Fechar</button>
                {!isViewOnly && <button type="submit" form="userForm" className="px-10 py-3 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all active:scale-95">Salvar Colaborador</button>}
            </div>
          </div>
        </div>
      )}

      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-inner border border-blue-100"><Save size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Salvar Alterações?</h3>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Motivo da alteração..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Voltar</button>
                          <button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg disabled:opacity-50">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManager;

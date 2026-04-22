import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, User as UserIcon, Edit2, Trash2, 
  ChevronLeft, ChevronRight, Download, Filter, 
  FilterX, MoreHorizontal, UserPlus, Info, 
  MapPin, Phone, Mail, CreditCard, Hash, FileText, 
  ExternalLink, Power, History, Shield, Smartphone, 
  Briefcase, CheckCircle2, Clock, AlertCircle, RefreshCw, X, 
  FileSignature, ChevronDown, CheckSquare, Upload, Share2, 
  Save, Eye, FileUp, Building2, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useData } from '../contexts/DataContext';
import { User, UserSector, Device, DeviceModel, Term, SoftwareAccount, UserStatus, DeviceStatus } from '../types';
import { normalizeString } from '../utils/stringUtils';
import { DataTable, Column } from './DataTable';
import { UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER } from '../constants';

const UserManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'LICENSES' | 'TERMS' | 'LOGS'>('DATA');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'STATUS' | 'SECTOR'>('STATUS');
  const [bulkTargetValue, setBulkTargetValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('user_manager_widths');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('user_manager_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);
  const [isEditingTerm, setIsEditingTerm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [termEditData, setTermEditData] = useState<{
    status: string;
    notes: string;
    evidenceFiles: string[];
  }>({
    status: 'PENDING',
    notes: '',
    evidenceFiles: []
  });

  const [formData, setFormData] = useState<Partial<User & { gender?: string; birthDate?: string; phone?: string; personalPhone?: string; city?: string; state?: string; zipCode?: string; hireDate?: string; notes?: string; }>>({
    fullName: '',
    email: '',
    cpf: '',
    rg: '',
    pis: '',
    gender: 'Masculino',
    birthDate: '',
    phone: '',
    personalPhone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    sectorId: '',
    hireDate: '',
    status: UserStatus.ACTIVE,
    notes: '',
    active: true
  });

  const [visibleColumns] = useState<string[]>([
    'email', 'cpf', 'rg', 'sector', 'assetsCount', 'activeSims', 'devicesInfo'
  ]);

  const { 
    users, 
    sectors, 
    models, 
    devices, 
    sims, 
    accounts,
    addUser,
    updateUser: updateUserData,
    toggleUserActive,
    isReadOnly
  } = useData();

  const getUserAssetsFixed = (userId: string) => {
    const userDevices = devices.filter(d => d.currentUserId === userId || (d.additionalUserIds || []).includes(userId));
    const allUserSims = sims.filter(s => s.currentUserId === userId);
    return { userDevices, allUserSims };
  };

  const userAccounts = useMemo(() => 
    accounts.filter(acc => acc.userIds?.includes(editingId || '')),
    [accounts, editingId]
  );

  const currentUserTerms = useMemo(() => {
    const user = users.find(u => u.id === editingId);
    return user?.terms || [];
  }, [users, editingId]);

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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getUserAssetsEnrich = (userId: string) => {
    const userDevices = devices.filter(d => d.currentUserId === userId || (d.additionalUserIds || []).includes(userId));
    const allUserSims = sims.filter(s => s.currentUserId === userId);
    return { userDevices, allUserSims };
  };

  const { userDevices, allUserSims: userSims } = editingId ? getUserAssetsEnrich(editingId) : { userDevices: [] as Device[], allUserSims: [] as any[] };

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      const modeMatch = viewMode === 'ACTIVE' ? u.active && (!u.status || u.status === UserStatus.ACTIVE) :
                        viewMode === 'INACTIVE' ? !u.active :
                        viewMode === 'ON_LEAVE' ? u.active && u.status === UserStatus.ON_LEAVE : true;
      return modeMatch;
    });

    if (showPendingOnly) {
      result = result.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile));
    }

    if (searchTerm) {
      const low = searchTerm.toLowerCase();
      result = result.filter(u => {
        const sector = sectors.find(s => s.id === u.sectorId);
        return u.fullName.toLowerCase().includes(low) ||
          u.email.toLowerCase().includes(low) ||
          u.cpf.includes(searchTerm) ||
          (u.rg && u.rg.includes(searchTerm)) ||
          (u.pis && u.pis.includes(searchTerm)) ||
          (sector && sector.name.toLowerCase().includes(low));
      });
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof User] || '';
        const bVal = b[sortConfig.key as keyof User] || '';
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, viewMode, searchTerm, showPendingOnly, sortConfig]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(filteredUsers.length / Number(itemsPerPage));
  const totalItems = filteredUsers.length;
  const paginatedUsers = useMemo(() => {
    if (itemsPerPage === 'ALL') return filteredUsers;
    const start = (currentPage - 1) * Number(itemsPerPage);
    return filteredUsers.slice(start, start + Number(itemsPerPage));
  }, [filteredUsers, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, viewMode]);

  const handleOpenModal = (u: User | null = null, view: boolean = false) => {
    if (u) {
      setEditingId(u.id);
      setFormData(u);
      setIsViewOnly(view);
    } else {
      setEditingId(null);
      setFormData({
        fullName: '',
        email: '',
        cpf: '',
        rg: '',
        gender: 'Masculino',
        birthDate: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        sectorId: '',
        hireDate: new Date().toISOString().split('T')[0],
        status: UserStatus.ACTIVE,
        active: true
      });
      setIsViewOnly(false);
    }
    setActiveTab('DATA');
    setIsModalOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedUsers.map(u => u.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateUserData({ id: editingId, ...formData } as User, 'Admin');
      setIsModalOpen(false);
    } else {
      addUser({ ...formData, id: Math.random().toString(36).substr(2, 9) } as User, 'Admin');
      setIsModalOpen(false);
    }
  };

  const handleToggleClick = async (u: User) => {
    const action = u.active ? 'inativar' : 'reativar';
    if (window.confirm(`Deseja realmente ${action} o colaborador ${u.fullName}?`)) {
      toggleUserActive(u, 'Admin');
    }
  };

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && termEditData.evidenceFiles.length < 3) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTermEditData(prev => ({
          ...prev,
          evidenceFiles: [...prev.evidenceFiles, event.target?.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setTermEditData(prev => ({
      ...prev,
      evidenceFiles: prev.evidenceFiles.filter((_, i) => i !== index)
    }));
  };

  const handleSaveTermEdit = () => {
    if (editingTerm) {
      // Aqui integraria com API de atualização de termos
      setEditingTerm(null);
    }
  };

  const columns: Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>[] = [
    { key: 'fullName', label: 'Nome Completo', minWidth: '350px', sortable: true },
    ...(visibleColumns.includes('email') ? [{ key: 'email', label: 'E-mail', minWidth: '200px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('cpf') ? [{ key: 'cpf', label: 'CPF', minWidth: '140px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('rg') ? [{ key: 'rg', label: 'RG', minWidth: '120px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('sector') ? [{ key: 'sectorId', label: 'Setor / Função', minWidth: '180px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('assetsCount') ? [{ key: 'assetsCount', label: 'Ativos', minWidth: '100px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('activeSims') ? [{ key: 'activeSims', label: 'Números de Chip', minWidth: '160px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('devicesInfo') ? [{ key: 'devicesInfo', label: 'Detalhes de Aparelho', minWidth: '250px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    { key: 'actions', label: 'Ações', minWidth: '120px', sortable: false }
  ];

  const enrichedUsers = paginatedUsers.map(u => {
    const { userDevices, allUserSims } = getUserAssetsEnrich(u.id);
    return {
      ...u,
      assetsCount: userDevices.length + allUserSims.length,
      activeSims: allUserSims.map(s => s.phoneNumber).join(', ') || '---',
      devicesInfo: userDevices.map(d => {
        const m = models.find(mod => mod.id === d.modelId);
        return `${m?.name || 'Device'} (${d.assetTag || d.serialNumber})`;
      }).join(', ') || '---'
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800 transition-colors">
        <div>
          <h2 className="text-xl font-semibold text-white uppercase tracking-tight flex items-center gap-2">
            <UserIcon className="text-emerald-500" size={24} />
            Gestão de Colaboradores
          </h2>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Total de {users.length} profissionais cadastrados</p>
        </div>
          <div className="flex items-center gap-3">
            <button 
              disabled={isReadOnly}
              onClick={() => handleOpenModal()} 
              className={`bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-semibold transition-all active:scale-95 shadow-lg shadow-emerald-900/20 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Plus size={18} /> Novo Colaborador
            </button>
          </div>
      </div>

      <div className="flex gap-4 border-b border-slate-800 overflow-x-auto bg-slate-900 px-4 pt-2 rounded-t-xl transition-colors">
        {(['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${viewMode === mode ? 'border-emerald-600 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {mode === 'ACTIVE' ? 'Ativos' : mode === 'INACTIVE' ? 'Inativos' : 'Afastados'}
            <span className="ml-2 bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">
              {users.filter(u => {
                if (mode === 'ACTIVE') return u.active && (!u.status || u.status === UserStatus.ACTIVE);
                if (mode === 'INACTIVE') return !u.active;
                if (mode === 'ON_LEAVE') return u.active && u.status === UserStatus.ON_LEAVE;
                return false;
              }).length}
            </span>
          </button>
        ))}
        <button onClick={() => setShowPendingOnly(!showPendingOnly)} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${showPendingOnly ? 'border-orange-500 ' : 'border-transparent hover:text-orange-400'}`}>Termos Pendentes<span className="ml-2 bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded-full text-[11px]">{users.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile)).length}</span></button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3" size={20} />
        <input 
          type="text" 
          placeholder="Pesquisar por Nome, CPF, E-mail, RG ou PIS..." 
          className="pl-12 w-full border-none rounded-xl py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200 bg-slate-900 transition-colors" 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl flex items-center justify-between sticky top-4 z-50"
          >
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase tracking-wider">{selectedIds.length} Selecionados</span>
              <div className="h-6 w-px bg-white/20 mx-2"/>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setBulkActionType('STATUS'); setIsBulkModalOpen(true); }}
                  className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                >
                  Alterar Status
                </button>
                <button 
                  onClick={() => { setBulkActionType('SECTOR'); setIsBulkModalOpen(true); }}
                  className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                >
                  Alterar Setor
                </button>
              </div>
            </div>
            <button onClick={() => setSelectedIds([])} className="p-1 hover:bg-white/10 rounded-full transition-all">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <DataTable
          columns={columns}
          data={enrichedUsers}
          sortConfig={sortConfig}
          requestSort={handleSort}
          columnWidths={columnWidths}
          onResize={handleResize}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          renderRow={(u) => {
            const sector = sectors.find(s => s.id === u.sectorId);
            const hasPending = (u.terms || []).some(t => !t.fileUrl && !t.hasFile);

            return (
              <tr 
                key={u.id} 
                onClick={() => handleOpenModal(u, true)} 
                className={`border-b border-slate-800/50 border-l-4 border-l-transparent transition-all cursor-pointer hover:bg-slate-800/60 hover:border-l-emerald-500 bg-slate-900 ${!u.active ? 'opacity-60' : ''} ${selectedIds.includes(u.id) ? 'bg-emerald-900/20 border-l-emerald-500' : ''}`}
              >
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-800 focus:ring-emerald-500"
                    checked={selectedIds.includes(u.id)}
                    onChange={(e) => { e.stopPropagation(); handleSelectOne(u.id); }}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                      <UserIcon size={18} className="text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 text-[13px]">{u.fullName}</div>
                      <div className="flex gap-1 mt-0.5">
                        {u.status === UserStatus.ON_LEAVE && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-900/30 text-blue-400">
                            Afastado
                          </span>
                        )}
                        {hasPending && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-amber-900/30 text-amber-400">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {visibleColumns.includes('email') && <td className="px-6 py-4 truncate text-xs">{u.email}</td>}
                {visibleColumns.includes('cpf') && <td className="px-6 py-4 font-mono text-xs truncate">{u.cpf}</td>}
                {visibleColumns.includes('rg') && <td className="px-6 py-4 font-mono text-xs truncate">{u.rg || '---'}</td>}
                {visibleColumns.includes('sector') && (
                  <td className="px-6 py-4 truncate">
                    <span className="text-[11px] font-bold bg-slate-800 px-2.5 py-1 rounded-full">
                      {sector?.name || 'Não Informado'}
                    </span>
                  </td>
                )}
                {visibleColumns.includes('assetsCount') && (
                  <td className="px-6 py-4 text-center truncate">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${u.assetsCount > 0 ? ' bg-blue-900/30 text-blue-400' : ' bg-slate-800 text-slate-400'}`}>
                      {u.assetsCount}
                    </span>
                  </td>
                )}
                {visibleColumns.includes('activeSims') && <td className="px-6 py-4 truncate text-[11px] font-mono">{u.activeSims}</td>}
                {visibleColumns.includes('devicesInfo') && <td className="px-6 py-4 truncate text-[11px] font-medium">{u.devicesInfo}</td>}
                <td className="px-6 py-4 text-right truncate">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleOpenModal(u, false)} 
                      disabled={isReadOnly} 
                      className={`p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => !isReadOnly && handleToggleClick(u)} 
                      disabled={isReadOnly} 
                      className={`p-1.5 rounded-lg transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : (u.active ? ' hover:bg-orange-900/30' : ' hover:bg-emerald-900/30')}`} 
                      title={u.active ? 'Inativar' : 'Reativar'}
                    >
                      {u.active ? <Power size={16} /> : <RefreshCw size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            );
          }}
        />
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Exibir:</span>
              <select 
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={itemsPerPage} 
                onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value="ALL">Todos</option>
              </select>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider">Total: {totalItems} colaboradores</p>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : ' text-emerald-400 hover:bg-emerald-900/30'}`}><ChevronLeft size={18}/></button>
              <div className="flex items-center gap-1"><span className="text-xs font-black text-emerald-300 bg-emerald-900/40 px-3 py-1.5 rounded-lg">{currentPage}</span><span className="text-xs font-bold uppercase mx-1">de</span><span className="text-xs font-black text-slate-300">{totalPages}</span></div>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : ' text-emerald-400 hover:bg-emerald-900/30'}`}><ChevronRight size={18}/></button>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border border-slate-800 transition-colors">
            <div className="bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10">
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">{editingId ? (isViewOnly ? 'Detalhes do Colaborador' : 'Editar Colaborador') : 'Novo Colaborador'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 hover:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
            </div>

            <div className="flex bg-slate-950 border-b border-slate-800 overflow-x-auto shrink-0 px-4 pt-2">
              <button type="button" onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Dados Cadastrais</button>
              <button type="button" onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Ativos em Posse <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{(userDevices.length + userSims.length)}</span></button>
              <button type="button" onClick={() => setActiveTab('LICENSES')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'LICENSES' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Licenças e Contas <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{userAccounts.length}</span></button>
              <button type="button" onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Termos Gerados <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{currentUserTerms.length}</span></button>
              <button type="button" onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Histórico</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-900 transition-colors">
              {activeTab === 'DATA' && (
                <form id="userForm" onSubmit={handleSubmit} className="space-y-6">
                  {isViewOnly && (
                    <div className="md:col-span-2 bg-emerald-900/20 p-4 rounded-xl border border-emerald-900/40 flex items-center gap-3 mb-4">
                      <Info className="text-emerald-400" size={20} />
                      <p className="text-xs font-bold text-emerald-200">Modo de visualização. Clique no botão "Habilitar Edição" abaixo para realizar alterações.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">Nome Completo</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-800/50 text-slate-100" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">CPF</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-800/50 text-slate-100" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">RG</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-800/50 text-slate-100" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">PIS / PASEP</label>
                      <input disabled={isViewOnly} className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-800/50 text-slate-100" value={formData.pis || ''} onChange={e => setFormData({...formData, pis: e.target.value})} placeholder="Somente números" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">E-mail Corporativo</label>
                      <input disabled={isViewOnly} required type="email" className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none bg-slate-800/50 text-slate-100" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value?.trim() || ''})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">Cargo / Setor Atual</label>
                      <select disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-800/50 text-slate-100" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                        <option value="">Selecione um cargo...</option>
                        {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">Status do Colaborador</label>
                      <select disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-800/50 text-slate-100" value={formData.status || UserStatus.ACTIVE} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value={UserStatus.ACTIVE}>Ativo</option>
                        <option value={UserStatus.ON_LEAVE}>Afastado (INSS/Licença)</option>
                      </select>
                    </div>
                  </div>
                </form>
              )}
              {activeTab === 'ASSETS' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500/80 mb-4 flex items-center gap-2"><Smartphone size={14} className="text-emerald-500" /> Dispositivos e Periféricos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userDevices.map(d => {
                        const m = models.find(mod => mod.id === d.modelId);
                        const isSharedResponsible = d.additionalUserIds?.includes(editingId || '');
                        return (
                          <div key={d.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-4 group hover:border-emerald-500/50 transition-all">
                            <div className="h-12 w-12 rounded-lg bg-emerald-950/20 flex items-center justify-center border border-emerald-900/30 shrink-0 relative">
                              <Smartphone className="text-emerald-500" size={24}/>
                              {isSharedResponsible && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full" title="Ativo Compartilhado">
                                  <Users size={UI_ICON_SIZE_SMALL}/>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[11px] font-bold text-slate-100 uppercase tracking-tight truncate">{m?.name || 'Aparelho'}</div>
                                {isSharedResponsible && <span className="text-[11px] font-bold bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase">Compartilhado</span>}
                              </div>
                              <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2">TAG: {d.assetTag || 'N/A'} <span className="h-1 w-1 bg-slate-700 rounded-full"/> S/N: {d.serialNumber || 'N/A'}</div>
                              <div className="text-[11px] font-mono text-emerald-400 mt-1">{d.imei ? `IMEI: ${d.imei}` : ''}</div>
                            </div>
                          </div>
                        );
                      })}
                      {userDevices.length === 0 && <div className="md:col-span-2 text-center py-8 border-2 border-dashed border-slate-800 rounded-xl"><Smartphone className="mx-auto text-slate-700 mb-2" size={32}/><p className="text-xs font-bold text-slate-500 uppercase">Nenhum dispositivo em posse</p></div>}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Briefcase size={14} className="text-blue-500" /> Linhas Móveis (Chips)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userSims.map(sim => (
                        <div key={sim.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-4 group hover:border-blue-500/50 transition-all">
                          <div className="h-12 w-12 rounded-lg bg-blue-950/20 flex items-center justify-center border border-blue-900/30 shrink-0">
                            <Phone className="text-blue-500" size={24}/>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-100 uppercase tracking-tighter truncate">{sim.phoneNumber}</div>
                            <div className="text-[11px] font-bold text-slate-500 uppercase">{sim.assetTag ? `Sim Card: ${sim.assetTag}` : 'Sim Card S/N'}</div>
                            <div className="mt-1"><span className="text-[11px] font-black bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded uppercase tracking-wider">Ativa</span></div>
                          </div>
                        </div>
                      ))}
                      {userSims.length === 0 && <div className="md:col-span-2 text-center py-8 border-2 border-dashed border-slate-800 rounded-xl"><Phone className="mx-auto text-slate-700 mb-2" size={32}/><p className="text-xs font-bold text-slate-500 uppercase">Nenhuma linha associada</p></div>}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'LICENSES' && (
                <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-3">
                    {userAccounts.map(acc => (
                      <div key={acc.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-700">
                            <Mail className="text-emerald-400" size={24} />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-100 uppercase tracking-widest">{acc.name}</div>
                            <div className="text-xs font-bold text-slate-400 truncate max-w-[250px]">{acc.login}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Status da Conta</div>
                              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-900/30 text-emerald-400">Ativa</span>
                           </div>
                           <button className="p-2 bg-slate-900 text-slate-400 rounded-lg hover:text-white transition-colors border border-slate-800">
                             <ExternalLink size={16} />
                           </button>
                        </div>
                      </div>
                    ))}
                    {userAccounts.length === 0 && (
                      <div className="text-center py-16 bg-slate-950/50 rounded-3xl border-2 border-dashed border-slate-800">
                        <Mail className="mx-auto text-slate-800 mb-4" size={48} />
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma conta Microsoft/Google</h4>
                        <p className="text-xs text-slate-600 mt-2">Este colaborador não possui licenças atribuídas no momento.</p>
                      </div>
                    )}
                   </div>
                </div>
              )}
              {activeTab === 'TERMS' && (
                <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-3">
                    {currentUserTerms.map(term => (
                      <div key={term.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-700">
                            {term.type === 'ENTREGA' ? <FileSignature className="text-emerald-400" size={24} /> : <RefreshCw className="text-blue-400" size={24} />}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-100 uppercase tracking-widest">{term.type === 'ENTREGA' ? 'Termo de Entrega' : 'Termo de Devolução'}</div>
                            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 mt-1">EMITIDO EM: {new Date(term.date).toLocaleDateString('pt-BR')} <span className="h-1 w-1 bg-slate-700 rounded-full"/> ID: {term.id.slice(0,8).toUpperCase()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-right">
                              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${term.fileUrl || term.hasFile ? 'bg-emerald-900/30 text-emerald-400' : 'bg-orange-900/30 text-orange-400'}`}>{term.fileUrl || term.hasFile ? 'Assinado' : 'Pendente'}</span>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={() => {setEditingTerm(term); setTermEditData({status: (term.fileUrl || term.hasFile ? 'SIGNED' : 'PENDING'), notes: term.notes || '', evidenceFiles: term.evidenceFiles || []});}} className="p-2 bg-slate-900 text-blue-400 rounded-lg hover:bg-blue-900/20 transition-all border border-slate-800">
                               <Edit2 size={16} />
                             </button>
                             <button className="p-2 bg-slate-900 text-slate-400 rounded-lg hover:text-white transition-all border border-slate-800">
                               <Download size={16} />
                             </button>
                             <button className="p-2 bg-slate-900 text-emerald-400 rounded-lg hover:bg-emerald-900/20 transition-all border border-slate-800">
                               <Share2 size={16} />
                             </button>
                           </div>
                        </div>
                      </div>
                    ))}
                    {currentUserTerms.length === 0 && (
                      <div className="text-center py-16 bg-slate-950/50 rounded-3xl border-2 border-dashed border-slate-800">
                        <FileText className="mx-auto text-slate-800 mb-4" size={48} />
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum termo gerado</h4>
                      </div>
                    )}
                   </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center shrink-0 border-t border-white/5">
              <div className="flex gap-3">
                {!isViewOnly && (
                  <button onClick={() => setIsViewOnly(true)} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-black text-[11px] uppercase tracking-widest hover:bg-slate-750 transition-all">Cancelar Edição</button>
                )}
                {isViewOnly && (
                  <button onClick={() => setIsViewOnly(false)} className="px-6 py-3 rounded-xl bg-slate-800 text-emerald-400 font-black text-[11px] uppercase tracking-widest hover:bg-emerald-900/20 transition-all border border-emerald-900/30">Habilitar Edição</button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-black text-[11px] uppercase tracking-widest hover:bg-slate-750 transition-all">Fechar</button>
                {!isViewOnly && (
                  <button type="submit" form="userForm" className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"><Save size={16}/> Salvar Alterações</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTerm && (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-slate-900 rounded-3xl w-full max-w-2xl border border-slate-800 animate-scale-up shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Gerenciar Termo</h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">ID: {editingTerm.id.toUpperCase()}</p>
              </div>
              <button onClick={() => setEditingTerm(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setTermEditData({...termEditData, status: 'PENDING'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${termEditData.status === 'PENDING' ? 'border-orange-500 bg-orange-900/20 text-orange-400' : 'border-slate-800 hover:border-slate-700'}`}><Clock size={20}/><span className="text-[11px] font-black uppercase tracking-widest">Pendente</span></button>
                <button onClick={() => setTermEditData({...termEditData, status: 'SIGNED'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${termEditData.status === 'SIGNED' ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400' : 'border-slate-800 hover:border-slate-700'}`}><CheckCircle2 size={20}/><span className="text-[11px] font-black uppercase tracking-widest">Assinado</span></button>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Observações Detalhadas</label>
                <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 outline-none focus:border-emerald-500 min-h-[100px] text-sm" value={termEditData.notes} onChange={e => setTermEditData({...termEditData, notes: e.target.value})} placeholder="Adicione notas sobre o estado dos itens ou observações do colaborador..."/>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Evidências (Fotos / B.O.) - Máx 3</label>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {termEditData.evidenceFiles.map((file, index) => (
                    <div key={index} className="relative rounded-xl overflow-hidden border-2 border-slate-700 group h-32">
                      <img src={file} alt={`Evidência ${index + 1}`} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => handleRemoveEvidence(index)} className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform" title="Remover Imagem">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {termEditData.evidenceFiles.length < 3 && (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <Upload className="w-6 h-6 mb-2"/>
                        <p className="text-xs">Adicionar</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleEvidenceUpload} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex gap-3 justify-end">
              <button onClick={() => setEditingTerm(null)} className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={handleSaveTermEdit} className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest text-white transition-all">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;

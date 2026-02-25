
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SoftwareAccount, AccountType, User, Device } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, Shield, X, Eye, EyeOff, User as UserIcon, Smartphone, Briefcase, Lock, Save, AlertTriangle, FileText, SlidersHorizontal, Check, ChevronLeft, ChevronRight, ChevronDown, Info, ExternalLink, Globe, ArrowUp, ArrowDown } from 'lucide-react';

// --- SUB-COMPONENTE: SearchableDropdown ---
interface Option {
    value: string;
    label: string;
    subLabel?: string;
}

interface SearchableDropdownProps {
    options: Option[];
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    icon?: React.ReactNode;
    disabled?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ options, value, onChange, placeholder, icon, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full p-3 border-2 rounded-xl flex items-center justify-between cursor-pointer bg-white dark:bg-slate-800 transition-all
                    ${disabled ? 'bg-slate-100 dark:bg-slate-900 cursor-not-allowed text-gray-400 border-slate-200 dark:border-slate-800' : 'hover:border-indigo-400 border-indigo-200/50 dark:border-slate-700'}
                    ${isOpen ? 'ring-4 ring-indigo-100 dark:ring-indigo-900/20 border-indigo-500' : 'shadow-sm'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-indigo-400 dark:text-indigo-500 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <>
                                <span className="text-gray-900 dark:text-slate-100 font-bold text-sm truncate">{selectedOption.label}</span>
                                {selectedOption.subLabel && <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate font-mono uppercase tracking-tighter">{selectedOption.subLabel}</span>}
                             </>
                         ) : (
                             <span className="text-gray-400 dark:text-slate-500 text-sm">{placeholder}</span>
                         )}
                    </div>
                </div>
                <ChevronDown size={16} className={`text-indigo-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-[120] mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center gap-2 sticky top-0">
                        <Search size={14} className="text-slate-400 ml-2" />
                        <input 
                            type="text" 
                            className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 py-1"
                            placeholder="Buscar..."
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div 
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
                                className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-50 dark:border-slate-700 last:border-0 ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                            >
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono uppercase">{opt.subLabel}</div>}
                            </div>
                        )) : (
                            <div className="px-4 py-8 text-center text-slate-400 text-xs italic">Nenhum resultado.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente divisor para redimensionamento
const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div 
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400/50 transition-colors z-10 bg-slate-200/50 dark:bg-slate-700/50"
    />
);

const COLUMN_OPTIONS = [
    { id: 'name', label: 'Nome / Adicional' },
    { id: 'login', label: 'Login / E-mail' },
    { id: 'password', label: 'Senha' },
    { id: 'accessUrl', label: 'Acesso / URL' },
    { id: 'link', label: 'Vínculo' },
    { id: 'status', label: 'Status' }
];

const AccountManager = () => {
    const { accounts, addAccount, updateAccount, deleteAccount, users, devices, models, brands } = useData();
    const { user: currentUser } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<AccountType | 'ALL'>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Partial<SoftwareAccount> | null>(null);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    // UI States
    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
        const saved = localStorage.getItem('account_manager_columns');
        return saved ? JSON.parse(saved) : ['name', 'login', 'accessUrl', 'link', 'status'];
    });

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('account_manager_widths');
        return saved ? JSON.parse(saved) : {};
    });

    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const columnRef = useRef<HTMLDivElement>(null);

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(20);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        localStorage.setItem('account_manager_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('account_manager_widths', JSON.stringify(columnWidths));
    }, [columnWidths]);

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

    const toggleColumn = (id: string) => {
        setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const handleOpenModal = (account?: SoftwareAccount) => {
        if (account) {
            setEditingAccount(account);
        } else {
            setEditingAccount({ 
                name: '', 
                type: AccountType.EMAIL, 
                login: '', 
                status: 'Ativo',
                userId: null,
                deviceId: null,
                accessUrl: '',
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount) return;

        const adminName = currentUser?.name || 'Sistema';
        if (editingAccount.id) {
            updateAccount(editingAccount as SoftwareAccount, adminName);
        } else {
            addAccount({ ...editingAccount, id: Math.random().toString(36).substr(2, 9) } as SoftwareAccount, adminName);
        }
        setIsModalOpen(false);
    };

    const handleOpenUrl = (url?: string) => {
        if (!url) return;
        let finalUrl = url.trim();
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('ftp://')) {
            finalUrl = 'https://' + finalUrl;
        }
        window.open(finalUrl, '_blank');
    };

        const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAccounts = React.useMemo(() => {
        let sortableItems = [...accounts];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof SoftwareAccount];
                let bValue: any = b[sortConfig.key as keyof SoftwareAccount];

                // Resolução de nomes para chaves de ID
                if (sortConfig.key === 'userId') {
                    aValue = users.find(u => u.id === a.userId)?.fullName || '';
                    bValue = users.find(u => u.id === b.userId)?.fullName || '';
                } else if (sortConfig.key === 'deviceId') {
                    aValue = devices.find(d => d.id === a.deviceId)?.assetTag || '';
                    bValue = devices.find(d => d.id === b.deviceId)?.assetTag || '';
                }

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'asc' 
                        ? aValue.localeCompare(bValue) 
                        : bValue.localeCompare(aValue);
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            sortableItems.sort((a, b) => a.name.localeCompare(b.name));
        }
        return sortableItems;
    }, [accounts, sortConfig, users, devices]);

    const filteredAccounts = sortedAccounts.filter(acc => {
        const matchesSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (acc.accessUrl || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (acc.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = activeFilter === 'ALL' || acc.type === activeFilter;
        
        return matchesSearch && matchesType;
    });

    // Paginação
    const totalItems = filteredAccounts.length;
    const currentItemsPerPage = itemsPerPage === 'ALL' ? totalItems : itemsPerPage;
    const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / currentItemsPerPage);
    const startIndex = (currentPage - 1) * (itemsPerPage === 'ALL' ? 0 : itemsPerPage as number);
    const paginatedAccounts = itemsPerPage === 'ALL' ? filteredAccounts : filteredAccounts.slice(startIndex, startIndex + (itemsPerPage as number));

    const userOptions = users.map(u => ({ value: u.id, label: u.fullName, subLabel: `CPF: ${u.cpf}` }));
    const deviceOptions = devices.map(d => {
        const model = models.find(m => m.id === d.modelId);
        return { 
            value: d.id, 
            label: `${model?.name || 'Ativo'} - ${d.assetTag || d.serialNumber}`,
            subLabel: d.imei ? `IMEI: ${d.imei}` : d.assetTag
        };
    });

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Licenças / Contas</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">Gestão padronizada de licenças, e-mails e URLs de acesso.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative" ref={columnRef}>
                        <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold transition-all">
                            <SlidersHorizontal size={18} /> Colunas
                        </button>
                        {isColumnSelectorOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[80] overflow-hidden animate-fade-in">
                                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-500">Exibir Colunas</span>
                                    <button onClick={() => setIsColumnSelectorOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                                </div>
                                <div className="p-2 space-y-1">
                                    {COLUMN_OPTIONS.map(col => (
                                        <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                            {col.label}
                                            {visibleColumns.includes(col.id) && <Check size={14}/>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-bold">
                        <Plus size={18} /> Nova Conta
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS POR TIPO (v2.12.18) */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-xl transition-colors">
                <button 
                    onClick={() => setActiveFilter('ALL')} 
                    className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeFilter === 'ALL' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}
                >
                    Todas
                    <span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{accounts.length}</span>
                </button>
                {Object.values(AccountType).map(type => (
                    <button 
                        key={type} 
                        onClick={() => setActiveFilter(type)} 
                        className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeFilter === type ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}
                    >
                        {type}
                        <span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{accounts.filter(a => a.type === type).length}</span>
                    </button>
                ))}
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-3 text-gray-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Buscar por nome, login ou endereço de acesso..." 
                    className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left table-fixed min-w-[1100px]">
                        <thead className="text-[10px] text-gray-500 dark:text-slate-400 uppercase bg-gray-50 dark:bg-slate-800/50 font-black tracking-widest border-b dark:border-slate-800">
                            <tr>
                                {visibleColumns.includes('name') && (
                                    <th className="px-6 py-4 relative" style={{ width: columnWidths['name'] || '180px' }}>
                                        Nome / Adicional
                                        <Resizer onMouseDown={(e) => handleResize('name', e.clientX, columnWidths['name'] || 180)} />
                                    </th>
                                )}
                                {visibleColumns.includes('login') && (
                                    <th className="px-6 py-4 relative" style={{ width: columnWidths['login'] || '200px' }}>
                                        Login / E-mail / Acesso
                                        <Resizer onMouseDown={(e) => handleResize('login', e.clientX, columnWidths['login'] || 200)} />
                                    </th>
                                )}
                                {visibleColumns.includes('password') && (
                                    <th className="px-6 py-4 relative" style={{ width: columnWidths['password'] || '150px' }}>
                                        Senha
                                        <Resizer onMouseDown={(e) => handleResize('password', e.clientX, columnWidths['password'] || 150)} />
                                    </th>
                                )}
                                {visibleColumns.includes('accessUrl') && (
                                    <th className="px-6 py-4 relative" style={{ width: columnWidths['accessUrl'] || '220px' }}>
                                        Endereço de Acesso / URL
                                        <Resizer onMouseDown={(e) => handleResize('accessUrl', e.clientX, columnWidths['accessUrl'] || 220)} />
                                    </th>
                                )}
                                {visibleColumns.includes('link') && (
                                    <th className="px-6 py-4 relative" style={{ width: columnWidths['link'] || '200px' }}>
                                        Vínculo
                                        <Resizer onMouseDown={(e) => handleResize('link', e.clientX, columnWidths['link'] || 200)} />
                                    </th>
                                )}
                                {visibleColumns.includes('status') && (
                                    <th className="px-6 py-4 relative text-center" style={{ width: columnWidths['status'] || '110px' }}>
                                        Status
                                        <Resizer onMouseDown={(e) => handleResize('status', e.clientX, columnWidths['status'] || 110)} />
                                    </th>
                                )}
                                <th className="px-6 py-4 text-right" style={{ width: '120px' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {paginatedAccounts.map(acc => {
                                const linkedUser = users.find(u => u.id === acc.userId);
                                const linkedDevice = devices.find(d => d.id === acc.deviceId);

                                return (
                                    <tr key={acc.id} onClick={() => handleOpenModal(acc)} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer bg-white dark:bg-slate-900">
                                        {visibleColumns.includes('name') && (
                                            <td className="px-6 py-4 truncate">
                                                <div className="font-bold text-gray-900 dark:text-slate-100">{acc.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">{acc.type}</div>
                                            </td>
                                        )}
                                        {visibleColumns.includes('login') && (
                                            <td className="px-6 py-4 truncate text-slate-600 dark:text-slate-400 font-medium">{acc.login}</td>
                                        )}
                                        {visibleColumns.includes('password') && (
                                            <td className="px-6 py-4 truncate">
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono text-xs">
                                                        {showPasswords[acc.id] ? (acc.password || '---') : '••••••••'}
                                                    </div>
                                                    <button onClick={() => setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]}))} className="text-slate-400 hover:text-indigo-600">
                                                        {showPasswords[acc.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.includes('accessUrl') && (
                                            <td className="px-6 py-4 truncate">
                                                {acc.accessUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-[150px] font-mono">{acc.accessUrl}</span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleOpenUrl(acc.accessUrl); }}
                                                            className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-all"
                                                            title="Abrir Link"
                                                        >
                                                            <ExternalLink size={14}/>
                                                        </button>
                                                    </div>
                                                ) : <span className="text-slate-300 dark:text-slate-700 italic text-[10px]">Não informado</span>}
                                            </td>
                                        )}
                                        {visibleColumns.includes('link') && (
                                            <td className="px-6 py-4 truncate">
                                                {linkedUser ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold">
                                                        <UserIcon size={12}/> {linkedUser.fullName}
                                                    </div>
                                                ) : linkedDevice ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                                                        <Smartphone size={12}/> {linkedDevice.assetTag}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-700 italic text-xs">Sem vínculo</span>
                                                )}
                                            </td>
                                        )}
                                        {visibleColumns.includes('status') && (
                                            <td className="px-6 py-4 text-center truncate">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${acc.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                    {acc.status}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleOpenModal(acc)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                                                <button onClick={() => deleteAccount(acc.id, currentUser?.name || 'Sistema')} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Exibir:</span>
                            <select 
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={40}>40</option>
                                <option value={100}>100</option>
                                <option value="ALL">Todos</option>
                            </select>
                        </div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total: {totalItems} licenças</p>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'}`}
                            >
                                <ChevronLeft size={18}/>
                            </button>
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1.5 rounded-lg shadow-sm">{currentPage}</span>
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mx-1">de</span>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{totalPages}</span>
                            </div>
                            <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}
                            >
                                <ChevronRight size={18}/>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && editingAccount && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up border dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center border-b border-white/10 shrink-0">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                                {editingAccount.id ? 'Editar Licença / Conta' : 'Nova Licença / Conta'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Licença / Nome Amigável (Adicional/Outros)</label>
                                    <input required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-all" value={editingAccount.name} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} placeholder="Ex: Office 365, E-mail Marketing..."/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Tipo de Conta</label>
                                    <select className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-all" value={editingAccount.type} onChange={e => setEditingAccount({...editingAccount, type: e.target.value as AccountType})}>
                                        {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Login / E-mail / Acesso</label>
                                    <input required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-all" value={editingAccount.login} onChange={e => setEditingAccount({...editingAccount, login: e.target.value})} placeholder="E-mail ou username"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Senha de Acesso</label>
                                    <input className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-mono bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-all" value={editingAccount.password || ''} onChange={e => setEditingAccount({...editingAccount, password: e.target.value})} placeholder="••••••••"/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Endereço de Acesso / URL (Web, FTP, Sites)</label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-3.5 text-slate-300" size={16}/>
                                        <input className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 pl-10 text-sm font-mono bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-all" value={editingAccount.accessUrl || ''} onChange={e => setEditingAccount({...editingAccount, accessUrl: e.target.value})} placeholder="ex: https://erp.empresa.com ou ftp://servidor"/>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <h4 className="text-[10px] font-black uppercase text-indigo-500 mb-3 border-b dark:border-slate-800 pb-1 flex items-center gap-2">
                                        <Info size={14}/> Vínculo de Responsabilidade
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Colaborador (Busca por Nome/CPF)</label>
                                            <SearchableDropdown options={userOptions} value={editingAccount.userId || ''} onChange={val => setEditingAccount({...editingAccount, userId: val || null, deviceId: null})} placeholder="Vincular a Pessoa..." icon={<UserIcon size={16}/>}/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Dispositivo (Busca por IMEI/Modelo)</label>
                                            <SearchableDropdown options={deviceOptions} value={editingAccount.deviceId || ''} onChange={val => setEditingAccount({...editingAccount, deviceId: val || null, userId: null})} placeholder="Vincular a Ativo..." icon={<Smartphone size={16}/>}/>
                                        </div>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Observações Internas</label>
                                    <textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-all" rows={3} value={editingAccount.notes || ''} onChange={e => setEditingAccount({...editingAccount, notes: e.target.value})} placeholder="Detalhes adicionais sobre a licença..."></textarea>
                                </div>
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800 shrink-0">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all tracking-widest">Cancelar</button>
                                <button type="submit" className="px-10 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95">Salvar Conta</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountManager;


import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SoftwareAccount, AccountType, User, Device } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, Shield, X, Eye, EyeOff, User as UserIcon, Smartphone, Briefcase, Lock, Save, AlertTriangle, FileText, SlidersHorizontal, Check, ChevronLeft, ChevronRight, ChevronDown, Info } from 'lucide-react';

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

const AccountManager = () => {
    const { accounts, addAccount, updateAccount, deleteAccount, users, devices, sectors, models, brands } = useData();
    const { user: currentUser } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Partial<SoftwareAccount> | null>(null);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

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
                sectorId: null
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

    const filteredAccounts = accounts.filter(acc => 
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.login.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const userOptions = users.map(u => ({ value: u.id, label: u.fullName, subLabel: u.email }));
    const deviceOptions = devices.map(d => {
        const model = models.find(m => m.id === d.modelId);
        return { 
            value: d.id, 
            label: `${model?.name || 'Ativo'} - ${d.assetTag || d.serialNumber}`,
            subLabel: d.assetTag
        };
    });
    const sectorOptions = sectors.map(s => ({ value: s.id, label: s.name }));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Licenças / Contas</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">Gestão de licenças, e-mails e acessos.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-bold">
                    <Plus size={18} /> Nova Conta
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-3 text-gray-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou login..." 
                    className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-gray-500 dark:text-slate-400 uppercase bg-gray-50 dark:bg-slate-800/50 font-black tracking-widest border-b dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4">Nome / Tipo</th>
                                <th className="px-6 py-4">Login</th>
                                <th className="px-6 py-4">Senha / Chave</th>
                                <th className="px-6 py-4">Vínculo</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {filteredAccounts.map(acc => {
                                const linkedUser = users.find(u => u.id === acc.userId);
                                const linkedDevice = devices.find(d => d.id === acc.deviceId);
                                const linkedSector = sectors.find(s => s.id === acc.sectorId);

                                return (
                                    <tr key={acc.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-slate-100">{acc.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{acc.type}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{acc.login}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono text-xs">
                                                    {showPasswords[acc.id] ? (acc.password || acc.licenseKey || '---') : '••••••••'}
                                                </div>
                                                <button onClick={() => setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]}))} className="text-slate-400 hover:text-indigo-600">
                                                    {showPasswords[acc.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {linkedUser ? (
                                                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold">
                                                    <UserIcon size={12}/> {linkedUser.fullName}
                                                </div>
                                            ) : linkedDevice ? (
                                                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                                                    <Smartphone size={12}/> {linkedDevice.assetTag}
                                                </div>
                                            ) : linkedSector ? (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                                    <Briefcase size={12}/> {linkedSector.name}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-700 italic text-xs">Sem vínculo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${acc.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                {acc.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
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
            </div>

            {isModalOpen && editingAccount && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up border dark:border-slate-800">
                        <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center border-b border-white/10">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                                {editingAccount.id ? 'Editar Licença / Conta' : 'Nova Licença / Conta'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Nome Amigável / Descrição</label>
                                    <input required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-slate-50 dark:bg-slate-800" value={editingAccount.name} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} placeholder="Ex: Office 365, E-mail Marketing..."/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Tipo de Conta</label>
                                    <select className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-slate-50 dark:bg-slate-800" value={editingAccount.type} onChange={e => setEditingAccount({...editingAccount, type: e.target.value as AccountType})}>
                                        {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Login / Usuário</label>
                                    <input required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm bg-slate-50 dark:bg-slate-800" value={editingAccount.login} onChange={e => setEditingAccount({...editingAccount, login: e.target.value})} placeholder="E-mail ou username"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Senha ou Chave de Licença</label>
                                    <input className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-mono bg-slate-50 dark:bg-slate-800" value={editingAccount.password || editingAccount.licenseKey || ''} onChange={e => setEditingAccount({...editingAccount, password: e.target.value})} placeholder="••••••••"/>
                                </div>
                                <div className="md:col-span-2">
                                    <h4 className="text-[10px] font-black uppercase text-indigo-500 mb-3 border-b dark:border-slate-800 pb-1">Vínculo de Responsabilidade</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Colaborador</label>
                                            <SearchableDropdown options={userOptions} value={editingAccount.userId || ''} onChange={val => setEditingAccount({...editingAccount, userId: val || null, deviceId: null, sectorId: null})} placeholder="Vincular a Pessoa..." icon={<UserIcon size={16}/>}/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Dispositivo</label>
                                            <SearchableDropdown options={deviceOptions} value={editingAccount.deviceId || ''} onChange={val => setEditingAccount({...editingAccount, deviceId: val || null, userId: null, sectorId: null})} placeholder="Vincular a Ativo..." icon={<Smartphone size={16}/>}/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Setor</label>
                                            <SearchableDropdown options={sectorOptions} value={editingAccount.sectorId || ''} onChange={val => setEditingAccount({...editingAccount, sectorId: val || null, userId: null, deviceId: null})} placeholder="Uso por Setor..." icon={<Briefcase size={16}/>}/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                                <button type="submit" className="px-10 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-xl font-black text-xs uppercase tracking-widest transition-all">Salvar Conta</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountManager;

import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SoftwareAccount, AccountType, User, Device } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, Shield, X, Eye, EyeOff, User as UserIcon, Smartphone, Briefcase, Lock, Save, AlertTriangle, FileText, SlidersHorizontal, Check, ChevronLeft, ChevronRight, ChevronDown, Info, ExternalLink, Globe } from 'lucide-react';

// --- SUB-COMPONENTE: SearchableDropdown ---
interface Option { value: string; label: string; subLabel?: string; }
interface SearchableDropdownProps { options: Option[]; value: string; onChange: (val: string) => void; placeholder: string; icon?: React.ReactNode; disabled?: boolean; }

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ options, value, onChange, placeholder, icon, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase())));
    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full p-3 border-2 rounded-xl flex items-center justify-between cursor-pointer bg-white dark:bg-slate-800 transition-all ${disabled ? 'bg-slate-100 dark:bg-slate-900 cursor-not-allowed text-gray-400 border-slate-200 dark:border-slate-800' : 'hover:border-indigo-400 border-indigo-200/50 dark:border-slate-700'} ${isOpen ? 'ring-4 ring-indigo-100 dark:ring-indigo-900/20 border-indigo-500' : 'shadow-sm'}`}>
                <div className="flex items-center gap-3 overflow-hidden">{icon && <span className="text-indigo-400 dark:text-indigo-500 shrink-0">{icon}</span>}<div className="flex flex-col truncate">{selectedOption ? (<><span className="text-gray-900 dark:text-slate-100 font-bold text-sm truncate">{selectedOption.label}</span>{selectedOption.subLabel && <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate font-mono uppercase tracking-tighter">{selectedOption.subLabel}</span>}</>) : (<span className="text-gray-400 dark:text-slate-500 text-sm">{placeholder}</span>)}</div></div>
                <ChevronDown size={16} className={`text-indigo-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-[120] mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center gap-2 sticky top-0"><Search size={14} className="text-slate-400 ml-2" /><input type="text" className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 py-1" placeholder="Buscar..." autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
                    <div className="overflow-y-auto flex-1">{filteredOptions.length > 0 ? filteredOptions.map(opt => (<div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }} className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-50 dark:border-slate-700 last:border-0 ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}><div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{opt.label}</div>{opt.subLabel && <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono uppercase">{opt.subLabel}</div>}</div>)) : (<div className="px-4 py-8 text-center text-slate-400 text-xs italic">Nenhum resultado.</div>)}</div>
                </div>
            )}
        </div>
    );
};

const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-10 bg-slate-200/50 dark:bg-slate-700/50" />
);

const AccountManager = () => {
    const { accounts, addAccount, updateAccount, deleteAccount, users, devices, models, brands } = useData();
    const { user: currentUser } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<AccountType | 'ALL'>('ALL');
    const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Partial<SoftwareAccount> | null>(null);
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
    const [editReason, setEditReason] = useState('');
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const flyoutRef = useRef<HTMLDivElement>(null);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('account_manager_widths');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => { localStorage.setItem('account_manager_widths', JSON.stringify(columnWidths)); }, [columnWidths]);

    const handleResize = (colId: string, startX: number, startWidth: number) => {
        const onMouseMove = (e: MouseEvent) => { const delta = e.clientX - startX; setColumnWidths(prev => ({ ...prev, [colId]: Math.max(startWidth + delta, 50) })); };
        const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    };

    const handleOpenFlyout = (account?: SoftwareAccount, viewOnly: boolean = false) => {
        setIsViewOnly(viewOnly);
        if (account) { setEditingAccount(account); } 
        else { setEditingAccount({ name: '', type: AccountType.EMAIL, login: '', status: 'Ativo', userId: null, deviceId: null, accessUrl: '', notes: '' }); }
        setIsFlyoutOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount) return;
        if (editingAccount.id) {
            setEditReason('');
            setIsReasonModalOpen(true);
        } else {
            const adminName = currentUser?.name || 'Sistema';
            addAccount({ ...editingAccount, id: Math.random().toString(36).substr(2, 9) } as SoftwareAccount, adminName);
            setIsFlyoutOpen(false);
        }
    };

    const confirmEdit = () => {
        if (!editReason.trim()) return alert('Informe o motivo.');
        const adminName = currentUser?.name || 'Sistema';
        updateAccount(editingAccount as SoftwareAccount, adminName);
        setIsReasonModalOpen(false); setIsFlyoutOpen(false);
    };

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || acc.login.toLowerCase().includes(searchTerm.toLowerCase()) || (acc.accessUrl || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = activeFilter === 'ALL' || acc.type === activeFilter;
        return matchesSearch && matchesType;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const userOptions = users.map(u => ({ value: u.id, label: u.fullName, subLabel: `CPF: ${u.cpf}` }));
    const deviceOptions = devices.map(d => {
        const model = models.find(m => m.id === d.modelId);
        return { value: d.id, label: `${model?.name || 'Ativo'} - ${d.assetTag || d.serialNumber}`, subLabel: d.imei || d.assetTag };
    });

    return (
        <div className="space-y-12 animate-fade-in pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Licenças e Contas</h1><p className="text-slate-500 dark:text-slate-400 font-medium">Gestão centralizada de e-mails corporativos e licenças SaaS.</p></div>
                <button onClick={() => handleOpenFlyout()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-indigo-600/20 font-black uppercase text-xs tracking-widest active:scale-95 transition-all"><Plus size={20} strokeWidth={3}/> Adicionar</button>
            </div>

            <div className="flex gap-4 border-b dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 px-6 pt-2 rounded-2xl transition-colors">
                <button onClick={() => setActiveFilter('ALL')} className={`px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeFilter === 'ALL' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Todas</button>
                {Object.values(AccountType).map(type => (<button key={type} onClick={() => setActiveFilter(type)} className={`px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeFilter === type ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{type}</button>))}
            </div>

            <div className="relative group">
                <Search className="absolute left-5 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={22} />
                <input type="text" placeholder="Buscar por nome, login ou endereço..." className="pl-14 w-full border-none rounded-2xl py-4 shadow-xl shadow-slate-200/50 dark:shadow-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all text-lg font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left table-fixed min-w-[1000px]">
                        <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                            <tr>
                                <th className="px-8 py-5 relative" style={{ width: columnWidths['name'] || '200px' }}>Conta / Serviço <Resizer onMouseDown={(e) => handleResize('name', e.clientX, columnWidths['name'] || 200)} /></th>
                                <th className="px-6 py-5 relative" style={{ width: columnWidths['login'] || '220px' }}>Login / E-mail <Resizer onMouseDown={(e) => handleResize('login', e.clientX, columnWidths['login'] || 220)} /></th>
                                <th className="px-6 py-5 relative" style={{ width: columnWidths['link'] || '200px' }}>Vínculo Atual <Resizer onMouseDown={(e) => handleResize('link', e.clientX, columnWidths['link'] || 200)} /></th>
                                <th className="px-6 py-5 relative text-center" style={{ width: columnWidths['status'] || '120px' }}>Status <Resizer onMouseDown={(e) => handleResize('status', e.clientX, columnWidths['status'] || 120)} /></th>
                                <th className="px-8 py-5 text-right w-[100px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {filteredAccounts.map(acc => {
                                const linkedUser = users.find(u => u.id === acc.userId);
                                const linkedDevice = devices.find(d => d.id === acc.deviceId);
                                return (
                                    <tr key={acc.id} onClick={() => handleOpenFlyout(acc, true)} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group bg-white dark:bg-slate-900/40">
                                        <td className="px-8 py-5 truncate"><div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">{acc.name}</div><div className="text-[9px] font-black uppercase text-indigo-500 tracking-tighter">{acc.type}</div></td>
                                        <td className="px-6 py-5 truncate text-slate-500 dark:text-slate-400 font-bold text-xs">{acc.login}</td>
                                        <td className="px-6 py-5 truncate">{linkedUser ? (<div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold"><UserIcon size={12}/> {linkedUser.fullName}</div>) : linkedDevice ? (<div className="flex items-center gap-1.5 text-xs text-violet-600 font-bold"><Smartphone size={12}/> {linkedDevice.assetTag}</div>) : <span className="text-[10px] text-slate-300 italic">Sem vínculo</span>}</td>
                                        <td className="px-6 py-5 text-center truncate"><span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${acc.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{acc.status}</span></td>
                                        <td className="px-8 py-5 text-right"><button onClick={e => { e.stopPropagation(); handleOpenFlyout(acc, false); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18}/></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Flyout Accounts Standardized v3 */}
            {isFlyoutOpen && editingAccount && (
                <>
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] animate-fade-in" onClick={() => setIsFlyoutOpen(false)}></div>
                    <div ref={flyoutRef} className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white dark:bg-slate-900 z-[100] shadow-[-20px_0_40px_rgba(0,0,0,0.1)] flex flex-col transform transition-all duration-500 ease-out animate-slide-in border-l dark:border-slate-800">
                        <div className="bg-slate-900 dark:bg-black px-8 py-8 shrink-0 relative overflow-hidden transition-all duration-500">
                            <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Globe size={180}/></div>
                            
                            <div className="relative z-10 flex items-center gap-6">
                                {/* Icon Container Standardized */}
                                <div className="h-32 w-32 rounded-3xl bg-indigo-600/20 border border-indigo-400/20 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl backdrop-blur-sm">
                                    <Globe size={48} className="text-indigo-400 opacity-60" />
                                </div>

                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full w-fit mb-3">
                                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                                            {editingAccount.id ? 'Licença em Auditoria' : 'Nova Credencial SaaS'}
                                        </span>
                                    </div>
                                    
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4 truncate">
                                        {editingAccount.name || 'Nova Conta'}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                        <div className="flex items-center gap-2 text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                            <Shield size={12} className="text-indigo-400"/>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{editingAccount.type}</span>
                                        </div>
                                        {editingAccount.login && (
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Mail size={12} className="text-indigo-400"/>
                                                <span className="text-[10px] font-bold tracking-tight lowercase">{editingAccount.login}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlyoutOpen(false); }} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer absolute top-0 right-0 z-50"><X size={20}/></button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-white dark:bg-slate-900 transition-colors">
                            <form id="accForm" onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
                                {isViewOnly && (<div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-4"><div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0"><Info size={24}/></div><p className="text-xs font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-tighter">Modo de leitura. Para alterar login ou senha, habilite a edição no rodapé.</p></div>)}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="md:col-span-2 space-y-2"><label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome do Serviço / Licença</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-black bg-slate-50 dark:bg-slate-950 focus:border-indigo-500 outline-none transition-all" value={editingAccount.name} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} placeholder="Ex: Office 365, E-mail Financeiro..."/></div>
                                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Tipo de Conta</label><select disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-white dark:bg-slate-900 focus:border-indigo-500 outline-none transition-all" value={editingAccount.type} onChange={e => setEditingAccount({...editingAccount, type: e.target.value as AccountType})}>{Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Login / E-mail</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm bg-white dark:bg-slate-900 focus:border-indigo-500 outline-none transition-all" value={editingAccount.login} onChange={e => setEditingAccount({...editingAccount, login: e.target.value})}/></div>
                                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Senha</label><div className="relative"><input disabled={isViewOnly} type={showPasswords['edit'] ? 'text' : 'password'} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 pr-12 text-sm font-mono bg-white dark:bg-slate-900" value={editingAccount.password || ''} onChange={e => setEditingAccount({...editingAccount, password: e.target.value})} /><button type="button" onClick={() => setShowPasswords(p => ({...p, edit: !p.edit}))} className="absolute right-3 top-3 text-slate-400">{showPasswords['edit'] ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
                                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Status da Licença</label><select disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-white dark:bg-slate-900" value={editingAccount.status} onChange={e => setEditingAccount({...editingAccount, status: e.target.value as 'Ativo' | 'Inativo'})}><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option></select></div>
                                    <div className="md:col-span-2 space-y-4">
                                        <h4 className="text-[10px] font-black uppercase text-indigo-500 border-b dark:border-slate-800 pb-1">Vínculos de Ativos / Pessoas</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <SearchableDropdown disabled={isViewOnly} options={userOptions} value={editingAccount.userId || ''} onChange={val => setEditingAccount({...editingAccount, userId: val || null, deviceId: null})} placeholder="Pessoa Responsável..." icon={<UserIcon size={16}/>}/>
                                            <SearchableDropdown disabled={isViewOnly} options={deviceOptions} value={editingAccount.deviceId || ''} onChange={val => setEditingAccount({...editingAccount, deviceId: val || null, userId: null})} placeholder="Ativo de Hardware..." icon={<Smartphone size={16}/>}/>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2"><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Observações Internas</label><textarea disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-4 text-sm bg-white dark:bg-slate-900" rows={3} value={editingAccount.notes || ''} onChange={e => setEditingAccount({...editingAccount, notes: e.target.value})} /></div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-950 px-10 py-8 flex justify-between items-center border-t dark:border-slate-800 shrink-0 transition-colors">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlyoutOpen(false); }} className="px-8 py-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 transition-all tracking-[0.2em] shadow-sm cursor-pointer">Fechar</button>
                            {isViewOnly ? (
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsViewOnly(false); }} className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 flex items-center gap-3 cursor-pointer"><Edit2 size={20}/> Habilitar Edição</button>
                            ) : (
                                <button type="submit" form="accForm" className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 cursor-pointer">Salvar Conta</button>
                            )}
                        </div>
                    </div>
                </>
            )}

            {isReasonModalOpen && (<div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100 dark:border-indigo-900/50"><div className="p-10"><div className="flex flex-col items-center text-center mb-8"><div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 mb-6 shadow-inner border-2 border-white dark:border-slate-800"><Save size={40} /></div><h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Salvar Alterações?</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Justificativa necessária:</p></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 text-sm focus:ring-4 focus:ring-indigo-100 outline-none mb-8 transition-all bg-slate-50 dark:bg-slate-950 dark:text-white shadow-inner" rows={3} placeholder="Descreva o motivo..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-100 dark:border-slate-700 cursor-pointer">Voltar</button><button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">Confirmar</button></div></div></div></div>)}
        </div>
    );
};

export default AccountManager;
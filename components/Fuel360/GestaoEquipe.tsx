
import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { DataContext } from './context/DataContext';
import { Colaborador, TipoVeiculoReembolso, ImportPreviewResult, DiffItem, Grupo } from './types';
import { batchUpdateColaboradoresAddress, getImportPreview, syncColaboradores, geocodeAddress } from './services/apiService';
import Papa from 'papaparse';
import { 
    UsersIcon, PlusCircleIcon, PencilIcon, TrashIcon, XCircleIcon, CheckCircleIcon, ExclamationIcon, SpinnerIcon, LocationMarkerIcon, UserGroupIcon, CarIcon, MotoIcon, UserIcon, ChevronDownIcon, ChevronUpIcon, UploadIcon, ArrowRightIcon, RefreshIcon, BriefcaseIcon, SearchIcon, GlobeIcon
} from './icons';

// --- COMPONENTE: MODAL DE COLABORADOR ---
const ColaboradorModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    colaborador: Colaborador | null;
    initialGroup: string; 
}> = ({ isOpen, onClose, colaborador, initialGroup }) => {
    const { addColaborador, updateColaborador, grupos } = useContext(DataContext);
    const [formData, setFormData] = useState<Partial<Colaborador>>({});
    const [motivo, setMotivo] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [fetchingCoords, setFetchingCoords] = useState(false);
    const [originalAddress, setOriginalAddress] = useState('');
    const [addressChanged, setAddressChanged] = useState(false);
    const [quickCoords, setQuickCoords] = useState('');

    useEffect(() => {
        setError(''); setMotivo(''); setSaving(false); setQuickCoords('');
        if (colaborador) { 
            setFormData(colaborador); 
            setOriginalAddress(colaborador.EnderecoBase || '');
            setAddressChanged(false);
        } else {
            const defaultGroup = initialGroup === 'Todos' ? (grupos.length > 0 ? grupos[0].Nome : 'Vendedor') : initialGroup;
            setFormData({ ID_Pulsus: undefined, CodigoSetor: undefined, Nome: '', Grupo: defaultGroup, TipoVeiculo: 'Carro', Ativo: true, LatitudeBase: 0, LongitudeBase: 0, EnderecoBase: '' });
            setOriginalAddress('');
            setAddressChanged(false);
        }
    }, [colaborador, isOpen, initialGroup, grupos]);

    if (!isOpen) return null;

    const handleAddressChange = (val: string) => {
        setFormData({ ...formData, EnderecoBase: val });
        if (val.trim() !== originalAddress.trim()) setAddressChanged(true);
        else setAddressChanged(false);
    };

    const handleQuickCoordsChange = (val: string) => {
        setQuickCoords(val);
        if (val.includes(',')) {
            const parts = val.split(',');
            if (parts.length >= 2) {
                const lat = parseFloat(parts[0].trim());
                const lng = parseFloat(parts[1].trim());
                if (!isNaN(lat) && !isNaN(lng)) {
                    setFormData(prev => ({ ...prev, LatitudeBase: lat, LongitudeBase: lng }));
                    setAddressChanged(false);
                    setOriginalAddress(formData.EnderecoBase || '');
                }
            }
        }
    };

    const handleOpenGoogleMaps = () => {
        if (!formData.EnderecoBase) { alert("Digite o endereço para pesquisar no Maps."); return; }
        const url = `https://www.google.com/maps/search/${encodeURIComponent(formData.EnderecoBase)}`;
        window.open(url, '_blank');
    };

    const handleFetchCoords = async () => {
        if (!formData.EnderecoBase || formData.EnderecoBase.trim().length < 5) {
            alert("Por favor, informe um endereço mais completo para buscar as coordenadas.");
            return;
        }

        setFetchingCoords(true);
        try {
            const result = await geocodeAddress(formData.EnderecoBase);
            if (result && result.lat && result.lon) {
                setFormData(prev => ({ ...prev, LatitudeBase: result.lat, LongitudeBase: result.lon }));
                setAddressChanged(false);
                setOriginalAddress(formData.EnderecoBase || '');
                setQuickCoords(`${result.lat}, ${result.lon}`);
            } else {
                alert("Não foi possível encontrar as coordenadas para este endereço. Verifique se o endereço está correto.");
            }
        } catch (e: any) {
            alert("Erro ao buscar coordenadas: " + e.message);
        } finally {
            setFetchingCoords(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (addressChanged) {
            setError("O endereço foi alterado. Você precisa atualizar ou confirmar as coordenadas GPS antes de salvar.");
            return;
        }

        if (!formData.Nome || !formData.ID_Pulsus || !formData.CodigoSetor) { setError("Campos obrigatórios ausentes."); return; }
        if (colaborador && !motivo.trim()) { setError("Motivo da alteração é obrigatório."); return; }

        const data: Colaborador = {
            ID_Colaborador: colaborador ? colaborador.ID_Colaborador : 0,
            ID_Pulsus: Number(formData.ID_Pulsus),
            CodigoSetor: Number(formData.CodigoSetor),
            Nome: formData.Nome || '',
            Grupo: formData.Grupo || 'Vendedor',
            TipoVeiculo: formData.TipoVeiculo as TipoVeiculoReembolso,
            Ativo: formData.Ativo !== undefined ? formData.Ativo : true,
            MotivoAlteracao: colaborador ? motivo : undefined,
            LatitudeBase: formData.LatitudeBase || 0,
            LongitudeBase: formData.LongitudeBase || 0,
            EnderecoBase: formData.EnderecoBase || '',
            EnderecoPendente: false // Reset automático ao salvar manualmente
        };

        setSaving(true);
        try {
            if (colaborador) await updateColaborador(data); else await addColaborador(data);
            onClose();
        } catch (err: any) { setError(err.message || 'Erro ao salvar.'); } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto relative text-slate-900">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-cyan-500"></div>
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800">{colaborador ? 'Editar Colaborador' : `Novo Colaborador`}</h3>
                        {colaborador?.EnderecoPendente && (
                            <div className="flex items-center text-red-600 font-bold text-xs bg-red-50 border border-red-100 px-2 py-1 rounded-md mt-1 animate-pulse">
                                <ExclamationIcon className="w-3 h-3 mr-1"/> REVISÃO DE ENDEREÇO OBRIGATÓRIA
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition"><XCircleIcon className="w-6 h-6"/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (<div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-start text-sm animate-shake"><ExclamationIcon className="w-5 h-5 mr-3 shrink-0"/><span>{error}</span></div>)}
                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1"><label className="block text-xs font-bold text-slate-500 uppercase ml-1">Setor (Cód)</label><input type="number" value={formData.CodigoSetor ?? ''} onChange={e => setFormData({...formData, CodigoSetor: Number(e.target.value)})} className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-600 font-mono text-lg shadow-sm" required /></div>
                        <div className="space-y-1"><label className="block text-xs font-bold text-slate-500 uppercase ml-1">ID (Pulsus)</label><input type="number" value={formData.ID_Pulsus ?? ''} onChange={e => setFormData({...formData, ID_Pulsus: Number(e.target.value)})} className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-600 font-mono text-lg shadow-sm" required /></div>
                    </div>
                    <div className="space-y-1"><label className="block text-xs font-bold text-slate-500 uppercase ml-1">Nome Completo</label><input type="text" value={formData.Nome} onChange={e => setFormData({...formData, Nome: e.target.value})} className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-600 shadow-sm" required /></div>
                    <div className="space-y-1"><label className="block text-xs font-bold text-slate-500 uppercase ml-1">Grupo / Cargo</label><select value={formData.Grupo || ''} onChange={e => setFormData({...formData, Grupo: e.target.value})} className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-600 shadow-sm" required><option value="">Selecione...</option>{grupos.map(g => (<option key={g.ID_Grupo} value={g.Nome}>{g.Nome}</option>))}</select></div>
                    <div className={`p-5 rounded-xl border transition-all duration-300 ${addressChanged ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-400/20' : 'bg-blue-50/50 border-blue-100'}`}>
                        <div className="flex justify-between items-center mb-4"><h4 className={`text-xs font-bold uppercase flex items-center ${addressChanged ? 'text-amber-700' : 'text-blue-700'}`}><LocationMarkerIcon className="w-4 h-4 mr-2"/> Coordenadas de Partida (Casa)</h4>{addressChanged && <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold animate-pulse">ATUALIZAÇÃO NECESSÁRIA</span>}</div>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <input type="text" value={formData.EnderecoBase || ''} onChange={e => handleAddressChange(e.target.value)} className={`flex-1 bg-white text-slate-900 border rounded-lg p-3 text-sm focus:ring-2 outline-none transition-colors ${addressChanged ? 'border-amber-300 focus:ring-amber-500' : 'border-slate-200 focus:ring-blue-600'}`} placeholder="Rua, Número, Cidade..." />
                                    <button type="button" onClick={handleOpenGoogleMaps} className="bg-white border border-blue-200 text-blue-600 px-3 rounded-lg text-xs font-bold hover:bg-blue-50 transition flex items-center shadow-sm shrink-0" title="Ver no Google Maps"><GlobeIcon className="w-4 h-4"/></button>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleFetchCoords} 
                                    disabled={fetchingCoords || !formData.EnderecoBase}
                                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg py-2.5 text-xs font-black transition flex items-center justify-center shadow-sm disabled:opacity-50"
                                >
                                    {fetchingCoords ? <SpinnerIcon className="w-4 h-4 mr-2 animate-spin"/> : <SearchIcon className="w-4 h-4 mr-2"/>}
                                    {fetchingCoords ? 'BUSCANDO COORDENADAS...' : 'BUSCAR LAT/LONG AUTOMATICAMENTE'}
                                </button>
                            </div>
                            <div className="space-y-1"><label className="block text-[10px] font-bold text-slate-500 uppercase ml-1">Colar Lat, Long juntas (Captura Rápida)</label><input type="text" value={quickCoords} onChange={e => handleQuickCoordsChange(e.target.value)} className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none placeholder:italic" placeholder="Ex: -23.0886, -45.7096" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="block text-[10px] font-bold text-slate-500 uppercase ml-1">Latitude</label><input type="number" step="0.0000001" value={formData.LatitudeBase ?? ''} onChange={e => { setFormData({...formData, LatitudeBase: parseFloat(e.target.value)}); setAddressChanged(false); }} className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 outline-none" /></div>
                                <div className="space-y-1"><label className="block text-[10px] font-bold text-slate-500 uppercase ml-1">Longitude</label><input type="number" step="0.0000001" value={formData.LongitudeBase ?? ''} onChange={e => { setFormData({...formData, LongitudeBase: parseFloat(e.target.value)}); setAddressChanged(false); }} className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 outline-none" /></div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5 items-end">
                        <div className="space-y-1 bg-white">
                            <label className="block text-xs font-bold text-slate-500 uppercase ml-1">Veículo</label>
                            <select value={formData.TipoVeiculo} onChange={e => setFormData({...formData, TipoVeiculo: e.target.value as any})} className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-600 appearance-none shadow-sm">
                                <option value="Carro">Carro</option>
                                <option value="Moto">Moto</option>
                                <option value="Sem Veículo / VT">Sem Veículo / VT</option>
                            </select>
                        </div>
                    </div>
                    {colaborador && (<div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mt-2"><label className="block text-xs font-bold text-blue-700 uppercase mb-2">Motivo da Alteração</label><textarea value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full bg-white text-slate-900 border border-blue-100 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Justificativa para auditoria..." rows={2} required /></div>)}
                    <div className="flex justify-end pt-6 space-x-3"><button type="button" onClick={onClose} disabled={saving} className="bg-white hover:bg-slate-50 text-slate-600 font-bold py-3 px-6 rounded-xl transition border border-slate-200">Cancelar</button><button type="submit" disabled={saving || addressChanged} className={`font-bold py-3 px-6 rounded-xl flex items-center transition shadow-lg ${addressChanged ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'}`}>{saving ? <SpinnerIcon className="w-5 h-5 mr-2"/> : <CheckCircleIcon className="w-5 h-5 mr-2"/>} {saving ? 'Salvando...' : 'Salvar'}</button></div>
                </form>
            </div>
        </div>
    );
};

// --- MODAL DE SINCRONIZAÇÃO ---
const SyncModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { refreshData } = useContext(DataContext);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['NEW', 'PHONE_CHANGE', 'ID_MATCH']));

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getImportPreview()
                .then(data => {
                    setPreview(data);
                    const initial = new Set<string>();
                    data.novos.forEach(n => initial.add(`NEW-${n.id_pulsus}`));
                    data.alterados.forEach(a => initial.add(`ALT-${a.id_pulsus}`));
                    data.conflitos.forEach(c => initial.add(`PHONE-${c.id_pulsus}`));
                    data.inativar.forEach(i => initial.add(`DEACT-${i.id_pulsus}`));
                    setSelectedItems(initial);
                    setExpandedSections(new Set(['NEW', 'PHONE_CHANGE', 'ID_MATCH', 'DEACTIVATE_SECTION']));
                })
                .catch(e => alert("Erro ao buscar preview: " + e.message))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const toggleSection = (s: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(s)) newSet.delete(s); else newSet.add(s);
        setExpandedSections(newSet);
    };

    const toggleItem = (key: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
        setSelectedItems(newSet);
    };

    const handleSync = async () => {
        if (!preview) return;
        setSyncing(true);
        try {
            const items: DiffItem[] = [
                ...preview.novos.filter(n => selectedItems.has(`NEW-${n.id_pulsus}`)).map(n => ({ syncAction: 'INSERT' as const, id_pulsus: n.id_pulsus, nome: n.nome, newData: n.newData })),
                ...preview.alterados.filter(a => selectedItems.has(`ALT-${a.id_pulsus}`)).map(a => ({ syncAction: 'UPDATE_DATA' as const, id_pulsus: a.id_pulsus, nome: a.nome, id_colaborador: a.id_colaborador, newData: a.newData })),
                ...preview.conflitos.filter(c => selectedItems.has(`PHONE-${c.id_pulsus}`)).map(c => ({ syncAction: 'UPDATE_ID' as const, id_pulsus: c.id_pulsus, nome: c.nome, id_colaborador: c.id_colaborador || c.existingColab?.ID_Colaborador, existingColab: c.existingColab, newData: c.newData })),
                ...preview.inativar.filter(i => selectedItems.has(`DEACT-${i.id_pulsus}`)).map(i => ({ syncAction: 'DEACTIVATE' as const, id_pulsus: i.id_pulsus, id_colaborador: i.id_colaborador }))
            ];
            if (items.length === 0) { alert("Nenhum item selecionado para sincronização."); setSyncing(false); return; }
            const res = await syncColaboradores(items);
            alert(`Sincronização concluída: ${res.count} registros processados.`);
            await refreshData();
            onClose();
        } catch (e: any) { alert("Erro na sincronização: " + e.message); } finally { setSyncing(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[110] animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-0 w-full max-w-3xl max-h-[90vh] flex flex-col relative overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Sincronização MariaDB</h3>
                        <p className="text-slate-500 text-sm font-medium">Revise as divergências antes de aplicar.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-white hover:text-slate-600 rounded-full transition shadow-sm border border-transparent hover:border-slate-100"><XCircleIcon className="w-6 h-6"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4">
                            <div className="relative"><SpinnerIcon className="w-12 h-12 text-blue-600"/><div className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-20"></div></div>
                            <p className="text-slate-500 font-bold animate-pulse">Comparando bases externas...</p>
                        </div>
                    ) : (
                        <>
                            {preview?.conflitos.length! > 0 && (
                                <div className="border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
                                    <button onClick={() => toggleSection('PHONE_CHANGE')} className="w-full flex justify-between items-center p-4 bg-indigo-50 hover:bg-indigo-100/70 transition-colors">
                                        <div className="flex items-center text-indigo-800 font-black text-sm uppercase tracking-wider"><RefreshIcon className="w-4 h-4 mr-2"/> Possível Troca de Celular ({preview?.conflitos.length})</div>
                                        {expandedSections.has('PHONE_CHANGE') ? <ChevronUpIcon className="w-4 h-4 text-indigo-400"/> : <ChevronDownIcon className="w-4 h-4 text-indigo-400"/>}
                                    </button>
                                    {expandedSections.has('PHONE_CHANGE') && (
                                        <div className="p-2 space-y-2 bg-white animate-fade-in-up">
                                            {preview?.conflitos.map(c => (
                                                <div key={c.id_pulsus} className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/20">
                                                    <div className="flex items-center">
                                                        <input type="checkbox" checked={selectedItems.has(`PHONE-${c.id_pulsus}`)} onChange={() => toggleItem(`PHONE-${c.id_pulsus}`)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mr-4 cursor-pointer" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-sm font-bold text-slate-800">{c.nome}</p>
                                                                <span className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Troca de Aparelho</span>
                                                            </div>
                                                            <div className="mt-2 p-2 bg-white rounded border border-indigo-50 text-[10px]">
                                                                <p className="text-slate-400 mb-1 font-bold uppercase tracking-widest">Detecção de Conflito:</p>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 p-1 bg-slate-50 rounded">
                                                                        <span className="text-slate-400">Dono Atual:</span> <span className="text-slate-600 font-bold">{c.existingColab.Nome}</span>
                                                                    </div>
                                                                    <ArrowRightIcon className="w-3 h-3 text-indigo-400"/>
                                                                    <div className="flex-1 p-1 bg-indigo-50 rounded">
                                                                        <span className="text-indigo-400">Novo Dono:</span> <span className="text-indigo-700 font-bold">{c.nome}</span>
                                                                    </div>
                                                                </div>
                                                                <p className="mt-2 text-indigo-600/70 italic font-medium leading-tight">
                                                                    * Ao sincronizar, o ID Pulsus {c.id_pulsus} será removido de {c.existingColab.Nome} e atribuído a {c.nome}.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {preview?.novos.length! > 0 && (
                                <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                                    <button onClick={() => toggleSection('NEW')} className="w-full flex justify-between items-center p-4 bg-emerald-50 hover:bg-emerald-100/70 transition-colors">
                                        <div className="flex items-center text-emerald-800 font-black text-sm uppercase tracking-wider"><PlusCircleIcon className="w-4 h-4 mr-2"/> Novos Colaboradores ({preview?.novos.length})</div>
                                        {expandedSections.has('NEW') ? <ChevronUpIcon className="w-4 h-4 text-emerald-400"/> : <ChevronDownIcon className="w-4 h-4 text-emerald-400"/>}
                                    </button>
                                    {expandedSections.has('NEW') && (
                                        <div className="p-2 space-y-2 bg-white">
                                            {preview?.novos.map(n => (
                                                <div key={n.id_pulsus} className="flex items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                                    <input type="checkbox" checked={selectedItems.has(`NEW-${n.id_pulsus}`)} onChange={() => toggleItem(`NEW-${n.id_pulsus}`)} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mr-4 cursor-pointer" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-800">{n.nome}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">ID Pulsus: {n.id_pulsus} • Setor: {n.newData.codigo_setor} • Grupo: {n.newData.grupo}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {preview?.alterados.length! > 0 && (
                                <div className="border border-blue-100 rounded-xl overflow-hidden shadow-sm">
                                    <button onClick={() => toggleSection('ID_MATCH')} className="w-full flex justify-between items-center p-4 bg-blue-50 hover:bg-blue-100/70 transition-colors">
                                        <div className="flex items-center text-blue-800 font-black text-sm uppercase tracking-wider"><PencilIcon className="w-4 h-4 mr-2"/> Alterações Detectadas ({preview?.alterados.length})</div>
                                        {expandedSections.has('ID_MATCH') ? <ChevronUpIcon className="w-4 h-4 text-blue-400"/> : <ChevronDownIcon className="w-4 h-4 text-blue-400"/>}
                                    </button>
                                    {expandedSections.has('ID_MATCH') && (
                                        <div className="p-2 space-y-2 bg-white">
                                            {preview?.alterados.map(a => (
                                                <div key={a.id_pulsus} className="flex items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                                    <input type="checkbox" checked={selectedItems.has(`ALT-${a.id_pulsus}`)} onChange={() => toggleItem(`ALT-${a.id_pulsus}`)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mr-4 cursor-pointer" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-800">{a.nome}</p>
                                                        <div className="flex flex-wrap gap-2 mt-1.5">
                                                            {a.changes.map((diff, idx) => (
                                                                <div key={idx} className={`flex items-center text-[9px] px-2 py-1 rounded border ${diff.field === 'Nome' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                                                    <span className="font-bold text-slate-400 uppercase mr-2">{diff.field}:</span>
                                                                    <span className="text-slate-500 line-through">{diff.oldValue}</span>
                                                                    <ArrowRightIcon className="w-2 h-2 mx-1.5 text-blue-400"/>
                                                                    <span className={`${diff.field === 'Nome' ? 'text-amber-700' : 'text-blue-700'} font-black`}>{diff.newValue}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {a.changes.some(d => d.field === 'Nome') && (
                                                            <p className="text-[9px] text-amber-600 font-bold mt-1 uppercase flex items-center">
                                                                <ExclamationIcon className="w-2.5 h-2.5 mr-1"/> Endereço será marcado para revisão
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {preview?.inativar.length! > 0 && (
                                <div className="border border-red-100 rounded-xl overflow-hidden shadow-sm">
                                    <button onClick={() => toggleSection('DEACTIVATE_SECTION')} className="w-full flex justify-between items-center p-4 bg-red-50 hover:bg-red-100/70 transition-colors">
                                        <div className="flex items-center text-red-800 font-black text-sm uppercase tracking-wider"><TrashIcon className="w-4 h-4 mr-2"/> Setores Removidos (A Inativar) ({preview?.inativar.length})</div>
                                        {expandedSections.has('DEACTIVATE_SECTION') ? <ChevronUpIcon className="w-4 h-4 text-red-400"/> : <ChevronDownIcon className="w-4 h-4 text-red-400"/>}
                                    </button>
                                    {expandedSections.has('DEACTIVATE_SECTION') && (
                                        <div className="p-2 space-y-2 bg-white">
                                            {preview?.inativar.map(i => (
                                                <div key={i.id_pulsus} className="flex items-center p-3 rounded-lg border border-red-50 bg-red-50/10">
                                                    <input type="checkbox" checked={selectedItems.has(`DEACT-${i.id_pulsus}`)} onChange={() => toggleItem(`DEACT-${i.id_pulsus}`)} className="w-4 h-4 rounded text-red-600 focus:ring-red-500 mr-4 cursor-pointer" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-800">{i.nome}</p>
                                                        <p className="text-[10px] text-red-400 font-bold uppercase tracking-tight">Setor {i.codigo_setor} ({i.grupo}) - Setor Vago ou Removido, será inativado</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {preview?.iguais.length! > 0 && (
                                <div className="border border-slate-100 rounded-xl overflow-hidden opacity-60">
                                    <button onClick={() => toggleSection('SAME')} className="w-full flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                                        <div className="flex items-center text-slate-500 font-bold text-xs uppercase tracking-wider"><CheckCircleIcon className="w-4 h-4 mr-2"/> Dados Idênticos (Ignorados: {preview?.iguais.length})</div>
                                        {expandedSections.has('SAME') ? <ChevronUpIcon className="w-3 h-3"/> : <ChevronDownIcon className="w-3 h-3"/>}
                                    </button>
                                    {expandedSections.has('SAME') && (
                                        <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-400 bg-white italic">
                                            {preview?.iguais.map(i => <div key={i.id_pulsus}>• {i.nome}</div>)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedItems.size} de {preview ? (preview.novos.length + preview.alterados.length + preview.conflitos.length) : 0} itens selecionados</div>
                    <div className="flex space-x-3">
                        <button onClick={onClose} className="px-6 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-white transition shadow-sm">Cancelar</button>
                        <button onClick={handleSync} disabled={syncing || selectedItems.size === 0} className={`px-8 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all flex items-center transform hover:-translate-y-0.5 active:scale-95 ${syncing || selectedItems.size === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'}`}>{syncing ? <SpinnerIcon className="w-5 h-5 mr-2"/> : <CheckCircleIcon className="w-5 h-5 mr-2"/>} {syncing ? 'Sincronizando...' : 'Confirmar e Sincronizar'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MODAL DE ENDEREÇOS ---
const AddressImportModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { colaboradores, refreshData } = useContext(DataContext);
    const [isProcessing, setIsProcessing] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        Papa.parse(file, { header: true, delimiter: ";", skipEmptyLines: true, complete: async (results: Papa.ParseResult<any>) => {
            const updates: any[] = [];
            results.data.forEach((row: any) => {
                const idPulsus = parseInt(row['ID Pulsus'] || row['id_pulsus']);
                const endereco = row['Endereco'] || row['endereco'];
                if (idPulsus && endereco) { const colab = colaboradores.find(c => c.ID_Pulsus === idPulsus); if (colab) updates.push({ id: colab.ID_Colaborador, endereco }); }
            });
            setPreview(updates);
        } });
    };
    const handleSave = async () => {
        if (preview.length === 0) return; setIsProcessing(true);
        try { await batchUpdateColaboradoresAddress(preview, "Importação via CSV"); refreshData(); onClose(); } catch (e: any) { alert("Erro ao importar: " + e.message); } finally { setIsProcessing(false); }
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[150]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Importar Endereços</h3>
                <p className="text-sm text-slate-500 mb-6">Selecione um CSV com as colunas <b>'ID Pulsus'</b> e <b>'Endereco'</b>.</p>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="mb-6 block w-full text-sm text-slate-500 file:bg-blue-50 file:text-blue-700 cursor-pointer" />
                {preview.length > 0 && (<div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6"><p className="text-blue-700 text-sm font-bold flex items-center"><CheckCircleIcon className="w-5 h-5 mr-2"/>{preview.length} endereços correspondentes encontrados.</p></div>)}
                <div className="flex justify-end space-x-3"><button onClick={onClose} disabled={isProcessing} className="px-6 py-2 border border-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={handleSave} disabled={isProcessing || preview.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md transition disabled:opacity-50">Importar Agora</button></div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL: GESTÃO DE EQUIPE ---
export const GestaoEquipe: React.FC = () => {
    const { colaboradores, grupos, deleteColaborador, updateColaborador, moveColaboradores, bulkUpdateColaboradores } = useContext(DataContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('Todos'); 
    const [sortBy, setSortBy] = useState<'Nome' | 'CodigoSetor'>('CodigoSetor');
    const [showInactives, setShowInactives] = useState(false);
    const [showOnlyPendingAddress, setShowOnlyPendingAddress] = useState(false); // NOVO v1.9.4
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false); 
    const [editingColab, setEditingColab] = useState<Colaborador | null>(null);
    const [bulkAction, setBulkAction] = useState<'NONE' | 'MOVE' | 'VEHICLE' | 'STATUS'>('NONE');
    const [bulkValue, setBulkValue] = useState('');
    const [processingBulk, setProcessingBulk] = useState(false);

    const filteredData = useMemo(() => {
        return colaboradores.filter(c => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = c.Nome.toLowerCase().includes(searchLower) || String(c.ID_Pulsus).includes(searchTerm) || String(c.CodigoSetor).includes(searchTerm);
            const matchesGroup = activeTab === 'Todos' ? true : c.Grupo === activeTab;
            const matchesActive = showInactives ? true : c.Ativo;
            
            // Lógica do Filtro de Pendência
            const hasNoAddress = !c.EnderecoBase || c.EnderecoBase.trim().length <= 3;
            const isFlagged = c.EnderecoPendente === true || Number(c.EnderecoPendente) === 1;
            const matchesPending = showOnlyPendingAddress ? (hasNoAddress || isFlagged) : true;
            
            return matchesSearch && matchesGroup && matchesActive && matchesPending;
        }).sort((a, b) => {
            if (sortBy === 'Nome') return a.Nome.localeCompare(b.Nome);
            else return (a.CodigoSetor || 0) - (b.CodigoSetor || 0);
        });
    }, [colaboradores, searchTerm, activeTab, sortBy, showInactives, showOnlyPendingAddress]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.checked) setSelectedIds(new Set(filteredData.map(c => c.ID_Colaborador))); else setSelectedIds(new Set()); };
    const handleSelectOne = (id: number) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
    const handleAddNew = () => { setEditingColab(null); setIsModalOpen(true); };
    const handleEdit = (c: Colaborador) => { setEditingColab(c); setIsModalOpen(true); };
    // Remoção da desativação manual conforme pedido: Status é gerido pela Sincronização
    // const handleDelete = async (id: number) => { if (window.confirm("Deseja desativar este colaborador?")) await deleteColaborador(id); };
    // const handleReactivate = async (c: Colaborador) => { if (window.confirm(`Deseja reativar o cadastro de ${c.Nome}?`)) { await updateColaborador({ ...c, Ativo: true, MotivoAlteracao: 'Reativação de cadastro' }); } };

    const handleBulkSubmit = async () => {
        if (selectedIds.size === 0 || !bulkValue) return;
        setProcessingBulk(true);
        try {
            const ids = Array.from(selectedIds);
            if (bulkAction === 'MOVE') await moveColaboradores(ids, bulkValue);
            else if (bulkAction === 'VEHICLE') await bulkUpdateColaboradores(ids, 'TipoVeiculo', bulkValue, 'Atualização em Massa');
            else if (bulkAction === 'STATUS') await bulkUpdateColaboradores(ids, 'Ativo', bulkValue === 'true', 'Atualização em Massa');
            setBulkAction('NONE'); setSelectedIds(new Set());
        } catch (e: any) { alert("Erro: " + e.message); } finally { setProcessingBulk(false); }
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <ColaboradorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} colaborador={editingColab} initialGroup={activeTab} />
            <AddressImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
            <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div><h2 className="text-3xl font-extrabold text-slate-800 mb-1 tracking-tight">Equipe & Setores</h2><p className="text-slate-500 font-medium text-sm">Gestão operacional com sincronização inteligente.</p></div>
                <div className="flex space-x-3">
                     <button onClick={() => setIsSyncModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center transition shadow-lg shadow-indigo-600/20"><RefreshIcon className="w-5 h-5 mr-2" /> Sincronizar</button>
                     <button onClick={() => setIsImportModalOpen(true)} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold py-2.5 px-4 rounded-xl flex items-center transition shadow-sm"><UploadIcon className="w-5 h-5 mr-2 text-slate-500" /> Endereços</button>
                     <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center shadow-lg transition"><PlusCircleIcon className="w-5 h-5 mr-2" /> Novo Cadastro</button>
                </div>
            </div>

            <div className="border-b border-slate-200 overflow-x-auto flex items-center scrollbar-hide bg-white rounded-t-xl">
                <button onClick={() => setActiveTab('Todos')} className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'Todos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Todos</button>
                {grupos.map(group => (
                    <button key={group.ID_Grupo} onClick={() => setActiveTab(group.Nome)} className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === group.Nome ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{group.Nome}</button>
                ))}
            </div>

            <div className="bg-white p-4 rounded-b-xl shadow-sm border border-slate-200 border-t-0 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-80"><input type="text" placeholder="Buscar por nome ou ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none shadow-inner focus:ring-2 focus:ring-blue-500 transition-all"/><div className="absolute left-3 top-2.5 text-slate-400"><SearchIcon className="w-4 h-4" /></div></div>
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                        <button onClick={() => setSortBy('Nome')} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${sortBy === 'Nome' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Nome</button>
                        <button onClick={() => setSortBy('CodigoSetor')} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${sortBy === 'CodigoSetor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Setor</button>
                    </div>
                </div>

                <div className="flex items-center space-x-4 flex-wrap gap-2">
                    <button 
                        onClick={() => setShowOnlyPendingAddress(!showOnlyPendingAddress)}
                        className={`flex items-center px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${showOnlyPendingAddress ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <LocationMarkerIcon className="w-4 h-4 mr-2"/>
                        Pendentes de Endereço
                    </button>

                    <div className="flex items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <input type="checkbox" id="showInactives" checked={showInactives} onChange={e => setShowInactives(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
                        <label htmlFor="showInactives" className="ml-2 text-xs font-bold text-slate-600 cursor-pointer">Exibir Inativos</label>
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="flex items-center bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 animate-fade-in shadow-sm">
                            <span className="text-xs font-bold text-blue-700 mr-4">{selectedIds.size} selecionados</span>
                            <div className="flex space-x-2">
                                 {bulkAction === 'NONE' ? (<><button onClick={() => setBulkAction('MOVE')} className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded hover:bg-blue-100">Mover</button><button onClick={() => { setBulkAction('VEHICLE'); setBulkValue(''); }} className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded hover:bg-blue-100">Veículo</button></>) : (
                                     <div className="flex items-center space-x-2">
                                         {bulkAction === 'MOVE' && <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className="w-32 px-2 py-1 text-xs border rounded">{grupos.map(g => <option key={g.ID_Grupo} value={g.Nome}>{g.Nome}</option>)}</select>}
                                         {bulkAction === 'VEHICLE' && (
                                             <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className="w-32 px-2 py-1 text-xs border rounded">
                                                 <option value="">Selecione...</option>
                                                 <option value="Carro">Carro</option>
                                                 <option value="Moto">Moto</option>
                                                 <option value="Sem Veículo / VT">Sem Veículo / VT</option>
                                             </select>
                                         )}
                                         <button onClick={handleBulkSubmit} className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded shadow-sm">{processingBulk ? <SpinnerIcon className="w-3 h-3"/> : "Aplicar"}</button>
                                         <button onClick={() => { setBulkAction('NONE'); setBulkValue(''); }} className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded">X</button>
                                     </div>
                                 )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-[0.1em] border-b border-slate-200">
                        <tr><th className="p-4 w-10"><input type="checkbox" onChange={handleSelectAll} checked={filteredData.length > 0 && selectedIds.size === filteredData.length} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"/></th><th className="p-4">Colaborador</th><th className="p-4">Grupo</th><th className="p-4 text-center">Veículo</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredData.map(c => {
                            const isPendingAddr = (c.EnderecoPendente === true || Number(c.EnderecoPendente) === 1) || (!c.EnderecoBase || c.EnderecoBase.trim().length <= 3);
                            return (
                                <tr key={c.ID_Colaborador} className={`hover:bg-slate-50 transition-colors ${!c.Ativo ? 'opacity-60 bg-slate-50' : ''}`}>
                                    <td className="p-4"><input type="checkbox" checked={selectedIds.has(c.ID_Colaborador)} onChange={() => handleSelectOne(c.ID_Colaborador)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"/></td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800 flex items-center flex-wrap gap-2">
                                            {c.Nome}
                                            {isPendingAddr && c.Ativo && (
                                                <span className="bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full border border-red-200 flex items-center animate-pulse" title="Endereço de partida precisa ser cadastrado ou revisto">
                                                    <ExclamationIcon className="w-2.5 h-2.5 mr-1"/> REVER ENDEREÇO
                                                </span>
                                            )}
                                            {c.EnderecoBase && !isPendingAddr && <span className="ml-2" title="Ponto de partida cadastrado"><LocationMarkerIcon className="w-3 h-3 text-emerald-500" /></span>}
                                        </div>
                                        <div className="text-[11px] text-slate-400">Setor: {c.CodigoSetor} • Pulsus: {c.ID_Pulsus}</div>
                                    </td>
                                    <td className="p-4 font-bold text-xs uppercase text-slate-500">{c.Grupo}</td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                            c.TipoVeiculo === 'Carro' 
                                                ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                                : c.TipoVeiculo === 'Moto' 
                                                ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {c.TipoVeiculo}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center font-bold text-xs">{c.Ativo ? <span className="text-emerald-600">Ativo</span> : <span className="text-red-400">Inativo</span>}</td>
                                    <td className="p-4 text-right space-x-2">
                                        <button onClick={() => handleEdit(c)} className={`p-1.5 rounded-lg transition ${isPendingAddr && c.Ativo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-blue-600 hover:bg-blue-50'}`} title="Editar"><PencilIcon className="w-4 h-4"/></button>
                                        {/* Botões de Status Removidos: Automação via Sincronização */}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredData.length === 0 && (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">Nenhum colaborador encontrado para os filtros aplicados.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

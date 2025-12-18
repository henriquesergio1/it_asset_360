import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { DeviceStatus, Device, SimCard, ReturnChecklist } from '../types';
import { ArrowRightLeft, CheckCircle, Smartphone, User as UserIcon, FileText, Printer, Search, ChevronDown, X, CheckSquare, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

type OperationType = 'CHECKOUT' | 'CHECKIN';
type AssetType = 'Device' | 'Sim';

// --- Componente Interno: Dropdown Pesquisável ---
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
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full p-3 border rounded-lg flex items-center justify-between cursor-pointer bg-white transition-all
                    ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'hover:border-blue-400'}
                    ${isOpen ? 'ring-2 ring-blue-100 border-blue-500' : 'border-gray-300 shadow-sm'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <>
                                <span className="text-gray-900 font-medium truncate">{selectedOption.label}</span>
                                {selectedOption.subLabel && <span className="text-[10px] text-gray-500 truncate font-mono">{selectedOption.subLabel}</span>}
                             </>
                         ) : (
                             <span className="text-gray-500">{placeholder}</span>
                         )}
                    </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 sticky top-0">
                        <Search size={14} className="text-gray-400 ml-2" />
                        <input 
                            ref={inputRef}
                            type="text" 
                            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
                            placeholder="Filtrar por nome, tag ou serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div 
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
                                className={`px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-0 ${value === opt.value ? 'bg-blue-50' : ''}`}
                            >
                                <div className="font-bold text-gray-800 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-gray-500 font-mono">{opt.subLabel}</div>}
                            </div>
                        )) : (
                            <div className="px-4 py-8 text-center text-gray-400 text-xs italic">Nenhum resultado encontrado.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


const Operations = () => {
  const { devices, sims, users, assignAsset, returnAsset, models, brands, assetTypes, settings, sectors, updateDevice } = useData();
  const { user: currentUser } = useAuth();
  
  // States
  const [activeTab, setActiveTab] = useState<OperationType>('CHECKOUT');
  const [assetType, setAssetType] = useState<AssetType>('Device');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [syncAssetData, setSyncAssetData] = useState(true);
  const [isProcessed, setIsProcessed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const [checklist, setChecklist] = useState<ReturnChecklist>({
      device: true, charger: true, cable: true, case: true, sim: false, manual: false
  });

  const [lastOperation, setLastOperation] = useState<{
      userId: string;
      assetId: string;
      assetType: AssetType;
      action: OperationType;
      checklistSnapshot?: ReturnChecklist;
      notes: string;
  } | null>(null);

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE);
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE);
  const availableSims = sims.filter(s => s.status === DeviceStatus.AVAILABLE);
  const inUseSims = sims.filter(s => s.status === DeviceStatus.IN_USE);

  useEffect(() => {
      if (activeTab === 'CHECKIN' && assetType === 'Device' && selectedAssetId) {
          const dev = devices.find(d => d.id === selectedAssetId);
          setChecklist({ device: true, charger: true, cable: true, case: true, sim: !!dev?.linkedSimId, manual: false });
      }
  }, [selectedAssetId, activeTab, assetType, devices]);

  const assetOptions: Option[] = activeTab === 'CHECKOUT' 
    ? (assetType === 'Device' 
        ? availableDevices.map(d => ({ value: d.id, label: `${models.find(m => m.id === d.modelId)?.name || 'Ativo'} - ${d.assetTag}`, subLabel: `SN: ${d.serialNumber}` })) 
        : availableSims.map(s => ({ value: s.id, label: `${s.phoneNumber} - ${s.operator}`, subLabel: `ICCID: ${s.iccid}` })))
    : (assetType === 'Device' 
        ? inUseDevices.map(d => ({ value: d.id, label: `${models.find(m => m.id === d.modelId)?.name || 'Ativo'} - ${d.assetTag}`, subLabel: `Com: ${users.find(u => u.id === d.currentUserId)?.fullName || 'Doador'}` })) 
        : inUseSims.map(s => ({ value: s.id, label: `${s.phoneNumber} - ${s.operator}`, subLabel: `ICCID: ${s.iccid}` })));

  const userOptions: Option[] = users.filter(u => u.active).map(u => ({ value: u.id, label: u.fullName, subLabel: u.email }));

  const handleExecute = async () => {
    if (isExecuting) return;
    setIsExecuting(true);

    const adminName = currentUser?.name || 'Sistema';
    let currentUserId = selectedUserId;
    
    if (activeTab === 'CHECKIN') {
        const found = assetType === 'Device' ? devices.find(d => d.id === selectedAssetId) : sims.find(s => s.id === selectedAssetId);
        currentUserId = found?.currentUserId || '';
    }

    try {
        if (activeTab === 'CHECKOUT' && syncAssetData && assetType === 'Device') {
            const user = users.find(u => u.id === selectedUserId);
            const device = devices.find(d => d.id === selectedAssetId);
            if (user && device) {
                await updateDevice({ ...device, sectorId: user.sectorId, costCenter: user.jobTitle }, adminName);
            }
        }

        if (activeTab === 'CHECKOUT') {
            await assignAsset(assetType, selectedAssetId, selectedUserId, notes, adminName);
        } else {
            await returnAsset(assetType, selectedAssetId, notes, adminName);
        }

        setLastOperation({
            userId: currentUserId,
            assetId: selectedAssetId,
            assetType: assetType,
            action: activeTab,
            checklistSnapshot: activeTab === 'CHECKIN' && assetType === 'Device' ? { ...checklist } : undefined,
            notes: notes
        });

        setIsProcessed(true);
    } catch (e) {
        alert('Erro ao processar operação: ' + (e as Error).message);
    } finally {
        setIsExecuting(false);
    }
  };

  const handlePrint = () => {
      if (!lastOperation) return;
      const user = users.find(u => u.id === lastOperation.userId);
      const asset = lastOperation.assetType === 'Device' ? devices.find(d => d.id === lastOperation.assetId) : sims.find(s => s.id === lastOperation.assetId);
      if (!user || !asset) return;

      let model, brand, type, linkedSim;
      if (lastOperation.assetType === 'Device') {
          const d = asset as Device;
          model = models.find(m => m.id === d.modelId);
          brand = brands.find(b => b.id === model?.brandId);
          type = assetTypes.find(t => t.id === model?.typeId);
          if (d.linkedSimId) linkedSim = sims.find(s => s.id === d.linkedSimId);
      }

      generateAndPrintTerm({
          user, asset, settings, model, brand, type, linkedSim,
          actionType: lastOperation.action === 'CHECKOUT' ? 'ENTREGA' : 'DEVOLUCAO',
          sectorName: sectors.find(s => s.id === user.sectorId)?.name,
          checklist: lastOperation.checklistSnapshot,
          notes: lastOperation.notes
      });
  };

  const resetProcess = () => {
      setIsProcessed(false);
      setSelectedAssetId('');
      setSelectedUserId('');
      setNotes('');
      setLastOperation(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel de Operações</h1>
          <p className="text-gray-500 font-medium">Gestão centralizada de fluxo de ativos.</p>
        </div>
        {isProcessed && (
            <button onClick={resetProcess} className="flex items-center gap-2 text-sm text-blue-600 font-black hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                <ArrowLeft size={16}/> VOLTAR PARA O INÍCIO
            </button>
        )}
      </div>

      {!isProcessed && (
          <div className="flex p-1 bg-slate-200 rounded-2xl w-full max-w-sm shadow-inner">
            <button onClick={() => { setActiveTab('CHECKOUT'); setSelectedAssetId(''); setSelectedUserId(''); }} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'CHECKOUT' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Entrega</button>
            <button onClick={() => { setActiveTab('CHECKIN'); setSelectedAssetId(''); setSelectedUserId(''); }} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'CHECKIN' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>Devolução</button>
          </div>
      )}

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {isProcessed ? (
            <div className="p-16 flex flex-col items-center text-center space-y-10 animate-fade-in">
                <div className={`h-28 w-28 rounded-full flex items-center justify-center shadow-2xl ${activeTab === 'CHECKOUT' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                    <CheckCircle size={64} strokeWidth={2.5}/>
                </div>
                <div>
                    <h3 className="text-3xl font-black text-slate-900">Operação Finalizada!</h3>
                    <p className="text-slate-500 max-w-md mt-3 text-lg leading-relaxed font-medium">O registro foi gravado no histórico. O que deseja fazer agora?</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                    <button onClick={handlePrint} className="flex items-center justify-center gap-3 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 hover:scale-[1.03] transition-all group">
                        <Printer size={24} className="group-hover:animate-bounce"/> Imprimir Termo
                    </button>
                    <button onClick={resetProcess} className="flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black hover:scale-[1.03] transition-all">
                        {/* Fix: Changed RefreshCcw to RefreshCw as suggested by the compiler error and the imports */}
                        <RefreshCw size={24}/> Nova Ação
                    </button>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest pt-4 opacity-50">Auditoria Registrada em: {new Date().toLocaleTimeString()}</p>
            </div>
        ) : (
            <div className="p-8 space-y-8">
                <div className="flex gap-4 p-1 bg-slate-50 rounded-2xl w-fit border border-slate-100">
                    <button onClick={() => { setAssetType('Device'); setSelectedAssetId(''); }} className={`flex items-center gap-3 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${assetType === 'Device' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}><Smartphone size={16} /> Dispositivo</button>
                    <button onClick={() => { setAssetType('Sim'); setSelectedAssetId(''); }} className={`flex items-center gap-3 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${assetType === 'Sim' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}><ArrowRightLeft size={16} /> Chip / SIM</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">1. Selecione o Ativo {activeTab === 'CHECKOUT' ? 'Disponível' : 'em Uso'}</label>
                        <SearchableDropdown options={assetOptions} value={selectedAssetId} onChange={setSelectedAssetId} placeholder="Busque por Tag ou Serial..." icon={assetType === 'Device' ? <Smartphone size={18}/> : <ArrowRightLeft size={18}/>} />
                        {selectedAssetId && (
                            <div className="p-5 bg-slate-900 rounded-2xl border-2 border-slate-800 text-white shadow-xl animate-fade-in">
                                {(() => {
                                    const d = assetType === 'Device' ? devices.find(x => x.id === selectedAssetId) : null;
                                    const s = assetType === 'Sim' ? sims.find(x => x.id === selectedAssetId) : null;
                                    return d ? (
                                        <div className="flex gap-4">
                                            <div className="h-16 w-16 bg-white rounded-xl flex items-center justify-center overflow-hidden border-2 border-blue-500 shrink-0">
                                                {models.find(m => m.id === d.modelId)?.imageUrl ? <img src={models.find(m => m.id === d.modelId)?.imageUrl} className="h-full w-full object-cover" /> : <Smartphone className="text-slate-300"/>}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-lg truncate leading-tight mb-1">{models.find(m => m.id === d.modelId)?.name}</p>
                                                <p className="text-blue-400 text-xs font-mono font-bold">TAG: {d.assetTag} • SN: {d.serialNumber}</p>
                                            </div>
                                        </div>
                                    ) : s ? (
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shrink-0 border-2 border-indigo-500"><ArrowRightLeft className="text-indigo-500"/></div>
                                            <div>
                                                <p className="font-black text-lg leading-tight mb-1">{s.phoneNumber}</p>
                                                <p className="text-indigo-300 text-xs font-mono font-bold uppercase">{s.operator} • ICCID: {s.iccid}</p>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {activeTab === 'CHECKOUT' ? (
                            <>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">2. Colaborador Destino</label>
                                <SearchableDropdown options={userOptions} value={selectedUserId} onChange={setSelectedUserId} placeholder="Quem receberá o ativo?..." icon={<UserIcon size={18}/>} />
                                {selectedUserId && assetType === 'Device' && (
                                    <div className="bg-blue-50 p-5 rounded-2xl border-2 border-blue-100 shadow-sm animate-fade-in">
                                        <label className="flex items-start gap-4 cursor-pointer">
                                            <input type="checkbox" checked={syncAssetData} onChange={e => setSyncAssetData(e.target.checked)} className="mt-1.5 h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-2 border-blue-200" />
                                            <div>
                                                <span className="block text-sm font-black text-blue-900 uppercase tracking-tight">Auto-Configurar Ativo</span>
                                                <span className="block text-xs text-blue-600/70 font-medium leading-relaxed mt-1">Atualizar Setor e Cargo do dispositivo conforme os dados atuais deste colaborador.</span>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </>
                        ) : (
                            selectedAssetId && (
                                <div className="p-6 bg-orange-50 rounded-2xl border-2 border-orange-100 shadow-sm animate-fade-in">
                                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Responsável Atual:</p>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center font-bold text-orange-600 shadow-sm border border-orange-200">{users.find(u => u.id === (assetType === 'Device' ? devices.find(d => d.id === selectedAssetId)?.currentUserId : sims.find(s => s.id === selectedAssetId)?.currentUserId))?.fullName.charAt(0)}</div>
                                        <p className="font-black text-slate-800 text-lg">{users.find(u => u.id === (assetType === 'Device' ? devices.find(d => d.id === selectedAssetId)?.currentUserId : sims.find(s => s.id === selectedAssetId)?.currentUserId))?.fullName || 'Não Registrado'}</p>
                                    </div>
                                    {assetType === 'Device' && (
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado dos Acessórios:</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['device', 'charger', 'cable', 'case'].map(k => (
                                                    <label key={k} className={`flex items-center gap-3 text-[10px] font-black uppercase cursor-pointer p-3 rounded-xl border-2 transition-all ${(checklist as any)[k] ? 'bg-white border-orange-400 text-orange-600 shadow-sm' : 'bg-orange-100/30 border-transparent text-orange-300'}`}>
                                                        <input type="checkbox" checked={(checklist as any)[k]} onChange={e => setChecklist({...checklist, [k]: e.target.checked})} className="hidden"/>
                                                        <CheckSquare size={16} className={!(checklist as any)[k] ? 'opacity-20' : ''}/>
                                                        {k === 'device' ? 'Aparelho' : k === 'charger' ? 'Carregador' : k === 'cable' ? 'Cabo' : 'Capa'}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2">Observações Adicionais para Auditoria</label>
                        <textarea className="w-full p-5 border-2 border-slate-100 rounded-3xl focus:border-blue-500 focus:bg-white outline-none text-sm bg-slate-50 transition-all shadow-inner" rows={3} placeholder="Descreva aqui avarias, brindes ou acordos específicos feitos nesta operação..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    
                    <button 
                        onClick={handleExecute}
                        disabled={!selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId) || isExecuting}
                        className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 ${!selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId) || isExecuting ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : activeTab === 'CHECKOUT' ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.01] active:scale-95' : 'bg-orange-600 text-white hover:bg-orange-700 hover:scale-[1.01] active:scale-95'}`}
                    >
                        {isExecuting ? <RefreshCw className="animate-spin" /> : <CheckCircle size={20}/>}
                        {activeTab === 'CHECKOUT' ? 'Confirmar e Gerar Vínculo' : 'Confirmar e Liberar Ativo'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Operations;
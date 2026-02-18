
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { DeviceStatus, Device, SimCard, ReturnChecklist, DeviceAccessory } from '../types';
import { ArrowRightLeft, CheckCircle, Smartphone, User as UserIcon, FileText, Printer, Search, ChevronDown, X, CheckSquare, RefreshCw, AlertCircle, ArrowLeft, Cpu, Package, UserX } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

type OperationType = 'CHECKOUT' | 'CHECKIN';
type AssetType = 'Device' | 'Sim';

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
                className={`w-full p-3 border rounded-xl flex items-center justify-between cursor-pointer bg-white dark:bg-slate-800 transition-all
                    ${disabled ? 'bg-gray-100 dark:bg-slate-900 cursor-not-allowed text-gray-400 dark:text-slate-600 border-slate-200 dark:border-slate-800' : 'hover:border-blue-400 border-slate-200 dark:border-slate-700'}
                    ${isOpen ? 'ring-4 ring-blue-100 dark:ring-blue-900/20 border-blue-500' : 'shadow-sm'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>}
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
                <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center gap-2 sticky top-0">
                        <Search size={14} className="text-slate-400 ml-2" />
                        <input 
                            type="text" 
                            className="flex-1 bg-transparent outline-none text-sm text-gray-700 dark:text-slate-100 placeholder-gray-400 py-1"
                            placeholder="Buscar por IMEI, Tag, Modelo ou Linha..."
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
                                className={`px-4 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-slate-50 dark:border-slate-700 last:border-0 ${value === opt.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                            >
                                <div className="font-bold text-gray-800 dark:text-slate-100 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase mt-0.5">{opt.subLabel}</div>}
                            </div>
                        )) : (
                            <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">Nenhum resultado encontrado.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const Operations = () => {
  const { devices, sims, users, assignAsset, returnAsset, models, brands, assetTypes, settings, sectors, updateDevice, accessoryTypes } = useData();
  const { user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<OperationType>('CHECKOUT');
  const [assetType, setAssetType] = useState<AssetType>('Device');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [syncAssetData, setSyncAssetData] = useState(true);
  // NOVO: Flag para inativar usuário no desligamento
  const [inactivateAfterReturn, setInactivateAfterReturn] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const [selectedAccessoryTypeIds, setSelectedAccessoryTypeIds] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ReturnChecklist>({ 'Equipamento Principal': true });

  const [lastOperation, setLastOperation] = useState<{
      userId: string;
      assetId: string;
      assetType: AssetType;
      action: OperationType;
      checklistSnapshot?: ReturnChecklist;
      accessoriesSnapshot?: DeviceAccessory[]; 
      notes: string;
  } | null>(null);

  useEffect(() => {
      if (activeTab === 'CHECKIN' && assetType === 'Device' && selectedAssetId) {
          const dev = devices.find(d => d.id === selectedAssetId);
          if (dev) {
              const newChecklist: ReturnChecklist = { 'Equipamento Principal': true };
              if (dev.accessories && dev.accessories.length > 0) {
                  dev.accessories.forEach(acc => {
                      newChecklist[acc.name] = true;
                  });
              }
              if (dev.linkedSimId) {
                  const chip = sims.find(s => s.id === dev.linkedSimId);
                  newChecklist[`Chip SIM Card (${chip?.phoneNumber || 'Vinculado'})`] = true;
              }
              setChecklist(newChecklist);
          }
      } else if (activeTab === 'CHECKOUT') {
          setSelectedAccessoryTypeIds([]);
          setInactivateAfterReturn(false);
      }
  }, [selectedAssetId, activeTab, assetType, devices, sims]);

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE);
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE);
  const availableSims = sims.filter(s => s.status === DeviceStatus.AVAILABLE);
  const inUseSims = sims.filter(s => s.status === DeviceStatus.IN_USE);

  const assetOptions: Option[] = (activeTab === 'CHECKOUT' 
    ? (assetType === 'Device' 
        ? availableDevices.map(d => {
            const model = models.find(m => m.id === d.modelId);
            const chip = sims.find(s => s.id === d.linkedSimId);
            return { 
                value: d.id, 
                label: `${d.imei ? `[IMEI: ${d.imei}] ` : ''}${model?.name || 'Ativo'}${d.assetTag ? ` - ${d.assetTag}` : ''}`, 
                subLabel: `S/N: ${d.serialNumber}${chip ? ` • Linha: ${chip.phoneNumber}` : ''}` 
            };
        }) 
        : availableSims.map(s => ({ value: s.id, label: `${s.phoneNumber} - ${s.operator}`, subLabel: `ICCID: ${s.iccid}` })))
    : (assetType === 'Device' 
        ? inUseDevices.map(d => {
            const model = models.find(m => m.id === d.modelId);
            const user = users.find(u => u.id === d.currentUserId);
            const chip = sims.find(s => s.id === d.linkedSimId);
            return { 
                value: d.id, 
                label: `${d.imei ? `[IMEI: ${d.imei}] ` : ''}${model?.name || 'Ativo'}${d.assetTag ? ` - ${d.assetTag}` : ''}`, 
                subLabel: `S/N: ${d.serialNumber}${chip ? ` • Linha: ${chip.phoneNumber}` : ''} • Com: ${user?.fullName || 'Usuário'}` 
            };
        }) 
        : inUseSims.map(s => ({ value: s.id, label: `${s.phoneNumber} - ${s.operator}`, subLabel: `ICCID: ${s.iccid}` })))
  ).sort((a,b) => a.label.localeCompare(b.label));

  const userOptions: Option[] = users.filter(u => u.active).map(u => ({ value: u.id, label: u.fullName, subLabel: u.email }))
    .sort((a,b) => a.label.localeCompare(b.label));

  const handleExecute = async () => {
    if (!selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId)) {
        alert('Por favor, selecione o ativo e o colaborador.');
        return;
    }

    if (isExecuting) return;
    setIsExecuting(true);
    
    const adminName = currentUser?.name || 'Sistema';
    let currentUserId = selectedUserId;
    
    if (activeTab === 'CHECKIN') {
        const found = assetType === 'Device' ? devices.find(d => d.id === selectedAssetId) : sims.find(s => s.id === selectedAssetId);
        currentUserId = found?.currentUserId || '';
    }

    try {
        let deliveryAccessories: DeviceAccessory[] = [];

        if (activeTab === 'CHECKOUT') {
            deliveryAccessories = selectedAccessoryTypeIds.map(typeId => {
                const type = accessoryTypes.find(t => t.id === typeId);
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    deviceId: selectedAssetId,
                    accessoryTypeId: typeId,
                    name: type?.name || 'Acessório'
                };
            });

            if (syncAssetData && assetType === 'Device') {
                const user = users.find(u => u.id === selectedUserId);
                const device = devices.find(d => d.id === selectedAssetId);
                if (user && device) await updateDevice({ ...device, sectorId: user.sectorId }, adminName);
            }

            await assignAsset(assetType, selectedAssetId, selectedUserId, notes, adminName, deliveryAccessories);
        } else {
            // Pass the inactivation flag to the return process
            await returnAsset(assetType, selectedAssetId, notes, adminName, checklist, inactivateAfterReturn);
        }

        setLastOperation({ 
            userId: currentUserId, 
            assetId: selectedAssetId, 
            assetType: assetType, 
            action: activeTab, 
            checklistSnapshot: activeTab === 'CHECKIN' && assetType === 'Device' ? { ...checklist } : undefined,
            accessoriesSnapshot: activeTab === 'CHECKOUT' && assetType === 'Device' ? deliveryAccessories : undefined,
            notes: notes 
        });
        
        setIsProcessed(true);
    } catch (e) { 
        alert('Erro ao processar: ' + (e as Error).message); 
    } finally { 
        setIsExecuting(false); 
    }
  };

  const handlePrint = () => {
      if (!lastOperation) return;
      const user = users.find(u => u.id === lastOperation.userId);
      let asset = lastOperation.assetType === 'Device' ? devices.find(d => d.id === lastOperation.assetId) : sims.find(s => s.id === lastOperation.assetId);
      
      if (!user || !asset) {
          alert("Não foi possível localizar os dados para impressão.");
          return;
      }

      if (lastOperation.assetType === 'Device' && lastOperation.accessoriesSnapshot) {
          asset = { ...asset, accessories: lastOperation.accessoriesSnapshot } as Device;
      }

      let model, brand, type, linkedSim;
      if (lastOperation.assetType === 'Device') {
          const d = asset as Device;
          model = models.find(m => m.id === d.modelId);
          brand = brands.find(b => b.id === model?.brandId);
          type = assetTypes.find(t => t.id === model?.typeId);
          if (d.linkedSimId) linkedSim = sims.find(s => s.id === d.linkedSimId);
      }

      generateAndPrintTerm({ 
          user, 
          asset, 
          settings, 
          model, 
          brand, 
          type, 
          linkedSim, 
          actionType: lastOperation.action === 'CHECKOUT' ? 'ENTREGA' : 'DEVOLUCAO', 
          sectorName: sectors.find(s => s.id === user.sectorId)?.name, 
          checklist: lastOperation.checklistSnapshot, 
          notes: lastOperation.notes 
      });
  };

  const toggleAccessory = (id: string) => {
      setSelectedAccessoryTypeIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const resetProcess = () => { 
      setIsProcessed(false); 
      setSelectedAssetId(''); 
      setSelectedUserId(''); 
      setNotes(''); 
      setLastOperation(null); 
      setSelectedAccessoryTypeIds([]);
      setInactivateAfterReturn(false);
  };

  if (isProcessed) {
      return (
          <div className="max-w-2xl mx-auto mt-20 p-10 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-blue-50 dark:border-slate-800 text-center animate-scale-up">
              <div className="h-24 w-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <CheckCircle size={48} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-2">Operação Realizada!</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium">A movimentação foi registrada com sucesso no histórico de auditoria.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={handlePrint} className="flex items-center justify-center gap-3 bg-blue-600 text-white py-4 px-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">
                      <Printer size={20}/> Imprimir Termo
                  </button>
                  <button onClick={resetProcess} className="flex items-center justify-center gap-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 px-6 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                      <ArrowLeft size={20}/> Nova Operação
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Painel de Operações</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Gestão centralizada de Entregas e Devoluções.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800">
          <div className="flex bg-slate-50 dark:bg-slate-950 p-2 gap-2 transition-colors">
              <button onClick={() => { setActiveTab('CHECKOUT'); setSelectedAssetId(''); }} className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-xs tracking-[0.2em] transition-all ${activeTab === 'CHECKOUT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                  <ArrowRightLeft size={18} className={activeTab === 'CHECKOUT' ? 'rotate-0' : 'rotate-180'}/> Entrega
              </button>
              <button onClick={() => { setActiveTab('CHECKIN'); setSelectedAssetId(''); }} className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-xs tracking-[0.2em] transition-all ${activeTab === 'CHECKIN' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                  <ArrowRightLeft size={18} className={activeTab === 'CHECKIN' ? 'rotate-180' : 'rotate-0'}/> Devolução
              </button>
          </div>

          <div className="p-10 space-y-10">
              <div className="space-y-6">
                  <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-black ${activeTab === 'CHECKOUT' ? 'bg-blue-600' : 'bg-orange-600'}`}>1</div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">O que está sendo movimentado?</h3>
                  </div>

                  <div className="flex gap-4">
                      <button onClick={() => { setAssetType('Device'); setSelectedAssetId(''); }} className={`flex-1 p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${assetType === 'Device' ? (activeTab === 'CHECKOUT' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400') : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-300'}`}>
                          <Smartphone size={32}/>
                          <span className="font-black uppercase text-[10px] tracking-widest">Dispositivo / Equipamento</span>
                      </button>
                      <button onClick={() => { setAssetType('Sim'); setSelectedAssetId(''); }} className={`flex-1 p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${assetType === 'Sim' ? (activeTab === 'CHECKOUT' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400') : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-300'}`}>
                          <Cpu size={32}/>
                          <span className="font-black uppercase text-[10px] tracking-widest">Chip SIM Card</span>
                      </button>
                  </div>

                  <div className="relative group">
                      <SearchableDropdown 
                        options={assetOptions} 
                        value={selectedAssetId} 
                        onChange={setSelectedAssetId} 
                        placeholder={assetType === 'Device' ? "Selecione o dispositivo pelo IMEI, Patrimônio ou Modelo..." : "Selecione a linha pelo Número ou Operadora..."}
                        icon={assetType === 'Device' ? <Smartphone size={18}/> : <Cpu size={18}/>}
                      />
                  </div>
              </div>

              {activeTab === 'CHECKOUT' && (
                  <div className="space-y-8 animate-fade-in">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black">2</div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Quem está recebendo?</h3>
                        </div>
                        <SearchableDropdown 
                            options={userOptions} 
                            value={selectedUserId} 
                            onChange={setSelectedUserId} 
                            placeholder="Pesquise o colaborador pelo nome ou CPF..."
                            icon={<UserIcon size={18}/>}
                        />
                        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                            <input type="checkbox" id="sync" checked={syncAssetData} onChange={e => setSyncAssetData(e.target.checked)} className="h-5 w-5 rounded text-blue-600 border-blue-200 dark:border-slate-700"/>
                            <label htmlFor="sync" className="text-xs font-bold text-blue-800 dark:text-blue-200 cursor-pointer">Sincronizar cargo do colaborador automaticamente com o ativo</label>
                        </div>
                      </div>

                      {assetType === 'Device' && selectedAssetId && (
                        <div className="space-y-6 animate-fade-in pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black">3</div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Acessórios Entregues</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {accessoryTypes.map(acc => (
                                    <button 
                                        key={acc.id} 
                                        onClick={() => toggleAccessory(acc.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${selectedAccessoryTypeIds.includes(acc.id) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-900 dark:text-blue-100 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'}`}
                                    >
                                        <div className={`h-6 w-6 rounded flex items-center justify-center ${selectedAccessoryTypeIds.includes(acc.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500'}`}>
                                            {selectedAccessoryTypeIds.includes(acc.id) ? <CheckSquare size={16}/> : <Package size={16}/>}
                                        </div>
                                        <span className="text-[10px] font-black uppercase truncate">{acc.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                      )}
                  </div>
              )}

              {activeTab === 'CHECKIN' && selectedAssetId && (
                   <div className="space-y-8 animate-fade-in">
                        {assetType === 'Device' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-black">2</div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Conferência de Devolução</h3>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-4 italic">
                                    Marque os itens que foram devolvidos fisicamente pelo colaborador:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-orange-50/50 dark:bg-orange-900/10 p-6 rounded-3xl border border-orange-100 dark:border-orange-900/30 shadow-inner transition-colors">
                                    {Object.keys(checklist).map(item => (
                                        <button 
                                            key={item} 
                                            onClick={() => setChecklist({...checklist, [item]: !checklist[item]})} 
                                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all shadow-sm ${checklist[item] ? 'bg-white dark:bg-slate-800 border-orange-500 text-orange-900 dark:text-orange-100' : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-70'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${checklist[item] ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                                                    {item.includes('Chip') ? <Cpu size={18}/> : <Package size={18}/>}
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-left">{item}</span>
                                            </div>
                                            {checklist[item] ? <CheckSquare size={20} className="text-orange-600 dark:text-orange-400" /> : <X size={20} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* NOVO: OPÇÃO DE DESLIGAMENTO (INATIVAÇÃO AUTOMÁTICA) */}
                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-black bg-orange-600`}>
                                    {assetType === 'Device' ? '3' : '2'}
                                </div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Fluxo de Desligamento</h3>
                             </div>
                             <button 
                                onClick={() => setInactivateAfterReturn(!inactivateAfterReturn)}
                                className={`w-full flex items-center gap-4 p-6 rounded-3xl border-2 transition-all text-left group
                                    ${inactivateAfterReturn ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-200'}`}
                             >
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-colors
                                    ${inactivateAfterReturn ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-red-400'}`}>
                                    <UserX size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className={`font-black uppercase text-xs tracking-widest ${inactivateAfterReturn ? 'text-red-700 dark:text-red-400' : 'text-slate-500'}`}>
                                            Marcar como Desligamento
                                        </span>
                                        {inactivateAfterReturn && <CheckSquare size={20} className="text-red-600" />}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-relaxed">
                                        Ao finalizar, o sistema inativará o cadastro do colaborador automaticamente após a devolução.
                                    </p>
                                </div>
                             </button>
                        </div>
                   </div>
              )}

              <div className="space-y-6">
                  <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-black ${activeTab === 'CHECKOUT' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                          {activeTab === 'CHECKOUT' ? (assetType === 'Device' ? '4' : '3') : (assetType === 'Device' ? '4' : '3')}
                      </div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Observações Adicionais</h3>
                  </div>
                  <textarea 
                    className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 text-sm focus:ring-4 focus:ring-slate-50 dark:focus:ring-slate-900/50 focus:border-slate-300 dark:focus:border-slate-700 outline-none transition-all shadow-inner bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600" 
                    rows={4} 
                    placeholder="Descreva aqui qualquer detalhe importante (ex: tela riscada, entrega via motoboy, etc)..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
              </div>

              <div className="pt-6 border-t dark:border-slate-800">
                  <button 
                    onClick={handleExecute}
                    disabled={isExecuting || !selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId)}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${activeTab === 'CHECKOUT' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-orange-600 text-white hover:bg-orange-700'} disabled:opacity-50 disabled:grayscale`}
                  >
                      {isExecuting ? <RefreshCw className="animate-spin" size={24}/> : (activeTab === 'CHECKOUT' ? <CheckCircle size={24}/> : <ArrowLeft size={24} className="rotate-180"/>)}
                      {isExecuting ? 'PROCESSANDO...' : (activeTab === 'CHECKOUT' ? 'FINALIZAR ENTREGA' : 'FINALIZAR DEVOLUÇÃO')}
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Operations;

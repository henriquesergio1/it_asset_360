
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { DeviceStatus, Device, SimCard, ReturnChecklist } from '../types';
import { ArrowRightLeft, CheckCircle, Smartphone, User as UserIcon, FileText, Printer, Search, ChevronDown, X, CheckSquare, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
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
                            placeholder="Filtrar..."
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
                            <div className="px-4 py-8 text-center text-gray-400 text-xs italic">Nenhum resultado.</div>
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

  // --- Ordenação A-Z nos Ativos do Dropdown ---
  const assetOptions: Option[] = (activeTab === 'CHECKOUT' 
    ? (assetType === 'Device' 
        ? availableDevices.map(d => ({ value: d.id, label: `${models.find(m => m.id === d.modelId)?.name || 'Ativo'} - ${d.assetTag}`, subLabel: `SN: ${d.serialNumber}` })) 
        : availableSims.map(s => ({ value: s.id, label: `${s.phoneNumber} - ${s.operator}`, subLabel: `ICCID: ${s.iccid}` })))
    : (assetType === 'Device' 
        ? inUseDevices.map(d => ({ value: d.id, label: `${models.find(m => m.id === d.modelId)?.name || 'Ativo'} - ${d.assetTag}`, subLabel: `Com: ${users.find(u => u.id === d.currentUserId)?.fullName || 'Doador'}` })) 
        : inUseSims.map(s => ({ value: s.id, label: `${s.phoneNumber} - ${s.operator}`, subLabel: `ICCID: ${s.iccid}` })))
  ).sort((a,b) => a.label.localeCompare(b.label));

  // --- Ordenação A-Z nos Usuários do Dropdown ---
  const userOptions: Option[] = users.filter(u => u.active).map(u => ({ value: u.id, label: u.fullName, subLabel: u.email }))
    .sort((a,b) => a.label.localeCompare(b.label));

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
            if (user && device) await updateDevice({ ...device, sectorId: user.sectorId, jobTitle: user.jobTitle }, adminName);
        }
        if (activeTab === 'CHECKOUT') await assignAsset(assetType, selectedAssetId, selectedUserId, notes, adminName);
        else await returnAsset(assetType, selectedAssetId, notes, adminName);
        setLastOperation({ userId: currentUserId, assetId: selectedAssetId, assetType: assetType, action: activeTab, checklistSnapshot: activeTab === 'CHECKIN' && assetType === 'Device' ? { ...checklist } : undefined, notes: notes });
        setIsProcessed(true);
    } catch (e) { alert('Erro: ' + (e as Error).message); } finally { setIsExecuting(false); }
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
      generateAndPrintTerm({ user, asset, settings, model, brand, type, linkedSim, actionType: lastOperation.action === 'CHECKOUT' ? 'ENTREGA' : 'DEVOLUCAO', sectorName: sectors.find(s => s.id === user.sectorId)?.name, checklist: lastOperation.checklistSnapshot, notes: lastOperation.notes });
  };

  const resetProcess = () => { setIsProcessed(false); setSelectedAssetId(''); setSelectedUserId(''); setNotes(''); setLastOperation(null); };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel de Operações</h1>
          <p className="text-gray-500 font-medium">Gestão centralizada (Listas A-Z).</p>
        </div>
        {isProcessed && <button onClick={resetProcess} className="flex items-center gap-2 text-sm text-blue-600 font-black hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"><ArrowLeft size={16}/> VOLTAR</button>}
      </div>
      {/* ... UI do formulário omitida para brevidade ... */}
    </div>
  );
};

export default Operations;

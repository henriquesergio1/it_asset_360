
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { DeviceStatus, Device, SimCard, ReturnChecklist } from '../types';
import { ArrowRightLeft, CheckCircle, Smartphone, User as UserIcon, FileText, Printer, Search, ChevronDown, X, CheckSquare, RefreshCw, AlertCircle } from 'lucide-react';
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
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
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
                className={`w-full p-3 border rounded-lg flex items-center justify-between cursor-pointer bg-white transition-all ${disabled ? 'bg-gray-100 text-gray-400' : 'hover:border-blue-400'} ${isOpen ? 'ring-2 ring-blue-100 border-blue-500' : 'border-gray-300'}`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <><span className="text-gray-900 font-medium truncate">{selectedOption.label}</span>{selectedOption.subLabel && <span className="text-xs text-gray-500 truncate">{selectedOption.subLabel}</span>}</>
                         ) : <span className="text-gray-500">{placeholder}</span>}
                    </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                    <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
                        <Search size={14} className="text-gray-400 ml-2" />
                        <input type="text" className="flex-1 bg-transparent outline-none text-sm" placeholder="Digite para filtrar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }} className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b last:border-0 ${value === opt.value ? 'bg-blue-50' : ''}`}>
                                <div className="font-medium text-gray-800 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-xs text-gray-500">{opt.subLabel}</div>}
                            </div>
                        )) : <div className="p-4 text-center text-sm text-gray-400">Sem resultados.</div>}
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
  const [syncAsset, setSyncAsset] = useState(true); // NOVO: Controle de sincronização
  const [successMsg, setSuccessMsg] = useState('');

  const handleExecute = async () => {
    const adminName = currentUser?.name || 'Sistema';
    
    // Lógica de Centralização (Sincronização)
    if (activeTab === 'CHECKOUT' && syncAsset && assetType === 'Device') {
        const user = users.find(u => u.id === selectedUserId);
        const dev = devices.find(d => d.id === selectedAssetId);
        if (user && dev) {
            await updateDevice({
                ...dev,
                sectorId: user.sectorId, // Celular assume o Cargo/Setor do Usuário
                costCenter: user.jobTitle // Celular assume o Cód Interno do Usuário
            }, adminName);
        }
    }

    if (activeTab === 'CHECKOUT') {
      assignAsset(assetType, selectedAssetId, selectedUserId, notes, adminName);
      setSuccessMsg(`Entrega realizada com sucesso!`);
    } else {
      returnAsset(assetType, selectedAssetId, notes, adminName);
      setSuccessMsg(`Devolução realizada com sucesso!`);
    }

    setSelectedAssetId(''); setSelectedUserId(''); setNotes('');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex p-1 bg-gray-200 rounded-lg w-full max-w-md">
        <button onClick={() => { setActiveTab('CHECKOUT'); setSelectedAssetId(''); }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${activeTab === 'CHECKOUT' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Entrega</button>
        <button onClick={() => { setActiveTab('CHECKIN'); setSelectedAssetId(''); }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${activeTab === 'CHECKIN' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>Devolução</button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border p-8 space-y-6">
          <div className="flex gap-4">
            <button onClick={() => setAssetType('Device')} className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${assetType === 'Device' ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}><Smartphone size={18} /> Dispositivo</button>
            <button onClick={() => setAssetType('Sim')} className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${assetType === 'Sim' ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}><ArrowRightLeft size={18} /> Chip / SIM</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Selecione o Ativo</label>
              <SearchableDropdown 
                  options={(activeTab === 'CHECKOUT' ? (assetType === 'Device' ? devices.filter(d => d.status === DeviceStatus.AVAILABLE) : sims.filter(s => s.status === DeviceStatus.AVAILABLE)) : (assetType === 'Device' ? devices.filter(d => d.status === DeviceStatus.IN_USE) : sims.filter(s => s.status === DeviceStatus.IN_USE))).map(a => ({
                      value: a.id,
                      label: (a as any).assetTag || (a as any).phoneNumber,
                      subLabel: (a as any).serialNumber || (a as any).operator
                  }))}
                  value={selectedAssetId} onChange={setSelectedAssetId} placeholder="Pesquisar..."
              />
            </div>

            <div className="space-y-4">
              {activeTab === 'CHECKOUT' && (
                <>
                  <label className="block text-sm font-medium text-gray-700">Selecione o Colaborador</label>
                  <SearchableDropdown 
                     options={users.filter(u => u.active).map(u => ({ value: u.id, label: u.fullName, subLabel: u.jobTitle }))}
                     value={selectedUserId} onChange={setSelectedUserId} placeholder="Pesquisar Colaborador..."
                  />
                  {selectedUserId && assetType === 'Device' && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-3">
                          <input type="checkbox" checked={syncAsset} onChange={e => setSyncAsset(e.target.checked)} className="mt-1" id="sync" />
                          <label htmlFor="sync" className="cursor-pointer">
                              <span className="block text-sm font-bold text-blue-900 flex items-center gap-1"><RefreshCw size={14}/> Sincronizar Cadastro</span>
                              <span className="text-xs text-blue-700">O celular assumirá automaticamente o Setor e Centro de Custo deste colaborador.</span>
                          </label>
                      </div>
                  )}
                </>
              )}
              {activeTab === 'CHECKIN' && selectedAssetId && (
                  <div className="p-4 bg-orange-50 text-orange-800 rounded-lg text-sm border border-orange-100">
                      Devolvendo de: <strong>{users.find(u => u.id === (assetType === 'Device' ? devices.find(d => d.id === selectedAssetId)?.currentUserId : sims.find(s => s.id === selectedAssetId)?.currentUserId))?.fullName}</strong>
                  </div>
              )}

              <textarea className="w-full p-3 border rounded-lg outline-none" rows={3} placeholder="Observações..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              
              <button onClick={handleExecute} disabled={!selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId)} className={`w-full py-3 rounded-lg font-bold text-white shadow-md ${!selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId) ? 'bg-gray-300' : activeTab === 'CHECKOUT' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                Confirmar {activeTab === 'CHECKOUT' ? 'Entrega' : 'Devolução'}
              </button>
              {successMsg && <div className="p-3 bg-green-100 text-green-700 rounded-lg font-bold flex items-center gap-2"><CheckCircle size={18}/> {successMsg}</div>}
            </div>
          </div>
      </div>
    </div>
  );
};

export default Operations;


import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { DeviceStatus, Device, SimCard, ReturnChecklist } from '../types';
import { ArrowRightLeft, CheckCircle, Smartphone, User as UserIcon, FileText, Printer, Search, ChevronDown, X, CheckSquare, RefreshCw, AlertCircle } from 'lucide-react';
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

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focar no input ao abrir
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
                    ${isOpen ? 'ring-2 ring-blue-100 border-blue-500' : 'border-gray-300'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <>
                                <span className="text-gray-900 font-medium truncate">{selectedOption.label}</span>
                                {selectedOption.subLabel && <span className="text-xs text-gray-500 truncate">{selectedOption.subLabel}</span>}
                             </>
                         ) : (
                             <span className="text-gray-500">{placeholder}</span>
                         )}
                    </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 sticky top-0">
                        <Search size={14} className="text-gray-400 ml-2" />
                        <input 
                            ref={inputRef}
                            type="text" 
                            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
                            placeholder="Digite para filtrar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-gray-400 hover:text-gray-600"/></button>}
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div 
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0
                                        ${value === opt.value ? 'bg-blue-50' : ''}
                                    `}
                                >
                                    <div className="font-medium text-gray-800 text-sm">{opt.label}</div>
                                    {opt.subLabel && <div className="text-xs text-gray-500">{opt.subLabel}</div>}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-gray-400">Nenhum resultado encontrado.</div>
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
  
  // Selection State
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [termFile, setTermFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // SYNC STATE (New)
  const [syncAssetData, setSyncAssetData] = useState(true);
  
  // Checkin Checklist State
  const [checklist, setChecklist] = useState<ReturnChecklist>({
      device: true,
      charger: true,
      cable: true,
      case: true,
      sim: false,
      manual: false
  });

  // State for last operation to enable printing
  const [lastOperation, setLastOperation] = useState<{
      userId: string;
      assetId: string;
      assetType: AssetType;
      action: OperationType;
      checklistSnapshot?: ReturnChecklist; // Store checklist for printing
      notes: string; // Add notes here
  } | null>(null);

  // Filtering for Select Options
  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE);
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE);
  
  const availableSims = sims.filter(s => s.status === DeviceStatus.AVAILABLE);
  const inUseSims = sims.filter(s => s.status === DeviceStatus.IN_USE);

  // Reset Checklist Logic when asset changes
  useEffect(() => {
      if (activeTab === 'CHECKIN' && assetType === 'Device' && selectedAssetId) {
          const dev = devices.find(d => d.id === selectedAssetId);
          setChecklist({
              device: true,
              charger: true,
              cable: true,
              case: true,
              sim: !!dev?.linkedSimId, // Auto-check if linked SIM exists
              manual: false
          });
      }
  }, [selectedAssetId, activeTab, assetType, devices]);

  // --- Prepare Options for Dropdowns ---
  
  const assetOptions: Option[] = activeTab === 'CHECKOUT' 
    ? (assetType === 'Device' 
        ? availableDevices.map(d => ({
            value: d.id,
            label: `${models.find(m => m.id === d.modelId)?.name || 'Desconhecido'} - ${d.assetTag}`,
            subLabel: `SN: ${d.serialNumber} ${d.imei ? `| IMEI: ${d.imei}` : ''}`
          })) 
        : availableSims.map(s => ({
            value: s.id,
            label: `${s.phoneNumber} - ${s.operator}`,
            subLabel: `ICCID: ${s.iccid}`
          }))
      )
    : (assetType === 'Device' 
        ? inUseDevices.map(d => ({
            value: d.id,
            label: `${models.find(m => m.id === d.modelId)?.name || 'Desconhecido'} - ${d.assetTag}`,
            subLabel: `Com: ${users.find(u => u.id === d.currentUserId)?.fullName || 'Desconhecido'}`
          })) 
        : inUseSims.map(s => ({
            value: s.id,
            label: `${s.phoneNumber} - ${s.operator}`,
            subLabel: `Com: ${users.find(u => u.id === s.currentUserId)?.fullName || 'Desconhecido'}`
          }))
      );

  const userOptions: Option[] = users.filter(u => u.active).map(u => {
      const s = sectors.find(sec => sec.id === u.sectorId);
      return {
          value: u.id,
          label: u.fullName,
          subLabel: `${s?.name || 'Sem Setor'} | ${u.email}`
      };
  });


  const handleExecute = async () => {
    const adminName = currentUser?.name || 'Unknown';
    
    // Store data for printing before clearing inputs
    let currentUserId = selectedUserId;
    if (activeTab === 'CHECKIN') {
        if (assetType === 'Device') {
            currentUserId = devices.find(d => d.id === selectedAssetId)?.currentUserId || '';
        } else {
            currentUserId = sims.find(s => s.id === selectedAssetId)?.currentUserId || '';
        }
    }

    // --- LOGIC FOR DATA SYNC (The "Centralization") ---
    if (activeTab === 'CHECKOUT' && syncAssetData && assetType === 'Device') {
        const user = users.find(u => u.id === selectedUserId);
        const device = devices.find(d => d.id === selectedAssetId);
        
        if (user && device) {
            const updatedDevice: Device = {
                ...device,
                sectorId: user.sectorId, // Atualiza Setor do Equipamento (Ex: Vendas)
                costCenter: user.jobTitle // Atualiza Cód. Interno (Ex: CC-101)
            };
            // Executa update (em background ou await se a api permitir)
            // No DataContext Mock/Prod, isso é síncrono ou async rápido
            await updateDevice(updatedDevice, adminName);
        }
    }
    // --------------------------------------------------

    if (activeTab === 'CHECKOUT') {
      assignAsset(assetType, selectedAssetId, selectedUserId, notes, adminName, termFile || undefined);
      setSuccessMsg(`Ativo vinculado com sucesso!`);
    } else {
      returnAsset(assetType, selectedAssetId, notes, adminName, termFile || undefined);
      setSuccessMsg(`Ativo devolvido com sucesso!`);
    }

    setLastOperation({
        userId: currentUserId,
        assetId: selectedAssetId,
        assetType: assetType,
        action: activeTab,
        checklistSnapshot: activeTab === 'CHECKIN' && assetType === 'Device' ? { ...checklist } : undefined,
        notes: notes
    });

    // Reset Form
    setSelectedAssetId('');
    setSelectedUserId('');
    setNotes('');
    setTermFile(null);
    setSyncAssetData(true); // Reset to default
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handlePrintLastTerm = () => {
      if (!lastOperation) return;
      
      const user = users.find(u => u.id === lastOperation.userId);
      const asset = lastOperation.assetType === 'Device' 
          ? devices.find(d => d.id === lastOperation.assetId) 
          : sims.find(s => s.id === lastOperation.assetId);
      
      if (!user || !asset) {
          alert('Erro ao recuperar dados para impressão.');
          return;
      }

      let model, brand, type;
      let linkedSim: SimCard | undefined;

      if (lastOperation.assetType === 'Device') {
          const d = asset as Device;
          model = models.find(m => m.id === d.modelId);
          brand = brands.find(b => b.id === model?.brandId);
          type = assetTypes.find(t => t.id === model?.typeId);
          
          // Check for linked SIM
          if (d.linkedSimId) {
              linkedSim = sims.find(s => s.id === d.linkedSimId);
          }
      }

      const sectorName = sectors.find(s => s.id === user.sectorId)?.name;

      generateAndPrintTerm({
          user,
          asset,
          settings,
          model,
          brand,
          type,
          actionType: lastOperation.action === 'CHECKOUT' ? 'ENTREGA' : 'DEVOLUCAO',
          linkedSim,
          sectorName,
          checklist: lastOperation.checklistSnapshot,
          notes: lastOperation.notes
      });
  };

  // Helper to show what will be synced
  const getSyncPreview = () => {
      if (!selectedUserId) return null;
      const u = users.find(x => x.id === selectedUserId);
      const s = sectors.find(x => x.id === u?.sectorId);
      if (!u) return null;
      return (
          <div className="text-xs text-blue-600 mt-2 pl-7">
              <p>O ativo assumirá:</p>
              <ul className="list-disc pl-4">
                  <li>Setor: <strong>{s?.name || 'N/A'}</strong></li>
                  <li>Centro Custo: <strong>{u.jobTitle || 'N/A'}</strong></li>
              </ul>
          </div>
      );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Operações</h1>
        <p className="text-gray-500">Realize a entrega ou devolução de equipamentos.</p>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-200 rounded-lg w-full max-w-md">
        <button 
          onClick={() => { setActiveTab('CHECKOUT'); setSelectedAssetId(''); setSelectedUserId(''); setLastOperation(null); }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'CHECKOUT' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Entrega (Vincular)
        </button>
        <button 
          onClick={() => { setActiveTab('CHECKIN'); setSelectedAssetId(''); setSelectedUserId(''); setLastOperation(null); }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'CHECKIN' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Devolução (Retornar)
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-8 space-y-6">
          
          {/* Asset Type Selector */}
          <div className="flex gap-4 mb-6">
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${assetType === 'Device' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="atype" checked={assetType === 'Device'} onChange={() => { setAssetType('Device'); setSelectedAssetId(''); }} className="hidden" />
              <Smartphone size={18} /> Dispositivo
            </label>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${assetType === 'Sim' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="atype" checked={assetType === 'Sim'} onChange={() => { setAssetType('Sim'); setSelectedAssetId(''); }} className="hidden" />
              <ArrowRightLeft size={18} /> Chip / SIM
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Side: Asset Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                {activeTab === 'CHECKOUT' ? 'Selecione o Ativo Disponível' : 'Selecione o Ativo em Uso'}
              </label>
              
              <SearchableDropdown 
                  options={assetOptions}
                  value={selectedAssetId}
                  onChange={setSelectedAssetId}
                  placeholder="Pesquisar Ativo (Tag, Modelo, Chip...)"
                  icon={assetType === 'Device' ? <Smartphone size={18}/> : <ArrowRightLeft size={18}/>}
              />

              {/* Asset Preview Details */}
              {selectedAssetId && (
                <div className="p-4 bg-gray-50 rounded-lg text-sm space-y-2 border border-gray-200 animate-fade-in">
                  <p className="font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-2">Detalhes Selecionados:</p>
                  {assetType === 'Device' ? (() => {
                    const d = devices.find(x => x.id === selectedAssetId);
                    const m = d ? models.find(mod => mod.id === d.modelId) : null;
                    const sec = sectors.find(s => s.id === d?.sectorId);
                    return d ? (
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Modelo:</span> <span className="font-medium">{m?.name || 'Desconhecido'}</span></p>
                        <p><span className="text-gray-500">Serial:</span> {d.serialNumber}</p>
                        <p><span className="text-gray-500">Tag:</span> {d.assetTag}</p>
                        <p><span className="text-gray-500">Setor Atual:</span> {sec?.name || '-'} ({d.costCenter || 'S/ Cód'})</p>
                        {d.imei && <p><span className="text-gray-500">IMEI:</span> {d.imei}</p>}
                      </div>
                    ) : null;
                  })() : (() => {
                    const s = sims.find(x => x.id === selectedAssetId);
                    return s ? (
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Operadora:</span> <span className="font-medium">{s.operator}</span></p>
                        <p><span className="text-gray-500">Número:</span> {s.phoneNumber}</p>
                        <p><span className="text-gray-500">ICCID:</span> {s.iccid}</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            {/* Right Side: User & Action */}
            <div className="space-y-4">
              {activeTab === 'CHECKOUT' && (
                <>
                  <label className="block text-sm font-medium text-gray-700">Selecione o Usuário Destino</label>
                  <SearchableDropdown 
                     options={userOptions}
                     value={selectedUserId}
                     onChange={setSelectedUserId}
                     placeholder="Pesquisar Colaborador (Nome, Email...)"
                     icon={<UserIcon size={18}/>}
                  />

                  {/* SYNC CHECKBOX (CENTRALIZATION LOGIC) */}
                  {selectedUserId && assetType === 'Device' && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 animate-fade-in">
                          <label className="flex items-start gap-3 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={syncAssetData} 
                                onChange={e => setSyncAssetData(e.target.checked)}
                                className="mt-1 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <div>
                                  <span className="block text-sm font-bold text-gray-800 flex items-center gap-2">
                                      <RefreshCw size={14}/> Sincronizar Cadastro do Ativo
                                  </span>
                                  <span className="block text-xs text-gray-600 mt-1">
                                      Atualiza o Setor e Centro de Custo do equipamento para igualar ao do colaborador.
                                  </span>
                                  {syncAssetData && getSyncPreview()}
                                  {!syncAssetData && (
                                      <div className="mt-2 flex items-start gap-1 text-xs text-orange-700 bg-orange-50 p-1.5 rounded border border-orange-100">
                                          <AlertCircle size={12} className="mt-0.5 shrink-0"/>
                                          <span>Modo Empréstimo/Férias: O ativo manterá seu setor original, mas ficará em posse deste usuário.</span>
                                      </div>
                                  )}
                              </div>
                          </label>
                      </div>
                  )}
                </>
              )}

              {activeTab === 'CHECKIN' && selectedAssetId && (
                 <>
                     <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100 flex items-center gap-2">
                       <UserIcon size={16}/>
                       <span>Devolvendo de: <strong>{users.find(u => u.id === (assetType === 'Device' ? devices.find(d => d.id === selectedAssetId)?.currentUserId : sims.find(s => s.id === selectedAssetId)?.currentUserId))?.fullName}</strong></span>
                     </div>
                     
                     {/* CHECKLIST for Device Returns */}
                     {assetType === 'Device' && (
                          <div className="space-y-3 bg-orange-50 p-4 rounded-lg border border-orange-100">
                              <label className="block text-sm font-bold text-orange-800 flex items-center gap-2">
                                  <CheckSquare size={16}/> Checklist de Devolução
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={checklist.device} onChange={e => setChecklist({...checklist, device: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500"/>
                                      <span className="text-sm">Aparelho</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={checklist.charger} onChange={e => setChecklist({...checklist, charger: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500"/>
                                      <span className="text-sm">Carregador</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={checklist.cable} onChange={e => setChecklist({...checklist, cable: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500"/>
                                      <span className="text-sm">Cabo</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={checklist.case} onChange={e => setChecklist({...checklist, case: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500"/>
                                      <span className="text-sm">Capa</span>
                                  </label>
                                  {devices.find(d => d.id === selectedAssetId)?.linkedSimId && (
                                     <label className="flex items-center gap-2 cursor-pointer col-span-2">
                                         <input type="checkbox" checked={checklist.sim} onChange={e => setChecklist({...checklist, sim: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500"/>
                                         <span className="text-sm font-bold text-blue-600">Chip Vinculado</span>
                                     </label>
                                  )}
                              </div>
                          </div>
                     )}
                 </>
              )}

              {/* Terms of Responsibility Upload */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Termo Assinado (Upload Opcional)</label>
                  <label className="flex items-center gap-2 p-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <FileText className="text-gray-400" />
                      <span className="text-sm text-gray-600">{termFile ? termFile.name : `Anexar Arquivo (PDF/Img)`}</span>
                      <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setTermFile(e.target.files?.[0] || null)} />
                  </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  placeholder="Ex: Entregue com carregador, mochila..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button 
                onClick={handleExecute}
                disabled={!selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId)}
                className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all flex justify-center items-center gap-2
                  ${!selectedAssetId || (activeTab === 'CHECKOUT' && !selectedUserId) 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : activeTab === 'CHECKOUT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              >
                {activeTab === 'CHECKOUT' ? 'Confirmar Entrega' : 'Confirmar Devolução'}
              </button>

              {successMsg && (
                <div className="flex flex-col gap-2 bg-green-50 p-3 rounded-lg animate-fade-in border border-green-200">
                  <div className="flex items-center gap-2 text-green-600">
                     <CheckCircle size={20} />
                     <span className="font-bold">{successMsg}</span>
                  </div>
                  {lastOperation && (
                      <button onClick={handlePrintLastTerm} className="text-sm text-blue-700 hover:underline flex items-center gap-1 mt-1 font-medium pl-7">
                          <Printer size={14}/> Imprimir Termo de {lastOperation.action === 'CHECKOUT' ? 'Entrega' : 'Devolução'}
                      </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Operations;

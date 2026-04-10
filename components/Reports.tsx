import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileText, Search, Printer, Download, Eye, EyeOff, Phone, Mail, Briefcase, User, ArrowUpDown, ShieldCheck, SlidersHorizontal, Check, X, Filter, FileSpreadsheet, Package, Cpu, Smartphone, Tag } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { normalizeString } from '../utils/stringUtils';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';

const Reports = () => {
  const { users, sectors, sims, devices, models, assetTypes, brands, consumableTransactions } = useData();
  const [activeTab, setActiveTab] = useState<'USERS' | 'CONSUMABLES' | 'ASSETS'>('USERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [showOnlyWithLine, setShowOnlyWithLine] = useState(false);
  const [showVagos, setShowVagos] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'sector' | 'sectorCode' | 'pulsusId', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const [visibleColumns, setVisibleColumns] = useState<string[]>(['sector', 'sectorCode', 'email', 'lines', 'pulsusId']);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>([]);
  const [hasInitializedAssetTypes, setHasInitializedAssetTypes] = useState(false);
  const [isAssetTypeSelectorOpen, setIsAssetTypeSelectorOpen] = useState(false);
  const assetTypeRef = useRef<HTMLDivElement>(null);

  const [isSectorSelectorOpen, setIsSectorSelectorOpen] = useState(false);
  const sectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (assetTypes.length > 0 && !hasInitializedAssetTypes) {
      const defaultTypes = assetTypes
        .filter(t => t.name.toLowerCase().includes('smartphone') || t.name.toLowerCase().includes('celular'))
        .map(t => t.id);
      setSelectedAssetTypes(defaultTypes);
      setHasInitializedAssetTypes(true);
    }
  }, [assetTypes, hasInitializedAssetTypes]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
      if (assetTypeRef.current && !assetTypeRef.current.contains(e.target as Node)) setIsAssetTypeSelectorOpen(false);
      if (sectorRef.current && !sectorRef.current.contains(e.target as Node)) setIsSectorSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleAssetType = (id: string) => {
    setSelectedAssetTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const toggleSector = (id: string) => {
    setSelectedSectors(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const COLUMN_OPTIONS = [
    { id: 'sector', label: 'Cargo / Setor' },
    { id: 'sectorCode', label: 'Cód. Setor' },
    { id: 'email', label: 'E-mail' },
    { id: 'lines', label: 'Linha(s)' },
    { id: 'pulsusId', label: 'ID Pulsus' }
  ];

  const requestSort = (key: 'name' | 'sector' | 'sectorCode' | 'pulsusId') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const reportData = useMemo(() => {
    const extractSectorFromEmail = (email: string) => {
      if (!email) return null;
      const match = email.match(/\d+/);
      return match ? match[0] : null;
    };

    const usersMap = new Map(users.filter(u => u.active).map(u => [u.id, {
      ...u,
      expectedSectorCode: extractSectorFromEmail(u.email),
      assignedSims: [] as any[],
      assignedSectorCodes: new Set<string>(),
      assignedPulsusIds: new Set<string>(),
      hasMatchingDeviceOrDirectSim: false
    }]));

    const unassignedItems: any[] = [];

    devices.forEach(device => {
      const model = models.find(m => m.id === device.modelId);
      const isSelectedType = model && selectedAssetTypes.includes(model.typeId);

      if (device.currentUserId && isSelectedType) {
        const user = usersMap.get(device.currentUserId);
        if (user) {
          user.hasMatchingDeviceOrDirectSim = true;
          const userDevices = devices.filter(d => {
            const dModel = models.find(m => m.id === d.modelId);
            return d.currentUserId === user.id && dModel && selectedAssetTypes.includes(dModel.typeId);
          });
          const uniqueDeviceCodes = new Set(userDevices.map(d => d.internalCode).filter(Boolean));
          
          let isVago = false;
          if (uniqueDeviceCodes.size > 1 && user.expectedSectorCode) {
            if (device.internalCode && !device.internalCode.includes(user.expectedSectorCode)) {
              isVago = true;
            }
          }
          
          if (!isVago) {
            if (device.internalCode) user.assignedSectorCodes.add(device.internalCode);
            if (device.pulsusId) user.assignedPulsusIds.add(device.pulsusId);
          }
        }
      }
    });

    sims.forEach(sim => {
      const linkedDevice = devices.find(d => d.linkedSimId === sim.id);
      
      if (linkedDevice) {
        const model = models.find(m => m.id === linkedDevice.modelId);
        const isSelectedType = model && selectedAssetTypes.includes(model.typeId);
        
        if (!isSelectedType) return;

        const deviceSectorCode = linkedDevice.internalCode || '';
        const devicePulsusId = linkedDevice.pulsusId || '';
        
        if (linkedDevice.currentUserId) {
          const user = usersMap.get(linkedDevice.currentUserId);
          if (user) {
            user.hasMatchingDeviceOrDirectSim = true;
            const userDevices = devices.filter(d => {
              const dModel = models.find(m => m.id === d.modelId);
              return d.currentUserId === user.id && dModel && selectedAssetTypes.includes(dModel.typeId);
            });
            const uniqueDeviceCodes = new Set(userDevices.map(d => d.internalCode).filter(Boolean));
            
            if (uniqueDeviceCodes.size > 1 && user.expectedSectorCode) {
              if (deviceSectorCode && deviceSectorCode.includes(user.expectedSectorCode)) {
                user.assignedSims.push(sim);
              } else {
                unassignedItems.push({
                  id: `vago-${sim.id}`,
                  fullName: 'Vago (Sem Colaborador)',
                  sectorName: 'Dispositivo sem usuário correspondente',
                  sectorCode: deviceSectorCode || '-',
                  pulsusId: devicePulsusId || '-',
                  sectorId: linkedDevice.sectorId,
                  email: '-',
                  lines: sim.phoneNumber,
                  hasLine: true,
                  isVago: true
                });
              }
            } else {
              user.assignedSims.push(sim);
            }
          } else {
            unassignedItems.push({
              id: `vago-${sim.id}`,
              fullName: 'Vago (Usuário não encontrado)',
              sectorName: '-',
              sectorCode: deviceSectorCode || '-',
              pulsusId: devicePulsusId || '-',
              sectorId: linkedDevice.sectorId,
              email: '-',
              lines: sim.phoneNumber,
              hasLine: true,
              isVago: true
            });
          }
        } else {
          unassignedItems.push({
            id: `vago-${sim.id}`,
            fullName: 'Vago (Dispositivo em Estoque)',
            sectorName: '-',
            sectorCode: deviceSectorCode || '-',
            pulsusId: devicePulsusId || '-',
            sectorId: linkedDevice.sectorId,
            email: '-',
            lines: sim.phoneNumber,
            hasLine: true,
            isVago: true
          });
        }
      } else if (sim.currentUserId) {
        const user = usersMap.get(sim.currentUserId);
        if (user) {
          user.hasMatchingDeviceOrDirectSim = true;
          user.assignedSims.push(sim);
        } else {
          unassignedItems.push({
            id: `vago-${sim.id}`,
            fullName: 'Vago (Chip avulso - Usuário não encontrado)',
            sectorName: '-',
            sectorCode: '-',
            pulsusId: '-',
            sectorId: null,
            email: '-',
            lines: sim.phoneNumber,
            hasLine: true,
            isVago: true
          });
        }
      }
    });

    const formattedUsers = Array.from(usersMap.values())
      .filter(user => user.hasMatchingDeviceOrDirectSim)
      .map(user => {
        const sector = sectors.find(s => s.id === user.sectorId);
        const uniqueSims = user.assignedSims.filter((sim, index, self) => 
          index === self.findIndex((t) => t.id === sim.id)
        );

        return {
          ...user,
          sectorName: sector?.name || 'Não definido',
          sectorCode: Array.from(user.assignedSectorCodes).join(', ') || '-',
          pulsusId: Array.from(user.assignedPulsusIds).join(', ') || '-',
          lines: uniqueSims.map(s => s.phoneNumber).join(', ') || 'Sem linha',
          hasLine: uniqueSims.length > 0,
          isVago: false
        };
      });

    const allData = [...formattedUsers, ...unassignedItems];

    return allData.filter(item => {
      if (showOnlyWithLine && !item.hasLine) return false;
      if (!showVagos && item.isVago) return false;
      if (selectedSectors.length > 0 && (!item.sectorId || !selectedSectors.includes(item.sectorId))) return false;
      
      if (searchTerm) {
        const term = normalizeString(searchTerm);
        return normalizeString(item.fullName).includes(term) || 
               normalizeString(item.lines).includes(term) ||
               normalizeString(item.email).includes(term) ||
               normalizeString(item.sectorCode).includes(term) ||
               normalizeString(item.pulsusId).includes(term);
      }
      return true;
    }).sort((a, b) => {
      if (sortConfig.key === 'name') {
        if (a.isVago && !b.isVago) return 1;
        if (!a.isVago && b.isVago) return -1;
        
        return sortConfig.direction === 'asc' 
          ? a.fullName.localeCompare(b.fullName)
          : b.fullName.localeCompare(a.fullName);
      }
      if (sortConfig.key === 'sector') {
        return sortConfig.direction === 'asc' 
          ? a.sectorName.localeCompare(b.sectorName)
          : b.sectorName.localeCompare(a.sectorName);
      }
      if (sortConfig.key === 'sectorCode') {
        return sortConfig.direction === 'asc' 
          ? a.sectorCode.localeCompare(b.sectorCode)
          : b.sectorCode.localeCompare(a.sectorCode);
      }
      if (sortConfig.key === 'pulsusId') {
        return sortConfig.direction === 'asc' 
          ? a.pulsusId.localeCompare(b.pulsusId)
          : b.pulsusId.localeCompare(a.pulsusId);
      }
      return 0;
    });
  }, [users, sectors, sims, devices, models, selectedAssetTypes, searchTerm, selectedSectors, showOnlyWithLine, showVagos, sortConfig]);

  const consumablesReportData = useMemo(() => {
    if (!consumableTransactions) return [];
    const searchNormalized = normalizeString(searchTerm);
    return consumableTransactions.filter(t => 
      normalizeString(t.consumableName || '').includes(searchNormalized) ||
      normalizeString(t.adminUser || '').includes(searchNormalized) ||
      normalizeString(t.notes || '').includes(searchNormalized)
    );
  }, [consumableTransactions, searchTerm]);

  const assetsSummaryData = useMemo(() => {
    const summary: Record<string, { type: string, brand: string, model: string, count: number }> = {};
    
    devices.forEach(d => {
      const model = models.find(m => m.id === d.modelId);
      if (!model) return;
      const brand = brands.find(b => b.id === model.brandId);
      const type = assetTypes.find(t => t.id === model.typeId);
      
      const key = `${type?.name || 'Outros'}-${brand?.name || 'Outros'}-${model.name}`;
      if (!summary[key]) {
        summary[key] = {
          type: type?.name || 'Outros',
          brand: brand?.name || 'Outros',
          model: model.name,
          count: 0
        };
      }
      summary[key].count++;
    });

    const searchNormalized = normalizeString(searchTerm);
    return Object.values(summary).filter(item => 
      normalizeString(item.type).includes(searchNormalized) ||
      normalizeString(item.brand).includes(searchNormalized) ||
      normalizeString(item.model).includes(searchNormalized)
    ).sort((a, b) => a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  }, [devices, models, brands, assetTypes, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    let headers: string[] = [];
    let data: any[] = [];
    let fileName = '';
    let pdfTitle = '';

    if (activeTab === 'USERS') {
      headers = ['Nome'];
      if (visibleColumns.includes('sector')) headers.push('Cargo / Setor');
      if (visibleColumns.includes('sectorCode')) headers.push('Cód. Setor');
      if (visibleColumns.includes('email')) headers.push('E-mail');
      if (visibleColumns.includes('lines')) headers.push('Linha(s)');
      if (visibleColumns.includes('pulsusId')) headers.push('ID Pulsus');
      
      data = reportData.map(item => {
        const row: any = { 'Nome': item.fullName };
        if (visibleColumns.includes('sector')) row['Cargo / Setor'] = item.sectorName;
        if (visibleColumns.includes('sectorCode')) row['Cód. Setor'] = item.sectorCode;
        if (visibleColumns.includes('email')) row['E-mail'] = item.email;
        if (visibleColumns.includes('lines')) row['Linha(s)'] = item.lines;
        if (visibleColumns.includes('pulsusId')) row['ID Pulsus'] = item.pulsusId;
        return row;
      });
      fileName = `relatorio_colaboradores_${new Date().toISOString().split('T')[0]}`;
      pdfTitle = 'Relatório de Colaboradores';
    } else if (activeTab === 'CONSUMABLES') {
      headers = ['Data', 'Item', 'Tipo', 'Quantidade', 'Usuário', 'Notas'];
      data = consumablesReportData.map(t => ({
        'Data': new Date(t.date).toLocaleString('pt-BR'),
        'Item': t.consumableName,
        'Tipo': t.type === 'IN' ? 'Entrada' : 'Saída',
        'Quantidade': t.quantity,
        'Usuário': t.adminUser,
        'Notas': t.notes || ''
      }));
      fileName = `historico_consumo_${new Date().toISOString().split('T')[0]}`;
      pdfTitle = 'Histórico de Consumo de Insumos';
    } else if (activeTab === 'ASSETS') {
      headers = ['Tipo', 'Marca', 'Modelo', 'Quantidade'];
      data = assetsSummaryData.map(item => ({
        'Tipo': item.type,
        'Marca': item.brand,
        'Modelo': item.model,
        'Quantidade': item.count
      }));
      fileName = `resumo_ativos_${new Date().toISOString().split('T')[0]}`;
      pdfTitle = 'Resumo de Ativos por Modelo';
    }

    if (format === 'csv') {
      exportToCSV(data, fileName);
    } else if (format === 'excel') {
      exportToExcel(data, fileName);
    } else if (format === 'pdf') {
      const pdfHeaders = headers;
      const pdfRows = data.map(item => headers.map(h => item[h]));
      exportToPDF(pdfHeaders, pdfRows, fileName, pdfTitle);
    }
  };

  return (
    <>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="text-blue-400"/>
              Relatórios
            </h1>
            <p className="text-sm mt-1">
              Emissão e exportação de relatórios do sistema
            </p>
          </div>
          
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'USERS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              <User size={16} />
              Colaboradores
            </button>
            <button
              onClick={() => setActiveTab('CONSUMABLES')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'CONSUMABLES' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              <Package size={16} />
              Consumo
            </button>
            <button
              onClick={() => setActiveTab('ASSETS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ASSETS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              <Smartphone size={16} />
              Ativos
            </button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800 bg-slate-50/50 bg-slate-800/20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  {activeTab === 'USERS' && 'Relatório de Colaboradores'}
                  {activeTab === 'CONSUMABLES' && 'Histórico de Consumo de Insumos'}
                  {activeTab === 'ASSETS' && 'Resumo de Ativos por Modelo'}
                </h2>
                <p className="text-xs mt-1">
                  {activeTab === 'USERS' && 'Relação personalizável de colaboradores, linhas telefônicas e dispositivos.'}
                  {activeTab === 'CONSUMABLES' && 'Histórico detalhado de entradas e saídas de itens consumíveis.'}
                  {activeTab === 'ASSETS' && 'Contagem total de ativos agrupados por tipo, marca e modelo.'}
                </p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                {activeTab === 'USERS' && (
                  <>
                    <div className="relative" ref={assetTypeRef}>
                      <button onClick={() => setIsAssetTypeSelectorOpen(!isAssetTypeSelectorOpen)} className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-800 font-bold text-sm transition-all">
                        <Filter size={16} /> <span className="hidden md:inline">Tipos de Dispositivo</span>
                      </button>
                      {isAssetTypeSelectorOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl z-[80] overflow-hidden animate-fade-in">
                          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase">Filtrar por Tipo</span>
                            <button onClick={() => setIsAssetTypeSelectorOpen(false)} className="hover:text-slate-600"><X size={14}/></button>
                          </div>
                          <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                            {assetTypes.map(type => (
                              <button key={type.id} onClick={() => toggleAssetType(type.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${selectedAssetTypes.includes(type.id) ? ' bg-blue-900/30 text-blue-400' : ' hover:bg-slate-700'}`}>
                                {type.name}
                                {selectedAssetTypes.includes(type.id) && <Check size={14}/>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative" ref={columnRef}>
                      <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-800 font-bold text-sm transition-all">
                        <SlidersHorizontal size={16} /> <span className="hidden md:inline">Colunas</span>
                      </button>
                      {isColumnSelectorOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl z-[80] overflow-hidden animate-fade-in">
                          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase">Exibir Colunas</span>
                            <button onClick={() => setIsColumnSelectorOpen(false)} className="hover:text-slate-600"><X size={14}/></button>
                          </div>
                          <div className="p-2 space-y-1">
                            {COLUMN_OPTIONS.map(col => (
                              <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? ' bg-blue-900/30 text-blue-400' : ' hover:bg-slate-700'}`}>
                                {col.label}
                                {visibleColumns.includes(col.id) && <Check size={14}/>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="flex bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <button 
                    onClick={() => handleExport('csv')} 
                    className="p-2.5 hover:bg-slate-800 border-r border-slate-800 transition-colors"
                    title="Exportar CSV"
                  >
                    <FileText size={18}/>
                  </button>
                  <button 
                    onClick={() => handleExport('excel')} 
                    className="p-2.5 hover:bg-slate-800 border-r border-slate-800 transition-colors"
                    title="Exportar Excel"
                  >
                    <FileSpreadsheet size={18}/>
                  </button>
                  <button 
                    onClick={() => handleExport('pdf')} 
                    className="p-2.5 hover:bg-slate-800 transition-colors"
                    title="Exportar PDF"
                  >
                    <Download size={18}/>
                  </button>
                </div>
                <button 
                  onClick={handlePrint}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
                >
                  <Printer size={16} />
                  <span className="hidden md:inline">Imprimir</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`relative ${activeTab === 'USERS' ? 'md:col-span-2' : 'md:col-span-4'}`}>
                <Search className="absolute left-3 top-3" size={18} />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'USERS' ? "Buscar por nome, e-mail, linha ou ID Pulsus..." :
                    activeTab === 'CONSUMABLES' ? "Buscar por item, usuário ou notas..." :
                    "Buscar por tipo, marca ou modelo..."
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {activeTab === 'USERS' && (
                <>
                  <div className="relative" ref={sectorRef}>
                    <button 
                      onClick={() => setIsSectorSelectorOpen(!isSectorSelectorOpen)} 
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 transition-all font-medium"
                    >
                      <span className="truncate">
                        {selectedSectors.length === 0 
                          ? 'Todos os Cargos / Setores' 
                          : `${selectedSectors.length} selecionado(s)`}
                      </span>
                      <SlidersHorizontal size={16} className=""/>
                    </button>
                    
                    {isSectorSelectorOpen && (
                      <div className="absolute left-0 mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl z-[80] overflow-hidden animate-fade-in">
                        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase">Filtrar por Setor</span>
                          <button onClick={() => setIsSectorSelectorOpen(false)} className="hover:text-slate-600"><X size={14}/></button>
                        </div>
                        <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                          {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                            <button 
                              key={s.id} 
                              onClick={() => toggleSector(s.id)} 
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${selectedSectors.includes(s.id) ? ' bg-blue-900/30 text-blue-400' : ' hover:bg-slate-700'}`}
                            >
                              <span className="truncate text-left">{s.name}</span>
                              {selectedSectors.includes(s.id) && <Check size={14} className="flex-shrink-0 ml-2"/>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col justify-center gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded focus:ring-emerald-500 border-slate-600 bg-slate-700"
                          checked={showOnlyWithLine} 
                          onChange={(e) => setShowOnlyWithLine(e.target.checked)} 
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Com linha
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded focus:ring-amber-500 border-slate-600 bg-slate-700"
                          checked={showVagos} 
                          onChange={(e) => setShowVagos(e.target.checked)} 
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Vagos
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            {activeTab === 'USERS' && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('name')}>
                      <div className="flex items-center gap-2">
                        Colaborador
                        <ArrowUpDown size={12} className={sortConfig.key === 'name' ? '' : 'text-slate-300'} />
                      </div>
                    </th>
                    {visibleColumns.includes('sector') && (
                      <th className="px-6 py-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('sector')}>
                        <div className="flex items-center gap-2">
                          Cargo / Setor
                          <ArrowUpDown size={12} className={sortConfig.key === 'sector' ? '' : 'text-slate-300'} />
                        </div>
                      </th>
                    )}
                    {visibleColumns.includes('sectorCode') && (
                      <th className="px-6 py-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('sectorCode')}>
                        <div className="flex items-center gap-2">
                          Cód. Setor
                          <ArrowUpDown size={12} className={sortConfig.key === 'sectorCode' ? '' : 'text-slate-300'} />
                        </div>
                      </th>
                    )}
                    {visibleColumns.includes('email') && <th className="px-6 py-4">E-mail</th>}
                    {visibleColumns.includes('lines') && <th className="px-6 py-4">Linha(s)</th>}
                    {visibleColumns.includes('pulsusId') && (
                      <th className="px-6 py-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('pulsusId')}>
                        <div className="flex items-center gap-2">
                          ID Pulsus
                          <ArrowUpDown size={12} className={sortConfig.key === 'pulsusId' ? '' : 'text-slate-300'} />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {reportData.length > 0 ? (
                    reportData.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                              {item.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-100">{item.fullName}</span>
                          </div>
                        </td>
                        {visibleColumns.includes('sector') && (
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-medium">
                              <Briefcase size={12} className=""/>
                              {item.sectorName}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes('sectorCode') && (
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-bold">
                              {item.sectorCode}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes('email') && (
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-2 text-xs">
                              <Mail size={14} className=""/>
                              {item.email}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes('lines') && (
                          <td className="px-6 py-4">
                            <span className={`flex items-center gap-2 text-xs font-bold ${item.hasLine ? ' text-emerald-400' : ''}`}>
                              <Phone size={14} className={item.hasLine ? '' : 'text-slate-300'} />
                              {item.lines}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes('pulsusId') && (
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-400">
                              <ShieldCheck size={14} className="text-indigo-400"/>
                              {item.pulsusId}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={1 + visibleColumns.length} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <User size={48} className="mb-4 text-slate-300"/>
                          <p className="text-sm font-bold">Nenhum contato encontrado</p>
                          <p className="text-xs mt-1">Tente ajustar os filtros de busca.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'CONSUMABLES' && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4 text-center">Qtd</th>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {consumablesReportData.length > 0 ? (
                    consumablesReportData.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50">
                        <td className="px-6 py-4 text-xs">
                          {new Date(t.date).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-100">
                          {t.consumableName}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${t.type === 'IN' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                            {t.type === 'IN' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold">
                          {t.quantity}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {t.adminUser}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 italic">
                          {t.notes || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Package size={48} className="mb-4 text-slate-300"/>
                          <p className="text-sm font-bold">Nenhuma transação encontrada</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'ASSETS' && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Marca</th>
                    <th className="px-6 py-4">Modelo</th>
                    <th className="px-6 py-4 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {assetsSummaryData.length > 0 ? (
                    assetsSummaryData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50">
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-medium">
                            <Tag size={12} />
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-100 font-medium">
                          {item.brand}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-100">
                          {item.model}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center h-8 w-12 rounded-lg bg-blue-900/30 text-blue-400 font-mono font-bold">
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Smartphone size={48} className="mb-4 text-slate-300"/>
                          <p className="text-sm font-bold">Nenhum ativo encontrado</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center text-xs font-bold">
            <span>Total de registros: {
              activeTab === 'USERS' ? reportData.length :
              activeTab === 'CONSUMABLES' ? consumablesReportData.length :
              assetsSummaryData.length
            }</span>
            <span className="print:hidden">Relatório gerado em {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .pb-10 {
              padding-bottom: 0;
            }
            .bg-white, .dark\\:bg-slate-900 {
              background-color: white !important;
            }
            .border-slate-200, .dark\\:border-slate-800 {
              border-color: #e2e8f0 !important;
            }
            .text-slate-800, .dark\\:text-slate-100 {
              color: #1e293b !important;
            }
            .text-slate-500, .dark\\:text-slate-400 {
              color: #64748b !important;
            }
            .bg-slate-50, .dark\\:bg-slate-800\\/50 {
              background-color: #f8fafc !important;
            }
            .bg-blue-100, .dark\\:bg-blue-900\\/30 {
              background-color: #dbeafe !important;
            }
            .text-blue-600, .dark\\:text-blue-400 {
              color: #2563eb !important;
            }
            .bg-slate-100, .dark\\:bg-slate-800 {
              background-color: #f1f5f9 !important;
            }
            .text-slate-600, .dark\\:text-slate-300 {
              color: #475569 !important;
            }
            .text-emerald-600, .dark\\:text-emerald-400 {
              color: #059669 !important;
            }
            .text-emerald-500 {
              color: #10b981 !important;
            }
            .text-indigo-600, .dark\\:text-indigo-400 {
              color: #4f46e5 !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:overflow-visible {
              overflow: visible !important;
            }
            .shadow-sm {
              box-shadow: none !important;
            }
            
            /* Show only the report container and its children */
            .space-y-6 > div:nth-child(2),
            .space-y-6 > div:nth-child(2) * {
              visibility: visible;
            }
            
            /* Position it at the top of the page */
            .space-y-6 > div:nth-child(2) {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none !important;
            }
            
            /* Hide the header and filters inside the report container */
            .space-y-6 > div:nth-child(2) > div:first-child {
              display: none !important;
            }
            
            /* Add a print header */
            .space-y-6 > div:nth-child(2)::before {
              content: "Relatório de Colaboradores";
              display: block;
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 20px;
              visibility: visible;
              color: black;
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default Reports;

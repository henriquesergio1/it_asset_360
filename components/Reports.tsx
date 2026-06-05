import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Printer, Download, Eye, EyeOff, Phone, Mail, Briefcase, User, ArrowUpDown, ShieldCheck, SlidersHorizontal, Check, X, Filter, FileSpreadsheet, Package, Cpu, Smartphone, Tag, DollarSign, ArrowUp, ArrowDown, Scale, Box, TrendingUp, AlertTriangle, CheckCircle, History, Wrench, Plus } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { normalizeString } from '../utils/stringUtils';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { SortableResizableHeader } from './SortableResizableHeader';
import { DeviceStatus } from '../types';

const Reports = () => {
  const { users, sectors, sims, devices, models, assetTypes, brands, consumableTransactions, maintenances, audits } = useData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'USERS' | 'CONSUMABLES' | 'ASSETS' | 'FINANCIAL' | 'AUDITS'>('USERS');

  const getSmartId = (deviceId: string) => {
    const d = devices.find(device => device.id === deviceId);
    if (!d) return 'S/T';
    if (d.assetTag && d.assetTag !== 'S/T') return d.assetTag;
    if (d.imei) return `IMEI: ${d.imei}`;
    if (d.serialNumber) return `SN: ${d.serialNumber}`;
    return 'S/ID';
  };

  const handleDeviceClick = (deviceId: string) => {
    navigate(`/devices?deviceId=${deviceId}&tab=MAINTENANCE`);
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [showOnlyWithLine, setShowOnlyWithLine] = useState(false);
  const [showVagos, setShowVagos] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'sector' | 'sectorCode' | 'email' | 'lines' | 'pulsusId', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Filtros de Data para Consumíveis
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Primeiro dia do mês atual
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  const requestSort = (key: 'name' | 'sector' | 'sectorCode' | 'email' | 'lines' | 'pulsusId') => {
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
      if (sortConfig.key === 'email') {
        return sortConfig.direction === 'asc' 
          ? a.email.localeCompare(b.email)
          : b.email.localeCompare(a.email);
      }
      if (sortConfig.key === 'lines') {
        return sortConfig.direction === 'asc' 
          ? a.lines.localeCompare(b.lines)
          : b.lines.localeCompare(a.lines);
      }
      return 0;
    });
  }, [users, sectors, sims, devices, models, selectedAssetTypes, searchTerm, selectedSectors, showOnlyWithLine, showVagos, sortConfig]);

  const [consumablesSortConfig, setConsumablesSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const requestConsumablesSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (consumablesSortConfig && consumablesSortConfig.key === key && consumablesSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setConsumablesSortConfig({ key, direction });
  };

  const consumablesReportData = useMemo(() => {
    if (!consumableTransactions) return [];
    const searchNormalized = normalizeString(searchTerm);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let filtered = consumableTransactions.filter(t => {
      const transDate = new Date(t.date);
      const matchesDate = transDate >= start && transDate <= end;
      const matchesSearch = normalizeString(t.consumableName || '').includes(searchNormalized) ||
                           normalizeString(t.adminUser || '').includes(searchNormalized) ||
                           normalizeString(t.notes || '').includes(searchNormalized);
      return matchesDate && matchesSearch;
    });

    if (consumablesSortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any = a[consumablesSortConfig.key as keyof typeof a];
        let bValue: any = b[consumablesSortConfig.key as keyof typeof b];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return consumablesSortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) return consumablesSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return consumablesSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return filtered;
  }, [consumableTransactions, searchTerm, startDate, endDate, consumablesSortConfig]);

  const consumablesSummaryData = useMemo(() => {
    const summary: Record<string, { id: string, name: string, totalIn: number, totalOut: number, net: number }> = {};
    
    consumablesReportData.forEach(t => {
      const id = t.consumableId;
      if (!summary[id]) {
        summary[id] = { id, name: t.consumableName || 'Desconhecido', totalIn: 0, totalOut: 0, net: 0 };
      }
      if (t.type === 'IN') {
        summary[id].totalIn += t.quantity;
        summary[id].net += t.quantity;
      } else {
        summary[id].totalOut += t.quantity;
        summary[id].net -= t.quantity;
      }
    });

    return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
  }, [consumablesReportData]);

  const [assetsSortConfig, setAssetsSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const requestAssetsSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (assetsSortConfig && assetsSortConfig.key === key && assetsSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setAssetsSortConfig({ key, direction });
  };

  const assetsSummaryData = useMemo(() => {
    const summary: Record<string, { type: string, brand: string, model: string, count: number }> = {};
    
    devices.forEach(d => {
      const model = models.find(m => m.id === d.modelId);
      if (!model) return;
      if (selectedAssetTypes.length > 0 && !selectedAssetTypes.includes(model.typeId)) return;
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
    let filtered = Object.values(summary).filter(item => 
      normalizeString(item.type).includes(searchNormalized) ||
      normalizeString(item.brand).includes(searchNormalized) ||
      normalizeString(item.model).includes(searchNormalized)
    );

    if (assetsSortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any = a[assetsSortConfig.key as keyof typeof a];
        let bValue: any = b[assetsSortConfig.key as keyof typeof b];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return assetsSortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) return assetsSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return assetsSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
    }

    return filtered;
  }, [devices, models, brands, assetTypes, searchTerm, selectedAssetTypes, assetsSortConfig]);

  const handlePrint = () => {
    window.print();
  };

  const [financialSortConfig, setFinancialSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('reports_widths');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('reports_widths', JSON.stringify(columnWidths));
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

  const requestFinancialSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (financialSortConfig && financialSortConfig.key === key && financialSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setFinancialSortConfig({ key, direction });
  };

  const financialReportData = useMemo(() => {
    const data = devices.map(d => {
      const model = models.find(m => m.id === d.modelId);
      const brand = brands.find(b => b.id === model?.brandId);
      const type = assetTypes.find(t => t.id === model?.typeId);
      
      const deviceMaints = maintenances.filter(m => m.deviceId === d.id);
      const totalMaint = deviceMaints.reduce((sum, m) => sum + (m.cost || 0), 0);
      const purchaseCost = d.purchaseCost || 0;
      const lcc = purchaseCost + totalMaint;
      const ratio = purchaseCost > 0 ? (totalMaint / purchaseCost) : 0;
      const age = d.purchaseDate ? (new Date().getTime() - new Date(d.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;

      return {
        id: d.id,
        assetTag: d.assetTag,
        serialNumber: d.serialNumber,
        type: type?.name || 'Outros',
        typeId: model?.typeId,
        brand: brand?.name || 'Outros',
        model: model?.name || 'Desconhecido',
        purchaseCost,
        totalMaint,
        lcc,
        ratio,
        age,
        status: d.status
      };
    });

    const searchNormalized = normalizeString(searchTerm);
    let filtered = data.filter(item => {
      const matchesSearch = normalizeString(item.assetTag || '').includes(searchNormalized) ||
                           normalizeString(item.serialNumber || '').includes(searchNormalized) ||
                           normalizeString(item.model).includes(searchNormalized) ||
                           normalizeString(item.brand).includes(searchNormalized);
      
      const matchesType = selectedAssetTypes.length === 0 || (item.typeId && selectedAssetTypes.includes(item.typeId));
      
      return matchesSearch && matchesType;
    });

    if (financialSortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any = a[financialSortConfig.key as keyof typeof a];
        let bValue: any = b[financialSortConfig.key as keyof typeof b];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return financialSortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) return financialSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return financialSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => b.lcc - a.lcc);
    }

    return filtered;
  }, [devices, models, brands, assetTypes, maintenances, searchTerm, selectedAssetTypes, financialSortConfig]);

  const financialSummary = useMemo(() => {
    const totalPurchase = financialReportData.reduce((sum, item) => sum + item.purchaseCost, 0);
    const totalMaint = financialReportData.reduce((sum, item) => sum + item.totalMaint, 0);
    const totalLCC = totalPurchase + totalMaint;
    const criticalCount = financialReportData.filter(item => item.ratio >= 0.6 || item.age >= 5).length;

    return { totalPurchase, totalMaint, totalLCC, criticalCount };
  }, [financialReportData]);

  const [auditSubTab, setAuditSubTab] = useState<'HISTORY' | 'NO_AUDIT' | 'ATTENDANCE'>('HISTORY');

  const attendanceReportData = useMemo(() => {
    let targetDevices = devices.filter(d => d.status === 'Em Uso');

    if (startDate || endDate) {
      let filteredAudits = audits || [];
      if (startDate) {
        filteredAudits = filteredAudits.filter(a => new Date(a.auditDate) >= new Date(startDate));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredAudits = filteredAudits.filter(a => new Date(a.auditDate) <= end);
      }
      const auditedDeviceIds = new Set(filteredAudits.map(a => a.deviceId));
      targetDevices = targetDevices.filter(d => auditedDeviceIds.has(d.id));
    }

    const searchNormalized = normalizeString(searchTerm);

    const result = targetDevices.map(d => {
      const user = users.find(u => u.id === d.currentUserId);
      const sector = sectors.find(s => s.id === user?.sectorId);
      const model = models.find(m => m.id === d.modelId);
      return {
        device: d,
        user: user,
        sector: sector,
        sectorName: sector?.name || 'Sem Setor',
        userName: user?.fullName || 'Desconhecido',
        modelName: model?.name || '---',
      };
    }).filter(item => {
      if (!searchTerm) return true;
      return normalizeString(item.userName).includes(searchNormalized) || 
             normalizeString(item.sectorName).includes(searchNormalized) || 
             normalizeString(item.modelName).includes(searchNormalized) ||
             normalizeString(item.device.imei || '').includes(searchNormalized) ||
             normalizeString(item.device.serialNumber || '').includes(searchNormalized) ||
             normalizeString(item.device.assetTag || '').includes(searchNormalized);
    });

    return result.sort((a, b) => {
      if (a.sectorName < b.sectorName) return -1;
      if (a.sectorName > b.sectorName) return 1;
      return a.userName.localeCompare(b.userName);
    });
  }, [devices, users, sectors, models, searchTerm, audits, startDate, endDate]);

  const auditsReportData = useMemo(() => {
    if (!audits) return [];
    const searchNormalized = normalizeString(searchTerm);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return audits.filter(a => {
      const auditDate = new Date(a.date);
      const matchesDate = auditDate >= start && auditDate <= end;
      const device = devices.find(d => d.id === a.deviceId);
      const model = device ? models.find(m => m.id === device.modelId) : null;
      
      const matchesSearch = normalizeString(a.technician || '').includes(searchNormalized) ||
                           normalizeString(a.description || '').includes(searchNormalized) ||
                           normalizeString(device?.assetTag || '').includes(searchNormalized) ||
                           normalizeString(model?.name || '').includes(searchNormalized);
      return matchesDate && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [audits, devices, models, searchTerm, startDate, endDate]);

  const devicesWithoutAuditData = useMemo(() => {
    const devicesWithAudits = new Set(audits.map(a => a.deviceId));
    return devices.filter(d => !devicesWithAudits.has(d.id)).map(d => {
      const model = models.find(m => m.id === d.modelId);
      const brand = brands.find(b => b.id === model?.brandId);
      const type = assetTypes.find(t => t.id === model?.typeId);
      const user = users.find(u => u.id === d.currentUserId);

      return {
        ...d,
        modelName: model?.name || 'Desconhecido',
        brandName: brand?.name || 'Outros',
        typeName: type?.name || 'Outros',
        currentUser: user?.fullName || 'Estoque'
      };
    });
  }, [devices, audits, models, brands, assetTypes, users]);

  const auditMetrics = useMemo(() => {
    const totalDevices = devices.length;
    const totalWithAudit = new Set(audits.map(a => a.deviceId)).size;
    const totalAudits = audits.length;
    const coverage = totalDevices > 0 ? (totalWithAudit / totalDevices) * 100 : 0;

    return { totalDevices, totalWithAudit, totalAudits, coverage };
  }, [devices, audits]);

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
    } else if (activeTab === 'FINANCIAL') {
      headers = ['Patrimônio', 'S/N', 'Tipo', 'Marca', 'Modelo', 'Custo Aquisição', 'Custo Manutenção', 'LCC Total', 'Índice LCC', 'Idade (Anos)', 'Status'];
      data = financialReportData.map(item => ({
        'Patrimônio': item.assetTag || 'S/T',
        'S/N': item.serialNumber || 'S/N',
        'Tipo': item.type,
        'Marca': item.brand,
        'Modelo': item.model,
        'Custo Aquisição': item.purchaseCost,
        'Custo Manutenção': item.totalMaint,
        'LCC Total': item.lcc,
        'Índice LCC': `${(item.ratio * 100).toFixed(0)}%`,
        'Idade (Anos)': item.age.toFixed(1),
        'Status': item.status
      }));
      fileName = `saude_financeira_ativos_${new Date().toISOString().split('T')[0]}`;
      pdfTitle = 'Relatório de Saúde Financeira e Ciclo de Vida (LCC)';
    } else if (activeTab === 'AUDITS') {
      if (auditSubTab === 'HISTORY') {
        headers = ['Data', 'Patrimônio', 'Técnico', 'Tipo', 'Descrição', 'Status', 'Observações'];
        data = auditsReportData.map(a => {
          const device = devices.find(d => d.id === a.deviceId);
          return {
            'Data': new Date(a.date).toLocaleString('pt-BR'),
            'Patrimônio': device?.assetTag || 'S/T',
            'Técnico': a.technician,
            'Tipo': a.type,
            'Descrição': a.description,
            'Status': a.status,
            'Observações': a.observations || ''
          };
        });
        fileName = `historico_auditorias_${new Date().toISOString().split('T')[0]}`;
        pdfTitle = 'Histórico de Auditorias Técnicas';
      } else if (auditSubTab === 'NO_AUDIT') {
        headers = ['Patrimônio', 'S/N', 'Tipo', 'Marca', 'Modelo', 'Usuário Atual', 'Status Ativo'];
        data = devicesWithoutAuditData.map(d => ({
          'Patrimônio': d.assetTag || 'S/T',
          'S/N': d.serialNumber || 'S/N',
          'Tipo': d.typeName,
          'Marca': d.brandName,
          'Modelo': d.modelName,
          'Usuário Atual': d.currentUser,
          'Status Ativo': d.status
        }));
        fileName = `ativos_sem_auditoria_${new Date().toISOString().split('T')[0]}`;
        pdfTitle = 'Ativos sem Auditoria Realizada';
      } else if (auditSubTab === 'ATTENDANCE') {
        headers = ['Check', 'Setor / Cargo', 'Usuário', 'Modelo', 'Identificação'];
        data = attendanceReportData.map(d => ({
          'Check': '[   ]',
          'Setor / Cargo': d.sectorName,
          'Usuário': d.userName,
          'Modelo': d.modelName,
          'Identificação': getSmartId(d.device.id)
        }));
        fileName = `lista_auditoria_${new Date().toISOString().split('T')[0]}`;
        pdfTitle = 'Lista de Presença - Auditoria';
      }
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
      <div className="space-y-6 pb-20 animate-fade-in relative">
        {/* CABEÇALHO PADRONIZADO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800 transition-colors shadow-2xl">
          <div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <FileText className="text-cyan-500" size={28} />
              Central de Relatórios IT
            </h2>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1.5 opacity-80">Emissão, exportação e análise de indicadores do sistema</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            {(['USERS', 'CONSUMABLES', 'ASSETS', 'FINANCIAL', 'AUDITS'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab 
                  ? ' bg-cyan-600 text-white shadow-lg shadow-cyan-900/40 ' 
                  : ' text-slate-500 hover:text-slate-300 '
                }`}
              >
                {tab === 'USERS' ? 'Colaboradores' :
                 tab === 'CONSUMABLES' ? 'Consumo' :
                 tab === 'ASSETS' ? 'Ativos' : 
                 tab === 'FINANCIAL' ? 'Financeiro' : 'Auditorias'}
              </button>
            ))}
          </div>
        </div>

        {/* DASHBOARD CARDS PADRONIZADOS - DINÂMICOS POR ABA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {activeTab === 'USERS' && (
            <>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-cyan-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-cyan-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total Colaboradores</span>
                  <p className="text-2xl font-black text-slate-100">{users.length}</p>
                </div>
                <div className="h-12 w-12 bg-cyan-900/20 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-800/30 group-hover:scale-110 transition-transform"><User size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Com Linha</span>
                  <p className="text-2xl font-black text-slate-100">{users.filter(u => sims.some(s => s.currentUserId === u.id)).length}</p>
                </div>
                <div className="h-12 w-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><Phone size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Com Dispositivo</span>
                  <p className="text-2xl font-black text-slate-100">{users.filter(u => devices.some(d => d.currentUserId === u.id)).length}</p>
                </div>
                <div className="h-12 w-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><Smartphone size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-indigo-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-indigo-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Ativos Pulsus</span>
                  <p className="text-2xl font-black text-slate-100">{devices.filter(d => d.pulsusId && d.pulsusId.trim() !== '').length}</p>
                </div>
                <div className="h-12 w-12 bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform"><ShieldCheck size={24}/></div>
              </div>
            </>
          )}

          {activeTab === 'CONSUMABLES' && (
            <>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-cyan-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-cyan-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Movimentações</span>
                  <p className="text-2xl font-black text-slate-100">{consumablesReportData.length}</p>
                </div>
                <div className="h-12 w-12 bg-cyan-900/20 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-800/30 group-hover:scale-110 transition-transform"><History size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total Entradas</span>
                  <p className="text-2xl font-black text-slate-100">{consumablesReportData.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.quantity, 0)}</p>
                </div>
                <div className="h-12 w-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><Plus size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-rose-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-rose-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total Saídas</span>
                  <p className="text-2xl font-black text-slate-100">{consumablesReportData.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.quantity, 0)}</p>
                </div>
                <div className="h-12 w-12 bg-rose-900/20 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-800/30 group-hover:scale-110 transition-transform"><Package size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Saldo Líquido</span>
                  <p className="text-2xl font-black text-slate-100">{consumablesReportData.reduce((acc, t) => acc + (t.type === 'IN' ? t.quantity : -t.quantity), 0)}</p>
                </div>
                <div className="h-12 w-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><Scale size={24}/></div>
              </div>
            </>
          )}

          {activeTab === 'ASSETS' && (
            <>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-cyan-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-cyan-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total Ativos</span>
                  <p className="text-2xl font-black text-slate-100">{devices.length}</p>
                </div>
                <div className="h-12 w-12 bg-cyan-900/20 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-800/30 group-hover:scale-110 transition-transform"><Box size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Modelos</span>
                  <p className="text-2xl font-black text-slate-100">{new Set(devices.map(d => d.modelId)).size}</p>
                </div>
                <div className="h-12 w-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><Tag size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-indigo-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-indigo-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Categorias</span>
                  <p className="text-2xl font-black text-slate-100">{new Set(devices.map(d => models.find(m => m.id === d.modelId)?.typeId)).size}</p>
                </div>
                <div className="h-12 w-12 bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform"><FileText size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Disponíveis</span>
                  <p className="text-2xl font-black text-slate-100">{devices.filter(d => d.status === DeviceStatus.AVAILABLE).length}</p>
                </div>
                <div className="h-12 w-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><CheckCircle size={24}/></div>
              </div>
            </>
          )}

          {activeTab === 'FINANCIAL' && (
            <>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-cyan-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-cyan-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Investimento Total</span>
                  <p className="text-2xl font-black text-slate-100">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(financialSummary.totalPurchase)}</p>
                </div>
                <div className="h-12 w-12 bg-cyan-900/20 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-800/30 group-hover:scale-110 transition-transform"><DollarSign size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-amber-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-amber-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Manutenção</span>
                  <p className="text-2xl font-black text-slate-100">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(financialSummary.totalMaint)}</p>
                </div>
                <div className="h-12 w-12 bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-400 border border-amber-800/30 group-hover:scale-110 transition-transform"><Wrench size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">TCO / LCC Global</span>
                  <p className="text-2xl font-black text-slate-100">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(financialSummary.totalLCC)}</p>
                </div>
                <div className="h-12 w-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-rose-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-rose-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Fim de Vida</span>
                  <p className="text-2xl font-black text-slate-100">{financialSummary.criticalCount}</p>
                </div>
                <div className="h-12 w-12 bg-rose-900/20 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-800/30 group-hover:scale-110 transition-transform"><AlertTriangle size={24}/></div>
              </div>
            </>
          )}

          {activeTab === 'AUDITS' && (
            <>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-cyan-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-cyan-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Ativos Cadastrados</span>
                  <p className="text-2xl font-black text-slate-100">{auditMetrics.totalDevices}</p>
                </div>
                <div className="h-12 w-12 bg-cyan-900/20 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-800/30 group-hover:scale-110 transition-transform"><Smartphone size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Com Auditoria</span>
                  <p className="text-2xl font-black text-slate-100">{auditMetrics.totalWithAudit}</p>
                </div>
                <div className="h-12 w-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><CheckCircle size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total de Auditorias</span>
                  <p className="text-2xl font-black text-slate-100">{auditMetrics.totalAudits}</p>
                </div>
                <div className="h-12 w-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><History size={24}/></div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-indigo-500/30 group shadow-lg">
                <div>
                  <span className="text-[11px] font-black text-indigo-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Cobertura Técnica</span>
                  <p className="text-2xl font-black text-slate-100">{auditMetrics.coverage.toFixed(1)}%</p>
                </div>
                <div className="h-12 w-12 bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform"><ShieldCheck size={24}/></div>
              </div>
            </>
          )}
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl ring-1 ring-white/5">
          <div className="p-8 border-b border-slate-800/50 bg-slate-950/30">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
              <div>
                <h2 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
                  {activeTab === 'USERS' && 'Relatório de Colaboradores'}
                  {activeTab === 'CONSUMABLES' && 'Histórico de Consumo de Insumos'}
                  {activeTab === 'ASSETS' && 'Resumo de Ativos por Modelo'}
                  {activeTab === 'FINANCIAL' && 'Saúde Financeira & Ciclo de Vida (LCC)'}
                  {activeTab === 'AUDITS' && (auditSubTab === 'HISTORY' ? 'Histórico de Auditorias Técnicas' : auditSubTab === 'NO_AUDIT' ? 'Ativos sem Auditoria Realizada' : 'Lista de Presença - Auditoria')}
                </h2>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1 opacity-70">
                  {activeTab === 'USERS' && 'Relação personalizável de colaboradores, linhas telefônicas e dispositivos.'}
                  {activeTab === 'CONSUMABLES' && 'Histórico detalhado de entradas e saídas de itens consumíveis.'}
                  {activeTab === 'ASSETS' && 'Contagem total de ativos agrupados por tipo, marca e modelo.'}
                  {activeTab === 'FINANCIAL' && 'Análise de investimento total, custos de manutenção e alertas de obsolescência.'}
                  {activeTab === 'AUDITS' && (auditSubTab === 'HISTORY' 
                    ? 'Listagem cronológica de todas as auditorias técnicas realizadas nos aparelhos.' 
                    : auditSubTab === 'NO_AUDIT' ? 'Identificação de aparelhos que ainda não possuem nenhum registro de auditoria técnica.'
                    : 'Lista de aparelhos em uso para conferência manual (tique no papel).')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {activeTab === 'AUDITS' && (
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner mr-2">
                    <button 
                      onClick={() => setAuditSubTab('HISTORY')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditSubTab === 'HISTORY' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Histórico
                    </button>
                    <button 
                      onClick={() => setAuditSubTab('NO_AUDIT')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditSubTab === 'NO_AUDIT' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Sem Auditoria
                    </button>
                    <button 
                      onClick={() => setAuditSubTab('ATTENDANCE')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${auditSubTab === 'ATTENDANCE' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Lista Presença
                    </button>
                  </div>
                )}
                {/* Botão Imprimir */}
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-inner"
                >
                  <Printer size={16} />
                  <span>Imprimir</span>
                </button>

                {/* Export Buttons */}
                <div className="flex bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                  <button onClick={() => handleExport('csv')} className="p-3 hover:bg-slate-800 border-r border-slate-800 transition-all text-slate-400 hover:text-cyan-400" title="Exportar CSV">
                    <FileText size={18}/>
                  </button>
                  <button onClick={() => handleExport('excel')} className="p-3 hover:bg-slate-800 border-r border-slate-800 transition-all text-slate-400 hover:text-cyan-400" title="Exportar Excel">
                    <FileSpreadsheet size={18}/>
                  </button>
                  <button onClick={() => handleExport('pdf')} className="p-3 hover:bg-slate-800 transition-all text-slate-400 hover:text-cyan-400" title="Exportar PDF">
                    <Download size={18}/>
                  </button>
                </div>

                {/* Filtros Específicos */}
                {(activeTab === 'USERS' || activeTab === 'ASSETS' || activeTab === 'FINANCIAL') && (
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={assetTypeRef}>
                      <button onClick={() => setIsAssetTypeSelectorOpen(!isAssetTypeSelectorOpen)} className="bg-slate-950 border border-slate-800 text-slate-400 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-800 font-black text-[10px] uppercase tracking-widest transition-all shadow-inner">
                        <Filter size={16} /> Tipos
                      </button>
                      {/* ... dropdown content remains same logic but styled ... */}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`relative ${activeTab === 'USERS' ? 'md:col-span-2' : activeTab === 'CONSUMABLES' ? 'md:col-span-2' : 'md:col-span-4'}`}>
                <Search className="absolute left-3 top-3" size={18} />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'USERS' ? "Buscar por nome, e-mail, linha ou ID Pulsus..." :
                    activeTab === 'CONSUMABLES' ? "Buscar por item, usuário ou notas..." :
                    activeTab === 'AUDITS' ? "Buscar por patrimônio, técnico ou descrição..." :
                    "Buscar por tipo, marca ou modelo..."
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {(activeTab === 'CONSUMABLES' || (activeTab === 'AUDITS' && auditSubTab === 'HISTORY')) && (
                <div className="md:col-span-2 flex items-center gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-slate-400 ml-2">De:</span>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-900 border-none rounded-lg py-1 px-2 text-xs font-bold text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-slate-400">Até:</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-900 border-none rounded-lg py-1 px-2 text-xs font-bold text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}
              
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
                          <span className="text-[11px] font-black uppercase">Filtrar por Setor</span>
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
                        <span className="text-[11px] font-bold uppercase tracking-wider">
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
                        <span className="text-[11px] font-bold uppercase tracking-wider">
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
              <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-slate-800/50">
                  <tr className="border-b border-slate-800">
                    <SortableResizableHeader label="Colaborador" sortKey="name" currentSort={sortConfig} requestSort={requestSort} minWidth="250px" width={columnWidths['name']} onResize={(x, w) => handleResize('name', x, w)} />
                    {visibleColumns.includes('sector') && (
                      <SortableResizableHeader label="Cargo / Setor" sortKey="sector" currentSort={sortConfig} requestSort={requestSort} minWidth="150px" width={columnWidths['sector']} onResize={(x, w) => handleResize('sector', x, w)} />
                    )}
                    {visibleColumns.includes('sectorCode') && (
                      <SortableResizableHeader label="Cód. Setor" sortKey="sectorCode" currentSort={sortConfig} requestSort={requestSort} minWidth="120px" width={columnWidths['sectorCode']} onResize={(x, w) => handleResize('sectorCode', x, w)} />
                    )}
                    {visibleColumns.includes('email') && (
                      <SortableResizableHeader label="E-mail" sortKey="email" currentSort={sortConfig} requestSort={requestSort} minWidth="200px" width={columnWidths['email']} onResize={(x, w) => handleResize('email', x, w)} />
                    )}
                    {visibleColumns.includes('lines') && (
                      <SortableResizableHeader label="Linha(s)" sortKey="lines" currentSort={sortConfig} requestSort={requestSort} minWidth="150px" width={columnWidths['lines']} onResize={(x, w) => handleResize('lines', x, w)} />
                    )}
                    {visibleColumns.includes('pulsusId') && (
                      <SortableResizableHeader label="ID Pulsus" sortKey="pulsusId" currentSort={sortConfig} requestSort={requestSort} minWidth="120px" width={columnWidths['pulsusId']} onResize={(x, w) => handleResize('pulsusId', x, w)} />
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {reportData.length > 0 ? (
                    reportData.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/60 border-l-4 border-l-transparent hover:border-l-blue-500 transition-all cursor-pointer border-b border-slate-800/50">
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
              <div className="space-y-6 p-6">
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500/80 flex items-center gap-2">
                    <Package size={14} /> Resumo por Item no Período
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {consumablesSummaryData.map(item => (
                      <div key={item.id} className="bg-slate-800/20 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-bold text-slate-100 truncate">{item.name}</span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${item.net >= 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                            {item.net > 0 ? '+' : ''}{item.net}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold uppercase tracking-tighter">
                          <div className="flex flex-col">
                            <span className="text-slate-500">Entradas</span>
                            <span className="text-emerald-400">+{item.totalIn}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-slate-500">Saídas</span>
                            <span className="text-rose-400">-{item.totalOut}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {consumablesSummaryData.length === 0 && (
                      <div className="col-span-full py-8 text-center text-xs text-slate-500 italic">
                        Nenhuma movimentação no período selecionado.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500/80 flex items-center gap-2">
                    <FileText size={14} /> Detalhamento de Movimentações
                  </h3>
                  <table className="w-full text-sm text-left table-fixed">
                    <thead className="bg-slate-800/50">
                      <tr className="border-b border-slate-800">
                        <SortableResizableHeader label="Data" sortKey="date" currentSort={consumablesSortConfig} requestSort={requestConsumablesSort} minWidth="150px" width={columnWidths['date']} onResize={(x, w) => handleResize('date', x, w)} />
                        <SortableResizableHeader label="Item" sortKey="consumableName" currentSort={consumablesSortConfig} requestSort={requestConsumablesSort} minWidth="200px" width={columnWidths['consumableName']} onResize={(x, w) => handleResize('consumableName', x, w)} />
                        <SortableResizableHeader label="Tipo" sortKey="type" currentSort={consumablesSortConfig} requestSort={requestConsumablesSort} minWidth="120px" width={columnWidths['type']} onResize={(x, w) => handleResize('type', x, w)} />
                        <SortableResizableHeader label="Qtd" sortKey="quantity" currentSort={consumablesSortConfig} requestSort={requestConsumablesSort} minWidth="100px" width={columnWidths['quantity']} onResize={(x, w) => handleResize('quantity', x, w)} />
                        <SortableResizableHeader label="Usuário" sortKey="adminUser" currentSort={consumablesSortConfig} requestSort={requestConsumablesSort} minWidth="150px" width={columnWidths['adminUser']} onResize={(x, w) => handleResize('adminUser', x, w)} />
                        <SortableResizableHeader label="Notas" sortKey="notes" currentSort={consumablesSortConfig} requestSort={requestConsumablesSort} minWidth="200px" width={columnWidths['notes']} onResize={(x, w) => handleResize('notes', x, w)} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {consumablesReportData.length > 0 ? (
                        consumablesReportData.map(t => (
                          <tr key={t.id} className="hover:bg-slate-800/60 border-l-4 border-l-transparent hover:border-l-blue-500 transition-all cursor-pointer border-b border-slate-800/50">
                            <td className="px-6 py-4 text-xs">
                              {new Date(t.date).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-100">
                              {t.consumableName}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${t.type === 'IN' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
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
                </div>
              </div>
            )}

            {activeTab === 'ASSETS' && (
              <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-slate-800/50">
                  <tr className="border-b border-slate-800">
                    <SortableResizableHeader label="Tipo" sortKey="type" currentSort={assetsSortConfig} requestSort={requestAssetsSort} minWidth="150px" width={columnWidths['type']} onResize={(x, w) => handleResize('type', x, w)} />
                    <SortableResizableHeader label="Marca" sortKey="brand" currentSort={assetsSortConfig} requestSort={requestAssetsSort} minWidth="150px" width={columnWidths['brand']} onResize={(x, w) => handleResize('brand', x, w)} />
                    <SortableResizableHeader label="Modelo" sortKey="model" currentSort={assetsSortConfig} requestSort={requestAssetsSort} minWidth="200px" width={columnWidths['model']} onResize={(x, w) => handleResize('model', x, w)} />
                    <SortableResizableHeader label="Total" sortKey="count" currentSort={assetsSortConfig} requestSort={requestAssetsSort} minWidth="100px" width={columnWidths['count']} onResize={(x, w) => handleResize('count', x, w)} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {assetsSummaryData.length > 0 ? (
                    assetsSummaryData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/60 border-l-4 border-l-transparent hover:border-l-blue-500 transition-all cursor-pointer border-b border-slate-800/50">
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
            {activeTab === 'FINANCIAL' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left table-fixed">
                  <thead className="bg-slate-800/50">
                    <tr className="border-b border-slate-800">
                      <SortableResizableHeader label="Ativo" sortKey="model" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="200px" width={columnWidths['model']} onResize={(x, w) => handleResize('model', x, w)} />
                      <SortableResizableHeader label="Tipo/Marca" sortKey="type" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="150px" width={columnWidths['type']} onResize={(x, w) => handleResize('type', x, w)} />
                      <SortableResizableHeader label="Aquisição" sortKey="purchaseCost" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="120px" width={columnWidths['purchaseCost']} onResize={(x, w) => handleResize('purchaseCost', x, w)} />
                      <SortableResizableHeader label="Manutenção" sortKey="totalMaint" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="120px" width={columnWidths['totalMaint']} onResize={(x, w) => handleResize('totalMaint', x, w)} />
                      <SortableResizableHeader label="LCC Total" sortKey="lcc" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="120px" width={columnWidths['lcc']} onResize={(x, w) => handleResize('lcc', x, w)} />
                      <SortableResizableHeader label="Índice LCC" sortKey="ratio" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="100px" width={columnWidths['ratio']} onResize={(x, w) => handleResize('ratio', x, w)} />
                      <SortableResizableHeader label="Idade" sortKey="age" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="80px" width={columnWidths['age']} onResize={(x, w) => handleResize('age', x, w)} />
                      <SortableResizableHeader label="Status" sortKey="status" currentSort={financialSortConfig} requestSort={requestFinancialSort} minWidth="120px" width={columnWidths['status']} onResize={(x, w) => handleResize('status', x, w)} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {financialReportData.length > 0 ? (
                      financialReportData.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/60 border-l-4 border-l-transparent hover:border-l-blue-500 transition-all cursor-pointer">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-100">{item.model}</span>
                              <span className="text-[11px] text-slate-500 uppercase">Pat: {item.assetTag || 'S/T'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-slate-300">{item.type}</span>
                              <span className="text-[11px] text-slate-500 uppercase">{item.brand}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.purchaseCost)}</td>
                          <td className="px-6 py-4 text-right font-medium text-amber-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalMaint)}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-100">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.lcc)}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-xs font-bold ${item.ratio >= 0.6 ? 'text-red-400' : 'text-slate-300'}`}>
                                {(item.ratio * 100).toFixed(0)}%
                              </span>
                              <div className="w-12 bg-slate-800 h-1 rounded-full overflow-hidden">
                                <div className={`h-full ${item.ratio >= 0.6 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(item.ratio * 100, 100)}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-xs font-bold ${item.age >= 5 ? 'text-red-400' : 'text-slate-300'}`}>
                              {item.age.toFixed(1)}a
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                              item.status === 'Disponível' ? 'bg-emerald-900/30 text-emerald-400' :
                              item.status === 'Em Uso' ? 'bg-blue-900/30 text-blue-400' :
                              'bg-amber-900/30 text-amber-400'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <DollarSign size={48} className="mb-4 text-slate-300"/>
                            <p className="text-sm font-bold">Nenhum dado financeiro encontrado</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'AUDITS' && (
              <div className="overflow-x-auto print:overflow-visible">
                {auditSubTab === 'HISTORY' ? (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/50">
                      <tr className="border-b border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Data</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Patrimônio</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Técnico</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Tipo</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {auditsReportData.length > 0 ? (
                        auditsReportData.map(a => {
                          const device = devices.find(d => d.id === a.deviceId);
                          return (
                            <tr key={a.id} className="hover:bg-slate-800/60 border-b border-slate-800/50 transition-all">
                              <td className="px-6 py-4 font-bold text-slate-300">{new Date(a.date).toLocaleDateString('pt-BR')}</td>
                              <td 
                                onClick={() => handleDeviceClick(a.deviceId)}
                                className="px-6 py-4 cursor-pointer group/cell"
                              >
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-100 group-hover/cell:text-blue-400 transition-colors underline decoration-dotted decoration-slate-700 underline-offset-4">{getSmartId(a.deviceId)}</span>
                                  {/* Mostrar SN se o smartId não for SN */}
                                  {(() => {
                                    const d = devices.find(dev => dev.id === a.deviceId);
                                    const sid = getSmartId(a.deviceId);
                                    if (d?.serialNumber && !sid.includes(d.serialNumber)) {
                                      return <span className="text-[10px] text-slate-500 uppercase">{d.serialNumber}</span>;
                                    }
                                    return null;
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-300">{a.technician}</td>
                              <td className="px-6 py-4">
                                {(() => {
                                  const d = devices.find(dev => dev.id === a.deviceId);
                                  const m = d ? models.find(mod => mod.id === d.modelId) : null;
                                  const b = m ? brands.find(brand => brand.id === m.brandId) : null;
                                  const t = m ? assetTypes.find(type => type.id === m.typeId) : null;
                                  return (
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-100 text-[10px] uppercase">{m?.name || 'Desconhecido'}</span>
                                      <span className="text-[9px] text-slate-500 uppercase font-black">{t?.name || '---'} • {b?.name || '---'}</span>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  a.status === 'Aprovado' ? 'bg-emerald-900/30 text-emerald-400' :
                                  a.status === 'Reprovado' ? 'bg-red-900/30 text-red-400' :
                                  'bg-amber-900/30 text-amber-400'
                                }`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate" title={a.description}>{a.description}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                             <div className="flex flex-col items-center justify-center">
                              <History size={48} className="mb-4 text-slate-300"/>
                              <p className="text-sm font-bold">Nenhum histórico de auditoria encontrado no período</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : auditSubTab === 'ATTENDANCE' ? (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/50">
                      <tr className="border-b border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 w-12 text-center">OK</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Setor / Cargo</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Usuário</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Modelo</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Identificação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {attendanceReportData.length > 0 ? (
                        attendanceReportData.map(d => (
                          <tr 
                            key={d.device.id} 
                            className="hover:bg-slate-800/60 border-b border-slate-800/50 transition-all font-medium text-slate-300"
                          >
                            <td className="px-6 py-4 text-center">
                              <div className="w-5 h-5 border-2 border-slate-500 rounded flex items-center justify-center mx-auto bg-slate-900 print:border-slate-800 print:bg-white">
                                {/* Quadrado vazio para ticar na caneta */}
                              </div>
                            </td>
                            <td className="px-6 py-4 uppercase text-xs">{d.sectorName}</td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-100">{d.userName}</span>
                            </td>
                            <td className="px-6 py-4 uppercase text-[10px]">{d.modelName}</td>
                            <td className="px-6 py-4 text-[10px] uppercase font-mono tracking-wider">
                              {getSmartId(d.device.id)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                             <div className="flex flex-col items-center justify-center">
                              <CheckCircle size={48} className="mb-4 text-slate-300"/>
                              <p className="text-sm font-bold">Nenhum aparelho entregue no momento.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/50">
                      <tr className="border-b border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Patrimônio / SN</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Tipo / Marca / Modelo</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Usuário Atual</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Status Ativo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {devicesWithoutAuditData.length > 0 ? (
                        devicesWithoutAuditData.map(d => (
                          <tr 
                            key={d.id} 
                            onClick={() => handleDeviceClick(d.id)}
                            className="hover:bg-slate-800/60 border-b border-slate-800/50 transition-all cursor-pointer group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors underline decoration-dotted decoration-slate-700 underline-offset-4">{getSmartId(d.id)}</span>
                                {/* Mostrar SN se o smartId não for SN */}
                                {(() => {
                                  const sid = getSmartId(d.id);
                                  if (d.serialNumber && !sid.includes(d.serialNumber)) {
                                    return <span className="text-[10px] text-slate-500 uppercase">{d.serialNumber}</span>;
                                  }
                                  return null;
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-100 text-xs uppercase">{d.modelName}</span>
                                <span className="text-[10px] text-slate-500 uppercase">{d.typeName} • {d.brandName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                    {d.currentUser.charAt(0)}
                                  </div>
                                  <span className="font-medium text-slate-300 text-xs">{d.currentUser}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  d.status === 'Disponível' ? 'bg-emerald-900/30 text-emerald-400' :
                                  d.status === 'Em Uso' ? 'bg-blue-900/30 text-blue-400' :
                                  'bg-amber-900/30 text-amber-400'
                                }`}>
                                  {d.status}
                                </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                             <div className="flex flex-col items-center justify-center">
                              <CheckCircle size={48} className="mb-4 text-emerald-400/50"/>
                              <p className="text-sm font-bold">Excelente! Todos os ativos cadastrados possuem auditoria técnica.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center text-xs font-bold">
            <span>Total de registros: {
              activeTab === 'USERS' ? reportData.length :
              activeTab === 'CONSUMABLES' ? consumablesReportData.length :
              activeTab === 'ASSETS' ? assetsSummaryData.length :
              activeTab === 'FINANCIAL' ? financialReportData.length :
              auditSubTab === 'HISTORY' ? auditsReportData.length : auditSubTab === 'ATTENDANCE' ? attendanceReportData.length : devicesWithoutAuditData.length
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

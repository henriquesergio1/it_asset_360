import React, { useState, useMemo } from 'react';
import { FileText, Search, Printer, Download, Eye, EyeOff, Phone, Mail, Briefcase, User, ArrowUpDown } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import * as XLSX from 'xlsx';
import { normalizeString } from '../utils/stringUtils';

const Reports = () => {
  const { users, sectors, sims, devices } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [showEmail, setShowEmail] = useState(true);
  const [showOnlyWithLine, setShowOnlyWithLine] = useState(true);
  const [showVagos, setShowVagos] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'sector' | 'sectorCode', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const requestSort = (key: 'name' | 'sector' | 'sectorCode') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const reportData = useMemo(() => {
    // Helper to extract numbers from email (e.g., vendas101@... -> "101")
    const extractSectorFromEmail = (email: string) => {
      if (!email) return null;
      const match = email.match(/\d+/);
      return match ? match[0] : null;
    };

    // 1. Map all ACTIVE users and their expected sector from email
    const usersMap = new Map(users.filter(u => u.active).map(u => [u.id, {
      ...u,
      expectedSectorCode: extractSectorFromEmail(u.email),
      assignedSims: [] as any[],
      assignedSectorCodes: new Set<string>()
    }]));

    // 2. Create a list for "Vago" (unassigned) items
    const unassignedItems: any[] = [];

    // 3. Process all SIMs
    sims.forEach(sim => {
      // Is this SIM linked to a device?
      const linkedDevice = devices.find(d => d.linkedSimId === sim.id);
      
      if (linkedDevice) {
        const deviceSectorCode = linkedDevice.internalCode || '';
        
        if (linkedDevice.currentUserId) {
          const user = usersMap.get(linkedDevice.currentUserId);
          if (user) {
            // Check if user has multiple devices with DIFFERENT sector codes
            const userDevices = devices.filter(d => d.currentUserId === user.id);
            const uniqueDeviceCodes = new Set(userDevices.map(d => d.internalCode).filter(Boolean));
            
            // If user has multiple different codes, try to match with email
            if (uniqueDeviceCodes.size > 1 && user.expectedSectorCode) {
              // Does this device's code match the email?
              // Or if the device has no code, we can't match it, so we might just assign it anyway or leave it.
              // Let's say if it matches the email, it goes to the user.
              // If it DOES NOT match the email, it goes to "Vago".
              if (deviceSectorCode && deviceSectorCode.includes(user.expectedSectorCode)) {
                user.assignedSims.push(sim);
                if (deviceSectorCode) user.assignedSectorCodes.add(deviceSectorCode);
              } else {
                // Doesn't match email -> Vago
                unassignedItems.push({
                  id: `vago-${sim.id}`,
                  fullName: 'Vago (Sem Colaborador)',
                  sectorName: 'Dispositivo sem usuário correspondente',
                  sectorCode: deviceSectorCode || '-',
                  sectorId: linkedDevice.sectorId,
                  email: '-',
                  lines: sim.phoneNumber,
                  hasLine: true,
                  isVago: true
                });
              }
            } else {
              // User has only 1 code (or none), or no expected code from email -> assign to user normally
              user.assignedSims.push(sim);
              if (deviceSectorCode) user.assignedSectorCodes.add(deviceSectorCode);
            }
          } else {
            // Device has a userId but user not found in DB -> Vago
            unassignedItems.push({
              id: `vago-${sim.id}`,
              fullName: 'Vago (Usuário não encontrado)',
              sectorName: '-',
              sectorCode: deviceSectorCode || '-',
              sectorId: linkedDevice.sectorId,
              email: '-',
              lines: sim.phoneNumber,
              hasLine: true,
              isVago: true
            });
          }
        } else {
          // Device has NO user -> Vago
          unassignedItems.push({
            id: `vago-${sim.id}`,
            fullName: 'Vago (Dispositivo em Estoque)',
            sectorName: '-',
            sectorCode: deviceSectorCode || '-',
            sectorId: linkedDevice.sectorId,
            email: '-',
            lines: sim.phoneNumber,
            hasLine: true,
            isVago: true
          });
        }
      } else if (sim.currentUserId) {
        // SIM is directly linked to a user (no device)
        const user = usersMap.get(sim.currentUserId);
        if (user) {
          user.assignedSims.push(sim);
        } else {
          // User not found -> Vago
          unassignedItems.push({
            id: `vago-${sim.id}`,
            fullName: 'Vago (Chip avulso - Usuário não encontrado)',
            sectorName: '-',
            sectorCode: '-',
            sectorId: null,
            email: '-',
            lines: sim.phoneNumber,
            hasLine: true,
            isVago: true
          });
        }
      }
      // REMOVED: Completely unassigned SIMs (no device, no user) are now hidden as requested.
    });

    // 4. Format User Data
    const formattedUsers = Array.from(usersMap.values()).map(user => {
      const sector = sectors.find(s => s.id === user.sectorId);
      
      // Deduplicate SIMs just in case
      const uniqueSims = user.assignedSims.filter((sim, index, self) => 
        index === self.findIndex((t) => t.id === sim.id)
      );

      return {
        ...user,
        sectorName: sector?.name || 'Não definido',
        sectorCode: Array.from(user.assignedSectorCodes).join(', ') || '-',
        lines: uniqueSims.map(s => s.phoneNumber).join(', ') || 'Sem linha',
        hasLine: uniqueSims.length > 0,
        isVago: false
      };
    });

    // 5. Combine Users and Vagos
    const allData = [...formattedUsers, ...unassignedItems];

    // 6. Apply Filters and Sorting
    return allData.filter(item => {
      if (showOnlyWithLine && !item.hasLine) return false;
      if (!showVagos && item.isVago) return false;
      if (selectedSector && item.sectorId !== selectedSector) return false;
      
      if (searchTerm) {
        const term = normalizeString(searchTerm);
        return normalizeString(item.fullName).includes(term) || 
               normalizeString(item.lines).includes(term) ||
               normalizeString(item.email).includes(term) ||
               normalizeString(item.sectorCode).includes(term);
      }
      return true;
    }).sort((a, b) => {
      // Always put "Vago" at the bottom if sorting by name
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
      return 0;
    });
  }, [users, sectors, sims, devices, searchTerm, selectedSector, showOnlyWithLine, sortConfig]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportXLSX = () => {
    const headers = ['Nome', 'Cargo / Setor', 'Cód. Setor', ...(showEmail ? ['E-mail'] : []), 'Linha(s)'];
    
    const data = reportData.map(item => {
      const row: any = {
        'Nome': item.fullName,
        'Cargo / Setor': item.sectorName,
        'Cód. Setor': item.sectorCode,
      };
      
      if (showEmail) {
        row['E-mail'] = item.email;
      }
      
      row['Linha(s)'] = item.lines;
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");
    
    // Auto-size columns
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 20) }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `relatorio_contatos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="text-blue-600 dark:text-blue-400" />
            Relatórios
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Emissão e exportação de relatórios do sistema
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Lista de Contatos</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Relação de colaboradores e suas respectivas linhas telefônicas.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={handlePrint}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Printer size={16} />
                <span className="hidden md:inline">Imprimir</span>
              </button>
              <button 
                onClick={handleExportXLSX}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
              >
                <Download size={16} />
                <span className="hidden md:inline">Exportar Excel</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou linha..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <select
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 transition-all font-medium"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
              >
                <option value="">Todos os Cargos / Setores</option>
                {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-center gap-2 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 dark:bg-slate-700"
                  checked={showEmail} 
                  onChange={(e) => setShowEmail(e.target.checked)} 
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Exibir E-mail
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-600 dark:bg-slate-700"
                  checked={showOnlyWithLine} 
                  onChange={(e) => setShowOnlyWithLine(e.target.checked)} 
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Apenas com linha
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300 dark:border-slate-600 dark:bg-slate-700"
                  checked={showVagos} 
                  onChange={(e) => setShowVagos(e.target.checked)} 
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Exibir Vagos
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('name')}>
                  <div className="flex items-center gap-2">
                    Colaborador
                    <ArrowUpDown size={12} className={sortConfig.key === 'name' ? 'text-blue-500' : 'text-slate-300'} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('sector')}>
                  <div className="flex items-center gap-2">
                    Cargo / Setor
                    <ArrowUpDown size={12} className={sortConfig.key === 'sector' ? 'text-blue-500' : 'text-slate-300'} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('sectorCode')}>
                  <div className="flex items-center gap-2">
                    Cód. Setor
                    <ArrowUpDown size={12} className={sortConfig.key === 'sectorCode' ? 'text-blue-500' : 'text-slate-300'} />
                  </div>
                </th>
                {showEmail && <th className="px-6 py-4">E-mail</th>}
                <th className="px-6 py-4">Linha(s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {reportData.length > 0 ? (
                reportData.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                          {item.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{item.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                        <Briefcase size={12} className="text-slate-400" />
                        {item.sectorName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                        {item.sectorCode}
                      </span>
                    </td>
                    {showEmail && (
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs">
                          <Mail size={14} className="text-slate-400" />
                          {item.email}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-2 text-xs font-bold ${item.hasLine ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        <Phone size={14} className={item.hasLine ? 'text-emerald-500' : 'text-slate-300'} />
                        {item.lines}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={showEmail ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <User size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Nenhum contato encontrado</p>
                      <p className="text-xs mt-1">Tente ajustar os filtros de busca.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center text-xs font-bold text-slate-500">
          <span>Total de registros: {reportData.length}</span>
          <span className="print:hidden">Relatório gerado em {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
      
      {/* Print Styles */}
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
            content: "Relatório: Lista de Contatos";
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
  );
};

export default Reports;

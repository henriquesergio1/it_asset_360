
// ... existing imports
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, ReturnChecklist, DeviceAccessory } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Monitor, Settings, Image as ImageIcon, FileText, Wrench, DollarSign, Paperclip, Link, Unlink, History, ArrowRight, Tablet, Hash, ScanBarcode, ExternalLink, ArrowUpRight, ArrowDownLeft, CheckSquare, Printer, CheckCircle, Plug, X, Layers, Square, Copy, Box, Ban, LayoutGrid, Eye, AlertTriangle, HardDrive, SmartphoneNfc, Sliders, MapPin } from 'lucide-react';
import ModelSettings from './ModelSettings';
import { generateAndPrintTerm } from '../utils/termGenerator';

const DeviceManager = () => {
  const { 
    devices, addDevice, updateDevice, deleteDevice, 
    users, models, brands, assetTypes, sims, sectors, accessoryTypes, customFields,
    maintenances, addMaintenance, deleteMaintenance,
    getHistory, settings,
    assignAsset, returnAsset 
  } = useData();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewStatus, setViewStatus] = useState<DeviceStatus | 'ALL'>('ALL'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'ACCESSORIES' | 'FINANCIAL' | 'MAINTENANCE' | 'HISTORY'>('GENERAL');
  const [formData, setFormData] = useState<Partial<Device>>({ status: DeviceStatus.AVAILABLE, accessories: [] });
  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');
  const adminName = currentUser?.name || 'Sistema';

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const m = models.find(mod => mod.id === d.modelId);
    return `${m?.name} ${d.assetTag} ${d.imei || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Inventário</h1>
        <button onClick={() => { setEditingId(null); setFormData({ status: DeviceStatus.AVAILABLE }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={18}/> Novo</button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={20}/><input type="text" placeholder="Buscar..." className="pl-10 w-full border rounded-lg py-2" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Modelo</th>
              <th className="px-6 py-3">Identificação</th>
              <th className="px-6 py-3">Setor Cadastrado</th>
              <th className="px-6 py-3">Usuário Atual</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => {
              const assignedUser = users.find(u => u.id === d.currentUserId);
              const m = models.find(mod => mod.id === d.modelId);
              const sec = sectors.find(s => s.id === d.sectorId);
              
              // Alerta de divergência (ex: celular é de Vendas mas está com RH)
              const hasDivergence = assignedUser && d.sectorId && assignedUser.sectorId !== d.sectorId;

              return (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900">{m?.name}</td>
                  <td className="px-6 py-4">
                    <div className="text-xs">
                        <p className="font-mono font-bold">{d.assetTag}</p>
                        {d.imei && <p className="text-gray-400">IMEI: {d.imei}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        {sec?.name || '-'}
                        {/* Fix: Wrapped AlertTriangle in a span to provide the tooltip since the component doesn't support 'title' prop */}
                        {hasDivergence && (
                          <span title="Setor do Ativo diferente do Setor do Usuário (Empréstimo Temporário)">
                            <AlertTriangle size={14} className="text-orange-500" />
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4">{assignedUser ? assignedUser.fullName : <span className="text-gray-300">Livre</span>}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setEditingId(d.id); setFormData(d); setIsModalOpen(true); }} className="text-blue-600 p-1"><Edit2 size={16}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeviceManager;

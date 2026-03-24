
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceStatus, SoftwareAccount, ExternalDbConfig, ExpedienteAlert, Task, TaskLog } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const API_URL = ''; 

export const ProdDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  const safeJson = async (res: Response, endpoint: string) => {
      if (!res.ok) {
          const text = await res.text();
          throw new Error(`Erro no endpoint ${endpoint}: ${res.status} ${res.statusText}. Detalhe: ${text.substring(0, 50)}`);
      }
      return res.json();
  };

  const { data: bootstrapData, isLoading: isBootstrapLoading, error: bootstrapError } = useQuery({
    queryKey: ['bootstrap'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/bootstrap`);
      return safeJson(res, '/api/bootstrap');
    },
    staleTime: Infinity,
  });

  const { data: syncData, isLoading: isSyncLoading, error: syncError } = useQuery({
    queryKey: ['sync'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/sync`);
      return safeJson(res, '/api/sync');
    },
    refetchInterval: 30000,
    enabled: !!bootstrapData,
  });

  const { data: externalDbConfigData } = useQuery({
    queryKey: ['externalDbConfig'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/admin/external-db/config`);
      return safeJson(res, '/api/admin/external-db/config');
    }
  });

  const { data: expedienteAlertsData } = useQuery({
    queryKey: ['expedienteAlerts'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/dashboard/expediente-alerts`);
      return safeJson(res, '/api/dashboard/expediente-alerts');
    }
  });

  const loading = isBootstrapLoading || (isSyncLoading && !syncData);
  const error = (bootstrapError as Error)?.message || (syncError as Error)?.message || null;

  const devices = syncData?.devices || bootstrapData?.devices || [];
  const sims = syncData?.sims || bootstrapData?.sims || [];
  const usersData = syncData?.users || bootstrapData?.users || [];
  const termsData = syncData?.terms || bootstrapData?.terms || [];
  const users = usersData.map((u: User) => ({ 
      ...u, 
      terms: termsData.filter((t: Term) => t.userId === u.id) 
  }));
  const logs = syncData?.logs || bootstrapData?.logs || [];
  const maintenances = syncData?.maintenances || bootstrapData?.maintenances || [];
  const accounts = syncData?.accounts || bootstrapData?.accounts || [];
  
  const tasksData = syncData?.tasks || bootstrapData?.tasks || [];
  const taskLogs = syncData?.taskLogs || bootstrapData?.taskLogs || [];
  const now = new Date();
  const tasks = tasksData.map((task: Task) => {
      let isOverdue = false;
      let isNearDue = false;
      if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          isOverdue = task.status !== 'Concluída' && task.status !== 'Cancelada' && dueDate < now;
          const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
          isNearDue = task.status !== 'Concluída' && task.status !== 'Cancelada' && !isOverdue && diffDays <= 2;
      }
      return { ...task, isOverdue, isNearDue, hasDueDate: !!task.dueDate };
  });

  const systemUsers = bootstrapData?.systemUsers || [];
  const settings = bootstrapData?.settings || { appName: 'IT Asset', logoUrl: '' };
  const models = bootstrapData?.models || [];
  const brands = bootstrapData?.brands || [];
  const assetTypes = bootstrapData?.assetTypes || [];
  const sectors = bootstrapData?.sectors || [];
  const accessoryTypes = bootstrapData?.accessoryTypes || [];
  const customFields = bootstrapData?.customFields || [];

  const externalDbConfig = externalDbConfigData || null;
  const expedienteAlerts = expedienteAlertsData || [];

  const fetchData = async (silent: boolean = false) => {
      if (silent) {
          await queryClient.invalidateQueries({ queryKey: ['sync'] });
      } else {
          await queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
          await queryClient.invalidateQueries({ queryKey: ['sync'] });
          await queryClient.invalidateQueries({ queryKey: ['externalDbConfig'] });
          await queryClient.invalidateQueries({ queryKey: ['expedienteAlerts'] });
      }
  };

  const getLogDetail = async (id: string): Promise<AuditLog> => {
      const res = await fetch(`${API_URL}/api/logs/${id}`);
      return safeJson(res, `/api/logs/${id}`);
  };

  const getTermFile = async (id: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/terms/${id}/file`);
      const data = await safeJson(res, `/api/terms/${id}/file`);
      return data.fileUrl || '';
  };

  const getDeviceInvoice = async (id: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/devices/${id}/invoice`);
      const data = await safeJson(res, `/api/devices/${id}/invoice`);
      return data.invoiceUrl || '';
  };

  const getMaintenanceInvoice = async (id: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/maintenances/${id}/invoice`);
      const data = await safeJson(res, `/api/maintenances/${id}/invoice`);
      return data.invoiceUrl || '';
  };

  const postData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return safeJson(res, endpoint);
  };

  const putData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return safeJson(res, endpoint);
  };

  // CRUD Dispositivos
  const addDevice = async (device: Device, adminName: string) => { await postData('devices', { ...device, _adminUser: adminName }); fetchData(true); };
  const updateDevice = async (device: Device, adminName: string) => { await putData('devices', { ...device, _adminUser: adminName }); fetchData(true); };
  const deleteDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) { 
        const updatedDevice = { ...device, status: DeviceStatus.RETIRED, currentUserId: null };
        await putData('devices', { ...updatedDevice, _adminUser: adminName, _reason: reason }); 
        fetchData(true);
    }
  };

  const restoreDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) { 
        const restored = { ...device, status: DeviceStatus.AVAILABLE, currentUserId: null };
        await putData('devices', { ...restored, _adminUser: adminName, _reason: reason }); 
        fetchData(true);
    }
  };

  const addUser = async (user: User, adminName: string) => { await postData('users', { ...user, _adminUser: adminName }); fetchData(true); };
  const updateUser = async (user: User, adminName: string, notes?: string) => { await putData('users', { ...user, _adminUser: adminName, _notes: notes }); fetchData(true); };
  const toggleUserActive = async (user: User, adminName: string, reason?: string) => {
    const newActive = !user.active;
    const updated = { 
        ...user, 
        active: newActive,
        status: newActive ? 'Ativo' : 'Inativo'
    };
    await putData('users', { ...updated, _adminUser: adminName, _reason: reason });
    fetchData(true);
  };

  const addAccount = async (account: SoftwareAccount, adminName: string) => { await postData('accounts', { ...account, _adminUser: adminName }); fetchData(true); };
  const updateAccount = async (account: SoftwareAccount, adminName: string) => { await putData('accounts', { ...account, _adminUser: adminName }); fetchData(true); };
  const deleteAccount = async (id: string, adminName: string) => {
    await fetch(`${API_URL}/api/accounts/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _adminUser: adminName }) });
    fetchData(true);
  };

  const updateTermFile = async (termId: string, userId: string, fileUrl: string, adminName: string) => {
      try { await putData('terms/file', { id: termId, fileUrl, _adminUser: adminName }); fetchData(true); } catch (err) { alert("Falha ao salvar arquivo do termo."); }
  };

  const updateTermDetails = async (termId: string, condition: string, damageDescription: string, assetDetails: string, notes: string, evidenceFiles: string[], adminName: string) => {
      try { await putData('terms', { id: termId, condition, damageDescription, assetDetails, notes, evidenceFiles, _adminUser: adminName }); fetchData(true); } catch (err) { alert("Falha ao atualizar detalhes do termo."); }
  };

  const deleteTermFile = async (termId: string, userId: string, reason: string, adminName: string) => {
      try { await fetch(`${API_URL}/api/terms/${termId}/file`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ _adminUser: adminName, reason }) }); fetchData(true); } catch (err) { alert("Falha ao excluir arquivo do termo."); }
  };

  const addSim = async (s: SimCard, a: string) => { await postData('sims', {...s, _adminUser: a}); fetchData(true); };
  const updateSim = async (s: SimCard, a: string) => { await putData('sims', {...s, _adminUser: a}); fetchData(true); };
  const deleteSim = async (id: string, a: string, r: string) => { 
      await fetch(`${API_URL}/api/sims/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({_adminUser: a, reason: r}) });
      fetchData(true);
  };

  const fetchExpedienteAlerts = async () => {
    await queryClient.invalidateQueries({ queryKey: ['expedienteAlerts'] });
  };

  const saveExpedienteOverride = async (codigo: string, observation: string, reactivationDate: string | null) => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/expediente-alerts/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, observation, reactivationDate })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro do servidor: ${text}`);
      }
      await fetchExpedienteAlerts(); // Recarrega a lista para aplicar as mudanças
    } catch (err) {
      console.error("Erro ao salvar override de expediente:", err);
      throw err;
    }
  };

  const updateExternalDbConfig = async (config: ExternalDbConfig, adminName: string) => {
    await postData('admin/external-db/config', { ...config, _adminUser: adminName });
    await queryClient.invalidateQueries({ queryKey: ['externalDbConfig'] });
  };

  const testExternalDbConnection = async (config: ExternalDbConfig) => {
    const res = await fetch(`${API_URL}/api/admin/external-db/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return safeJson(res, '/api/admin/external-db/test');
  };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    accounts, externalDbConfig, expedienteAlerts, fetchData, refreshData: fetchData, getTermFile, getDeviceInvoice, getMaintenanceInvoice, getLogDetail,
    addAccount, updateAccount, deleteAccount, addDevice, updateDevice, deleteDevice, restoreDevice, addSim, updateSim, deleteSim, addUser, updateUser, toggleUserActive,
    updateSettings: async (s: SystemSettings, a: string) => { await fetch(`${API_URL}/api/settings`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...s, _adminUser: a}) }); await queryClient.invalidateQueries({ queryKey: ['bootstrap'] }); },
    assignAsset: async (at, aid, uid, n, adm, acc) => { await postData('operations/checkout', { assetId: aid, assetType: at, userId: uid, notes: n, _adminUser: adm, accessories: acc }); fetchData(true); },
    returnAsset: async (at, aid, n, adm, list, inactivate, cond, desc, evids, isManual, resolutionReason) => { await postData('operations/checkin', { assetId: aid, assetType: at, notes: n, _adminUser: adm, returnedChecklist: list, inactivateUser: inactivate, condition: cond, damageDescription: desc, evidenceFiles: evids, isManual, resolutionReason }); fetchData(true); },
    updateTermFile, deleteTermFile, updateTermDetails, getHistory: (id) => logs.filter(l => l.assetId === id),
    clearLogs: async () => { await fetch(`${API_URL}/api/logs`, { method: 'DELETE' }); fetchData(true); },
    restoreItem: async (lid, adm) => { await postData('restore', { logId: lid, _adminUser: adm }); fetchData(true); },
    // Fix: replaced 'a' with 'adm' to match function parameters
    addAssetType: async (t, adm) => { await postData('asset-types', {...t, _adminUser: adm}); fetchData(true); },
    updateAssetType: async (t, adm) => { await putData('asset-types', {...t, _adminUser: adm}); fetchData(true); },
    deleteAssetType: async (id) => { await fetch(`${API_URL}/api/asset-types/${id}`, {method: 'DELETE'}); fetchData(true); },
    addBrand: async (b, adm) => { await postData('brands', {...b, _adminUser: adm}); fetchData(true); },
    updateBrand: async (b, adm) => { await putData('brands', {...b, _adminUser: adm}); fetchData(true); },
    deleteBrand: async (id) => { await fetch(`${API_URL}/api/brands/${id}`, {method: 'DELETE'}); fetchData(true); },
    addModel: async (m, adm) => { await postData('models', {...m, _adminUser: adm}); fetchData(true); },
    updateModel: async (m, adm) => { await putData('models', {...m, _adminName: adm}); fetchData(true); },
    deleteModel: async (id) => { await fetch(`${API_URL}/api/models/${id}`, {method: 'DELETE'}); fetchData(true); },
    addMaintenance: async (m, adm) => { await postData('maintenances', {...m, _adminUser: adm}); fetchData(true); },
    deleteMaintenance: async (id) => { await fetch(`${API_URL}/api/maintenances/${id}`, {method: 'DELETE'}); fetchData(true); },
    finishMaintenance: async (did, m, adm) => { await putData('maintenances/finish', { ...m, deviceId: did, _adminUser: adm }); fetchData(true); },
    addSector: async (s, adm) => { await postData('sectors', { ...s, _adminUser: adm }); fetchData(true); },
    updateSector: async (s, adm) => { await putData('sectors', { ...s, _adminUser: adm }); fetchData(true); },
    deleteSector: async (id) => { await fetch(`${API_URL}/api/sectors/${id}`, {method: 'DELETE'}); fetchData(true); },
    addAccessoryType: async (t, adm) => { await postData('accessory-types', {...t, _adminUser: adm}); fetchData(true); },
    updateAccessoryType: async (t, adm) => { await putData('accessory-types', {...t, _adminUser: adm}); fetchData(true); },
    deleteAccessoryType: async (id) => { await fetch(`${API_URL}/api/accessory-types/${id}`, {method: 'DELETE'}); fetchData(true); },
    addCustomField: async (f, adm) => { await postData('custom-fields', {...f, _adminUser: adm}); fetchData(true); },
    updateCustomField: async (f, adm) => { await putData('custom-fields', {...f, _adminUser: adm}); fetchData(true); },
    deleteCustomField: async (id) => { await fetch(`${API_URL}/api/custom-fields/${id}`, {method: 'DELETE'}); fetchData(true); },
    addSystemUser: async (u, adm) => { await postData('system-users', {...u, _adminUser: adm}); fetchData(true); },
    updateSystemUser: async (u, adm) => { await putData('system-users', {...u, _adminUser: adm}); fetchData(true); },
    deleteSystemUser: async (id) => { await fetch(`${API_URL}/api/system-users/${id}`, {method: 'DELETE'}); fetchData(true); },
    
    // --- Gestão de Tarefas ---
    tasks, taskLogs,
    addTask: async (t, adm) => { 
        const id = Math.random().toString(36).substring(2, 11);
        await postData('tasks', { ...t, id, _adminUser: adm }); 
        fetchData(true); 
    },
    updateTask: async (tid, u, adm) => { 
        await fetch(`${API_URL}/api/tasks/${tid}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ...u, _adminUser: adm }) 
        }); 
        fetchData(true); 
    },
    fetchTaskLogs: async (tid) => {
        const res = await fetch(`${API_URL}/api/tasks/${tid}/logs`);
        return safeJson(res, `/api/tasks/${tid}/logs`);
    },

    updateExternalDbConfig, testExternalDbConnection, fetchExpedienteAlerts, saveExpedienteOverride
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

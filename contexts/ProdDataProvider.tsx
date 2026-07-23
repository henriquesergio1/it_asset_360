
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { useToast } from './ToastContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceStatus, SoftwareAccount, ExternalDbConfig, ExpedienteAlert, Task, TaskLog, DeviceAudit, RhCollaborator, RhDocument, RhOccurrence, RhTermTemplate, RhTerm } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// v3.27.7: Forçando URLs relativas para evitar problemas de porta em produção
const API_URL = ''; 

export const ProdDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const queryClient = useQueryClient();
 const { showToast } = useToast();

 const safeJson = async (res: Response, endpoint: string) => {
 if (!res.ok) {
 const text = await res.text();
 throw new Error(`Erro no endpoint ${endpoint}: ${res.status} ${res.statusText}. Detalhe: ${text.substring(0, 50)}`);
 }
 return res.json();
 };

 const normalizeKeys = (obj: any): any => {
 if (Array.isArray(obj)) return obj.map(normalizeKeys);
 if (obj !== null && typeof obj === 'object') {
 return Object.keys(obj).reduce((acc, key) => {
 const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1);
 acc[normalizedKey] = normalizeKeys(obj[key]);
 return acc;
 }, {} as any);
 }
 return obj;
 };

 const { data: bootstrapData, isLoading: isBootstrapLoading, error: bootstrapError } = useQuery({
 queryKey: ['bootstrap'],
 queryFn: async () => {
 const res = await fetch(`${API_URL}/api/bootstrap`);
 return safeJson(res, '/api/bootstrap');
 },
 staleTime: 0,
 });

 const { data: syncData, isLoading: isSyncLoading, error: syncError } = useQuery({
 queryKey: ['sync'],
 queryFn: async () => {
 const res = await fetch(`${API_URL}/api/sync`);
 return safeJson(res, '/api/sync');
 },
 refetchInterval: 120000,
 refetchOnWindowFocus: false,
 staleTime: 0,
 });

 const { data: externalDbConfigData } = useQuery({
 queryKey: ['externalDbConfig'],
 queryFn: async () => {
 const res = await fetch(`${API_URL}/api/admin/external-db/config`);
 return safeJson(res, '/api/admin/external-db/config');
 },
 staleTime: Infinity,
 refetchOnWindowFocus: false,
 });

 const { data: expedienteAlertsData } = useQuery({
 queryKey: ['expedienteAlerts'],
 queryFn: async () => {
 const res = await fetch(`${API_URL}/api/dashboard/expediente-alerts`);
 return safeJson(res, '/api/dashboard/expediente-alerts');
 },
 refetchInterval: 120000,
 refetchOnWindowFocus: false,
 });

 const { data: consumableTransactionsData } = useQuery({
 queryKey: ['consumableTransactions'],
 queryFn: async () => {
 const res = await fetch(`${API_URL}/api/consumables/transactions`);
 const data = await safeJson(res, '/api/consumables/transactions');
 return normalizeKeys(data);
 },
 refetchInterval: 120000,
 refetchOnWindowFocus: false,
 staleTime: 60000,
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
 const maintenances = syncData?.maintenances || bootstrapData?.maintenances || [];
 const accounts = syncData?.accounts || bootstrapData?.accounts || [];
 const audits = syncData?.audits || bootstrapData?.audits || [];
 const logs = syncData?.logs || bootstrapData?.logs || [];
 
 const tasksData = syncData?.tasks || bootstrapData?.tasks || [];
 const taskLogs = syncData?.taskLogs || bootstrapData?.taskLogs || [];
 const now = new Date();
 const tasks = tasksData.map((task: Task) => {
 let isOverdue = false;
 let isNearDue = false;
 if (task.dueDate) {
 const dueDate = (() => {
    const parts = task.dueDate.split('-');
    return parts.length === 3 
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999)
      : (() => { const d = new Date(task.dueDate); d.setHours(23, 59, 59, 999); return d; })();
  })();
 isOverdue = task.status !== 'Concluída' && task.status !== 'Cancelada' && dueDate < now;
 const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
 isNearDue = task.status !== 'Concluída' && task.status !== 'Cancelada' && !isOverdue && diffDays <= 2;
 }
 return { ...task, isOverdue, isNearDue, hasDueDate: !!task.dueDate };
 });

 const systemUsers = bootstrapData?.systemUsers || [];
 const settings = bootstrapData?.settings || { appName: 'IT Asset', logoUrl: '' };
 const models = (bootstrapData?.models || []).map((m: any) => ({
  ...m,
  imageUrl: `${API_URL}/api/models/${m.id}/image`
 }));
 const brands = bootstrapData?.brands || [];
 const assetTypes = bootstrapData?.assetTypes || [];
 const sectors = bootstrapData?.sectors || [];
 const accessoryTypes = bootstrapData?.accessoryTypes || [];
 const customFields = bootstrapData?.customFields || [];

 const externalDbConfig = externalDbConfigData || null;
 const expedienteAlerts = expedienteAlertsData || [];
 const consumableTransactions = consumableTransactionsData || syncData?.consumableTransactions || bootstrapData?.consumableTransactions || [];
 const consumables = syncData?.consumables || bootstrapData?.consumables || [];

   const rhCollaborators = syncData?.rhCollaborators || bootstrapData?.rhCollaborators || [];
   const rhCompanies = syncData?.rhCompanies || bootstrapData?.rhCompanies || [];
   const rhDependents = syncData?.rhDependents || bootstrapData?.rhDependents || [];
   const rhOccurrences = syncData?.rhOccurrences || bootstrapData?.rhOccurrences || [];
   const rhTemplates = syncData?.rhTemplates || bootstrapData?.rhTemplates || [];
   const rhTerms = syncData?.rhTerms || bootstrapData?.rhTerms || [];
   const rhAssetItems = syncData?.rhAssetItems || bootstrapData?.rhAssetItems || [];
   const rhDocuments = syncData?.rhDocuments || bootstrapData?.rhDocuments || [];
   const rhCareerHistory = syncData?.rhCareerHistory || bootstrapData?.rhCareerHistory || [];
   const profiles = syncData?.profiles || bootstrapData?.profiles || [];

   useEffect(() => {
     if (profiles && profiles.length > 0) {
       try {
         localStorage.setItem('rbac_profiles', JSON.stringify(profiles));
       } catch (e) {}
     }
   }, [profiles]);

 const isReadOnly = !loading && (!settings.licenseExpires || new Date(settings.licenseExpires) <= new Date());

 const checkReadOnly = () => {
  if (isReadOnly) {
  showToast('Sistema em Modo Consulta. Ação não permitida.', 'error');
  return true;
  }
  return false;
 };

  const fetchData = async (silent: boolean = false) => {
    if (silent) {
      await queryClient.refetchQueries({ queryKey: ['sync'] });
    } else {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['bootstrap'] }),
        queryClient.refetchQueries({ queryKey: ['sync'] })
      ]);
    }
  };

 const getLogDetail = async (id: string): Promise<AuditLog> => {
 const res = await fetch(`${API_URL}/api/logs/${id}`);
 return safeJson(res,`/api/logs/${id}`);
 };

   const getTermFile = async (id: string): Promise<string> => {
    const isRh = id.startsWith('rht-');
    const endpoint = isRh ? 'rh-terms' : 'terms';
    const res = await fetch(`${API_URL}/api/${endpoint}/${id}/file`);
    const data = await safeJson(res, `/api/${endpoint}/${id}/file`);
    return data.fileUrl || '';
   };
 
   const getTermEvidences = async (id: string): Promise<string[]> => {
     const isRh = id.startsWith('rht-');
     if (isRh) return [];
     const res = await fetch(`${API_URL}/api/terms/evidence/${id}`);
     const data = await safeJson(res, `/api/terms/evidence/${id}`);
     return data.fileUrls || [];
   };

 const getDeviceInvoice = async (id: string): Promise<string> => {
 const res = await fetch(`${API_URL}/api/devices/${id}/invoice`);
 const data = await safeJson(res,`/api/devices/${id}/invoice`);
 return data.invoiceUrl || '';
 };

 const getMaintenanceInvoice = async (id: string): Promise<string> => {
 const res = await fetch(`${API_URL}/api/maintenances/${id}/invoice`);
 const data = await safeJson(res,`/api/maintenances/${id}/invoice`);
 return data.invoiceUrl || '';
 };

 const postData = async (endpoint: string, data: any) => {
  if (checkReadOnly()) throw new Error('MODO_CONSULTA');
  const res = await fetch(`${API_URL}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return safeJson(res, endpoint);
 };

 const putData = async (endpoint: string, data: any) => {
  if (checkReadOnly()) throw new Error('MODO_CONSULTA');
  const targetId = data.id !== undefined ? data.id : (data.ID_Perfil !== undefined ? data.ID_Perfil : data.Id);
  const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  const url = (targetId !== undefined && (cleanEndpoint.endsWith(`/${targetId}`) || cleanEndpoint.includes(`/${targetId}/`)))
    ? `${API_URL}/api/${cleanEndpoint}`
    : (targetId !== undefined ? `${API_URL}/api/${cleanEndpoint}/${targetId}` : `${API_URL}/api/${cleanEndpoint}`);
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return safeJson(res, endpoint);
 };

 // CRUD Dispositivos
 const addDevice = async (device: Device, adminName: string) => { 
  if (checkReadOnly()) return;
 try {
 await postData('devices', { ...device, _adminUser: adminName }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar dispositivo', 'error');
 }
 };
 const updateDevice = async (device: Device, adminName: string) => { 
  if (checkReadOnly()) return;
 try {
 await putData('devices', { ...device, _adminUser: adminName }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar dispositivo', 'error');
 }
 };
 const deleteDevice = async (id: string, adminName: string, reason: string) => {
  if (checkReadOnly()) return;
 const device = devices.find(d => d.id === id);
 if (device) { 
 try {
 const updatedDevice = { ...device, status: DeviceStatus.RETIRED, currentUserId: null };
 await putData('devices', { ...updatedDevice, _adminUser: adminName, _reason: reason }); 
 fetchData(true);
 } catch (err) {
 showToast('Erro ao baixar dispositivo', 'error');
 }
 }
 };

 const restoreDevice = async (id: string, adminName: string, reason: string) => {
  if (checkReadOnly()) return;
 const device = devices.find(d => d.id === id);
 if (device) { 
 try {
 const restored = { ...device, status: DeviceStatus.AVAILABLE, currentUserId: null };
 await putData('devices', { ...restored, _adminUser: adminName, _reason: reason }); 
 fetchData(true);
 } catch (err) {
 showToast('Erro ao restaurar dispositivo', 'error');
 }
 }
 };

 const addUser = async (user: User, adminName: string) => { 
  if (checkReadOnly()) return;
 try {
 await postData('users', { ...user, _adminUser: adminName }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar colaborador', 'error');
 }
 };
 const updateUser = async (user: User, adminName: string, notes?: string) => { 
  if (checkReadOnly()) return;
 try {
 await putData('users', { ...user, _adminUser: adminName, _notes: notes }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar colaborador', 'error');
 }
 };
 const toggleUserActive = async (user: User, adminName: string, reason?: string) => {
  if (checkReadOnly()) return;
 const newActive = !user.active;
 const updated = { 
 ...user, 
 active: newActive,
 status: newActive ? 'Ativo' : 'Inativo'
 };
 try {
 await putData('users', { ...updated, _adminUser: adminName, _reason: reason });
 fetchData(true);
 } catch (err) {
 showToast(`Erro ao ${newActive ? 'ativar' : 'inativar'} colaborador`, 'error');
 }
 };

 const addAccount = async (account: SoftwareAccount, adminName: string) => { 
  if (checkReadOnly()) return;
 try {
 await postData('accounts', { ...account, _adminUser: adminName }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar licença/conta', 'error');
 }
 };
 const updateAccount = async (account: SoftwareAccount, adminName: string) => { 
  if (checkReadOnly()) return;
 try {
 await putData('accounts', { ...account, _adminUser: adminName }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar licença/conta', 'error');
 }
 };
 const deleteAccount = async (id: string, adminName: string) => {
  if (checkReadOnly()) return;
 try {
 await fetch(`${API_URL}/api/accounts/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _adminUser: adminName }) });
 fetchData(true);
 } catch (err) {
 showToast('Erro ao excluir licença/conta', 'error');
 }
 };

 const updateTermFile = async (termId: string, userId: string, fileUrl: string, adminName: string) => {
  if (checkReadOnly()) return;
 try { 
 const isRh = termId.startsWith('rht-');
 if (isRh) {
   await putData('rh-terms/file', { id: termId, fileUrl, _adminUser: adminName });
 } else {
   await putData('terms/file', { id: termId, fileUrl, _adminUser: adminName }); 
 }
 fetchData(true); 
 } catch (err) { 
 showToast('Falha ao salvar arquivo do termo', 'error'); 
 }
 };

 const updateTermDetails = async (termId: string, condition: string, damageDescription: string, assetDetails: string, notes: string, evidenceFiles: string[], adminName: string, accessories?: { id: string; name: string }[], linkedSim?: SimCard) => {
  if (checkReadOnly()) return;
 try { 
 await putData('terms', { id: termId, condition, damageDescription, assetDetails, notes, evidenceFiles, _adminUser: adminName, accessories, linkedSim }); 
 fetchData(true); 
 } catch (err) { 
 showToast('Falha ao atualizar detalhes do termo', 'error'); 
 }
 };

  const resolveTermManual = async (termId: string, reason: string, adminName: string) => {
    if (checkReadOnly()) return;
    try {
      const isRh = termId.startsWith('rht-');
      const endpoint = isRh ? 'rh-terms' : 'terms';
      await fetch(`${API_URL}/api/${endpoint}/resolve/${termId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, _adminUser: adminName })
      });
      await fetchData(true);
    } catch (err) {
      showToast('Erro ao resolver termo manualmente', 'error');
    }
  };

 const deleteTermFile = async (termId: string, userId: string, reason: string, adminName: string) => {
  if (checkReadOnly()) return;
 try { 
 const isRh = termId.startsWith('rht-');
 const endpoint = isRh ? 'rh-terms' : 'terms';
 await fetch(`${API_URL}/api/${endpoint}/${termId}/file`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ _adminUser: adminName, reason }) }); 
 fetchData(true); 
 } catch (err) { 
 showToast('Falha ao excluir arquivo do termo', 'error'); 
 }
 };

 const addSim = async (s: SimCard, a: string) => { 
  if (checkReadOnly()) return;
 try {
 await postData('sims', {...s, _adminUser: a}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar chip', 'error');
 }
 };
 const updateSim = async (s: SimCard, a: string) => { 
  if (checkReadOnly()) return;
 try {
 await putData('sims', {...s, _adminUser: a}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar chip', 'error');
 }
 };
 const deleteSim = async (id: string, a: string, r: string) => { 
  if (checkReadOnly()) return;
 try {
 await fetch(`${API_URL}/api/sims/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({_adminUser: a, reason: r}) });
 fetchData(true);
 } catch (err) {
 showToast('Erro ao excluir chip', 'error');
 }
 };

 const fetchExpedienteAlerts = async () => {
 await queryClient.invalidateQueries({ queryKey: ['expedienteAlerts'] });
 };

 const saveExpedienteOverride = async (codigo: string, observation: string, reactivationDate: string | null) => {
  if (checkReadOnly()) return;
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
 showToast('Erro ao salvar ajuste de expediente', 'error');
 throw err;
 }
 };

 const updateExternalDbConfig = async (config: ExternalDbConfig, adminName: string) => {
  if (checkReadOnly()) return;
 try {
 await postData('admin/external-db/config', { ...config, _adminUser: adminName });
 await queryClient.invalidateQueries({ queryKey: ['externalDbConfig'] });
 } catch (err) {
 showToast('Erro ao atualizar configuração de banco externo', 'error');
 }
 };

 const testExternalDbConnection = async (config: ExternalDbConfig) => {
   const res = await fetch(`${API_URL}/api/admin/external-db/test`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(config)
   });
   return safeJson(res, '/api/admin/external-db/test');
 };

 const updateLicense = async (licenseKey: string) => {
   try {
     const res = await fetch(`${API_URL}/api/license/update`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ licenseKey })
     });
     if (res.ok) {
       await queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
       return { success: true };
     }
     const data = await res.json();
     return { success: false, error: data.error || 'Erro ao atualizar licença' };
   } catch (err) {
     return { success: false, error: 'Erro de conexão com o servidor' };
   }
 };

 const getLicenseStatus = async () => {
   try {
     const res = await fetch(`${API_URL}/api/license/status`);
     if (res.ok) {
       return await res.json();
     }
     return { status: 'EXPIRED', client: 'Erro', expiresAt: null };
   } catch (err) {
     return { status: 'EXPIRED', client: 'Erro de Conexão', expiresAt: null };
   }
 };

 const fetchConsumableTransactions = async () => {
   const res = await fetch(`${API_URL}/api/consumables/transactions`);
   return safeJson(res, '/api/consumables/transactions');
 };

 const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    accounts, externalDbConfig, expedienteAlerts, consumables, consumableTransactions, audits,
    rhCollaborators, rhCompanies, rhDependents, rhOccurrences, rhTemplates, rhTerms, rhAssetItems, rhDocuments, rhCareerHistory, profiles,
    addRbacProfile: async (p, adm) => {
      try {
        await postData('rbac-profiles', { ...p, _adminUser: adm });
        fetchData(true);
      } catch (err) {
        showToast('Erro ao criar perfil de acesso', 'error');
      }
    },
    updateRbacProfile: async (p, adm) => {
      try {
        await putData('rbac-profiles', { ...p, id: p.ID_Perfil, _adminUser: adm });
        fetchData(true);
      } catch (err) {
        showToast('Erro ao atualizar perfil de acesso', 'error');
      }
    },
    deleteRbacProfile: async (id, adm) => {
      try {
        const res = await fetch(`${API_URL}/api/rbac-profiles/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _adminUser: adm })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text);
        }
        fetchData(true);
      } catch (err) {
        showToast('Erro ao excluir perfil de acesso', 'error');
      }
    },
    fetchData, refreshData: fetchData, fetchConsumableTransactions, getTermFile, getTermEvidences, getDeviceInvoice, getMaintenanceInvoice, getLogDetail,
   addAccount, updateAccount, deleteAccount, addDevice, updateDevice, deleteDevice, restoreDevice, addSim, updateSim, deleteSim, addUser, updateUser, toggleUserActive, 
   addAudit: async (audit: DeviceAudit, admin: string) => { 
     if (checkReadOnly()) return;
     try {
       await postData('audits', { ...audit, _adminUser: admin }); 
       showToast('Auditoria técnica registrada com sucesso', 'success');
       fetchData(true); 
     } catch (err) {
       showToast('Erro ao registrar auditoria técnica', 'error');
     }
   }, 
   deleteAudit: async (id: string, admin: string) => { 
     if (checkReadOnly()) return;
     try {
       await fetch(`${API_URL}/api/audits/${id}`, { 
         method: 'DELETE', 
         headers: { 'Content-Type': 'application/json' }, 
         body: JSON.stringify({ _adminUser: admin }) 
       });
       showToast('Auditoria técnica removida', 'success');
       fetchData(true); 
     } catch (err) {
       showToast('Erro ao remover auditoria técnica', 'error');
     }
   },
   updateLicense, getLicenseStatus,
   isReadOnly,
   updateSettings: async (s: SystemSettings, a: string) => { 
 try {
 await fetch(`${API_URL}/api/settings`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...s, _adminUser: a}) }); 
 await queryClient.invalidateQueries({ queryKey: ['bootstrap'] }); 
 } catch (err) {
 showToast('Erro ao atualizar configurações do sistema', 'error');
 }
 },
 assignAsset: async (at, aid, uid, n, adm, acc, syncSector) => { 
 try {
 await postData('operations/checkout', { assetId: aid, assetType: at, userId: uid, notes: n, _adminUser: adm, accessories: acc, syncSector }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atribuir ativo', 'error');
 }
 },
 returnAsset: async (at, aid, n, adm, list, inactivate, cond, desc, evids, isManual, resolutionReason, returningUserId) => { 
 try {
 await postData('operations/checkin', { assetId: aid, assetType: at, notes: n, _adminUser: adm, returnedChecklist: list, inactivateUser: inactivate, condition: cond, damageDescription: desc, evidenceFiles: evids, isManual, resolutionReason, returningUserId }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao devolver ativo', 'error');
 }
 },
 updateTermFile, deleteTermFile, updateTermDetails, resolveTermManual,
 clearLogs: async () => { 
 try {
 await fetch(`${API_URL}/api/logs`, { method: 'DELETE' }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao limpar logs', 'error');
 }
 },
 restoreItem: async (lid, adm) => { 
 try {
 await postData('restore', { logId: lid, _adminUser: adm }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao restaurar item', 'error');
 }
 },
 // Fix: replaced 'a' with 'adm' to match function parameters
 addAssetType: async (t, adm) => { 
 try {
 await postData('asset-types', {...t, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar tipo de ativo', 'error');
 }
 },
 updateAssetType: async (t, adm) => { 
 try {
 await putData('asset-types', {...t, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar tipo de ativo', 'error');
 }
 },
 deleteAssetType: async (id) => { 
 try {
 await fetch(`${API_URL}/api/asset-types/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir tipo de ativo', 'error');
 }
 },
 addBrand: async (b, adm) => { 
 try {
 await postData('brands', {...b, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar marca', 'error');
 }
 },
 updateBrand: async (b, adm) => { 
 try {
 await putData('brands', {...b, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar marca', 'error');
 }
 },
 deleteBrand: async (id) => { 
 try {
 await fetch(`${API_URL}/api/brands/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir marca', 'error');
 }
 },
 addModel: async (m, adm) => { 
 try {
 await postData('models', {...m, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar modelo', 'error');
 }
 },
 updateModel: async (m, adm) => { 
 try {
 await putData('models', {...m, _adminName: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar modelo', 'error');
 }
 },
 deleteModel: async (id) => { 
 try {
 await fetch(`${API_URL}/api/models/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir modelo', 'error');
 }
 },
 addMaintenance: async (m, adm) => { 
 try {
 await postData('maintenances', {...m, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao registrar manutenção', 'error');
 }
 },
 deleteMaintenance: async (id) => { 
 try {
 await fetch(`${API_URL}/api/maintenances/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir manutenção', 'error');
 }
 },
 finishMaintenance: async (did, m, adm) => { 
 try {
 await putData('maintenances/finish', { ...m, deviceId: did, _adminUser: adm }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao finalizar manutenção', 'error');
 }
 },
 addSector: async (s, adm) => { 
 try {
 await postData('sectors', { ...s, _adminUser: adm }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar setor', 'error');
 }
 },
 updateSector: async (s, adm) => { 
 try {
 await putData('sectors', { ...s, _adminUser: adm }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar setor', 'error');
 }
 },
 deleteSector: async (id) => { 
 try {
 await fetch(`${API_URL}/api/sectors/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir setor', 'error');
 }
 },
 addAccessoryType: async (t, adm) => { 
 try {
 await postData('accessory-types', {...t, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar tipo de acessório', 'error');
 }
 },
 updateAccessoryType: async (t, adm) => { 
 try {
 await putData('accessory-types', {...t, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar tipo de acessório', 'error');
 }
 },
 deleteAccessoryType: async (id) => { 
 try {
 await fetch(`${API_URL}/api/accessory-types/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir tipo de acessório', 'error');
 }
 },
 addCustomField: async (f, adm) => { 
 try {
 await postData('custom-fields', {...f, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar campo personalizado', 'error');
 }
 },
 updateCustomField: async (f, adm) => { 
 try {
 await putData('custom-fields', {...f, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar campo personalizado', 'error');
 }
 },
 deleteCustomField: async (id) => { 
  if (checkReadOnly()) return;
 try {
 await fetch(`${API_URL}/api/custom-fields/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir campo personalizado', 'error');
 }
 },
 addSystemUser: async (u, adm) => { 
  if (checkReadOnly()) return;
 try {
 await postData('system-users', {...u, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao cadastrar usuário do sistema', 'error');
 }
 },
 updateSystemUser: async (u, adm) => { 
  if (checkReadOnly()) return;
 try {
 await putData('system-users', {...u, _adminUser: adm}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar usuário do sistema', 'error');
 }
 },
 deleteSystemUser: async (id) => { 
  if (checkReadOnly()) return;
 try {
 await fetch(`${API_URL}/api/system-users/${id}`, {method: 'DELETE'}); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao excluir usuário do sistema', 'error');
 }
 },
 
 // --- Gestão de Tarefas ---
 tasks, taskLogs,
 addTask: async (t, adm) => { 
  if (checkReadOnly()) return;
 try {
 const id = Math.random().toString(36).substring(2, 11);
 await postData('tasks', { ...t, id, _adminUser: adm }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao criar tarefa', 'error');
 }
 },
 updateTask: async (tid, u, adm) => { 
  if (checkReadOnly()) return;
 try {
 await fetch(`${API_URL}/api/tasks/${tid}`, { 
 method: 'PUT', 
 headers: { 'Content-Type': 'application/json' }, 
 body: JSON.stringify({ ...u, _adminUser: adm }) 
 }); 
 fetchData(true); 
 } catch (err) {
 showToast('Erro ao atualizar tarefa', 'error');
 }
 },
 bulkUpdateTasks: async (taskIds, updates, adm) => {
  if (checkReadOnly()) return;
 try {
 await fetch(`${API_URL}/api/tasks/bulk`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ids: taskIds, updates, _adminUser: adm })
 });
 fetchData(true);
 } catch (err) {
 showToast('Erro na atualização em massa de tarefas', 'error');
 }
 },
 bulkUpdateDevices: async (deviceIds, updates, adm) => {
  if (checkReadOnly()) return;
 try {
 await fetch(`${API_URL}/api/devices/bulk`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ids: deviceIds, updates, _adminUser: adm })
 });
 fetchData(true);
 } catch (err) {
 showToast('Erro na atualização em massa de dispositivos', 'error');
 }
 },
 fetchTaskLogs: async (tid) => {
 const res = await fetch(`${API_URL}/api/tasks/${tid}/logs`);
 return safeJson(res,`/api/tasks/${tid}/logs`);
 },

 generateSignatureToken: async (termId) => {
  const isRh = termId.startsWith('rht-');
  const endpoint = isRh ? 'rh-terms' : 'terms';
  const res = await postData(`${endpoint}/${termId}/generate-signature-token`, {});
  return res.token;
 },
 updateExternalDbConfig, testExternalDbConnection, fetchExpedienteAlerts, saveExpedienteOverride,
  addRhCompany: async (company: any, adminName: string) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-companies', { ...company, _adminUser: adminName });
      fetchData(true);
      showToast('Empresa cadastrada com sucesso!', 'success');
    } catch (err) {
      showToast('Erro ao cadastrar empresa', 'error');
    }
  },
  addRhCollaborator: async (c) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-collaborators', c);
      fetchData(true);
      showToast('Colaborador cadastrado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao cadastrar colaborador', 'error');
    }
  },
  updateRhCollaborator: async (c) => {
    if (checkReadOnly()) return;
    try {
      await putData('rh-collaborators', c);
      fetchData(true);
      showToast('Colaborador atualizado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao atualizar colaborador', 'error');
    }
  },
  deleteRhCollaborator: async (id) => {
    if (checkReadOnly()) return;
    try {
      await fetch(`${API_URL}/api/rh-collaborators/${id}`, { method: 'DELETE' });
      fetchData(true);
      showToast('Colaborador excluído do R.H.', 'success');
    } catch (err) {
      showToast('Erro ao excluir colaborador', 'error');
    }
  },
  addRhDependent: async (d) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-dependents', d);
      fetchData(true);
      showToast('Dependente cadastrado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao cadastrar dependente', 'error');
    }
  },
  updateRhDependent: async (d) => {
    if (checkReadOnly()) return;
    try {
      await putData('rh-dependents', d);
      fetchData(true);
      showToast('Dependente atualizado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao atualizar dependente', 'error');
    }
  },
  deleteRhDependent: async (id) => {
    if (checkReadOnly()) return;
    try {
      await fetch(`${API_URL}/api/rh-dependents/${id}`, { method: 'DELETE' });
      fetchData(true);
      showToast('Dependente excluído do R.H.', 'success');
    } catch (err) {
      showToast('Erro ao excluir dependente', 'error');
    }
  },
  addRhOccurrence: async (o) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-occurrences', o);
      fetchData(true);
      showToast('Ocorrência registrada no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao registrar ocorrência', 'error');
    }
  },
  deleteRhOccurrence: async (id, adminName, reason) => {
    if (checkReadOnly()) return;
    try {
      await fetch(`${API_URL}/api/rh-occurrences/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _adminUser: adminName, reason: reason || 'Não informado' })
      });
      fetchData(true);
      showToast('Ocorrência removida do R.H.', 'success');
    } catch (err) {
      showToast('Erro ao remover ocorrência', 'error');
    }
  },
  addRhTemplate: async (t) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-templates', t);
      fetchData(true);
      showToast('Modelo de termo cadastrado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao cadastrar modelo de termo', 'error');
    }
  },
  updateRhTemplate: async (t) => {
    if (checkReadOnly()) return;
    try {
      await putData('rh-templates', t);
      fetchData(true);
      showToast('Modelo de termo atualizado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao atualizar modelo de termo', 'error');
    }
  },
  deleteRhTemplate: async (id) => {
    if (checkReadOnly()) return;
    try {
      await fetch(`${API_URL}/api/rh-templates/${id}`, { method: 'DELETE' });
      fetchData(true);
      showToast('Modelo de termo excluído do R.H.', 'success');
    } catch (err) {
      showToast('Erro ao excluir modelo de termo', 'error');
    }
  },
  addRhTerm: async (t) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-terms', t);
      fetchData(true);
      showToast('Termo gerado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao gerar termo', 'error');
    }
  },
  updateRhTerm: async (t) => {
    if (checkReadOnly()) return;
    try {
      await putData('rh-terms', t);
      fetchData(true);
      showToast('Termo atualizado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao atualizar termo', 'error');
    }
  },
  addRhAssetItem: async (item) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-assets', item);
      fetchData(true);
      showToast('Item cadastrado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao cadastrar item', 'error');
    }
  },
  updateRhAssetItem: async (item) => {
    if (checkReadOnly()) return;
    try {
      await putData('rh-assets', item);
      fetchData(true);
      showToast('Item atualizado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao atualizar item', 'error');
    }
  },
  deleteRhAssetItem: async (id) => {
    if (checkReadOnly()) return;
    try {
      await fetch(`${API_URL}/api/rh-assets/${id}`, { method: 'DELETE' });
      fetchData(true);
      showToast('Item excluído do R.H.', 'success');
    } catch (err) {
      showToast('Erro ao excluir item', 'error');
    }
  },
  addRhDocument: async (doc, adminName) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-documents', { ...doc, _adminUser: adminName });
      fetchData(true);
      showToast('Documento registrado no R.H.', 'success');
    } catch (err) {
      showToast('Erro ao anexar documento', 'error');
    }
  },
  deleteRhDocument: async (id, adminName) => {
    if (checkReadOnly()) return;
    try {
      await fetch(`${API_URL}/api/rh-documents/${id}`, { method: 'DELETE' });
      fetchData(true);
      showToast('Documento removido do R.H.', 'success');
    } catch (err) {
      showToast('Erro ao excluir documento', 'error');
    }
  },
  addRhCareerHistory: async (record, adminName) => {
    if (checkReadOnly()) return;
    try {
      await postData('rh-career-history', { ...record, _adminUser: adminName });
      fetchData(true);
      showToast('Histórico de cargo/salário salvo.', 'success');
    } catch (err) {
      showToast('Erro ao salvar histórico de cargo/salário', 'error');
    }
  },
  deleteRhCareerHistory: async (id, adminName) => {
    if (checkReadOnly()) return;
    try {
      await fetch(`${API_URL}/api/rh-career-history/${id}`, { method: 'DELETE' });
      fetchData(true);
      showToast('Registro de histórico excluído.', 'success');
    } catch (err) {
      showToast('Erro ao excluir histórico', 'error');
    }
  }
 };
 return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

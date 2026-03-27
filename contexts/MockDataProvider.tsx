
import React, { useState } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { useToast } from './ToastContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemRole, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceAccessory, SoftwareAccount, AccountType, ExternalDbConfig, ExpedienteAlert, Task, TaskLog, TaskStatus, TaskType, RecurrenceType, TaskRecurrenceConfig } from '../types';
import { mockDevices, mockSims, mockUsers, mockAuditLogs, mockSystemUsers, mockSystemSettings, mockModels, mockBrands, mockAssetTypes, mockMaintenanceRecords, mockSectors, mockAccessoryTypes } from '../services/mockService';

export const MockDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const { showToast } = useToast();
 const [devices, setDevices] = useState<Device[]>(mockDevices);
 const [sims, setSims] = useState<SimCard[]>(mockSims);
 const [users, setUsers] = useState<User[]>(mockUsers);
 const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs);
 const [systemUsers, setSystemUsers] = useState<SystemUser[]>(mockSystemUsers);
 
 const [settings, setSettings] = useState<SystemSettings>(() => {
 const stored = localStorage.getItem('mock_settings');
 return stored ? JSON.parse(stored) : mockSystemSettings;
 });
 
 const [models, setModels] = useState<DeviceModel[]>(mockModels);
 const [brands, setBrands] = useState<DeviceBrand[]>(mockBrands);
 const [assetTypes, setAssetTypes] = useState<AssetType[]>(mockAssetTypes);
 const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>(mockMaintenanceRecords);
 const [sectors, setSectors] = useState<UserSector[]>(mockSectors);
 const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>(mockAccessoryTypes || []);
 const [customFields, setCustomFields] = useState<CustomField[]>([]);
 const [accounts, setAccounts] = useState<SoftwareAccount[]>([]);
 const [tasks, setTasks] = useState<Task[]>([]);
 const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);

 const [externalDbConfig, setExternalDbConfig] = useState<ExternalDbConfig | null>(null);
 const [expedienteAlerts, setExpedienteAlerts] = useState<ExpedienteAlert[]>([]);

 const logAction = (
 action: ActionType, 
 assetType: 'Device' | 'Sim' | 'User' | 'System' | 'Model' | 'Brand' | 'Type' | 'Sector' | 'Accessory' | 'CustomField' | 'Account', 
 assetId: string, 
 targetName: string, 
 adminName: string, 
 notes?: string,
 backupData?: string,
 previousData?: any,
 newData?: any
 ) => {
 const newLog: AuditLog = {
 id: Math.random().toString(36).substr(2, 9),
 assetId,
 assetType,
 targetName,
 action,
 timestamp: new Date().toISOString(),
 adminUser: adminName,
 notes,
 backupData,
 previousData: previousData ? (typeof previousData === 'string' ? previousData : JSON.stringify(previousData)) : undefined,
 newData: newData ? (typeof newData === 'string' ? newData : JSON.stringify(newData)) : undefined
 };
 setLogs(prev => [newLog, ...prev]);
 };

 const clearLogs = () => { setLogs([]); };

 const restoreItem = (logId: string, adminName: string) => {
 const log = logs.find(l => l.id === logId);
 if (!log || !log.backupData) {
 showToast('Dados de backup não encontrados para este item.', 'error');
 return;
 }
 try {
 const data = JSON.parse(log.backupData);
 if (log.assetType === 'Device') { setDevices(prev => [...prev, data]); } 
 else if (log.assetType === 'Sim') { setSims(prev => [...prev, data]); } 
 else { showToast('Restauração disponível apenas para Dispositivos e Chips no momento.', 'error'); return; }
 logAction(ActionType.RESTORE, log.assetType, log.assetId, log.targetName || 'Item Restaurado', adminName,`Restaurado a partir do log.`);
 showToast('Item restaurado com sucesso!');
 } catch (e) {
 showToast('Erro ao processar dados de backup.', 'error');
 }
 };

 const addDevice = (device: Device, adminName: string) => {
 setDevices(prev => [...prev, device]);
 const model = models.find(m => m.id === device.modelId);
 logAction(ActionType.create, 'Device', device.id, model?.name || 'Unknown', adminName,`Tag: ${device.assetTag}`);
 showToast('Dispositivo cadastrado com sucesso!');
 };

 const updateDevice = (device: Device, adminName: string) => {
 const old = devices.find(d => d.id === device.id);
 setDevices(prev => prev.map(d => d.id === device.id ? device : d));
 const model = models.find(m => m.id === device.modelId);
 logAction(ActionType.UPDATE, 'Device', device.id, model?.name || 'Unknown', adminName, '', undefined, old, device);
 showToast('Dispositivo atualizado com sucesso!');
 };

 const deleteDevice = (id: string, adminName: string, reason: string) => {
 const dev = devices.find(d => d.id === id);
 setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.RETIRED, currentUserId: null } : d));
 if (dev) logAction(ActionType.DELETE, 'Device', id, dev.assetTag, adminName,`Motivo: ${reason}`, JSON.stringify(dev));
 showToast('Dispositivo baixado com sucesso!');
 };

 const restoreDevice = (id: string, adminName: string, reason: string) => {
 const dev = devices.find(d => d.id === id);
 setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
 if (dev) logAction(ActionType.RESTORE, 'Device', id, dev.assetTag, adminName,`Motivo: ${reason}`);
 showToast('Dispositivo restaurado com sucesso!');
 };

 const addSim = (sim: SimCard, adminName: string) => { 
 setSims(prev => [...prev, sim]); 
 logAction(ActionType.create, 'Sim', sim.id, sim.phoneNumber, adminName); 
 showToast('Chip cadastrado com sucesso!');
 };
 const updateSim = (sim: SimCard, adminName: string) => { 
 const old = sims.find(s => s.id === sim.id);
 setSims(prev => prev.map(s => s.id === sim.id ? sim : s)); 
 logAction(ActionType.UPDATE, 'Sim', sim.id, sim.phoneNumber, adminName, '', undefined, old, sim); 
 showToast('Chip atualizado com sucesso!');
 };
 const deleteSim = (id: string, adminName: string, reason: string) => { 
 setSims(prev => prev.filter(s => s.id !== id)); 
 const sim = sims.find(s => s.id === id); 
 if (sim) logAction(ActionType.DELETE, 'Sim', id, sim.phoneNumber, adminName,`Motivo: ${reason}`); 
 showToast('Chip excluído com sucesso!');
 };

 const addUser = (user: User, adminName: string) => { 
 setUsers(prev => [...prev, user]); 
 logAction(ActionType.create, 'User', user.id, user.fullName, adminName); 
 showToast('Colaborador cadastrado com sucesso!');
 };
 const updateUser = (user: User, adminName: string, notes?: string) => { 
 const old = users.find(u => u.id === user.id);
 setUsers(prev => prev.map(u => u.id === user.id ? user : u)); 
 logAction(ActionType.UPDATE, 'User', user.id, user.fullName, adminName, notes, undefined, old, user); 
 showToast('Colaborador atualizado com sucesso!');
 };
 const toggleUserActive = (user: User, adminName: string, reason?: string) => {
 const old = { ...user };
 const updatedUser = { ...user, active: !user.active };
 setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
 logAction(updatedUser.active ? ActionType.ACTIVATE : ActionType.INACTIVATE, 'User', user.id, user.fullName, adminName, reason, undefined, old, updatedUser);
 showToast(`Colaborador ${updatedUser.active ? 'ativado' : 'inativado'} com sucesso!`);
 };

 const addAccount = (acc: SoftwareAccount, adminName: string) => { 
 setAccounts(prev => [...prev, acc]); 
 logAction(ActionType.create, 'Account', acc.id, acc.login, adminName, acc.name); 
 showToast('Licença/Conta cadastrada com sucesso!');
 };
 const updateAccount = (acc: SoftwareAccount, adminName: string) => { 
 const old = accounts.find(a => a.id === acc.id);
 setAccounts(prev => prev.map(a => a.id === acc.id ? acc : a)); 
 logAction(ActionType.UPDATE, 'Account', acc.id, acc.login, adminName, acc.name, undefined, old, acc); 
 showToast('Licença/Conta atualizada com sucesso!');
 };
 const deleteAccount = (id: string, adminName: string) => { 
 const acc = accounts.find(a => a.id === id); 
 setAccounts(prev => prev.filter(a => a.id !== id)); 
 if (acc) logAction(ActionType.DELETE, 'Account', id, acc.login, adminName); 
 showToast('Licença/Conta excluída com sucesso!');
 };

 const addSector = (sector: UserSector, adminName: string) => { 
 setSectors(prev => [...prev, sector]); 
 logAction(ActionType.create, 'Sector', sector.id, sector.name, adminName); 
 showToast('Setor cadastrado com sucesso!');
 };
 const updateSector = (sector: UserSector, adminName: string) => { 
 const old = sectors.find(s => s.id === sector.id);
 setSectors(prev => prev.map(s => s.id === sector.id ? sector : s)); 
 logAction(ActionType.UPDATE, 'Sector', sector.id, sector.name, adminName, '', undefined, old, sector); 
 showToast('Setor atualizado com sucesso!');
 };
 const deleteSector = (id: string, adminName: string) => { 
 setSectors(prev => prev.filter(s => s.id !== id)); 
 logAction(ActionType.DELETE, 'Sector', id, 'Setor', adminName); 
 showToast('Setor excluído com sucesso!');
 };

 const updateSettings = (newSettings: SystemSettings, adminName: string) => { 
 const old = { ...settings };
 setSettings(newSettings); 
 localStorage.setItem('mock_settings', JSON.stringify(newSettings)); 
 logAction(ActionType.UPDATE, 'System', 'settings', 'Configurações', adminName, '', undefined, old, newSettings); 
 showToast('Configurações do sistema atualizadas com sucesso!');
 };

 const calculateNextDate = (config: TaskRecurrenceConfig, baseDateStr: string): string => {
 const baseDate = new Date(baseDateStr);
 let nextDate = new Date(baseDate);

 if (config.type === RecurrenceType.MONTHLY_DAY) {
 nextDate.setMonth(nextDate.getMonth() + 1);
 if (config.dayOfMonth) {
 nextDate.setDate(config.dayOfMonth);
 }
 } else if (config.type === RecurrenceType.MONTHLY_WEEKDAY) {
 nextDate.setMonth(nextDate.getMonth() + 1);
 nextDate.setDate(1);
 
 if (config.dayOfWeek !== undefined && config.weekOfMonth !== undefined) {
 // Encontrar a primeira ocorrência do dia da semana
 while (nextDate.getDay() !== config.dayOfWeek) {
 nextDate.setDate(nextDate.getDate() + 1);
 }
 
 if (config.weekOfMonth === 5) { // Última
 const lastDate = new Date(nextDate);
 while (lastDate.getMonth() === nextDate.getMonth()) {
 nextDate.setTime(lastDate.getTime());
 lastDate.setDate(lastDate.getDate() + 7);
 }
 } else {
 nextDate.setDate(nextDate.getDate() + (config.weekOfMonth - 1) * 7);
 }
 }
 } else if (config.type === RecurrenceType.INTERVAL_MONTHS) {
 nextDate.setMonth(nextDate.getMonth() + (config.intervalMonths || 1));
 }

 return nextDate.toISOString().split('T')[0];
 };

 const value: DataContextType = {
 devices, sims, users, loading: false, error: null, systemUsers, settings,
 models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields, accounts,
 externalDbConfig, expedienteAlerts,
 fetchData: async (silent?: boolean) => { console.log("[Mock] Sync skipped."); },
 refreshData: async () => { console.log("[Mock] Data refreshed."); },
 getTermFile: async (id: string) =>"",
 getDeviceInvoice: async (id: string) =>"",
 getMaintenanceInvoice: async (id: string) =>"",
 // Fix: implemented getLogDetail to satisfy DataContextType
 getLogDetail: async (id: string) => {
 const log = logs.find(l => l.id === id);
 if (!log) throw new Error("Log não encontrado");
 return log;
 },
 addDevice, updateDevice, deleteDevice, restoreDevice, 
 addSim, updateSim, deleteSim,
 addUser, updateUser, toggleUserActive,
 addSector, updateSector, deleteSector,
 addAccount, updateAccount, deleteAccount,
 addSystemUser: (u, adm) => { 
 setSystemUsers(p => [...p, u]); 
 showToast('Usuário do sistema cadastrado com sucesso!');
 },
 updateSystemUser: (u, adm) => { 
 const old = systemUsers.find(x => x.id === u.id);
 setSystemUsers(p => p.map(x => x.id === u.id ? u : x)); 
 logAction(ActionType.UPDATE, 'System', u.id, u.name, adm, '', undefined, old, u);
 showToast('Usuário do sistema atualizado com sucesso!');
 },
 deleteSystemUser: (id, adm) => { 
 setSystemUsers(p => p.filter(x => x.id !== id)); 
 showToast('Usuário do sistema excluído com sucesso!');
 },
 updateSettings,
 
 // --- Gestão de Tarefas ---
 tasks: tasks.map(task => {
 let isOverdue = false;
 let isNearDue = false;
 if (task.dueDate) {
 const now = new Date();
 const dueDate = new Date(task.dueDate);
 isOverdue = task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELED && dueDate < now;
 const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
 isNearDue = task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELED && !isOverdue && diffDays <= 2;
 }
 return { ...task, isOverdue, isNearDue };
 }), 
 taskLogs,
 addTask: async (t, adm) => {
 const newTask: Task = {
 id: Math.random().toString(36).substr(2, 9),
 title: t.title || '',
 description: t.description || '',
 type: t.type || TaskType.OTHER,
 status: TaskStatus.PENDING,
 createdAt: new Date().toISOString(),
 hasDueDate: t.hasDueDate || false,
 dueDate: t.hasDueDate ? t.dueDate : undefined,
 assignedTo: t.assignedTo,
 instructions: t.instructions,
 manualAttachments: t.manualAttachments || [],
 evidenceUrls: [],
 isRecurring: t.isRecurring || false,
 recurrenceConfig: t.recurrenceConfig,
 parentId: t.parentId
 };
 setTasks(prev => [...prev, newTask]);
 const log: TaskLog = {
 id: Math.random().toString(36).substr(2, 9),
 taskId: newTask.id,
 action: 'Tarefa Criada',
 adminUser: adm,
 timestamp: new Date().toISOString()
 };
 setTaskLogs(prev => [...prev, log]);
 showToast('Tarefa criada com sucesso!');
 },
 updateTask: async (tid, u, adm) => {
 let taskToRepeat: Task | null = null;
 
 const { _actionNote, ...updates } = u;

 setTasks(prev => {
 const updated = prev.map(t => {
 if (t.id === tid) {
 const newTaskState = Object.keys(updates).length > 0 
 ? { 
 ...t, 
 ...updates,
 dueDate: updates.dueDate !== undefined ? updates.dueDate : t.dueDate 
 }
 : t;
 if (updates.status === TaskStatus.COMPLETED && t.isRecurring && !t.parentId) {
 taskToRepeat = newTaskState;
 }
 return newTaskState;
 }
 return t;
 });
 return updated;
 });

 // Se houver recorrência, geramos a próxima tarefa
 if (taskToRepeat) {
 const config = (taskToRepeat as Task).recurrenceConfig;
 if (config && config.type !== RecurrenceType.NONE) {
 const nextDueDate = calculateNextDate(config, (taskToRepeat as Task).dueDate || (taskToRepeat as Task).createdAt);
 
 const nextTask: Task = {
 id: Math.random().toString(36).substr(2, 9),
 title: (taskToRepeat as Task).title,
 description: (taskToRepeat as Task).description,
 type: (taskToRepeat as Task).type,
 status: TaskStatus.PENDING,
 createdAt: new Date().toISOString(),
 hasDueDate: (taskToRepeat as Task).hasDueDate,
 dueDate: nextDueDate,
 assignedTo: (taskToRepeat as Task).assignedTo,
 evidenceUrls: [],
 isRecurring: true,
 recurrenceConfig: config
 // parentId: (taskToRepeat as Task).id // Opcional: manter rastro
 };
 
 setTimeout(() => {
 setTasks(prev => [...prev, nextTask]);
 const log: TaskLog = {
 id: Math.random().toString(36).substr(2, 9),
 taskId: nextTask.id,
 action: 'Tarefa Recorrente Gerada',
 adminUser: 'Sistema',
 timestamp: new Date().toISOString(),
 notes:`Gerada automaticamente a partir da tarefa concluída: ${tid}`
 };
 setTaskLogs(prev => [...prev, log]);
 }, 500);
 }
 }

 const log: TaskLog = {
 id: Math.random().toString(36).substr(2, 9),
 taskId: tid,
 action: u.status ?`Status alterado para ${u.status}`: 'Tarefa Atualizada',
 adminUser: adm,
 timestamp: new Date().toISOString(),
 notes: u._actionNote
 };
 setTaskLogs(prev => [...prev, log]);
 showToast('Tarefa atualizada com sucesso!');
 },
 bulkUpdateTasks: async (taskIds, updates, adm) => {
 setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, ...updates } : t));
 taskIds.forEach(tid => {
 const log: TaskLog = {
 id: Math.random().toString(36).substr(2, 9),
 taskId: tid,
 action: 'Atualização em Massa',
 adminUser: adm,
 timestamp: new Date().toISOString(),
 notes: JSON.stringify(updates)
 };
 setTaskLogs(prev => [...prev, log]);
 });
 showToast('Tarefas atualizadas em massa com sucesso!');
 },
 bulkUpdateDevices: async (deviceIds, updates, adm) => {
 setDevices(prev => prev.map(d => deviceIds.includes(d.id) ? { ...d, ...updates } : d));
 deviceIds.forEach(id => {
 const dev = devices.find(x => x.id === id);
 logAction(ActionType.UPDATE, 'Device', id, dev?.assetTag || 'Ativo', adm, 'Atualização em Massa', undefined, dev, updates);
 });
 showToast('Dispositivos atualizados em massa com sucesso!');
 },
 fetchTaskLogs: async (tid) => {
 return taskLogs.filter(l => l.taskId === tid);
 },

 assignAsset: (assetType, assetId, userId, notes, adminName, accessories) => {
 const user = users.find(u => u.id === userId);
 if (assetType === 'Device') {
 const old = devices.find(d => d.id === assetId);
 setDevices(prev => prev.map(d => d.id === assetId ? { 
 ...d, 
 status: DeviceStatus.IN_USE, 
 currentUserId: userId,
 accessories: accessories
 } : d));
 
 const termId = Math.random().toString(36).substr(2, 9);
 const modelName = models.find(m => m.id === old?.modelId)?.name || 'Dispositivo';
 const newTerm: Term = {
 id: termId,
 userId: userId,
 type: 'ENTREGA',
 assetDetails:`[TAG: ${old?.assetTag}] ${modelName}`,
 date: new Date().toISOString(),
 fileUrl: ''
 };
 setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
 logAction(ActionType.CHECKOUT, 'Device', assetId, old?.assetTag || 'Ativo', adminName, notes, undefined, old, { 
 status: DeviceStatus.IN_USE, 
 currentUserId: userId,
 userName: user?.fullName || 'Desconhecido'
 });
 showToast('Ativo atribuído com sucesso!');
 } else {
 const old = sims.find(s => s.id === assetId);
 setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
 
 const termId = Math.random().toString(36).substr(2, 9);
 const newTerm: Term = {
 id: termId,
 userId: userId,
 type: 'ENTREGA',
 assetDetails:`[CHIP: ${old?.phoneNumber}]`,
 date: new Date().toISOString(),
 fileUrl: ''
 };
 setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
 
 logAction(ActionType.CHECKOUT, 'Sim', assetId, old?.phoneNumber || 'Chip', adminName, notes, undefined, old, { 
 status: DeviceStatus.IN_USE, 
 currentUserId: userId,
 userName: user?.fullName || 'Desconhecido'
 });
 showToast('Ativo atribuído com sucesso!');
 }
 },
 returnAsset: (assetType, assetId, notes, adminName, checklist, inactivateUser, condition, damageDescription, evidenceFiles) => {
 if (assetType === 'Device') {
 const old = devices.find(d => d.id === assetId);
 const oldUserId = old?.currentUserId;
 const oldUser = users.find(u => u.id === oldUserId);
 
 if (old && old.linkedSimId) {
 setSims(prev => prev.map(s => s.id === old.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
 }

 setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
 
 if (oldUserId) {
 const termId = Math.random().toString(36).substr(2, 9);
 const modelName = models.find(m => m.id === old?.modelId)?.name || 'Dispositivo';
 const newTerm: Term = {
 id: termId,
 userId: oldUserId,
 type: 'DEVOLUCAO',
 assetDetails:`[TAG: ${old?.assetTag}] ${modelName}`,
 date: new Date().toISOString(),
 fileUrl: '',
 condition: condition || 'Perfeito',
 damageDescription: damageDescription,
 evidenceFiles: evidenceFiles,
 notes: notes
 };
 
 setUsers(prev => prev.map(u => u.id === oldUserId ? { 
 ...u, 
 active: inactivateUser ? false : u.active,
 terms: [...(u.terms || []), newTerm] 
 } : u));

 if (inactivateUser) {
 logAction(ActionType.INACTIVATE, 'User', oldUserId, oldUser?.fullName || 'Desconhecido', adminName, 'Inativado automaticamente durante a devolução (Desligamento)');
 }
 }
 logAction(ActionType.CHECKIN, 'Device', assetId, old?.assetTag || 'Ativo', adminName, notes, undefined, {
 status: DeviceStatus.IN_USE,
 currentUserId: oldUserId,
 userName: oldUser?.fullName || 'Desconhecido'
 }, { status: DeviceStatus.AVAILABLE, currentUserId: null });
 showToast('Ativo devolvido com sucesso!');
 } else {
 const old = sims.find(s => s.id === assetId);
 const oldUserId = old?.currentUserId;
 const oldUser = users.find(u => u.id === oldUserId);

 setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
 
 if (oldUserId) {
 const termId = Math.random().toString(36).substr(2, 9);
 const newTerm: Term = {
 id: termId,
 userId: oldUserId,
 type: 'DEVOLUCAO',
 assetDetails:`[CHIP: ${old?.phoneNumber}]`,
 date: new Date().toISOString(),
 fileUrl: '',
 condition: condition || 'Perfeito',
 damageDescription: damageDescription,
 evidenceFiles: evidenceFiles,
 notes: notes
 };

 setUsers(prev => prev.map(u => u.id === oldUserId ? { 
 ...u, 
 active: inactivateUser ? false : u.active,
 terms: [...(u.terms || []), newTerm] 
 } : u));

 if (inactivateUser) {
 logAction(ActionType.INACTIVATE, 'User', oldUserId, oldUser?.fullName || 'Desconhecido', adminName, 'Inativado automaticamente durante a devolução (Desligamento)');
 }
 }
 logAction(ActionType.CHECKIN, 'Sim', assetId, old?.phoneNumber || 'Chip', adminName, notes, undefined, {
 status: DeviceStatus.IN_USE,
 currentUserId: oldUserId,
 userName: oldUser?.fullName || 'Desconhecido'
 }, { status: DeviceStatus.AVAILABLE, currentUserId: null });
 showToast('Ativo devolvido com sucesso!');
 }
 },
 updateTermFile: (tid, uid, furl, adm) => { 
 setUsers(prev => prev.map(u => u.id === uid ? {
 ...u,
 terms: (u.terms || []).map(t => t.id === tid ? { ...t, fileUrl: furl } : t)
 } : u));
 showToast('Arquivo do termo salvo com sucesso!');
 },
 updateTermDetails: (tid, cond, desc, ad, notes, evid, adm) => {
 setUsers(prev => prev.map(u => ({
 ...u,
 terms: (u.terms || []).map(t => t.id === tid ? { ...t, condition: cond, damageDescription: desc, assetDetails: ad, notes: notes, evidenceFiles: evid, hasEvidence: evid && evid.length > 0 } : t)
 })));
 showToast('Detalhes do termo atualizados com sucesso!');
 },
 deleteTermFile: (tid, uid, r, adm) => {
 setUsers(prev => prev.map(u => u.id === uid ? {
 ...u,
 terms: (u.terms || []).map(t => t.id === tid ? { ...t, fileUrl: '' } : t)
 } : u));
 showToast('Arquivo do termo excluído com sucesso!');
 },
 clearLogs,
 restoreItem,
 addAssetType: (t, adm) => { 
 setAssetTypes(p => [...p, t]); 
 logAction(ActionType.create, 'Type', t.id, t.name, adm); 
 showToast('Tipo de ativo cadastrado com sucesso!');
 },
 updateAssetType: (t, adm) => { 
 const old = assetTypes.find(x => x.id === t.id);
 setAssetTypes(p => p.map(x => x.id === t.id ? t : x)); 
 logAction(ActionType.UPDATE, 'Type', t.id, t.name, adm, '', undefined, old, t);
 showToast('Tipo de ativo atualizado com sucesso!');
 },
 deleteAssetType: (id, adm) => { 
 setAssetTypes(p => p.filter(x => x.id !== id)); 
 showToast('Tipo de ativo excluído com sucesso!');
 },
 addBrand: (b, adm) => { 
 setBrands(p => [...p, b]); 
 logAction(ActionType.create, 'Brand', b.id, b.name, adm); 
 showToast('Marca cadastrada com sucesso!');
 },
 updateBrand: (b, adm) => { 
 const old = brands.find(x => x.id === b.id);
 setBrands(p => p.map(x => x.id === b.id ? b : x)); 
 logAction(ActionType.UPDATE, 'Brand', b.id, b.name, adm, '', undefined, old, b);
 showToast('Marca atualizada com sucesso!');
 },
 deleteBrand: (id, adm) => { 
 setBrands(p => p.filter(x => x.id !== id)); 
 showToast('Marca excluída com sucesso!');
 },
 addModel: (m, adm) => { 
 setModels(p => [...p, m]); 
 logAction(ActionType.create, 'Model', m.id, m.name, adm); 
 showToast('Modelo cadastrado com sucesso!');
 },
 updateModel: (m, adm) => { 
 const old = models.find(x => x.id === m.id);
 setModels(p => p.map(x => x.id === m.id ? m : x)); 
 logAction(ActionType.UPDATE, 'Model', m.id, m.name, adm, '', undefined, old, m);
 showToast('Modelo atualizado com sucesso!');
 },
 deleteModel: (id, adm) => { 
 setModels(p => p.filter(x => x.id !== id)); 
 showToast('Modelo excluído com sucesso!');
 },
 addAccessoryType: (t, adm) => { 
 setAccessoryTypes(p => [...p, t]); 
 logAction(ActionType.create, 'Accessory', t.id, t.name, adm); 
 showToast('Tipo de acessório cadastrado com sucesso!');
 },
 updateAccessoryType: (t, adm) => { 
 const old = accessoryTypes.find(x => x.id === t.id);
 setAccessoryTypes(p => p.map(x => x.id === t.id ? t : x)); 
 logAction(ActionType.UPDATE, 'Accessory', t.id, t.name, adm, '', undefined, old, t);
 showToast('Tipo de acessório atualizado com sucesso!');
 },
 deleteAccessoryType: (id, adm) => { 
 setAccessoryTypes(p => p.filter(x => x.id !== id)); 
 showToast('Tipo de acessório excluído com sucesso!');
 },
 addCustomField: (f, adm) => { 
 setCustomFields(p => [...p, f]); 
 logAction(ActionType.create, 'CustomField', f.id, f.name, adm); 
 showToast('Campo personalizado cadastrado com sucesso!');
 },
 updateCustomField: (f, adm) => { 
 const old = customFields.find(x => x.id === f.id);
 setCustomFields(p => p.map(x => x.id === f.id ? f : x)); 
 logAction(ActionType.UPDATE, 'CustomField', f.id, f.name, adm, '', undefined, old, f);
 showToast('Campo personalizado atualizado com sucesso!');
 },
 deleteCustomField: (id, adm) => { 
 setCustomFields(p => p.filter(x => x.id !== id)); 
 showToast('Campo personalizado excluído com sucesso!');
 },
 addMaintenance: (r, adm) => { 
 setMaintenances(p => [...p, r]); 
 logAction(ActionType.create, 'Device', r.deviceId, 'Manutenção', adm, r.description); 
 showToast('Manutenção registrada com sucesso!');
 },
 deleteMaintenance: (id, adm) => { 
 setMaintenances(p => p.filter(x => x.id !== id)); 
 showToast('Manutenção excluída com sucesso!');
 },
 finishMaintenance: (deviceId, record, adminName) => {
 const device = devices.find(d => d.id === deviceId);
 if (!device) return;

 setMaintenances(prev => [...prev, record]);
 
 const updatedDevice = { ...device, status: DeviceStatus.AVAILABLE };
 setDevices(prev => prev.map(d => d.id === deviceId ? updatedDevice : d));

 logAction(ActionType.UPDATE, 'Device', deviceId, device.assetTag, adminName,`Manutenção Concluída: ${record.description}`);
 showToast('Manutenção finalizada com sucesso!');
 },
 updateExternalDbConfig: async (c, adm) => { 
 setExternalDbConfig(c); 
 showToast('Configuração de banco externo atualizada com sucesso!');
 },
 testExternalDbConnection: async (c) => {
 showToast('Conexão simulada com sucesso!');
 return { success: true, message:"[Mock] Conexão simulada com sucesso!"};
 },
 fetchExpedienteAlerts: async () => { setExpedienteAlerts([]); },
 saveExpedienteOverride: async () => { 
 showToast('Ajuste de expediente salvo com sucesso!');
 },
 };

 return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

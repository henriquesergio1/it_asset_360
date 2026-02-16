
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '2.12.36', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

const format = (set, jsonKeys = []) => set.recordset.map(row => {
    const entry = {};
    for (let key in row) {
        const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
        entry[camelKey] = jsonKeys.includes(key) && row[key] ? JSON.parse(row[key]) : row[key];
    }
    return entry;
});

// --- BOOTSTRAP ENDPOINT (v2.12.36 - Completo) ---
app.get('/api/bootstrap', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const [
            devicesRes, simsRes, usersRes, logsRes, sysUsersRes, settingsRes,
            modelsRes, brandsRes, typesRes, maintRes, sectorsRes, termsRes,
            accTypesRes, customFieldsRes, accountsRes
        ] = await Promise.all([
            pool.request().query("SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceUrl IS NOT NULL AND PurchaseInvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
            pool.request().query("SELECT * FROM SimCards"),
            pool.request().query("SELECT * FROM Users"),
            pool.request().query("SELECT TOP 200 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs ORDER BY Timestamp DESC"),
            pool.request().query("SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers"),
            pool.request().query("SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate FROM SystemSettings"),
            pool.request().query("SELECT * FROM Models"), 
            pool.request().query("SELECT * FROM Brands"),
            pool.request().query("SELECT * FROM AssetTypes"),
            pool.request().query("SELECT Id, DeviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceUrl IS NOT NULL AND InvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            pool.request().query("SELECT * FROM Sectors"),
            pool.request().query("SELECT Id, UserId, Type, AssetDetails, Date, (CASE WHEN FileUrl IS NOT NULL AND FileUrl <> '' THEN 1 ELSE 0 END) as hasFile FROM Terms"),
            pool.request().query("SELECT * FROM AccessoryTypes"),
            pool.request().query("SELECT * FROM CustomFields"),
            pool.request().query("SELECT * FROM SoftwareAccounts")
        ]);

        const devices = await Promise.all(devicesRes.recordset.map(async d => {
            const acc = await pool.request().input('DevId', sql.NVarChar, d.Id).query("SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId=@DevId");
            return {
                id: d.Id, modelId: d.ModelId, serialNumber: d.SerialNumber, assetTag: d.AssetTag, internalCode: d.InternalCode, imei: d.Imei, pulsusId: d.PulsusId, status: d.Status, currentUserId: d.CurrentUserId, sectorId: d.SectorId, costCenter: d.CostCenter, linkedSimId: d.LinkedSimId, purchaseDate: d.PurchaseDate, purchaseCost: d.PurchaseCost, invoiceNumber: d.InvoiceNumber, supplier: d.Supplier, hasInvoice: d.hasInvoice === 1, customData: d.CustomData ? JSON.parse(d.CustomData) : {}, accessories: acc.recordset
            };
        }));

        res.json({
            devices, sims: format(simsRes), users: format(usersRes), logs: format(logsRes), systemUsers: sysUsersRes.recordset,
            settings: settingsRes.recordset[0] || { appName: 'IT Asset', logoUrl: '' }, models: format(modelsRes), brands: format(brandsRes),
            assetTypes: format(typesRes, ['CustomFieldIds']), maintenances: format(maintRes).map(m => ({ ...m, hasInvoice: m.hasInvoice === 1 })),
            sectors: format(sectorsRes), terms: format(termsRes).map(t => ({ ...t, hasFile: t.hasFile === 1 })), accessoryTypes: format(accTypesRes),
            customFields: format(customFieldsRes), accounts: format(accountsRes)
        });
    } catch (err) { res.status(500).send(err.message); }
});

// --- SYNC ENDPOINT (v2.12.36 - Lightweight) ---
app.get('/api/sync', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const [devicesRes, simsRes, usersRes, logsRes, maintRes, termsRes, accountsRes] = await Promise.all([
            pool.request().query("SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceUrl IS NOT NULL AND PurchaseInvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
            pool.request().query("SELECT * FROM SimCards"),
            pool.request().query("SELECT * FROM Users"),
            pool.request().query("SELECT TOP 200 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs ORDER BY Timestamp DESC"),
            pool.request().query("SELECT Id as id, DeviceId as deviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceUrl IS NOT NULL AND InvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            pool.request().query("SELECT Id, UserId, Type, AssetDetails, Date, (CASE WHEN FileUrl IS NOT NULL AND FileUrl <> '' THEN 1 ELSE 0 END) as hasFile FROM Terms"),
            pool.request().query("SELECT * FROM SoftwareAccounts")
        ]);

        const devices = await Promise.all(devicesRes.recordset.map(async d => {
            const acc = await pool.request().input('DevId', sql.NVarChar, d.Id).query("SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId=@DevId");
            return {
                id: d.Id, modelId: d.ModelId, serialNumber: d.SerialNumber, assetTag: d.AssetTag, internalCode: d.InternalCode, imei: d.Imei, pulsusId: d.PulsusId, status: d.Status, currentUserId: d.CurrentUserId, sectorId: d.SectorId, costCenter: d.CostCenter, linkedSimId: d.LinkedSimId, purchaseDate: d.PurchaseDate, purchaseCost: d.PurchaseCost, invoiceNumber: d.InvoiceNumber, supplier: d.Supplier, hasInvoice: d.hasInvoice === 1, customData: d.CustomData ? JSON.parse(d.CustomData) : {}, accessories: acc.recordset
            };
        }));

        res.json({
            devices, sims: format(simsRes), users: format(usersRes), logs: format(logsRes),
            maintenances: format(maintRes).map(m => ({ ...m, hasInvoice: m.hasInvoice === 1 })),
            terms: format(termsRes).map(t => ({ ...t, hasFile: t.hasFile === 1 })),
            accounts: format(accountsRes)
        });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/logs/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM AuditLogs WHERE Id=@Id");
        const log = result.recordset[0];
        if (log) {
            res.json({
                id: log.Id, assetId: log.AssetId, assetType: log.AssetType, action: log.Action, timestamp: log.Timestamp,
                adminUser: log.AdminUser, targetName: log.TargetName, notes: log.Notes, backupData: log.BackupData,
                previousData: log.PreviousData, newData: log.NewData
            });
        } else res.status(404).send("Log não encontrado");
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/terms/:id/file', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileUrl FROM Terms WHERE Id=@Id");
        res.json({ fileUrl: result.recordset[0]?.FileUrl || '' });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/devices/:id/invoice', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT PurchaseInvoiceUrl FROM Devices WHERE Id=@Id");
        res.json({ invoiceUrl: result.recordset[0]?.PurchaseInvoiceUrl || '' });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/maintenances/:id/invoice', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT InvoiceUrl FROM MaintenanceRecords WHERE Id=@Id");
        res.json({ invoiceUrl: result.recordset[0]?.InvoiceUrl || '' });
    } catch (err) { res.status(500).send(err.message); }
});

async function logAction(assetId, assetType, action, adminUser, targetName, notes, backupData = null, previousData = null, newData = null) {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, Math.random().toString(36).substr(2, 9))
            .input('AssetId', sql.NVarChar, assetId)
            .input('AssetType', sql.NVarChar, assetType)
            .input('Action', sql.NVarChar, action)
            .input('AdminUser', sql.NVarChar, adminUser || 'Sistema')
            .input('TargetName', sql.NVarChar, targetName || '')
            .input('Notes', sql.NVarChar, notes || '')
            .input('BackupData', sql.NVarChar, backupData)
            .input('Prev', sql.NVarChar, previousData ? (typeof previousData === 'string' ? previousData : JSON.stringify(previousData)) : null)
            .input('Next', sql.NVarChar, newData ? (typeof newData === 'string' ? newData : JSON.stringify(newData)) : null)
            .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, TargetName, Notes, BackupData, PreviousData, NewData) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @TargetName, @Notes, @BackupData, @Prev, @Next)`);
    } catch (e) { console.error('Erro de Log:', e); }
}

const IGNORED_CRUD_KEYS = ['accessories', 'terms', 'hasInvoice', 'hasFile', 'customDataStr'];

const crud = (table, route, assetType) => {
    app.post(`/api/${route}`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            let columns = [];
            let values = [];
            for (let key in req.body) {
                if (key.startsWith('_') || IGNORED_CRUD_KEYS.includes(key)) continue;
                const dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                request.input(dbKey, val);
                columns.push(dbKey);
                values.push('@' + dbKey);
            }
            await request.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`);
            const tName = req.body.assetTag || req.body.name || req.body.phoneNumber || req.body.fullName;
            await logAction(req.body.id, assetType, 'Criação', req.body._adminUser, tName, 'Item criado manualmente no sistema');
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put(`/api/${route}/:id`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const prev = oldRes.recordset[0];
            
            let diffNotes = [];
            let sets = [];
            for (let key in req.body) {
                if (key.startsWith('_') || IGNORED_CRUD_KEYS.includes(key)) continue;
                const dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                
                request.input(dbKey, val);
                sets.push(`${dbKey}=@${dbKey}`);

                if (prev) {
                    let oldVal = prev[dbKey];
                    let newVal = req.body[key];
                    if (key === 'customData' || key === 'customFieldIds') newVal = JSON.stringify(newVal);
                    
                    if (String(oldVal || '') !== String(newVal || '')) {
                        diffNotes.push(`${key}: '${oldVal || '---'}' ➔ '${newVal || '---'}'`);
                    }
                }
            }
            request.input('TargetId', req.params.id);
            await request.query(`UPDATE ${table} SET ${sets.join(',')} WHERE Id=@TargetId`);
            
            const richNotes = (req.body._notes || req.body._reason ? `Motivo: ${req.body._notes || req.body._reason}\n\n` : '') + diffNotes.join('\n');
            const tName = req.body.assetTag || req.body.name || req.body.phoneNumber || req.body.fullName;
            
            await logAction(req.params.id, assetType, 'Atualização', req.body._adminUser, tName, richNotes, null, prev, req.body);
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.delete(`/api/${route}/:id`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request().input('Id', req.params.id).query(`DELETE FROM ${table} WHERE Id=@Id`);
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });
};

crud('Sectors', 'sectors', 'Sector');
crud('Brands', 'brands', 'Brand');
crud('AssetTypes', 'asset-types', 'Type');
crud('Models', 'models', 'Model');
crud('AccessoryTypes', 'accessory-types', 'Accessory');
crud('CustomFields', 'custom-fields', 'CustomField');
crud('MaintenanceRecords', 'maintenances', 'Maintenance');
crud('SoftwareAccounts', 'accounts', 'Account');
crud('Users', 'users', 'User');
crud('SimCards', 'sims', 'Sim');
crud('Devices', 'devices', 'Device');

app.get('/api/settings', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate FROM SystemSettings");
        res.json(result.recordset[0] || {});
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/settings', async (req, res) => {
    const { appName, logoUrl, cnpj, termTemplate, _adminUser } = req.body;
    const pool = await sql.connect(dbConfig);
    const oldRes = await pool.request().query("SELECT TOP 1 * FROM SystemSettings");
    const prev = oldRes.recordset[0];
    await pool.request().input('N', sql.NVarChar, appName).input('L', sql.NVarChar, logoUrl).input('C', sql.NVarChar, cnpj).input('T', sql.NVarChar, termTemplate).query("UPDATE SystemSettings SET AppName=@N, LogoUrl=@L, Cnpj=@C, TermTemplate=@T");
    await logAction('settings', 'System', 'Configuração', _adminUser, 'Configurações Gerais', 'Configurações globais atualizadas', null, prev, { appName, logoUrl, cnpj });
    res.json({success: true});
});

app.get('/api/system-users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, FullName as fullName, Email as email, SectorId as sectorId, InternalCode as internalCode, Active as active, Cpf as cpf, Rg as rg, Pis as pis, Address as address FROM Users");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/sims', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, PhoneNumber as phoneNumber, Operator as operator, Iccid as iccid, PlanDetails as planDetails, Status as status, CurrentUserId as currentUserId FROM SimCards");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/devices', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, ModelId as modelId, SerialNumber as serialNumber, AssetTag as assetTag, InternalCode as internalCode, Imei as imei, PulsusId as pulsusId, Status as status, CurrentUserId as currentUserId, SectorId as sectorId, CostCenter as costCenter, LinkedSimId as linkedSimId, PurchaseDate as purchaseDate, PurchaseCost as purchaseCost, InvoiceNumber as invoiceNumber, Supplier as supplier, (CASE WHEN PurchaseInvoiceUrl IS NOT NULL AND PurchaseInvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice, CustomData as customDataStr FROM Devices");
        const devices = await Promise.all(result.recordset.map(async d => {
            const acc = await pool.request().input('DevId', sql.NVarChar, d.id).query("SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId=@DevId");
            return { ...d, hasInvoice: d.hasInvoice === 1, customData: d.customDataStr ? JSON.parse(d.customDataStr) : {}, accessories: acc.recordset };
        }));
        res.json(devices);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/logs', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, AssetId as assetId, Action as action, Timestamp as timestamp, AdminUser as adminUser, TargetName as targetName, Notes as notes FROM AuditLogs ORDER BY Timestamp DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

// Operations Checkout/Checkin
app.post('/api/operations/checkout', async (req, res) => {
    try {
        const { assetId, assetType, userId, notes, _adminUser, accessories } = req.body;
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        const oldRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT * FROM ${table} WHERE Id=@Id`);
        const prev = oldRes.recordset[0];
        const userRes = await pool.request().input('Uid', sql.NVarChar, userId).query("SELECT FullName FROM Users WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';
        
        let assetDetails = notes || '';
        let targetIdStr = assetId;

        if (assetType === 'Device' && prev) {
            const modelRes = await pool.request().input('Mid', sql.NVarChar, prev.ModelId).query("SELECT Name FROM Models WHERE Id=@Mid");
            const modelName = modelRes.recordset[0]?.Name || 'Dispositivo';
            // v2.12.36: Incluindo IMEI obrigatoriamente para identificação infalível
            assetDetails = `[TAG: ${prev.AssetTag || 'S/T'} | S/N: ${prev.SerialNumber || 'S/S'} | IMEI: ${prev.Imei || 'S/I'}] ${modelName}`;
            targetIdStr = `${prev.AssetTag || prev.Imei || prev.SerialNumber} (${modelName})`;
        } else if (prev) {
            assetDetails = `[CHIP: ${prev.PhoneNumber}]`;
            targetIdStr = prev.PhoneNumber;
        }

        await pool.request().input('Aid', assetId).input('Uid', userId).query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@Uid WHERE Id=@Aid`);
        if (assetType === 'Device' && accessories) {
            await pool.request().input('Did', assetId).query("DELETE FROM DeviceAccessories WHERE DeviceId=@Did");
            for (let acc of accessories) {
                await pool.request().input('I', acc.id).input('Did', assetId).input('At', acc.accessoryTypeId).input('N', acc.name).query("INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@I, @Did, @At, @N)");
            }
        }
        const termId = Math.random().toString(36).substr(2, 9);
        await pool.request().input('I', termId).input('U', userId).input('T', 'ENTREGA').input('Ad', assetDetails).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@I, @U, @T, @Ad, GETDATE())");
        
        const richNotes = `Alvo: ${userName}\nStatus: 'Disponível' ➔ 'Em Uso'${notes ? `\nObservação: ${notes}` : ''}`;
        await logAction(assetId, assetType, 'Entrega', _adminUser, targetIdStr, richNotes, null, prev, { status: 'Em Uso', currentUserId: userId, userName: userName });
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/operations/checkin', async (req, res) => {
    try {
        const { assetId, assetType, notes, _adminUser, inactivateUser } = req.body;
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        const oldRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT * FROM ${table} WHERE Id=@Id`);
        const prev = oldRes.recordset[0];
        const userId = prev?.CurrentUserId;
        
        let assetDetails = notes || '';
        let targetIdStr = assetId;

        if (assetType === 'Device' && prev) {
            const modelRes = await pool.request().input('Mid', sql.NVarChar, prev.ModelId).query("SELECT Name FROM Models WHERE Id=@Mid");
            const modelName = modelRes.recordset[0]?.Name || 'Dispositivo';
            // v2.12.36: Incluindo IMEI obrigatoriamente para identificação infalível
            assetDetails = `[TAG: ${prev.AssetTag || 'S/T'} | S/N: ${prev.SerialNumber || 'S/S'} | IMEI: ${prev.Imei || 'S/I'}] ${modelName}`;
            targetIdStr = `${prev.AssetTag || prev.Imei || prev.SerialNumber} (${modelName})`;
        } else if (prev) {
            assetDetails = `[CHIP: ${prev.PhoneNumber}]`;
            targetIdStr = prev.PhoneNumber;
        }

        let userName = 'Colaborador';
        if (userId) {
            const userRes = await pool.request().input('Uid', sql.NVarChar, userId).query("SELECT FullName FROM Users WHERE Id=@Uid");
            userName = userRes.recordset[0]?.FullName || 'Colaborador';
        }
        
        if (assetType === 'Device' && prev && prev.LinkedSimId) {
            await pool.request().input('Sid', sql.NVarChar, prev.LinkedSimId).query("UPDATE SimCards SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Sid");
        }

        await pool.request().input('Aid', assetId).query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Aid`);
        
        if (userId) {
            const termId = Math.random().toString(36).substr(2, 9);
            await pool.request().input('I', termId).input('U', userId).input('T', 'DEVOLUCAO').input('Ad', assetDetails).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@I, @U, @T, @Ad, GETDATE())");
            
            if (inactivateUser) {
                await pool.request().input('Uid', sql.NVarChar, userId).query("UPDATE Users SET Active=0 WHERE Id=@Uid");
                await logAction(userId, 'User', 'Inativação', _adminUser, userName, 'Inativado automaticamente durante a devolução (Desligamento)');
            }
        }
        
        const richNotes = `Origem: ${userName}\nStatus: 'Em Uso' ➔ 'Disponível'${notes ? `\nObservação: ${notes}` : ''}`;
        await logAction(assetId, assetType, 'Devolução', _adminUser, targetIdStr, richNotes, null, { status: 'Em Uso', currentUserId: userId, userName: userName }, { status: 'Disponível', currentUserId: null });
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor v2.12.36 rodando na porta ${PORT}`);
});

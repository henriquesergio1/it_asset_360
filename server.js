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

// --- HEALTH CHECK (v3.5.0) ---
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '3.5.0', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production'
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

// --- BOOTSTRAP ENDPOINT (v3.5.0) ---
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
            pool.request().query("SELECT TOP 200 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes, PreviousData, NewData FROM AuditLogs ORDER BY Timestamp DESC"),
            pool.request().query("SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers"),
            pool.request().query("SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate FROM SystemSettings"),
            pool.request().query("SELECT * FROM Models"), 
            pool.request().query("SELECT * FROM Brands"),
            pool.request().query("SELECT * FROM AssetTypes"),
            pool.request().query("SELECT Id, DeviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceUrl IS NOT NULL AND InvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            pool.request().query("SELECT * FROM Sectors"),
            pool.request().query("SELECT Id, UserId, Type, AssetDetails, Date, SnapshotData, (CASE WHEN FileUrl IS NOT NULL AND FileUrl <> '' THEN 1 ELSE 0 END) as hasFile FROM Terms"),
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

// --- SYNC ENDPOINT (v3.5.0) ---
app.get('/api/sync', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const [devicesRes, simsRes, usersRes, logsRes, maintRes, termsRes, accountsRes] = await Promise.all([
            pool.request().query("SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceUrl IS NOT NULL AND PurchaseInvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
            pool.request().query("SELECT * FROM SimCards"),
            pool.request().query("SELECT * FROM Users"),
            pool.request().query("SELECT TOP 200 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes, PreviousData, NewData FROM AuditLogs ORDER BY Timestamp DESC"),
            pool.request().query("SELECT Id as id, DeviceId as deviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceUrl IS NOT NULL AND InvoiceUrl <> '' THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            pool.request().query("SELECT Id, UserId, Type, AssetDetails, Date, SnapshotData, (CASE WHEN FileUrl IS NOT NULL AND FileUrl <> '' THEN 1 ELSE 0 END) as hasFile FROM Terms"),
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

// --- OPERAÇÃO: CHECKOUT (ENTREGA) ---
app.post('/api/operations/checkout', async (req, res) => {
    const { assetId, assetType, userId, notes, _adminUser, accessories, termSnapshot } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const userRes = await transaction.request().input('UId', userId).query("SELECT FullName FROM Users WHERE Id=@UId");
            const user = userRes.recordset[0];
            
            if (assetType === 'Device') {
                const devRes = await transaction.request().input('DId', assetId).query("SELECT * FROM Devices WHERE Id=@DId");
                const dev = devRes.recordset[0];
                await transaction.request().input('DId', assetId).input('UId', userId).query("UPDATE Devices SET Status='Em Uso', CurrentUserId=@UId WHERE Id=@DId");
                await transaction.request().input('DId', assetId).query("DELETE FROM DeviceAccessories WHERE DeviceId=@DId");
                if (accessories && accessories.length > 0) {
                    for (const acc of accessories) {
                        await transaction.request().input('Id', acc.id).input('DId', assetId).input('TId', acc.accessoryTypeId).input('N', acc.name).query("INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@Id, @DId, @TId, @N)");
                    }
                }
                const termId = Math.random().toString(36).substr(2, 9);
                await transaction.request().input('Id', termId).input('UId', userId).input('T', 'ENTREGA').input('D', `[TAG: ${dev.AssetTag}]`).input('S', JSON.stringify(termSnapshot)).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, SnapshotData) VALUES (@Id, @UId, @T, @D, GETDATE(), @S)");
                await logActionTrans(transaction, assetId, 'Device', 'Entrega', _adminUser, dev.AssetTag, `Entregue para ${user.FullName}. ${notes}`, null, dev, { Status: 'Em Uso', CurrentUserId: userId });
                await logActionTrans(transaction, userId, 'User', 'Entrega', _adminUser, user.FullName, `Recebeu dispositivo ${dev.AssetTag}. ${notes}`);
            } else {
                const simRes = await transaction.request().input('SId', assetId).query("SELECT * FROM SimCards WHERE Id=@SId");
                const sim = simRes.recordset[0];
                await transaction.request().input('SId', assetId).input('UId', userId).query("UPDATE SimCards SET Status='Em Uso', CurrentUserId=@UId WHERE Id=@SId");
                const termId = Math.random().toString(36).substr(2, 9);
                await transaction.request().input('Id', termId).input('UId', userId).input('T', 'ENTREGA').input('D', `[CHIP: ${sim.PhoneNumber}]`).input('S', JSON.stringify(termSnapshot)).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, SnapshotData) VALUES (@Id, @UId, @T, @D, GETDATE(), @S)");
                await logActionTrans(transaction, assetId, 'Sim', 'Entrega', _adminUser, sim.PhoneNumber, `Entregue para ${user.FullName}. ${notes}`, null, sim, { Status: 'Em Uso', CurrentUserId: userId });
                await logActionTrans(transaction, userId, 'User', 'Entrega', _adminUser, user.FullName, `Recebeu chip ${sim.PhoneNumber}. ${notes}`);
            }
            await transaction.commit();
            res.json({ success: true });
        } catch (err) { await transaction.rollback(); throw err; }
    } catch (err) { res.status(500).send(err.message); }
});

// --- OPERAÇÃO: CHECKIN (DEVOLUÇÃO) ---
app.post('/api/operations/checkin', async (req, res) => {
    const { assetId, assetType, notes, _adminUser, returnedChecklist, inactivateUser, termSnapshot } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            if (assetType === 'Device') {
                const devRes = await transaction.request().input('DId', assetId).query("SELECT * FROM Devices WHERE Id=@DId");
                const dev = devRes.recordset[0];
                const userId = dev.CurrentUserId;
                const userRes = await transaction.request().input('UId', userId).query("SELECT FullName FROM Users WHERE Id=@UId");
                const user = userRes.recordset[0];

                if (dev.LinkedSimId) await transaction.request().input('SId', dev.LinkedSimId).query("UPDATE SimCards SET Status='Disponível', CurrentUserId=NULL WHERE Id=@SId");
                await transaction.request().input('DId', assetId).query("UPDATE Devices SET Status='Disponível', CurrentUserId=NULL WHERE Id=@DId");
                
                if (userId) {
                    const termId = Math.random().toString(36).substr(2, 9);
                    await transaction.request().input('Id', termId).input('UId', userId).input('T', 'DEVOLUCAO').input('D', `[TAG: ${dev.AssetTag}]`).input('S', JSON.stringify(termSnapshot)).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, SnapshotData) VALUES (@Id, @UId, @T, @D, GETDATE(), @S)");
                    if (inactivateUser) await transaction.request().input('UId', userId).query("UPDATE Users SET Active=0 WHERE Id=@UId");
                    await logActionTrans(transaction, userId, 'User', 'Devolução', _adminUser, user.FullName, `Devolveu dispositivo ${dev.AssetTag}. ${notes}${inactivateUser ? ' (Usuário Inativado)' : ''}`);
                }
                await logActionTrans(transaction, assetId, 'Device', 'Devolução', _adminUser, dev.AssetTag, `Devolvido por ${user?.FullName || 'Desconhecido'}. ${notes}`, null, dev, { Status: 'Disponível', CurrentUserId: null });
            } else {
                const simRes = await transaction.request().input('SId', assetId).query("SELECT * FROM SimCards WHERE Id=@SId");
                const sim = simRes.recordset[0];
                const userId = sim.CurrentUserId;
                const userRes = await transaction.request().input('UId', userId).query("SELECT FullName FROM Users WHERE Id=@UId");
                const user = userRes.recordset[0];

                await transaction.request().input('SId', assetId).query("UPDATE SimCards SET Status='Disponível', CurrentUserId=NULL WHERE Id=@SId");
                if (userId) {
                    const termId = Math.random().toString(36).substr(2, 9);
                    await transaction.request().input('Id', termId).input('UId', userId).input('T', 'DEVOLUCAO').input('D', `[CHIP: ${sim.PhoneNumber}]`).input('S', JSON.stringify(termSnapshot)).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, SnapshotData) VALUES (@Id, @UId, @T, @D, GETDATE(), @S)");
                    await logActionTrans(transaction, userId, 'User', 'Devolução', _adminUser, user.FullName, `Devolveu chip ${sim.PhoneNumber}. ${notes}`);
                }
                await logActionTrans(transaction, assetId, 'Sim', 'Devolução', _adminUser, sim.PhoneNumber, `Devolvido por ${user?.FullName || 'Desconhecido'}. ${notes}`, null, sim, { Status: 'Disponível', CurrentUserId: null });
            }
            await transaction.commit();
            res.json({ success: true });
        } catch (err) { await transaction.rollback(); throw err; }
    } catch (err) { res.status(500).send(err.message); }
});

async function logActionTrans(trans, assetId, assetType, action, adminUser, targetName, notes, backupData = null, previousData = null, newData = null) {
    await trans.request()
        .input('Id', sql.NVarChar, Math.random().toString(36).substr(2, 9))
        .input('AssetId', sql.NVarChar, assetId)
        .input('AssetType', sql.NVarChar, assetType)
        .input('Action', sql.NVarChar, action)
        .input('AdminUser', sql.NVarChar, adminUser || 'Sistema')
        .input('TargetName', sql.NVarChar, targetName || '')
        .input('Notes', sql.NVarChar, notes || '')
        .input('BackupData', sql.NVarChar, backupData)
        .input('Prev', sql.NVarChar, previousData ? JSON.stringify(previousData) : null)
        .input('Next', sql.NVarChar, newData ? JSON.stringify(newData) : null)
        .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, TargetName, Notes, BackupData, PreviousData, NewData) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @TargetName, @Notes, @BackupData, @Prev, @Next)`);
}

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

const IGexternal_CRUD_KEYS = ['accessories', 'terms', 'hasInvoice', 'hasFile', 'customDataStr', 'snapshotData'];

const crud = (table, route, assetType) => {
    app.post(`/api/${route}`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            let columns = [];
            let values = [];
            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                const dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                request.input(dbKey, val);
                columns.push(dbKey);
                values.push('@' + dbKey);
            }
            await request.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`);
            const tName = req.body.assetTag || req.body.name || req.body.phoneNumber || req.body.fullName;
            await logAction(req.body.id, assetType, 'Criação', req.body._adminUser, tName, 'Item criado manualmente');
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
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
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
    await logAction('settings', 'System', 'Configuração', _adminUser, 'Geral', 'Atualização de configurações', null, prev, { appName, logoUrl, cnpj });
    res.json({success: true});
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor v3.5.0 em PRODUÇÃO na porta ${PORT}`);
});
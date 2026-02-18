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

// --- HEALTH CHECK (v3.5.3) ---
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '3.5.3', 
        timestamp: new Date().toISOString()
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

// --- FILE FETCHING ROUTES ---
app.get('/api/devices/:id/invoice', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT PurchaseInvoiceUrl FROM Devices WHERE Id=@Id");
        res.json({ invoiceUrl: result.recordset[0]?.PurchaseInvoiceUrl || '' });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/terms/:id/file', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileUrl FROM Terms WHERE Id=@Id");
        res.json({ fileUrl: result.recordset[0]?.FileUrl || '' });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/maintenances/:id/invoice', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT InvoiceUrl FROM MaintenanceRecords WHERE Id=@Id");
        res.json({ invoiceUrl: result.recordset[0]?.InvoiceUrl || '' });
    } catch (err) { res.status(500).send(err.message); }
});

// --- BOOTSTRAP ENDPOINT (v3.5.3) ---
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

// --- CRUD HELPER ---
const logAction = async (assetId, assetType, action, adminUser, targetName, notes, prev = null, next = null) => {
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
            .input('Prev', sql.NVarChar, prev ? JSON.stringify(prev) : null)
            .input('Next', sql.NVarChar, next ? JSON.stringify(next) : null)
            .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, TargetName, Notes, PreviousData, NewData) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @TargetName, @Notes, @Prev, @Next)`);
    } catch (e) { console.error('Erro Log:', e); }
};

const crud = (table, route, assetType) => {
    app.post(`/api/${route}`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            let cols = []; let vals = [];
            for (let key in req.body) {
                if (key.startsWith('_') || ['accessories', 'terms', 'hasInvoice', 'hasFile', 'snapshotData'].includes(key)) continue;
                const dbK = key.charAt(0).toUpperCase() + key.slice(1);
                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                request.input(dbK, val);
                cols.push(dbK); vals.push('@' + dbK);
            }
            await request.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')})`);
            logAction(req.body.id, assetType, 'Criação', req.body._adminUser, req.body.name || req.body.assetTag || req.body.fullName, 'Criado via sistema');
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put(`/api/${route}/:id`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const old = await pool.request().input('Id', sql.NVarChar, req.params.id).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const request = pool.request();
            let sets = [];
            for (let key in req.body) {
                if (key.startsWith('_') || ['accessories', 'terms', 'hasInvoice', 'hasFile', 'snapshotData'].includes(key)) continue;
                const dbK = key.charAt(0).toUpperCase() + key.slice(1);
                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                request.input(dbK, val);
                sets.push(`${dbK}=@${dbK}`);
            }
            request.input('TargetId', req.params.id);
            await request.query(`UPDATE ${table} SET ${sets.join(',')} WHERE Id=@TargetId`);
            logAction(req.params.id, assetType, 'Atualização', req.body._adminUser, req.body.name || req.body.assetTag || req.body.fullName, req.body._reason || '', old.recordset[0], req.body);
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
crud('SystemUsers', 'system-users', 'System');

app.put('/api/settings', async (req, res) => {
    const { appName, logoUrl, cnpj, termTemplate, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('N', sql.NVarChar, appName).input('L', sql.NVarChar, logoUrl)
            .input('C', sql.NVarChar, cnpj).input('T', sql.NVarChar, termTemplate)
            .query("UPDATE SystemSettings SET AppName=@N, LogoUrl=@L, Cnpj=@C, TermTemplate=@T");
        logAction('settings', 'System', 'Atualização', _adminUser, 'Configurações Gerais', 'Alteração de configurações do sistema');
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

// Operações (Checkout/Checkin) v3.5.3
app.post('/api/operations/checkout', async (req, res) => {
    const { assetId, assetType, userId, notes, _adminUser, accessories, termSnapshot } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            if (assetType === 'Device') {
                await transaction.request().input('Aid', assetId).input('Uid', userId).query("UPDATE Devices SET Status='Em Uso', CurrentUserId=@Uid WHERE Id=@Aid");
                if (accessories) {
                    for (const acc of accessories) {
                        await transaction.request().input('Id', acc.id).input('Aid', assetId).input('Tid', acc.accessoryTypeId).input('N', acc.name).query("INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@Id, @Aid, @Tid, @N)");
                    }
                }
            } else {
                await transaction.request().input('Aid', assetId).input('Uid', userId).query("UPDATE SimCards SET Status='Em Uso', CurrentUserId=@Uid WHERE Id=@Aid");
            }

            const termId = Math.random().toString(36).substr(2, 9);
            await transaction.request()
                .input('Id', termId).input('Uid', userId).input('Type', 'ENTREGA')
                .input('Details', assetType === 'Device' ? 'Equipamento' : 'Chip SIM')
                .input('Snap', JSON.stringify(termSnapshot))
                .query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, SnapshotData) VALUES (@Id, @Uid, @Type, @Details, GETDATE(), @Snap)");

            await transaction.commit();
            res.json({ success: true });
        } catch (err) { await transaction.rollback(); throw err; }
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(PORT, () => {
    console.log(`🚀 Helios Server v3.5.3 em PRODUÇÃO na porta ${PORT}`);
});
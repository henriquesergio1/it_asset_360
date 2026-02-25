
const express = require('express');
const packageJson = require('./package.json');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const app = express();

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

const DB_SCHEMAS = {
    Devices: `(
        Id NVARCHAR(255) PRIMARY KEY,
        AssetTag NVARCHAR(255) UNIQUE,
        Status NVARCHAR(50),
        PreviousStatus NVARCHAR(50) NULL,
        ModelId NVARCHAR(255),
        SerialNumber NVARCHAR(255),
        InternalCode NVARCHAR(255),
        Imei NVARCHAR(255) UNIQUE,
        PulsusId NVARCHAR(255),
        CurrentUserId NVARCHAR(255),
        SectorId NVARCHAR(255),
        CostCenter NVARCHAR(255),
        LinkedSimId NVARCHAR(255),
        PurchaseDate DATETIME,
        PurchaseCost FLOAT,
        InvoiceNumber NVARCHAR(255),
        Supplier NVARCHAR(255),
        PurchaseInvoiceUrl NVARCHAR(MAX),
        CustomData NVARCHAR(MAX)
    )`,
    SimCards: `(
        Id NVARCHAR(255) PRIMARY KEY,
        PhoneNumber NVARCHAR(50) UNIQUE,
        Operator NVARCHAR(100),
        Iccid NVARCHAR(255) UNIQUE,
        Status NVARCHAR(50),
        CurrentUserId NVARCHAR(255),
        PlanDetails NVARCHAR(MAX)
    )`,
    Users: `(
        Id NVARCHAR(255) PRIMARY KEY,
        FullName NVARCHAR(255),
        Cpf NVARCHAR(50) UNIQUE,
        Rg NVARCHAR(50),
        Pis NVARCHAR(50),
        Address NVARCHAR(MAX),
        Email NVARCHAR(255) UNIQUE,
        SectorId NVARCHAR(255),
        InternalCode NVARCHAR(255),
        Active BIT,
        HasPendingIssues BIT,
        PendingIssuesNote NVARCHAR(MAX)
    )`,
    AuditLogs: `(
        Id NVARCHAR(255) PRIMARY KEY,
        AssetId NVARCHAR(255),
        AssetType NVARCHAR(100),
        Action NVARCHAR(100),
        Timestamp DATETIME DEFAULT GETDATE(),
        AdminUser NVARCHAR(255),
        TargetName NVARCHAR(255),
        Notes NVARCHAR(MAX),
        BackupData NVARCHAR(MAX),
        PreviousData NVARCHAR(MAX),
        NewData NVARCHAR(MAX)
    )`,
    SystemUsers: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255), Email NVARCHAR(255) UNIQUE, Password NVARCHAR(255), Role NVARCHAR(50))`,
    SystemSettings: `(Id INT PRIMARY KEY IDENTITY(1,1), AppName NVARCHAR(255), LogoUrl NVARCHAR(MAX), Cnpj NVARCHAR(50), TermTemplate NVARCHAR(MAX))`,
    Models: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255), BrandId NVARCHAR(255), TypeId NVARCHAR(255), ImageUrl NVARCHAR(MAX))`,
    Brands: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    AssetTypes: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE, CustomFieldIds NVARCHAR(MAX))`,
    MaintenanceRecords: `(Id NVARCHAR(255) PRIMARY KEY, DeviceId NVARCHAR(255), Description NVARCHAR(MAX), Cost FLOAT, Date DATETIME, Type NVARCHAR(100), Provider NVARCHAR(255), InvoiceUrl NVARCHAR(MAX))`,
    Sectors: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    Terms: `(Id NVARCHAR(255) PRIMARY KEY, UserId NVARCHAR(255), Type NVARCHAR(50), AssetDetails NVARCHAR(MAX), Date DATETIME, FileUrl NVARCHAR(MAX))`,
    AccessoryTypes: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    DeviceAccessories: `(Id NVARCHAR(255) PRIMARY KEY, DeviceId NVARCHAR(255), AccessoryTypeId NVARCHAR(255), Name NVARCHAR(255))`,
    CustomFields: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    SoftwareAccounts: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255), Type NVARCHAR(100), Login NVARCHAR(255), Password NVARCHAR(255), AccessUrl NVARCHAR(MAX), Status NVARCHAR(50), UserId NVARCHAR(255), DeviceId NVARCHAR(255), SectorId NVARCHAR(255), Notes NVARCHAR(MAX))`
};

async function initializeDatabase() {
    console.log('Verificando e inicializando banco de dados...');
    try {
        const pool = await sql.connect(dbConfig);
        for (const table in DB_SCHEMAS) {
            const checkTable = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${table}'`);
            if (checkTable.recordset.length === 0) {
                console.log(`- Tabela ${table} não encontrada. Criando...`);
                await pool.request().query(`CREATE TABLE ${table} ${DB_SCHEMAS[table]}`);
                console.log(`  ... Tabela ${table} criada com sucesso.`);
            } else {
                 // Verifica colunas específicas que podem faltar
                 if (table === 'Devices') {
                    const checkColumn = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'PreviousStatus'`);
                    if (checkColumn.recordset.length === 0) {
                        console.log(`- Coluna PreviousStatus não encontrada em Devices. Adicionando...`);
                        await pool.request().query('ALTER TABLE Devices ADD PreviousStatus NVARCHAR(50) NULL');
                        console.log('  ... Coluna PreviousStatus adicionada.');
                    }
                }
            }
        }

        // Garante que a tabela de settings tenha pelo menos uma linha
        const settingsCheck = await pool.request().query('SELECT COUNT(*) as count FROM SystemSettings');
        if (settingsCheck.recordset[0].count === 0) {
            console.log('- Populando SystemSettings com valores padrão...');
            await pool.request().query("INSERT INTO SystemSettings (AppName, LogoUrl) VALUES ('IT Asset 360', '')");
        }

        console.log('Banco de dados pronto.');

    } catch (err) {
        console.error('ERRO FATAL na inicialização do banco de dados:', err.message);
        process.exit(1); // Encerra o processo se o DB falhar
    }
}

async function startServer() {
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: packageJson.version, 
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

// --- BOOTSTRAP ENDPOINT (v2.12.51 - Completo) ---
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

// --- SYNC ENDPOINT (v2.12.51 - Lightweight) ---
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

// v2.12.38 - Endpoint crítico para upload de termos digitalizados
app.put('/api/terms/file/:id', async (req, res) => {
    try {
        const { fileUrl, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails FROM Terms WHERE Id=@Id");
        const term = oldRes.recordset[0];
        
        if (!term) return res.status(404).send("Termo não encontrado");

        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Url', sql.NVarChar, fileUrl)
            .query("UPDATE Terms SET FileUrl=@Url WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, term.UserId).query("SELECT FullName FROM Users WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';

        await logAction(term.UserId, 'User', 'Atualização', _adminUser, userName, `Digitalização anexada ao termo: ${term.AssetDetails}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// v2.12.38 - Endpoint crítico para remoção de anexos de termos
app.delete('/api/terms/:id/file', async (req, res) => {
    try {
        const { _adminUser, reason } = req.body;
        const pool = await sql.connect(dbConfig);

        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails FROM Terms WHERE Id=@Id");
        const term = oldRes.recordset[0];

        if (!term) return res.status(404).send("Termo não encontrado");

        await pool.request().input('Id', sql.NVarChar, req.params.id).query("UPDATE Terms SET FileUrl=NULL WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, term.UserId).query("SELECT FullName FROM Users WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';

        await logAction(term.UserId, 'User', 'Atualização', _adminUser, userName, `Anexo removido do termo (${term.AssetDetails}). Motivo: ${reason || 'Não informado'}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// v2.12.52 - Endpoint para resolução manual de pendências sem anexo
app.put('/api/terms/resolve/:id', async (req, res) => {
    try {
        const { reason, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails FROM Terms WHERE Id=@Id");
        const term = oldRes.recordset[0];
        
        if (!term) return res.status(404).send("Termo não encontrado");

        // Marca como resolvido manualmente
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Note', sql.NVarChar, `[RESOLVIDO_MANUALMENTE] Motivo: ${reason}`)
            .query("UPDATE Terms SET FileUrl=@Note WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, term.UserId).query("SELECT FullName FROM Users WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';

        // Log no Colaborador
        await logAction(term.UserId, 'User', 'Resolução Manual', _adminUser, userName, `Pendência de termo resolvida manualmente. Motivo: ${reason}`);
        
        // Log no Sistema (Administração)
        await logAction('system', 'System', 'Resolução Manual', _adminUser, 'Administração', `Termo de ${userName} resolvido sem anexo. Motivo: ${reason}`);

        // Tenta encontrar o dispositivo para logar nele também
        // Formato esperado: [TAG: XXX | S/N: YYY | IMEI: ZZZ] ModelName
        const tagMatch = term.AssetDetails.match(/TAG:\s*([^|\]]+)/);
        if (tagMatch && tagMatch[1] && tagMatch[1].trim() !== 'S/T') {
            const assetTag = tagMatch[1].trim();
            const devRes = await pool.request().input('Tag', sql.NVarChar, assetTag).query("SELECT Id, AssetTag FROM Devices WHERE AssetTag=@Tag");
            const device = devRes.recordset[0];
            if (device) {
                await logAction(device.Id, 'Device', 'Resolução Manual', _adminUser, device.AssetTag, `Pendência de termo de entrega/devolução resolvida manualmente. Motivo: ${reason}`);
            }
        }

        res.json({ success: true });
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

// ... (código das rotas movido para dentro de startServer)

    const IGexternal_CRUD_KEYS = ['accessories', 'terms', 'hasInvoice', 'hasFile', 'customDataStr'];

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
                // v2.12.48: Snapshotting completo no log para identificação infalível
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
            await logAction(assetId, assetType, 'Entrega', _adminUser, targetIdStr, richNotes, null, prev, { status: 'Em Uso', currentUserId: userId, userName: userName, timestamp: new Date().toISOString() });
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
                // v2.12.48: Snapshotting completo no log para identificação infalível
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
            await logAction(assetId, assetType, 'Devolução', _adminUser, targetIdStr, richNotes, null, { status: 'Em Uso', currentUserId: userId, userName: userName }, { status: 'Disponível', currentUserId: null, timestamp: new Date().toISOString() });
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

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

    app.listen(PORT, () => {
        console.log(`🚀 Servidor v${packageJson.version} rodando na porta ${PORT}`);
    });
}

// Inicia o processo
initializeDatabase().then(startServer);

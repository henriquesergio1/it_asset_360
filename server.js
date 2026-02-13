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
        version: '2.12.21', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// --- MIGRAÇÕES E CRIAÇÃO DE TABELAS ---
async function runMigrations(pool) {
    console.log('🔄 Verificando esquema do banco de dados...');
    const baseTables = `
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sectors') CREATE TABLE Sectors (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Brands') CREATE TABLE Brands (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccessoryTypes') CREATE TABLE AccessoryTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomFields') CREATE TABLE CustomFields (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetTypes') CREATE TABLE AssetTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL, CustomFieldIds NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Models') CREATE TABLE Models (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL, BrandId NVARCHAR(50), TypeId NVARCHAR(50), ImageUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users') CREATE TABLE Users (Id NVARCHAR(50) PRIMARY KEY, FullName NVARCHAR(100) NOT NULL, Email NVARCHAR(100) NOT NULL, SectorId NVARCHAR(50), InternalCode NVARCHAR(50), Active BIT DEFAULT 1, Cpf NVARCHAR(20), Rg NVARCHAR(20), Pis NVARCHAR(20), Address NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SimCards') CREATE TABLE SimCards (Id NVARCHAR(50) PRIMARY KEY, PhoneNumber NVARCHAR(50) NOT NULL, Operator NVARCHAR(50), Iccid NVARCHAR(50), PlanDetails NVARCHAR(100), Status NVARCHAR(50) NOT NULL, CurrentUserId NVARCHAR(50) NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Devices') CREATE TABLE Devices (Id NVARCHAR(50) PRIMARY KEY, AssetTag NVARCHAR(50), Status NVARCHAR(50) NOT NULL, ModelId NVARCHAR(50), SerialNumber NVARCHAR(50), InternalCode NVARCHAR(50), Imei NVARCHAR(50), PulsusId NVARCHAR(50), CurrentUserId NVARCHAR(50) NULL, SectorId NVARCHAR(50), CostCenter NVARCHAR(50), LinkedSimId NVARCHAR(50) NULL, PurchaseDate DATE, PurchaseCost DECIMAL(18,2), InvoiceNumber NVARCHAR(50), Supplier NVARCHAR(100), PurchaseInvoiceUrl NVARCHAR(MAX), CustomData NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SoftwareAccounts') CREATE TABLE SoftwareAccounts (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Type NVARCHAR(50), Login NVARCHAR(200), Password NVARCHAR(MAX), AccessUrl NVARCHAR(MAX), Status NVARCHAR(20), UserId NVARCHAR(50), DeviceId NVARCHAR(50), SectorId NVARCHAR(50), Notes NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs') CREATE TABLE AuditLogs (Id NVARCHAR(50) PRIMARY KEY, AssetId NVARCHAR(50), Action NVARCHAR(50), Timestamp DATETIME2 DEFAULT GETDATE(), AdminUser NVARCHAR(100), Notes NVARCHAR(MAX), BackupData NVARCHAR(MAX), AssetType NVARCHAR(50), TargetName NVARCHAR(100), PreviousData NVARCHAR(MAX), NewData NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings') CREATE TABLE SystemSettings (Id INT PRIMARY KEY IDENTITY(1,1), AppName NVARCHAR(100), LogoUrl NVARCHAR(MAX), Cnpj NVARCHAR(20), TermTemplate NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemUsers') CREATE TABLE SystemUsers (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Email NVARCHAR(100), Password NVARCHAR(100), Role NVARCHAR(20));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MaintenanceRecords') CREATE TABLE MaintenanceRecords (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, Description NVARCHAR(MAX), Cost DECIMAL(18,2), Date DATETIME2, Type NVARCHAR(50), Provider NVARCHAR(100), InvoiceUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Terms') CREATE TABLE Terms (Id NVARCHAR(50) PRIMARY KEY, UserId NVARCHAR(50), Type NVARCHAR(20), AssetDetails NVARCHAR(255), Date DATETIME2, FileUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceAccessories') CREATE TABLE DeviceAccessories (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, AccessoryTypeId NVARCHAR(50) NOT NULL, Name NVARCHAR(100));
    `;
    await pool.request().query(baseTables);

    // --- PATCH: RENOMEAR COLUNA LICENSEKEY PARA ACCESSURL ---
    try {
        await pool.request().query(`
            IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SoftwareAccounts') AND name = 'LicenseKey')
            AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SoftwareAccounts') AND name = 'AccessUrl')
            EXEC sp_rename 'SoftwareAccounts.LicenseKey', 'AccessUrl', 'COLUMN';
        `);
    } catch (e) { console.log('SoftwareAccounts column already renamed or patch not needed'); }

    // Patch for existing AuditLogs table
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'PreviousData')
            ALTER TABLE AuditLogs ADD PreviousData NVARCHAR(MAX);
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'NewData')
            ALTER TABLE AuditLogs ADD NewData NVARCHAR(MAX);
        `);
    } catch (e) { console.log('AuditLogs already patched'); }

    const checkAdmin = await pool.request().query("SELECT * FROM SystemUsers WHERE Email = 'admin@empresa.com'");
    if (checkAdmin.recordset.length === 0) {
        await pool.request().query("INSERT INTO SystemUsers (Id, Name, Email, Password, Role) VALUES ('admin1', 'Administrador', 'admin@empresa.com', 'admin', 'ADMIN')");
    }

    const checkSettings = await pool.request().query("SELECT * FROM SystemSettings");
    if (checkSettings.recordset.length === 0) {
        await pool.request().query("INSERT INTO SystemSettings (AppName, LogoUrl) VALUES ('IT Asset 360', '')");
    }
}

sql.connect(dbConfig).then(async pool => {
    if (pool.connected) { 
        console.log('✅ Conectado ao SQL Server'); 
        await runMigrations(pool); 
    }
}).catch(err => console.error('❌ Erro na conexão SQL:', err));

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

// --- SYSTEM ---
app.get('/api/system-users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/system-users', async (req, res) => {
    const { id, name, email, password, role, _adminUser } = req.body;
    const pool = await sql.connect(dbConfig);
    await pool.request().input('Id', sql.NVarChar, id).input('N', sql.NVarChar, name).input('E', sql.NVarChar, email).input('P', sql.NVarChar, password).input('R', sql.NVarChar, role).query("INSERT INTO SystemUsers (Id, Name, Email, Password, Role) VALUES (@Id, @N, @E, @P, @R)");
    await logAction(id, 'System', 'Criação Usuário', _adminUser, name);
    res.json({success: true});
});

app.put('/api/system-users/:id', async (req, res) => {
    const { name, email, password, role, _adminUser } = req.body;
    const pool = await sql.connect(dbConfig);
    const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM SystemUsers WHERE Id=@Id");
    const prev = oldRes.recordset[0];
    await pool.request().input('Id', sql.NVarChar, req.params.id).input('N', sql.NVarChar, name).input('E', sql.NVarChar, email).input('P', sql.NVarChar, password).input('R', sql.NVarChar, role).query("UPDATE SystemUsers SET Name=@N, Email=@E, Password=@P, Role=@R WHERE Id=@Id");
    await logAction(req.params.id, 'System', 'Atualização Usuário', _adminUser, name, '', null, prev, { name, email, role });
    res.json({success: true});
});

app.delete('/api/system-users/:id', async (req, res) => {
    const pool = await sql.connect(dbConfig);
    await pool.request().input('Id', sql.NVarChar, req.params.id).query("DELETE FROM SystemUsers WHERE Id=@Id");
    res.json({success: true});
});

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
    await logAction('settings', 'System', 'Configuração', _adminUser, 'Configurações Gerais', '', null, prev, { appName, logoUrl, cnpj });
    res.json({success: true});
});

// --- CATALOG HELPER ---
const crud = (table, route, assetType) => {
    app.get(`/api/${route}`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query(`SELECT * FROM ${table}`);
            const camelCased = result.recordset.map(row => {
                const entry = {};
                for (let key in row) {
                    const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
                    entry[camelKey] = (key === 'CustomFieldIds' || key === 'CustomData') && row[key] ? JSON.parse(row[key]) : row[key];
                }
                return entry;
            });
            res.json(camelCased);
        } catch (err) { res.status(500).send(`Error fetching ${route}: ${err.message}`); }
    });

    app.post(`/api/${route}`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            let columns = [];
            let values = [];
            for (let key in req.body) {
                if (key.startsWith('_')) continue;
                const dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                request.input(dbKey, val);
                columns.push(dbKey);
                values.push('@' + dbKey);
            }
            await request.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`);
            await logAction(req.body.id, assetType, 'Criação', req.body._adminUser, req.body.name || req.body.phoneNumber || req.body.fullName);
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put(`/api/${route}/:id`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const prev = oldRes.recordset[0];
            let sets = [];
            for (let key in req.body) {
                if (key.startsWith('_')) continue;
                const dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                request.input(dbKey, val);
                sets.push(`${dbKey}=@${dbKey}`);
            }
            request.input('TargetId', req.params.id);
            await request.query(`UPDATE ${table} SET ${sets.join(',')} WHERE Id=@TargetId`);
            await logAction(req.params.id, assetType, 'Atualização', req.body._adminUser, req.body.name || req.body.phoneNumber || req.body.fullName, req.body._reason, null, prev, req.body);
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

// Registrando rotas dinâmicas do catálogo
crud('Sectors', 'sectors', 'Sector');
crud('Brands', 'brands', 'Brand');
crud('AssetTypes', 'asset-types', 'Type');
crud('Models', 'models', 'Model');
crud('AccessoryTypes', 'accessory-types', 'Accessory');
crud('CustomFields', 'custom-fields', 'CustomField');
crud('MaintenanceRecords', 'maintenances', 'Maintenance');
crud('SoftwareAccounts', 'accounts', 'Account');

// --- MAIN ENTITIES ---
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
        const result = await pool.request().query("SELECT Id as id, ModelId as modelId, SerialNumber as serialNumber, AssetTag as assetTag, InternalCode as internalCode, Imei as imei, PulsusId as pulsusId, Status as status, CurrentUserId as currentUserId, SectorId as sectorId, CostCenter as costCenter, LinkedSimId as linkedSimId, PurchaseDate as purchaseDate, PurchaseCost as purchaseCost, InvoiceNumber as invoiceNumber, Supplier as supplier, PurchaseInvoiceUrl as purchaseInvoiceUrl, CustomData as customDataStr FROM Devices");
        const devices = await Promise.all(result.recordset.map(async d => {
            const acc = await pool.request().input('DevId', sql.NVarChar, d.id).query("SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId=@DevId");
            return { ...d, customData: d.customDataStr ? JSON.parse(d.customDataStr) : {}, accessories: acc.recordset };
        }));
        res.json(devices);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/users', async (req, res) => {
    try {
        const { id, fullName, email, sectorId, internalCode, active, cpf, rg, pis, address, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request().input('I',id).input('F',fullName).input('E',email).input('S',sectorId).input('C',internalCode).input('A',active).input('Cp',cpf).input('R',rg).input('P',pis).input('Ad',address).query("INSERT INTO Users (Id, FullName, Email, SectorId, InternalCode, Active, Cpf, Rg, Pis, Address) VALUES (@I, @F, @E, @S, @C, @A, @Cp, @R, @P, @Ad)");
        await logAction(id, 'User', 'Criação', _adminUser, fullName);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const { fullName, email, sectorId, internalCode, active, cpf, rg, pis, address, _adminUser, _reason } = req.body;
        const pool = await sql.connect(dbConfig);
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM Users WHERE Id=@Id");
        const prev = oldRes.recordset[0];
        await pool.request().input('I',req.params.id).input('F',fullName).input('E',email).input('S',sectorId).input('C',internalCode).input('A',active).input('Cp',cpf).input('R',rg).input('P',pis).input('Ad',address).query("UPDATE Users SET FullName=@F, Email=@E, SectorId=@S, InternalCode=@C, Active=@A, Cpf=@Cp, Rg=@R, Pis=@P, Address=@Ad WHERE Id=@I");
        await logAction(req.params.id, 'User', 'Atualização', _adminUser, fullName, _reason, null, prev, req.body);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/sims', async (req, res) => {
    try {
        const { id, phoneNumber, operator, iccid, planDetails, status, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request().input('I',id).input('P',phoneNumber).input('O',operator).input('Ic',iccid).input('Pl',planDetails).input('S',status).query("INSERT INTO SimCards (Id, PhoneNumber, Operator, Iccid, PlanDetails, Status) VALUES (@I, @P, @O, @Ic, @Pl, @S)");
        await logAction(id, 'Sim', 'Criação', _adminUser, phoneNumber);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/sims/:id', async (req, res) => {
    try {
        const { phoneNumber, operator, iccid, planDetails, status, _adminUser, _reason } = req.body;
        const pool = await sql.connect(dbConfig);
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM SimCards WHERE Id=@Id");
        const prev = oldRes.recordset[0];
        await pool.request().input('I',req.params.id).input('P',phoneNumber).input('O',operator).input('Ic',iccid).input('Pl',planDetails).input('S',status).query("UPDATE SimCards SET PhoneNumber=@P, Operator=@O, Iccid=@Ic, PlanDetails=@Pl, Status=@S WHERE Id=@I");
        await logAction(req.params.id, 'Sim', 'Atualização', _adminUser, phoneNumber, _reason, null, prev, req.body);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/sims/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('I', req.params.id).query("DELETE FROM SimCards WHERE Id=@I");
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/devices', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { id, modelId, serialNumber, assetTag, status, internalCode, imei, pulsusId, sectorId, costCenter, linkedSimId, purchaseDate, purchaseCost, invoiceNumber, supplier, purchaseInvoiceUrl, customData, currentUserId, _adminUser } = req.body;
        await pool.request()
            .input('I',id)
            .input('M',modelId)
            .input('Sn',serialNumber)
            .input('At',assetTag)
            .input('St',status)
            .input('Ic',internalCode)
            .input('Im',imei)
            .input('Pu',pulsusId)
            .input('Se',sectorId)
            .input('Co',costCenter)
            .input('Ls',linkedSimId)
            .input('Pd',purchaseDate)
            .input('Pc',purchaseCost)
            .input('In',invoiceNumber)
            .input('Su',supplier)
            .input('PuU',purchaseInvoiceUrl)
            .input('Cd',JSON.stringify(customData))
            .input('Cuid', currentUserId)
            .query("INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, Status, InternalCode, Imei, PulsusId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, PurchaseInvoiceUrl, CustomData, CurrentUserId) VALUES (@I, @M, @Sn, @At, @St, @Ic, @Im, @Pu, @Se, @Co, @Ls, @Pd, @Pc, @In, @Su, @PuU, @Cd, @Cuid)");
        await logAction(id, 'Device', 'Criação', _adminUser, assetTag);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/devices/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { modelId, serialNumber, assetTag, status, internalCode, imei, pulsusId, sectorId, costCenter, linkedSimId, purchaseDate, purchaseCost, invoiceNumber, supplier, purchaseInvoiceUrl, customData, currentUserId, _adminUser, _reason } = req.body;
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM Devices WHERE Id=@Id");
        const prev = oldRes.recordset[0];
        await pool.request()
            .input('I',req.params.id)
            .input('M',modelId)
            .input('Sn',serialNumber)
            .input('At',assetTag)
            .input('St',status)
            .input('Ic',internalCode)
            .input('Im',imei)
            .input('Pu',pulsusId)
            .input('Se',sectorId)
            .input('Co',costCenter)
            .input('Ls',linkedSimId)
            .input('Pd',purchaseDate)
            .input('Pc',purchaseCost)
            .input('In',invoiceNumber)
            .input('Su',supplier)
            .input('PuU',purchaseInvoiceUrl)
            .input('Cd',JSON.stringify(customData))
            .input('Cuid', currentUserId)
            .query("UPDATE Devices SET ModelId=@M, SerialNumber=@Sn, AssetTag=@At, Status=@St, InternalCode=@Ic, Imei=@Im, PulsusId=@Pu, SectorId=@Se, CostCenter=@Co, LinkedSimId=@Ls, PurchaseDate=@Pd, PurchaseCost=@Pc, InvoiceNumber=@In, Supplier=@Su, PurchaseInvoiceUrl=@PuU, CustomData=@Cd, CurrentUserId=@Cuid WHERE Id=@I");
        await logAction(req.params.id, 'Device', 'Atualização', _adminUser, assetTag, _reason, null, prev, req.body);
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

// --- OPERATIONS ---
app.post('/api/operations/checkout', async (req, res) => {
    try {
        const { assetId, assetType, userId, notes, _adminUser, accessories } = req.body;
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        const oldRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT * FROM ${table} WHERE Id=@Id`);
        const prev = oldRes.recordset[0];
        const userRes = await pool.request().input('Uid', sql.NVarChar, userId).query("SELECT FullName FROM Users WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';
        
        // Geração de detalhes do ativo para o termo (Fix multi-asset bug)
        let assetDetails = notes || '';
        if (assetType === 'Device' && prev) {
            const modelRes = await pool.request().input('Mid', sql.NVarChar, prev.ModelId).query("SELECT Name FROM Models WHERE Id=@Mid");
            assetDetails = `[TAG: ${prev.AssetTag}] ${modelRes.recordset[0]?.Name || 'Dispositivo'}`;
        } else if (prev) {
            assetDetails = `[CHIP: ${prev.PhoneNumber}]`;
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
        await logAction(assetId, assetType, 'Entrega', _adminUser, assetId, notes, null, prev, { status: 'Em Uso', currentUserId: userId, userName: userName });
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
        
        // Geração de detalhes do ativo para o termo (Fix multi-asset bug)
        let assetDetails = notes || '';
        if (assetType === 'Device' && prev) {
            const modelRes = await pool.request().input('Mid', sql.NVarChar, prev.ModelId).query("SELECT Name FROM Models WHERE Id=@Mid");
            assetDetails = `[TAG: ${prev.AssetTag}] ${modelRes.recordset[0]?.Name || 'Dispositivo'}`;
        } else if (prev) {
            assetDetails = `[CHIP: ${prev.PhoneNumber}]`;
        }

        let userName = 'Colaborador';
        if (userId) {
            const userRes = await pool.request().input('Uid', sql.NVarChar, userId).query("SELECT FullName FROM Users WHERE Id=@Uid");
            userName = userRes.recordset[0]?.FullName || 'Colaborador';
        }
        
        // Se for dispositivo, buscar se tem chip vinculado para liberar
        if (assetType === 'Device' && prev && prev.LinkedSimId) {
            await pool.request().input('Sid', sql.NVarChar, prev.LinkedSimId).query("UPDATE SimCards SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Sid");
        }

        await pool.request().input('Aid', assetId).query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Aid`);
        
        if (userId) {
            const termId = Math.random().toString(36).substr(2, 9);
            await pool.request().input('I', termId).input('U', userId).input('T', 'DEVOLUCAO').input('Ad', assetDetails).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@I, @U, @T, @Ad, GETDATE())");
            
            // --- NOVO: INATIVAÇÃO AUTOMÁTICA DO COLABORADOR ---
            if (inactivateUser) {
                await pool.request().input('Uid', sql.NVarChar, userId).query("UPDATE Users SET Active=0 WHERE Id=@Uid");
                await logAction(userId, 'User', 'Inativação', _adminUser, userName, 'Inativado automaticamente durante a devolução (Desligamento)');
            }
        }
        
        await logAction(assetId, assetType, 'Devolução', _adminUser, assetId, notes, null, { status: 'Em Uso', currentUserId: userId, userName: userName }, { status: 'Disponível', currentUserId: null });
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/terms', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, UserId as userId, Type as type, AssetDetails as assetDetails, Date as date, FileUrl as fileUrl FROM Terms");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/terms/file/:id', async (req, res) => {
    try {
        const { fileUrl } = req.body;
        const id = req.params.id;
        const pool = await sql.connect(dbConfig);
        await pool.request().input('I', id).input('F', fileUrl).query("UPDATE Terms SET FileUrl=@F WHERE Id=@I");
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/terms/:id/file', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('I', req.params.id).query("UPDATE Terms SET FileUrl='' WHERE Id=@I");
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/logs', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, AssetId as assetId, Action as action, Timestamp as timestamp, AdminUser as adminUser, TargetName as targetName, Notes as notes, BackupData as backupData, PreviousData as previousData, NewData as newData FROM AuditLogs ORDER BY Timestamp DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/logs', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().query("DELETE FROM AuditLogs");
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/restore', async (req, res) => {
    try {
        const { logId, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        const log = await pool.request().input('I', logId).query("SELECT * FROM AuditLogs WHERE Id=@I");
        const data = log.recordset[0];
        if (data && data.BackupData) {
            await logAction(data.AssetId, data.AssetType, 'Restauração', _adminUser, data.TargetName, 'Item restaurado via log');
        }
        res.json({success: true});
    } catch (err) { res.status(500).send(err.message); }
});

// Finalização da inicialização do servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 Health Check em: http://localhost:${PORT}/api/health`);
});
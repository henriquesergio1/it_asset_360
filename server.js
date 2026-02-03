
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

async function runMigrations(pool) {
    console.log('🔄 Verificando esquema do banco de dados...');
    const baseTables = `
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sectors') CREATE TABLE Sectors (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Brands') CREATE TABLE Brands (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetTypes') CREATE TABLE AssetTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL, CustomFieldIds NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Models') CREATE TABLE Models (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL, BrandId NVARCHAR(50), TypeId NVARCHAR(50), ImageUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users') CREATE TABLE Users (Id NVARCHAR(50) PRIMARY KEY, FullName NVARCHAR(100) NOT NULL, Email NVARCHAR(100) NOT NULL, SectorId NVARCHAR(50), InternalCode NVARCHAR(50), Active BIT DEFAULT 1, Cpf NVARCHAR(20), Rg NVARCHAR(20), Pis NVARCHAR(20), Address NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SimCards') CREATE TABLE SimCards (Id NVARCHAR(50) PRIMARY KEY, PhoneNumber NVARCHAR(50) NOT NULL, Operator NVARCHAR(50), Iccid NVARCHAR(50), PlanDetails NVARCHAR(100), Status NVARCHAR(50) NOT NULL, CurrentUserId NVARCHAR(50) NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Devices') CREATE TABLE Devices (Id NVARCHAR(50) PRIMARY KEY, AssetTag NVARCHAR(50), Status NVARCHAR(50) NOT NULL, ModelId NVARCHAR(50), SerialNumber NVARCHAR(50), InternalCode NVARCHAR(50), Imei NVARCHAR(50), PulsusId NVARCHAR(50), CurrentUserId NVARCHAR(50) NULL, SectorId NVARCHAR(50), CostCenter NVARCHAR(50), LinkedSimId NVARCHAR(50) NULL, PurchaseDate DATE, PurchaseCost DECIMAL(18,2), InvoiceNumber NVARCHAR(50), Supplier NVARCHAR(100), PurchaseInvoiceUrl NVARCHAR(MAX), CustomData NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SoftwareAccounts') CREATE TABLE SoftwareAccounts (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Type NVARCHAR(50), Login NVARCHAR(200), Password NVARCHAR(MAX), LicenseKey NVARCHAR(MAX), Status NVARCHAR(20), UserId NVARCHAR(50), DeviceId NVARCHAR(50), SectorId NVARCHAR(50), Notes NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs') CREATE TABLE AuditLogs (Id NVARCHAR(50) PRIMARY KEY, AssetId NVARCHAR(50), Action NVARCHAR(50), Timestamp DATETIME2 DEFAULT GETDATE(), AdminUser NVARCHAR(100), Notes NVARCHAR(MAX), BackupData NVARCHAR(MAX), AssetType NVARCHAR(50), TargetName NVARCHAR(100));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings') CREATE TABLE SystemSettings (Id INT PRIMARY KEY IDENTITY(1,1), AppName NVARCHAR(100), LogoUrl NVARCHAR(MAX), Cnpj NVARCHAR(20), TermTemplate NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemUsers') CREATE TABLE SystemUsers (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Email NVARCHAR(100), Password NVARCHAR(100), Role NVARCHAR(20));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccessoryTypes') CREATE TABLE AccessoryTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomFields') CREATE TABLE CustomFields (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MaintenanceRecords') CREATE TABLE MaintenanceRecords (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, Description NVARCHAR(MAX), Cost DECIMAL(18,2), Date DATETIME2, Type NVARCHAR(50), Provider NVARCHAR(100), InvoiceUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Terms') CREATE TABLE Terms (Id NVARCHAR(50) PRIMARY KEY, UserId NVARCHAR(50), Type NVARCHAR(20), AssetDetails NVARCHAR(255), Date DATETIME2, FileUrl NVARCHAR(MAX));
    `;
    await pool.request().query(baseTables);
    console.log('✅ Banco de Dados Atualizado.');
}

sql.connect(dbConfig).then(async pool => {
    if (pool.connected) { 
        console.log('✅ Conectado ao SQL Server'); 
        await runMigrations(pool); 
    }
}).catch(err => console.error('❌ Erro na conexão SQL:', err));

async function logAction(assetId, assetType, action, adminUser, targetName, notes, backupData = null) {
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
            .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, TargetName, Notes, BackupData) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @TargetName, @Notes, @BackupData)`);
    } catch (e) { console.error('Erro de Log:', e); }
}

// --- DEVICES ---
app.get('/api/devices', async (req, res) => {
    try {
        const result = await sql.query(`SELECT Id as id, ModelId as modelId, SerialNumber as serialNumber, AssetTag as assetTag, InternalCode as internalCode, Imei as imei, PulsusId as pulsusId, Status as status, CurrentUserId as currentUserId, SectorId as sectorId, CostCenter as costCenter, LinkedSimId as linkedSimId, PurchaseDate as purchaseDate, PurchaseCost as purchaseCost, InvoiceNumber as invoiceNumber, Supplier as supplier, PurchaseInvoiceUrl as purchaseInvoiceUrl, CustomData as customDataStr FROM Devices`);
        res.json(result.recordset.map(d => ({ ...d, customData: d.customDataStr ? JSON.parse(d.customDataStr) : {} })));
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/devices', async (req, res) => {
    const d = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, d.id).input('ModelId', sql.NVarChar, d.modelId).input('SerialNumber', sql.NVarChar, d.serialNumber)
            .input('AssetTag', sql.NVarChar, d.assetTag).input('InternalCode', sql.NVarChar, d.internalCode).input('Imei', sql.NVarChar, d.imei)
            .input('PulsusId', sql.NVarChar, d.pulsusId).input('Status', sql.NVarChar, d.status).input('CurrentUserId', sql.NVarChar, d.currentUserId)
            .input('SectorId', sql.NVarChar, d.sectorId).input('CostCenter', sql.NVarChar, d.costCenter).input('LinkedSimId', sql.NVarChar, d.linkedSimId)
            .input('PurchaseDate', sql.Date, d.purchaseDate).input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost).input('InvoiceNumber', sql.NVarChar, d.invoiceNumber)
            .input('Supplier', sql.NVarChar, d.supplier).input('PurchaseInvoiceUrl', sql.NVarChar, d.purchaseInvoiceUrl).input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .query(`INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, InternalCode, Imei, PulsusId, Status, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, PurchaseInvoiceUrl, CustomData) 
                    VALUES (@Id, @ModelId, @SerialNumber, @AssetTag, @InternalCode, @Imei, @PulsusId, @Status, @CurrentUserId, @SectorId, @CostCenter, @LinkedSimId, @PurchaseDate, @PurchaseCost, @InvoiceNumber, @Supplier, @PurchaseInvoiceUrl, @CustomData)`);
        await logAction(d.id, 'Device', 'Criação', d._adminUser, d.assetTag, d.serialNumber);
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/devices/:id', async (req, res) => {
    const d = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id).input('ModelId', sql.NVarChar, d.modelId).input('SerialNumber', sql.NVarChar, d.serialNumber)
            .input('AssetTag', sql.NVarChar, d.assetTag).input('InternalCode', sql.NVarChar, d.internalCode).input('Imei', sql.NVarChar, d.imei)
            .input('PulsusId', sql.NVarChar, d.pulsusId).input('Status', sql.NVarChar, d.status).input('CurrentUserId', sql.NVarChar, d.currentUserId)
            .input('SectorId', sql.NVarChar, d.sectorId).input('CostCenter', sql.NVarChar, d.costCenter).input('LinkedSimId', sql.NVarChar, d.linkedSimId)
            .input('PurchaseDate', sql.Date, d.purchaseDate).input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost).input('InvoiceNumber', sql.NVarChar, d.invoiceNumber)
            .input('Supplier', sql.NVarChar, d.supplier).input('PurchaseInvoiceUrl', sql.NVarChar, d.purchaseInvoiceUrl).input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .query(`UPDATE Devices SET ModelId=@ModelId, SerialNumber=@SerialNumber, AssetTag=@AssetTag, InternalCode=@InternalCode, Imei=@Imei, PulsusId=@PulsusId, Status=@Status, CurrentUserId=@CurrentUserId, SectorId=@SectorId, CostCenter=@CostCenter, LinkedSimId=@LinkedSimId, PurchaseDate=@PurchaseDate, PurchaseCost=@PurchaseCost, InvoiceNumber=@InvoiceNumber, Supplier=@Supplier, PurchaseInvoiceUrl=@PurchaseInvoiceUrl, CustomData=@CustomData WHERE Id=@Id`);
        await logAction(d.id, 'Device', 'Atualização', d._adminUser, d.assetTag, d._reason || 'Edição');
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/devices/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM Devices WHERE Id=@Id`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- USERS ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await sql.query(`SELECT Id as id, FullName as fullName, Email as email, Cpf as cpf, Rg as rg, Pis as pis, Address as address, InternalCode as internalCode, SectorId as sectorId, Active as active FROM Users`);
        res.json(result.recordset.map(u => ({ ...u, active: !!u.active })));
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/users', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, u.id).input('FullName', sql.NVarChar, u.fullName).input('Email', sql.NVarChar, u.email).input('Cpf', sql.NVarChar, u.cpf)
            .input('Rg', sql.NVarChar, u.rg).input('Pis', sql.NVarChar, u.pis).input('Address', sql.NVarChar, u.address).input('InternalCode', sql.NVarChar, u.internalCode).input('SectorId', sql.NVarChar, u.sectorId)
            .query(`INSERT INTO Users (Id, FullName, Email, Cpf, Rg, Pis, Address, InternalCode, SectorId, Active) VALUES (@Id, @FullName, @Email, @Cpf, @Rg, @Pis, @Address, @InternalCode, @SectorId, 1)`);
        await logAction(u.id, 'User', 'Criação', u._adminUser, u.fullName);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/users/:id', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id).input('FullName', sql.NVarChar, u.fullName).input('Email', sql.NVarChar, u.email).input('Cpf', sql.NVarChar, u.cpf)
            .input('Rg', sql.NVarChar, u.rg).input('Pis', sql.NVarChar, u.pis).input('Address', sql.NVarChar, u.address).input('InternalCode', sql.NVarChar, u.internalCode).input('SectorId', sql.NVarChar, u.sectorId).input('Active', sql.Bit, u.active ? 1 : 0)
            .query(`UPDATE Users SET FullName=@FullName, Email=@Email, Cpf=@Cpf, Rg=@Rg, Pis=@Pis, Address=@Address, InternalCode=@InternalCode, SectorId=@SectorId, Active=@Active WHERE Id=@Id`);
        await logAction(u.id, 'User', u._reason ? (u.active ? 'Ativação' : 'Inativação') : 'Atualização', u._adminUser, u.fullName, u._reason || u._notes);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});

// --- SECTORS ---
app.get('/api/sectors', async (req, res) => {
    try {
        const result = await sql.query(`SELECT Id as id, Name as name FROM Sectors ORDER BY Name ASC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/sectors', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, s.id)
            .input('Name', sql.NVarChar, s.name)
            .query(`INSERT INTO Sectors (Id, Name) VALUES (@Id, @Name)`);
        res.json(s);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/sectors/:id', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Name', sql.NVarChar, s.name)
            .query(`UPDATE Sectors SET Name=@Name WHERE Id=@Id`);
        res.json(s);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/sectors/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM Sectors WHERE Id=@Id`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- SIM CARDS ---
app.get('/api/sims', async (req, res) => {
    try {
        const result = await sql.query(`SELECT Id as id, PhoneNumber as phoneNumber, Operator as operator, Iccid as iccid, PlanDetails as planDetails, Status as status, CurrentUserId as currentUserId FROM SimCards`);
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/sims', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, s.id).input('PhoneNumber', sql.NVarChar, s.phoneNumber).input('Operator', sql.NVarChar, s.operator).input('Iccid', sql.NVarChar, s.iccid).input('PlanDetails', sql.NVarChar, s.planDetails).input('Status', sql.NVarChar, s.status).input('CurrentUserId', sql.NVarChar, s.currentUserId)
            .query(`INSERT INTO SimCards (Id, PhoneNumber, Operator, Iccid, PlanDetails, Status, CurrentUserId) VALUES (@Id, @PhoneNumber, @Operator, @Iccid, @PlanDetails, @Status, @CurrentUserId)`);
        await logAction(s.id, 'Sim', 'Criação', s._adminUser, s.phoneNumber);
        res.json(s);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/sims/:id', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id).input('PhoneNumber', sql.NVarChar, s.phoneNumber).input('Operator', sql.NVarChar, s.operator).input('Iccid', sql.NVarChar, s.iccid).input('PlanDetails', sql.NVarChar, s.planDetails).input('Status', sql.NVarChar, s.status).input('CurrentUserId', sql.NVarChar, s.currentUserId)
            .query(`UPDATE SimCards SET PhoneNumber=@PhoneNumber, Operator=@Operator, Iccid=@Iccid, PlanDetails=@PlanDetails, Status=@Status, CurrentUserId=@CurrentUserId WHERE Id=@Id`);
        await logAction(s.id, 'Sim', 'Atualização', s._adminUser, s.phoneNumber);
        res.json(s);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/sims/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM SimCards WHERE Id=@Id`);
        await logAction(req.params.id, 'Sim', 'Exclusão', req.body._adminUser, 'SIM Card', req.body.reason);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- MODELS, BRANDS, TYPES ---
app.get('/api/models', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name, BrandId as brandId, TypeId as typeId, ImageUrl as imageUrl FROM Models`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.post('/api/models', async (req, res) => {
    const m = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, m.id).input('Name', sql.NVarChar, m.name).input('BrandId', sql.NVarChar, m.brandId).input('TypeId', sql.NVarChar, m.typeId).input('ImageUrl', sql.NVarChar, m.imageUrl)
            .query(`INSERT INTO Models (Id, Name, BrandId, TypeId, ImageUrl) VALUES (@Id, @Name, @BrandId, @TypeId, @ImageUrl)`);
        res.json(m);
    } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/models/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM Models WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/brands', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name FROM Brands ORDER BY Name ASC`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.post('/api/brands', async (req, res) => {
    const b = req.body;
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, b.id).input('Name', sql.NVarChar, b.name).query(`INSERT INTO Brands (Id, Name) VALUES (@Id, @Name)`); res.json(b); } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/brands/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM Brands WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/asset-types', async (req, res) => {
    try { 
        const result = await sql.query(`SELECT Id as id, Name as name, CustomFieldIds as customFieldIdsStr FROM AssetTypes`); 
        res.json(result.recordset.map(t => ({ ...t, customFieldIds: t.customFieldIdsStr ? JSON.parse(t.customFieldIdsStr) : [] })));
    } catch (err) { res.status(500).send(err.message); }
});
app.post('/api/asset-types', async (req, res) => {
    const t = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, t.id).input('Name', sql.NVarChar, t.name).input('CustomFieldIds', sql.NVarChar, JSON.stringify(t.customFieldIds || []))
            .query(`INSERT INTO AssetTypes (Id, Name, CustomFieldIds) VALUES (@Id, @Name, @CustomFieldIds)`);
        res.json(t);
    } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/asset-types/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM AssetTypes WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

// --- ACCOUNTS ---
app.get('/api/accounts', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name, Type as type, Login as login, Password as password, LicenseKey as licenseKey, Status as status, UserId as userId, DeviceId as deviceId, SectorId as sectorId, Notes as notes FROM SoftwareAccounts`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.post('/api/accounts', async (req, res) => {
    const a = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, a.id).input('Name', sql.NVarChar, a.name).input('Type', sql.NVarChar, a.type).input('Login', sql.NVarChar, a.login).input('Password', sql.NVarChar, a.password).input('LicenseKey', sql.NVarChar, a.licenseKey).input('Status', sql.NVarChar, a.status).input('UserId', sql.NVarChar, a.userId).input('DeviceId', sql.NVarChar, a.deviceId).input('SectorId', sql.NVarChar, a.sectorId).input('Notes', sql.NVarChar, a.notes)
            .query(`INSERT INTO SoftwareAccounts (Id, Name, Type, Login, Password, LicenseKey, Status, UserId, DeviceId, SectorId, Notes) VALUES (@Id, @Name, @Type, @Login, @Password, @LicenseKey, @Status, @UserId, @DeviceId, @SectorId, @Notes)`);
        await logAction(a.id, 'Account', 'Criação', a._adminUser, a.name);
        res.json(a);
    } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/accounts/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM SoftwareAccounts WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

// --- MAINTENANCES ---
app.get('/api/maintenances', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, DeviceId as deviceId, Type as type, Date as date, Description as description, Cost as cost, Provider as provider, InvoiceUrl as invoiceUrl FROM MaintenanceRecords`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.post('/api/maintenances', async (req, res) => {
    const m = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, m.id).input('DeviceId', sql.NVarChar, m.deviceId).input('Type', sql.NVarChar, m.type).input('Date', sql.DateTime2, m.date).input('Description', sql.NVarChar, m.description).input('Cost', sql.Decimal(18,2), m.cost).input('Provider', sql.NVarChar, m.provider).input('InvoiceUrl', sql.NVarChar, m.invoiceUrl)
            .query(`INSERT INTO MaintenanceRecords (Id, DeviceId, Type, Date, Description, Cost, Provider, InvoiceUrl) VALUES (@Id, @DeviceId, @Type, @Date, @Description, @Cost, @Provider, @InvoiceUrl)`);
        res.json(m);
    } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/maintenances/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM MaintenanceRecords WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

// --- SYSTEM USERS ---
app.get('/api/system-users', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.post('/api/system-users', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, u.id).input('Name', sql.NVarChar, u.name).input('Email', sql.NVarChar, u.email).input('Password', sql.NVarChar, u.password).input('Role', sql.NVarChar, u.role)
            .query(`INSERT INTO SystemUsers (Id, Name, Email, Password, Role) VALUES (@Id, @Name, @Email, @Password, @Role)`);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/system-users/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM SystemUsers WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

// --- TERMS ---
app.get('/api/terms', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, UserId as userId, Type as type, AssetDetails as assetDetails, Date as date, FileUrl as fileUrl FROM Terms`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.put('/api/terms/file', async (req, res) => {
    const t = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, t.id).input('FileUrl', sql.NVarChar, t.fileUrl).query(`UPDATE Terms SET FileUrl=@FileUrl WHERE Id=@Id`);
        await logAction(t.id, 'User', 'Atualização Termo', t._adminUser, 'Arquivo Anexado');
        res.json({success:true});
    } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/terms/:id/file', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, req.params.id).query(`UPDATE Terms SET FileUrl=NULL WHERE Id=@Id`);
        res.json({success:true});
    } catch (err) { res.status(500).send(err.message); }
});

// --- ACCESSORIES & CUSTOM FIELDS ---
app.get('/api/accessory-types', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name FROM AccessoryTypes ORDER BY Name ASC`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.post('/api/accessory-types', async (req, res) => {
    const t = req.body;
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, t.id).input('Name', sql.NVarChar, t.name).query(`INSERT INTO AccessoryTypes (Id, Name) VALUES (@Id, @Name)`); res.json(t); } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/accessory-types/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM AccessoryTypes WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/custom-fields', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name FROM CustomFields ORDER BY Name ASC`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});
app.post('/api/custom-fields', async (req, res) => {
    const f = req.body;
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, f.id).input('Name', sql.NVarChar, f.name).query(`INSERT INTO CustomFields (Id, Name) VALUES (@Id, @Name)`); res.json(f); } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/custom-fields/:id', async (req, res) => {
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM CustomFields WHERE Id=@Id`); res.json({success:true}); } catch (e) { res.status(500).send(e.message); }
});

// --- OPERATIONS (CHECKOUT / CHECKIN) ---
app.post('/api/operations/checkout', async (req, res) => {
    const { assetId, assetType, userId, notes, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        await pool.request()
            .input('Id', sql.NVarChar, assetId)
            .input('UserId', sql.NVarChar, userId)
            .query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@UserId WHERE Id=@Id`);
        
        // Gerar registro do termo
        const termId = Math.random().toString(36).substr(2, 9);
        await pool.request()
            .input('Id', sql.NVarChar, termId).input('UserId', sql.NVarChar, userId).input('Type', sql.NVarChar, 'ENTREGA').input('Details', sql.NVarChar, notes)
            .query(`INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@Id, @UserId, @Type, @Details, GETDATE())`);

        await logAction(assetId, assetType, 'Entrega', _adminUser, assetId, notes);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/operations/checkin', async (req, res) => {
    const { assetId, assetType, notes, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        
        // Buscar usuário atual antes de limpar
        const userRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT CurrentUserId FROM ${table} WHERE Id=@Id`);
        const userId = userRes.recordset[0]?.CurrentUserId;

        await pool.request()
            .input('Id', sql.NVarChar, assetId)
            .query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Id`);
        
        if (userId) {
            const termId = Math.random().toString(36).substr(2, 9);
            await pool.request()
                .input('Id', sql.NVarChar, termId).input('UserId', sql.NVarChar, userId).input('Type', sql.NVarChar, 'DEVOLUCAO').input('Details', sql.NVarChar, notes)
                .query(`INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@Id, @UserId, @Type, @Details, GETDATE())`);
        }

        await logAction(assetId, assetType, 'Devolução', _adminUser, assetId, notes);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- RESTORE ---
app.post('/api/restore', async (req, res) => {
    const { logId, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const logRes = await pool.request().input('Id', sql.NVarChar, logId).query(`SELECT * FROM AuditLogs WHERE Id=@Id`);
        const log = logRes.recordset[0];
        if (!log || !log.BackupData) return res.status(404).send('Backup não encontrado.');
        
        // Lógica de restauração baseada no AssetType (simplificada)
        await logAction(log.AssetId, log.AssetType, 'Restauração', _adminUser, log.TargetName, 'Restaurado via painel admin');
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
    try { const result = await sql.query(`SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate FROM SystemSettings`); res.json(result.recordset[0] || {}); }
    catch (err) { res.status(500).send(err.message); }
});

app.put('/api/settings', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('AppName', sql.NVarChar, s.appName).input('LogoUrl', sql.NVarChar, s.logoUrl).input('Cnpj', sql.NVarChar, s.cnpj).input('TermTemplate', sql.NVarChar, s.termTemplate)
            .query(`IF EXISTS (SELECT * FROM SystemSettings) UPDATE SystemSettings SET AppName=@AppName, LogoUrl=@LogoUrl, Cnpj=@Cnpj, TermTemplate=@TermTemplate ELSE INSERT INTO SystemSettings (AppName, LogoUrl, Cnpj, TermTemplate) VALUES (@AppName, @LogoUrl, @Cnpj, @TermTemplate)`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/logs', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, AssetId as assetId, AssetType as assetType, TargetName as targetName, Action as action, Timestamp as timestamp, AdminUser as adminUser, Notes as notes, BackupData as backupData FROM AuditLogs ORDER BY Timestamp DESC`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

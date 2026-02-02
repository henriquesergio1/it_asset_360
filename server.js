
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
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users') CREATE TABLE Users (Id NVARCHAR(50) PRIMARY KEY, FullName NVARCHAR(100) NOT NULL, Email NVARCHAR(100) NOT NULL, SectorId NVARCHAR(50), InternalCode NVARCHAR(50), Active BIT DEFAULT 1);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SimCards') CREATE TABLE SimCards (Id NVARCHAR(50) PRIMARY KEY, PhoneNumber NVARCHAR(50) NOT NULL, Status NVARCHAR(50) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Devices') CREATE TABLE Devices (Id NVARCHAR(50) PRIMARY KEY, AssetTag NVARCHAR(50), Status NVARCHAR(50) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SoftwareAccounts') CREATE TABLE SoftwareAccounts (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Type NVARCHAR(50), Login NVARCHAR(200), Password NVARCHAR(MAX), LicenseKey NVARCHAR(MAX), Status NVARCHAR(20), UserId NVARCHAR(50), DeviceId NVARCHAR(50), SectorId NVARCHAR(50), Notes NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs') CREATE TABLE AuditLogs (Id NVARCHAR(50) PRIMARY KEY, AssetId NVARCHAR(50), Action NVARCHAR(50), Timestamp DATETIME2 DEFAULT GETDATE(), AdminUser NVARCHAR(100), Notes NVARCHAR(MAX), BackupData NVARCHAR(MAX), AssetType NVARCHAR(50), TargetName NVARCHAR(100));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings') CREATE TABLE SystemSettings (Id INT PRIMARY KEY IDENTITY(1,1), AppName NVARCHAR(100), LogoUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemUsers') CREATE TABLE SystemUsers (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Email NVARCHAR(100), Password NVARCHAR(100), Role NVARCHAR(20));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccessoryTypes') CREATE TABLE AccessoryTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomFields') CREATE TABLE CustomFields (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceAccessories') CREATE TABLE DeviceAccessories (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, AccessoryTypeId NVARCHAR(50) NOT NULL, Name NVARCHAR(100));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MaintenanceRecords') CREATE TABLE MaintenanceRecords (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, Description NVARCHAR(MAX), Cost DECIMAL(18,2), Date DATETIME2, InvoiceUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Terms') CREATE TABLE Terms (Id NVARCHAR(50) PRIMARY KEY, UserId NVARCHAR(50), Type NVARCHAR(20), AssetDetails NVARCHAR(255), Date DATETIME2, FileUrl NVARCHAR(MAX));
    `;
    await pool.request().query(baseTables);
    console.log('✅ Tabelas verificadas.');
}

sql.connect(dbConfig).then(async pool => {
    if (pool.connected) { 
        console.log('✅ Conectado ao SQL Server'); 
        await runMigrations(pool); 
    }
}).catch(err => console.error('❌ Erro na conexão SQL:', err));

async function logAction(assetId, assetType, action, adminUser, notes, targetName = '', backupData = null) {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, Math.random().toString(36).substr(2, 9))
            .input('AssetId', sql.NVarChar, assetId)
            .input('AssetType', sql.NVarChar, assetType)
            .input('Action', sql.NVarChar, action)
            .input('AdminUser', sql.NVarChar, adminUser || 'Sistema')
            .input('Notes', sql.NVarChar, notes || '')
            .input('TargetName', sql.NVarChar, targetName)
            .input('BackupData', sql.NVarChar, backupData)
            .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, Notes, TargetName, BackupData, Timestamp) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @Notes, @TargetName, @BackupData, GETDATE())`);
    } catch (e) { console.error('Erro de Log:', e); }
}

// --- DEVICES ---
app.get('/api/devices', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM Devices`);
        res.json(result.recordset.map(d => ({
            id: d.Id, modelId: d.ModelId, serialNumber: d.SerialNumber, assetTag: d.AssetTag, 
            internalCode: d.InternalCode, imei: d.Imei, pulsusId: d.PulsusId, status: d.Status,
            currentUserId: d.CurrentUserId, sectorId: d.SectorId, purchaseDate: d.PurchaseDate,
            purchaseCost: d.PurchaseCost, invoiceNumber: d.InvoiceNumber, supplier: d.Supplier,
            purchaseInvoiceUrl: d.PurchaseInvoiceUrl, linkedSimId: d.LinkedSimId,
            customData: d.CustomData ? JSON.parse(d.CustomData) : {}
        })));
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/devices', async (req, res) => {
    const d = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, d.id).input('ModelId', sql.NVarChar, d.modelId).input('SerialNumber', sql.NVarChar, d.serialNumber)
            .input('AssetTag', sql.NVarChar, d.assetTag).input('Status', sql.NVarChar, d.status).input('InternalCode', sql.NVarChar, d.internalCode)
            .input('Imei', sql.NVarChar, d.imei).input('PulsusId', sql.NVarChar, d.pulsusId).input('SectorId', sql.NVarChar, d.sectorId)
            .input('PurchaseDate', sql.Date, d.purchaseDate).input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost)
            .input('InvoiceNumber', sql.NVarChar, d.invoiceNumber).input('Supplier', sql.NVarChar, d.supplier)
            .input('LinkedSimId', sql.NVarChar, d.linkedSimId).input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .query(`INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, Status, InternalCode, Imei, PulsusId, SectorId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, LinkedSimId, CustomData) 
                    VALUES (@Id, @ModelId, @SerialNumber, @AssetTag, @Status, @InternalCode, @Imei, @PulsusId, @SectorId, @PurchaseDate, @PurchaseCost, @InvoiceNumber, @Supplier, @LinkedSimId, @CustomData)`);
        await logAction(d.id, 'Device', 'Criação', d._adminUser, `Tag: ${d.assetTag}`, d.assetTag);
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/devices/:id', async (req, res) => {
    const d = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id).input('ModelId', sql.NVarChar, d.modelId).input('SerialNumber', sql.NVarChar, d.serialNumber)
            .input('AssetTag', sql.NVarChar, d.assetTag).input('Status', sql.NVarChar, d.status).input('InternalCode', sql.NVarChar, d.internalCode)
            .input('Imei', sql.NVarChar, d.imei).input('PulsusId', sql.NVarChar, d.pulsusId).input('SectorId', sql.NVarChar, d.sectorId)
            .input('CurrentUserId', sql.NVarChar, d.currentUserId).input('PurchaseDate', sql.Date, d.purchaseDate).input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost)
            .input('InvoiceNumber', sql.NVarChar, d.invoiceNumber).input('Supplier', sql.NVarChar, d.supplier).input('LinkedSimId', sql.NVarChar, d.linkedSimId)
            .input('PurchaseInvoiceUrl', sql.NVarChar, d.purchaseInvoiceUrl).input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .query(`UPDATE Devices SET ModelId=@ModelId, SerialNumber=@SerialNumber, AssetTag=@AssetTag, Status=@Status, InternalCode=@InternalCode, Imei=@Imei, PulsusId=@PulsusId, SectorId=@SectorId, CurrentUserId=@CurrentUserId, PurchaseDate=@PurchaseDate, PurchaseCost=@PurchaseCost, InvoiceNumber=@InvoiceNumber, Supplier=@Supplier, LinkedSimId=@LinkedSimId, PurchaseInvoiceUrl=@PurchaseInvoiceUrl, CustomData=@CustomData WHERE Id=@Id`);
        await logAction(d.id, 'Device', 'Atualização', d._adminUser, `Motivo: ${d._reason || 'Edição'}`, d.assetTag);
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

// --- USERS ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM Users`);
        res.json(result.recordset.map(u => ({ id: u.Id, fullName: u.FullName, email: u.Email, cpf: u.Cpf, rg: u.Rg, pis: u.Pis, address: u.Address, internalCode: u.InternalCode, sectorId: u.SectorId, active: !!u.Active })));
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/users', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, u.id).input('FullName', sql.NVarChar, u.fullName).input('Email', sql.NVarChar, u.email).input('Cpf', sql.NVarChar, u.cpf).input('Rg', sql.NVarChar, u.rg).input('Pis', sql.NVarChar, u.pis).input('Address', sql.NVarChar, u.address).input('InternalCode', sql.NVarChar, u.internalCode).input('SectorId', sql.NVarChar, u.sectorId)
            .query(`INSERT INTO Users (Id, FullName, Email, Cpf, Rg, Pis, Address, InternalCode, SectorId, Active) VALUES (@Id, @FullName, @Email, @Cpf, @Rg, @Pis, @Address, @InternalCode, @SectorId, 1)`);
        await logAction(u.id, 'User', 'Criação', u._adminUser, u.fullName, u.fullName);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/users/:id', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, req.params.id).input('FullName', sql.NVarChar, u.fullName).input('Email', sql.NVarChar, u.email).input('Cpf', sql.NVarChar, u.cpf).input('Rg', sql.NVarChar, u.rg).input('Pis', sql.NVarChar, u.pis).input('Address', sql.NVarChar, u.address).input('InternalCode', sql.NVarChar, u.internalCode).input('SectorId', sql.NVarChar, u.sectorId).input('Active', sql.Bit, u.active ? 1 : 0)
            .query(`UPDATE Users SET FullName=@FullName, Email=@Email, Cpf=@Cpf, Rg=@Rg, Pis=@Pis, Address=@Address, InternalCode=@InternalCode, SectorId=@SectorId, Active=@Active WHERE Id=@Id`);
        await logAction(u.id, 'User', 'Atualização', u._adminUser, `Motivo: ${u._reason || 'Edição'}`, u.fullName);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});

// --- MODELS, BRANDS, TYPES ---
app.get('/api/models', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name, BrandId as brandId, TypeId as typeId, ImageUrl as imageUrl FROM Models`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});
app.post('/api/models', async (req, res) => {
    const m = req.body;
    try { await sql.connect(dbConfig); await sql.query(`INSERT INTO Models (Id, Name, BrandId, TypeId, ImageUrl) VALUES ('${m.id}', '${m.name}', '${m.brandId}', '${m.typeId}', '${m.imageUrl || ''}')`); res.json(m); }
    catch (e) { res.status(500).send(e.message); }
});

app.get('/api/brands', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name FROM Brands`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});
app.post('/api/brands', async (req, res) => {
    const b = req.body;
    try { await sql.connect(dbConfig); await sql.query(`INSERT INTO Brands (Id, Name) VALUES ('${b.id}', '${b.name}')`); res.json(b); }
    catch (e) { res.status(500).send(e.message); }
});

app.get('/api/asset-types', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name, CustomFieldIds as customFieldIds FROM AssetTypes`); res.json(r.recordset.map(t => ({...t, customFieldIds: t.customFieldIds ? JSON.parse(t.customFieldIds) : []}))); }
    catch (e) { res.status(500).send(e.message); }
});

// --- SIM CARDS ---
app.get('/api/sims', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, PhoneNumber as phoneNumber, Operator as operator, Iccid as iccid, Status as status, CurrentUserId as currentUserId, PlanDetails as planDetails FROM SimCards`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});
app.post('/api/sims', async (req, res) => {
    const s = req.body;
    try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, s.id).input('Phone', sql.NVarChar, s.phoneNumber).input('Op', sql.NVarChar, s.operator).input('Iccid', sql.NVarChar, s.iccid).input('Status', sql.NVarChar, s.status).input('Plan', sql.NVarChar, s.planDetails).query(`INSERT INTO SimCards (Id, PhoneNumber, Operator, Iccid, Status, PlanDetails) VALUES (@Id, @Phone, @Op, @Iccid, @Status, @Plan)`); res.json(s); }
    catch (e) { res.status(500).send(e.message); }
});

// --- ACCOUNTS (NOVO) ---
app.get('/api/accounts', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name, Type as type, Login as login, Password as password, LicenseKey as licenseKey, Status as status, UserId as userId, DeviceId as deviceId, SectorId as sectorId, Notes as notes FROM SoftwareAccounts`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});

// --- SYSTEM USERS ---
app.get('/api/system-users', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
    try { const r = await sql.query(`SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate FROM SystemSettings`); res.json(r.recordset[0] || {}); }
    catch (e) { res.status(500).send(e.message); }
});

// --- MAINTENANCES ---
app.get('/api/maintenances', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, DeviceId as deviceId, Description as description, Cost as cost, Date as date, InvoiceUrl as invoiceUrl FROM MaintenanceRecords`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});

// --- SECTORS, CUSTOM FIELDS, ACCESSORIES ---
app.get('/api/sectors', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name FROM Sectors`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/api/custom-fields', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name FROM CustomFields`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/api/accessory-types', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, Name as name FROM AccessoryTypes`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});

// --- AUDIT LOGS ---
app.get('/api/logs', async (req, res) => {
    try { const r = await sql.query(`SELECT Id as id, AssetId as assetId, AssetType as assetType, Action as action, AdminUser as adminUser, Notes as notes, Timestamp as timestamp, TargetName as targetName FROM AuditLogs ORDER BY Timestamp DESC`); res.json(r.recordset); }
    catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

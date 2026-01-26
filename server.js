
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
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sectors')
        CREATE TABLE Sectors (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Brands')
        CREATE TABLE Brands (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetTypes')
        CREATE TABLE AssetTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL, CustomFieldIds NVARCHAR(MAX));

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Models')
        CREATE TABLE Models (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL, BrandId NVARCHAR(50), TypeId NVARCHAR(50), ImageUrl NVARCHAR(MAX));

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
        CREATE TABLE Users (Id NVARCHAR(50) PRIMARY KEY, FullName NVARCHAR(100) NOT NULL, Email NVARCHAR(100) NOT NULL, SectorId NVARCHAR(50), InternalCode NVARCHAR(50), Active BIT DEFAULT 1);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SimCards')
        CREATE TABLE SimCards (Id NVARCHAR(50) PRIMARY KEY, PhoneNumber NVARCHAR(50) NOT NULL, Status NVARCHAR(50) NOT NULL);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Devices')
        CREATE TABLE Devices (Id NVARCHAR(50) PRIMARY KEY, AssetTag NVARCHAR(50), Status NVARCHAR(50) NOT NULL);
        
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs')
        CREATE TABLE AuditLogs (Id NVARCHAR(50) PRIMARY KEY, AssetId NVARCHAR(50), Action NVARCHAR(50), Timestamp DATETIME2 DEFAULT GETDATE(), AdminUser NVARCHAR(100), Notes NVARCHAR(MAX), BackupData NVARCHAR(MAX), AssetType NVARCHAR(50));
        
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings')
        CREATE TABLE SystemSettings (Id INT PRIMARY KEY IDENTITY(1,1), AppName NVARCHAR(100), LogoUrl NVARCHAR(MAX));
        
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemUsers')
        CREATE TABLE SystemUsers (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Email NVARCHAR(100), Password NVARCHAR(100), Role NVARCHAR(20));

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccessoryTypes')
        CREATE TABLE AccessoryTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomFields')
        CREATE TABLE CustomFields (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceAccessories')
        CREATE TABLE DeviceAccessories (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, AccessoryTypeId NVARCHAR(50) NOT NULL, Name NVARCHAR(100));

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MaintenanceRecords')
        CREATE TABLE MaintenanceRecords (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, Description NVARCHAR(MAX), Cost DECIMAL(18,2), Date DATETIME2, InvoiceUrl NVARCHAR(MAX));

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Terms')
        CREATE TABLE Terms (Id NVARCHAR(50) PRIMARY KEY, UserId NVARCHAR(50), Type NVARCHAR(20), AssetDetails NVARCHAR(255), Date DATETIME2, FileUrl NVARCHAR(MAX));
    `;
    await pool.request().query(baseTables);

    const columns = [
        { table: 'Devices', col: 'InternalCode', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'JobTitle', type: 'NVARCHAR(100)' },
        { table: 'Devices', col: 'ModelId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'SerialNumber', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'Imei', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'PulsusId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'CustomData', type: 'NVARCHAR(MAX)' },
        { table: 'Devices', col: 'CurrentUserId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'SectorId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'CostCenter', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'LinkedSimId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'PurchaseDate', type: 'DATE' },
        { table: 'Devices', col: 'PurchaseCost', type: 'DECIMAL(18,2)' },
        { table: 'Devices', col: 'InvoiceNumber', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'Supplier', type: 'NVARCHAR(100)' },
        { table: 'Devices', col: 'PurchaseInvoiceUrl', type: 'NVARCHAR(MAX)' },
        { table: 'Users', col: 'JobTitle', type: 'NVARCHAR(100)' },
        { table: 'Users', col: 'Cpf', type: 'NVARCHAR(20)' },
        { table: 'Users', col: 'Rg', type: 'NVARCHAR(20)' },
        { table: 'Users', col: 'Address', type: 'NVARCHAR(255)' },
        { table: 'SimCards', col: 'Operator', type: 'NVARCHAR(50)' },
        { table: 'SimCards', col: 'Iccid', type: 'NVARCHAR(50)' },
        { table: 'SimCards', col: 'PlanDetails', type: 'NVARCHAR(100)' }
    ];

    for (const item of columns) {
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${item.table}' AND COLUMN_NAME = '${item.col}')
                BEGIN
                    ALTER TABLE ${item.table} ADD ${item.col} ${item.type};
                END
            `);
        } catch (e) { console.warn(`Aviso na coluna ${item.table}.${item.col}:`, e.message); }
    }
    console.log('✅ Banco de Dados Atualizado.');
}

sql.connect(dbConfig).then(async pool => {
    if (pool.connected) {
        console.log('✅ Conectado ao SQL Server');
        await runMigrations(pool);
    }
}).catch(err => console.error('❌ Erro na conexão SQL:', err));

async function logAction(assetId, assetType, action, adminUser, notes, backupData = null) {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, Math.random().toString(36).substr(2, 9))
            .input('AssetId', sql.NVarChar, assetId)
            .input('AssetType', sql.NVarChar, assetType)
            .input('Action', sql.NVarChar, action)
            .input('AdminUser', sql.NVarChar, adminUser || 'Sistema')
            .input('Notes', sql.NVarChar, notes || '')
            .input('BackupData', sql.NVarChar, backupData)
            .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, Notes, BackupData) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @Notes, @BackupData)`);
    } catch (e) { console.error('Erro de Log:', e); }
}

app.get('/api/devices', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT Id as id, ModelId as modelId, SerialNumber as serialNumber, AssetTag as assetTag, 
            InternalCode as internalCode, JobTitle as jobTitle, Imei as imei, PulsusId as pulsusId, Status as status, 
            CurrentUserId as currentUserId, SectorId as sectorId, CostCenter as costCenter, 
            LinkedSimId as linkedSimId, PurchaseDate as purchaseDate, PurchaseCost as purchaseCost, 
            InvoiceNumber as invoiceNumber, Supplier as supplier, PurchaseInvoiceUrl as purchaseInvoiceUrl,
            CustomData as customDataStr FROM Devices
        `);
        const formatted = result.recordset.map(d => ({
            ...d,
            customData: d.customDataStr ? JSON.parse(d.customDataStr) : {}
        }));
        res.json(formatted);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/devices', async (req, res) => {
    const d = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, d.id)
            .input('ModelId', sql.NVarChar, d.modelId)
            .input('SerialNumber', sql.NVarChar, d.serialNumber)
            .input('AssetTag', sql.NVarChar, d.assetTag || null)
            .input('InternalCode', sql.NVarChar, d.internalCode || null)
            .input('JobTitle', sql.NVarChar, d.jobTitle || null)
            .input('Imei', sql.NVarChar, d.imei || null)
            .input('PulsusId', sql.NVarChar, d.pulsusId || null)
            .input('Status', sql.NVarChar, d.status)
            .input('PurchaseDate', sql.Date, d.purchaseDate || null)
            .input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost || 0)
            .input('InvoiceNumber', sql.NVarChar, d.invoiceNumber || null)
            .input('Supplier', sql.NVarChar, d.supplier || null)
            .input('PurchaseInvoiceUrl', sql.NVarChar, d.purchaseInvoiceUrl || null)
            .input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .query(`INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, InternalCode, JobTitle, Imei, PulsusId, Status, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, PurchaseInvoiceUrl, CustomData) 
                    VALUES (@Id, @ModelId, @SerialNumber, @AssetTag, @InternalCode, @JobTitle, @Imei, @PulsusId, @Status, @PurchaseDate, @PurchaseCost, @InvoiceNumber, @Supplier, @PurchaseInvoiceUrl, @CustomData)`);
        await logAction(d.id, 'Device', 'Criação', d._adminUser, d.assetTag || d.imei);
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/devices/:id', async (req, res) => {
    const d = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('ModelId', sql.NVarChar, d.modelId)
            .input('SerialNumber', sql.NVarChar, d.serialNumber)
            .input('AssetTag', sql.NVarChar, d.assetTag || null)
            .input('InternalCode', sql.NVarChar, d.internalCode || null)
            .input('JobTitle', sql.NVarChar, d.jobTitle || null)
            .input('Imei', sql.NVarChar, d.imei || null)
            .input('PulsusId', sql.NVarChar, d.pulsusId || null)
            .input('Status', sql.NVarChar, d.status)
            .input('CurrentUserId', sql.NVarChar, d.currentUserId || null)
            .input('PurchaseDate', sql.Date, d.purchaseDate || null)
            .input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost || 0)
            .input('InvoiceNumber', sql.NVarChar, d.invoiceNumber || null)
            .input('Supplier', sql.NVarChar, d.supplier || null)
            .input('PurchaseInvoiceUrl', sql.NVarChar, d.purchaseInvoiceUrl || null)
            .input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .query(`UPDATE Devices SET ModelId=@ModelId, SerialNumber=@SerialNumber, AssetTag=@AssetTag, InternalCode=@InternalCode, JobTitle=@JobTitle, Imei=@Imei, PulsusId=@PulsusId, Status=@Status, CurrentUserId=@CurrentUserId, 
                    PurchaseDate=@PurchaseDate, PurchaseCost=@PurchaseCost, InvoiceNumber=@InvoiceNumber, Supplier=@Supplier, 
                    PurchaseInvoiceUrl=@PurchaseInvoiceUrl, CustomData=@CustomData WHERE Id=@Id`);
        await logAction(d.id, 'Device', 'Atualização', d._adminUser, `Motivo: ${d._reason || 'Edição'}`);
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await sql.query(`SELECT Id as id, FullName as fullName, Email as email, Cpf as cpf, Rg as rg, Address as address, InternalCode as internalCode, JobTitle as jobTitle, SectorId as sectorId, Active as active FROM Users`);
        res.json(result.recordset.map(u => ({ ...u, active: !!u.active })));
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/users', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, u.id)
            .input('FullName', sql.NVarChar, u.fullName)
            .input('Email', sql.NVarChar, u.email || '')
            .input('Cpf', sql.NVarChar, u.cpf || null)
            .input('Rg', sql.NVarChar, u.rg || null)
            .input('Address', sql.NVarChar, u.address || null)
            .input('InternalCode', sql.NVarChar, u.internalCode || null)
            .input('JobTitle', sql.NVarChar, u.jobTitle || null)
            .input('SectorId', sql.NVarChar, u.sectorId)
            .query(`INSERT INTO Users (Id, FullName, Email, Cpf, Rg, Address, InternalCode, JobTitle, SectorId, Active) VALUES (@Id, @FullName, @Email, @Cpf, @Rg, @Address, @InternalCode, @JobTitle, @SectorId, 1)`);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/users/:id', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('FullName', sql.NVarChar, u.fullName)
            .input('Email', sql.NVarChar, u.email || '')
            .input('Cpf', sql.NVarChar, u.cpf || null)
            .input('Rg', sql.NVarChar, u.rg || null)
            .input('Address', sql.NVarChar, u.address || null)
            .input('InternalCode', sql.NVarChar, u.internalCode || null)
            .input('JobTitle', sql.NVarChar, u.jobTitle || null)
            .input('Active', sql.Bit, u.active ? 1 : 0)
            .input('SectorId', sql.NVarChar, u.sectorId)
            .query(`UPDATE Users SET FullName=@FullName, Email=@Email, Cpf=@Cpf, Rg=@Rg, Address=@Address, InternalCode=@InternalCode, JobTitle=@JobTitle, Active=@Active, SectorId=@SectorId WHERE Id=@Id`);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/sectors', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name FROM Sectors`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
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
        await pool.request()
            .input('Id', sql.NVarChar, t.id)
            .input('Name', sql.NVarChar, t.name)
            .input('CustomFieldIds', sql.NVarChar, JSON.stringify(t.customFieldIds || []))
            .query(`INSERT INTO AssetTypes (Id, Name, CustomFieldIds) VALUES (@Id, @Name, @CustomFieldIds)`);
        res.json(t);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/brands', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name FROM Brands`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.post('/api/brands', async (req, res) => {
    const b = req.body;
    try { await sql.query(`INSERT INTO Brands (Id, Name) VALUES ('${b.id}', '${b.name}')`); res.json(b); }
    catch (err) { res.status(500).send(err.message); }
});

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

// --- SIM CARDS CRUD ---
app.get('/api/sims', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, PhoneNumber as phoneNumber, Operator as operator, Iccid as iccid, PlanDetails as planDetails, Status as status, CurrentUserId as currentUserId FROM SimCards`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.post('/api/sims', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, s.id)
            .input('PhoneNumber', sql.NVarChar, s.phoneNumber)
            .input('Operator', sql.NVarChar, s.operator || null)
            .input('Iccid', sql.NVarChar, s.iccid || null)
            .input('PlanDetails', sql.NVarChar, s.planDetails || null)
            .input('Status', sql.NVarChar, s.status)
            .query(`INSERT INTO SimCards (Id, PhoneNumber, Operator, Iccid, PlanDetails, Status) VALUES (@Id, @PhoneNumber, @Operator, @Iccid, @PlanDetails, @Status)`);
        await logAction(s.id, 'Sim', 'Criação', s._adminUser, s.phoneNumber);
        res.json(s);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/sims/:id', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('PhoneNumber', sql.NVarChar, s.phoneNumber)
            .input('Operator', sql.NVarChar, s.operator || null)
            .input('Iccid', sql.NVarChar, s.iccid || null)
            .input('PlanDetails', sql.NVarChar, s.planDetails || null)
            .input('Status', sql.NVarChar, s.status)
            .query(`UPDATE SimCards SET PhoneNumber=@PhoneNumber, Operator=@Operator, Iccid=@Iccid, PlanDetails=@PlanDetails, Status=@Status WHERE Id=@Id`);
        await logAction(s.id, 'Sim', 'Atualização', s._adminUser, s.phoneNumber);
        res.json(s);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/sims/:id', async (req, res) => {
    const { _adminUser, reason } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, req.params.id).query(`DELETE FROM SimCards WHERE Id=@Id`);
        await logAction(req.params.id, 'Sim', 'Exclusão', _adminUser, `Motivo: ${reason}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});
// --------------------

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
    try { const result = await sql.query(`SELECT Id as id, AssetId as assetId, AssetType as assetType, Action as action, Timestamp as timestamp, AdminUser as adminUser, Notes as notes, BackupData as backupData FROM AuditLogs ORDER BY Timestamp DESC`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.get('/api/system-users', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name, Email as email, Role as role, Password as password FROM SystemUsers`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.get('/api/maintenances', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, DeviceId as deviceId, Description as description, Cost as cost, Date as date FROM MaintenanceRecords`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.get('/api/terms', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, UserId as userId, Type as type, AssetDetails as assetDetails, Date as date, FileUrl as fileUrl FROM Terms`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.get('/api/accessory-types', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name FROM AccessoryTypes`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.get('/api/custom-fields', async (req, res) => {
    try { const result = await sql.query(`SELECT Id as id, Name as name FROM CustomFields`); res.json(result.recordset); }
    catch (err) { res.status(500).send(err.message); }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

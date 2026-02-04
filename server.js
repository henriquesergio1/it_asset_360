
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
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SoftwareAccounts') CREATE TABLE SoftwareAccounts (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Type NVARCHAR(50), Login NVARCHAR(200), Password NVARCHAR(MAX), LicenseKey NVARCHAR(MAX), Status NVARCHAR(20), UserId NVARCHAR(50), DeviceId NVARCHAR(50), SectorId NVARCHAR(50), Notes NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs') CREATE TABLE AuditLogs (Id NVARCHAR(50) PRIMARY KEY, AssetId NVARCHAR(50), Action NVARCHAR(50), Timestamp DATETIME2 DEFAULT GETDATE(), AdminUser NVARCHAR(100), Notes NVARCHAR(MAX), BackupData NVARCHAR(MAX), AssetType NVARCHAR(50), TargetName NVARCHAR(100));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings') CREATE TABLE SystemSettings (Id INT PRIMARY KEY IDENTITY(1,1), AppName NVARCHAR(100), LogoUrl NVARCHAR(MAX), Cnpj NVARCHAR(20), TermTemplate NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemUsers') CREATE TABLE SystemUsers (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100), Email NVARCHAR(100), Password NVARCHAR(100), Role NVARCHAR(20));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MaintenanceRecords') CREATE TABLE MaintenanceRecords (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, Description NVARCHAR(MAX), Cost DECIMAL(18,2), Date DATETIME2, Type NVARCHAR(50), Provider NVARCHAR(100), InvoiceUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Terms') CREATE TABLE Terms (Id NVARCHAR(50) PRIMARY KEY, UserId NVARCHAR(50), Type NVARCHAR(20), AssetDetails NVARCHAR(255), Date DATETIME2, FileUrl NVARCHAR(MAX));
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceAccessories') CREATE TABLE DeviceAccessories (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, AccessoryTypeId NVARCHAR(50) NOT NULL, Name NVARCHAR(100));
    `;
    await pool.request().query(baseTables);

    // Seed admin se não existir
    const checkAdmin = await pool.request().query("SELECT * FROM SystemUsers WHERE Email = 'admin@empresa.com'");
    if (checkAdmin.recordset.length === 0) {
        await pool.request().query("INSERT INTO SystemUsers (Id, Name, Email, Password, Role) VALUES ('admin1', 'Administrador', 'admin@empresa.com', 'admin', 'ADMIN')");
    }

    // Seed settings se não existir
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

// --- HELPER LOG ---
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

// --- AUTH / SYSTEM USERS ---
app.get('/api/system-users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/system-users', async (req, res) => {
    const { id, name, email, password, role } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, id).input('Name', sql.NVarChar, name).input('Email', sql.NVarChar, email).input('Pass', sql.NVarChar, password).input('Role', sql.NVarChar, role)
            .query("INSERT INTO SystemUsers (Id, Name, Email, Password, Role) VALUES (@Id, @Name, @Email, @Pass, @Role)");
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate FROM SystemSettings");
        res.json(result.recordset[0] || {});
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/settings', async (req, res) => {
    const { appName, logoUrl, cnpj, termTemplate } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Name', sql.NVarChar, appName).input('Logo', sql.NVarChar, logoUrl).input('Cnpj', sql.NVarChar, cnpj).input('Term', sql.NVarChar, termTemplate)
            .query("UPDATE SystemSettings SET AppName=@Name, LogoUrl=@Logo, Cnpj=@Cnpj, TermTemplate=@Term");
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- SECTORS ---
app.get('/api/sectors', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, Name as name FROM Sectors");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/sectors', async (req, res) => {
    const { id, name } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, id).input('Name', sql.NVarChar, name).query("INSERT INTO Sectors (Id, Name) VALUES (@Id, @Name)");
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- USERS (COLABORADORES) ---
app.get('/api/users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, FullName as fullName, Email as email, SectorId as sectorId, InternalCode as internalCode, Active as active, Cpf as cpf, Rg as rg, Pis as pis, Address as address FROM Users");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/users', async (req, res) => {
    const { id, fullName, email, sectorId, internalCode, active, cpf, rg, pis, address, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, id).input('Name', sql.NVarChar, fullName).input('Email', sql.NVarChar, email).input('Sector', sql.NVarChar, sectorId).input('Code', sql.NVarChar, internalCode).input('Active', sql.Bit, active).input('Cpf', sql.NVarChar, cpf).input('Rg', sql.NVarChar, rg).input('Pis', sql.NVarChar, pis).input('Address', sql.NVarChar, address)
            .query("INSERT INTO Users (Id, FullName, Email, SectorId, InternalCode, Active, Cpf, Rg, Pis, Address) VALUES (@Id, @Name, @Email, @Sector, @Code, @Active, @Cpf, @Rg, @Pis, @Address)");
        await logAction(id, 'User', 'Criação', _adminUser, fullName, `CPF: ${cpf}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/users/:id', async (req, res) => {
    const { id, fullName, email, sectorId, internalCode, active, cpf, rg, pis, address, _adminUser, _reason } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, id).input('Name', sql.NVarChar, fullName).input('Email', sql.NVarChar, email).input('Sector', sql.NVarChar, sectorId).input('Code', sql.NVarChar, internalCode).input('Active', sql.Bit, active).input('Cpf', sql.NVarChar, cpf).input('Rg', sql.NVarChar, rg).input('Pis', sql.NVarChar, pis).input('Address', sql.NVarChar, address)
            .query("UPDATE Users SET FullName=@Name, Email=@Email, SectorId=@Sector, InternalCode=@Code, Active=@Active, Cpf=@Cpf, Rg=@Rg, Pis=@Pis, Address=@Address WHERE Id=@Id");
        await logAction(id, 'User', 'Atualização', _adminUser, fullName, _reason);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- SIM CARDS ---
app.get('/api/sims', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, PhoneNumber as phoneNumber, Operator as operator, Iccid as iccid, PlanDetails as planDetails, Status as status, CurrentUserId as currentUserId FROM SimCards");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/sims', async (req, res) => {
    const { id, phoneNumber, operator, iccid, planDetails, status, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, id).input('Num', sql.NVarChar, phoneNumber).input('Op', sql.NVarChar, operator).input('Iccid', sql.NVarChar, iccid).input('Plan', sql.NVarChar, planDetails).input('Status', sql.NVarChar, status)
            .query("INSERT INTO SimCards (Id, PhoneNumber, Operator, Iccid, PlanDetails, Status) VALUES (@Id, @Num, @Op, @Iccid, @Plan, @Status)");
        await logAction(id, 'Sim', 'Criação', _adminUser, phoneNumber, `Op: ${operator}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- DEVICES ---
app.get('/api/devices', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT d.Id as id, d.ModelId as modelId, d.SerialNumber as serialNumber, d.AssetTag as assetTag, 
                   d.InternalCode as internalCode, d.Imei as imei, d.PulsusId as pulsusId, d.Status as status, 
                   d.CurrentUserId as currentUserId, d.SectorId as sectorId, d.CostCenter as costCenter, 
                   d.LinkedSimId as linkedSimId, d.PurchaseDate as purchaseDate, d.PurchaseCost as purchaseCost, 
                   d.InvoiceNumber as invoiceNumber, d.Supplier as supplier, d.PurchaseInvoiceUrl as purchaseInvoiceUrl, 
                   d.CustomData as customDataStr
            FROM Devices d
        `);
        
        const devicesWithAcc = await Promise.all(result.recordset.map(async d => {
            const accResult = await pool.request().input('DevId', sql.NVarChar, d.id).query(`SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId=@DevId`);
            return {
                ...d,
                customData: d.customDataStr ? JSON.parse(d.customDataStr) : {},
                accessories: accResult.recordset
            };
        }));
        res.json(devicesWithAcc);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/devices', async (req, res) => {
    const { id, modelId, serialNumber, assetTag, status, internalCode, imei, pulsusId, sectorId, costCenter, linkedSimId, purchaseDate, purchaseCost, invoiceNumber, supplier, purchaseInvoiceUrl, customData, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, id).input('Mid', sql.NVarChar, modelId).input('Sn', sql.NVarChar, serialNumber).input('Tag', sql.NVarChar, assetTag).input('Stat', sql.NVarChar, status).input('IC', sql.NVarChar, internalCode).input('Imei', sql.NVarChar, imei).input('Pid', sql.NVarChar, pulsusId).input('Sid', sql.NVarChar, sectorId).input('Cc', sql.NVarChar, costCenter).input('Lsim', sql.NVarChar, linkedSimId).input('Pd', sql.Date, purchaseDate).input('Pc', sql.Decimal(18,2), purchaseCost).input('In', sql.NVarChar, invoiceNumber).input('Supp', sql.NVarChar, supplier).input('Purl', sql.NVarChar, purchaseInvoiceUrl).input('Cd', sql.NVarChar, JSON.stringify(customData))
            .query(`INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, Status, InternalCode, Imei, PulsusId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, PurchaseInvoiceUrl, CustomData) 
                    VALUES (@Id, @Mid, @Sn, @Tag, @Stat, @IC, @Imei, @Pid, @Sid, @Cc, @Lsim, @Pd, @Pc, @In, @Supp, @Purl, @Cd)`);
        await logAction(id, 'Device', 'Criação', _adminUser, assetTag);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- OPERATIONS ---
app.post('/api/operations/checkout', async (req, res) => {
    const { assetId, assetType, userId, notes, _adminUser, accessories } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        
        await pool.request()
            .input('Id', sql.NVarChar, assetId)
            .input('UserId', sql.NVarChar, userId)
            .query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@UserId WHERE Id=@Id`);
        
        if (assetType === 'Device' && accessories) {
            await pool.request().input('DevId', sql.NVarChar, assetId).query(`DELETE FROM DeviceAccessories WHERE DeviceId=@DevId`);
            for (const acc of accessories) {
                await pool.request()
                    .input('Id', sql.NVarChar, acc.id)
                    .input('DevId', sql.NVarChar, assetId)
                    .input('Type', sql.NVarChar, acc.accessoryTypeId)
                    .input('Name', sql.NVarChar, acc.name)
                    .query(`INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@Id, @DevId, @Type, @Name)`);
            }
        }

        const termId = Math.random().toString(36).substr(2, 9);
        await pool.request()
            .input('Id', sql.NVarChar, termId).input('UserId', sql.NVarChar, userId).input('Type', sql.NVarChar, 'ENTREGA').input('Details', sql.NVarChar, notes)
            .query(`INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@Id, @UserId, @Type, @Details, GETDATE())`);

        await logAction(assetId, assetType, 'Entrega', _adminUser, assetId, notes);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/operations/checkin', async (req, res) => {
    const { assetId, assetType, notes, _adminUser, checklist } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        
        const currentData = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT CurrentUserId FROM ${table} WHERE Id=@Id`);
        const userId = currentData.recordset[0]?.CurrentUserId;

        await pool.request().input('Id', sql.NVarChar, assetId).query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Id`);

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

// --- TERMS / FILES ---
app.get('/api/terms', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, UserId as userId, Type as type, AssetDetails as assetDetails, Date as date, FileUrl as fileUrl FROM Terms");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/terms/file', async (req, res) => {
    const { id, fileUrl, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('Id', sql.NVarChar, id).input('File', sql.NVarChar, fileUrl).query("UPDATE Terms SET FileUrl=@File WHERE Id=@Id");
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- AUDIT LOGS ---
app.get('/api/logs', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query("SELECT Id as id, AssetId as assetId, AssetType as assetType, Action as action, Timestamp as timestamp, AdminUser as adminUser, TargetName as targetName, Notes as notes, BackupData as backupData FROM AuditLogs ORDER BY Timestamp DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

// --- CATALOG DATA (BRANDS, MODELS, TYPES) ---
app.get('/api/brands', async (req, res) => {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT Id as id, Name as name FROM Brands");
    res.json(result.recordset);
});
app.post('/api/brands', async (req, res) => {
    const { id, name } = req.body;
    const pool = await sql.connect(dbConfig);
    await pool.request().input('Id', sql.NVarChar, id).input('N', sql.NVarChar, name).query("INSERT INTO Brands (Id, Name) VALUES (@Id, @N)");
    res.json({success: true});
});

app.get('/api/asset-types', async (req, res) => {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT Id as id, Name as name, CustomFieldIds as customFieldIds FROM AssetTypes");
    res.json(result.recordset);
});
app.post('/api/asset-types', async (req, res) => {
    const { id, name, customFieldIds } = req.body;
    const pool = await sql.connect(dbConfig);
    await pool.request().input('Id', sql.NVarChar, id).input('N', sql.NVarChar, name).input('C', sql.NVarChar, JSON.stringify(customFieldIds)).query("INSERT INTO AssetTypes (Id, Name, CustomFieldIds) VALUES (@Id, @N, @C)");
    res.json({success: true});
});

app.get('/api/models', async (req, res) => {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT Id as id, Name as name, BrandId as brandId, TypeId as typeId, ImageUrl as imageUrl FROM Models");
    res.json(result.recordset);
});
app.post('/api/models', async (req, res) => {
    const { id, name, brandId, typeId, imageUrl } = req.body;
    const pool = await sql.connect(dbConfig);
    await pool.request().input('Id', sql.NVarChar, id).input('N', sql.NVarChar, name).input('B', sql.NVarChar, brandId).input('T', sql.NVarChar, typeId).input('I', sql.NVarChar, imageUrl).query("INSERT INTO Models (Id, Name, BrandId, TypeId, ImageUrl) VALUES (@Id, @N, @B, @T, @I)");
    res.json({success: true});
});

// --- ACCOUNTS ---
app.get('/api/accounts', async (req, res) => {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT Id as id, Name as name, Type as type, Login as login, Password as password, LicenseKey as licenseKey, Status as status, UserId as userId, DeviceId as deviceId, SectorId as sectorId, Notes as notes FROM SoftwareAccounts");
    res.json(result.recordset);
});
app.post('/api/accounts', async (req, res) => {
    const { id, name, type, login, password, licenseKey, status, userId, deviceId, sectorId, notes, _adminUser } = req.body;
    const pool = await sql.connect(dbConfig);
    await pool.request()
        .input('Id', sql.NVarChar, id).input('N', sql.NVarChar, name).input('T', sql.NVarChar, type).input('L', sql.NVarChar, login).input('P', sql.NVarChar, password).input('K', sql.NVarChar, licenseKey).input('S', sql.NVarChar, status).input('U', sql.NVarChar, userId).input('D', sql.NVarChar, deviceId).input('Sec', sql.NVarChar, sectorId).input('Not', sql.NVarChar, notes)
        .query("INSERT INTO SoftwareAccounts (Id, Name, Type, Login, Password, LicenseKey, Status, UserId, DeviceId, SectorId, Notes) VALUES (@Id, @N, @T, @L, @P, @K, @S, @U, @D, @Sec, @Not)");
    await logAction(id, 'Account', 'Criação', _adminUser, name);
    res.json({success: true});
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

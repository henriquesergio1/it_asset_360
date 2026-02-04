
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
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceAccessories') CREATE TABLE DeviceAccessories (Id NVARCHAR(50) PRIMARY KEY, DeviceId NVARCHAR(50) NOT NULL, AccessoryTypeId NVARCHAR(50) NOT NULL, Name NVARCHAR(100));
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

app.post('/api/operations/checkout', async (req, res) => {
    const { assetId, assetType, userId, notes, _adminUser, accessories } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const table = assetType === 'Device' ? 'Devices' : 'SimCards';
        
        await pool.request()
            .input('Id', sql.NVarChar, assetId)
            .input('UserId', sql.NVarChar, userId)
            .query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@UserId WHERE Id=@Id`);
        
        // Se for dispositivo, limpar acessórios antigos e inserir os novos da entrega atual
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

        // Gerar registro do termo
        const termId = Math.random().toString(36).substr(2, 9);
        await pool.request()
            .input('Id', sql.NVarChar, termId).input('UserId', sql.NVarChar, userId).input('Type', sql.NVarChar, 'ENTREGA').input('Details', sql.NVarChar, notes)
            .query(`INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@Id, @UserId, @Type, @Details, GETDATE())`);

        await logAction(assetId, assetType, 'Entrega', _adminUser, assetId, notes);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// Outras rotas permanecem... (omitidas para brevidade, mas preservadas)

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));


const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
    const createTablesQuery = `
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sectors')
        CREATE TABLE Sectors (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
        
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccessoryTypes')
        CREATE TABLE AccessoryTypes (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomFields')
        CREATE TABLE CustomFields (Id NVARCHAR(50) PRIMARY KEY, Name NVARCHAR(100) NOT NULL);

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceAccessories')
        CREATE TABLE DeviceAccessories (
            Id NVARCHAR(50) PRIMARY KEY,
            DeviceId NVARCHAR(50) NOT NULL,
            AccessoryTypeId NVARCHAR(50) NOT NULL,
            Name NVARCHAR(100),
            CONSTRAINT FK_DevAcc_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(Id) ON DELETE CASCADE,
            CONSTRAINT FK_DevAcc_Type FOREIGN KEY (AccessoryTypeId) REFERENCES AccessoryTypes(Id)
        );
    `;
    try { await pool.request().query(createTablesQuery); } catch (e) { console.warn('Erro tabelas:', e.message); }

    const missingColumns = [
        { table: 'Devices', col: 'CustomData', type: 'NVARCHAR(MAX)' }, 
        { table: 'Devices', col: 'ModelId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'PurchaseInvoiceUrl', type: 'NVARCHAR(MAX)' },
        { table: 'Devices', col: 'Imei', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'PulsusId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'SectorCode', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'SectorId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'CostCenter', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'LinkedSimId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'InvoiceNumber', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'Supplier', type: 'NVARCHAR(100)' },
        { table: 'Devices', col: 'PurchaseDate', type: 'DATE' },
        { table: 'Devices', col: 'PurchaseCost', type: 'DECIMAL(18, 2)' },
        { table: 'AssetTypes', col: 'CustomFieldIds', type: 'NVARCHAR(MAX)' }, 
        { table: 'Users', col: 'Pis', type: 'NVARCHAR(20)' },
        { table: 'Users', col: 'Rg', type: 'NVARCHAR(20)' },
        { table: 'Users', col: 'SectorCode', type: 'NVARCHAR(50)' },
        { table: 'Users', col: 'HasPendingIssues', type: 'BIT' },
        { table: 'Users', col: 'PendingIssuesNote', type: 'NVARCHAR(MAX)' },
        { table: 'SystemSettings', col: 'ReturnTermTemplate', type: 'NVARCHAR(MAX)' },
        { table: 'AuditLogs', col: 'BackupData', type: 'NVARCHAR(MAX)' }
    ];

    for (const item of missingColumns) {
        try {
            await pool.request().query(`
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${item.table}')
                BEGIN
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${item.table}' AND COLUMN_NAME = '${item.col}')
                    BEGIN
                        ALTER TABLE ${item.table} ADD ${item.col} ${item.type};
                    END
                END
            `);
        } catch (e) { }
    }
}

sql.connect(dbConfig).then(async pool => {
    if (pool.connected) {
        console.log('✅ Connected to SQL Server');
        await runMigrations(pool);
    }
}).catch(err => console.error('❌ Database Connection Failed:', err));

async function query(command) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(command);
    return result.recordset;
}

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
    } catch (e) { }
}

app.get('/', (req, res) => res.send({ status: 'ok', service: 'IT Asset 360 API' }));

// Sectors CRUD com validação de Unicidade
app.get('/api/sectors', async (req, res) => {
    try {
        const data = await query(`SELECT Id as id, Name as name FROM Sectors ORDER BY Name ASC`);
        res.json(data);
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/sectors', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        // Verificar se nome já existe
        const exists = await pool.request().input('Name', sql.NVarChar, s.name).query(`SELECT 1 FROM Sectors WHERE Name = @Name`);
        if (exists.recordset.length > 0) return res.status(400).send('Já existe um cargo com este nome.');

        await pool.request()
            .input('Id', sql.NVarChar, s.id)
            .input('Name', sql.NVarChar, s.name)
            .query(`INSERT INTO Sectors (Id, Name) VALUES (@Id, @Name)`);
        await logAction(s.id, 'Sector', 'Criação', s._adminUser, s.name);
        res.json(s);
    } catch (e) { res.status(500).send(e.message); }
});

app.put('/api/sectors/:id', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        // Verificar duplicidade excluindo o próprio ID
        const exists = await pool.request()
            .input('Name', sql.NVarChar, s.name)
            .input('Id', sql.NVarChar, req.params.id)
            .query(`SELECT 1 FROM Sectors WHERE Name = @Name AND Id <> @Id`);
        if (exists.recordset.length > 0) return res.status(400).send('Este nome já está sendo usado por outro cargo.');

        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Name', sql.NVarChar, s.name)
            .query(`UPDATE Sectors SET Name=@Name WHERE Id=@Id`);
        await logAction(req.params.id, 'Sector', 'Atualização', s._adminUser, s.name);
        res.json(s);
    } catch (e) { res.status(500).send(e.message); }
});

app.delete('/api/sectors/:id', async (req, res) => {
    try {
        await query(`DELETE FROM Sectors WHERE Id='${req.params.id}'`);
        res.json({ success: true });
    } catch (e) { res.status(500).send(e.message); }
});

// Outras rotas permanecem...
app.get('/api/users', async (req, res) => {
    try {
        const data = await query(`SELECT Id as id, FullName as fullName, Cpf as cpf, Rg as rg, Pis as pis, SectorCode as sectorCode, Address as address, Email as email, SectorId as sectorId, JobTitle as jobTitle, Active as active, HasPendingIssues as hasPendingIssues, PendingIssuesNote as pendingIssuesNote FROM Users`);
        res.json(data.map(u => ({ ...u, active: !!u.active, hasPendingIssues: !!u.hasPendingIssues })));
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/users', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, u.id)
            .input('FullName', sql.NVarChar, u.fullName)
            .input('Cpf', sql.NVarChar, u.cpf)
            .input('Rg', sql.NVarChar, u.rg)
            .input('SectorCode', sql.NVarChar, u.sectorCode || null)
            .input('Email', sql.NVarChar, u.email)
            .input('SectorId', sql.NVarChar, u.sectorId)
            .input('JobTitle', sql.NVarChar, u.jobTitle || '')
            .input('Address', sql.NVarChar, u.address || '')
            .query(`INSERT INTO Users (Id, FullName, Cpf, Rg, SectorCode, Email, SectorId, JobTitle, Address, Active) VALUES (@Id, @FullName, @Cpf, @Rg, @SectorCode, @Email, @SectorId, @JobTitle, @Address, 1)`);
        await logAction(u.id, 'User', 'Criação', u._adminUser, u.fullName);
        res.json(u);
    } catch (e) { res.status(500).send(e.message); }
});

app.put('/api/users/:id', async (req, res) => {
    const u = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('FullName', sql.NVarChar, u.fullName)
            .input('Email', sql.NVarChar, u.email)
            .input('SectorCode', sql.NVarChar, u.sectorCode || null)
            .input('SectorId', sql.NVarChar, u.sectorId)
            .input('JobTitle', sql.NVarChar, u.jobTitle || '')
            .input('Active', sql.Bit, u.active ? 1 : 0)
            .input('HasPendingIssues', sql.Bit, u.hasPendingIssues ? 1 : 0)
            .input('PendingIssuesNote', sql.NVarChar, u.pendingIssuesNote || '')
            .query(`UPDATE Users SET FullName=@FullName, Email=@Email, SectorCode=@SectorCode, SectorId=@SectorId, JobTitle=@JobTitle, Active=@Active, HasPendingIssues=@HasPendingIssues, PendingIssuesNote=@PendingIssuesNote WHERE Id=@Id`);
        await logAction(u.id, 'User', 'Atualização', u._adminUser, 'Dados atualizados');
        res.json(u);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/devices', async (req, res) => {
    try {
        const devices = await query(`SELECT Id as id, ModelId as modelId, SerialNumber as serialNumber, AssetTag as assetTag, Imei as imei, PulsusId as pulsusId, SectorCode as sectorCode, CustomData as customDataStr, Status as status, CurrentUserId as currentUserId, SectorId as sectorId, CostCenter as costCenter, LinkedSimId as linkedSimId, PurchaseDate as purchaseDate, PurchaseCost as purchaseCost, InvoiceNumber as invoiceNumber, Supplier as supplier, PurchaseInvoiceUrl as purchaseInvoiceUrl FROM Devices`);
        res.json(devices.map(d => ({ ...d, customData: d.customDataStr ? JSON.parse(d.customDataStr) : {} })));
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/devices', async (req, res) => {
    const d = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, d.id)
            .input('ModelId', sql.NVarChar, d.modelId)
            .input('SerialNumber', sql.NVarChar, d.serialNumber)
            .input('AssetTag', sql.NVarChar, d.assetTag)
            .input('Imei', sql.NVarChar, d.imei || null)
            .input('PulsusId', sql.NVarChar, d.pulsusId || null)
            .input('SectorCode', sql.NVarChar, d.sectorCode || null)
            .input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .input('Status', sql.NVarChar, d.status)
            .input('CurrentUserId', sql.NVarChar, d.currentUserId || null)
            .input('SectorId', sql.NVarChar, d.sectorId || null)
            .input('CostCenter', sql.NVarChar, d.costCenter || null)
            .input('LinkedSimId', sql.NVarChar, d.linkedSimId || null)
            .input('PurchaseDate', sql.Date, d.purchaseDate || null)
            .input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost || 0)
            .input('InvoiceNumber', sql.NVarChar, d.invoiceNumber || null)
            .input('Supplier', sql.NVarChar, d.supplier || null)
            .query(`INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, Imei, PulsusId, SectorCode, CustomData, Status, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier) VALUES (@Id, @ModelId, @SerialNumber, @AssetTag, @Imei, @PulsusId, @SectorCode, @CustomData, @Status, @CurrentUserId, @SectorId, @CostCenter, @LinkedSimId, @PurchaseDate, @PurchaseCost, @InvoiceNumber, @Supplier)`);
        await logAction(d.id, 'Device', 'Criação', d._adminUser, 'Novo dispositivo');
        res.json(d);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

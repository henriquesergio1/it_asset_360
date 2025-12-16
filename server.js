const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// SQL Configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false, // Set to true if using Azure
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

// --- AUTO MIGRATION SYSTEM ---
async function runMigrations(pool) {
    console.log('🔄 Verificando esquema do banco de dados (Auto-Migração)...');
    
    const missingColumns = [
        // Tabela Devices
        { table: 'Devices', col: 'PurchaseInvoiceUrl', type: 'NVARCHAR(MAX)' },
        { table: 'Devices', col: 'Imei', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'PulsusId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'SectorId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'CostCenter', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'LinkedSimId', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'InvoiceNumber', type: 'NVARCHAR(50)' },
        { table: 'Devices', col: 'Supplier', type: 'NVARCHAR(100)' },
        { table: 'Devices', col: 'PurchaseDate', type: 'DATE' },
        { table: 'Devices', col: 'PurchaseCost', type: 'DECIMAL(18, 2)' },
        // Tabela Users
        { table: 'Users', col: 'Pis', type: 'NVARCHAR(20)' },
        { table: 'Users', col: 'Rg', type: 'NVARCHAR(20)' }
    ];

    for (const item of missingColumns) {
        try {
            // Verifica se a coluna existe, se não, cria
            await pool.request().query(`
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${item.table}')
                BEGIN
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${item.table}' AND COLUMN_NAME = '${item.col}')
                    BEGIN
                        ALTER TABLE ${item.table} ADD ${item.col} ${item.type};
                        PRINT 'Coluna ${item.col} adicionada em ${item.table}';
                    END
                END
            `);
        } catch (e) {
            console.warn(`⚠️ Aviso de Migração (${item.table}.${item.col}):`, e.message);
        }
    }
    console.log('✅ Banco de Dados Verificado/Atualizado.');
}

// Connect to Database & Run Migrations
sql.connect(dbConfig).then(async pool => {
    if (pool.connected) {
        console.log('✅ Connected to SQL Server');
        await runMigrations(pool);
    }
}).catch(err => {
    console.error('❌ Database Connection Failed:', err);
});

// Helper to execute query
async function query(command) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(command);
        return result.recordset;
    } catch (err) {
        console.error('SQL Error:', err);
        throw err;
    }
}

// --- ROUTES ---

// Health Check
app.get('/', (req, res) => {
    res.send({ status: 'ok', service: 'IT Asset 360 API', port: PORT });
});

// 1. Devices
app.get('/api/devices', async (req, res) => {
    try {
        // Alias columns to match Frontend Interface (camelCase)
        const data = await query(`
            SELECT 
                Id as id, ModelId as modelId, SerialNumber as serialNumber, 
                AssetTag as assetTag, Imei as imei, PulsusId as pulsusId,
                Status as status, CurrentUserId as currentUserId,
                SectorId as sectorId, CostCenter as costCenter, LinkedSimId as linkedSimId,
                PurchaseDate as purchaseDate, PurchaseCost as purchaseCost,
                InvoiceNumber as invoiceNumber, Supplier as supplier, PurchaseInvoiceUrl as purchaseInvoiceUrl
            FROM Devices
        `);
        res.json(data);
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
            .input('AssetTag', sql.NVarChar, d.assetTag)
            .input('Imei', sql.NVarChar, d.imei || null)
            .input('PulsusId', sql.NVarChar, d.pulsusId || null)
            .input('Status', sql.NVarChar, d.status)
            .input('CurrentUserId', sql.NVarChar, d.currentUserId || null)
            .input('SectorId', sql.NVarChar, d.sectorId || null)
            .input('CostCenter', sql.NVarChar, d.costCenter || null)
            .input('LinkedSimId', sql.NVarChar, d.linkedSimId || null)
            .input('PurchaseDate', sql.Date, d.purchaseDate || null)
            .input('PurchaseCost', sql.Decimal(18,2), d.purchaseCost || 0)
            .input('InvoiceNumber', sql.NVarChar, d.invoiceNumber || null)
            .input('Supplier', sql.NVarChar, d.supplier || null)
            .query(`
                INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, Imei, PulsusId, Status, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier)
                VALUES (@Id, @ModelId, @SerialNumber, @AssetTag, @Imei, @PulsusId, @Status, @CurrentUserId, @SectorId, @CostCenter, @LinkedSimId, @PurchaseDate, @PurchaseCost, @InvoiceNumber, @Supplier)
            `);
        
        // Log
        await logAction(d.id, 'Device', 'Criação', d._adminUser, 'Novo dispositivo');
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
            .input('Status', sql.NVarChar, d.status)
            .input('CurrentUserId', sql.NVarChar, d.currentUserId || null)
            .input('LinkedSimId', sql.NVarChar, d.linkedSimId || null)
            .input('SectorId', sql.NVarChar, d.sectorId || null)
            .query(`UPDATE Devices SET ModelId=@ModelId, Status=@Status, CurrentUserId=@CurrentUserId, LinkedSimId=@LinkedSimId, SectorId=@SectorId WHERE Id=@Id`);
        
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/devices/:id', async (req, res) => {
    try {
        await query(`DELETE FROM Devices WHERE Id = '${req.params.id}'`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 2. Sims
app.get('/api/sims', async (req, res) => {
    try {
        const data = await query(`SELECT Id as id, PhoneNumber as phoneNumber, Operator as operator, Iccid as iccid, PlanDetails as planDetails, Status as status, CurrentUserId as currentUserId FROM SimCards`);
        res.json(data);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/sims', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, s.id)
            .input('PhoneNumber', sql.NVarChar, s.phoneNumber)
            .input('Operator', sql.NVarChar, s.operator)
            .input('Iccid', sql.NVarChar, s.iccid)
            .input('PlanDetails', sql.NVarChar, s.planDetails)
            .input('Status', sql.NVarChar, s.status)
            .query(`INSERT INTO SimCards (Id, PhoneNumber, Operator, Iccid, PlanDetails, Status) VALUES (@Id, @PhoneNumber, @Operator, @Iccid, @PlanDetails, @Status)`);
        
        await logAction(s.id, 'Sim', 'Criação', s._adminUser, s.phoneNumber);
        res.json(s);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/sims/:id', async (req, res) => {
    try {
        await query(`DELETE FROM SimCards WHERE Id = '${req.params.id}'`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 3. Users
app.get('/api/users', async (req, res) => {
    try {
        const data = await query(`SELECT Id as id, FullName as fullName, Cpf as cpf, Rg as rg, Pis as pis, Address as address, Email as email, SectorId as sectorId, JobTitle as jobTitle, Active as active FROM Users`);
        // Convert Active bit to boolean
        const formatted = data.map(u => ({ ...u, active: !!u.active }));
        res.json(formatted);
    } catch (err) { res.status(500).send(err.message); }
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
            .input('Email', sql.NVarChar, u.email)
            .input('SectorId', sql.NVarChar, u.sectorId)
            .input('JobTitle', sql.NVarChar, u.jobTitle)
            .input('Address', sql.NVarChar, u.address || '')
            .query(`INSERT INTO Users (Id, FullName, Cpf, Rg, Email, SectorId, JobTitle, Address, Active) VALUES (@Id, @FullName, @Cpf, @Rg, @Email, @SectorId, @JobTitle, @Address, 1)`);
        
        await logAction(u.id, 'User', 'Criação', u._adminUser, u.fullName);
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
            .input('Email', sql.NVarChar, u.email)
            .input('Active', sql.Bit, u.active ? 1 : 0)
            .query(`UPDATE Users SET FullName=@FullName, Email=@Email, Active=@Active WHERE Id=@Id`);
        res.json(u);
    } catch (err) { res.status(500).send(err.message); }
});

// 4. Terms
app.get('/api/terms', async (req, res) => {
    try {
        const data = await query(`SELECT Id as id, UserId as userId, Type as type, AssetDetails as assetDetails, Date as date, FileUrl as fileUrl FROM Terms`);
        res.json(data);
    } catch (err) { res.status(500).send(err.message); }
});

// 5. Operations (Checkout/Checkin)
app.post('/api/operations/checkout', async (req, res) => {
    const { assetId, assetType, userId, notes, action, _adminUser } = req.body;
    const table = assetType === 'Device' ? 'Devices' : 'SimCards';
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Update Asset
        await pool.request()
            .input('UserId', sql.NVarChar, userId)
            .input('Id', sql.NVarChar, assetId)
            .query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@UserId WHERE Id=@Id`);
            
        // Log
        await logAction(assetId, assetType, action, _adminUser, `Entregue ao usuário. Obs: ${notes}`);
        
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/operations/checkin', async (req, res) => {
    const { assetId, assetType, notes, action, _adminUser } = req.body;
    const table = assetType === 'Device' ? 'Devices' : 'SimCards';
    
    try {
        await query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id='${assetId}'`);
        await logAction(assetId, assetType, action, _adminUser, `Devolução. Obs: ${notes}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 6. Logs & Settings & Aux
app.get('/api/logs', async (req, res) => {
    try {
        const data = await query(`SELECT Id as id, AssetId as assetId, AssetType as assetType, TargetName as targetName, Action as action, Timestamp as timestamp, Notes as notes, AdminUser as adminUser FROM AuditLogs ORDER BY Timestamp DESC`);
        res.json(data);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/settings', async (req, res) => {
    try {
        const data = await query(`SELECT TOP 1 AppName as appName, Cnpj as cnpj, LogoUrl as logoUrl, TermTemplate as termTemplate FROM SystemSettings`);
        res.json(data[0] || {});
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/settings', async (req, res) => {
    const s = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        // Check if exists
        const check = await pool.request().query('SELECT count(*) as count FROM SystemSettings');
        if (check.recordset[0].count === 0) {
            await pool.request()
                .input('AppName', sql.NVarChar, s.appName)
                .input('Cnpj', sql.NVarChar, s.cnpj)
                .input('LogoUrl', sql.NVarChar, s.logoUrl)
                .input('TermTemplate', sql.NVarChar, s.termTemplate)
                .query(`INSERT INTO SystemSettings (AppName, Cnpj, LogoUrl, TermTemplate) VALUES (@AppName, @Cnpj, @LogoUrl, @TermTemplate)`);
        } else {
             await pool.request()
                .input('AppName', sql.NVarChar, s.appName)
                .input('Cnpj', sql.NVarChar, s.cnpj)
                .input('LogoUrl', sql.NVarChar, s.logoUrl)
                .input('TermTemplate', sql.NVarChar, s.termTemplate)
                .query(`UPDATE SystemSettings SET AppName=@AppName, Cnpj=@Cnpj, LogoUrl=@LogoUrl, TermTemplate=@TermTemplate`);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/models', async (req, res) => {
    const data = await query(`SELECT Id as id, Name as name, BrandId as brandId, TypeId as typeId, ImageUrl as imageUrl FROM Models`);
    res.json(data);
});

app.get('/api/brands', async (req, res) => {
    const data = await query(`SELECT Id as id, Name as name FROM Brands`);
    res.json(data);
});

app.get('/api/asset-types', async (req, res) => {
    const data = await query(`SELECT Id as id, Name as name FROM AssetTypes`);
    res.json(data);
});

app.get('/api/sectors', async (req, res) => {
    const data = await query(`SELECT Id as id, Name as name FROM Sectors`);
    res.json(data);
});

app.get('/api/system-users', async (req, res) => {
    const data = await query(`SELECT Id as id, Name as name, Email as email, Role as role, Password as password FROM SystemUsers`);
    res.json(data);
});

app.get('/api/maintenances', async (req, res) => {
    const data = await query(`SELECT Id as id, DeviceId as deviceId, Type as type, Date as date, Description as description, Cost as cost, Provider as provider FROM MaintenanceRecords`);
    res.json(data);
});

// --- HELPER LOG ---
async function logAction(assetId, assetType, action, adminUser, notes) {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, Math.random().toString(36).substr(2, 9))
            .input('AssetId', sql.NVarChar, assetId)
            .input('AssetType', sql.NVarChar, assetType)
            .input('Action', sql.NVarChar, action)
            .input('AdminUser', sql.NVarChar, adminUser)
            .input('Notes', sql.NVarChar, notes || '')
            .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, Notes) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @Notes)`);
    } catch (e) { console.error('Log Error', e); }
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
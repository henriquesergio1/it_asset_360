
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
    
    // 1. Create Tables if not exist (Novas tabelas)
    const createTablesQuery = `
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccessoryTypes')
        CREATE TABLE AccessoryTypes (
            Id NVARCHAR(50) PRIMARY KEY,
            Name NVARCHAR(100) NOT NULL
        );

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomFields')
        CREATE TABLE CustomFields (
            Id NVARCHAR(50) PRIMARY KEY,
            Name NVARCHAR(100) NOT NULL
        );

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
    try {
        await pool.request().query(createTablesQuery);
    } catch (e) {
        console.warn('⚠️ Erro na criação de tabelas novas:', e.message);
    }

    // 2. Add Columns to Existing Tables (Apenas as novas e necessárias)
    const missingColumns = [
        // Tabela Devices
        { table: 'Devices', col: 'CustomData', type: 'NVARCHAR(MAX)' }, 
        { table: 'Devices', col: 'ModelId', type: 'NVARCHAR(50)' },
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
        
        // Tabela AssetTypes
        { table: 'AssetTypes', col: 'CustomFieldIds', type: 'NVARCHAR(MAX)' }, 

        // Tabela Users
        { table: 'Users', col: 'Pis', type: 'NVARCHAR(20)' },
        { table: 'Users', col: 'Rg', type: 'NVARCHAR(20)' },
        { table: 'Users', col: 'HasPendingIssues', type: 'BIT' },
        { table: 'Users', col: 'PendingIssuesNote', type: 'NVARCHAR(MAX)' },
        
        // Tabela SystemSettings
        { table: 'SystemSettings', col: 'ReturnTermTemplate', type: 'NVARCHAR(MAX)' },
        
        // Tabela AuditLogs
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

// --- HELPER LOG ---
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
    } catch (e) { console.error('Log Error', e); }
}

// --- ROUTES ---

// Health Check
app.get('/', (req, res) => {
    res.send({ status: 'ok', service: 'IT Asset 360 API', port: PORT });
});

// 1. Devices (Cleaned of Legacy Fields)
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await query(`
            SELECT 
                Id as id, ModelId as modelId, SerialNumber as serialNumber, 
                AssetTag as assetTag, Imei as imei, PulsusId as pulsusId,
                CustomData as customDataStr,
                Status as status, CurrentUserId as currentUserId,
                SectorId as sectorId, CostCenter as costCenter, LinkedSimId as linkedSimId,
                PurchaseDate as purchaseDate, PurchaseCost as purchaseCost,
                InvoiceNumber as invoiceNumber, Supplier as supplier, PurchaseInvoiceUrl as purchaseInvoiceUrl
            FROM Devices
        `);
        
        let accessories = [];
        try {
            accessories = await query(`SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories`);
        } catch(e) {
            console.warn('Could not fetch accessories:', e.message);
        }
        
        const result = devices.map(d => {
            let customData = {};
            try {
                if (d.customDataStr) customData = JSON.parse(d.customDataStr);
            } catch(e) {}

            return {
                ...d,
                customData,
                accessories: accessories.filter(a => a.deviceId === d.id)
            };
        });

        res.json(result);
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
            .query(`
                INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, Imei, PulsusId, CustomData, Status, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier)
                VALUES (@Id, @ModelId, @SerialNumber, @AssetTag, @Imei, @PulsusId, @CustomData, @Status, @CurrentUserId, @SectorId, @CostCenter, @LinkedSimId, @PurchaseDate, @PurchaseCost, @InvoiceNumber, @Supplier)
            `);
        
        if (d.accessories && d.accessories.length > 0) {
            for (const acc of d.accessories) {
                await pool.request()
                    .input('Id', sql.NVarChar, acc.id)
                    .input('DeviceId', sql.NVarChar, d.id)
                    .input('AccessoryTypeId', sql.NVarChar, acc.accessoryTypeId)
                    .input('Name', sql.NVarChar, acc.name)
                    .query(`INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@Id, @DeviceId, @AccessoryTypeId, @Name)`);
            }
        }

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
            .input('CustomData', sql.NVarChar, JSON.stringify(d.customData || {}))
            .input('Status', sql.NVarChar, d.status)
            .input('CurrentUserId', sql.NVarChar, d.currentUserId || null)
            .input('LinkedSimId', sql.NVarChar, d.linkedSimId || null)
            .input('SectorId', sql.NVarChar, d.sectorId || null)
            .query(`UPDATE Devices SET ModelId=@ModelId, CustomData=@CustomData, Status=@Status, CurrentUserId=@CurrentUserId, LinkedSimId=@LinkedSimId, SectorId=@SectorId WHERE Id=@Id`);
        
        try {
            await pool.request().query(`DELETE FROM DeviceAccessories WHERE DeviceId='${req.params.id}'`);
            if (d.accessories && d.accessories.length > 0) {
                for (const acc of d.accessories) {
                    await pool.request()
                        .input('Id', sql.NVarChar, acc.id || Math.random().toString(36).substr(2,9))
                        .input('DeviceId', sql.NVarChar, d.id)
                        .input('AccessoryTypeId', sql.NVarChar, acc.accessoryTypeId)
                        .input('Name', sql.NVarChar, acc.name)
                        .query(`INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@Id, @DeviceId, @AccessoryTypeId, @Name)`);
                }
            }
        } catch(e) { console.error('Accessory sync failed', e); }

        await logAction(d.id, 'Device', 'Atualização', d._adminUser, `Atualização de cadastro (Tag: ${d.assetTag})`);
        res.json(d);
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/devices/:id', async (req, res) => {
    const { _adminUser, reason } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        // Fetch before delete for backup
        const toDelete = await pool.request().query(`SELECT * FROM Devices WHERE Id = '${req.params.id}'`);
        
        if (toDelete.recordset.length > 0) {
            const backupJson = JSON.stringify(toDelete.recordset[0]);
            await query(`DELETE FROM Devices WHERE Id = '${req.params.id}'`);
            await logAction(req.params.id, 'Device', 'Exclusão', _adminUser || 'Sistema', `Motivo: ${reason || 'Não informado'}`, backupJson); 
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// ... (Rest of APIs remain standard) ...

app.get('/api/sims', async (req, res) => { try { const data = await query(`SELECT Id as id, PhoneNumber as phoneNumber, Operator as operator, Iccid as iccid, PlanDetails as planDetails, Status as status, CurrentUserId as currentUserId FROM SimCards`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/sims', async (req, res) => { const s = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, s.id).input('PhoneNumber', sql.NVarChar, s.phoneNumber).input('Operator', sql.NVarChar, s.operator).input('Iccid', sql.NVarChar, s.iccid).input('PlanDetails', sql.NVarChar, s.planDetails).input('Status', sql.NVarChar, s.status).query(`INSERT INTO SimCards (Id, PhoneNumber, Operator, Iccid, PlanDetails, Status) VALUES (@Id, @PhoneNumber, @Operator, @Iccid, @PlanDetails, @Status)`); await logAction(s.id, 'Sim', 'Criação', s._adminUser, s.phoneNumber); res.json(s); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/sims/:id', async (req, res) => { const s = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).input('PhoneNumber', sql.NVarChar, s.phoneNumber).input('Operator', sql.NVarChar, s.operator).input('Iccid', sql.NVarChar, s.iccid).input('PlanDetails', sql.NVarChar, s.planDetails).input('Status', sql.NVarChar, s.status).query(`UPDATE SimCards SET PhoneNumber=@PhoneNumber, Operator=@Operator, Iccid=@Iccid, PlanDetails=@PlanDetails, Status=@Status WHERE Id=@Id`); await logAction(s.id, 'Sim', 'Atualização', s._adminUser, s.phoneNumber); res.json(s); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/sims/:id', async (req, res) => { const { _adminUser, reason } = req.body; try { const pool = await sql.connect(dbConfig); const toDelete = await pool.request().query(`SELECT * FROM SimCards WHERE Id = '${req.params.id}'`); if (toDelete.recordset.length > 0) { const backupJson = JSON.stringify(toDelete.recordset[0]); await query(`DELETE FROM SimCards WHERE Id = '${req.params.id}'`); await logAction(req.params.id, 'Sim', 'Exclusão', _adminUser || 'Sistema', `Motivo: ${reason || 'Não informado'}`, backupJson); } res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/users', async (req, res) => { try { const data = await query(`SELECT Id as id, FullName as fullName, Cpf as cpf, Rg as rg, Pis as pis, Address as address, Email as email, SectorId as sectorId, JobTitle as jobTitle, Active as active, HasPendingIssues as hasPendingIssues, PendingIssuesNote as pendingIssuesNote FROM Users`); const formatted = data.map(u => ({ ...u, active: !!u.active, hasPendingIssues: !!u.hasPendingIssues })); res.json(formatted); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/users', async (req, res) => { const u = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, u.id).input('FullName', sql.NVarChar, u.fullName).input('Cpf', sql.NVarChar, u.cpf).input('Rg', sql.NVarChar, u.rg).input('Email', sql.NVarChar, u.email).input('SectorId', sql.NVarChar, u.sectorId).input('JobTitle', sql.NVarChar, u.jobTitle).input('Address', sql.NVarChar, u.address || '').query(`INSERT INTO Users (Id, FullName, Cpf, Rg, Email, SectorId, JobTitle, Address, Active) VALUES (@Id, @FullName, @Cpf, @Rg, @Email, @SectorId, @JobTitle, @Address, 1)`); await logAction(u.id, 'User', 'Criação', u._adminUser, u.fullName); res.json(u); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/users/:id', async (req, res) => { const u = req.body; try { const pool = await sql.connect(dbConfig); let currentActive = null; try { const currentRes = await pool.request().query(`SELECT Active FROM Users WHERE Id = '${req.params.id}'`); if (currentRes.recordset.length > 0) currentActive = currentRes.recordset[0].Active; } catch(e) {} await pool.request().input('Id', sql.NVarChar, req.params.id).input('FullName', sql.NVarChar, u.fullName).input('Email', sql.NVarChar, u.email).input('SectorId', sql.NVarChar, u.sectorId).input('JobTitle', sql.NVarChar, u.jobTitle).input('Active', sql.Bit, u.active ? 1 : 0).input('HasPendingIssues', sql.Bit, u.hasPendingIssues ? 1 : 0).input('PendingIssuesNote', sql.NVarChar, u.pendingIssuesNote || '').query(`UPDATE Users SET FullName=@FullName, Email=@Email, SectorId=@SectorId, JobTitle=@JobTitle, Active=@Active, HasPendingIssues=@HasPendingIssues, PendingIssuesNote=@PendingIssuesNote WHERE Id=@Id`); let logActionType = 'Atualização'; let logNotes = 'Dados atualizados'; if (currentActive !== null && u.active !== undefined) { if (!!currentActive !== !!u.active) { logActionType = !!u.active ? 'Ativação' : 'Inativação'; logNotes = !!u.active ? 'Colaborador reativado no sistema.' : (u._reason ? `Motivo: ${u._reason}` : 'Colaborador inativado.'); } } await logAction(u.id, 'User', logActionType, u._adminUser, logNotes); res.json(u); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/terms', async (req, res) => { try { const data = await query(`SELECT Id as id, UserId as userId, Type as type, AssetDetails as assetDetails, Date as date, FileUrl as fileUrl FROM Terms`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/terms', async (req, res) => { const t = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, t.id).input('UserId', sql.NVarChar, t.userId).input('Type', sql.NVarChar, t.type).input('AssetDetails', sql.NVarChar, t.assetDetails).input('Date', sql.DateTime2, t.date).input('FileUrl', sql.NVarChar, t.fileUrl || null).query(`INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, FileUrl) VALUES (@Id, @UserId, @Type, @AssetDetails, @Date, @FileUrl)`); res.json(t); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/terms/:id', async (req, res) => { const { fileUrl } = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).input('FileUrl', sql.NVarChar, fileUrl).query(`UPDATE Terms SET FileUrl=@FileUrl WHERE Id=@Id`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.post('/api/operations/checkout', async (req, res) => { const { assetId, assetType, userId, notes, action, _adminUser } = req.body; const table = assetType === 'Device' ? 'Devices' : 'SimCards'; try { const pool = await sql.connect(dbConfig); await pool.request().input('UserId', sql.NVarChar, userId).input('Id', sql.NVarChar, assetId).query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@UserId WHERE Id=@Id`); await logAction(assetId, assetType, action, _adminUser, `Entregue ao usuário. Obs: ${notes}`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/operations/checkin', async (req, res) => { const { assetId, assetType, notes, action, _adminUser } = req.body; const table = assetType === 'Device' ? 'Devices' : 'SimCards'; try { await query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id='${assetId}'`); await logAction(assetId, assetType, action, _adminUser, `Devolução. Obs: ${notes}`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/logs', async (req, res) => { try { const data = await query(`SELECT Id as id, AssetId as assetId, AssetType as assetType, TargetName as targetName, Action as action, Timestamp as timestamp, Notes as notes, AdminUser as adminUser, BackupData as backupData FROM AuditLogs ORDER BY Timestamp DESC`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/logs', async (req, res) => { try { await query(`TRUNCATE TABLE AuditLogs`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/restore', async (req, res) => {
    const { logId, _adminUser } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const logs = await pool.request().input('Id', sql.NVarChar, logId).query(`SELECT * FROM AuditLogs WHERE Id=@Id`);
        if (logs.recordset.length === 0 || !logs.recordset[0].BackupData) { return res.status(400).send('Log inválido ou sem backup.'); }
        const log = logs.recordset[0];
        const data = JSON.parse(log.BackupData);
        if (log.AssetType === 'Device') {
            await pool.request().input('Id', sql.NVarChar, data.Id).input('ModelId', sql.NVarChar, data.ModelId).input('SerialNumber', sql.NVarChar, data.SerialNumber).input('AssetTag', sql.NVarChar, data.AssetTag).input('Status', sql.NVarChar, 'Disponível').query(`INSERT INTO Devices (Id, ModelId, SerialNumber, AssetTag, Status) VALUES (@Id, @ModelId, @SerialNumber, @AssetTag, @Status)`);
        } else if (log.AssetType === 'Sim') {
             await pool.request().input('Id', sql.NVarChar, data.Id).input('PhoneNumber', sql.NVarChar, data.PhoneNumber).input('Status', sql.NVarChar, 'Disponível').query(`INSERT INTO SimCards (Id, PhoneNumber, Status) VALUES (@Id, @PhoneNumber, @Status)`);
        } else { return res.status(400).send('Tipo de ativo não suportado.'); }
        await logAction(log.AssetId, log.AssetType, 'Restauração', _adminUser, `Item restaurado via auditoria.`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/settings', async (req, res) => { try { const data = await query(`SELECT TOP 1 AppName as appName, Cnpj as cnpj, LogoUrl as logoUrl, TermTemplate as termTemplate, ReturnTermTemplate as returnTermTemplate FROM SystemSettings`); res.json(data[0] || {}); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/settings', async (req, res) => { const s = req.body; try { const pool = await sql.connect(dbConfig); const check = await pool.request().query('SELECT count(*) as count FROM SystemSettings'); if (check.recordset[0].count === 0) { await pool.request().input('AppName', sql.NVarChar, s.appName).input('Cnpj', sql.NVarChar, s.cnpj).input('LogoUrl', sql.NVarChar, s.logoUrl).input('TermTemplate', sql.NVarChar, s.termTemplate).input('ReturnTermTemplate', sql.NVarChar, s.returnTermTemplate).query(`INSERT INTO SystemSettings (AppName, Cnpj, LogoUrl, TermTemplate, ReturnTermTemplate) VALUES (@AppName, @Cnpj, @LogoUrl, @TermTemplate, @ReturnTermTemplate)`); } else { await pool.request().input('AppName', sql.NVarChar, s.appName).input('Cnpj', sql.NVarChar, s.cnpj).input('LogoUrl', sql.NVarChar, s.logoUrl).input('TermTemplate', sql.NVarChar, s.termTemplate).input('ReturnTermTemplate', sql.NVarChar, s.returnTermTemplate).query(`UPDATE SystemSettings SET AppName=@AppName, Cnpj=@Cnpj, LogoUrl=@LogoUrl, TermTemplate=@TermTemplate, ReturnTermTemplate=@ReturnTermTemplate`); } res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

// ASSET TYPES (UPDATED - CLEANED)
app.get('/api/asset-types', async (req, res) => { 
    try { 
        const data = await query(`SELECT Id as id, Name as name, CustomFieldIds as customFieldIdsStr FROM AssetTypes`); 
        const formatted = data.map(d => ({ 
            ...d, 
            customFieldIds: d.customFieldIdsStr ? JSON.parse(d.customFieldIdsStr) : [] 
        })); 
        res.json(formatted); 
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
        await logAction(t.id, 'Type', 'Criação', t._adminUser, t.name); 
        res.json(t); 
    } catch (err) { res.status(500).send(err.message); } 
});
app.put('/api/asset-types/:id', async (req, res) => { 
    const t = req.body; 
    try { 
        const pool = await sql.connect(dbConfig); 
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Name', sql.NVarChar, t.name)
            .input('CustomFieldIds', sql.NVarChar, JSON.stringify(t.customFieldIds || []))
            .query(`UPDATE AssetTypes SET Name=@Name, CustomFieldIds=@CustomFieldIds WHERE Id=@Id`); 
        await logAction(t.id, 'Type', 'Atualização', t._adminUser, t.name); 
        res.json(t); 
    } catch (err) { res.status(500).send(err.message); } 
});
app.delete('/api/asset-types/:id', async (req, res) => { try { await query(`DELETE FROM AssetTypes WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

// Custom Fields Routes
app.get('/api/custom-fields', async (req, res) => { try { const data = await query(`SELECT Id as id, Name as name FROM CustomFields`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/custom-fields', async (req, res) => { const f = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, f.id).input('Name', sql.NVarChar, f.name).query(`INSERT INTO CustomFields (Id, Name) VALUES (@Id, @Name)`); await logAction(f.id, 'CustomField', 'Criação', f._adminUser, f.name); res.json(f); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/custom-fields/:id', async (req, res) => { try { await query(`DELETE FROM CustomFields WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/brands', async (req, res) => { try { const data = await query(`SELECT Id as id, Name as name FROM Brands`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/brands', async (req, res) => { const b = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, b.id).input('Name', sql.NVarChar, b.name).query(`INSERT INTO Brands (Id, Name) VALUES (@Id, @Name)`); await logAction(b.id, 'Brand', 'Criação', b._adminUser, b.name); res.json(b); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/brands/:id', async (req, res) => { const b = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).input('Name', sql.NVarChar, b.name).query(`UPDATE Brands SET Name=@Name WHERE Id=@Id`); await logAction(b.id, 'Brand', 'Atualização', b._adminUser, b.name); res.json(b); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/brands/:id', async (req, res) => { try { await query(`DELETE FROM Brands WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/accessory-types', async (req, res) => { try { const data = await query(`SELECT Id as id, Name as name FROM AccessoryTypes`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/accessory-types', async (req, res) => { const t = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, t.id).input('Name', sql.NVarChar, t.name).query(`INSERT INTO AccessoryTypes (Id, Name) VALUES (@Id, @Name)`); await logAction(t.id, 'Type', 'Criação', t._adminUser, t.name); res.json(t); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/accessory-types/:id', async (req, res) => { const t = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).input('Name', sql.NVarChar, t.name).query(`UPDATE AccessoryTypes SET Name=@Name WHERE Id=@Id`); await logAction(t.id, 'Accessory', 'Atualização', t._adminUser, t.name); res.json(t); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/accessory-types/:id', async (req, res) => { try { await query(`DELETE FROM AccessoryTypes WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

// ... (Rest of existing endpoints) ...
app.get('/api/sectors', async (req, res) => { try { const data = await query(`SELECT Id as id, Name as name FROM Sectors`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/sectors', async (req, res) => { const s = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, s.id).input('Name', sql.NVarChar, s.name).query(`INSERT INTO Sectors (Id, Name) VALUES (@Id, @Name)`); await logAction(s.id, 'Sector', 'Criação', s._adminUser, s.name); res.json(s); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/sectors/:id', async (req, res) => { try { await query(`DELETE FROM Sectors WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/system-users', async (req, res) => { try { const data = await query(`SELECT Id as id, Name as name, Email as email, Role as role, Password as password FROM SystemUsers`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/system-users', async (req, res) => { const u = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, u.id).input('Name', sql.NVarChar, u.name).input('Email', sql.NVarChar, u.email).input('Password', sql.NVarChar, u.password).input('Role', sql.NVarChar, u.role).query(`INSERT INTO SystemUsers (Id, Name, Email, Password, Role) VALUES (@Id, @Name, @Email, @Password, @Role)`); await logAction(u.id, 'System', 'Criação', u._adminUser, u.name); res.json(u); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/system-users/:id', async (req, res) => { const u = req.body; try { const pool = await sql.connect(dbConfig); const request = pool.request().input('Id', sql.NVarChar, req.params.id).input('Name', sql.NVarChar, u.name).input('Email', sql.NVarChar, u.email).input('Role', sql.NVarChar, u.role); let queryStr = `UPDATE SystemUsers SET Name=@Name, Email=@Email, Role=@Role`; if (u.password) { request.input('Password', sql.NVarChar, u.password); queryStr += `, Password=@Password`; } queryStr += ` WHERE Id=@Id`; await request.query(queryStr); await logAction(u.id, 'System', 'Atualização', u._adminUser, u.name); res.json(u); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/system-users/:id', async (req, res) => { try { await query(`DELETE FROM SystemUsers WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/maintenances', async (req, res) => { try { const data = await query(`SELECT Id as id, DeviceId as deviceId, Type as type, Date as date, Description as description, Cost as cost, Provider as provider FROM MaintenanceRecords`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/maintenances', async (req, res) => { const m = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, m.id).input('DeviceId', sql.NVarChar, m.deviceId).input('Type', sql.NVarChar, m.type).input('Date', sql.DateTime2, m.date).input('Description', sql.NVarChar, m.description).input('Cost', sql.Decimal(18,2), m.cost).input('Provider', sql.NVarChar, m.provider).query(`INSERT INTO MaintenanceRecords (Id, DeviceId, Type, Date, Description, Cost, Provider) VALUES (@Id, @DeviceId, @Type, @Date, @Description, @Cost, @Provider)`); await logAction(m.deviceId, 'Device', 'Manutenção', m._adminUser, `Registro de manutenção: ${m.description}`); res.json(m); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/maintenances/:id', async (req, res) => { try { await query(`DELETE FROM MaintenanceRecords WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/models', async (req, res) => { try { const data = await query(`SELECT Id as id, Name as name, BrandId as brandId, TypeId as typeId, ImageUrl as imageUrl FROM Models`); res.json(data); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/models', async (req, res) => { const m = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, m.id).input('Name', sql.NVarChar, m.name).input('BrandId', sql.NVarChar, m.brandId).input('TypeId', sql.NVarChar, m.typeId).input('ImageUrl', sql.NVarChar, m.imageUrl || '').query(`INSERT INTO Models (Id, Name, BrandId, TypeId, ImageUrl) VALUES (@Id, @Name, @BrandId, @TypeId, @ImageUrl)`); await logAction(m.id, 'Model', 'Criação', m._adminUser, m.name); res.json(m); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/models/:id', async (req, res) => { const m = req.body; try { const pool = await sql.connect(dbConfig); await pool.request().input('Id', sql.NVarChar, req.params.id).input('Name', sql.NVarChar, m.name).input('BrandId', sql.NVarChar, m.brandId).input('TypeId', sql.NVarChar, m.typeId).input('ImageUrl', sql.NVarChar, m.imageUrl || '').query(`UPDATE Models SET Name=@Name, BrandId=@BrandId, TypeId=@TypeId, ImageUrl=@ImageUrl WHERE Id=@Id`); await logAction(m.id, 'Model', 'Atualização', m._adminUser, m.name); res.json(m); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/models/:id', async (req, res) => { try { await query(`DELETE FROM Models WHERE Id = '${req.params.id}'`); res.json({ success: true }); } catch (err) { res.status(500).send(err.message); } });

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

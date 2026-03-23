
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
        PurchaseInvoiceBinary VARBINARY(MAX),
        DeviceImageBinary VARBINARY(MAX),
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
        Status NVARCHAR(50) DEFAULT 'Ativo',
        OnLeaveUntil DATETIME NULL,
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
    Models: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255), BrandId NVARCHAR(255), TypeId NVARCHAR(255), ImageBinary VARBINARY(MAX))`,
    Brands: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    AssetTypes: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE, CustomFieldIds NVARCHAR(MAX))`,
    MaintenanceRecords: `(Id NVARCHAR(255) PRIMARY KEY, DeviceId NVARCHAR(255), Description NVARCHAR(MAX), Cost FLOAT, Date DATETIME, Type NVARCHAR(100), Provider NVARCHAR(255), InvoiceBinary VARBINARY(MAX))`,
    Sectors: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    Terms: `(Id NVARCHAR(255) PRIMARY KEY, UserId NVARCHAR(255), Type NVARCHAR(50), AssetDetails NVARCHAR(MAX), Date DATETIME, FileBinary VARBINARY(MAX), IsManual BIT DEFAULT 0, ResolutionReason NVARCHAR(MAX))`,
    AccessoryTypes: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    DeviceAccessories: `(Id NVARCHAR(255) PRIMARY KEY, DeviceId NVARCHAR(255), AccessoryTypeId NVARCHAR(255), Name NVARCHAR(255))`,
    CustomFields: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    SoftwareAccounts: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255), Type NVARCHAR(100), Login NVARCHAR(255), Password NVARCHAR(255), AccessUrl NVARCHAR(MAX), Status NVARCHAR(50), UserIds NVARCHAR(MAX), DeviceIds NVARCHAR(MAX), SectorId NVARCHAR(255), Notes NVARCHAR(MAX))`,
    Tasks: `(
        Id NVARCHAR(255) PRIMARY KEY,
        Title NVARCHAR(255),
        Description NVARCHAR(MAX),
        Type NVARCHAR(100),
        Status NVARCHAR(50),
        CreatedAt DATETIME DEFAULT GETDATE(),
        DueDate DATETIME,
        AssignedTo NVARCHAR(255),
        Comments NVARCHAR(MAX),
        Instructions NVARCHAR(MAX),
        EvidenceUrls NVARCHAR(MAX),
        ManualAttachments NVARCHAR(MAX),
        DeviceId NVARCHAR(255),
        MaintenanceType NVARCHAR(100),
        MaintenanceCost FLOAT,
        MaintenanceItems NVARCHAR(MAX)
    )`,
    TaskLogs: `(
        Id NVARCHAR(255) PRIMARY KEY,
        TaskId NVARCHAR(255),
        Action NVARCHAR(MAX),
        AdminUser NVARCHAR(255),
        Timestamp DATETIME DEFAULT GETDATE(),
        Notes NVARCHAR(MAX)
    )`,
    ExternalDbConfig: `(
        Id INT PRIMARY KEY IDENTITY(1,1),
        Technology NVARCHAR(50),
        Host NVARCHAR(255),
        Port INT,
        Username NVARCHAR(255),
        Password NVARCHAR(255),
        DatabaseName NVARCHAR(255),
        SelectionQuery NVARCHAR(MAX),
        LastSync DATETIME
    )`
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
                    
                    const checkBin1 = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'PurchaseInvoiceBinary'`);
                    if (checkBin1.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE Devices ADD PurchaseInvoiceBinary VARBINARY(MAX) NULL');
                    }
                    const checkBin2 = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'DeviceImageBinary'`);
                    if (checkBin2.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE Devices ADD DeviceImageBinary VARBINARY(MAX) NULL');
                    }

                    // Cleanup legacy columns
                    const checkLegacy = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'PurchaseInvoiceUrl'`);
                    if (checkLegacy.recordset.length > 0) {
                        console.log('- Removendo coluna legada PurchaseInvoiceUrl de Devices...');
                        await pool.request().query('ALTER TABLE Devices DROP COLUMN PurchaseInvoiceUrl');
                    }
                }
                if (table === 'SoftwareAccounts') {
                    const checkUserId = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SoftwareAccounts' AND COLUMN_NAME = 'UserId'`);
                    if (checkUserId.recordset.length > 0) {
                        console.log(`- Migrando SoftwareAccounts.UserId para UserIds...`);
                        await pool.request().query(`ALTER TABLE SoftwareAccounts ADD UserIds NVARCHAR(MAX)`);
                        await pool.request().query(`UPDATE SoftwareAccounts SET UserIds = '["' + UserId + '"]' WHERE UserId IS NOT NULL AND UserId <> ''`);
                        await pool.request().query(`ALTER TABLE SoftwareAccounts DROP COLUMN UserId`);
                    }
                    const checkDeviceId = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SoftwareAccounts' AND COLUMN_NAME = 'DeviceId'`);
                    if (checkDeviceId.recordset.length > 0) {
                        console.log(`- Migrando SoftwareAccounts.DeviceId para DeviceIds...`);
                        await pool.request().query(`ALTER TABLE SoftwareAccounts ADD DeviceIds NVARCHAR(MAX)`);
                        await pool.request().query(`UPDATE SoftwareAccounts SET DeviceIds = '["' + DeviceId + '"]' WHERE DeviceId IS NOT NULL AND DeviceId <> ''`);
                        await pool.request().query(`ALTER TABLE SoftwareAccounts DROP COLUMN DeviceId`);
                    }
                }
                if (table === 'Users') {
                    const checkStatus = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Status'`);
                    if (checkStatus.recordset.length === 0) {
                        console.log(`- Coluna Status não encontrada em Users. Adicionando...`);
                        await pool.request().query("ALTER TABLE Users ADD Status NVARCHAR(50) DEFAULT 'Ativo'");
                    }
                    const checkLeave = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'OnLeaveUntil'`);
                    if (checkLeave.recordset.length === 0) {
                        console.log(`- Coluna OnLeaveUntil não encontrada em Users. Adicionando...`);
                        await pool.request().query("ALTER TABLE Users ADD OnLeaveUntil DATETIME NULL");
                    }
                }
                if (table === 'Models') {
                    const checkBin = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Models' AND COLUMN_NAME = 'ImageBinary'`);
                    if (checkBin.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE Models ADD ImageBinary VARBINARY(MAX) NULL');
                    }
                    const checkLegacy = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Models' AND COLUMN_NAME = 'ImageUrl'`);
                    if (checkLegacy.recordset.length > 0) {
                        console.log('- Removendo coluna legada ImageUrl de Models...');
                        await pool.request().query('ALTER TABLE Models DROP COLUMN ImageUrl');
                    }
                }
                if (table === 'MaintenanceRecords') {
                    const checkBin = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MaintenanceRecords' AND COLUMN_NAME = 'InvoiceBinary'`);
                    if (checkBin.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE MaintenanceRecords ADD InvoiceBinary VARBINARY(MAX) NULL');
                    }
                    const checkLegacy = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MaintenanceRecords' AND COLUMN_NAME = 'InvoiceUrl'`);
                    if (checkLegacy.recordset.length > 0) {
                        console.log('- Removendo coluna legada InvoiceUrl de MaintenanceRecords...');
                        await pool.request().query('ALTER TABLE MaintenanceRecords DROP COLUMN InvoiceUrl');
                    }
                }
                if (table === 'Terms') {
                    const checkBin = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'FileBinary'`);
                    if (checkBin.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE Terms ADD FileBinary VARBINARY(MAX) NULL');
                    }
                    const checkManual = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'IsManual'`);
                    if (checkManual.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE Terms ADD IsManual BIT DEFAULT 0');
                    }
                    const checkReason = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'ResolutionReason'`);
                    if (checkReason.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE Terms ADD ResolutionReason NVARCHAR(MAX) NULL');
                    }
                    const checkLegacy = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'FileUrl'`);
                    if (checkLegacy.recordset.length > 0) {
                        console.log('- Removendo coluna legada FileUrl de Terms...');
                        await pool.request().query('ALTER TABLE Terms DROP COLUMN FileUrl');
                    }
                    const checkEvidence = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'EvidenceBinary'`);
                    if (checkEvidence.recordset.length === 0) {
                        console.log('- Adicionando colunas de evidência em Terms...');
                        await pool.request().query('ALTER TABLE Terms ADD EvidenceBinary VARBINARY(MAX) NULL, Condition NVARCHAR(50) NULL, DamageDescription NVARCHAR(MAX) NULL');
                    }
                    const checkEvidence2 = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'Evidence2Binary'`);
                    if (checkEvidence2.recordset.length === 0) {
                        console.log('- Adicionando colunas de evidência 2 e 3 em Terms...');
                        await pool.request().query('ALTER TABLE Terms ADD Evidence2Binary VARBINARY(MAX) NULL, Evidence3Binary VARBINARY(MAX) NULL');
                    }
                    const checkNotes = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'Notes'`);
                    if (checkNotes.recordset.length === 0) {
                        console.log('- Adicionando coluna Notes em Terms...');
                        await pool.request().query('ALTER TABLE Terms ADD Notes NVARCHAR(MAX) NULL');
                    }
                }
                if (table === 'Tasks') {
                    const checkInstructions = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'Instructions'`);
                    if (checkInstructions.recordset.length === 0) {
                        console.log(`- Coluna Instructions não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD Instructions NVARCHAR(MAX) NULL');
                        console.log('  ... Coluna Instructions adicionada.');
                    }
                    const checkManualAttachments = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'ManualAttachments'`);
                    if (checkManualAttachments.recordset.length === 0) {
                        console.log(`- Coluna ManualAttachments não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD ManualAttachments NVARCHAR(MAX) NULL');
                        console.log('  ... Coluna ManualAttachments adicionada.');
                    }

                    // v2.19.18 - Novas colunas para manutenção
                    const checkDeviceId = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'DeviceId'`);
                    if (checkDeviceId.recordset.length === 0) {
                        console.log(`- Coluna DeviceId não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD DeviceId NVARCHAR(255) NULL');
                    }
                    const checkMaintenanceType = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'MaintenanceType'`);
                    if (checkMaintenanceType.recordset.length === 0) {
                        console.log(`- Coluna MaintenanceType não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD MaintenanceType NVARCHAR(100) NULL');
                    }
                    const checkMaintenanceCost = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'MaintenanceCost'`);
                    if (checkMaintenanceCost.recordset.length === 0) {
                        console.log(`- Coluna MaintenanceCost não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD MaintenanceCost FLOAT NULL');
                    }

                    const checkMaintenanceItems = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'MaintenanceItems'`);
                    if (checkMaintenanceItems.recordset.length === 0) {
                        console.log(`- Coluna MaintenanceItems não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD MaintenanceItems NVARCHAR(MAX) NULL');
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

        // Garante que a tabela de ExternalDbConfig tenha pelo menos uma linha
        const extDbCheck = await pool.request().query('SELECT COUNT(*) as count FROM ExternalDbConfig');
        if (extDbCheck.recordset[0].count === 0) {
            console.log('- Inicializando ExternalDbConfig...');
            await pool.request().query("INSERT INTO ExternalDbConfig (Technology) VALUES ('SQL Server')");
        }

        console.log('Banco de dados pronto.');

    } catch (err) {
        console.error('ERRO FATAL na inicialização do banco de dados:', err.message);
        process.exit(1); // Encerra o processo se o DB falhar
    }
}

async function fixSimStatus() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log('Verificando consistência de status de SIM Cards...');

        // 1. Get all devices with linked SIMs
        const devicesRes = await pool.request().query("SELECT LinkedSimId FROM Devices WHERE LinkedSimId IS NOT NULL AND Status != 'Descartado'");
        const devices = devicesRes.recordset;

        // 2. Get all SIMs assigned directly to users
        const assignedSimsRes = await pool.request().query("SELECT Id FROM SimCards WHERE CurrentUserId IS NOT NULL AND Status != 'Descartado'");
        const assignedSims = assignedSimsRes.recordset;

        const inUseSimIds = new Set([
            ...devices.map(d => d.LinkedSimId),
            ...assignedSims.map(s => s.Id)
        ]);

        // 3. Get all SIMs to check status
        const allSimsRes = await pool.request().query("SELECT Id, Status FROM SimCards");
        const allSims = allSimsRes.recordset;

        let updatedCount = 0;
        const updates = [];

        for (const sim of allSims) {
            // Skip if Retired or Maintenance (manual states)
            if (sim.Status === 'Descartado' || sim.Status === 'Manutenção') continue;

            const shouldBeInUse = inUseSimIds.has(sim.Id);
            const currentStatus = sim.Status;

            if (shouldBeInUse && currentStatus !== 'Em Uso') {
                updates.push(
                    pool.request()
                        .input('Id', sql.NVarChar, sim.Id)
                        .query("UPDATE SimCards SET Status='Em Uso' WHERE Id=@Id")
                );
                updatedCount++;
            } else if (!shouldBeInUse && currentStatus === 'Em Uso') {
                updates.push(
                    pool.request()
                        .input('Id', sql.NVarChar, sim.Id)
                        .query("UPDATE SimCards SET Status='Disponível' WHERE Id=@Id")
                );
                updatedCount++;
            }
        }

        await Promise.all(updates);
        console.log(`Correção de SIM Cards concluída. ${updatedCount} registros atualizados.`);
    } catch (err) {
        console.error('Erro ao corrigir status de SIM Cards:', err);
    }
}

async function startServer() {
    await initializeDatabase();
    await fixSimStatus(); // Run fix on startup

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '2.20.4', 
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
            accTypesRes, customFieldsRes, accountsRes, tasksRes, taskLogsRes
        ] = await Promise.all([
            pool.request().query("SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
            pool.request().query(`
                SELECT 
                    s.Id, s.PhoneNumber, s.Operator, s.Iccid, s.Status, s.PlanDetails,
                    COALESCE(s.CurrentUserId, d.CurrentUserId) as CurrentUserId
                FROM SimCards s
                LEFT JOIN Devices d ON d.LinkedSimId = s.Id
            `),
            pool.request().query("SELECT * FROM Users"),
            pool.request().query("SELECT TOP 200 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs ORDER BY Timestamp DESC"),
            pool.request().query("SELECT Id as id, Name as name, Email as email, Password as password, Role as role FROM SystemUsers"),
            pool.request().query("SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate FROM SystemSettings"),
            pool.request().query("SELECT * FROM Models"), 
            pool.request().query("SELECT * FROM Brands"),
            pool.request().query("SELECT * FROM AssetTypes"),
            pool.request().query("SELECT Id, DeviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            pool.request().query("SELECT * FROM Sectors"),
            pool.request().query("SELECT Id, UserId, Type, AssetDetails, Date, IsManual as isManual, ResolutionReason as resolutionReason, (CASE WHEN (FileBinary IS NOT NULL) OR (IsManual = 1) THEN 1 ELSE 0 END) as hasFile, Condition as condition, DamageDescription as damageDescription, Notes as notes, (CASE WHEN EvidenceBinary IS NOT NULL OR Evidence2Binary IS NOT NULL OR Evidence3Binary IS NOT NULL THEN 1 ELSE 0 END) as hasEvidence FROM Terms"),
            pool.request().query("SELECT * FROM AccessoryTypes"),
            pool.request().query("SELECT * FROM CustomFields"),
            pool.request().query("SELECT * FROM SoftwareAccounts"),
            pool.request().query("SELECT * FROM Tasks"),
            pool.request().query("SELECT * FROM TaskLogs")
        ]);

        const devices = await Promise.all(devicesRes.recordset.map(async d => {
            const acc = await pool.request().input('DevId', sql.NVarChar, d.Id).query("SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId=@DevId");
            return {
                id: d.Id, modelId: d.ModelId, serialNumber: d.SerialNumber, assetTag: d.AssetTag, internalCode: d.InternalCode, imei: d.Imei, pulsusId: d.PulsusId, status: d.Status, currentUserId: d.CurrentUserId, sectorId: d.SectorId, costCenter: d.CostCenter, linkedSimId: d.LinkedSimId, purchaseDate: d.PurchaseDate, purchaseCost: d.PurchaseCost, invoiceNumber: d.InvoiceNumber, supplier: d.Supplier, hasInvoice: d.hasInvoice === 1, customData: d.CustomData ? JSON.parse(d.CustomData) : {}, accessories: acc.recordset
            };
        }));

        res.json({
            devices, sims: format(simsRes), users: format(usersRes), logs: format(logsRes), systemUsers: sysUsersRes.recordset,
            settings: settingsRes.recordset[0] || { appName: 'IT Asset', logoUrl: '' }, 
            models: format(modelsRes).map(m => ({ ...m, imageUrl: getBase64FromBuffer(m.imageBinary) })), 
            brands: format(brandsRes),
            assetTypes: format(typesRes, ['CustomFieldIds']), maintenances: format(maintRes).map(m => ({ ...m, hasInvoice: m.hasInvoice === 1 })),
            sectors: format(sectorsRes), terms: format(termsRes).map(t => ({ ...t, hasFile: t.hasFile === 1 })), accessoryTypes: format(accTypesRes),
            customFields: format(customFieldsRes), accounts: format(accountsRes, ['UserIds', 'DeviceIds']),
            tasks: format(tasksRes, ['EvidenceUrls', 'ManualAttachments', 'MaintenanceItems']), taskLogs: format(taskLogsRes)
        });
    } catch (err) { res.status(500).send(err.message); }
});

// --- SYNC ENDPOINT (v2.12.51 - Lightweight) ---
app.get('/api/sync', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const [devicesRes, simsRes, usersRes, logsRes, maintRes, termsRes, accountsRes, tasksRes] = await Promise.all([
            pool.request().query("SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
            pool.request().query(`
                SELECT 
                    s.Id, s.PhoneNumber, s.Operator, s.Iccid, s.Status, s.PlanDetails,
                    COALESCE(s.CurrentUserId, d.CurrentUserId) as CurrentUserId
                FROM SimCards s
                LEFT JOIN Devices d ON d.LinkedSimId = s.Id
            `),
            pool.request().query("SELECT * FROM Users"),
            pool.request().query("SELECT TOP 200 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs ORDER BY Timestamp DESC"),
            pool.request().query("SELECT Id, DeviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            pool.request().query("SELECT Id, UserId, Type, AssetDetails, Date, IsManual as isManual, ResolutionReason as resolutionReason, (CASE WHEN (FileBinary IS NOT NULL) OR (IsManual = 1) THEN 1 ELSE 0 END) as hasFile, Condition as condition, DamageDescription as damageDescription, Notes as notes, (CASE WHEN EvidenceBinary IS NOT NULL OR Evidence2Binary IS NOT NULL OR Evidence3Binary IS NOT NULL THEN 1 ELSE 0 END) as hasEvidence FROM Terms"),
            pool.request().query("SELECT * FROM SoftwareAccounts"),
            pool.request().query("SELECT * FROM Tasks")
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
            accounts: format(accountsRes, ['UserIds', 'DeviceIds']),
            tasks: format(tasksRes, ['EvidenceUrls', 'ManualAttachments', 'MaintenanceItems'])
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
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileBinary FROM Terms WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row) return res.json({ fileUrl: '' });
        res.json({ fileUrl: getBase64FromBuffer(row.FileBinary) });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/terms/evidence/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT EvidenceBinary, Evidence2Binary, Evidence3Binary FROM Terms WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row) return res.json({ fileUrls: [] });
        
        const fileUrls = [];
        if (row.EvidenceBinary) fileUrls.push(getBase64FromBuffer(row.EvidenceBinary));
        if (row.Evidence2Binary) fileUrls.push(getBase64FromBuffer(row.Evidence2Binary));
        if (row.Evidence3Binary) fileUrls.push(getBase64FromBuffer(row.Evidence3Binary));
        
        // Mantém compatibilidade com o frontend antigo retornando fileUrl também
        res.json({ fileUrl: fileUrls[0] || '', fileUrls });
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/terms/:id', async (req, res) => {
    try {
        const { condition, damageDescription, assetDetails, notes, evidenceFiles, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails, FileBinary FROM Terms WHERE Id=@Id");
        const term = oldRes.recordset[0];
        
        if (!term) return res.status(404).send("Termo não encontrado");
        if (term.FileBinary) return res.status(400).send("Termos já digitalizados não podem ser editados");

        let query = "UPDATE Terms SET Condition=@Cond, DamageDescription=@Desc, AssetDetails=@Ad, Notes=@Notes";
        
        const request = pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Cond', sql.NVarChar, condition || 'Perfeito')
            .input('Desc', sql.NVarChar, damageDescription || null)
            .input('Ad', sql.NVarChar, assetDetails || term.AssetDetails)
            .input('Notes', sql.NVarChar, notes || null);

        if (evidenceFiles !== undefined) {
            query += ", EvidenceBinary=@Evid, Evidence2Binary=@Evid2, Evidence3Binary=@Evid3";
            
            const ev1 = evidenceFiles && evidenceFiles.length > 0 ? getBufferFromBase64(evidenceFiles[0]) : null;
            const ev2 = evidenceFiles && evidenceFiles.length > 1 ? getBufferFromBase64(evidenceFiles[1]) : null;
            const ev3 = evidenceFiles && evidenceFiles.length > 2 ? getBufferFromBase64(evidenceFiles[2]) : null;
            
            request.input('Evid', sql.VarBinary, ev1);
            request.input('Evid2', sql.VarBinary, ev2);
            request.input('Evid3', sql.VarBinary, ev3);
        }

        query += " WHERE Id=@Id";
        
        await request.query(query);

        await logAction(req.params.id, 'Term', 'Edição', _adminUser, term.UserId, `Termo editado. Condição: ${condition}`);
        
        res.json({success: true});
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// v2.12.38 - Endpoint crítico para upload de termos digitalizados
app.put('/api/terms/file/:id', async (req, res) => {
    try {
        const { fileUrl, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails FROM Terms WHERE Id=@Id");
        const term = oldRes.recordset[0];
        
        if (!term) return res.status(404).send("Termo não encontrado");

        const buffer = getBufferFromBase64(fileUrl);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Bin', buffer)
            .query("UPDATE Terms SET FileBinary=@Bin, IsManual=0, ResolutionReason=NULL WHERE Id=@Id");

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

        await pool.request().input('Id', sql.NVarChar, req.params.id).query("UPDATE Terms SET FileBinary=NULL WHERE Id=@Id");

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
            .input('Reason', sql.NVarChar, reason)
            .query("UPDATE Terms SET IsManual=1, ResolutionReason=@Reason WHERE Id=@Id");

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
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT PurchaseInvoiceBinary FROM Devices WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row) return res.json({ invoiceUrl: '' });
        res.json({ invoiceUrl: getBase64FromBuffer(row.PurchaseInvoiceBinary) });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/maintenances/:id/invoice', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT InvoiceBinary FROM MaintenanceRecords WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row) return res.json({ invoiceUrl: '' });
        res.json({ invoiceUrl: getBase64FromBuffer(row.InvoiceBinary) });
    } catch (err) { res.status(500).send(err.message); }
});

const isBase64 = (str) => {
    if (!str || typeof str !== 'string') return false;
    return str.startsWith('data:') && str.includes(';base64,');
};

const getBufferFromBase64 = (str) => {
    if (!isBase64(str)) return null;
    const base64Data = str.split(';base64,').pop();
    return Buffer.from(base64Data, 'base64');
};

const getBase64FromBuffer = (buffer) => {
    if (!buffer) return '';
    
    let mime = 'image/png'; // Default
    
    // Detect MIME from buffer magic numbers
    if (buffer.length > 4) {
        const hex = buffer.toString('hex', 0, 4).toUpperCase();
        if (hex === '25504446') {
            mime = 'application/pdf';
        } else if (hex === '89504E47') {
            mime = 'image/png';
        } else if (hex.startsWith('FFD8FF')) {
            mime = 'image/jpeg';
        }
    }
    
    return `data:${mime};base64,${buffer.toString('base64')}`;
};

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
            const processedKeys = new Set();
            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                // Ignora chaves que terminam em 'Binary' vindas do frontend (são buffers de leitura)
                if (key.endsWith('Binary')) continue;
                
                const val = (['customFieldIds', 'customData', 'userIds', 'deviceIds'].includes(key)) ? JSON.stringify(req.body[key]) : req.body[key];
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                // Map legacy URL columns to Binary columns
                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = 'FileBinary';

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    }
                    continue;
                }

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
            const processedKeys = new Set();
            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                // Ignora chaves que terminam em 'Binary' vindas do frontend (são buffers de leitura)
                if (key.endsWith('Binary')) continue;

                const val = (['customFieldIds', 'customData', 'userIds', 'deviceIds'].includes(key)) ? JSON.stringify(req.body[key]) : req.body[key];
                
                // Se o valor for nulo ou indefinido, pulamos a atualização deste campo
                if (val === null || val === undefined) continue; 

                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                // Map legacy URL columns to Binary columns
                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = 'FileBinary';

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        sets.push(`${dbKey}=@${dbKey}`);
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        sets.push(`${dbKey}=@${dbKey}`);
                    }
                    continue;
                }

                request.input(dbKey, val);
                sets.push(`${dbKey}=@${dbKey}`);

                if (prev) {
                    let oldVal = prev[dbKey];
                    let newVal = req.body[key];
                    if (['customData', 'customFieldIds', 'userIds', 'deviceIds'].includes(key)) newVal = JSON.stringify(newVal);
                    
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
            const { assetId, assetType, notes, _adminUser, inactivateUser, condition, damageDescription, evidenceFiles, isManual, resolutionReason } = req.body;
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
                // v2.18.14: Do NOT free the SIM card on device checkin. 
                // The SIM remains inside the device (Status='Em Uso'), just without a user.
                // Only free if explicitly unlinked via device edit.
                // await pool.request().input('Sid', sql.NVarChar, prev.LinkedSimId).query("UPDATE SimCards SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Sid");
            }

            await pool.request().input('Aid', assetId).query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Aid`);
            
            if (userId) {
                const termId = Math.random().toString(36).substr(2, 9);
                
                const ev1 = evidenceFiles && evidenceFiles.length > 0 ? getBufferFromBase64(evidenceFiles[0]) : null;
                const ev2 = evidenceFiles && evidenceFiles.length > 1 ? getBufferFromBase64(evidenceFiles[1]) : null;
                const ev3 = evidenceFiles && evidenceFiles.length > 2 ? getBufferFromBase64(evidenceFiles[2]) : null;
                
                await pool.request()
                    .input('I', termId)
                    .input('U', userId)
                    .input('T', 'DEVOLUCAO')
                    .input('Ad', assetDetails)
                    .input('Cond', condition || 'Perfeito')
                    .input('Desc', damageDescription || null)
                    .input('Notes', notes || null)
                    .input('Evid', sql.VarBinary, ev1)
                    .input('Evid2', sql.VarBinary, ev2)
                    .input('Evid3', sql.VarBinary, ev3)
                    .input('IsM', isManual ? 1 : 0)
                    .input('ResR', resolutionReason || null)
                    .query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, Condition, DamageDescription, Notes, EvidenceBinary, Evidence2Binary, Evidence3Binary, IsManual, ResolutionReason) VALUES (@I, @U, @T, @Ad, GETDATE(), @Cond, @Desc, @Notes, @Evid, @Evid2, @Evid3, @IsM, @ResR)");
                
                if (inactivateUser) {
                    await pool.request().input('Uid', sql.NVarChar, userId).query("UPDATE Users SET Active=0, Status='Inativo' WHERE Id=@Uid");
                    await logAction(userId, 'User', 'Inativação', _adminUser, userName, 'Inativado automaticamente durante a devolução (Desligamento)');
                }
            }
            
            const richNotes = `Origem: ${userName}\nStatus: 'Em Uso' ➔ 'Disponível'${notes ? `\nObservação: ${notes}` : ''}${condition && condition !== 'Perfeito' ? `\nCondição: ${condition}\nDescrição do Dano: ${damageDescription || 'N/A'}` : ''}`;
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
    // v2.18.14: Custom Device CRUD to handle SIM card status
    app.post('/api/devices', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            let columns = [];
            let values = [];
            const processedKeys = new Set();

            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                if (key.endsWith('Binary')) continue;
                
                const val = (['customFieldIds', 'customData', 'userIds', 'deviceIds'].includes(key)) ? JSON.stringify(req.body[key]) : req.body[key];
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = 'FileBinary';

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    }
                    continue;
                }

                request.input(dbKey, val);
                columns.push(dbKey);
                values.push('@' + dbKey);
            }
            await request.query(`INSERT INTO Devices (${columns.join(',')}) VALUES (${values.join(',')})`);

            // Handle SIM Card Status
            if (req.body.linkedSimId) {
                await pool.request()
                    .input('Sid', sql.NVarChar, req.body.linkedSimId)
                    .query("UPDATE SimCards SET Status='Em Uso' WHERE Id=@Sid");
            }

            const tName = req.body.assetTag || req.body.serialNumber || 'Novo Dispositivo';
            await logAction(req.body.id, 'Device', 'Criação', req.body._adminUser, tName, 'Dispositivo criado manualmente');
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put('/api/devices/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            
            // Get previous state to check SIM changes
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM Devices WHERE Id=@Id");
            const prev = oldRes.recordset[0];
            
            let diffNotes = [];
            let sets = [];
            const processedKeys = new Set();

            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                if (key.endsWith('Binary')) continue;

                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = 'FileBinary';

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        sets.push(`${dbKey}=@${dbKey}`);
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        sets.push(`${dbKey}=@${dbKey}`);
                    }
                    continue;
                }

                request.input(dbKey, val);
                sets.push(`${dbKey}=@${dbKey}`);

                if (prev) {
                    let oldVal = prev[dbKey];
                    let newVal = req.body[key];
                    if (['customData', 'customFieldIds', 'userIds', 'deviceIds'].includes(key)) newVal = JSON.stringify(newVal);
                    
                    if (String(oldVal || '') !== String(newVal || '')) {
                        diffNotes.push(`${key}: '${oldVal || '---'}' ➔ '${newVal || '---'}'`);
                    }
                }
            }
            request.input('TargetId', req.params.id);
            await request.query(`UPDATE Devices SET ${sets.join(',')} WHERE Id=@TargetId`);
            
            // Handle SIM Card Changes
            const oldSimId = prev?.LinkedSimId;
            const newSimId = req.body.linkedSimId;

            if (oldSimId !== newSimId) {
                // If SIM was removed or changed, free the old one
                if (oldSimId) {
                    await pool.request()
                        .input('Sid', sql.NVarChar, oldSimId)
                        .query("UPDATE SimCards SET Status='Disponível' WHERE Id=@Sid");
                }
                // If SIM was added or changed, occupy the new one
                if (newSimId) {
                    await pool.request()
                        .input('Sid', sql.NVarChar, newSimId)
                        .query("UPDATE SimCards SET Status='Em Uso' WHERE Id=@Sid");
                }
            }

            const richNotes = (req.body._notes || req.body._reason ? `Motivo: ${req.body._notes || req.body._reason}\n\n` : '') + diffNotes.join('\n');
            const tName = req.body.assetTag || req.body.serialNumber || 'Dispositivo';
            
            await logAction(req.params.id, 'Device', 'Atualização', req.body._adminUser, tName, richNotes, null, prev, req.body);
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.delete('/api/devices/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            
            // Check for linked SIM before delete
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT LinkedSimId FROM Devices WHERE Id=@Id");
            const device = oldRes.recordset[0];

            if (device && device.LinkedSimId) {
                await pool.request()
                    .input('Sid', sql.NVarChar, device.LinkedSimId)
                    .query("UPDATE SimCards SET Status='Disponível' WHERE Id=@Sid");
            }

            await pool.request().input('Id', req.params.id).query("DELETE FROM Devices WHERE Id=@Id");
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    crud('SimCards', 'sims', 'Sim');
    // crud('Devices', 'devices', 'Device'); // Replaced by custom handlers above

    // --- Admin Tools ---
    app.post('/api/admin/fix-sim-status', async (req, res) => {
        try {
            const adminUser = req.body._adminUser || 'System';
            const pool = await sql.connect(dbConfig);
            
            // 1. Get all devices with linked SIMs
            const devicesRes = await pool.request().query("SELECT LinkedSimId FROM Devices WHERE LinkedSimId IS NOT NULL AND Status != 'Descartado'");
            const devices = devicesRes.recordset;

            // 2. Get all SIMs assigned directly to users
            const assignedSimsRes = await pool.request().query("SELECT Id FROM SimCards WHERE CurrentUserId IS NOT NULL AND Status != 'Descartado'");
            const assignedSims = assignedSimsRes.recordset;

            const inUseSimIds = new Set([
                ...devices.map(d => d.LinkedSimId),
                ...assignedSims.map(s => s.Id)
            ]);

            // 3. Get all SIMs to check status
            const allSimsRes = await pool.request().query("SELECT Id, Status FROM SimCards");
            const allSims = allSimsRes.recordset;

            let updatedCount = 0;
            const updates = [];

            for (const sim of allSims) {
                // Skip if Retired or Maintenance (manual states)
                if (sim.Status === 'Descartado' || sim.Status === 'Manutenção') continue;

                const shouldBeInUse = inUseSimIds.has(sim.Id);
                const currentStatus = sim.Status;

                if (shouldBeInUse && currentStatus !== 'Em Uso') {
                    updates.push(
                        pool.request()
                            .input('Id', sql.NVarChar, sim.Id)
                            .query("UPDATE SimCards SET Status='Em Uso' WHERE Id=@Id")
                            .then(() => logAction(sim.Id, 'Sim', 'Atualização', adminUser, 'Correção Automática', 'Status alterado para Em Uso (Vinculado a dispositivo/usuário)'))
                    );
                    updatedCount++;
                } else if (!shouldBeInUse && currentStatus === 'Em Uso') {
                    updates.push(
                        pool.request()
                            .input('Id', sql.NVarChar, sim.Id)
                            .query("UPDATE SimCards SET Status='Disponível' WHERE Id=@Id")
                            .then(() => logAction(sim.Id, 'Sim', 'Atualização', adminUser, 'Correção Automática', 'Status alterado para Disponível (Sem vínculos)'))
                    );
                    updatedCount++;
                }
            }

            await Promise.all(updates);
            
            res.json({ success: true, message: `Correção concluída. ${updatedCount} SIM cards atualizados.` });
        } catch (error) {
            console.error('Error fixing SIM status:', error);
            res.status(500).json({ error: 'Failed to fix SIM status' });
        }
    });

    // --- EXTERNAL ERP INTEGRATION ---
    app.get('/api/admin/external-db/config', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT TOP 1 * FROM ExternalDbConfig");
            const config = result.recordset[0];
            if (!config) return res.json({});
            
            // Normaliza as chaves para minúsculas para o frontend
            const normalized = {
                technology: config.Technology,
                host: config.Host,
                port: config.Port,
                username: config.Username,
                password: config.Password,
                databaseName: config.DatabaseName,
                selectionQuery: config.SelectionQuery
            };
            res.json(normalized);
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/admin/external-db/config', async (req, res) => {
        try {
            const { technology, host, port, username, password, databaseName, selectionQuery, _adminUser } = req.body;
            const pool = await sql.connect(dbConfig);
            
            const check = await pool.request().query("SELECT COUNT(*) as count FROM ExternalDbConfig");
            if (check.recordset[0].count > 0) {
                await pool.request()
                    .input('tech', sql.NVarChar, technology)
                    .input('host', sql.NVarChar, host)
                    .input('port', sql.Int, parseInt(port))
                    .input('user', sql.NVarChar, username)
                    .input('pass', sql.NVarChar, password)
                    .input('db', sql.NVarChar, databaseName)
                    .input('query', sql.NVarChar, selectionQuery)
                    .query("UPDATE ExternalDbConfig SET Technology=@tech, Host=@host, Port=@port, Username=@user, Password=@pass, DatabaseName=@db, SelectionQuery=@query");
            } else {
                await pool.request()
                    .input('tech', sql.NVarChar, technology)
                    .input('host', sql.NVarChar, host)
                    .input('port', sql.Int, parseInt(port))
                    .input('user', sql.NVarChar, username)
                    .input('pass', sql.NVarChar, password)
                    .input('db', sql.NVarChar, databaseName)
                    .input('query', sql.NVarChar, selectionQuery)
                    .query("INSERT INTO ExternalDbConfig (Technology, Host, Port, Username, Password, DatabaseName, SelectionQuery) VALUES (@tech, @host, @port, @user, @pass, @db, @query)");
            }

            await logAction('system', 'System', 'Configuração ERP', _adminUser, 'Integração DB', 'Configurações de banco de dados externo atualizadas');
            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/admin/external-db/test', async (req, res) => {
        const { technology, host, port, username, password, databaseName } = req.body;
        const config = {
            user: username,
            password: password,
            server: host,
            port: parseInt(port),
            database: databaseName,
            options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 }
        };

        try {
            const externalPool = await new sql.ConnectionPool(config).connect();
            await externalPool.request().query("SELECT 1 as test");
            await externalPool.close();
            res.json({ success: true, message: 'Conexão estabelecida com sucesso!' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    app.get('/api/dashboard/expediente-alerts', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const configRes = await pool.request().query("SELECT TOP 1 * FROM ExternalDbConfig");
            const config = configRes.recordset[0];

            if (!config || !config.Host || !config.SelectionQuery) {
                return res.json([]);
            }

            const extConfig = {
                user: config.Username,
                password: config.Password,
                server: config.Host,
                port: config.Port,
                database: config.DatabaseName,
                options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
            };

            const externalPool = await new sql.ConnectionPool(extConfig).connect();
            const result = await externalPool.request().query(config.SelectionQuery);
            await externalPool.close();

            // Filtra apenas os que estão com ValidaExpediente = 0 (FALSO)
            // A query do usuário traz BOLVLAEXDEPG AS ValidaExpediente
            const alerts = result.recordset.filter(row => {
                // Aceita 0, '0', false, 'F', 'N' como falso
                const val = row.ValidaExpediente;
                return val === 0 || val === '0' || val === false || val === 'F' || val === 'N';
            }).map(row => ({
                codigo: row.Codigo,
                nome: row.Nome,
                cpf: row.CPF,
                rg: row.RG,
                pis: row.PIS,
                validaExpediente: false
            }));

            res.json(alerts);
        } catch (err) {
            console.error('Erro ao buscar alertas externos:', err.message);
            res.status(500).send(err.message);
        }
    });

    // --- TAREFAS (TASKS) ---
    app.get('/api/tasks', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const { status, type, assignedTo, startDate, endDate } = req.query;
            
            let query = "SELECT * FROM Tasks WHERE 1=1";
            const request = pool.request();

            if (status) { query += " AND Status = @status"; request.input('status', sql.NVarChar, status); }
            if (type) { query += " AND Type = @type"; request.input('type', sql.NVarChar, type); }
            if (assignedTo) { query += " AND AssignedTo = @assignedTo"; request.input('assignedTo', sql.NVarChar, assignedTo); }
            if (startDate) { query += " AND CreatedAt >= @startDate"; request.input('startDate', sql.DateTime, startDate); }
            if (endDate) { query += " AND CreatedAt <= @endDate"; request.input('endDate', sql.DateTime, endDate); }

            const result = await request.query(query);
            
            const formattedTasks = format(result, ['EvidenceUrls', 'ManualAttachments']);

            // Lógica de Alertas de Prazo (Injetada na listagem)
            const now = new Date();
            const tasksWithAlerts = formattedTasks.map(task => {
                let isOverdue = false;
                let isNearDue = false;

                if (task.dueDate) {
                    const dueDate = new Date(task.dueDate);
                    isOverdue = task.status !== 'Concluída' && task.status !== 'Cancelada' && dueDate < now;
                    const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
                    isNearDue = task.status !== 'Concluída' && task.status !== 'Cancelada' && !isOverdue && diffDays <= 2;
                }
                
                return { ...task, isOverdue, isNearDue };
            });

            res.json(tasksWithAlerts);
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/tasks', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const { id, title, description, type, status, dueDate, assignedTo, instructions, manualAttachments, deviceId, maintenanceType, maintenanceCost, maintenanceItems, _adminUser } = req.body;
            
            await pool.request()
                .input('id', sql.NVarChar, id)
                .input('title', sql.NVarChar, title)
                .input('description', sql.NVarChar, description)
                .input('type', sql.NVarChar, type)
                .input('status', sql.NVarChar, status)
                .input('dueDate', sql.DateTime, dueDate)
                .input('assignedTo', sql.NVarChar, assignedTo)
                .input('instructions', sql.NVarChar, instructions)
                .input('manualAttachments', sql.NVarChar, manualAttachments ? JSON.stringify(manualAttachments) : null)
                .input('deviceId', sql.NVarChar, deviceId || null)
                .input('maintenanceType', sql.NVarChar, maintenanceType || null)
                .input('maintenanceCost', sql.Float, maintenanceCost || 0)
                .input('maintenanceItems', sql.NVarChar, maintenanceItems ? JSON.stringify(maintenanceItems) : null)
                .query(`INSERT INTO Tasks (Id, Title, Description, Type, Status, CreatedAt, DueDate, AssignedTo, Instructions, ManualAttachments, DeviceId, MaintenanceType, MaintenanceCost, MaintenanceItems) 
                        VALUES (@id, @title, @description, @type, @status, GETDATE(), @dueDate, @assignedTo, @instructions, @manualAttachments, @deviceId, @maintenanceType, @maintenanceCost, @maintenanceItems)`);

            // Log de Auditoria Imutável
            await pool.request()
                .input('logId', sql.NVarChar, Math.random().toString(36).substring(2, 11))
                .input('taskId', sql.NVarChar, id)
                .input('action', sql.NVarChar, 'Tarefa Criada')
                .input('adminUser', sql.NVarChar, _adminUser)
                .query("INSERT INTO TaskLogs (Id, TaskId, Action, AdminUser, Timestamp) VALUES (@logId, @taskId, @action, @adminUser, GETDATE())");

            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put('/api/tasks/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const { id } = req.params;
            
            // Buscar estado anterior para o log e para garantir que temos os dados
            const oldRes = await pool.request().input('id', sql.NVarChar, id).query("SELECT * FROM Tasks WHERE Id = @id");
            const prev = oldRes.recordset[0];
            if (!prev) return res.status(404).send('Tarefa não encontrada');

            const request = pool.request();
            let sets = [];
            const processedKeys = new Set();
            
            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                
                const val = (key === 'evidenceUrls' || key === 'manualAttachments' || key === 'maintenanceItems') ? JSON.stringify(req.body[key]) : req.body[key];
                if (val === null || val === undefined) continue;

                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                request.input(dbKey, val);
                sets.push(`${dbKey}=@${dbKey}`);
            }

            if (sets.length > 0) {
                request.input('TargetId', id);
                await request.query(`UPDATE Tasks SET ${sets.join(',')} WHERE Id=@TargetId`);
            }

            // Log de Auditoria se houver mudança de status ou nota
            const newStatus = req.body.status || prev.Status;
            const _actionNote = req.body._actionNote;
            const _adminUser = req.body._adminUser;

            if (prev.Status !== newStatus || _actionNote) {
                await pool.request()
                    .input('logId', sql.NVarChar, Math.random().toString(36).substring(2, 11))
                    .input('taskId', sql.NVarChar, id)
                    .input('action', sql.NVarChar, prev.Status !== newStatus ? `Status alterado de ${prev.Status} para ${newStatus}` : 'Tarefa Editada')
                    .input('adminUser', sql.NVarChar, _adminUser || 'Sistema')
                    .input('notes', sql.NVarChar, _actionNote || '')
                    .query("INSERT INTO TaskLogs (Id, TaskId, Action, AdminUser, Timestamp, Notes) VALUES (@logId, @taskId, @action, @adminUser, GETDATE(), @notes)");

                // v2.19.18 - Lógica de Manutenção Automática
                if (newStatus === 'Concluída' && prev.Status !== 'Concluída' && prev.Type === 'Manutenção' && prev.DeviceId) {
                    const maintenanceId = 'MNT-' + Math.random().toString(36).substring(2, 11).toUpperCase();
                    const finalCost = req.body.maintenanceCost !== undefined ? req.body.maintenanceCost : (prev.MaintenanceCost || 0);
                    const finalType = req.body.maintenanceType || prev.MaintenanceType || 'Corretiva';
                    const invoiceBuffer = req.body.maintenanceInvoice ? getBufferFromBase64(req.body.maintenanceInvoice) : null;

                    await pool.request()
                        .input('mId', sql.NVarChar, maintenanceId)
                        .input('dId', sql.NVarChar, prev.DeviceId)
                        .input('desc', sql.NVarChar, `[Tarefa #${id}] ${prev.Title}: ${prev.Description}`)
                        .input('cost', sql.Float, finalCost)
                        .input('type', sql.NVarChar, finalType)
                        .input('admin', sql.NVarChar, _adminUser || 'Sistema')
                        .input('invoice', sql.VarBinary, invoiceBuffer)
                        .query(`
                            INSERT INTO MaintenanceRecords (Id, DeviceId, Description, Cost, Date, Type, Provider, InvoiceBinary)
                            VALUES (@mId, @dId, @desc, @cost, GETDATE(), @type, @admin, @invoice)
                        `);
                }

                // v2.20.0 - Lógica de Manutenção em Lote (Checklist)
                if (req.body.maintenanceItems && prev.Type === 'Manutenção') {
                    const oldItems = prev.MaintenanceItems ? JSON.parse(prev.MaintenanceItems) : [];
                    const newItems = req.body.maintenanceItems;
                    
                    for (const newItem of newItems) {
                        const oldItem = oldItems.find(i => i.deviceId === newItem.deviceId);
                        // Se mudou para Concluído
                        if (newItem.status === 'Concluído' && (!oldItem || oldItem.status !== 'Concluído')) {
                            const maintenanceId = 'MNT-' + Math.random().toString(36).substring(2, 11).toUpperCase();
                            const invoiceBuffer = newItem.maintenanceInvoice ? getBufferFromBase64(newItem.maintenanceInvoice) : null;
                            
                            await pool.request()
                                .input('mId', sql.NVarChar, maintenanceId)
                                .input('dId', sql.NVarChar, newItem.deviceId)
                                .input('desc', sql.NVarChar, `[Tarefa #${id}] ${prev.Title} (Item: ${newItem.assetTag}): ${prev.Description}`)
                                .input('cost', sql.Float, newItem.finalCost || 0)
                                .input('type', sql.NVarChar, prev.MaintenanceType || 'Preventiva')
                                .input('admin', sql.NVarChar, _adminUser || 'Sistema')
                                .input('invoice', sql.VarBinary, invoiceBuffer)
                                .query(`
                                    INSERT INTO MaintenanceRecords (Id, DeviceId, Description, Cost, Date, Type, Provider, InvoiceBinary)
                                    VALUES (@mId, @dId, @desc, @cost, GETDATE(), @type, @admin, @invoice)
                                `);
                        }
                    }
                }
            }

            res.json({ success: true });
        } catch (err) { 
            console.error('Erro ao atualizar tarefa:', err);
            res.status(500).send(err.message); 
        }
    });

    app.get('/api/tasks/:id/logs', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id', sql.NVarChar, req.params.id)
                .query("SELECT * FROM TaskLogs WHERE TaskId = @id ORDER BY Timestamp DESC");
            res.json(format(result));
        } catch (err) { res.status(500).send(err.message); }
    });

    app.listen(PORT, () => {
        console.log(`🚀 Servidor v${packageJson.version} rodando na porta ${PORT}`);
    });
}

// Inicia o processo
initializeDatabase().then(startServer);

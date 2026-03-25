const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');

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
    ExpedienteOverrides: `(
        Id NVARCHAR(255) PRIMARY KEY,
        Codigo NVARCHAR(255) UNIQUE,
        Observation NVARCHAR(MAX),
        ReactivationDate DATETIME
    )`,
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

const format = (set, jsonKeys = []) => set.recordset.map(row => {
    const entry = {};
    for (let key in row) {
        const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
        entry[camelKey] = jsonKeys.includes(key) && row[key] ? JSON.parse(row[key]) : row[key];
    }
    return entry;
});

async function logAction(assetId, assetType, action, adminUser, targetName, notes, backupData = null, previousData = null, newData = null) {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('Id', sql.NVarChar, uuidv4())
            .input('AssetId', sql.NVarChar, assetId)
            .input('AssetType', sql.NVarChar, assetType)
            .input('Action', sql.NVarChar, action)
            .input('AdminUser', sql.NVarChar, adminUser)
            .input('TargetName', sql.NVarChar, targetName)
            .input('Notes', sql.NVarChar, notes)
            .input('BackupData', sql.NVarChar, backupData ? (typeof backupData === 'string' ? backupData : JSON.stringify(backupData)) : null)
            .input('Prev', sql.NVarChar, previousData ? (typeof previousData === 'string' ? previousData : JSON.stringify(previousData)) : null)
            .input('Next', sql.NVarChar, newData ? (typeof newData === 'string' ? newData : JSON.stringify(newData)) : null)
            .query(`INSERT INTO AuditLogs (Id, AssetId, AssetType, Action, AdminUser, TargetName, Notes, BackupData, PreviousData, NewData) VALUES (@Id, @AssetId, @AssetType, @Action, @AdminUser, @TargetName, @Notes, @BackupData, @Prev, @Next)`);
    } catch (e) { console.error('Erro de Log:', e); }
}

module.exports = {
    sql,
    dbConfig,
    DB_SCHEMAS,
    logAction,
    isBase64,
    getBufferFromBase64,
    getBase64FromBuffer,
    format
};

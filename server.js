
// Servidor express unificado com API e SPA React - v3.92.16
const express = require('express');
const packageJson = require('./package.json');
const sql = require('mssql');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
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
        CustomData NVARCHAR(MAX),
        AdditionalUserIds NVARCHAR(MAX)
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
        PendingIssuesNote NVARCHAR(MAX),
        Gender NVARCHAR(50),
        BirthDate DATETIME,
        Phone NVARCHAR(50),
        PersonalPhone NVARCHAR(50),
        City NVARCHAR(255),
        State NVARCHAR(50),
        ZipCode NVARCHAR(20),
        HireDate DATETIME,
        Notes NVARCHAR(MAX),
        Street NVARCHAR(255) NULL,
        Number NVARCHAR(50) NULL,
        Complement NVARCHAR(255) NULL,
        Neighborhood NVARCHAR(255) NULL,
        Photo NVARCHAR(MAX) NULL
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
    SystemSettings: `(Id INT PRIMARY KEY IDENTITY(1,1), AppName NVARCHAR(255), LogoUrl NVARCHAR(MAX), Cnpj NVARCHAR(50), TermTemplate NVARCHAR(MAX), AccentColor NVARCHAR(50), LicenseKey NVARCHAR(MAX), LicenseClient NVARCHAR(255), LicenseExpires DATETIME)`,
    Models: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255), BrandId NVARCHAR(255), TypeId NVARCHAR(255), ImageBinary VARBINARY(MAX))`,
    Brands: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    AssetTypes: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE, CustomFieldIds NVARCHAR(MAX), AllowMultipleUsers BIT DEFAULT 0, ShowZabbix BIT DEFAULT 0)`,
    MaintenanceRecords: `(Id NVARCHAR(255) PRIMARY KEY, DeviceId NVARCHAR(255), Description NVARCHAR(MAX), Cost FLOAT, Date DATETIME, Type NVARCHAR(100), Provider NVARCHAR(255), InvoiceBinary VARBINARY(MAX))`,
    Sectors: `(Id NVARCHAR(255) PRIMARY KEY, Name NVARCHAR(255) UNIQUE)`,
    Terms: `(
        Id NVARCHAR(255) PRIMARY KEY, 
        UserId NVARCHAR(255), 
        Type NVARCHAR(50), 
        AssetDetails NVARCHAR(MAX), 
        Date DATETIME, 
        FileBinary VARBINARY(MAX), 
        IsManual BIT DEFAULT 0, 
        ResolutionReason NVARCHAR(MAX), 
        AssetId NVARCHAR(255) NULL, 
        AssetType NVARCHAR(100) NULL,
        SignatureToken NVARCHAR(255) NULL,
        SignatureIp NVARCHAR(50) NULL,
        SignatureDate DATETIME NULL,
        SignatureLocation NVARCHAR(MAX) NULL,
        SignatureDocumentPhoto VARBINARY(MAX) NULL,
        SignatureSelfiePhoto VARBINARY(MAX) NULL,
        SignatureCanvasBinary VARBINARY(MAX) NULL,
        SignatureHash NVARCHAR(MAX) NULL,
        SnapshotTemplate NVARCHAR(MAX) NULL,
        Checklist NVARCHAR(MAX) NULL
    )`,
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
        MaintenanceItems NVARCHAR(MAX),
        HasDueDate BIT DEFAULT 0,
        IsRecurring BIT DEFAULT 0,
        RecurrenceConfig NVARCHAR(MAX)
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
    )`,
    TechnicalAudits: `(
        Id NVARCHAR(255) PRIMARY KEY,
        DeviceId NVARCHAR(255),
        Date DATETIME,
        Technician NVARCHAR(255),
        Type NVARCHAR(100),
        Description NVARCHAR(MAX),
        Observations NVARCHAR(MAX),
        Status NVARCHAR(50)
    )`,
    RhCollaborators: `(
        Id NVARCHAR(255) PRIMARY KEY,
        FullName NVARCHAR(255),
        BirthDate DATETIME,
        Gender NVARCHAR(50),
        MaritalStatus NVARCHAR(50),
        MotherName NVARCHAR(255),
        FatherName NVARCHAR(255),
        PersonalPhone NVARCHAR(50),
        CorporatePhone NVARCHAR(50),
        EmailPersonal NVARCHAR(255),
        EmailCorporate NVARCHAR(255),
        Cep NVARCHAR(20),
        Street NVARCHAR(255),
        Number NVARCHAR(50),
        Complement NVARCHAR(255),
        Neighborhood NVARCHAR(255),
        City NVARCHAR(255),
        State NVARCHAR(50),
        Rg NVARCHAR(50),
        Cpf NVARCHAR(50) UNIQUE,
        Pis NVARCHAR(50),
        ElectorTitle NVARCHAR(50),
        Ctps NVARCHAR(50),
        CnhNumber NVARCHAR(50),
        CnhCategory NVARCHAR(50),
        CnhExpiration DATETIME,
        Role NVARCHAR(255),
        SectorId NVARCHAR(255),
        ContractType NVARCHAR(50),
        HireDate DATETIME,
        TerminationDate DATETIME,
        Salary FLOAT,
        WeeklyHours FLOAT,
        Status NVARCHAR(50) DEFAULT 'Ativo',
        Documents NVARCHAR(MAX),
        Photo NVARCHAR(MAX)
    )`,
    RhOccurrences: `(
        Id NVARCHAR(255) PRIMARY KEY,
        CollaboratorId NVARCHAR(255),
        Type NVARCHAR(100),
        StartDate DATETIME,
        EndDate DATETIME,
        DaysCount INT,
        Cid NVARCHAR(50),
        Crm NVARCHAR(100),
        Notes NVARCHAR(MAX),
        FileUrl NVARCHAR(MAX)
    )`,
    RhTermTemplates: `(
        Id NVARCHAR(255) PRIMARY KEY,
        Name NVARCHAR(255),
        Content NVARCHAR(MAX),
        Type NVARCHAR(50),
        Declaration NVARCHAR(MAX),
        DeliveryDeclaration NVARCHAR(MAX),
        DeliveryClauses NVARCHAR(MAX),
        ReturnDeclaration NVARCHAR(MAX),
        ReturnClauses NVARCHAR(MAX)
    )`,
    RhTerms: `(
        Id NVARCHAR(255) PRIMARY KEY,
        CollaboratorId NVARCHAR(255),
        TemplateId NVARCHAR(255),
        AssetDetails NVARCHAR(MAX),
        Date DATETIME,
        Status NVARCHAR(50),
        FileUrl NVARCHAR(MAX) NULL,
        SignatureToken NVARCHAR(255) NULL,
        SignatureIp NVARCHAR(50) NULL,
        SignatureDate DATETIME NULL,
        SignatureLocation NVARCHAR(MAX) NULL,
        SignatureHash NVARCHAR(MAX) NULL,
        SignatureStatus NVARCHAR(50) NULL,
        SignatureCanvasBinary VARBINARY(MAX) NULL,
        SignatureDocumentPhoto VARBINARY(MAX) NULL,
        SignatureSelfiePhoto VARBINARY(MAX) NULL,
        FileBinary VARBINARY(MAX) NULL,
        IsManual BIT DEFAULT 0 NULL,
        ResolutionReason NVARCHAR(MAX) NULL,
        Notes NVARCHAR(MAX) NULL,
        Type NVARCHAR(50) NULL,
        SnapshotDeclaration NVARCHAR(MAX) NULL,
        SnapshotClauses NVARCHAR(MAX) NULL,
        DeliveredItems NVARCHAR(MAX) NULL
    )`,
    RhAssetItems: `(
        Id NVARCHAR(255) PRIMARY KEY,
        Name NVARCHAR(255),
        Type NVARCHAR(50),
        TotalStock INT,
        CurrentStock INT,
        MinStock INT,
        Notes NVARCHAR(MAX)
    )`,
    RhDocuments: `(
        Id NVARCHAR(255) PRIMARY KEY,
        CollaboratorId NVARCHAR(255),
        DocumentType NVARCHAR(100),
        Category NVARCHAR(100),
        Title NVARCHAR(255),
        FileName NVARCHAR(255),
        FileBinary NVARCHAR(MAX),
        UploadDate DATETIME DEFAULT GETDATE(),
        ReferencePeriod NVARCHAR(50),
        Institution NVARCHAR(255),
        AcademicStatus NVARCHAR(50),
        Notes NVARCHAR(MAX)
    )`,
    RhCareerHistory: `(
        Id NVARCHAR(255) PRIMARY KEY,
        CollaboratorId NVARCHAR(255),
        PreviousRole NVARCHAR(255),
        NewRole NVARCHAR(255),
        PreviousSalary FLOAT,
        NewSalary FLOAT,
        ChangeDate DATETIME DEFAULT GETDATE(),
        Reason NVARCHAR(MAX),
        AdminUser NVARCHAR(255)
    )`,
    RbacProfiles: `(
        ID_Perfil INT PRIMARY KEY IDENTITY(1,1),
        Nome NVARCHAR(255) NOT NULL,
        Ativo BIT DEFAULT 1,
        Permissoes NVARCHAR(MAX) NULL
    )`,
    FuelGrupos: `(
        ID_Grupo INT IDENTITY(1,1) PRIMARY KEY,
        Nome NVARCHAR(100) UNIQUE NOT NULL,
        DataCriacao DATETIME DEFAULT GETDATE()
    )`,
    FuelColaboradores: `(
        ID_Colaborador INT IDENTITY(1,1) PRIMARY KEY,
        ID_Pulsus INT UNIQUE NOT NULL, 
        CodigoSetor INT NOT NULL,
        Nome NVARCHAR(200) NOT NULL,
        Grupo NVARCHAR(100) NOT NULL, 
        TipoVeiculo NVARCHAR(50),
        Ativo BIT DEFAULT 1,
        EnderecoBase NVARCHAR(MAX),
        LatitudeBase DECIMAL(12, 9),
        LongitudeBase DECIMAL(12, 9),
        EnderecoPendente BIT DEFAULT 0,
        DataCriacao DATETIME DEFAULT GETDATE()
    )`,
    FuelUsuarios: `(
        ID_Usuario INT IDENTITY(1,1) PRIMARY KEY,
        Nome NVARCHAR(200) NOT NULL,
        Usuario NVARCHAR(100) UNIQUE NOT NULL,
        SenhaHash NVARCHAR(MAX) NOT NULL,
        Perfil NVARCHAR(50) DEFAULT 'Admin',
        Ativo BIT DEFAULT 1
    )`,
    FuelSystemSettings: `(
        ID INT PRIMARY KEY CHECK (ID = 1),
        CompanyName NVARCHAR(200) DEFAULT 'Fuel360 Enterprise',
        LogoUrl NVARCHAR(MAX),
        FuelPrice DECIMAL(10, 4) DEFAULT 5.89,
        KmL_Car INT DEFAULT 10,
        KmL_Moto INT DEFAULT 35,
        Alert_MaxDailyKM INT DEFAULT 400,
        Alert_MaxClientDist INT DEFAULT 100,
        LicenseKey NVARCHAR(MAX),
        LicenseClient NVARCHAR(200),
        LicenseExpires DATETIME
    )`,
    FuelReembolsoHistorico: `(
        ID_Historico INT IDENTITY(1,1) PRIMARY KEY,
        Periodo NVARCHAR(100) NOT NULL,
        DataFechamento DATETIME DEFAULT GETDATE(),
        TotalGeral DECIMAL(18, 2) NOT NULL,
        UsuarioFechamento NVARCHAR(100),
        OrigemDados NVARCHAR(50) DEFAULT 'CSV',
        MotivoEdicao NVARCHAR(MAX),
        ID_RotaHist INT
    )`,
    FuelReembolsoDetalhe: `(
        ID_Detalhe INT IDENTITY(1,1) PRIMARY KEY,
        ID_Historico INT NOT NULL,
        ID_Pulsus INT NOT NULL,
        NomeColaborador NVARCHAR(200),
        Grupo NVARCHAR(100),
        TipoVeiculo NVARCHAR(50),
        TotalKM DECIMAL(18, 4),
        ValorReembolso DECIMAL(18, 2),
        ParametroPreco DECIMAL(10, 4),
        ParametroKmL INT,
        Efetividade DECIMAL(5, 4),
        Ajuste DECIMAL(18, 2) DEFAULT 0
    )`,
    FuelReembolsoDiario: `(
        ID_Diario INT IDENTITY(1,1) PRIMARY KEY,
        ID_Detalhe INT NOT NULL,
        DataOcorrencia DATE NOT NULL,
        KM_Dia DECIMAL(18, 4),
        Valor_Dia DECIMAL(18, 2),
        Observacao NVARCHAR(MAX)
    )`,
    FuelAusencias: `(
        ID_Ausencia INT IDENTITY(1,1) PRIMARY KEY,
        ID_Colaborador INT NOT NULL,
        DataInicio DATE NOT NULL,
        DataFim DATE NOT NULL,
        Motivo NVARCHAR(200) NOT NULL
    )`,
    FuelLogsSistema: `(
        ID_Log INT IDENTITY(1,1) PRIMARY KEY,
        DataHora DATETIME DEFAULT GETDATE(),
        Usuario NVARCHAR(100),
        Acao NVARCHAR(100),
        Detalhes NVARCHAR(MAX)
    )`
};

async function createIndexes(pool) {
    console.log('Verificando índices do banco de dados...');
    const indexes = [
        { table: 'Devices', column: 'Status', name: 'IX_Devices_Status' },
        { table: 'Devices', column: 'ModelId', name: 'IX_Devices_ModelId' },
        { table: 'Devices', column: 'CurrentUserId', name: 'IX_Devices_CurrentUserId' },
        { table: 'Devices', column: 'SectorId', name: 'IX_Devices_SectorId' },
        { table: 'Devices', column: 'LinkedSimId', name: 'IX_Devices_LinkedSimId' },
        { table: 'Tasks', column: 'Status', name: 'IX_Tasks_Status' },
        { table: 'Tasks', column: 'AssignedTo', name: 'IX_Tasks_AssignedTo' },
        { table: 'Tasks', column: 'DeviceId', name: 'IX_Tasks_DeviceId' },
        { table: 'Users', column: 'Active', name: 'IX_Users_Active' },
        { table: 'Users', column: 'SectorId', name: 'IX_Users_SectorId' },
        { table: 'SimCards', column: 'Status', name: 'IX_SimCards_Status' },
        { table: 'SimCards', column: 'Operator', name: 'IX_SimCards_Operator' }
    ];

    for (const idx of indexes) {
        try {
            const checkQuery = `
                SELECT * FROM sys.indexes 
                WHERE name = '${idx.name}' AND object_id = OBJECT_ID('${idx.table}')
            `;
            const checkRes = await pool.request().query(checkQuery);
            if (checkRes.recordset.length === 0) {
                console.log(`- Criando índice ${idx.name} na tabela ${idx.table}...`);
                await pool.request().query(`CREATE INDEX ${idx.name} ON ${idx.table} (${idx.column})`);
            }
        } catch (err) {
            console.error(`Erro ao criar índice ${idx.name}:`, err.message);
        }
    }
    console.log('Verificação de índices concluída.');
}

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

                    
                    const checkZabbix = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'ZabbixHostId'`);
                    if (checkZabbix.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE Devices ADD ZabbixHostId NVARCHAR(255) NULL');
                    }
                    const checkShared = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'AdditionalUserIds'`);

                    if (checkShared.recordset.length === 0) {
                        console.log(`- Coluna AdditionalUserIds não encontrada em Devices. Adicionando...`);
                        await pool.request().query('ALTER TABLE Devices ADD AdditionalUserIds NVARCHAR(MAX) NULL');
                    }

                    // Cleanup legacy columns
                    const checkLegacy = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'PurchaseInvoiceUrl'`);
                    if (checkLegacy.recordset.length > 0) {
                        console.log('- Removendo coluna legada PurchaseInvoiceUrl de Devices...');
                        await pool.request().query('ALTER TABLE Devices DROP COLUMN PurchaseInvoiceUrl');
                    }
                }
                
                
                if (table === 'SystemSettings') {
                    const checkZUrl = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SystemSettings' AND COLUMN_NAME = 'ZabbixUrl'`);
                    if (checkZUrl.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE SystemSettings ADD ZabbixUrl NVARCHAR(MAX) NULL');
                    }
                    const checkZToken = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SystemSettings' AND COLUMN_NAME = 'ZabbixToken'`);
                    if (checkZToken.recordset.length === 0) {
                        await pool.request().query('ALTER TABLE SystemSettings ADD ZabbixToken NVARCHAR(MAX) NULL');
                    }
                }
                
                if (table === 'Terms') {
                    const columnsNeeded = [
                        { name: 'SignatureToken', type: 'NVARCHAR(255) NULL' },
                        { name: 'SignatureIp', type: 'NVARCHAR(50) NULL' },
                        { name: 'SignatureDate', type: 'DATETIME NULL' },
                        { name: 'SignatureLocation', type: 'NVARCHAR(MAX) NULL' },
                        { name: 'SignatureDocumentPhoto', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureCanvasBinary', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureHash', type: 'NVARCHAR(MAX) NULL' },
                        { name: 'SnapshotTemplate', type: 'NVARCHAR(MAX) NULL' },
                        { name: 'Checklist', type: 'NVARCHAR(MAX) NULL' }
                    ];

                    for (const col of columnsNeeded) {
                        try {
                            const check = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = '${col.name}'`);
                            if (check.recordset.length === 0) {
                                console.log(`- Adicionando coluna ${col.name} em Terms...`);
                                await pool.request().query(`ALTER TABLE Terms ADD ${col.name} ${col.type}`);
                            }
                        } catch (err) {
                            console.error(`Erro ao adicionar coluna ${col.name} em Terms:`, err.message);
                        }
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

                    // v3.26.4 - Novos campos de colaboradores
                    const checkCols = await pool.request().query(`
                        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_NAME = 'Users' AND COLUMN_NAME IN ('Gender', 'BirthDate', 'Phone', 'PersonalPhone', 'City', 'State', 'ZipCode', 'HireDate', 'Notes')
                    `);
                    const existingCols = checkCols.recordset.map(r => r.COLUMN_NAME);
                    const colsToAdd = [
                        { name: 'Gender', type: 'NVARCHAR(50)' },
                        { name: 'BirthDate', type: 'DATETIME' },
                        { name: 'Phone', type: 'NVARCHAR(50)' },
                        { name: 'PersonalPhone', type: 'NVARCHAR(50)' },
                        { name: 'City', type: 'NVARCHAR(255)' },
                        { name: 'State', type: 'NVARCHAR(50)' },
                        { name: 'ZipCode', type: 'NVARCHAR(20)' },
                        { name: 'HireDate', type: 'DATETIME' },
                        { name: 'Notes', type: 'NVARCHAR(MAX)' },
                        { name: 'Street', type: 'NVARCHAR(255)' },
                        { name: 'Number', type: 'NVARCHAR(50)' },
                        { name: 'Complement', type: 'NVARCHAR(255)' },
                        { name: 'Neighborhood', type: 'NVARCHAR(255)' }
                    ];

                    for (const col of colsToAdd) {
                        if (!existingCols.includes(col.name)) {
                            console.log(`- Adicionando coluna ${col.name} em Users...`);
                            await pool.request().query(`ALTER TABLE Users ADD ${col.name} ${col.type} NULL`);
                        }
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

                    const checkAcc = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'Accessories'`);
                    if (checkAcc.recordset.length === 0) {
                        console.log('- Adicionando coluna Accessories em Terms...');
                        await pool.request().query('ALTER TABLE Terms ADD Accessories NVARCHAR(MAX) NULL');
                    }

                    const checkSimData = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'LinkedSimData'`);
                    if (checkSimData.recordset.length === 0) {
                        console.log('- Adicionando coluna LinkedSimData em Terms...');
                        await pool.request().query('ALTER TABLE Terms ADD LinkedSimData NVARCHAR(MAX) NULL');
                    }

                    const checkAssetRef = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = 'AssetId'`);
                    if (checkAssetRef.recordset.length === 0) {
                        console.log('- Adicionando colunas AssetId e AssetType em Terms...');
                        await pool.request().query('ALTER TABLE Terms ADD AssetId NVARCHAR(255) NULL, AssetType NVARCHAR(100) NULL');
                    }

                    // v3.36.0 - Colunas para Assinatura Digital (Granular)
                    const signatureCols = [
                        { name: 'SignatureToken', type: 'NVARCHAR(255) NULL' },
                        { name: 'SignatureIp', type: 'NVARCHAR(50) NULL' },
                        { name: 'SignatureDate', type: 'DATETIME NULL' },
                        { name: 'SignatureLocation', type: 'NVARCHAR(MAX) NULL' },
                        { name: 'SignatureDocumentPhoto', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureSelfiePhoto', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureCanvasBinary', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureHash', type: 'NVARCHAR(MAX) NULL' },
                        { name: 'SignatureStatus', type: "NVARCHAR(50) NULL" }
                    ];

                    for (const col of signatureCols) {
                        const checkCol = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Terms' AND COLUMN_NAME = '${col.name}'`);
                        if (checkCol.recordset.length === 0) {
                            console.log(`- Adicionando coluna faltante ${col.name} em Terms...`);
                            await pool.request().query(`ALTER TABLE Terms ADD ${col.name} ${col.type}`);
                        }
                    }
                    
                    // Migração: Remover default e corrigir status
                    try {
                        const defaultCols = await pool.request().query(`
                            SELECT d.name 
                            FROM sys.default_constraints d 
                            INNER JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id 
                            WHERE d.parent_object_id = OBJECT_ID('Terms') AND c.name = 'SignatureStatus'
                        `);
                        if (defaultCols.recordset.length > 0) {
                            await pool.request().query(`ALTER TABLE Terms DROP CONSTRAINT ${defaultCols.recordset[0].name}`);
                        }
                    } catch (e) {
                        console.log('Erro ignorado de constraint:', e);
                    }
                    
                    await pool.request().query("UPDATE Terms SET SignatureStatus = NULL WHERE SignatureDate IS NULL AND SignatureStatus = 'WAITING_APPROVAL'");
                }

                if (table === 'RhTerms') {
                    const rhColumnsNeeded = [
                        { name: 'SignatureToken', type: 'NVARCHAR(255) NULL' },
                        { name: 'SignatureIp', type: 'NVARCHAR(50) NULL' },
                        { name: 'SignatureDate', type: 'DATETIME NULL' },
                        { name: 'SignatureLocation', type: 'NVARCHAR(MAX) NULL' },
                        { name: 'SignatureDocumentPhoto', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureSelfiePhoto', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureCanvasBinary', type: 'VARBINARY(MAX) NULL' },
                        { name: 'SignatureHash', type: 'NVARCHAR(MAX) NULL' },
                        { name: 'SignatureStatus', type: 'NVARCHAR(50) NULL' },
                        { name: 'FileBinary', type: 'VARBINARY(MAX) NULL' },
                        { name: 'IsManual', type: 'BIT DEFAULT 0 NULL' },
                        { name: 'ResolutionReason', type: 'NVARCHAR(MAX) NULL' }
                    ];

                    for (const col of rhColumnsNeeded) {
                        try {
                            const check = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RhTerms' AND COLUMN_NAME = '${col.name}'`);
                            if (check.recordset.length === 0) {
                                console.log(`- Adicionando coluna ${col.name} em RhTerms...`);
                                await pool.request().query(`ALTER TABLE RhTerms ADD ${col.name} ${col.type}`);
                            }
                        } catch (err) {
                            console.error(`Erro ao adicionar coluna ${col.name} em RhTerms:`, err.message);
                        }
                    }

                    // v3.92.17: Auto-migração defensiva para colunas Photo como NVARCHAR(MAX) (Base64 puro)
                    try {
                        // Garantia da coluna Photo em Users como NVARCHAR(MAX)
                        await pool.request().query(`
                            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Users' AND COLUMN_NAME='Photo')
                            BEGIN
                                ALTER TABLE Users ADD Photo NVARCHAR(MAX) NULL;
                            END
                            ELSE
                            BEGIN
                                ALTER TABLE Users ALTER COLUMN Photo NVARCHAR(MAX) NULL;
                            END
                        `);

                        // Se RhCollaborators tiver Photo como VARBINARY, dropamos e recriamos como NVARCHAR(MAX)
                        const checkRhType = await pool.request().query("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='RhCollaborators' AND COLUMN_NAME='Photo'");
                        if (checkRhType.recordset.length > 0) {
                            const dataType = checkRhType.recordset[0].DATA_TYPE.toLowerCase();
                            if (dataType === 'varbinary' || dataType === 'image') {
                                console.log('- Convertendo coluna Photo de RhCollaborators de VARBINARY para NVARCHAR(MAX)...');
                                await pool.request().query("ALTER TABLE RhCollaborators DROP COLUMN Photo");
                                await pool.request().query("ALTER TABLE RhCollaborators ADD Photo NVARCHAR(MAX) NULL");
                            } else {
                                await pool.request().query("ALTER TABLE RhCollaborators ALTER COLUMN Photo NVARCHAR(MAX) NULL");
                            }
                        } else {
                            await pool.request().query("ALTER TABLE RhCollaborators ADD Photo NVARCHAR(MAX) NULL");
                        }
                    } catch (pErr) {
                        console.error('Auto-migração de Photo ignorada:', pErr.message);
                    }
                }
                if (table === 'AssetTypes') {
                    const checkAllow = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AssetTypes' AND COLUMN_NAME = 'AllowMultipleUsers'`);
                    if (checkAllow.recordset.length === 0) {
                        console.log(`- Coluna AllowMultipleUsers não encontrada em AssetTypes. Adicionando...`);
                        await pool.request().query('ALTER TABLE AssetTypes ADD AllowMultipleUsers BIT DEFAULT 0');
                    }
                    const checkZabbix = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AssetTypes' AND COLUMN_NAME = 'ShowZabbix'`);
                    if (checkZabbix.recordset.length === 0) {
                        console.log(`- Coluna ShowZabbix não encontrada em AssetTypes. Adicionando...`);
                        await pool.request().query('ALTER TABLE AssetTypes ADD ShowZabbix BIT DEFAULT 0');
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

                    const checkHasDueDate = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'HasDueDate'`);
                    if (checkHasDueDate.recordset.length === 0) {
                        console.log(`- Coluna HasDueDate não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD HasDueDate BIT DEFAULT 0 NULL');
                    }

                    const checkIsRecurring = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'IsRecurring'`);
                    if (checkIsRecurring.recordset.length === 0) {
                        console.log(`- Coluna IsRecurring não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD IsRecurring BIT DEFAULT 0 NULL');
                    }

                    const checkRecurrenceConfig = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'RecurrenceConfig'`);
                    if (checkRecurrenceConfig.recordset.length === 0) {
                        console.log(`- Coluna RecurrenceConfig não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD RecurrenceConfig NVARCHAR(MAX) NULL');
                    }
                }
                if (table === 'RhCollaborators') {
                    const checkStatus = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RhCollaborators' AND COLUMN_NAME = 'Status'`);
                    if (checkStatus.recordset.length === 0) {
                        console.log(`- Coluna Status não encontrada em RhCollaborators. Adicionando...`);
                        await pool.request().query("ALTER TABLE RhCollaborators ADD Status NVARCHAR(50) DEFAULT 'Ativo'");
                    }
                    const checkReason = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RhCollaborators' AND COLUMN_NAME = 'TerminationReason'`);
                    if (checkReason.recordset.length === 0) {
                        console.log(`- Coluna TerminationReason não encontrada em RhCollaborators. Adicionando...`);
                        await pool.request().query("ALTER TABLE RhCollaborators ADD TerminationReason NVARCHAR(MAX) NULL");
                    }
                    const checkPhoto = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RhCollaborators' AND COLUMN_NAME = 'Photo'`);
                    if (checkPhoto.recordset.length === 0) {
                        console.log(`- Coluna Photo não encontrada em RhCollaborators. Adicionando...`);
                        await pool.request().query("ALTER TABLE RhCollaborators ADD Photo NVARCHAR(MAX) NULL");
                    }
                }
            }
        }

        // --- CONSUMABLES TABLES ---
        const checkConsumables = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Consumables'");
        if (checkConsumables.recordset.length === 0) {
            console.log('- Criando tabela Consumables...');
            await pool.request().query(`
                CREATE TABLE Consumables (
                    Id NVARCHAR(255) PRIMARY KEY,
                    Name NVARCHAR(255) NOT NULL,
                    Category NVARCHAR(100) NOT NULL,
                    CurrentStock INT DEFAULT 0,
                    MinStock INT DEFAULT 0,
                    Unit NVARCHAR(50) NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE()
                )
            `);
        }

        const checkConsumableTransactions = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ConsumableTransactions'");
        if (checkConsumableTransactions.recordset.length === 0) {
            console.log('- Criando tabela ConsumableTransactions...');
            await pool.request().query(`
                CREATE TABLE ConsumableTransactions (
                    Id NVARCHAR(255) PRIMARY KEY,
                    ConsumableId NVARCHAR(255) FOREIGN KEY REFERENCES Consumables(Id) ON DELETE CASCADE,
                    Type NVARCHAR(50) NOT NULL,
                    Quantity INT NOT NULL,
                    Date DATETIME DEFAULT GETDATE(),
                    AdminUser NVARCHAR(255),
                    Notes NVARCHAR(MAX)
                )
            `);
        }

        const checkPrinterPageHistory = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PrinterPageHistory'");
        if (checkPrinterPageHistory.recordset.length === 0) {
            console.log('- Criando tabela PrinterPageHistory...');
            await pool.request().query(`
                CREATE TABLE PrinterPageHistory (
                    Id NVARCHAR(255) PRIMARY KEY,
                    DeviceId NVARCHAR(255) NOT NULL,
                    ZabbixHostId NVARCHAR(255) NOT NULL,
                    PageCount INT NOT NULL,
                    Date DATE NOT NULL,
                    Timestamp DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UC_PrinterPage UNIQUE (DeviceId, Date)
                )
            `);
        }

        // Garante que a tabela de settings tenha pelo menos uma linha
        const settingsCheck = await pool.request().query('SELECT COUNT(*) as count FROM SystemSettings');
        if (settingsCheck.recordset[0].count === 0) {
            console.log('- Populando SystemSettings com valores padrão...');
            const SYSTEM_VERSION = '3.79.1';
            await pool.request().query("INSERT INTO SystemSettings (AppName, LogoUrl, AccentColor) VALUES ('IT Asset 360', '', '#2563eb')");
        } else {
            // Verifica se a coluna AccentColor existe
            const checkAccent = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SystemSettings' AND COLUMN_NAME = 'AccentColor'`);
            if (checkAccent.recordset.length === 0) {
                console.log('- Adicionando coluna AccentColor em SystemSettings...');
                await pool.request().query("ALTER TABLE SystemSettings ADD AccentColor NVARCHAR(50) DEFAULT '#2563eb'");
            }

            // Verifica colunas de licenciamento
            const checkLicense = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SystemSettings' AND COLUMN_NAME = 'LicenseKey'`);
            if (checkLicense.recordset.length === 0) {
                console.log('- Adicionando colunas de licenciamento em SystemSettings...');
                await pool.request().query("ALTER TABLE SystemSettings ADD LicenseKey NVARCHAR(MAX) NULL, LicenseClient NVARCHAR(255) NULL, LicenseExpires DATETIME NULL");
            }
        }

        // Garante que exista pelo menos um usuário administrador
        const userCheck = await pool.request().query('SELECT COUNT(*) as count FROM SystemUsers');
        if (userCheck.recordset[0].count === 0) {
            console.log('- Criando usuário administrador padrão...');
            const adminId = 'admin-' + Date.now();
            const hashedAdminPass = await bcrypt.hash('admin', 10);
            await pool.request()
                .input('id', sql.NVarChar, adminId)
                .input('name', sql.NVarChar, 'Administrador')
                .input('email', sql.NVarChar, 'admin@admin')
                .input('pass', sql.NVarChar, hashedAdminPass)
                .input('role', sql.NVarChar, 'admin')
                .query("INSERT INTO SystemUsers (Id, Name, Email, Password, Role) VALUES (@id, @name, @email, @pass, @role)");
            console.log('  ... Usuário admin@admin criado (Senha: admin — armazenada com bcrypt).');
        }

        // Migração RH: Colunas de Empresa, Veículo e Benefício em RhCollaborators
        const rhCollsCols = [
            { name: 'CompanyCnpj', type: 'NVARCHAR(255) NULL' },
            { name: 'HasVehicle', type: 'NVARCHAR(50) NULL' },
            { name: 'VehicleType', type: 'NVARCHAR(100) NULL' },
            { name: 'VehiclePlate', type: 'NVARCHAR(50) NULL' },
            { name: 'TransportOption', type: 'NVARCHAR(100) NULL' }
        ];

        for (const col of rhCollsCols) {
            try {
                const check = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RhCollaborators' AND COLUMN_NAME = '${col.name}'`);
                if (check.recordset.length === 0) {
                    console.log(`- Adicionando coluna ${col.name} em RhCollaborators...`);
                    await pool.request().query(`ALTER TABLE RhCollaborators ADD ${col.name} ${col.type}`);
                }
            } catch (colErr) {
                console.error(`Erro ao adicionar coluna ${col.name} em RhCollaborators:`, colErr.message);
            }
        }

        // Garantir coluna Permissoes em SystemUsers
        try {
            const checkPerms = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SystemUsers' AND COLUMN_NAME = 'Permissoes'");
            if (checkPerms.recordset.length === 0) {
                console.log('- Adicionando coluna Permissoes em SystemUsers...');
                await pool.request().query("ALTER TABLE SystemUsers ADD Permissoes NVARCHAR(MAX) NULL");
            }
        } catch (pErr) {
            console.error('Erro ao verificar/adicionar coluna Permissoes em SystemUsers:', pErr.message);
        }

        // Tabela RhDependents
        const checkRhDependents = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RhDependents'");
        if (checkRhDependents.recordset.length === 0) {
            console.log('- Criando tabela RhDependents...');
            await pool.request().query(`
                CREATE TABLE RhDependents (
                    Id NVARCHAR(255) PRIMARY KEY,
                    CollaboratorId NVARCHAR(255) NOT NULL,
                    Name NVARCHAR(255) NOT NULL,
                    RelationshipType NVARCHAR(100) NOT NULL,
                    Cpf NVARCHAR(50) NULL,
                    BirthDate NVARCHAR(50) NULL,
                    Notes NVARCHAR(500) NULL,
                    CreatedAt DATETIME DEFAULT GETDATE()
                )
            `);
        }

        // Garante que a tabela de ExternalDbConfig tenha pelo menos uma linha
        const extDbCheck = await pool.request().query('SELECT COUNT(*) as count FROM ExternalDbConfig');
        if (extDbCheck.recordset[0].count === 0) {
            console.log('- Inicializando ExternalDbConfig...');
            await pool.request().query("INSERT INTO ExternalDbConfig (Technology) VALUES ('SQL Server')");
        }

        // Migração Retroativa: Preenche SnapshotTemplate de termos legados de T.I. com o template atual das configurações
        try {
            console.log('- Verificando termos legados sem snapshot de template...');
            const countRes = await pool.request().query("SELECT COUNT(*) as count FROM Terms WHERE SnapshotTemplate IS NULL");
            const legacyCount = countRes.recordset[0]?.count || 0;
            if (legacyCount > 0) {
                console.log(`  ... Encontrados ${legacyCount} termos legados. Iniciando migração...`);
                const migrateRes = await pool.request().query(`
                    UPDATE Terms 
                    SET SnapshotTemplate = (SELECT TOP 1 TermTemplate FROM SystemSettings) 
                    WHERE SnapshotTemplate IS NULL
                `);
                console.log(`  ... Migração concluída. ${migrateRes.rowsAffected[0]} termos legados atualizados com o snapshot do template atual.`);
            } else {
                console.log('  ... Todos os termos já possuem snapshot de template.');
            }
        } catch (migErr) {
            console.error('AVISO: Falha na migração dos termos legados:', migErr.message);
        }

        // Garante população inicial dos Perfis de Acesso (RBAC) caso a tabela esteja vazia
        try {
            const checkRbac = await pool.request().query("SELECT COUNT(*) as count FROM RbacProfiles");
            if (checkRbac.recordset[0]?.count === 0) {
                console.log('- Populando RbacProfiles com perfis padrão...');
                await pool.request().query(`
                    SET IDENTITY_INSERT RbacProfiles ON;
                    INSERT INTO RbacProfiles (ID_Perfil, Nome, Ativo, Permissoes) VALUES 
                    (1, 'Administrador TI', 1, '{"admin":true}'),
                    (2, 'Operador Suporte', 1, '{"dashboard_leitura":true,"dispositivos_leitura":true,"dispositivos_escrita":true,"colaboradores_leitura":true,"colaboradores_escrita":true,"ativos_leitura":true,"ativos_escrita":false,"financeiro_leitura":true}'),
                    (3, 'Gestor de R.H.', 1, '{"rh_dashboard":true,"rh_dashboard_leitura":true,"rh_dashboard_escrita":true,"rh_colaboradores":true,"rh_colaboradores_leitura":true,"rh_colaboradores_escrita":true,"rh_comodatos":true,"rh_comodato_leitura":true,"rh_comodato_escrita":true,"rh_atestados":true,"rh_ocorrencias_leitura":true,"rh_ocorrencias_escrita":true,"rh_modelos":true,"rh_modelos_leitura":true,"rh_modelos_escrita":true,"rh_ativos":true,"rh_estoque_leitura":true,"rh_estoque_escrita":true,"rh_relatorios":true,"rh_relatorios_leitura":true,"rh_relatorios_escrita":true}');
                    SET IDENTITY_INSERT RbacProfiles OFF;
                `);
                console.log('  ... Perfis padrão RBAC inseridos com sucesso.');
            }
        } catch (rbacSeedErr) {
            console.error('AVISO: Falha ao popular RbacProfiles:', rbacSeedErr.message);
        }

        // Inicialização de Tabelas do Módulo Fuel360
        try {
            console.log('- Verificando e criando tabelas do Módulo Fuel360...');
            
            const checkGrupos = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelGrupos'");
            if (checkGrupos.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelGrupos (
                        ID_Grupo INT IDENTITY(1,1) PRIMARY KEY,
                        Nome NVARCHAR(255) NOT NULL UNIQUE
                    )
                `);
            }

            const checkColab = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelColaboradores'");
            if (checkColab.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelColaboradores (
                        ID_Colaborador INT IDENTITY(1,1) PRIMARY KEY,
                        ID_Pulsus INT NULL,
                        CodigoSetor INT NULL,
                        Nome NVARCHAR(255) NOT NULL,
                        Grupo NVARCHAR(255) NOT NULL,
                        TipoVeiculo NVARCHAR(50) DEFAULT 'Carro',
                        Ativo BIT DEFAULT 1
                    )
                `);
            }

            const checkAusencias = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelAusencias'");
            if (checkAusencias.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelAusencias (
                        ID_Ausencia INT IDENTITY(1,1) PRIMARY KEY,
                        ID_Colaborador INT NOT NULL,
                        DataInicio DATE NOT NULL,
                        DataFim DATE NOT NULL,
                        Motivo NVARCHAR(255) NOT NULL
                    )
                `);
            }

            const checkFuelSettings = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelSystemSettings'");
            if (checkFuelSettings.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelSystemSettings (
                        ID INT PRIMARY KEY DEFAULT 1,
                        FuelPrice DECIMAL(10,2) DEFAULT 5.89,
                        KmL_Car DECIMAL(10,2) DEFAULT 10.00,
                        KmL_Moto DECIMAL(10,2) DEFAULT 35.00
                    );
                    INSERT INTO FuelSystemSettings (ID, FuelPrice, KmL_Car, KmL_Moto) VALUES (1, 5.89, 10.00, 35.00);
                `);
            }

            const checkReembHist = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelReembolsoHistorico'");
            if (checkReembHist.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelReembolsoHistorico (
                        ID_Fechamento INT IDENTITY(1,1) PRIMARY KEY,
                        Periodo NVARCHAR(50) NOT NULL UNIQUE,
                        DataFechamento DATETIME DEFAULT GETDATE(),
                        TotalKmTotal DECIMAL(10,2),
                        TotalKmReembolsavel DECIMAL(10,2),
                        TotalValorReembolso DECIMAL(10,2)
                    )
                `);
            }

            const checkReembDet = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelReembolsoDetalhe'");
            if (checkReembDet.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelReembolsoDetalhe (
                        ID_Detalhe INT IDENTITY(1,1) PRIMARY KEY,
                        ID_Fechamento INT NOT NULL,
                        ID_Colaborador INT NOT NULL,
                        Nome NVARCHAR(255),
                        Grupo NVARCHAR(255),
                        TipoVeiculo NVARCHAR(50),
                        DiasTrabalhados INT,
                        KmRodadoTotal DECIMAL(10,2),
                        KmRodadoReembolsavel DECIMAL(10,2),
                        ValorReembolso DECIMAL(10,2)
                    )
                `);
            }

            const checkReembDiario = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelReembolsoDiario'");
            if (checkReembDiario.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelReembolsoDiario (
                        ID_Diario INT IDENTITY(1,1) PRIMARY KEY,
                        ID_Fechamento INT NOT NULL,
                        ID_Colaborador INT NOT NULL,
                        Data DATE NOT NULL,
                        KmRodadoTotal DECIMAL(10,2),
                        KmRodadoReembolsavel DECIMAL(10,2),
                        Ausente BIT DEFAULT 0,
                        MotivoAusencia NVARCHAR(255) NULL
                    )
                `);
            }

            const checkFuelLogs = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelLogsSistema'");
            if (checkFuelLogs.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE FuelLogsSistema (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        DataHora DATETIME DEFAULT GETDATE(),
                        Usuario NVARCHAR(255) DEFAULT 'Sistema',
                        Acao NVARCHAR(255) NOT NULL,
                        Detalhes NVARCHAR(MAX) NULL
                    )
                `);
            }
            console.log('  ... Tabelas do Módulo Fuel360 inicializadas.');
        } catch (fuelTableErr) {
            console.error('AVISO: Falha ao inicializar tabelas do Fuel360:', fuelTableErr.message);
        }

        await createIndexes(pool);

        console.log('Banco de dados pronto.');
    } catch (err) {
        console.error('AVISO: Falha na conexão com o banco de dados. O sistema funcionará em modo limitado ou Mock.');
        console.error('Detalhe do erro:', err.message);
        // NÃO encerra o processo (removido process.exit(1))
    }
}

async function fixSimStatus() {
    try {
        if (!dbConfig.server) return; // Pula se não houver config de DB
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
    // Tenta inicializar o banco, mas não trava se falhar
    try {
        await initializeDatabase();
        await fixSimStatus();
    } catch (e) {
        console.error("Não foi possível pré-validar o banco de dados.");
    }

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // Middleware de depuração para logs de API em produção
    app.use((req, res, next) => {
        if (req.url.startsWith('/api')) {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        }
        next();
    });

    // --- HEALTH CHECK ---
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'ok', 
            version: '3.92.16', 
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    });



const safeQuery = async (pool, queryStr) => {
    try {
        return await pool.request().query(queryStr);
    } catch (err) {
        console.warn(`[SQL WARN] Consulta tolerada ("${queryStr.slice(0, 50)}..."):`, err.message);
        return { recordset: [] };
    }
};

const format = (set, jsonKeys = []) => (set?.recordset || []).map(row => {
    const entry = {};
    for (let key in row) {
        const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
        entry[camelKey] = jsonKeys.includes(key) && row[key] ? JSON.parse(row[key]) : row[key];
    }
    return entry;
});

// --- BOOTSTRAP ENDPOINT (v2.12.51 - Completo & Blindado) ---
app.get('/api/bootstrap', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const [
            devicesRes, simsRes, usersRes, sysUsersRes, settingsRes,
            modelsRes, brandsRes, typesRes, maintRes, sectorsRes, termsRes,
            accTypesRes, customFieldsRes, accountsRes, logsRes, tasksRes, taskLogsRes,
            consumablesRes, auditsRes, rhCollaboratorsRes, rhDependentsRes, rhOccurrencesRes, rhTemplatesRes, rhTermsRes, rhAssetItemsRes, rhCompaniesRes, profilesRes
        ] = await Promise.all([
            safeQuery(pool, "SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, ZabbixHostId, CurrentUserId, AdditionalUserIds, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
            safeQuery(pool, `
                SELECT 
                    s.Id, s.PhoneNumber, s.Operator, s.Iccid, s.Status, s.PlanDetails,
                    COALESCE(s.CurrentUserId, d.CurrentUserId) as CurrentUserId
                FROM SimCards s
                LEFT JOIN Devices d ON d.LinkedSimId = s.Id
            `),
            safeQuery(pool, "SELECT * FROM Users"),
            safeQuery(pool, "SELECT * FROM SystemUsers"),
            safeQuery(pool, "SELECT TOP 1 AppName as appName, LogoUrl as logoUrl, Cnpj as cnpj, TermTemplate as termTemplate, AccentColor as accentColor, LicenseKey as licenseKey, LicenseClient as licenseClient, LicenseExpires as licenseExpires, ZabbixUrl as zabbixUrl, ZabbixToken as zabbixToken FROM SystemSettings"),
            safeQuery(pool, "SELECT Id, Name, BrandId, TypeId FROM Models"), 
            safeQuery(pool, "SELECT * FROM Brands"),
            safeQuery(pool, "SELECT * FROM AssetTypes"),
            safeQuery(pool, "SELECT Id, DeviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            safeQuery(pool, "SELECT * FROM Sectors"),
            safeQuery(pool, "SELECT Id, UserId, Type, AssetDetails, Date, IsManual as isManual, ResolutionReason as resolutionReason, (CASE WHEN (FileBinary IS NOT NULL) OR (IsManual = 1) THEN 1 ELSE 0 END) as hasFile, Condition as condition, DamageDescription as damageDescription, Notes as notes, (CASE WHEN EvidenceBinary IS NOT NULL OR Evidence2Binary IS NOT NULL OR Evidence3Binary IS NOT NULL THEN 1 ELSE 0 END) as hasEvidence, Accessories as accessories, LinkedSimData as linkedSim, AssetId as assetId, AssetType as assetType, SignatureToken as signatureToken, SignatureIp as signatureIp, SignatureDate as signatureDate, SignatureLocation as signatureLocation, SignatureHash as signatureHash, (CASE WHEN SignatureCanvasBinary IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureCanvas, (CASE WHEN SignatureDocumentPhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignaturePhoto, (CASE WHEN SignatureSelfiePhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureSelfiePhoto, SignatureStatus as signatureStatus, (CASE WHEN SnapshotTemplate IS NOT NULL AND SnapshotTemplate != '' THEN 1 ELSE 0 END) as hasSnapshot, Checklist as checklist FROM Terms"),
            safeQuery(pool, "SELECT * FROM AccessoryTypes"),
            safeQuery(pool, "SELECT * FROM CustomFields"),
            safeQuery(pool, "SELECT * FROM SoftwareAccounts"),
            safeQuery(pool, "SELECT TOP 20 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, CAST(Notes AS NVARCHAR(500)) as Notes FROM AuditLogs ORDER BY Timestamp DESC"),
            safeQuery(pool, "SELECT Id, Title, Description, Type, Status, CreatedAt, DueDate, AssignedTo, Comments, Instructions, DeviceId, MaintenanceType, MaintenanceCost, MaintenanceItems, HasDueDate, IsRecurring, RecurrenceConfig, (CASE WHEN EvidenceUrls IS NOT NULL AND EvidenceUrls != '' THEN 1 ELSE 0 END) as hasEvidenceUrls, (CASE WHEN ManualAttachments IS NOT NULL AND ManualAttachments != '' THEN 1 ELSE 0 END) as hasManualAttachments FROM Tasks"),
            safeQuery(pool, "SELECT * FROM TaskLogs WHERE Timestamp > DATEADD(day, -15, GETDATE())"),
            safeQuery(pool, "SELECT * FROM Consumables"),
            safeQuery(pool, "SELECT * FROM TechnicalAudits"),
            safeQuery(pool, "SELECT * FROM RhCollaborators"),
            safeQuery(pool, "SELECT * FROM RhDependents"),
            safeQuery(pool, "SELECT Id, CollaboratorId, Type, StartDate, EndDate, DaysCount, Cid, Crm, Notes, (CASE WHEN FileUrl IS NOT NULL AND FileUrl != '' THEN 1 ELSE 0 END) as hasFile FROM RhOccurrences"),
            safeQuery(pool, "SELECT * FROM RhTermTemplates"),
            safeQuery(pool, "SELECT Id, CollaboratorId, TemplateId, AssetDetails, Date, Status, IsManual as isManual, ResolutionReason as resolutionReason, (CASE WHEN (FileBinary IS NOT NULL) OR (IsManual = 1) THEN 1 ELSE 0 END) as hasFile, Notes as notes, Type as type, DeliveredItems as deliveredItems, SignatureToken as signatureToken, SignatureIp as signatureIp, SignatureDate as signatureDate, SignatureLocation as signatureLocation, SignatureHash as signatureHash, SignatureStatus as signatureStatus, (CASE WHEN SignatureCanvasBinary IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureCanvas, (CASE WHEN SignatureDocumentPhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignaturePhoto, (CASE WHEN SignatureSelfiePhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureSelfiePhoto, (CASE WHEN (SnapshotDeclaration IS NOT NULL AND SnapshotDeclaration != '') OR (SnapshotClauses IS NOT NULL AND SnapshotClauses != '') THEN 1 ELSE 0 END) as hasSnapshot FROM RhTerms"),
            safeQuery(pool, "SELECT * FROM RhAssetItems"),
            safeQuery(pool, "SELECT * FROM RhCompanies ORDER BY CompanyName ASC"),
            safeQuery(pool, "SELECT * FROM RbacProfiles ORDER BY ID_Perfil ASC")
        ]);

        const devices = await Promise.all((devicesRes.recordset || []).map(async d => {
            const acc = await safeQuery(pool, `SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId='${d.Id}'`);
            return {
                id: d.Id, modelId: d.ModelId, serialNumber: d.SerialNumber, assetTag: d.AssetTag, internalCode: d.InternalCode, imei: d.Imei, pulsusId: d.PulsusId, zabbixHostId: d.ZabbixHostId, status: d.Status, currentUserId: d.CurrentUserId, additionalUserIds: d.AdditionalUserIds ? JSON.parse(d.AdditionalUserIds) : [], sectorId: d.SectorId, costCenter: d.CostCenter, linkedSimId: d.LinkedSimId, purchaseDate: d.PurchaseDate, purchaseCost: d.PurchaseCost, invoiceNumber: d.InvoiceNumber, supplier: d.Supplier, hasInvoice: d.hasInvoice === 1, customData: d.CustomData ? JSON.parse(d.CustomData) : {}, accessories: acc.recordset || []
            };
        }));

        res.json({
            devices, sims: format(simsRes),
            users: format(usersRes).map(u => {
                const rawP = u.photo || u.Photo;
                const hasRealPhoto = rawP !== null && rawP !== undefined && (Buffer.isBuffer(rawP) ? rawP.length > 0 : String(rawP).trim().length > 0);
                return {
                    ...u,
                    photo: hasRealPhoto ? `/api/users/${u.id}/photo/raw?t=${Date.now()}` : undefined,
                    hasPhoto: hasRealPhoto
                };
            }),
            systemUsers: format(sysUsersRes),
            settings: settingsRes?.recordset?.[0] || { appName: 'IT Asset', logoUrl: '' }, 
            models: format(modelsRes), 
            brands: format(brandsRes),
            assetTypes: format(typesRes, ['CustomFieldIds']), maintenances: format(maintRes).map(m => ({ ...m, hasInvoice: m.hasInvoice === 1 })),
            sectors: format(sectorsRes), terms: format(termsRes, ['accessories', 'linkedSim', 'checklist']).map(t => ({ ...t, hasFile: t.hasFile === 1, hasSnapshot: t.hasSnapshot === 1 })), accessoryTypes: format(accTypesRes),
            customFields: format(customFieldsRes), accounts: format(accountsRes, ['UserIds', 'DeviceIds']),
            tasks: format(tasksRes, ['MaintenanceItems', 'RecurrenceConfig']).map(t => ({ ...t, hasEvidenceUrls: t.hasEvidenceUrls === 1, hasManualAttachments: t.hasManualAttachments === 1 })), logs: format(logsRes), taskLogs: format(taskLogsRes),
            consumables: format(consumablesRes), audits: format(auditsRes),
            rhCollaborators: format(rhCollaboratorsRes, ['Documents']).map(c => {
                const rawP = c.photo || c.Photo;
                const hasRealPhoto = rawP !== null && rawP !== undefined && (Buffer.isBuffer(rawP) ? rawP.length > 0 : String(rawP).trim().length > 0);
                return {
                    ...c,
                    photo: hasRealPhoto ? `/api/rh-collaborators/${c.id}/photo/raw?t=${Date.now()}` : undefined,
                    hasPhoto: hasRealPhoto,
                    documents: (c.documents || []).map(d => ({
                        id: d.id,
                        category: d.category,
                        fileName: d.fileName,
                        uploadDate: d.uploadDate,
                        hasFile: !!(d.fileUrl && d.fileUrl.length > 0),
                        fileUrl: (d.fileUrl && d.fileUrl.length > 0) ? `/api/rh-collaborators/${c.id}/document/${d.id}/raw` : undefined
                    }))
                };
            }),
            rhCompanies: format(rhCompaniesRes),
            rhDependents: format(rhDependentsRes),
            rhOccurrences: format(rhOccurrencesRes).map(o => ({ ...o, hasFile: o.hasFile === 1, fileUrl: o.hasFile === 1 ? `/api/rh-occurrences/${o.id}/file/raw` : undefined })),
            rhTemplates: format(rhTemplatesRes),
            rhTerms: format(rhTermsRes, ['DeliveredItems']).map(t => ({ ...t, hasFile: t.hasFile === 1, hasSnapshot: t.hasSnapshot === 1 })),
            rhAssetItems: format(rhAssetItemsRes),
            profiles: (profilesRes?.recordset || []).map(r => ({
                ID_Perfil: r.ID_Perfil,
                Nome: r.Nome,
                Ativo: r.Ativo === true || r.Ativo === 1,
                Permissoes: r.Permissoes ? (typeof r.Permissoes === 'string' && r.Permissoes.startsWith('{') ? JSON.parse(r.Permissoes) : r.Permissoes) : {}
            }))
        });
    } catch (err) {
        console.error('[BOOTSTRAP ERROR]:', err);
        res.status(500).send(err.message);
    }
});

// Endpoint NATIVO do IT Asset 360 para Sincronização de Colaboradores no Fuel360
app.get('/api/fuel360/sync-collaborators-native', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const queryStr = `
            SELECT devices.PulsusId as id_pulsus,
                   Users.FullName  AS nome,
                   Devices.InternalCode AS codigo_setor,
                   Sectors.Name AS grupo
            FROM Devices devices
            LEFT JOIN Users Users ON devices.CurrentUserId = Users.Id
            LEFT JOIN Sectors Sectors ON devices.SectorId = Sectors.Id
            LEFT JOIN Models Models ON devices.ModelId = Models.id
            LEFT JOIN AssetTypes AssetTypes ON models.TypeId = AssetTypes.id
            WHERE devices.Status = 'Em Uso'
              AND devices.InternalCode IS NOT NULL AND devices.InternalCode <> ''
              AND Users.FullName IS NOT NULL AND Users.FullName <> ''
              AND Devices.SectorId IS NOT NULL AND Devices.SectorId <> ''
              AND AssetTypes.Name = 'Celular'
            ORDER BY 3
        `;
        const result = await pool.request().query(queryStr);
        res.json({ success: true, count: result.recordset.length, recordset: result.recordset });
    } catch (err) {
        console.error('Erro na consulta nativa de colaboradores do Asset:', err);
        res.status(500).json({ success: false, message: err.message, recordset: [] });
    }
});

// Endpoint para teste de conexão ERP do Fuel360
app.post('/api/fuel360/system/test-connection', async (req, res) => {
    const { config } = req.body;
    if (!config || !config.host) {
        return res.status(400).json({ success: false, message: 'Configuração de conexão inválida.' });
    }
    try {
        const testPool = new sql.ConnectionPool({
            server: config.host,
            port: parseInt(config.port || 1433),
            user: config.user,
            password: config.pass,
            database: config.database,
            options: { encrypt: false, trustServerCertificate: true, requestTimeout: 10000 }
        });
        await testPool.connect();
        await testPool.close();
        res.json({ success: true, message: 'Conexão com o banco ERP Fuel360 estabelecida com sucesso!' });
    } catch (err) {
        res.status(500).json({ success: false, message: `Falha de conexão com o ERP Fuel360: ${err.message}` });
    }
});

// Endpoint NATIVO de Import Preview para Colaboradores do Fuel360
app.get('/api/fuel360/colaboradores/import-preview', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const nativeRes = await pool.request().query(`
            SELECT devices.PulsusId as id_pulsus,
                   Users.FullName  AS nome,
                   Devices.InternalCode AS codigo_setor,
                   Sectors.Name AS grupo
            FROM Devices devices
            LEFT JOIN Users Users ON devices.CurrentUserId = Users.Id
            LEFT JOIN Sectors Sectors ON devices.SectorId = Sectors.Id
            LEFT JOIN Models Models ON devices.ModelId = Models.id
            LEFT JOIN AssetTypes AssetTypes ON models.TypeId = AssetTypes.id
            WHERE devices.Status = 'Em Uso'
              AND devices.InternalCode IS NOT NULL AND devices.InternalCode <> ''
              AND Users.FullName IS NOT NULL AND Users.FullName <> ''
              AND Devices.SectorId IS NOT NULL AND Devices.SectorId <> ''
              AND AssetTypes.Name = 'Celular'
            ORDER BY 3
        `);
        const nativeItems = nativeRes.recordset || [];

        const fuelColabRes = await pool.request().query(`SELECT * FROM FuelColaboradores`);
        const fuelItems = fuelColabRes.recordset || [];
        const fuelMap = new Map();
        fuelItems.forEach(item => fuelMap.set(Number(item.ID_Pulsus), item));

        const novos = [];
        const alterados = [];
        const iguais = [];
        const activePulsusIds = new Set();

        nativeItems.forEach(nItem => {
            const idPulsus = Number(nItem.id_pulsus);
            if (!idPulsus) return;
            activePulsusIds.add(idPulsus);
            const existing = fuelMap.get(idPulsus);
            const codigoSetorNum = Number(nItem.codigo_setor) || 0;
            if (!existing) {
                novos.push({
                    id_pulsus: idPulsus,
                    nome: nItem.nome,
                    matchType: 'NEW',
                    newData: { codigo_setor: codigoSetorNum, grupo: nItem.grupo || 'Outros' }
                });
            } else {
                const nameDiff = (existing.Nome || '').trim().toLowerCase() !== (nItem.nome || '').trim().toLowerCase();
                const sectorDiff = Number(existing.CodigoSetor) !== codigoSetorNum;
                const groupDiff = (existing.Grupo || '').trim().toLowerCase() !== (nItem.grupo || '').trim().toLowerCase();

                if (nameDiff || sectorDiff || groupDiff) {
                    const changes = [];
                    if (nameDiff) changes.push({ field: 'Nome', oldValue: existing.Nome, newValue: nItem.nome });
                    if (sectorDiff) changes.push({ field: 'CodigoSetor', oldValue: existing.CodigoSetor, newValue: codigoSetorNum });
                    if (groupDiff) changes.push({ field: 'Grupo', oldValue: existing.Grupo, newValue: nItem.grupo });

                    alterados.push({
                        id_pulsus: idPulsus,
                        nome: nItem.nome,
                        matchType: 'ID_MATCH',
                        id_colaborador: existing.ID_Colaborador,
                        existingColab: existing,
                        newData: { nome: nItem.nome, codigo_setor: codigoSetorNum, grupo: nItem.grupo || 'Outros' },
                        changes
                    });
                } else {
                    iguais.push({ id_pulsus: idPulsus, nome: nItem.nome });
                }
            }
        });

        const inativar = fuelItems
            .filter(f => f.Ativo && !activePulsusIds.has(Number(f.ID_Pulsus)))
            .map(f => ({
                id_pulsus: Number(f.ID_Pulsus),
                nome: f.Nome,
                id_colaborador: f.ID_Colaborador,
                codigo_setor: f.CodigoSetor,
                grupo: f.Grupo
            }));

        res.json({
            novos,
            alterados,
            conflitos: [],
            invalidos: [],
            iguais,
            iguaisCount: iguais.length,
            totalExternal: nativeItems.length,
            inativar
        });
    } catch (err) {
        console.error('Erro ao gerar preview de importação nativa Fuel360:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Endpoint NATIVO de Sincronização de Colaboradores do Fuel360
app.post('/api/fuel360/colaboradores/sync', async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, message: 'Itens inválidos.' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        let processedCount = 0;

        for (const item of items) {
            if (item.syncAction === 'INSERT') {
                const tipoVeiculo = item.newData?.tipoVeiculo || 'Carro';
                await pool.request()
                    .input('ID_Pulsus', sql.Int, item.id_pulsus)
                    .input('CodigoSetor', sql.Int, item.newData?.codigo_setor || 0)
                    .input('Nome', sql.NVarChar, item.nome || '')
                    .input('Grupo', sql.NVarChar, item.newData?.grupo || 'Outros')
                    .input('TipoVeiculo', sql.NVarChar, tipoVeiculo)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM FuelColaboradores WHERE ID_Pulsus = @ID_Pulsus)
                        BEGIN
                            INSERT INTO FuelColaboradores (ID_Pulsus, CodigoSetor, Nome, Grupo, TipoVeiculo, Ativo)
                            VALUES (@ID_Pulsus, @CodigoSetor, @Nome, @Grupo, @TipoVeiculo, 1)
                        END
                    `);
                processedCount++;
            } else if (item.syncAction === 'UPDATE_DATA') {
                await pool.request()
                    .input('ID_Pulsus', sql.Int, item.id_pulsus)
                    .input('Nome', sql.NVarChar, item.nome || item.newData?.nome || '')
                    .input('CodigoSetor', sql.Int, item.newData?.codigo_setor || 0)
                    .input('Grupo', sql.NVarChar, item.newData?.grupo || 'Outros')
                    .query(`
                        UPDATE FuelColaboradores 
                        SET Nome = @Nome, CodigoSetor = @CodigoSetor, Grupo = @Grupo 
                        WHERE ID_Pulsus = @ID_Pulsus
                    `);
                processedCount++;
            } else if (item.syncAction === 'DEACTIVATE') {
                await pool.request()
                    .input('ID_Pulsus', sql.Int, item.id_pulsus)
                    .query(`UPDATE FuelColaboradores SET Ativo = 0 WHERE ID_Pulsus = @ID_Pulsus`);
                processedCount++;
            }
        }
        res.json({ success: true, count: processedCount, errors: [] });
    } catch (err) {
        console.error('Erro na sincronização de colaboradores Fuel360:', err);
        res.status(500).json({ success: false, message: err.message, errors: [err.message] });
    }
});

// Endpoints NATIVOS de Listagem e CRUD do Fuel360
app.get('/api/fuel360/colaboradores', async (req, res) => {
    try {
app.get('/api/fuel360/system/config', async (req, res) => {
    res.json({
        appName: 'Fuel360 - Gestão de Reembolso & Roteiros',
        version: '3.96.2',
        syncMode: 'NATIVE'
    });
});

app.put('/api/fuel360/system/config', async (req, res) => {
    res.json({ success: true, message: 'Configurações atualizadas.' });
});

app.get('/api/fuel360/colaboradores', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM FuelColaboradores ORDER BY Nome ASC');
        res.json(result.recordset || []);
    } catch (err) {
        console.warn('[Fuel360 WARN] Falha ao buscar colaboradores:', err.message);
        res.json([]);
    }
});

app.get('/api/fuel360/grupos', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM FuelGrupos ORDER BY Nome ASC');
        res.json(result.recordset || []);
    } catch (err) {
        console.warn('[Fuel360 WARN] Falha ao buscar grupos:', err.message);
        res.json([]);
    }
});

app.get('/api/fuel360/config/fuel', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT FuelPrice as PrecoCombustivel, KmL_Car as KmL_Carro, KmL_Moto as KmL_Moto FROM FuelSystemSettings WHERE ID = 1');
        if (result.recordset && result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.json({ PrecoCombustivel: 5.89, KmL_Carro: 10, KmL_Moto: 35 });
        }
    } catch (err) {
        console.warn('[Fuel360 WARN] Falha ao buscar configurações:', err.message);
        res.json({ PrecoCombustivel: 5.89, KmL_Carro: 10, KmL_Moto: 35 });
    }
});

app.get('/api/fuel360/ausencias', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT a.ID_Ausencia, a.ID_Colaborador, a.DataInicio, a.DataFim, a.Motivo,
                   c.Nome as NomeColaborador, c.ID_Pulsus
            FROM FuelAusencias a
            LEFT JOIN FuelColaboradores c ON a.ID_Colaborador = c.ID_Colaborador
            ORDER BY a.DataInicio DESC
        `);
        res.json(result.recordset || []);
    } catch (err) {
        console.warn('[Fuel360 WARN] Falha ao buscar ausências:', err.message);
        res.json([]);
    }
});

// --- SYNC ENDPOINT (v2.12.51 - Blindado) ---
app.get('/api/sync', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const [devicesRes, simsRes, usersRes, maintRes, termsRes, accountsRes, tasksRes, logsRes, consumablesRes, auditsRes, rhCollaboratorsRes, rhDependentsRes, rhOccurrencesRes, rhTemplatesRes, rhTermsRes, rhAssetItemsRes, rhCompaniesRes, profilesRes] = await Promise.all([
            safeQuery(pool, "SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, ZabbixHostId, CurrentUserId, AdditionalUserIds, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
            safeQuery(pool, `
                SELECT 
                    s.Id, s.PhoneNumber, s.Operator, s.Iccid, s.Status, s.PlanDetails,
                    COALESCE(s.CurrentUserId, d.CurrentUserId) as CurrentUserId
                FROM SimCards s
                LEFT JOIN Devices d ON d.LinkedSimId = s.Id
            `),
            safeQuery(pool, "SELECT * FROM Users"),
            safeQuery(pool, "SELECT Id, DeviceId, Description, Cost, Date, Type, Provider, (CASE WHEN InvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM MaintenanceRecords"),
            safeQuery(pool, "SELECT Id, UserId, Type, AssetDetails, Date, IsManual as isManual, ResolutionReason as resolutionReason, (CASE WHEN (FileBinary IS NOT NULL) OR (IsManual = 1) THEN 1 ELSE 0 END) as hasFile, Condition as condition, DamageDescription as damageDescription, Notes as notes, (CASE WHEN EvidenceBinary IS NOT NULL OR Evidence2Binary IS NOT NULL OR Evidence3Binary IS NOT NULL THEN 1 ELSE 0 END) as hasEvidence, Accessories as accessories, LinkedSimData as linkedSim, AssetId as assetId, AssetType as assetType, SignatureToken as signatureToken, SignatureIp as signatureIp, SignatureDate as signatureDate, SignatureLocation as signatureLocation, SignatureHash as signatureHash, (CASE WHEN SignatureCanvasBinary IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureCanvas, (CASE WHEN SignatureDocumentPhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignaturePhoto, (CASE WHEN SignatureSelfiePhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureSelfiePhoto, SignatureStatus as signatureStatus, (CASE WHEN SnapshotTemplate IS NOT NULL AND SnapshotTemplate != '' THEN 1 ELSE 0 END) as hasSnapshot FROM Terms"),
            safeQuery(pool, "SELECT * FROM SoftwareAccounts"),
            safeQuery(pool, "SELECT Id, Title, Description, Type, Status, CreatedAt, DueDate, AssignedTo, Comments, Instructions, DeviceId, MaintenanceType, MaintenanceCost, MaintenanceItems, HasDueDate, IsRecurring, RecurrenceConfig, (CASE WHEN EvidenceUrls IS NOT NULL AND EvidenceUrls != '' THEN 1 ELSE 0 END) as hasEvidenceUrls, (CASE WHEN ManualAttachments IS NOT NULL AND ManualAttachments != '' THEN 1 ELSE 0 END) as hasManualAttachments FROM Tasks"),
            safeQuery(pool, "SELECT TOP 10 Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, CAST(Notes AS NVARCHAR(500)) as Notes FROM AuditLogs ORDER BY Timestamp DESC"),
            safeQuery(pool, "SELECT * FROM Consumables"),
            safeQuery(pool, "SELECT * FROM TechnicalAudits"),
            safeQuery(pool, "SELECT * FROM RhCollaborators"),
            safeQuery(pool, "SELECT * FROM RhDependents"),
            safeQuery(pool, "SELECT Id, CollaboratorId, Type, StartDate, EndDate, DaysCount, Cid, Crm, Notes, (CASE WHEN FileUrl IS NOT NULL AND FileUrl != '' THEN 1 ELSE 0 END) as hasFile FROM RhOccurrences"),
            safeQuery(pool, "SELECT * FROM RhTermTemplates"),
            safeQuery(pool, "SELECT Id, CollaboratorId, TemplateId, AssetDetails, Date, Status, IsManual as isManual, ResolutionReason as resolutionReason, (CASE WHEN (FileBinary IS NOT NULL) OR (IsManual = 1) THEN 1 ELSE 0 END) as hasFile, Notes as notes, Type as type, DeliveredItems as deliveredItems, SignatureToken as signatureToken, SignatureIp as signatureIp, SignatureDate as signatureDate, SignatureLocation as signatureLocation, SignatureHash as signatureHash, SignatureStatus as signatureStatus, (CASE WHEN SignatureCanvasBinary IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureCanvas, (CASE WHEN SignatureDocumentPhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignaturePhoto, (CASE WHEN SignatureSelfiePhoto IS NOT NULL THEN 1 ELSE 0 END) as hasSignatureSelfiePhoto, (CASE WHEN (SnapshotDeclaration IS NOT NULL AND SnapshotDeclaration != '') OR (SnapshotClauses IS NOT NULL AND SnapshotClauses != '') THEN 1 ELSE 0 END) as hasSnapshot FROM RhTerms"),
            safeQuery(pool, "SELECT * FROM RhAssetItems"),
            safeQuery(pool, "SELECT * FROM RhCompanies ORDER BY CompanyName ASC"),
            safeQuery(pool, "SELECT * FROM RbacProfiles ORDER BY ID_Perfil ASC")
        ]);

        const devices = await Promise.all((devicesRes.recordset || []).map(async d => {
            const acc = await safeQuery(pool, `SELECT Id as id, DeviceId as deviceId, AccessoryTypeId as accessoryTypeId, Name as name FROM DeviceAccessories WHERE DeviceId='${d.Id}'`);
            return {
                id: d.Id, modelId: d.ModelId, serialNumber: d.SerialNumber, assetTag: d.AssetTag, internalCode: d.InternalCode, imei: d.Imei, pulsusId: d.PulsusId, zabbixHostId: d.ZabbixHostId, status: d.Status, currentUserId: d.CurrentUserId, additionalUserIds: d.AdditionalUserIds ? JSON.parse(d.AdditionalUserIds) : [], sectorId: d.SectorId, costCenter: d.CostCenter, linkedSimId: d.LinkedSimId, purchaseDate: d.PurchaseDate, purchaseCost: d.PurchaseCost, invoiceNumber: d.InvoiceNumber, supplier: d.Supplier, hasInvoice: d.hasInvoice === 1, customData: d.CustomData ? JSON.parse(d.CustomData) : {}, accessories: acc.recordset || []
            };
        }));

        res.json({
            devices, sims: format(simsRes),
            users: format(usersRes).map(u => {
                const rawP = u.photo || u.Photo;
                const hasRealPhoto = rawP !== null && rawP !== undefined && (Buffer.isBuffer(rawP) ? rawP.length > 0 : String(rawP).trim().length > 0);
                return {
                    ...u,
                    photo: hasRealPhoto ? `/api/users/${u.id}/photo/raw?t=${Date.now()}` : undefined,
                    hasPhoto: hasRealPhoto
                };
            }),
            maintenances: format(maintRes).map(m => ({ ...m, hasInvoice: m.hasInvoice === 1 })),
            terms: format(termsRes, ['accessories', 'linkedSim']).map(t => ({ ...t, hasFile: t.hasFile === 1, hasSnapshot: t.hasSnapshot === 1 })),
            accounts: format(accountsRes, ['UserIds', 'DeviceIds']),
            tasks: format(tasksRes, ['MaintenanceItems', 'RecurrenceConfig']).map(t => ({ ...t, hasEvidenceUrls: t.hasEvidenceUrls === 1, hasManualAttachments: t.hasManualAttachments === 1 })),
            logs: format(logsRes),
            consumables: format(consumablesRes),
            audits: format(auditsRes),
            rhCollaborators: format(rhCollaboratorsRes, ['Documents']).map(c => {
                const rawP = c.photo || c.Photo;
                const hasRealPhoto = rawP !== null && rawP !== undefined && (Buffer.isBuffer(rawP) ? rawP.length > 0 : String(rawP).trim().length > 0);
                return {
                    ...c,
                    photo: hasRealPhoto ? `/api/rh-collaborators/${c.id}/photo/raw?t=${Date.now()}` : undefined,
                    hasPhoto: hasRealPhoto,
                    documents: (c.documents || []).map(d => ({
                        id: d.id,
                        category: d.category,
                        fileName: d.fileName,
                        uploadDate: d.uploadDate,
                        hasFile: !!(d.fileUrl && d.fileUrl.length > 0),
                        fileUrl: (d.fileUrl && d.fileUrl.length > 0) ? `/api/rh-collaborators/${c.id}/document/${d.id}/raw` : undefined
                    }))
                };
            }),
            rhCompanies: format(rhCompaniesRes),
            rhDependents: format(rhDependentsRes),
            rhOccurrences: format(rhOccurrencesRes).map(o => ({ ...o, hasFile: o.hasFile === 1, fileUrl: o.hasFile === 1 ? `/api/rh-occurrences/${o.id}/file/raw` : undefined })),
            rhTemplates: format(rhTemplatesRes),
            rhTerms: format(rhTermsRes, ['DeliveredItems']).map(t => ({ ...t, hasFile: t.hasFile === 1, hasSnapshot: t.hasSnapshot === 1 })),
            rhAssetItems: format(rhAssetItemsRes),
            profiles: (profilesRes?.recordset || []).map(r => ({
                ID_Perfil: r.ID_Perfil,
                Nome: r.Nome,
                Ativo: r.Ativo === true || r.Ativo === 1,
                Permissoes: r.Permissoes ? (typeof r.Permissoes === 'string' && r.Permissoes.startsWith('{') ? JSON.parse(r.Permissoes) : r.Permissoes) : {}
            }))
        });
    } catch (err) {
        console.error('[SYNC ERROR]:', err);
        res.status(500).send(err.message);
    }
});

app.get('/api/logs/paginated', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        const pool = await sql.connect(dbConfig);
        
        let query = "SELECT Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs";
        let countQuery = "SELECT COUNT(*) as total FROM AuditLogs";
        
        if (search) {
            const searchCondition = " WHERE AdminUser LIKE @search OR TargetName LIKE @search OR Action LIKE @search OR Notes LIKE @search";
            query += searchCondition;
            countQuery += searchCondition;
        }
        
        query += " ORDER BY Timestamp DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";

        const request = pool.request();
        if (search) request.input('search', sql.NVarChar, `%${search}%`);
        
        const countRequest = pool.request();
        if (search) countRequest.input('search', sql.NVarChar, `%${search}%`);

        const [logsRes, countRes] = await Promise.all([
            request.input('offset', sql.Int, offset).input('limit', sql.Int, limit).query(query),
            countRequest.query(countQuery)
        ]);

        res.json({
            logs: format(logsRes),
            total: countRes.recordset[0].total,
            page,
            totalPages: Math.ceil(countRes.recordset[0].total / limit)
        });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/logs/asset/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('AssetId', sql.NVarChar, req.params.id)
            .query("SELECT Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs WHERE AssetId=@AssetId ORDER BY Timestamp DESC");
        res.json(format(result));
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
        
        // v3.37.14: Atualiza status de pendência do colaborador
        await updateUserPendingStatus(pool, term.UserId);

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

        await pool.request().input('Id', sql.NVarChar, req.params.id).query("UPDATE Terms SET FileBinary=NULL, IsManual=0, ResolutionReason=NULL WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, term.UserId).query("SELECT FullName FROM Users WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';

        await logAction(term.UserId, 'User', 'Atualização', _adminUser, userName, `Anexo removido do termo (${term.AssetDetails}). Motivo: ${reason || 'Não informado'}`);
        
        // v3.37.14: Atualiza status de pendência do colaborador
        await updateUserPendingStatus(pool, term.UserId);

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
        
        // v3.37.14: Atualiza status de pendência do colaborador
        await updateUserPendingStatus(pool, term.UserId);
        
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

app.get('/api/rh-terms/:id/file', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileBinary FROM RhTerms WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row) return res.json({ fileUrl: '' });
        res.json({ fileUrl: getBase64FromBuffer(row.FileBinary) });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/rh-occurrences/:id/file', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileUrl FROM RhOccurrences WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row || !row.FileUrl) return res.json({ fileUrl: '' });
        res.json({ fileUrl: row.FileUrl });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/rh-occurrences/:id/file/raw', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileUrl FROM RhOccurrences WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row || !row.FileUrl) return res.status(404).send('Not found');
        const match = row.FileUrl.match(/^data:(.+?);base64,(.+)$/);
        if (match) {
            const buffer = Buffer.from(match[2], 'base64');
            res.setHeader('Content-Type', match[1]);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(buffer);
        } else {
            res.status(400).send('Invalid format');
        }
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/rh-occurrences/file/:id', async (req, res) => {
    try {
        const { fileUrl, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT CollaboratorId, Type FROM RhOccurrences WHERE Id=@Id");
        const occ = oldRes.recordset[0];
        if (!occ) return res.status(404).send("Ocorrência não encontrada");
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('FileUrl', sql.NVarChar, fileUrl)
            .query("UPDATE RhOccurrences SET FileUrl=@FileUrl WHERE Id=@Id");
        
        const userRes = await pool.request().input('Uid', sql.NVarChar, occ.CollaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';
        await logAction(occ.CollaboratorId, 'RhCollaborator', 'Atualização', _adminUser, userName, `Anexo adicionado à ocorrência de RH: ${occ.Type}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/rh-occurrences/:id/file', async (req, res) => {
    try {
        const { _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT CollaboratorId, Type FROM RhOccurrences WHERE Id=@Id");
        const occ = oldRes.recordset[0];
        if (!occ) return res.status(404).send("Ocorrência não encontrada");
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .query("UPDATE RhOccurrences SET FileUrl=NULL WHERE Id=@Id");
            
        const userRes = await pool.request().input('Uid', sql.NVarChar, occ.CollaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';
        await logAction(occ.CollaboratorId, 'RhCollaborator', 'Atualização', _adminUser, userName, `Anexo removido da ocorrência de RH: ${occ.Type}`);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/rh-occurrences/:id', async (req, res) => {
    try {
        const { reason, _adminUser } = req.body || {};
        const pool = await sql.connect(dbConfig);
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT CollaboratorId, Type, StartDate, EndDate FROM RhOccurrences WHERE Id=@Id");
        const occ = oldRes.recordset[0];
        if (!occ) return res.status(404).send("Ocorrência não encontrada");

        await pool.request().input('Id', sql.NVarChar, req.params.id).query("DELETE FROM RhOccurrences WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, occ.CollaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';
        const startFmt = occ.StartDate ? new Date(occ.StartDate).toLocaleDateString('pt-BR') : '';
        const endFmt = occ.EndDate ? new Date(occ.EndDate).toLocaleDateString('pt-BR') : '';
        const dateRange = startFmt ? (endFmt && endFmt !== startFmt ? `${startFmt} até ${endFmt}` : startFmt) : '';

        await logAction(
            occ.CollaboratorId,
            'RhCollaborator',
            'Exclusão',
            _adminUser || 'Gestor R.H.',
            userName,
            `Ocorrência de R.H. excluída: ${occ.Type}${dateRange ? ' (' + dateRange + ')' : ''}. Motivo: ${reason || 'Não informado'}`
        );

        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/rh-collaborators/:colabId/document/:docId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.colabId).query("SELECT Documents FROM RhCollaborators WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row || !row.Documents) return res.json({ fileUrl: '' });
        let docs = [];
        try { docs = JSON.parse(row.Documents); } catch(e) {}
        const doc = docs.find(d => d.id === req.params.docId);
        res.json({ fileUrl: doc?.fileUrl || '' });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/rh-collaborators/:colabId/document/:docId/raw', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.colabId).query("SELECT Documents FROM RhCollaborators WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row || !row.Documents) return res.status(404).send('Not found');
        let docs = [];
        try { docs = JSON.parse(row.Documents); } catch(e) {}
        const doc = docs.find(d => d.id === req.params.docId);
        if (!doc || !doc.fileUrl) return res.status(404).send('Not found');
        
        const match = doc.fileUrl.match(/^data:(.+?);base64,(.+)$/);
        if (match) {
            const buffer = Buffer.from(match[2], 'base64');
            res.setHeader('Content-Type', match[1]);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(buffer);
        } else {
            res.status(400).send('Invalid format');
        }
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/terms/:id/snapshot', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT SnapshotTemplate FROM Terms WHERE Id=@Id");
        const row = result.recordset[0];
        res.json({ snapshotTemplate: row ? row.SnapshotTemplate : '' });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/rh-terms/:id/snapshot', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT SnapshotDeclaration, SnapshotClauses FROM RhTerms WHERE Id=@Id");
        const row = result.recordset[0];
        res.json({ snapshotDeclaration: row?.SnapshotDeclaration || '', snapshotClauses: row?.SnapshotClauses || '' });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/rh-collaborators/:id/photo', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT Photo FROM RhCollaborators WHERE Id=@Id");
        const row = result.recordset[0];
        res.json({ photo: row ? row.Photo : '' });
    } catch (err) { res.status(500).send(err.message); }
});

const sendImageFromDbField = (res, rawData) => {
    if (!rawData) {
        return res.status(404).send('Foto não encontrada');
    }

    // 1. Tratamento quando o banco de dados retorna um Buffer (VarBinary)
    if (Buffer.isBuffer(rawData)) {
        let mime = 'image/jpeg';
        if (rawData.length > 4) {
            const hex = rawData.toString('hex', 0, 4).toUpperCase();
            if (hex === '89504E47') mime = 'image/png';
            else if (hex.startsWith('FFD8FF')) mime = 'image/jpeg';
            else if (hex === '47494638') mime = 'image/gif';
            else if (hex.startsWith('52494646')) mime = 'image/webp';
        }
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.send(rawData);
    }

    // 2. Tratamento quando o banco de dados retorna uma String (Base64 data-URL ou Base64 pura)
    let photoStr = String(rawData).trim();
    if (!photoStr) {
        return res.status(404).send('Foto não encontrada');
    }

    let mime = 'image/jpeg';
    if (photoStr.startsWith('data:')) {
        const commaIdx = photoStr.indexOf(',');
        if (commaIdx !== -1) {
            const header = photoStr.substring(0, commaIdx);
            const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);/);
            if (mimeMatch) {
                mime = mimeMatch[1];
            }
            photoStr = photoStr.substring(commaIdx + 1);
        }
    } else {
        if (photoStr.startsWith('iVBORw0KG')) mime = 'image/png';
        else if (photoStr.startsWith('R0lGOD')) mime = 'image/gif';
        else if (photoStr.startsWith('UklGR')) mime = 'image/webp';
    }

    const cleanBase64 = photoStr.replace(/[\r\n\s]/g, '');
    if (!cleanBase64) {
        return res.status(404).send('Foto não encontrada');
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(buffer);
};

app.get('/api/rh-collaborators/:id/photo/raw', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT Photo FROM RhCollaborators WHERE Id=@Id");
        const row = result.recordset[0];
        sendImageFromDbField(res, row?.Photo);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/users/:id/photo/raw', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT Photo FROM Users WHERE Id=@Id");
        const row = result.recordset[0];
        sendImageFromDbField(res, row?.Photo);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/rh-documents/:id/raw', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileBinary, FileName FROM RhDocuments WHERE Id=@Id");
        const row = result.recordset[0];
        if (!row || !row.FileBinary) {
            return res.status(404).send('Arquivo não encontrado');
        }
        let rawData = row.FileBinary;
        let mime = 'application/pdf';
        if (typeof rawData === 'string' && rawData.startsWith('data:')) {
            const match = rawData.match(/^data:([^;]+);base64,/);
            if (match) mime = match[1];
            rawData = rawData.substring(rawData.indexOf(',') + 1);
        } else {
            const ext = (row.FileName || '').split('.').pop().toLowerCase();
            if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
                mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            } else if (ext === 'pdf') {
                mime = 'application/pdf';
            }
        }
        const cleanBase64 = String(rawData).replace(/[\r\n\s]/g, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${row.FileName || 'documento'}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(buffer);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/tasks/:id/attachments', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT EvidenceUrls, ManualAttachments FROM Tasks WHERE Id=@Id");
        const row = result.recordset[0];
        let evidenceUrls = [], manualAttachments = [];
        try { evidenceUrls = JSON.parse(row?.EvidenceUrls || '[]'); } catch(e) {}
        try { manualAttachments = JSON.parse(row?.ManualAttachments || '[]'); } catch(e) {}
        res.json({ evidenceUrls, manualAttachments });
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/rh-terms/file/:id', async (req, res) => {
    try {
        const { fileUrl, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT CollaboratorId, AssetDetails FROM RhTerms WHERE Id=@Id");
        const term = oldRes.recordset[0];
        
        if (!term) return res.status(404).send("Termo não encontrado");

        const buffer = getBufferFromBase64(fileUrl);
        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Bin', buffer)
            .query("UPDATE RhTerms SET FileBinary=@Bin, IsManual=0, ResolutionReason=NULL, Status='ASSINADO' WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, term.CollaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';

        await logAction(term.CollaboratorId, 'RhCollaborator', 'Atualização', _adminUser, userName, `Digitalização anexada ao termo de comodato: ${term.AssetDetails}`);
        
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/rh-terms/:id/file', async (req, res) => {
    try {
        const { _adminUser, reason } = req.body;
        const pool = await sql.connect(dbConfig);

        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT CollaboratorId, AssetDetails FROM RhTerms WHERE Id=@Id");
        const term = oldRes.recordset[0];

        if (!term) return res.status(404).send("Termo não encontrado");

        await pool.request().input('Id', sql.NVarChar, req.params.id).query("UPDATE RhTerms SET FileBinary=NULL, IsManual=0, ResolutionReason=NULL, Status='PENDENTE', SignatureDate=NULL, SignatureIp=NULL, SignatureLocation=NULL, SignatureCanvasBinary=NULL, SignatureDocumentPhoto=NULL, SignatureSelfiePhoto=NULL, SignatureHash=NULL, SignatureStatus=NULL, SignatureToken=NULL WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, term.CollaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';

        await logAction(term.CollaboratorId, 'RhCollaborator', 'Atualização', _adminUser, userName, `Anexo removido do termo de comodato (${term.AssetDetails}). Motivo: ${reason || 'Não informado'}`);
        
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/rh-terms/resolve/:id', async (req, res) => {
    try {
        const { reason, _adminUser } = req.body;
        const pool = await sql.connect(dbConfig);
        
        const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT CollaboratorId, AssetDetails FROM RhTerms WHERE Id=@Id");
        const term = oldRes.recordset[0];
        
        if (!term) return res.status(404).send("Termo não encontrado");

        await pool.request()
            .input('Id', sql.NVarChar, req.params.id)
            .input('Reason', sql.NVarChar, reason)
            .query("UPDATE RhTerms SET IsManual=1, ResolutionReason=@Reason, Status='ASSINADO' WHERE Id=@Id");

        const userRes = await pool.request().input('Uid', sql.NVarChar, term.CollaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Uid");
        const userName = userRes.recordset[0]?.FullName || 'Colaborador';

        await logAction(term.CollaboratorId, 'RhCollaborator', 'Resolução Manual', _adminUser, userName, `Termo de comodato resolvido manualmente. Motivo: ${reason}`);
        
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

const isInternalUrl = (str) => {
    if (!str || typeof str !== 'string') return false;
    return str.includes('/api/') || (str.startsWith('http') && !str.startsWith('data:'));
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

// v3.37.14: Nova função auxiliar para sincronizar o bit de pendência do colaborador no banco
async function updateUserPendingStatus(pool, userId) {
    if (!userId) return;
    try {
        const result = await pool.request()
            .input('UserId', sql.NVarChar, userId)
            .query(`
                SELECT COUNT(*) as PendingCount 
                FROM Terms 
                WHERE UserId = @UserId 
                AND FileBinary IS NULL 
                AND (IsManual = 0 OR IsManual IS NULL) 
                AND (SignatureStatus <> 'APPROVED' OR SignatureStatus IS NULL)
            `);
        const pendingCount = result.recordset[0].PendingCount;
        await pool.request()
            .input('UserId', sql.NVarChar, userId)
            .input('HasPending', sql.Bit, pendingCount > 0 ? 1 : 0)
            .query("UPDATE Users SET HasPendingIssues = @HasPending WHERE Id = @UserId");
        console.log(`[PendingStatus] Usuário ${userId}: ${pendingCount} pendência(s). HasPendingIssues atualizado para ${pendingCount > 0 ? 1 : 0}`);
    } catch (err) {
        console.error(`[PendingStatus] Erro ao atualizar status do colaborador ${userId}:`, err);
    }
}

// ... (código das rotas movido para dentro de startServer)

    const IGexternal_CRUD_KEYS = [
        'ID_Perfil', 'idPerfil', 'Nome_Perfil', 'Permissoes', 'permissoes', 'avatarUrl',
        'accessories', 'terms', 'hasInvoice', 'hasFile', 'hasPhoto', 'hasSnapshot',
        'hasEvidence', 'hasEvidenceUrls', 'hasManualAttachments',
        'hasSignatureCanvas', 'hasSignaturePhoto', 'hasSignatureSelfiePhoto',
        'customDataStr', 'hasDueDate', 'isRecurring', 'recurrenceConfig', 'parentId',
        'assetsCount', 'activeSims', 'devicesInfo', 'sectorName', 'userName',
        'modelName', 'brandName', 'typeName', 'currentUserName', 'linkedSimNumber'
    ];

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
                
                const val = (['customFieldIds', 'customData', 'userIds', 'deviceIds', 'documents', 'deliveredItems'].includes(key)) ? JSON.stringify(req.body[key]) : req.body[key];
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                // Map legacy URL columns to Binary columns (exceto para RhOccurrences onde FileUrl é NVARCHAR(MAX))
                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = (table === 'RhOccurrences' || table === 'RhTerms') ? 'FileUrl' : 'FileBinary';

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    } else if (isInternalUrl(val)) {
                        continue;
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    }
                    continue;
                }

                if (dbKey === 'Cost' || dbKey === 'PurchaseCost') {
                    request.input(dbKey, sql.Float, val ? parseFloat(val) : 0);
                } else {
                    request.input(dbKey, val);
                }
                columns.push(dbKey);
                values.push('@' + dbKey);
            }
            await request.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`);
            const tName = req.body.assetTag || req.body.name || req.body.phoneNumber || req.body.fullName;
            await logAction(req.body.id, assetType, 'Criação', req.body._adminUser, tName, 'Item criado manualmente no sistema');
            res.json({success: true});
        } catch (err) { 
            console.error(`ERRO POST /api/${route}:`, err);
            res.status(500).send(err.message); 
        }
    });

    app.put(`/api/${route}/:id`, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            const colSchemaRes = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}'`);
            const realCols = new Set(colSchemaRes.recordset.map(r => r.COLUMN_NAME.toLowerCase()));

            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const prev = oldRes.recordset[0];
            
            let diffNotes = [];
            let sets = [];
            const processedKeys = new Set();
            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;

                // v3.26.3: Ignora o ID para evitar violação de Primary Key
                if (key.toLowerCase() === 'id') continue;

                // Ignora chaves virtuais de fotos sob demanda se forem URLs de API
                if (key === 'photo' && typeof req.body[key] === 'string' && req.body[key].startsWith('/api/')) continue;

                let val = (['customFieldIds', 'customData', 'userIds', 'deviceIds', 'documents', 'deliveredItems', 'permissoes', 'roles', 'customprofiles'].includes(key.toLowerCase())) ? JSON.stringify(req.body[key]) : req.body[key];

                if (typeof val === 'object' && val !== null) {
                    val = JSON.stringify(val);
                }

                // Preserva o Base64 original dos documentos no banco se o frontend enviou uma URL /api/.../raw
                if (key === 'documents' && Array.isArray(req.body[key])) {
                    let prevDocs = [];
                    try { prevDocs = JSON.parse(prev?.Documents || '[]'); } catch(e) {}
                    const mergedDocs = req.body[key].map(d => {
                        if (d.fileUrl && typeof d.fileUrl === 'string' && d.fileUrl.startsWith('/api/')) {
                            const matchOld = prevDocs.find(oldD => oldD.id === d.id);
                            return { ...d, fileUrl: matchOld ? matchOld.fileUrl : '' };
                        }
                        return d;
                    });
                    val = JSON.stringify(mergedDocs);
                }
                
                // Se o valor for nulo ou indefinido, pulamos a atualização deste campo
                if (val === null || val === undefined) continue; 

                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                // Map legacy URL columns to Binary columns (exceto para RhOccurrences onde FileUrl é NVARCHAR(MAX))
                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = (table === 'RhOccurrences' || table === 'RhTerms') ? 'FileUrl' : 'FileBinary';

                // v3.92.13: Descarta chaves que não correspondem a colunas reais na tabela do banco de dados
                if (realCols.size > 0 && !realCols.has(dbKey.toLowerCase())) continue;

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        sets.push(`${dbKey}=@${dbKey}`);
                    } else if (isInternalUrl(val)) {
                        continue;
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        sets.push(`${dbKey}=@${dbKey}`);
                    }
                    continue;
                }

                if (dbKey === 'Cost' || dbKey === 'PurchaseCost') {
                    request.input(dbKey, sql.Float, val ? parseFloat(val) : 0);
                } else {
                    request.input(dbKey, val);
                }
                sets.push(`${dbKey}=@${dbKey}`);

                if (prev) {
                    let oldVal = prev[dbKey];
                    let newVal = req.body[key];
                    if (['customData', 'customFieldIds', 'userIds', 'deviceIds', 'documents', 'deliveredItems'].includes(key)) newVal = JSON.stringify(newVal);
                    
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
        } catch (err) { 
            console.error(`ERRO PUT /api/${route}/${req.params.id}:`, err);
            res.status(500).send(err.message); 
        }
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
            const { assetId, assetType, userId, notes, _adminUser, accessories, syncSector } = req.body;
            const pool = await sql.connect(dbConfig);
            const table = assetType === 'Device' ? 'Devices' : 'SimCards';
            const oldRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const prev = oldRes.recordset[0];

            if (syncSector && assetType === 'Device' && prev) {
                // Sincroniza o cargo/setor e o código interno do dispositivo para o colaborador
                await pool.request()
                    .input('Uid', userId)
                    .input('Sid', prev.SectorId || null)
                    .input('Ic', prev.InternalCode || null)
                    .query("UPDATE Users SET SectorId = @Sid, InternalCode = @Ic WHERE Id = @Uid");
            }

            const userRes = await pool.request().input('Uid', sql.NVarChar, userId).query("SELECT FullName FROM Users WHERE Id=@Uid");
            const userName = userRes.recordset[0]?.FullName || 'Colaborador';
            
            let assetDetails = notes || '';
            let targetIdStr = assetId;
            let isShared = false;

            if (assetType === 'Device' && prev) {
                const modelRes = await pool.request().input('Mid', sql.NVarChar, prev.ModelId).query("SELECT TypeId, Name FROM Models WHERE Id=@Mid");
                const modelData = modelRes.recordset[0];
                const modelName = modelData?.Name || 'Dispositivo';
                
                if (modelData && modelData.TypeId) {
                    const typeRes = await pool.request().input('Tid', sql.NVarChar, modelData.TypeId).query("SELECT AllowMultipleUsers FROM AssetTypes WHERE Id=@Tid");
                    if (typeRes.recordset[0] && (typeRes.recordset[0].AllowMultipleUsers === true || typeRes.recordset[0].AllowMultipleUsers === 1)) {
                        isShared = true;
                    }
                }

                // v2.12.48: Snapshotting completo no log para identificação infalível
                assetDetails = `[TAG: ${prev.AssetTag || 'S/T'} | S/N: ${prev.SerialNumber || 'S/S'} | IMEI: ${prev.Imei || 'S/I'}] ${modelName}`;
                targetIdStr = `${prev.AssetTag || prev.Imei || prev.SerialNumber} (${modelName})`;
            } else if (prev) {
                assetDetails = `[CHIP: ${prev.PhoneNumber}]`;
                targetIdStr = prev.PhoneNumber;
            }

            if (isShared && prev.CurrentUserId && prev.CurrentUserId !== userId) {
                let additional = [];
                if (prev.AdditionalUserIds) {
                    try { additional = JSON.parse(prev.AdditionalUserIds); } catch(e){}
                }
                if (!additional.includes(userId)) {
                    additional.push(userId);
                }
                await pool.request().input('Aid', assetId).input('Add', JSON.stringify(additional)).query(`UPDATE ${table} SET Status='Em Uso', AdditionalUserIds=@Add WHERE Id=@Aid`);
                assetDetails = assetDetails + ' (Uso Compartilhado)';
            } else {
                if (isShared) {
                    assetDetails = assetDetails + ' (Uso Compartilhado)';
                }
                await pool.request().input('Aid', assetId).input('Uid', userId).query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@Uid WHERE Id=@Aid`);
            }
            if (assetType === 'Device' && accessories) {
                await pool.request().input('Did', assetId).query("DELETE FROM DeviceAccessories WHERE DeviceId=@Did");
                for (let acc of accessories) {
                    await pool.request().input('I', acc.id).input('Did', assetId).input('At', acc.accessoryTypeId).input('N', acc.name).query("INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@I, @Did, @At, @N)");
                }
            }

            let accNames = null;
            if (accessories && Array.isArray(accessories)) {
                accNames = JSON.stringify(accessories.map(a => ({ name: a.name || a.Name || a })));
            }

            let linkedSimData = null;
            if (assetType === 'Device' && prev && prev.LinkedSimId) {
                const simRes = await pool.request().input('Sid', sql.NVarChar, prev.LinkedSimId).query("SELECT * FROM SimCards WHERE Id=@Sid");
                if (simRes.recordset[0]) {
                    linkedSimData = JSON.stringify(simRes.recordset[0]);
                }
            }

            const settingsRes = await pool.request().query("SELECT TOP 1 TermTemplate FROM SystemSettings");
            const termTemplate = settingsRes.recordset[0]?.TermTemplate || null;

            const termId = Math.random().toString(36).substr(2, 9);
            await pool.request()
                .input('I', termId)
                .input('U', userId)
                .input('T', 'ENTREGA')
                .input('Ad', assetDetails)
                .input('Notes', notes || null)
                .input('Acc', accNames)
                .input('Sim', linkedSimData)
                .input('AssetId', assetId)
                .input('AssetType', assetType)
                .input('SnapshotTemplate', termTemplate)
                .query(`
                    INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, Notes, Accessories, LinkedSimData, AssetId, AssetType, SnapshotTemplate) 
                    VALUES (@I, @U, @T, @Ad, GETDATE(), @Notes, @Acc, @Sim, @AssetId, @AssetType, @SnapshotTemplate)
                `);
            
            const richNotes = `Alvo: ${userName}\nStatus: 'Disponível' ➔ 'Em Uso'${notes ? `\nObservação: ${notes}` : ''}`;
            await logAction(assetId, assetType, 'Entrega', _adminUser, targetIdStr, richNotes, null, prev, { status: 'Em Uso', currentUserId: userId, userName: userName, timestamp: new Date().toISOString() });
            
            // v3.37.14: Atualiza status de pendência do colaborador
            await updateUserPendingStatus(pool, userId);

            res.json({success: true, termId});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/operations/checkin', async (req, res) => {
        try {
            const { assetId, assetType, notes, _adminUser, inactivateUser, condition, damageDescription, evidenceFiles, isManual, resolutionReason, returningUserId, returnedChecklist } = req.body;
            const pool = await sql.connect(dbConfig);
            const table = assetType === 'Device' ? 'Devices' : 'SimCards';
            const oldRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const prev = oldRes.recordset[0];
            const primaryUserId = prev?.CurrentUserId;
            
            let additional = [];
            if (assetType === 'Device' && prev && prev.AdditionalUserIds) {
                try { additional = JSON.parse(prev.AdditionalUserIds); } catch(e){}
            }

            const userId = returningUserId || primaryUserId; // Ensure we operate on the intended return user
            
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

            if (assetType === 'Device' && (additional.length > 0 || (primaryUserId && primaryUserId !== userId))) {
                if (userId === primaryUserId) {
                    const nextPrimary = additional.shift();
                    await pool.request().input('Aid', assetId).input('NewP', nextPrimary).input('Add', JSON.stringify(additional)).query(`UPDATE ${table} SET CurrentUserId=@NewP, AdditionalUserIds=@Add WHERE Id=@Aid`);
                } else if (additional.includes(userId)) {
                    additional = additional.filter(id => id !== userId);
                    await pool.request().input('Aid', assetId).input('Add', JSON.stringify(additional)).query(`UPDATE ${table} SET AdditionalUserIds=@Add WHERE Id=@Aid`);
                }
            } else {
                await pool.request().input('Aid', assetId).query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL, AdditionalUserIds=NULL WHERE Id=@Aid`);
            }
            
            if (userId) {
                const termId = Math.random().toString(36).substr(2, 9);
                
                const ev1 = evidenceFiles && evidenceFiles.length > 0 ? getBufferFromBase64(evidenceFiles[0]) : null;
                const ev2 = evidenceFiles && evidenceFiles.length > 1 ? getBufferFromBase64(evidenceFiles[1]) : null;
                const ev3 = evidenceFiles && evidenceFiles.length > 2 ? getBufferFromBase64(evidenceFiles[2]) : null;
                
                let accNames = null;
                if (assetType === 'Device') {
                    const accRes = await pool.request().input('Did', assetId).query("SELECT Name FROM DeviceAccessories WHERE DeviceId=@Did");
                    if (accRes.recordset.length > 0) {
                        accNames = JSON.stringify(accRes.recordset.map(a => ({ name: a.Name || a.name || a })));
                    }
                }

                let linkedSimData = null;
                if (assetType === 'Device' && prev && prev.LinkedSimId) {
                    const simRes = await pool.request().input('Sid', sql.NVarChar, prev.LinkedSimId).query("SELECT * FROM SimCards WHERE Id=@Sid");
                    if (simRes.recordset[0]) {
                        linkedSimData = JSON.stringify(simRes.recordset[0]);
                    }
                }

                const settingsRes = await pool.request().query("SELECT TOP 1 TermTemplate FROM SystemSettings");
                const termTemplate = settingsRes.recordset[0]?.TermTemplate || null;

                const checklistStr = returnedChecklist ? JSON.stringify(returnedChecklist) : null;

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
                    .input('AssetId', assetId)
                    .input('AssetType', assetType)
                    .input('Acc', accNames)
                    .input('Sim', linkedSimData)
                    .input('SnapshotTemplate', termTemplate)
                    .input('Chk', checklistStr)
                    .query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, Condition, DamageDescription, Notes, EvidenceBinary, Evidence2Binary, Evidence3Binary, IsManual, ResolutionReason, AssetId, AssetType, Accessories, LinkedSimData, SnapshotTemplate, Checklist) VALUES (@I, @U, @T, @Ad, GETDATE(), @Cond, @Desc, @Notes, @Evid, @Evid2, @Evid3, @IsM, @ResR, @AssetId, @AssetType, @Acc, @Sim, @SnapshotTemplate, @Chk)");
                
                if (inactivateUser) {
                    await pool.request().input('Uid', sql.NVarChar, userId).query("UPDATE Users SET Active=0, Status='Inativo' WHERE Id=@Uid");
                    await logAction(userId, 'User', 'Inativação', _adminUser, userName, 'Inativado automaticamente durante a devolução (Desligamento)');
                }
            }
            
            const richNotes = `Origem: ${userName}\nStatus: 'Em Uso' ➔ 'Disponível'${notes ? `\nObservação: ${notes}` : ''}${condition && condition !== 'Perfeito' ? `\nCondição: ${condition}\nDescrição do Dano: ${damageDescription || 'N/A'}` : ''}`;
            await logAction(assetId, assetType, 'Devolução', _adminUser, targetIdStr, richNotes, null, { status: 'Em Uso', currentUserId: userId, userName: userName }, { status: 'Disponível', currentUserId: null, timestamp: new Date().toISOString() });
            
            // v3.37.14: Atualiza status de pendência do colaborador
            if (userId) await updateUserPendingStatus(pool, userId);

            res.json({success: true, termId: userId ? termId : null});
        } catch (err) { res.status(500).send(err.message); }
    });

    // --- DIGITAL SIGNATURE ENDPOINTS ---

    app.post('/api/terms/:id/generate-signature-token', async (req, res) => {
        try {
            console.log(`[Signature] Gerando token para termo: ${req.params.id}`);
            const pool = await sql.connect(dbConfig);
            // Uso de randomBytes para maior compatibilidade com versões do Node
            const token = crypto.randomBytes(16).toString('hex');
            
            const result = await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .input('Token', sql.NVarChar, token)
                .query("UPDATE Terms SET SignatureToken = @Token WHERE Id = @Id");
            
            if (result.rowsAffected[0] === 0) {
                console.error(`[Signature] Nenhum termo encontrado com ID: ${req.params.id}`);
                return res.status(404).send("Termo não encontrado");
            }
            console.log(`[Signature] Token gerado com sucesso: ${token}`);
            res.json({ success: true, token });
        } catch (err) { 
            console.error('[Signature] Erro fatal ao gerar token:', err);
            res.status(500).send(err.message); 
        }
    });

    app.get('/api/public/terms-to-sign/:token', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            let result = await pool.request()
                .input('Token', sql.NVarChar, req.params.token)
                .query(`
                    SELECT t.*, u.FullName as UserName, u.Cpf as UserCpf, u.InternalCode as UserCode, s.Name as SectorName
                    FROM Terms t
                    JOIN Users u ON u.Id = t.UserId
                    LEFT JOIN Sectors s ON s.Id = u.SectorId
                    WHERE t.SignatureToken = @Token
                `);
            
            let term = result.recordset[0];
            let isRh = false;

            if (!term) {
                const rhRes = await pool.request()
                    .input('Token', sql.NVarChar, req.params.token)
                    .query(`
                        SELECT t.*, c.FullName as UserName, c.Cpf as UserCpf, c.Role as UserCode, s.Name as SectorName
                        FROM RhTerms t
                        JOIN RhCollaborators c ON c.Id = t.CollaboratorId
                        LEFT JOIN Sectors s ON s.Id = c.SectorId
                        WHERE t.SignatureToken = @Token
                    `);
                term = rhRes.recordset[0];
                if (term) isRh = true;
            }

            if (!term) return res.status(404).send("Termo não encontrado ou link expirado");
            if (term.SignatureDate) return res.status(400).send("Este termo já foi assinado digitalmente");

            const settingsRes = await pool.request().query("SELECT TOP 1 TermTemplate, AppName, Cnpj, LogoUrl FROM SystemSettings");
            const settings = settingsRes.recordset[0];
            const companyName = settings?.AppName || 'A Empresa';
            const companyCnpj = settings?.Cnpj || '00.000.000/0000-00';
            const logoUrl = settings?.LogoUrl || '';

            const processTags = (text) => {
                if (!text) return '';
                return text
                    .replace(/\{NOME_EMPRESA\}/g, companyName)
                    .replace(/\{CNPJ\}/g, companyCnpj)
                    .replace(/\{NOME_COLABORADOR\}/g, term.UserName)
                    .replace(/\{CPF_COLABORADOR\}/g, term.UserCpf)
                    .replace(/\{DATA\}/g, new Date(term.Date).toLocaleDateString('pt-BR'));
            };

            let finalizedTemplate = { declaration: '', clauses: '' };

            if (isRh) {
                const tmplRes = await pool.request().input('TmplId', sql.NVarChar, term.TemplateId).query("SELECT Content, Declaration, Type FROM RhTermTemplates WHERE Id=@TmplId");
                const tmpl = tmplRes.recordset[0];
                if (tmpl) {
                    const declaration = tmpl.Declaration || (tmpl.Type === 'DEVOLUCAO' ? 'Declaro ter devolvido os itens abaixo na presente data.' : 'Declaro ter recebido os itens abaixo em perfeitas condições de uso.');
                    const clauses = tmpl.Content || '';
                    finalizedTemplate = {
                        declaration: processTags(declaration),
                        clauses: processTags(clauses)
                    };
                }
            } else {
                let template = { delivery: { declaration: '', clauses: '' }, return: { declaration: '', clauses: '' } };
                try {
                    const templateSource = term.SnapshotTemplate || settings?.TermTemplate;
                    if (templateSource) {
                        template = JSON.parse(templateSource);
                    }
                } catch (e) {}

                const selectedTemplate = term.Type === 'ENTREGA' ? template.delivery : template.return;
                finalizedTemplate = {
                    declaration: processTags(selectedTemplate?.declaration),
                    clauses: processTags(selectedTemplate?.clauses)
                };
            }

            let parsedAccessories = [];
            if (!isRh && term.Accessories) {
                try {
                    parsedAccessories = JSON.parse(term.Accessories);
                } catch (e) {}
            }

            let parsedLinkedSim = null;
            if (!isRh && term.LinkedSimData) {
                try {
                    parsedLinkedSim = JSON.parse(term.LinkedSimData);
                } catch (e) {}
            }

            let foundAssetId = term.AssetId;
            let foundAssetType = term.AssetType || 'Device';

            if (!isRh && !foundAssetId && term.AssetDetails) {
                let tag = '';
                let serial = '';
                let imei = '';
                const bracketsMatch = term.AssetDetails.match(/^\[(.*?)\]\s*(.*)$/);
                if (bracketsMatch) {
                    const [_, content] = bracketsMatch;
                    const parts = content.split('|').map(p => p.trim());
                    parts.forEach(p => {
                        if (p.toUpperCase().startsWith('TAG:')) {
                            tag = p.substring(4).trim();
                        } else if (p.toUpperCase().startsWith('S/N:') || p.toUpperCase().startsWith('SERIAL:')) {
                            serial = p.substring(p.indexOf(':') + 1).trim();
                        } else if (p.toUpperCase().startsWith('IMEI:')) {
                            imei = p.substring(5).trim();
                        }
                    });
                }

                const isTagValid = tag && !['S/T', 'S/I', 'N/A', '---', '', 'DESCONHECIDO', 'S/S'].includes(tag.toUpperCase());
                const isSerialValid = serial && !['S/S', 'S/N', 'N/A', '---', '', 'DESCONHECIDO'].includes(serial.toUpperCase());
                const isImeiValid = imei && !['S/I', 'S/T', 'N/A', '---', '', 'DESCONHECIDO'].includes(imei.toUpperCase());

                if (isTagValid || isSerialValid || isImeiValid) {
                    try {
                        const reqDev = pool.request();
                        let queryStr = `SELECT TOP 1 Id FROM Devices WHERE 1=0`;
                        if (isTagValid) {
                            reqDev.input('Tag', sql.NVarChar, tag);
                            queryStr += ` OR AssetTag = @Tag`;
                        }
                        if (isSerialValid) {
                            reqDev.input('Serial', sql.NVarChar, serial);
                            queryStr += ` OR SerialNumber = @Serial`;
                        }
                        if (isImeiValid) {
                            reqDev.input('Imei', sql.NVarChar, imei);
                            queryStr += ` OR Imei = @Imei`;
                        }
                        const devSearchRes = await reqDev.query(queryStr);
                        if (devSearchRes.recordset[0]) {
                            foundAssetId = devSearchRes.recordset[0].Id;
                            foundAssetType = 'Device';
                        }
                    } catch (err) {
                        console.error('[Signature Fallback] Erro ao buscar ID do ativo:', err.message);
                    }
                }
            }

            if (!isRh && foundAssetId && foundAssetType === 'Device') {
                try {
                    if (!parsedAccessories || parsedAccessories.length === 0) {
                        const accRes = await pool.request()
                            .input('AssetId', sql.NVarChar, foundAssetId)
                            .query("SELECT Name as name FROM DeviceAccessories WHERE DeviceId = @AssetId");
                        if (accRes.recordset.length > 0) {
                            parsedAccessories = accRes.recordset.map(r => ({ name: r.name }));
                        }
                    }

                    if (!parsedLinkedSim) {
                        const devRes = await pool.request()
                            .input('AssetId', sql.NVarChar, foundAssetId)
                            .query("SELECT LinkedSimId FROM Devices WHERE Id = @AssetId");
                        if (devRes.recordset[0] && devRes.recordset[0].LinkedSimId) {
                            const simRes = await pool.request()
                                .input('Sid', sql.NVarChar, devRes.recordset[0].LinkedSimId)
                                .query("SELECT * FROM SimCards WHERE Id = @Sid");
                            if (simRes.recordset[0]) {
                                const sim = simRes.recordset[0];
                                parsedLinkedSim = {
                                    id: sim.Id,
                                    operator: sim.Operator,
                                    phoneNumber: sim.PhoneNumber,
                                    iccid: sim.Iccid
                                };
                            }
                        }
                    }
                } catch (err) {
                    console.error('[Signature Fallback] Erro ao buscar acessórios/chip adicionais:', err.message);
                }
            }

            res.json({
                id: term.Id,
                type: term.Type,
                assetDetails: term.AssetDetails,
                date: term.Date,
                userName: term.UserName,
                userCpf: term.UserCpf,
                userCode: term.UserCode,
                sectorName: term.SectorName || 'Não Informado',
                accessories: parsedAccessories,
                linkedSim: parsedLinkedSim,
                notes: term.Notes,
                template: finalizedTemplate,
                isRhTerm: isRh,
                company: {
                    name: companyName,
                    cnpj: companyCnpj,
                    logoUrl
                }
            });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/public/terms-to-sign/:token/sign', async (req, res) => {
        try {
            const { signatureCanvas, documentPhoto, selfiePhoto, location, ip, observations, pdfBinary } = req.body;
            const pool = await sql.connect(dbConfig);
            
            let checkRes = await pool.request()
                .input('Token', sql.NVarChar, req.params.token)
                .query("SELECT Id, SignatureDate, Notes FROM Terms WHERE SignatureToken = @Token");
            
            let term = checkRes.recordset[0];
            let isRh = false;

            if (!term) {
                checkRes = await pool.request()
                    .input('Token', sql.NVarChar, req.params.token)
                    .query("SELECT Id, SignatureDate, Notes FROM RhTerms WHERE SignatureToken = @Token");
                term = checkRes.recordset[0];
                if (term) isRh = true;
            }

            if (!term) return res.status(404).send("Termo não encontrado");
            if (term.SignatureDate) return res.status(400).send("Este termo já foi assinado");

            const sigDate = new Date();
            const canvasBuffer = signatureCanvas ? getBufferFromBase64(signatureCanvas) : null;
            const photoBuffer = documentPhoto ? getBufferFromBase64(documentPhoto) : null;
            const selfieBuffer = selfiePhoto ? getBufferFromBase64(selfiePhoto) : null;
            const pdfBuffer = pdfBinary ? getBufferFromBase64(pdfBinary) : null;
            
            // Concatenar observações se já existirem
            let finalNotes = term.Notes || '';
            if (observations) {
                const userObs = `\n[Obs. Colaborador na Assinatura Digital]: ${observations}`;
                finalNotes = finalNotes ? `${finalNotes}\n${userObs}` : userObs;
            }

            // Gerar Hash de integridade
            const hashInput = `${term.Id}-${sigDate.toISOString()}-${ip}-${location}`;
            const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

            const tableName = isRh ? 'RhTerms' : 'Terms';
            const request = pool.request()
                .input('Token', sql.NVarChar, req.params.token)
                .input('Date', sql.DateTime, sigDate)
                .input('Ip', sql.NVarChar, ip)
                .input('Loc', sql.NVarChar, location)
                .input('Canvas', sql.VarBinary, canvasBuffer)
                .input('Photo', sql.VarBinary, photoBuffer)
                .input('Selfie', sql.VarBinary, selfieBuffer)
                .input('Hash', sql.NVarChar, hash)
                .input('Notes', sql.NVarChar, finalNotes);

            let query = `
                UPDATE ${tableName} SET 
                    SignatureDate = @Date,
                    SignatureIp = @Ip,
                    SignatureLocation = @Loc,
                    SignatureCanvasBinary = @Canvas,
                    SignatureDocumentPhoto = @Photo,
                    SignatureSelfiePhoto = @Selfie,
                    SignatureHash = @Hash,
                    Notes = @Notes,
                    SignatureStatus = 'WAITING_APPROVAL'
            `;

            if (pdfBuffer) {
                request.input('Pdf', sql.VarBinary, pdfBuffer);
                query += `, FileBinary = @Pdf`;
            }

            query += ` WHERE SignatureToken = @Token`;

            await request.query(query);

            res.json({ success: true, hash, signatureDate: sigDate });
        } catch (err) { 
            console.error('[Sign] Error:', err);
            res.status(500).send(err.message); 
        }
    });

    app.get('/api/terms/:id/signature-data', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .query("SELECT SignatureCanvasBinary, SignatureDocumentPhoto, SignatureSelfiePhoto FROM Terms WHERE Id = @Id");
            
            const row = result.recordset[0];
            if (!row) return res.status(404).send("Dados não encontrados");
            
            res.json({
                signatureCanvas: row.SignatureCanvasBinary ? getBase64FromBuffer(row.SignatureCanvasBinary) : null,
                documentPhoto: row.SignatureDocumentPhoto ? getBase64FromBuffer(row.SignatureDocumentPhoto) : null,
                selfiePhoto: row.SignatureSelfiePhoto ? getBase64FromBuffer(row.SignatureSelfiePhoto) : null
            });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/terms/:id/approve-signature', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            
            // v3.37.14: Buscar UserId antes de atualizar para recalcular pendência
            const termRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId FROM Terms WHERE Id=@Id");
            const term = termRes.recordset[0];

            await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .query("UPDATE Terms SET SignatureStatus = 'APPROVED' WHERE Id = @Id");
            
            if (term) await updateUserPendingStatus(pool, term.UserId);

            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/terms/:id/reject-signature', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);

            // v3.37.14: Buscar UserId antes de atualizar
            const termRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId FROM Terms WHERE Id=@Id");
            const term = termRes.recordset[0];

            await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .query(`
                    UPDATE Terms SET 
                        SignatureStatus = 'REJECTED',
                        SignatureDate = NULL,
                        SignatureIp = NULL,
                        SignatureLocation = NULL,
                        SignatureCanvasBinary = NULL,
                        SignatureDocumentPhoto = NULL,
                        SignatureSelfiePhoto = NULL,
                        SignatureHash = NULL
                    WHERE Id = @Id
                `);
            
            if (term) await updateUserPendingStatus(pool, term.UserId);

            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/rh-terms/:id/generate-signature-token', async (req, res) => {
        try {
            console.log(`[Signature RH] Gerando token para termo de RH: ${req.params.id}`);
            const pool = await sql.connect(dbConfig);
            const token = crypto.randomBytes(16).toString('hex');
            
            const result = await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .input('Token', sql.NVarChar, token)
                .query("UPDATE RhTerms SET SignatureToken = @Token WHERE Id = @Id");
            
            if (result.rowsAffected[0] === 0) {
                console.error(`[Signature RH] Nenhum termo encontrado com ID: ${req.params.id}`);
                return res.status(404).send("Termo não encontrado");
            }

            console.log(`[Signature RH] Token gerado com sucesso: ${token}`);
            res.json({ success: true, token });
        } catch (err) { 
            console.error('[Signature RH] Erro fatal ao gerar token:', err);
            res.status(500).send(err.message); 
        }
    });

    app.get('/api/rh-terms/:id/signature-data', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .query("SELECT SignatureCanvasBinary, SignatureDocumentPhoto, SignatureSelfiePhoto FROM RhTerms WHERE Id = @Id");
            
            const row = result.recordset[0];
            if (!row) return res.status(404).send("Dados não encontrados");
            
            res.json({
                signatureCanvas: row.SignatureCanvasBinary ? getBase64FromBuffer(row.SignatureCanvasBinary) : null,
                documentPhoto: row.SignatureDocumentPhoto ? getBase64FromBuffer(row.SignatureDocumentPhoto) : null,
                selfiePhoto: row.SignatureSelfiePhoto ? getBase64FromBuffer(row.SignatureSelfiePhoto) : null
            });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/rh-terms/:id/approve-signature', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .query("UPDATE RhTerms SET SignatureStatus = 'APPROVED', Status = 'ASSINADO' WHERE Id = @Id");
            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/rh-terms/:id/reject-signature', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .query(`
                    UPDATE RhTerms SET 
                        SignatureStatus = 'REJECTED',
                        Status = 'PENDENTE',
                        SignatureDate = NULL,
                        SignatureIp = NULL,
                        SignatureLocation = NULL,
                        SignatureCanvasBinary = NULL,
                        SignatureDocumentPhoto = NULL,
                        SignatureSelfiePhoto = NULL,
                        SignatureHash = NULL
                    WHERE Id = @Id
                `);
            res.json({ success: true });
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
    // --- SystemUsers: rotas customizadas com hash de senha (bcrypt) e migração defensiva de schema ---
    app.post('/api/system-users', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            
            // Auto-migração defensiva de colunas para SystemUsers
            try {
                await pool.request().query(`
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SystemUsers' AND COLUMN_NAME='ID_Perfil')
                    BEGIN
                        ALTER TABLE SystemUsers ADD ID_Perfil NVARCHAR(255) NULL;
                    END;
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SystemUsers' AND COLUMN_NAME='Permissoes')
                    BEGIN
                        ALTER TABLE SystemUsers ADD Permissoes NVARCHAR(MAX) NULL;
                    END;
                `);
            } catch (migErr) {
                console.warn('[SystemUsers] Alerta na migração defensiva:', migErr.message);
            }

            const body = { ...req.body };
            const userId = body.id || body.Id || `usr-${Date.now()}`;
            const userName = body.name || body.Name || 'Novo Operador';
            const userEmail = body.email || body.Email || '';
            const rawRole = body.role || body.Role || '1';
            let rawPassword = body.password || body.Password || '123456';
            
            if (rawPassword && !rawPassword.startsWith('$2')) {
                rawPassword = await bcrypt.hash(rawPassword, 10);
            }

            const profileId = body.ID_Perfil || body.idPerfil || body.IdPerfil || (rawRole && !isNaN(Number(rawRole)) ? String(rawRole) : null);
            const permissoesObj = body.permissoes || body.Permissoes || null;
            const permissoesStr = permissoesObj ? (typeof permissoesObj === 'object' ? JSON.stringify(permissoesObj) : String(permissoesObj)) : null;
            const avatarUrl = body.avatarUrl || body.AvatarUrl || null;

            await pool.request()
                .input('Id', sql.NVarChar, userId)
                .input('Name', sql.NVarChar, userName)
                .input('Email', sql.NVarChar, userEmail)
                .input('Password', sql.NVarChar, rawPassword)
                .input('Role', sql.NVarChar, String(rawRole))
                .input('AvatarUrl', sql.NVarChar, avatarUrl)
                .input('ID_Perfil', sql.NVarChar, profileId ? String(profileId) : null)
                .input('Permissoes', sql.NVarChar, permissoesStr)
                .query(`
                    INSERT INTO SystemUsers (Id, Name, Email, Password, Role, AvatarUrl, ID_Perfil, Permissoes)
                    VALUES (@Id, @Name, @Email, @Password, @Role, @AvatarUrl, @ID_Perfil, @Permissoes)
                `);

            await logAction(userId, 'SystemUser', 'Criação', body._adminUser || req.body._adminUser || 'Admin', userName, 'Usuário do sistema criado com sucesso');
            res.json({ success: true, id: userId });
        } catch (err) {
            console.error('ERRO POST /api/system-users:', err);
            res.status(500).send(err.message);
        }
    });

    app.put('/api/system-users/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            
            // Auto-migração defensiva de colunas para SystemUsers
            try {
                await pool.request().query(`
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SystemUsers' AND COLUMN_NAME='ID_Perfil')
                    BEGIN
                        ALTER TABLE SystemUsers ADD ID_Perfil NVARCHAR(255) NULL;
                    END;
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SystemUsers' AND COLUMN_NAME='Permissoes')
                    BEGIN
                        ALTER TABLE SystemUsers ADD Permissoes NVARCHAR(MAX) NULL;
                    END;
                `);
            } catch (migErr) {}

            const body = { ...req.body };
            const targetId = req.params.id;
            const userName = body.name || body.Name || 'Operador';
            const userEmail = body.email || body.Email || '';
            const rawRole = body.role || body.Role;

            const request = pool.request();
            request.input('TargetId', sql.NVarChar, targetId);
            
            let sets = [];

            if (body.name || body.Name) {
                request.input('Name', sql.NVarChar, userName);
                sets.push('Name=@Name');
            }
            if (body.email || body.Email) {
                request.input('Email', sql.NVarChar, userEmail);
                sets.push('Email=@Email');
            }
            if (body.password || body.Password) {
                let pass = body.password || body.Password;
                if (!pass.startsWith('$2')) {
                    pass = await bcrypt.hash(pass, 10);
                }
                request.input('Password', sql.NVarChar, pass);
                sets.push('Password=@Password');
            }
            if (rawRole !== undefined && rawRole !== null) {
                request.input('Role', sql.NVarChar, String(rawRole));
                sets.push('Role=@Role');
            }
            if (body.avatarUrl || body.AvatarUrl !== undefined) {
                request.input('AvatarUrl', sql.NVarChar, body.avatarUrl || body.AvatarUrl || null);
                sets.push('AvatarUrl=@AvatarUrl');
            }

            const profileId = body.ID_Perfil || body.idPerfil || body.IdPerfil;
            if (profileId !== undefined && profileId !== null) {
                request.input('ID_Perfil', sql.NVarChar, String(profileId));
                sets.push('ID_Perfil=@ID_Perfil');
            }

            const permissoesObj = body.permissoes || body.Permissoes;
            if (permissoesObj !== undefined && permissoesObj !== null) {
                const permissoesStr = typeof permissoesObj === 'object' ? JSON.stringify(permissoesObj) : String(permissoesObj);
                request.input('Permissoes', sql.NVarChar, permissoesStr);
                sets.push('Permissoes=@Permissoes');
            }

            if (sets.length > 0) {
                await request.query(`UPDATE SystemUsers SET ${sets.join(',')} WHERE Id=@TargetId`);
            }

            await logAction(targetId, 'SystemUser', 'Atualização', body._adminUser || req.body._adminUser || 'Admin', userName, body._notes || 'Usuário do sistema atualizado');
            res.json({ success: true });
        } catch (err) {
            console.error('ERRO PUT /api/system-users/:id:', err);
            res.status(500).send(err.message);
        }
    });
    // DELETE /api/system-users/:id — exclusão (mantém comportamento do crud genérico)
    app.delete('/api/system-users/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request().input('Id', sql.NVarChar, req.params.id).query('DELETE FROM SystemUsers WHERE Id=@Id');
            await logAction(req.params.id, 'SystemUser', 'Exclusão', req.body?._adminUser, '', 'Usuário do sistema removido');
            res.json({ success: true });
        } catch (err) {
            console.error('ERRO DELETE /api/system-users/:id:', err);
            res.status(500).send(err.message);
        }
    });
    // --- Endpoint de autenticação segura ---
    // POST /api/auth/login — valida credenciais no servidor sem expor senhas ao frontend
    app.post('/api/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ success: false, message: 'Credenciais incompletas.' });
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('Email', sql.NVarChar, email)
                .query('SELECT Id as id, Name as name, Email as email, Password as password, Role as role, ID_Perfil, Permissoes FROM SystemUsers WHERE Email=@Email');
            const user = result.recordset[0];
            if (!user) return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            let passwordValid = false;
            if (user.password && user.password.startsWith('$2')) {
                // Senha já hasheada — comparação bcrypt
                passwordValid = await bcrypt.compare(password, user.password);
            } else {
                // Fallback: senha ainda em plain text (legado) — migração transparente
                passwordValid = (user.password === password);
                if (passwordValid) {
                    // Re-hasheia automaticamente a senha legada no banco
                    const newHash = await bcrypt.hash(password, 10);
                    await pool.request()
                        .input('Hash', sql.NVarChar, newHash)
                        .input('Id', sql.NVarChar, user.id)
                        .query('UPDATE SystemUsers SET Password=@Hash WHERE Id=@Id');
                    console.log(`[auth] Senha do usuário ${user.email} migrada para bcrypt automaticamente.`);
                }
            }
            if (!passwordValid) return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            // Retorna o usuário SEM a senha, incluindo ID_Perfil e Permissoes processadas
            const { password: _omit, ...safeUser } = user;
            if (safeUser.ID_Perfil && !isNaN(Number(safeUser.ID_Perfil))) {
                safeUser.ID_Perfil = Number(safeUser.ID_Perfil);
                safeUser.idPerfil = safeUser.ID_Perfil;
            }
            if (safeUser.Permissoes && typeof safeUser.Permissoes === 'string') {
                try {
                    safeUser.Permissoes = JSON.parse(safeUser.Permissoes);
                    safeUser.permissoes = safeUser.Permissoes;
                } catch (e) {
                    safeUser.Permissoes = {};
                }
            }
            res.json({ success: true, user: safeUser });
        } catch (err) {
            console.error('ERRO POST /api/auth/login:', err);
            res.status(500).send(err.message);
        }
    });
    crud('TechnicalAudits', 'audits', 'Audit');
    crud('RhOccurrences', 'rh-occurrences', 'RhOccurrence');
    crud('RhTermTemplates', 'rh-templates', 'RhTermTemplate');
    crud('RhTerms', 'rh-terms', 'RhTerm');
    crud('RhAssetItems', 'rh-assets', 'RhAssetItem');

    // --- Rotas Explícitas de RH Empresas ---
    app.get('/api/rh-companies', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await safeQuery(pool, "SELECT * FROM RhCompanies ORDER BY CompanyName ASC");
            res.json(format(result));
        } catch (err) {
            console.error('ERRO GET /api/rh-companies:', err);
            res.status(500).send(err.message);
        }
    });

    app.post('/api/rh-companies', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            
            // Auto-criação defensiva da tabela RhCompanies
            try {
                await pool.request().query(`
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RhCompanies')
                    BEGIN
                        CREATE TABLE RhCompanies (
                            Id NVARCHAR(255) PRIMARY KEY,
                            Cnpj NVARCHAR(50) NOT NULL,
                            CompanyName NVARCHAR(255) NOT NULL,
                            CreatedAt DATETIME DEFAULT GETDATE()
                        );
                    END
                `);
            } catch (tblErr) {}

            const { id, cnpj, companyName, _adminUser } = req.body;
            const compId = id || `comp-${Date.now()}`;
            await pool.request()
                .input('Id', sql.NVarChar, compId)
                .input('Cnpj', sql.NVarChar, cnpj)
                .input('CompanyName', sql.NVarChar, companyName)
                .query(`
                    INSERT INTO RhCompanies (Id, Cnpj, CompanyName, CreatedAt)
                    VALUES (@Id, @Cnpj, @CompanyName, GETDATE())
                `);
            
            await logAction(compId, 'RhCompany', 'Criação', _adminUser || 'Gestor R.H.', companyName, `Empresa cadastrada: ${companyName} (${cnpj})`);

            res.json({ success: true, id: compId });
        } catch (err) {
            console.error('ERRO POST /api/rh-companies:', err);
            res.status(500).send(err.message);
        }
    });

    // --- Função Auxiliar Defensiva para RbacProfiles ---
    async function ensureRbacProfilesTable(pool) {
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RbacProfiles')
                BEGIN
                    CREATE TABLE RbacProfiles (
                        ID_Perfil INT PRIMARY KEY IDENTITY(1,1),
                        Nome NVARCHAR(255) NOT NULL,
                        Ativo BIT DEFAULT 1,
                        Permissoes NVARCHAR(MAX) NULL
                    );
                END
            `);
        } catch (e) {
            console.error('Erro ao garantir tabela RbacProfiles:', e.message);
        }
    }

    // --- Rotas de RbacProfiles (Perfis de Acesso centralizados) ---
    app.get('/api/rbac-profiles', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await ensureRbacProfilesTable(pool);
            const result = await pool.request().query("SELECT * FROM RbacProfiles ORDER BY ID_Perfil ASC");
            const profiles = (result.recordset || []).map(r => ({
                ID_Perfil: r.ID_Perfil,
                Nome: r.Nome,
                Ativo: r.Ativo === true || r.Ativo === 1,
                Permissoes: r.Permissoes ? (typeof r.Permissoes === 'string' && r.Permissoes.startsWith('{') ? JSON.parse(r.Permissoes) : r.Permissoes) : {}
            }));
            res.json(profiles);
        } catch (err) {
            console.error('ERRO GET /api/rbac-profiles:', err);
            res.status(500).send(err.message);
        }
    });

    app.post('/api/rbac-profiles', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await ensureRbacProfilesTable(pool);
            const { Nome, Ativo, Permissoes, _adminUser } = req.body || {};
            if (!Nome) return res.status(400).send('Nome do perfil é obrigatório');
            const permStr = typeof Permissoes === 'object' ? JSON.stringify(Permissoes) : String(Permissoes || '{}');
            const result = await pool.request()
                .input('Nome', sql.NVarChar, Nome)
                .input('Ativo', sql.Bit, Ativo !== false ? 1 : 0)
                .input('Permissoes', sql.NVarChar, permStr)
                .query("INSERT INTO RbacProfiles (Nome, Ativo, Permissoes) OUTPUT INSERTED.ID_Perfil VALUES (@Nome, @Ativo, @Permissoes)");
            
            const newId = result.recordset[0]?.ID_Perfil;
            await logAction(String(newId), 'RbacProfile', 'Criação', _adminUser || 'Admin', Nome, `Novo perfil de acesso criado: ${Nome}`);
            res.json({ success: true, id: newId });
        } catch (err) {
            console.error('ERRO POST /api/rbac-profiles:', err);
            res.status(500).send(err.message);
        }
    });

    app.put('/api/rbac-profiles/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await ensureRbacProfilesTable(pool);
            const targetId = parseInt(req.params.id);
            if (isNaN(targetId)) return res.status(400).send('ID de perfil inválido');

            const { Nome, Ativo, Permissoes, _adminUser } = req.body || {};
            const permStr = typeof Permissoes === 'object' ? JSON.stringify(Permissoes) : String(Permissoes || '{}');
            const updateResult = await pool.request()
                .input('Id', sql.Int, targetId)
                .input('Nome', sql.NVarChar, Nome || '')
                .input('Ativo', sql.Bit, Ativo !== false ? 1 : 0)
                .input('Permissoes', sql.NVarChar, permStr)
                .query("UPDATE RbacProfiles SET Nome=@Nome, Ativo=@Ativo, Permissoes=@Permissoes WHERE ID_Perfil=@Id");

            if (updateResult.rowsAffected[0] === 0) {
                console.log(`[RBAC] Perfil ${targetId} não existia na tabela. Realizando UPSERT...`);
                await pool.request()
                    .input('Id', sql.Int, targetId)
                    .input('Nome', sql.NVarChar, Nome || '')
                    .input('Ativo', sql.Bit, Ativo !== false ? 1 : 0)
                    .input('Permissoes', sql.NVarChar, permStr)
                    .query(`
                        SET IDENTITY_INSERT RbacProfiles ON;
                        INSERT INTO RbacProfiles (ID_Perfil, Nome, Ativo, Permissoes) VALUES (@Id, @Nome, @Ativo, @Permissoes);
                        SET IDENTITY_INSERT RbacProfiles OFF;
                    `);
            }

            await logAction(String(targetId), 'RbacProfile', 'Atualização', _adminUser || 'Admin', Nome || '', `Perfil de acesso atualizado: ${Nome || targetId}`);
            res.json({ success: true });
        } catch (err) {
            console.error('ERRO PUT /api/rbac-profiles/:id:', err);
            res.status(500).send(err.message);
        }
    });

    app.delete('/api/rbac-profiles/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await ensureRbacProfilesTable(pool);
            const targetId = parseInt(req.params.id);
            if (isNaN(targetId)) return res.status(400).send('ID de perfil inválido');

            const adminUser = req.body?._adminUser || 'Admin';

            await pool.request()
                .input('Id', sql.Int, targetId)
                .query("DELETE FROM RbacProfiles WHERE ID_Perfil=@Id");

            await logAction(String(targetId), 'RbacProfile', 'Exclusão', adminUser, '', 'Perfil de acesso removido');
            res.json({ success: true });
        } catch (err) {
            console.error('ERRO DELETE /api/rbac-profiles/:id:', err);
            res.status(500).send(err.message);
        }
    });



    // --- Rotas Explícitas de RH Colaboradores ---
    app.post('/api/rh-collaborators', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const body = { ...req.body };
            
            // Auto-migração defensiva de colunas
            const colsToAdd = [
                { name: 'CompanyCnpj', type: 'NVARCHAR(255) NULL' },
                { name: 'HasVehicle', type: 'NVARCHAR(50) NULL' },
                { name: 'VehicleType', type: 'NVARCHAR(100) NULL' },
                { name: 'VehiclePlate', type: 'NVARCHAR(50) NULL' },
                { name: 'TransportOption', type: 'NVARCHAR(100) NULL' },
                { name: 'Photo', type: 'NVARCHAR(MAX) NULL' },
                { name: 'HasPhoto', type: 'INT DEFAULT 0' }
            ];
            for (const col of colsToAdd) {
                try {
                    await pool.request().query(`
                        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RhCollaborators' AND COLUMN_NAME = '${col.name}')
                        BEGIN
                            ALTER TABLE RhCollaborators ADD ${col.name} ${col.type};
                        END
                    `);
                } catch (e) {}
            }

            const request = pool.request();
            let columns = [], values = [];
            const IGNORE = ['_adminUser', '_notes', '_reason', 'photo', 'hasPhoto', 'documents', 'auditLog'];
            
            for (let key in body) {
                if (key.startsWith('_') || IGNORE.includes(key)) continue;
                if (body[key] === undefined) continue;
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                let val = body[key];
                if (typeof val === 'object' && val !== null) {
                    val = JSON.stringify(val);
                }
                request.input(dbKey, val !== null ? String(val) : null);
                columns.push(dbKey);
                values.push('@' + dbKey);
            }

            // Tratamento explícito da foto no POST
            if (body.photo && typeof body.photo === 'string' && body.photo.length > 0) {
                if (!body.photo.startsWith('/api/')) {
                    request.input('Photo', sql.NVarChar(sql.MAX), body.photo);
                    request.input('HasPhoto', sql.Int, 1);
                    columns.push('Photo', 'HasPhoto');
                    values.push('@Photo', '@HasPhoto');
                }
            }

            await request.query(`INSERT INTO RhCollaborators (${columns.join(',')}) VALUES (${values.join(',')})`);
            
            const colabName = body.fullName || 'Colaborador';
            await logAction(body.id, 'RhCollaborator', 'Criação', body._adminUser || 'Gestor R.H.', colabName, 'Novo colaborador cadastrado no R.H.');

            res.json({ success: true });
        } catch (err) {
            console.error('ERRO POST /api/rh-collaborators:', err);
            res.status(500).send(err.message);
        }
    });

    app.put('/api/rh-collaborators/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const body = { ...req.body };
            
            // Auto-migração defensiva de colunas
            const colsToAdd = [
                { name: 'CompanyCnpj', type: 'NVARCHAR(255) NULL' },
                { name: 'HasVehicle', type: 'NVARCHAR(50) NULL' },
                { name: 'VehicleType', type: 'NVARCHAR(100) NULL' },
                { name: 'VehiclePlate', type: 'NVARCHAR(50) NULL' },
                { name: 'TransportOption', type: 'NVARCHAR(100) NULL' },
                { name: 'Photo', type: 'NVARCHAR(MAX) NULL' },
                { name: 'HasPhoto', type: 'INT DEFAULT 0' }
            ];
            for (const col of colsToAdd) {
                try {
                    await pool.request().query(`
                        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RhCollaborators' AND COLUMN_NAME = '${col.name}')
                        BEGIN
                            ALTER TABLE RhCollaborators ADD ${col.name} ${col.type};
                        END
                    `);
                } catch (e) {}
            }

            const request = pool.request();
            let sets = [];
            const IGNORE = ['_adminUser', '_notes', '_reason', 'photo', 'hasPhoto', 'documents', 'auditLog', 'id', 'Id'];
            
            for (let key in body) {
                if (key.startsWith('_') || IGNORE.includes(key)) continue;
                if (body[key] === undefined) continue;
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                let val = body[key];
                if (typeof val === 'object' && val !== null) {
                    val = JSON.stringify(val);
                }
                request.input(dbKey, val !== null ? String(val) : null);
                sets.push(`${dbKey}=@${dbKey}`);
            }

            // Tratamento explícito da foto no PUT (atualização, preservação de URL interna ou remoção)
            if (body.photo !== undefined) {
                if (body.photo && typeof body.photo === 'string' && body.photo.length > 0) {
                    if (body.photo.startsWith('/api/')) {
                        // Se for uma URL interna de API, a foto existente no banco NÃO MUDOU (preserva a foto)
                    } else {
                        // Grava a string Base64 diretamente
                        request.input('Photo', sql.NVarChar(sql.MAX), body.photo);
                        request.input('HasPhoto', sql.Int, 1);
                        sets.push('Photo=@Photo', 'HasPhoto=@HasPhoto');
                    }
                } else {
                    request.input('Photo', sql.NVarChar(sql.MAX), null);
                    request.input('HasPhoto', sql.Int, 0);
                    sets.push('Photo=@Photo', 'HasPhoto=@HasPhoto');
                }
            }

            if (sets.length > 0) {
                request.input('TargetId', req.params.id);
                await request.query(`UPDATE RhCollaborators SET ${sets.join(',')} WHERE Id=@TargetId`);
            }

            const colabName = body.fullName || 'Colaborador';
            await logAction(req.params.id, 'RhCollaborator', 'Atualização', body._adminUser || 'Gestor R.H.', colabName, body._notes || 'Dados cadastrais do colaborador atualizados');

            res.json({ success: true });
        } catch (err) {
            console.error('ERRO PUT /api/rh-collaborators/:id:', err);
            res.status(500).send(err.message);
        }
    });

    // --- Rotas Explícitas de RH Documentos Unificados (Holerites / Acadêmico / Pessoais) ---
    app.get('/api/rh-documents', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query(`
                SELECT Id, CollaboratorId, DocumentType, Category, Title, FileName, UploadDate, ReferencePeriod, Institution, AcademicStatus, Notes,
                (CASE WHEN FileBinary IS NOT NULL AND FileBinary != '' THEN 1 ELSE 0 END) as hasFile
                FROM RhDocuments
            `);
            const formatted = (result.recordset || []).map(r => ({
                id: r.Id,
                collaboratorId: r.CollaboratorId,
                documentType: r.DocumentType,
                category: r.Category,
                title: r.Title,
                fileName: r.FileName,
                uploadDate: r.UploadDate,
                referencePeriod: r.ReferencePeriod,
                institution: r.Institution,
                academicStatus: r.AcademicStatus,
                notes: r.Notes,
                hasFile: r.hasFile === 1,
                fileUrl: r.hasFile === 1 ? `/api/rh-documents/${r.Id}/raw?t=${Date.now()}` : undefined
            }));
            res.json(formatted);
        } catch (err) {
            console.error('ERRO GET /api/rh-documents:', err);
            res.status(500).send(err.message);
        }
    });

    app.post('/api/rh-documents', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const { id, collaboratorId, documentType, category, title, fileName, fileUrl, uploadDate, referencePeriod, institution, academicStatus, notes, _adminUser } = req.body;
            const targetId = id || ('doc-' + Math.random().toString(36).substr(2, 9));
            const reqQuery = pool.request()
                .input('Id', sql.NVarChar, targetId)
                .input('CollaboratorId', sql.NVarChar, collaboratorId)
                .input('DocumentType', sql.NVarChar, documentType || 'DOCUMENTO_PESSOAL')
                .input('Category', sql.NVarChar, category || 'Outros')
                .input('Title', sql.NVarChar, title || fileName || 'Documento')
                .input('FileName', sql.NVarChar, fileName || 'arquivo')
                .input('FileBinary', sql.NVarChar(sql.MAX), fileUrl && !fileUrl.startsWith('/api/') ? fileUrl : null)
                .input('UploadDate', sql.DateTime, uploadDate ? new Date(uploadDate) : new Date())
                .input('ReferencePeriod', sql.NVarChar, referencePeriod || null)
                .input('Institution', sql.NVarChar, institution || null)
                .input('AcademicStatus', sql.NVarChar, academicStatus || null)
                .input('Notes', sql.NVarChar, notes || null);

            await reqQuery.query(`
                IF EXISTS (SELECT * FROM RhDocuments WHERE Id=@Id)
                BEGIN
                    UPDATE RhDocuments SET
                        CollaboratorId=@CollaboratorId, DocumentType=@DocumentType, Category=@Category,
                        Title=@Title, FileName=@FileName,
                        FileBinary=COALESCE(@FileBinary, FileBinary),
                        UploadDate=@UploadDate, ReferencePeriod=@ReferencePeriod, Institution=@Institution,
                        AcademicStatus=@AcademicStatus, Notes=@Notes
                    WHERE Id=@Id
                END
                ELSE
                BEGIN
                    INSERT INTO RhDocuments (Id, CollaboratorId, DocumentType, Category, Title, FileName, FileBinary, UploadDate, ReferencePeriod, Institution, AcademicStatus, Notes)
                    VALUES (@Id, @CollaboratorId, @DocumentType, @Category, @Title, @FileName, @FileBinary, @UploadDate, @ReferencePeriod, @Institution, @AcademicStatus, @Notes)
                END
            `);

            await logAction(collaboratorId, 'RhCollaborator', 'Documento Anexado', _adminUser || 'Gestor R.H.', title || fileName || 'Documento', `Novo documento registrado (${category})`);
            res.json({ success: true, id: targetId });
        } catch (err) {
            console.error('ERRO POST /api/rh-documents:', err);
            res.status(500).send(err.message);
        }
    });

    app.delete('/api/rh-documents/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request().input('Id', sql.NVarChar, req.params.id).query("DELETE FROM RhDocuments WHERE Id=@Id");
            res.json({ success: true });
        } catch (err) {
            console.error('ERRO DELETE /api/rh-documents/:id:', err);
            res.status(500).send(err.message);
        }
    });

    // --- Rotas Explícitas de RH Histórico de Cargos e Salários ---
    app.get('/api/rh-career-history', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT * FROM RhCareerHistory ORDER BY ChangeDate DESC");
            res.json(format(result));
        } catch (err) {
            console.error('ERRO GET /api/rh-career-history:', err);
            res.status(500).send(err.message);
        }
    });

    app.post('/api/rh-career-history', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const { id, collaboratorId, previousRole, newRole, previousSalary, newSalary, changeDate, reason, _adminUser } = req.body;
            const targetId = id || ('history-' + Math.random().toString(36).substr(2, 9));
            const request = pool.request()
                .input('Id', sql.NVarChar, targetId)
                .input('CollaboratorId', sql.NVarChar, collaboratorId)
                .input('PreviousRole', sql.NVarChar, previousRole || null)
                .input('NewRole', sql.NVarChar, newRole || '')
                .input('PreviousSalary', sql.Float, previousSalary !== undefined && previousSalary !== null ? parseFloat(previousSalary) : null)
                .input('NewSalary', sql.Float, newSalary !== undefined && newSalary !== null ? parseFloat(newSalary) : 0)
                .input('ChangeDate', sql.DateTime, changeDate ? new Date(changeDate) : new Date())
                .input('Reason', sql.NVarChar, reason || null)
                .input('AdminUser', sql.NVarChar, _adminUser || 'Gestor R.H.');

            await request.query(`
                INSERT INTO RhCareerHistory (Id, CollaboratorId, PreviousRole, NewRole, PreviousSalary, NewSalary, ChangeDate, Reason, AdminUser)
                VALUES (@Id, @CollaboratorId, @PreviousRole, @NewRole, @PreviousSalary, @NewSalary, @ChangeDate, @Reason, @AdminUser)
            `);

            await logAction(collaboratorId, 'RhCollaborator', 'Alteração Cargo/Salário', _adminUser || 'Gestor R.H.', newRole, `Alteração de cargo/salário registrada. Novo Cargo: ${newRole}, Novo Salário: R$ ${newSalary}`);
            res.json({ success: true, id: targetId });
        } catch (err) {
            console.error('ERRO POST /api/rh-career-history:', err);
            res.status(500).send(err.message);
        }
    });

    app.delete('/api/rh-career-history/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request().input('Id', sql.NVarChar, req.params.id).query("DELETE FROM RhCareerHistory WHERE Id=@Id");
            res.json({ success: true });
        } catch (err) {
            console.error('ERRO DELETE /api/rh-career-history/:id:', err);
            res.status(500).send(err.message);
        }
    });

    // --- Rotas Explícitas de RH Dependentes ---
    app.get('/api/rh-dependents', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT * FROM RhDependents");
            res.json(format(result));
        } catch (err) {
            console.error('ERRO GET /api/rh-dependents:', err);
            res.status(500).send(err.message);
        }
    });

    app.post('/api/rh-dependents', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            
            // Auto-criação defensiva da tabela RhDependents
            try {
                await pool.request().query(`
                    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RhDependents')
                    BEGIN
                        CREATE TABLE RhDependents (
                            Id NVARCHAR(255) PRIMARY KEY,
                            CollaboratorId NVARCHAR(255) NOT NULL,
                            Name NVARCHAR(255) NOT NULL,
                            RelationshipType NVARCHAR(100) NOT NULL,
                            Cpf NVARCHAR(50) NULL,
                            BirthDate NVARCHAR(50) NULL,
                            Notes NVARCHAR(500) NULL,
                            CreatedAt DATETIME DEFAULT GETDATE()
                        );
                    END
                `);
            } catch (tblErr) {}

            const { id, collaboratorId, name, relationshipType, cpf, birthDate, notes, _adminUser } = req.body;
            const depId = id || `dep-${Date.now()}`;
            await pool.request()
                .input('Id', sql.NVarChar, depId)
                .input('ColabId', sql.NVarChar, collaboratorId)
                .input('Name', sql.NVarChar, name)
                .input('RelType', sql.NVarChar, relationshipType)
                .input('Cpf', sql.NVarChar, cpf || null)
                .input('BirthDate', sql.NVarChar, birthDate || null)
                .input('Notes', sql.NVarChar, notes || null)
                .query(`
                    INSERT INTO RhDependents (Id, CollaboratorId, Name, RelationshipType, Cpf, BirthDate, Notes, CreatedAt)
                    VALUES (@Id, @ColabId, @Name, @RelType, @Cpf, @BirthDate, @Notes, GETDATE())
                `);
            
            const colabRes = await pool.request().input('Cid', sql.NVarChar, collaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Cid");
            const colabName = colabRes.recordset[0]?.FullName || 'Colaborador';
            await logAction(collaboratorId, 'RhCollaborator', 'Atualização', _adminUser || 'Gestor R.H.', colabName, `Dependente cadastrado: ${name} (${relationshipType})`);

            res.json({ success: true, id: depId });
        } catch (err) {
            console.error('ERRO POST /api/rh-dependents:', err);
            res.status(500).send(err.message);
        }
    });

    app.put('/api/rh-dependents/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const { name, relationshipType, cpf, birthDate, notes, _adminUser } = req.body;
            await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .input('Name', sql.NVarChar, name)
                .input('RelType', sql.NVarChar, relationshipType)
                .input('Cpf', sql.NVarChar, cpf || null)
                .input('BirthDate', sql.NVarChar, birthDate || null)
                .input('Notes', sql.NVarChar, notes || null)
                .query(`
                    UPDATE RhDependents 
                    SET Name=@Name, RelationshipType=@RelType, Cpf=@Cpf, BirthDate=@BirthDate, Notes=@Notes
                    WHERE Id=@Id
                `);
            res.json({ success: true });
        } catch (err) {
            console.error('ERRO PUT /api/rh-dependents:', err);
            res.status(500).send(err.message);
        }
    });

    app.delete('/api/rh-dependents/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT CollaboratorId, Name, RelationshipType FROM RhDependents WHERE Id=@Id");
            const dep = oldRes.recordset[0];
            await pool.request().input('Id', sql.NVarChar, req.params.id).query("DELETE FROM RhDependents WHERE Id=@Id");

            if (dep) {
                const colabRes = await pool.request().input('Cid', sql.NVarChar, dep.CollaboratorId).query("SELECT FullName FROM RhCollaborators WHERE Id=@Cid");
                const colabName = colabRes.recordset[0]?.FullName || 'Colaborador';
                await logAction(dep.CollaboratorId, 'RhCollaborator', 'Atualização', req.body?._adminUser || 'Gestor R.H.', colabName, `Dependente removido: ${dep.Name} (${dep.RelationshipType})`);
            }

            res.json({ success: true });
        } catch (err) {
            console.error('ERRO DELETE /api/rh-dependents:', err);
            res.status(500).send(err.message);
        }
    });
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

                if (dbKey === 'Cost' || dbKey === 'PurchaseCost') {
                    request.input(dbKey, sql.Float, val ? parseFloat(val) : 0);
                } else {
                    request.input(dbKey, val);
                }
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

    app.post('/api/devices/bulk-update', async (req, res) => {
        try {
            const { deviceIds, updates, adminUser, reason } = req.body;
            if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
                return res.status(400).send('Nenhum dispositivo selecionado.');
            }

            const pool = await sql.connect(dbConfig);
            const results = [];

            for (const id of deviceIds) {
                // Get current state for logging
                const oldRes = await pool.request().input('Id', sql.NVarChar, id).query("SELECT * FROM Devices WHERE Id=@Id");
                const prev = oldRes.recordset[0];
                if (!prev) continue;

                let diffNotes = [];
                let sets = [];
                const request = pool.request();
                request.input('TargetId', sql.NVarChar, id);

                for (let key in updates) {
                    const val = updates[key];
                    const dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                    
                    if (dbKey === 'Cost' || dbKey === 'PurchaseCost') {
                        request.input(dbKey, sql.Float, val ? parseFloat(val) : 0);
                    } else {
                        request.input(dbKey, val);
                    }
                    sets.push(`${dbKey}=@${dbKey}`);

                    const oldVal = prev[dbKey];
                    if (String(oldVal || '') !== String(val || '')) {
                        diffNotes.push(`${key}: '${oldVal || '---'}' ➔ '${val || '---'}'`);
                    }
                }

                if (sets.length > 0) {
                    await request.query(`UPDATE Devices SET ${sets.join(',')} WHERE Id=@TargetId`);
                    
                    const richNotes = (reason ? `Motivo (Bulk): ${reason}\n\n` : '') + diffNotes.join('\n');
                    const tName = prev.AssetTag || prev.SerialNumber || 'Dispositivo';
                    await logAction(id, 'Device', 'Atualização em Massa', adminUser, tName, richNotes, null, prev, updates);
                }
                results.push(id);
            }

            res.json({ success: true, updatedCount: results.length });
        } catch (err) {
            res.status(500).send(err.message);
        }
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
                if (key.toLowerCase() === 'id') continue;
                if (key.endsWith('Binary')) continue;

                const val = (key === 'customFieldIds' || key === 'customData' || key === 'additionalUserIds') ? JSON.stringify(req.body[key]) : req.body[key];
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

                if (dbKey === 'Cost' || dbKey === 'PurchaseCost') {
                    request.input(dbKey, sql.Float, val ? parseFloat(val) : 0);
                } else {
                    request.input(dbKey, val);
                }
                sets.push(`${dbKey}=@${dbKey}`);

                if (prev) {
                    let oldVal = prev[dbKey];
                    let newVal = req.body[key];
                    if (['customData', 'customFieldIds', 'userIds', 'deviceIds', 'additionalUserIds'].includes(key)) newVal = JSON.stringify(newVal);
                    
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
        } catch (err) { 
            console.error(`ERRO PUT /api/devices/${req.params.id}:`, err);
            res.status(500).send(err.message); 
        }
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

    crud('Users', 'users', 'User');
    crud('Users', 'system-users', 'User');
    crud('SimCards', 'sims', 'Sim');
    crud('SoftwareAccounts', 'software-accounts', 'SoftwareAccount');
    crud('Models', 'models', 'Model');
    crud('Brands', 'brands', 'Brand');
    crud('AssetTypes', 'asset-types', 'AssetType');
    crud('Sectors', 'sectors', 'Sector');
    crud('AccessoryTypes', 'accessory-types', 'AccessoryType');
    crud('CustomFields', 'custom-fields', 'CustomField');
    crud('MaintenanceRecords', 'maintenances', 'Maintenance');
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

    const dashboardRoutes = require('./routes/dashboard');
    app.use('/api/dashboard', dashboardRoutes);

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
            
            const formattedTasks = format(result, ['EvidenceUrls', 'ManualAttachments', 'MaintenanceItems', 'RecurrenceConfig']);

            // Lógica de Alertas de Prazo (Injetada na listagem)
            const now = new Date();
            const tasksWithAlerts = formattedTasks.map(task => {
                let isOverdue = false;
                let isNearDue = false;

                if (task.dueDate) {
                    const dueDate = (() => {
                        const parts = task.dueDate.split('-');
                        return parts.length === 3 
                            ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999)
                            : (() => { const d = new Date(task.dueDate); d.setHours(23, 59, 59, 999); return d; })();
                    })();
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
            const { id, title, description, type, status, dueDate, assignedTo, instructions, manualAttachments, deviceId, maintenanceType, maintenanceCost, maintenanceItems, hasDueDate, isRecurring, recurrenceConfig, _adminUser } = req.body;
            
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
                .input('hasDueDate', sql.Bit, hasDueDate ? 1 : 0)
                .input('isRecurring', sql.Bit, isRecurring ? 1 : 0)
                .input('recurrenceConfig', sql.NVarChar, recurrenceConfig ? JSON.stringify(recurrenceConfig) : null)
                .query(`INSERT INTO Tasks (Id, Title, Description, Type, Status, CreatedAt, DueDate, AssignedTo, Instructions, ManualAttachments, DeviceId, MaintenanceType, MaintenanceCost, MaintenanceItems, HasDueDate, IsRecurring, RecurrenceConfig) 
                        VALUES (@id, @title, @description, @type, @status, GETDATE(), @dueDate, @assignedTo, @instructions, @manualAttachments, @deviceId, @maintenanceType, @maintenanceCost, @maintenanceItems, @hasDueDate, @isRecurring, @recurrenceConfig)`);

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
                if (key.startsWith('_') || (key !== 'hasDueDate' && key !== 'isRecurring' && key !== 'recurrenceConfig' && IGexternal_CRUD_KEYS.includes(key))) continue;
                
                let val = req.body[key];
                if (key === 'evidenceUrls' || key === 'manualAttachments' || key === 'maintenanceItems' || key === 'recurrenceConfig') {
                    val = val ? JSON.stringify(val) : null;
                }
                if (val === undefined) continue;

                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (val === null) {
                    request.input(dbKey, sql.NVarChar, null); // Usando NVarChar como fallback genérico para null
                } else {
                    request.input(dbKey, val);
                }
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

    // --- CONSUMABLES ---
    app.get('/api/consumables', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query(`
                SELECT 
                    c.*,
                    ISNULL((
                        SELECT SUM(Quantity) 
                        FROM ConsumableTransactions 
                        WHERE ConsumableId = c.Id AND Type = 'OUT' AND Date >= DATEADD(day, -30, GETDATE())
                    ), 0) as UsedLast30Days
                FROM Consumables c
                ORDER BY c.Name ASC
            `);
            
            const consumables = result.recordset.map(c => {
                const avgDaily = c.UsedLast30Days / 30;
                const estimatedDays = avgDaily > 0 ? Math.floor(c.CurrentStock / avgDaily) : null;
                return {
                    ...c,
                    AvgDailyConsumption: avgDaily,
                    EstimatedDaysLeft: estimatedDays
                };
            });

            res.json(consumables);
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.post('/api/consumables', async (req, res) => {
        try {
            const { name, category, currentStock, minStock, unit, adminUser } = req.body;
            const id = 'cons-' + Date.now();
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.NVarChar, id)
                .input('name', sql.NVarChar, name)
                .input('category', sql.NVarChar, category)
                .input('currentStock', sql.Int, currentStock || 0)
                .input('minStock', sql.Int, minStock || 0)
                .input('unit', sql.NVarChar, unit)
                .query(`
                    INSERT INTO Consumables (Id, Name, Category, CurrentStock, MinStock, Unit)
                    VALUES (@id, @name, @category, @currentStock, @minStock, @unit)
                `);
            
            if (currentStock > 0) {
                await pool.request()
                    .input('tId', sql.NVarChar, 'ctrans-' + Date.now())
                    .input('cId', sql.NVarChar, id)
                    .input('type', sql.NVarChar, 'IN')
                    .input('qty', sql.Int, currentStock)
                    .input('admin', sql.NVarChar, adminUser || 'Sistema')
                    .input('notes', sql.NVarChar, 'Estoque inicial')
                    .query(`
                        INSERT INTO ConsumableTransactions (Id, ConsumableId, Type, Quantity, AdminUser, Notes)
                        VALUES (@tId, @cId, @type, @qty, @admin, @notes)
                    `);
            }

            res.json({ success: true, id });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.post('/api/consumables/:id/transaction', async (req, res) => {
        try {
            const { id } = req.params;
            const { type, quantity, notes, adminUser } = req.body;
            
            if (!['IN', 'OUT'].includes(type) || quantity <= 0) {
                return res.status(400).json({ error: 'Transação inválida' });
            }

            const pool = await sql.connect(dbConfig);
            
            if (type === 'OUT') {
                const check = await pool.request()
                    .input('id', sql.NVarChar, id)
                    .query('SELECT CurrentStock FROM Consumables WHERE Id = @id');
                if (check.recordset.length === 0) return res.status(404).json({ error: 'Consumível não encontrado' });
                if (check.recordset[0].CurrentStock < quantity) {
                    return res.status(400).json({ error: 'Estoque insuficiente' });
                }
            }

            const tId = 'ctrans-' + Date.now();
            const stockModifier = type === 'IN' ? quantity : -quantity;
            
            await pool.request()
                .input('id', sql.NVarChar, id)
                .input('qty', sql.Int, stockModifier)
                .query('UPDATE Consumables SET CurrentStock = CurrentStock + @qty WHERE Id = @id');

            await pool.request()
                .input('tId', sql.NVarChar, tId)
                .input('cId', sql.NVarChar, id)
                .input('type', sql.NVarChar, type)
                .input('qty', sql.Int, quantity)
                .input('admin', sql.NVarChar, adminUser || 'Sistema')
                .input('notes', sql.NVarChar, notes || '')
                .query(`
                    INSERT INTO ConsumableTransactions (Id, ConsumableId, Type, Quantity, AdminUser, Notes)
                    VALUES (@tId, @cId, @type, @qty, @admin, @notes)
                `);

            res.json({ success: true });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.put('/api/consumables/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, category, minStock, unit } = req.body;
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.NVarChar, id)
                .input('name', sql.NVarChar, name)
                .input('category', sql.NVarChar, category)
                .input('minStock', sql.Int, minStock)
                .input('unit', sql.NVarChar, unit)
                .query(`
                    UPDATE Consumables 
                    SET Name = @name, Category = @category, MinStock = @minStock, Unit = @unit
                    WHERE Id = @id
                `);
            res.json({ success: true });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.delete('/api/consumables/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.NVarChar, id)
                .query('DELETE FROM Consumables WHERE Id = @id');
            res.json({ success: true });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.get('/api/consumables/transactions', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query(`
                SELECT 
                    t.*,
                    c.Name as ConsumableName
                FROM ConsumableTransactions t
                JOIN Consumables c ON t.ConsumableId = c.Id
                ORDER BY t.Date DESC
            `);
            res.json(result.recordset);
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    
    // --- ZABBIX INTEGRATION ---
    app.get('/api/zabbix/config', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT TOP 1 ZabbixUrl, ZabbixToken FROM SystemSettings");
            res.json(result.recordset[0] || {});
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.post('/api/zabbix/config', async (req, res) => {
        try {
            const { zabbixUrl, zabbixToken } = req.body;
            const pool = await sql.connect(dbConfig);
            const check = await pool.request().query("SELECT COUNT(*) as count FROM SystemSettings");
            if (check.recordset[0].count === 0) {
                await pool.request()
                    .input('url', sql.NVarChar, zabbixUrl)
                    .input('token', sql.NVarChar, zabbixToken)
                    .query("INSERT INTO SystemSettings (ZabbixUrl, ZabbixToken) VALUES (@url, @token)");
            } else {
                await pool.request()
                    .input('url', sql.NVarChar, zabbixUrl)
                    .input('token', sql.NVarChar, zabbixToken)
                    .query("UPDATE SystemSettings SET ZabbixUrl=@url, ZabbixToken=@token");
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    // Helper proxy to Zabbix API
    app.post('/api/zabbix/rpc', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const sys = await pool.request().query("SELECT TOP 1 ZabbixUrl, ZabbixToken FROM SystemSettings");
            if (!sys.recordset[0] || !sys.recordset[0].ZabbixUrl || !sys.recordset[0].ZabbixToken) {
                return res.status(400).json({ error: 'Zabbix não configurado' });
            }
            
            const zabbixUrl = sys.recordset[0].ZabbixUrl.trim().replace(/\/$/, '') + '/api_jsonrpc.php';
            const zabbixToken = sys.recordset[0].ZabbixToken.trim();
            
            const payload = { ...req.body };
            payload.auth = zabbixToken;
            
            let response = await fetch(zabbixUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            let data = await response.json();
            
            // Se falhar devido ao parâmetro 'auth' não ser aceito (comum no Zabbix 6.4+ / 7.0+)
            if (data && data.error && (
                (data.error.message && data.error.message.includes('unexpected parameter "auth"')) ||
                (data.error.data && data.error.data.includes('unexpected parameter "auth"'))
            )) {
                const cleanPayload = { ...req.body };
                delete cleanPayload.auth;
                
                response = await fetch(zabbixUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${zabbixToken}`
                    },
                    body: JSON.stringify(cleanPayload)
                });
                data = await response.json();
            }
            
            res.json(data);
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    // Registrar contagem de páginas para o histórico local
    app.post('/api/zabbix/log-pages', async (req, res) => {
        try {
            const { deviceId, zabbixHostId, pageCount } = req.body;
            if (!deviceId || !zabbixHostId || pageCount === undefined || isNaN(parseInt(pageCount))) {
                return res.status(400).json({ error: 'Parâmetros inválidos ou ausentes.' });
            }

            const pool = await sql.connect(dbConfig);
            
            // Verifica se já existe registro para o dia de hoje
            const check = await pool.request()
                .input('deviceId', sql.NVarChar, deviceId)
                .query(`
                    SELECT Id FROM PrinterPageHistory 
                    WHERE DeviceId = @deviceId 
                    AND Date = CAST(GETDATE() AS DATE)
                `);

            if (check.recordset.length > 0) {
                // Atualiza se houver nova contagem de páginas hoje
                await pool.request()
                    .input('deviceId', sql.NVarChar, deviceId)
                    .input('pageCount', sql.Int, parseInt(pageCount))
                    .query(`
                        UPDATE PrinterPageHistory 
                        SET PageCount = @pageCount, Timestamp = GETDATE()
                        WHERE DeviceId = @deviceId 
                        AND Date = CAST(GETDATE() AS DATE)
                    `);
            } else {
                // Insere se for a primeira do dia
                const id = 'PPH-' + Math.random().toString(36).substring(2, 11).toUpperCase();
                await pool.request()
                    .input('id', sql.NVarChar, id)
                    .input('deviceId', sql.NVarChar, deviceId)
                    .input('zabbixHostId', sql.NVarChar, zabbixHostId)
                    .input('pageCount', sql.Int, parseInt(pageCount))
                    .query(`
                        INSERT INTO PrinterPageHistory (Id, DeviceId, ZabbixHostId, PageCount, Date)
                        VALUES (@id, @deviceId, @zabbixHostId, @pageCount, CAST(GETDATE() AS DATE))
                    `);
            }

            res.json({ success: true });
        } catch (err) {
            console.error('Erro em POST /api/zabbix/log-pages:', err);
            res.status(500).send(err.message);
        }
    });

    // Retorna o histórico de contagem de páginas de um dispositivo específico para plotagem
    app.get('/api/zabbix/page-history/:deviceId', async (req, res) => {
        try {
            const { deviceId } = req.params;
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('deviceId', sql.NVarChar, deviceId)
                .query(`
                    SELECT Date, PageCount 
                    FROM PrinterPageHistory 
                    WHERE DeviceId = @deviceId 
                    ORDER BY Date ASC
                `);
            res.json(result.recordset);
        } catch (err) {
            console.error('Erro em GET /api/zabbix/page-history/:deviceId:', err);
            res.status(500).send(err.message);
        }
    });

    // Relatório consolidado de contagem de páginas por impressora
    app.get('/api/zabbix/report/printers', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const pool = await sql.connect(dbConfig);
            
            let dateFilter = '';
            if (startDate && endDate) {
                dateFilter = `AND h.Date BETWEEN @startDate AND @endDate`;
            } else if (startDate) {
                dateFilter = `AND h.Date >= @startDate`;
            } else if (endDate) {
                dateFilter = `AND h.Date <= @endDate`;
            }

            const request = pool.request();
            if (startDate) request.input('startDate', sql.VarChar, startDate);
            if (endDate) request.input('endDate', sql.VarChar, endDate);

            const query = `
                WITH AggregatedHistory AS (
                    SELECT 
                        DeviceId,
                        MIN(PageCount) as MinPages,
                        MAX(PageCount) as MaxPages,
                        COUNT(Id) as RecordsCount
                    FROM PrinterPageHistory h
                    WHERE 1=1 ${dateFilter}
                    GROUP BY DeviceId
                )
                SELECT 
                    d.Id as DeviceId,
                    d.AssetTag,
                    d.SerialNumber,
                    m.Name as ModelName,
                    b.Name as BrandName,
                    s.Name as SectorName,
                    a.MinPages,
                    a.MaxPages,
                    (a.MaxPages - a.MinPages) as ConsumedPages,
                    a.RecordsCount
                FROM AggregatedHistory a
                INNER JOIN Devices d ON a.DeviceId = d.Id
                LEFT JOIN Models m ON d.ModelId = m.Id
                LEFT JOIN Brands b ON m.BrandId = b.Id
                LEFT JOIN Sectors s ON d.SectorId = s.Id
                ORDER BY ConsumedPages DESC
            `;

            const result = await request.query(query);
            res.json(result.recordset);
        } catch (err) {
            console.error('Erro em GET /api/zabbix/report/printers:', err);
            res.status(500).send(err.message);
        }
    });

    // --- LICENSING SYSTEM ---
    app.post('/api/license/update', async (req, res) => {
        try {
            const { licenseKey } = req.body;
            const secret = process.env.JWT_SECRET || 'fallback_secret_change_me';
            
            const decoded = jwt.verify(licenseKey, secret);
            
            // Flexibilidade: aceita 'client' ou 'customer', e 'expiresAt' ou 'exp'
            const client = decoded.client || decoded.customer;
            const expiresAtRaw = decoded.expiresAt || (decoded.exp ? new Date(decoded.exp * 1000) : null);

            if (!client || !expiresAtRaw) {
                console.error('Falha na validação da licença. Payload recebido:', decoded);
                return res.status(400).json({ 
                    error: 'Licença inválida: Campos obrigatórios ausentes (client/expiresAt)',
                    receivedKeys: Object.keys(decoded)
                });
            }

            const expiresAt = new Date(expiresAtRaw);
            if (expiresAt < new Date()) {
                return res.status(400).json({ error: 'Licença expirada' });
            }

            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('key', sql.NVarChar, licenseKey)
                .input('client', sql.NVarChar, client)
                .input('expires', sql.DateTime, expiresAt)
                .query("UPDATE SystemSettings SET LicenseKey=@key, LicenseClient=@client, LicenseExpires=@expires");

            res.json({ success: true, client, expiresAt });
        } catch (err) {
            console.error('Erro JWT:', err.message);
            res.status(400).json({ error: 'Erro ao validar licença: ' + err.message });
        }
    });

    app.post('/api/system/license', async (req, res) => {
        try {
            const { licenseKey } = req.body;
            const secret = process.env.JWT_SECRET || 'fallback_secret_change_me';
            
            const decoded = jwt.verify(licenseKey, secret);
            
            if (!decoded.client || !decoded.expiresAt) {
                return res.status(400).json({ error: 'Licença inválida: Campos obrigatórios ausentes' });
            }

            const expiresAt = new Date(decoded.expiresAt);
            if (expiresAt < new Date()) {
                return res.status(400).json({ error: 'Licença expirada' });
            }

            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('key', sql.NVarChar, licenseKey)
                .input('client', sql.NVarChar, decoded.client)
                .input('expires', sql.DateTime, expiresAt)
                .query("UPDATE SystemSettings SET LicenseKey=@key, LicenseClient=@client, LicenseExpires=@expires");

            res.json({ success: true, client: decoded.client, expiresAt });
        } catch (err) {
            res.status(400).json({ error: 'Erro ao validar licença: ' + err.message });
        }
    });

    app.get('/api/license/status', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT TOP 1 LicenseClient as client, LicenseExpires as expiresAt FROM SystemSettings");
            const license = result.recordset[0];

            if (!license || !license.expiresAt) {
                return res.json({ status: 'EXPIRED', client: 'Nenhum', expiresAt: null });
            }

            const now = new Date();
            const expiresAt = new Date(license.expiresAt);
            
            if (expiresAt < now) {
                return res.json({ status: 'EXPIRED', client: license.client, expiresAt });
            }

            res.json({ status: 'ACTIVE', client: license.client, expiresAt });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.get('/api/models/:id/image', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id', sql.NVarChar, req.params.id)
                .query("SELECT ImageBinary FROM Models WHERE Id = @id");
            
            const row = result.recordset[0];
            if (!row || !row.ImageBinary) {
                return res.status(404).send('Imagem não encontrada');
            }

            // Define Cache-Control para 30 dias (cache do navegador)
            res.set('Cache-Control', 'public, max-age=2592000');
            res.set('Content-Type', 'image/png'); // Tenta PNG por padrão ou detecta se necessário
            res.send(row.ImageBinary);
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    app.get('/api/system/status', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT TOP 1 LicenseClient as client, LicenseExpires as expiresAt FROM SystemSettings");
            const license = result.recordset[0];

            if (!license || !license.expiresAt) {
                return res.json({ status: 'EXPIRED', client: 'Nenhum', expiresAt: null });
            }

            const now = new Date();
            const expiresAt = new Date(license.expiresAt);
            
            if (expiresAt < now) {
                return res.json({ status: 'EXPIRED', client: license.client, expiresAt });
            }

            res.json({ status: 'ACTIVE', client: license.client, expiresAt });
        } catch (err) {
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

    // === INTEGRAÇÃO ERP: Relógio de Ponto RH (Banco de Horas) ===
    app.post('/api/erp/rh-ponto/sync', async (req, res) => {
        try {
            const { server: pontoServer, database, user, password, port, selectionQuery } = req.body;

            if (!pontoServer || !user || !password) {
                return res.status(400).json({ success: false, error: 'Parâmetros de conexão incompletos. Informe servidor, usuário e senha.' });
            }

            const pontoConfig = {
                server: pontoServer,
                database: database || 'PontoSecullum4',
                user: user,
                password: password,
                port: port ? parseInt(port) : 1433,
                options: { encrypt: false, trustServerCertificate: true },
                requestTimeout: 30000,
                connectionTimeout: 15000
            };

            const defaultQuery = `
                WITH UltimosFechamentos AS (
                    SELECT 
                        funcionario_id,
                        COALESCE(MAX(data), '1900-01-01') AS DataLimite
                    FROM calculos
                    WHERE bajuste_obs = 'Encerramento do Banco de Horas'
                    GROUP BY funcionario_id
                ),
                SomaMinutos AS (
                    SELECT 
                        c.funcionario_id,
                        SUM(c.btotal) AS TotalMinutos
                    FROM calculos c
                    INNER JOIN UltimosFechamentos uf ON c.funcionario_id = uf.funcionario_id
                    WHERE c.data > uf.DataLimite
                      AND c.data < CAST(GETDATE() AS DATE)
                    GROUP BY c.funcionario_id
                )
                SELECT 
                    f.id AS funcionario_id,
                    f.nome,
                    f.n_pis,
                    COALESCE(
                        CASE WHEN sm.TotalMinutos < 0 THEN '-' ELSE '' END +
                        CAST(ABS(sm.TotalMinutos) / 60 AS VARCHAR(10)) + ':' +
                        RIGHT('0' + CAST(ABS(sm.TotalMinutos) % 60 AS VARCHAR(2)), 2),
                        '0:00'
                    ) AS total_banco
                FROM funcionarios f
                LEFT JOIN SomaMinutos sm ON f.id = sm.funcionario_id
                WHERE f.demissao IS NULL
                  AND f.invisivel = 0
                ORDER BY f.nome;
            `;

            const finalQuery = (selectionQuery && selectionQuery.trim()) ? selectionQuery : defaultQuery;

            // Usa ConnectionPool dedicado (isolado do pool principal) para o banco do relógio
            const poolPonto = await new sql.ConnectionPool(pontoConfig).connect();
            let result;
            try {
                result = await poolPonto.request().query(finalQuery);
            } finally {
                try { await poolPonto.close(); } catch (e) {}
            }

            res.json({ success: true, count: result.recordset.length, records: result.recordset });
        } catch (err) {
            console.error('[ERP Ponto] Erro na sincronização do relógio de ponto:', err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Vite middleware para desenvolvimento ou produção
    if (process.env.NODE_ENV !== "production") {
        const { createServer: createViteServer } = require("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const path = require("path");
        const distPath = path.join(process.cwd(), "build");
        
        // Servir arquivos estáticos (CSS, JS, imagens) se existirem
        app.use((req, res, next) => {
            if (!req.url.startsWith('/api') && req.url !== '/healthcheck') {
                return express.static(distPath)(req, res, next);
            }
            next();
        });

        // Rota de Healthcheck e SPA Fallback
        app.get("*", (req, res, next) => {
            if (req.url === '/healthcheck' || req.url === '/api/healthcheck') {
                return res.json({ status: 'ok', version: `v${packageJson.version}` });
            }
            if (req.url.startsWith('/api')) {
                return next(); // Passa para o tratador de erro 404 da API
            }
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, () => {
        console.log(`🚀 Servidor v${packageJson.version} rodando na porta ${PORT}`);
    });
}

// Inicia o processo com fallback caso o banco falhe
async function boot() {
    try {
        await initializeDatabase();
        console.log("✅ Banco de dados inicializado com sucesso.");
    } catch (e) {
        console.error("❌ Falha crítica na inicialização do banco de dados:", e.message);
        console.log("⚠️ Iniciando servidor em modo degradado (sem banco).");
    }
    startServer();
}

boot();

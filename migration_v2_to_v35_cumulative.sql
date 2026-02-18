-- ========================================================
-- SCRIPT DE MIGRAÇÃO CUMULATIVO: v2.12.40 -> v3.5.0
-- FOCO: Auditoria JSON, Snapshots de Termos e TCO
-- ========================================================

PRINT 'Iniciando Migração para Helios v3.5.0...';

-- 1. ATUALIZAÇÃO DA TABELA DE AUDITORIA (Suporte a Diff JSON)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'PreviousData')
BEGIN
    ALTER TABLE AuditLogs ADD PreviousData NVARCHAR(MAX) NULL;
    PRINT 'Coluna PreviousData adicionada a AuditLogs.';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'NewData')
BEGIN
    ALTER TABLE AuditLogs ADD NewData NVARCHAR(MAX) NULL;
    PRINT 'Coluna NewData adicionada a AuditLogs.';
END

-- 2. ATUALIZAÇÃO DA TABELA DE TERMOS (Suporte a Reimpressão Fiel)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Terms') AND name = 'SnapshotData')
BEGIN
    ALTER TABLE Terms ADD SnapshotData NVARCHAR(MAX) NULL;
    PRINT 'Coluna SnapshotData adicionada a Terms.';
END

-- 3. CRIAÇÃO DA TABELA DE TIMELINE (Histórico Granular)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetTimeline')
BEGIN
    CREATE TABLE AssetTimeline (
        Id NVARCHAR(50) PRIMARY KEY,
        DeviceId NVARCHAR(50) NOT NULL,
        EventType NVARCHAR(50) NOT NULL, -- 'CHECKOUT', 'CHECKIN', 'MAINTENANCE', 'REPAIR_FINISHED'
        EventDate DATETIME2 DEFAULT GETDATE(),
        UserId NVARCHAR(50) NULL,
        AdminUser NVARCHAR(100) NOT NULL,
        Notes NVARCHAR(MAX),
        SnapshotData NVARCHAR(MAX), 
        CONSTRAINT FK_Timeline_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(Id) ON DELETE CASCADE
    );
    PRINT 'Tabela AssetTimeline criada.';
END

-- 4. CRIAÇÃO DA TABELA DE GARANTIAS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetWarranty')
BEGIN
    CREATE TABLE AssetWarranty (
        Id NVARCHAR(50) PRIMARY KEY,
        DeviceId NVARCHAR(50) NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        ProviderName NVARCHAR(100),
        WarrantyType NVARCHAR(50), 
        SupportContact NVARCHAR(255),
        CONSTRAINT FK_Warranty_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(Id) ON DELETE CASCADE
    );
    PRINT 'Tabela AssetWarranty criada.';
END

-- 5. VIEW FINANCEIRA PARA DASHBOARD (TCO)
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_FinancialOverview')
    DROP VIEW vw_FinancialOverview;
GO

CREATE VIEW vw_FinancialOverview AS
SELECT 
    D.Id as DeviceId,
    D.AssetTag,
    D.PurchaseCost,
    D.PurchaseDate,
    ISNULL(SUM(M.Cost), 0) as TotalMaintenanceCost,
    (D.PurchaseCost + ISNULL(SUM(M.Cost), 0)) as TCO,
    DATEDIFF(MONTH, D.PurchaseDate, GETDATE()) as AgeInMonths
FROM Devices D
LEFT JOIN MaintenanceRecords M ON D.Id = M.DeviceId
GROUP BY D.Id, D.AssetTag, D.PurchaseCost, D.PurchaseDate;
GO
PRINT 'View vw_FinancialOverview (re)criada.';

-- 6. GARANTIR QUE OS CAMPOS DE NF EXISTAM (Caso vindo de v2 antiga)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'PurchaseInvoiceUrl')
BEGIN
    ALTER TABLE Devices ADD PurchaseInvoiceUrl NVARCHAR(MAX) NULL;
    PRINT 'Coluna PurchaseInvoiceUrl adicionada a Devices.';
END

PRINT '>>> Migração v3.5.0 concluída com sucesso! <<<';
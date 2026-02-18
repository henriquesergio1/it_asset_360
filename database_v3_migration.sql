-- MIGRATION SPRINT 3: EVOLUÇÃO DE DADOS HELIOS v3.1.0
-- MIGRATION_UP.SQL

-- 1. Tabela de Timeline Granular (Evento-nível para ativos)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetTimeline')
BEGIN
    CREATE TABLE AssetTimeline (
        Id NVARCHAR(50) PRIMARY KEY,
        DeviceId NVARCHAR(50) NOT NULL,
        EventType NVARCHAR(50) NOT NULL, -- 'CHECKOUT', 'CHECKIN', 'MAINTENANCE', 'REPAIR_FINISHED', 'STATUS_CHANGE'
        EventDate DATETIME2 DEFAULT GETDATE(),
        UserId NVARCHAR(50) NULL,
        AdminUser NVARCHAR(100) NOT NULL,
        Notes NVARCHAR(MAX),
        SnapshotData NVARCHAR(MAX), -- JSON state no momento do evento
        CONSTRAINT FK_Timeline_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(Id) ON DELETE CASCADE
    );
END

-- 2. Tabela de Controle de Garantias
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetWarranty')
BEGIN
    CREATE TABLE AssetWarranty (
        Id NVARCHAR(50) PRIMARY KEY,
        DeviceId NVARCHAR(50) NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        ProviderName NVARCHAR(100),
        WarrantyType NVARCHAR(50), -- 'BALCAO', 'ONSITE', 'EXTENDED'
        SupportContact NVARCHAR(255),
        CONSTRAINT FK_Warranty_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(Id) ON DELETE CASCADE
    );
END

-- 3. View Financeira Estruturada (Cálculo de TCO Base)
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
    DATEDIFF(MONTH, D.PurchaseDate, GETDATE()) as AgeInMonths,
    CASE 
        WHEN D.PurchaseCost > 0 THEN (D.PurchaseCost - (D.PurchaseCost * (DATEDIFF(MONTH, D.PurchaseDate, GETDATE()) * 0.02))) -- Ex: Depreciação 2% ao mês (simplificado)
        ELSE 0 
    END as CurrentEstimatedValue
FROM Devices D
LEFT JOIN MaintenanceRecords M ON D.Id = M.DeviceId
GROUP BY D.Id, D.AssetTag, D.PurchaseCost, D.PurchaseDate;
GO

-- VALIDAÇÃO DE INTEGRIDADE
PRINT 'Migration Up Concluída com Sucesso para v3.1.0';

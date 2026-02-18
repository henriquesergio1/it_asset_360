-- MIGRATION SPRINT 4: SNAPSHOT DE TERMOS v3.5.0
-- MIGRATION_UP.SQL

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Terms') AND name = 'SnapshotData')
BEGIN
    ALTER TABLE Terms ADD SnapshotData NVARCHAR(MAX) NULL;
    PRINT 'Coluna SnapshotData adicionada à tabela Terms.';
END
ELSE
BEGIN
    PRINT 'Coluna SnapshotData já existe na tabela Terms.';
END

-- VALIDAÇÃO DE INTEGRIDADE
PRINT 'Migration v3.5.0 Concluída com Sucesso.';
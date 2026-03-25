const express = require('express');
const packageJson = require('./package.json');
const cors = require('cors');
require('dotenv').config();
const { sql, dbConfig, DB_SCHEMAS } = require('./server/utils/db');

const PORT = process.env.PORT || 5000;
const app = express();

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
        { table: 'SimCards', column: 'Provider', name: 'IX_SimCards_Provider' }
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
                    }
                    const checkManualAttachments = await pool.request().query(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'ManualAttachments'`);
                    if (checkManualAttachments.recordset.length === 0) {
                        console.log(`- Coluna ManualAttachments não encontrada em Tasks. Adicionando...`);
                        await pool.request().query('ALTER TABLE Tasks ADD ManualAttachments NVARCHAR(MAX) NULL');
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

        await createIndexes(pool);
        console.log('Banco de dados pronto.');
    } catch (err) {
        console.error('ERRO FATAL na inicialização do banco de dados:', err.message);
        process.exit(1);
    }
}

async function fixSimStatus() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log('Verificando consistência de status de SIM Cards...');

        const devicesRes = await pool.request().query("SELECT LinkedSimId FROM Devices WHERE LinkedSimId IS NOT NULL AND Status != 'Descartado'");
        const devices = devicesRes.recordset;

        const assignedSimsRes = await pool.request().query("SELECT Id FROM SimCards WHERE CurrentUserId IS NOT NULL AND Status != 'Descartado'");
        const assignedSims = assignedSimsRes.recordset;

        const inUseSimIds = new Set([
            ...devices.map(d => d.LinkedSimId),
            ...assignedSims.map(s => s.Id)
        ]);

        const allSimsRes = await pool.request().query("SELECT Id, Status FROM SimCards");
        const allSims = allSimsRes.recordset;

        let updatedCount = 0;
        const updates = [];

        for (const sim of allSims) {
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
    await fixSimStatus();

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // --- HEALTH CHECK ---
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'ok', 
            version: packageJson.version, 
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    });

    // --- ROUTES ---
    require('./server/routes/main')(app);
    require('./server/routes/crud')(app);
    require('./server/routes/logs')(app);
    require('./server/routes/devices')(app);
    require('./server/routes/tasks')(app);
    require('./server/routes/maintenances')(app);
    require('./server/routes/terms')(app);

    app.listen(PORT, () => {
        console.log(`🚀 Servidor v${packageJson.version} rodando na porta ${PORT}`);
    });
}

initializeDatabase().then(startServer);

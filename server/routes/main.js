const { sql, dbConfig, format, getBase64FromBuffer } = require('../utils/db');

module.exports = (app) => {
    app.get('/api/bootstrap', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const [
                devicesRes, simsRes, usersRes, sysUsersRes, settingsRes,
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
                devices, sims: format(simsRes), users: format(usersRes), systemUsers: sysUsersRes.recordset,
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

    app.get('/api/sync', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const [devicesRes, simsRes, usersRes, maintRes, termsRes, accountsRes, tasksRes] = await Promise.all([
                pool.request().query("SELECT Id, AssetTag, Status, ModelId, SerialNumber, InternalCode, Imei, PulsusId, CurrentUserId, SectorId, CostCenter, LinkedSimId, PurchaseDate, PurchaseCost, InvoiceNumber, Supplier, CustomData, (CASE WHEN PurchaseInvoiceBinary IS NOT NULL THEN 1 ELSE 0 END) as hasInvoice FROM Devices"),
                pool.request().query(`
                    SELECT 
                        s.Id, s.PhoneNumber, s.Operator, s.Iccid, s.Status, s.PlanDetails,
                        COALESCE(s.CurrentUserId, d.CurrentUserId) as CurrentUserId
                    FROM SimCards s
                    LEFT JOIN Devices d ON d.LinkedSimId = s.Id
                `),
                pool.request().query("SELECT * FROM Users"),
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
                devices, sims: format(simsRes), users: format(usersRes),
                maintenances: format(maintRes).map(m => ({ ...m, hasInvoice: m.hasInvoice === 1 })),
                terms: format(termsRes).map(t => ({ ...t, hasFile: t.hasFile === 1 })),
                accounts: format(accountsRes, ['UserIds', 'DeviceIds']),
                tasks: format(tasksRes, ['EvidenceUrls', 'ManualAttachments', 'MaintenanceItems'])
            });
        } catch (err) { res.status(500).send(err.message); }
    });
};

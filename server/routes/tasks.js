const { sql, dbConfig, format, getBufferFromBase64 } = require('../utils/db');

const IGexternal_CRUD_KEYS = ['accessories', 'terms', 'hasInvoice', 'hasFile', 'customDataStr', 'hasDueDate', 'isRecurring', 'recurrenceConfig', 'parentId'];

module.exports = (app) => {
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
            
            const oldRes = await pool.request().input('id', sql.NVarChar, id).query("SELECT * FROM Tasks WHERE Id = @id");
            const prev = oldRes.recordset[0];
            if (!prev) return res.status(404).send('Tarefa não encontrada');

            const request = pool.request();
            let sets = [];
            const processedKeys = new Set();
            
            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                
                const val = (key === 'evidenceUrls' || key === 'manualAttachments' || key === 'maintenanceItems') ? JSON.stringify(req.body[key]) : req.body[key];
                if (val === undefined) continue;

                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (val === null) {
                    request.input(dbKey, sql.NVarChar, null);
                } else {
                    request.input(dbKey, val);
                }
                sets.push(`${dbKey}=@${dbKey}`);
            }

            if (sets.length > 0) {
                request.input('TargetId', id);
                await request.query(`UPDATE Tasks SET ${sets.join(',')} WHERE Id=@TargetId`);
            }

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

                if (req.body.maintenanceItems && prev.Type === 'Manutenção') {
                    const oldItems = prev.MaintenanceItems ? JSON.parse(prev.MaintenanceItems) : [];
                    const newItems = req.body.maintenanceItems;
                    
                    for (const newItem of newItems) {
                        const oldItem = oldItems.find(i => i.deviceId === newItem.deviceId);
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

    app.post('/api/tasks/bulk', async (req, res) => {
        try {
            const { ids, updates, _adminUser } = req.body;
            const pool = await sql.connect(dbConfig);
            
            for (const id of ids) {
                const request = pool.request();
                const oldRes = await pool.request().input('id', sql.NVarChar, id).query("SELECT * FROM Tasks WHERE Id = @id");
                const prev = oldRes.recordset[0];
                
                let sets = [];
                for (let key in updates) {
                    if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                    let dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                    request.input(dbKey, updates[key]);
                    sets.push(`${dbKey}=@${dbKey}`);
                }
                
                if (sets.length > 0) {
                    request.input('TargetId', id);
                    await request.query(`UPDATE Tasks SET ${sets.join(',')} WHERE Id=@TargetId`);
                    
                    await pool.request()
                        .input('logId', sql.NVarChar, Math.random().toString(36).substring(2, 11))
                        .input('taskId', sql.NVarChar, id)
                        .input('action', sql.NVarChar, 'Atualização em Massa')
                        .input('adminUser', sql.NVarChar, _adminUser || 'Sistema')
                        .input('notes', sql.NVarChar, JSON.stringify(updates))
                        .query("INSERT INTO TaskLogs (Id, TaskId, Action, AdminUser, Timestamp, Notes) VALUES (@logId, @taskId, @action, @adminUser, GETDATE(), @notes)");
                }
            }
            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });
};

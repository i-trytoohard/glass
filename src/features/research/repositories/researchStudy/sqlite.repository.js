const sqliteClient = require('../../../common/services/sqliteClient');

function create(study) {
    const db = sqliteClient.getDb();
    
    const query = `
        INSERT INTO research_studies (
            id, uid, title, description, research_type, methodology, 
            participant_profile, goals, context, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
        db.prepare(query).run(
            study.id,
            study.uid,
            study.title,
            study.description || '',
            study.research_type || 'user_interview',
            study.methodology || 'semi_structured',
            study.participant_profile || '',
            study.goals || '',
            study.context || '',
            study.status || 'draft',
            study.created_at,
            study.updated_at
        );
        
        return getById(study.id, study.uid);
    } catch (err) {
        console.error('[ResearchStudy SQLite] Failed to create study:', err);
        throw err;
    }
}

function getById(studyId, uid) {
    const db = sqliteClient.getDb();
    const query = `SELECT * FROM research_studies WHERE id = ? AND uid = ?`;
    
    try {
        return db.prepare(query).get(studyId, uid);
    } catch (err) {
        console.error('[ResearchStudy SQLite] Failed to get study by ID:', err);
        throw err;
    }
}

function getAll(uid) {
    const db = sqliteClient.getDb();
    const query = `
        SELECT * FROM research_studies 
        WHERE uid = ? 
        ORDER BY updated_at DESC
    `;
    
    try {
        return db.prepare(query).all(uid);
    } catch (err) {
        console.error('[ResearchStudy SQLite] Failed to get all studies:', err);
        throw err;
    }
}

function update(studyId, updateData, uid) {
    const db = sqliteClient.getDb();
    
    const setClause = Object.keys(updateData)
        .map(key => `${key} = ?`)
        .join(', ');
    
    const query = `
        UPDATE research_studies 
        SET ${setClause}
        WHERE id = ? AND uid = ?
    `;
    
    const values = [...Object.values(updateData), studyId, uid];
    
    try {
        const result = db.prepare(query).run(...values);
        if (result.changes === 0) {
            throw new Error(`Study not found or not owned by user: ${studyId}`);
        }
        return getById(studyId, uid);
    } catch (err) {
        console.error('[ResearchStudy SQLite] Failed to update study:', err);
        throw err;
    }
}

function deleteById(studyId, uid) {
    const db = sqliteClient.getDb();
    const query = `DELETE FROM research_studies WHERE id = ? AND uid = ?`;
    
    try {
        const result = db.prepare(query).run(studyId, uid);
        return { success: result.changes > 0 };
    } catch (err) {
        console.error('[ResearchStudy SQLite] Failed to delete study:', err);
        throw err;
    }
}

function getByStatus(status, uid) {
    const db = sqliteClient.getDb();
    const query = `
        SELECT * FROM research_studies 
        WHERE status = ? AND uid = ? 
        ORDER BY updated_at DESC
    `;
    
    try {
        return db.prepare(query).all(status, uid);
    } catch (err) {
        console.error('[ResearchStudy SQLite] Failed to get studies by status:', err);
        throw err;
    }
}

module.exports = {
    create,
    getById,
    getAll,
    update,
    delete: deleteById,
    getByStatus
}; 
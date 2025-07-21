const sqliteClient = require('../../../common/services/sqliteClient');

function create(session) {
    const db = sqliteClient.getDb();
    
    const query = `
        INSERT INTO research_sessions (
            session_id, study_id, participant_id, participant_notes, 
            session_notes, research_mode, questions_asked, questions_completed, 
            session_quality_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
        db.prepare(query).run(
            session.session_id,
            session.study_id,
            session.participant_id || null,
            session.participant_notes || '',
            session.session_notes || '',
            session.research_mode || 'live',
            session.questions_asked || 0,
            session.questions_completed || 0,
            session.session_quality_score || 0.0,
            session.created_at
        );
        
        return getById(session.session_id);
    } catch (err) {
        console.error('[ResearchSession SQLite] Failed to create session:', err);
        throw err;
    }
}

function getById(sessionId) {
    const db = sqliteClient.getDb();
    const query = `SELECT * FROM research_sessions WHERE session_id = ?`;
    
    try {
        return db.prepare(query).get(sessionId);
    } catch (err) {
        console.error('[ResearchSession SQLite] Failed to get session by ID:', err);
        throw err;
    }
}

function update(sessionId, updateData) {
    const db = sqliteClient.getDb();
    
    const setClause = Object.keys(updateData)
        .map(key => `${key} = ?`)
        .join(', ');
    
    const query = `
        UPDATE research_sessions 
        SET ${setClause}
        WHERE session_id = ?
    `;
    
    const values = [...Object.values(updateData), sessionId];
    
    try {
        const result = db.prepare(query).run(...values);
        if (result.changes === 0) {
            throw new Error(`Research session not found: ${sessionId}`);
        }
        return getById(sessionId);
    } catch (err) {
        console.error('[ResearchSession SQLite] Failed to update session:', err);
        throw err;
    }
}

function getByStudyId(studyId) {
    const db = sqliteClient.getDb();
    const query = `
        SELECT * FROM research_sessions 
        WHERE study_id = ? 
        ORDER BY created_at DESC
    `;
    
    try {
        return db.prepare(query).all(studyId);
    } catch (err) {
        console.error('[ResearchSession SQLite] Failed to get sessions by study ID:', err);
        throw err;
    }
}

module.exports = {
    create,
    getById,
    update,
    getByStudyId
}; 
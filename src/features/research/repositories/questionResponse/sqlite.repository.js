const sqliteClient = require('../../../common/services/sqliteClient');

function createOrUpdate(response) {
    const db = sqliteClient.getDb();
    
    const query = `
        INSERT INTO question_responses (
            id, session_id, question_id, transcript_segment_start, 
            transcript_segment_end, response_text, completeness_score, 
            sentiment, key_insights, follow_up_needed, ai_confidence, 
            status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            transcript_segment_start = excluded.transcript_segment_start,
            transcript_segment_end = excluded.transcript_segment_end,
            response_text = excluded.response_text,
            completeness_score = excluded.completeness_score,
            sentiment = excluded.sentiment,
            key_insights = excluded.key_insights,
            follow_up_needed = excluded.follow_up_needed,
            ai_confidence = excluded.ai_confidence,
            status = excluded.status,
            updated_at = excluded.updated_at
    `;
    
    try {
        db.prepare(query).run(
            response.id,
            response.session_id,
            response.question_id,
            response.transcript_segment_start || null,
            response.transcript_segment_end || null,
            response.response_text || null,
            response.completeness_score || 0.0,
            response.sentiment || null,
            response.key_insights || null,
            response.follow_up_needed || 0,
            response.ai_confidence || 0.0,
            response.status || 'not_asked',
            response.created_at,
            response.updated_at
        );
        
        return getById(response.id);
    } catch (err) {
        console.error('[QuestionResponse SQLite] Failed to create/update response:', err);
        throw err;
    }
}

function getById(responseId) {
    const db = sqliteClient.getDb();
    const query = `SELECT * FROM question_responses WHERE id = ?`;
    
    try {
        return db.prepare(query).get(responseId);
    } catch (err) {
        console.error('[QuestionResponse SQLite] Failed to get response by ID:', err);
        throw err;
    }
}

function getBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    const query = `
        SELECT qr.*, rq.question_text, rq.category, rq.priority
        FROM question_responses qr
        JOIN research_questions rq ON qr.question_id = rq.id
        WHERE qr.session_id = ?
        ORDER BY rq.order_index ASC
    `;
    
    try {
        return db.prepare(query).all(sessionId);
    } catch (err) {
        console.error('[QuestionResponse SQLite] Failed to get responses by session ID:', err);
        throw err;
    }
}

function deleteByQuestionId(questionId) {
    const db = sqliteClient.getDb();
    const query = `DELETE FROM question_responses WHERE question_id = ?`;
    
    try {
        const result = db.prepare(query).run(questionId);
        return { success: true, deletedCount: result.changes };
    } catch (err) {
        console.error('[QuestionResponse SQLite] Failed to delete responses by question ID:', err);
        throw err;
    }
}

function deleteByStudyId(studyId) {
    const db = sqliteClient.getDb();
    const query = `
        DELETE FROM question_responses 
        WHERE question_id IN (
            SELECT id FROM research_questions WHERE study_id = ?
        )
    `;
    
    try {
        const result = db.prepare(query).run(studyId);
        return { success: true, deletedCount: result.changes };
    } catch (err) {
        console.error('[QuestionResponse SQLite] Failed to delete responses by study ID:', err);
        throw err;
    }
}

module.exports = {
    createOrUpdate,
    getById,
    getBySessionId,
    deleteByQuestionId,
    deleteByStudyId
}; 
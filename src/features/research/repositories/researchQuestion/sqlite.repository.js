const sqliteClient = require('../../../common/services/sqliteClient');

function create(question) {
    const db = sqliteClient.getDb();
    
    const query = `
        INSERT INTO research_questions (
            id, study_id, question_text, question_type, category, 
            priority, order_index, is_required, follow_up_hints, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
        db.prepare(query).run(
            question.id,
            question.study_id,
            question.question_text,
            question.question_type || 'open',
            question.category || 'behavior',
            question.priority || 'medium',
            question.order_index || 0,
            question.is_required || 0,
            question.follow_up_hints || '[]',
            question.created_at
        );
        
        return getById(question.id);
    } catch (err) {
        console.error('[ResearchQuestion SQLite] Failed to create question:', err);
        throw err;
    }
}

function getById(questionId) {
    const db = sqliteClient.getDb();
    const query = `SELECT * FROM research_questions WHERE id = ?`;
    
    try {
        return db.prepare(query).get(questionId);
    } catch (err) {
        console.error('[ResearchQuestion SQLite] Failed to get question by ID:', err);
        throw err;
    }
}

function getByStudyId(studyId) {
    const db = sqliteClient.getDb();
    const query = `
        SELECT * FROM research_questions 
        WHERE study_id = ? 
        ORDER BY order_index ASC, created_at ASC
    `;
    
    try {
        return db.prepare(query).all(studyId);
    } catch (err) {
        console.error('[ResearchQuestion SQLite] Failed to get questions by study ID:', err);
        throw err;
    }
}

function update(questionId, updateData) {
    const db = sqliteClient.getDb();
    
    const setClause = Object.keys(updateData)
        .map(key => `${key} = ?`)
        .join(', ');
    
    const query = `
        UPDATE research_questions 
        SET ${setClause}
        WHERE id = ?
    `;
    
    const values = [...Object.values(updateData), questionId];
    
    try {
        const result = db.prepare(query).run(...values);
        if (result.changes === 0) {
            throw new Error(`Question not found: ${questionId}`);
        }
        return getById(questionId);
    } catch (err) {
        console.error('[ResearchQuestion SQLite] Failed to update question:', err);
        throw err;
    }
}

function deleteById(questionId) {
    const db = sqliteClient.getDb();
    const query = `DELETE FROM research_questions WHERE id = ?`;
    
    try {
        const result = db.prepare(query).run(questionId);
        return { success: result.changes > 0 };
    } catch (err) {
        console.error('[ResearchQuestion SQLite] Failed to delete question:', err);
        throw err;
    }
}

function deleteByStudyId(studyId) {
    const db = sqliteClient.getDb();
    const query = `DELETE FROM research_questions WHERE study_id = ?`;
    
    try {
        const result = db.prepare(query).run(studyId);
        return { success: true, deletedCount: result.changes };
    } catch (err) {
        console.error('[ResearchQuestion SQLite] Failed to delete questions by study ID:', err);
        throw err;
    }
}

module.exports = {
    create,
    getById,
    getByStudyId,
    update,
    delete: deleteById,
    deleteByStudyId
}; 
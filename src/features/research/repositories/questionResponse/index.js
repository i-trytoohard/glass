const sqliteRepository = require('./sqlite.repository');

module.exports = {
    createOrUpdate: (response) => sqliteRepository.createOrUpdate(response),
    getById: (responseId) => sqliteRepository.getById(responseId),
    getBySessionId: (sessionId) => sqliteRepository.getBySessionId(sessionId),
    deleteByQuestionId: (questionId) => sqliteRepository.deleteByQuestionId(questionId),
    deleteByStudyId: (studyId) => sqliteRepository.deleteByStudyId(studyId)
}; 
const sqliteRepository = require('./sqlite.repository');

// Simple wrapper - questions are tied to studies which already have user context
const researchQuestionRepositoryAdapter = {
    create: (question) => sqliteRepository.create(question),
    getById: (questionId) => sqliteRepository.getById(questionId),
    getByStudyId: (studyId) => sqliteRepository.getByStudyId(studyId),
    update: (questionId, updateData) => sqliteRepository.update(questionId, updateData),
    delete: (questionId) => sqliteRepository.delete(questionId),
    deleteByStudyId: (studyId) => sqliteRepository.deleteByStudyId(studyId)
};

module.exports = researchQuestionRepositoryAdapter; 
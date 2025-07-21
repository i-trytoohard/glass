const sqliteRepository = require('./sqlite.repository');

module.exports = {
    create: (session) => sqliteRepository.create(session),
    getById: (sessionId) => sqliteRepository.getById(sessionId),
    update: (sessionId, updateData) => sqliteRepository.update(sessionId, updateData),
    getByStudyId: (studyId) => sqliteRepository.getByStudyId(studyId)
}; 
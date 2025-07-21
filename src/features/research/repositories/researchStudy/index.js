const sqliteRepository = require('./sqlite.repository');
// const firebaseRepository = require('./firebase.repository'); // TODO: Implement Firebase version

let authService = null;

function getAuthService() {
    if (!authService) {
        authService = require('../../../common/services/authService');
    }
    return authService;
}

function getBaseRepository() {
    const service = getAuthService();
    if (!service) {
        throw new Error('AuthService could not be loaded for the research study repository.');
    }
    const user = service.getCurrentUser();
    if (user && user.isLoggedIn) {
        // return firebaseRepository; // TODO: Implement Firebase version
        return sqliteRepository; // Fallback to SQLite for now
    }
    return sqliteRepository;
}

const researchStudyRepositoryAdapter = {
    create: (study) => {
        const uid = getAuthService().getCurrentUserId();
        return getBaseRepository().create({ uid, ...study });
    },
    
    getById: (studyId) => {
        const uid = getAuthService().getCurrentUserId();
        return getBaseRepository().getById(studyId, uid);
    },
    
    getAll: () => {
        const uid = getAuthService().getCurrentUserId();
        return getBaseRepository().getAll(uid);
    },
    
    update: (studyId, updateData) => {
        const uid = getAuthService().getCurrentUserId();
        return getBaseRepository().update(studyId, updateData, uid);
    },
    
    delete: (studyId) => {
        const uid = getAuthService().getCurrentUserId();
        return getBaseRepository().delete(studyId, uid);
    },
    
    getByStatus: (status) => {
        const uid = getAuthService().getCurrentUserId();
        return getBaseRepository().getByStatus(status, uid);
    }
};

module.exports = researchStudyRepositoryAdapter; 
// src/features/common/repositories/localStudies.js

/**
 * Local Studies Repository
 * Provides predefined research studies for the select study dropdown
 * Later these will be loaded from API servers
 */

const LOCAL_STUDIES = [
    {
        id: 'fintech-user-expectations',
        title: 'Fintech App User Expectations',
        description: 'UX research study to understand user expectations and preferences for fintech applications',
        research_type: 'user_interview',
        methodology: 'semi_structured',
        participant_profile: 'Age 18-35, active mobile banking users',
        goals: 'Understand user expectations, identify pain points, and discover desired features for fintech apps',
        status: 'active',
        questions: [
            {
                id: 'q1',
                question_text: "Can you describe your current experience with using fintech apps in general?",
                category: "experience",
                priority: "high",
                is_required: true,
                order_index: 0
            },
            {
                id: 'q2',
                question_text: "What are the most important tasks you want to accomplish using a fintech app?",
                category: "needs",
                priority: "high",
                is_required: true,
                order_index: 1
            },
            {
                id: 'q3',
                question_text: "Can you tell me about a time when a fintech app exceeded your expectations? What features stood out to you?",
                category: "positive_experience",
                priority: "medium",
                is_required: false,
                order_index: 2
            },
            {
                id: 'q4',
                question_text: "What are some frustrations or challenges you've encountered while using fintech apps?",
                category: "pain_points",
                priority: "high",
                is_required: true,
                order_index: 3
            },
            {
                id: 'q5',
                question_text: "How do you usually decide which fintech app to use? What factors influence your decision?",
                category: "decision_making",
                priority: "medium",
                is_required: false,
                order_index: 4
            },
            {
                id: 'q6',
                question_text: "Can you imagine an ideal fintech app that perfectly meets your needs? What features would it include?",
                category: "ideal_features",
                priority: "high",
                is_required: true,
                order_index: 5
            },
            {
                id: 'q7',
                question_text: "How do you prioritize different features in a fintech app? For example, security, ease of use, or variety of services?",
                category: "prioritization",
                priority: "medium",
                is_required: false,
                order_index: 6
            },
            {
                id: 'q8',
                question_text: "If you could improve one feature in the fintech apps you currently use, what would it be and why?",
                category: "improvement",
                priority: "medium",
                is_required: false,
                order_index: 7
            },
            {
                id: 'q9',
                question_text: "How do you feel about the security measures in fintech apps? Are there any specific features you expect in this area?",
                category: "security",
                priority: "high",
                is_required: true,
                order_index: 8
            }
        ],
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
    },
    {
        id: 'ecommerce-checkout-flow',
        title: 'E-commerce Checkout Experience',
        description: 'Research study focused on understanding user behavior and pain points during online checkout processes',
        research_type: 'user_interview',
        methodology: 'semi_structured',
        participant_profile: 'Age 25-45, frequent online shoppers',
        goals: 'Identify checkout flow bottlenecks, understand payment preferences, and optimize conversion rates',
        status: 'active',
        questions: [
            {
                id: 'ec1',
                question_text: "Walk me through your typical online shopping process from browsing to completing a purchase.",
                category: "behavior",
                priority: "high",
                is_required: true,
                order_index: 0
            },
            {
                id: 'ec2',
                question_text: "What factors cause you to abandon a shopping cart before completing your purchase?",
                category: "pain_points",
                priority: "high",
                is_required: true,
                order_index: 1
            },
            {
                id: 'ec3',
                question_text: "How important is it for you to see all costs upfront before starting checkout?",
                category: "transparency",
                priority: "high",
                is_required: true,
                order_index: 2
            },
            {
                id: 'ec4',
                question_text: "What payment methods do you prefer and why?",
                category: "payment_preferences",
                priority: "medium",
                is_required: false,
                order_index: 3
            },
            {
                id: 'ec5',
                question_text: "How do you feel about creating accounts versus guest checkout?",
                category: "account_creation",
                priority: "medium",
                is_required: false,
                order_index: 4
            }
        ],
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
    },
    {
        id: 'mobile-app-onboarding',
        title: 'Mobile App Onboarding Experience',
        description: 'Understanding how users experience first-time app setup and initial feature discovery',
        research_type: 'user_interview',
        methodology: 'semi_structured',
        participant_profile: 'Age 20-40, smartphone users who frequently download new apps',
        goals: 'Optimize first-time user experience, reduce onboarding dropout, and improve feature adoption',
        status: 'active',
        questions: [
            {
                id: 'mob1',
                question_text: "What typically motivates you to download and try a new app?",
                category: "motivation",
                priority: "high",
                is_required: true,
                order_index: 0
            },
            {
                id: 'mob2',
                question_text: "Describe your ideal onboarding experience for a new app.",
                category: "expectations",
                priority: "high",
                is_required: true,
                order_index: 1
            },
            {
                id: 'mob3',
                question_text: "What causes you to delete an app shortly after downloading it?",
                category: "pain_points",
                priority: "high",
                is_required: true,
                order_index: 2
            },
            {
                id: 'mob4',
                question_text: "How do you prefer to learn about new features in an app?",
                category: "feature_discovery",
                priority: "medium",
                is_required: false,
                order_index: 3
            }
        ],
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
    },
    {
        id: 'website-navigation-usability',
        title: 'Website Navigation & Information Architecture',
        description: 'Understanding how users navigate websites and find information to improve site structure and usability',
        research_type: 'user_interview',
        methodology: 'semi_structured',
        participant_profile: 'Age 22-50, regular website users across different industries',
        goals: 'Optimize website navigation, improve information findability, and reduce user confusion',
        status: 'active',
        questions: [
            {
                id: 'nav1',
                question_text: "When you visit a new website, what do you typically look for first to understand what the site offers?",
                category: "first_impressions",
                priority: "high",
                is_required: true,
                order_index: 0
            },
            {
                id: 'nav2',
                question_text: "Can you walk me through how you would typically find a specific piece of information on a website?",
                category: "search_behavior",
                priority: "high",
                is_required: true,
                order_index: 1
            },
            {
                id: 'nav3',
                question_text: "Tell me about a time when you got frustrated trying to find something on a website. What made it difficult?",
                category: "pain_points",
                priority: "high",
                is_required: true,
                order_index: 2
            },
            {
                id: 'nav4',
                question_text: "What are your expectations for a website's main navigation menu?",
                category: "navigation_expectations",
                priority: "medium",
                is_required: false,
                order_index: 3
            },
            {
                id: 'nav5',
                question_text: "How do you typically use search functionality on websites? What makes a good search experience?",
                category: "search_functionality",
                priority: "medium",
                is_required: false,
                order_index: 4
            },
            {
                id: 'nav6',
                question_text: "What visual cues help you understand where you are on a website and how to get back to previous pages?",
                category: "orientation",
                priority: "medium",
                is_required: false,
                order_index: 5
            }
        ],
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
    }
];

class LocalStudiesRepository {
    constructor() {
        this.studies = [...LOCAL_STUDIES];
    }

    /**
     * Get all available local studies
     * @returns {Array} Array of study objects
     */
    getAllStudies() {
        return this.studies.map(study => ({
            id: study.id,
            title: study.title,
            description: study.description,
            research_type: study.research_type,
            methodology: study.methodology,
            participant_profile: study.participant_profile,
            goals: study.goals,
            status: study.status,
            questions: study.questions, // Include the full questions array
            questionCount: study.questions.length,
            created_at: study.created_at,
            updated_at: study.updated_at
        }));
    }

    /**
     * Get a specific study by ID
     * @param {string} studyId - The study ID
     * @returns {Object|null} Study object or null if not found
     */
    getStudyById(studyId) {
        return this.studies.find(study => study.id === studyId) || null;
    }

    /**
     * Get questions for a specific study
     * @param {string} studyId - The study ID
     * @returns {Array} Array of question objects
     */
    getStudyQuestions(studyId) {
        const study = this.getStudyById(studyId);
        return study ? study.questions : [];
    }

    /**
     * Get studies by status
     * @param {string} status - Study status ('active', 'draft', 'completed')
     * @returns {Array} Array of study objects
     */
    getStudiesByStatus(status) {
        return this.studies
            .filter(study => study.status === status)
            .map(study => ({
                id: study.id,
                title: study.title,
                description: study.description,
                research_type: study.research_type,
                methodology: study.methodology,
                participant_profile: study.participant_profile,
                goals: study.goals,
                status: study.status,
                questionCount: study.questions.length,
                created_at: study.created_at,
                updated_at: study.updated_at
            }));
    }

    /**
     * Search studies by title or description
     * @param {string} query - Search query
     * @returns {Array} Array of matching study objects
     */
    searchStudies(query) {
        const lowerQuery = query.toLowerCase();
        return this.studies
            .filter(study => 
                study.title.toLowerCase().includes(lowerQuery) ||
                study.description.toLowerCase().includes(lowerQuery)
            )
            .map(study => ({
                id: study.id,
                title: study.title,
                description: study.description,
                research_type: study.research_type,
                methodology: study.methodology,
                participant_profile: study.participant_profile,
                goals: study.goals,
                status: study.status,
                questionCount: study.questions.length,
                created_at: study.created_at,
                updated_at: study.updated_at
            }));
    }

    /**
     * Add a new local study (for future API integration)
     * @param {Object} studyData - Study data
     * @returns {Object} Created study
     */
    addStudy(studyData) {
        const newStudy = {
            id: studyData.id || `study_${Date.now()}`,
            title: studyData.title,
            description: studyData.description || '',
            research_type: studyData.research_type || 'user_interview',
            methodology: studyData.methodology || 'semi_structured',
            participant_profile: studyData.participant_profile || '',
            goals: studyData.goals || '',
            status: studyData.status || 'draft',
            questions: studyData.questions || [],
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
        };
        
        this.studies.push(newStudy);
        return newStudy;
    }
}

// Export singleton instance
const localStudiesRepository = new LocalStudiesRepository();

module.exports = {
    LocalStudiesRepository,
    localStudiesRepository,
    LOCAL_STUDIES
}; 
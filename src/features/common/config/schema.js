const LATEST_SCHEMA = {
    users: {
        columns: [
            { name: 'uid', type: 'TEXT PRIMARY KEY' },
            { name: 'display_name', type: 'TEXT NOT NULL' },
            { name: 'email', type: 'TEXT NOT NULL' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'auto_update_enabled', type: 'INTEGER DEFAULT 1' },
            { name: 'has_migrated_to_firebase', type: 'INTEGER DEFAULT 0' }
        ]
    },
    sessions: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'uid', type: 'TEXT NOT NULL' },
            { name: 'title', type: 'TEXT' },
            { name: 'session_type', type: 'TEXT DEFAULT \'ask\'' },
            { name: 'started_at', type: 'INTEGER' },
            { name: 'ended_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' },
            { name: 'updated_at', type: 'INTEGER' }
        ]
    },
    transcripts: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'session_id', type: 'TEXT NOT NULL' },
            { name: 'start_at', type: 'INTEGER' },
            { name: 'end_at', type: 'INTEGER' },
            { name: 'speaker', type: 'TEXT' },
            { name: 'text', type: 'TEXT' },
            { name: 'lang', type: 'TEXT' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    },
    ai_messages: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'session_id', type: 'TEXT NOT NULL' },
            { name: 'sent_at', type: 'INTEGER' },
            { name: 'role', type: 'TEXT' },
            { name: 'content', type: 'TEXT' },
            { name: 'tokens', type: 'INTEGER' },
            { name: 'model', type: 'TEXT' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    },
    summaries: {
        columns: [
            { name: 'session_id', type: 'TEXT PRIMARY KEY' },
            { name: 'generated_at', type: 'INTEGER' },
            { name: 'model', type: 'TEXT' },
            { name: 'text', type: 'TEXT' },
            { name: 'tldr', type: 'TEXT' },
            { name: 'bullet_json', type: 'TEXT' },
            { name: 'action_json', type: 'TEXT' },
            { name: 'tokens_used', type: 'INTEGER' },
            { name: 'updated_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    },
    prompt_presets: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'uid', type: 'TEXT NOT NULL' },
            { name: 'title', type: 'TEXT NOT NULL' },
            { name: 'prompt', type: 'TEXT NOT NULL' },
            { name: 'is_default', type: 'INTEGER NOT NULL' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    },
    ollama_models: {
        columns: [
            { name: 'name', type: 'TEXT PRIMARY KEY' },
            { name: 'size', type: 'TEXT NOT NULL' },
            { name: 'installed', type: 'INTEGER DEFAULT 0' },
            { name: 'installing', type: 'INTEGER DEFAULT 0' }
        ]
    },
    whisper_models: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'name', type: 'TEXT NOT NULL' },
            { name: 'size', type: 'TEXT NOT NULL' },
            { name: 'installed', type: 'INTEGER DEFAULT 0' },
            { name: 'installing', type: 'INTEGER DEFAULT 0' }
        ]
    },
    provider_settings: {
        columns: [
            { name: 'provider', type: 'TEXT NOT NULL' },
            { name: 'api_key', type: 'TEXT' },
            { name: 'selected_llm_model', type: 'TEXT' },
            { name: 'selected_stt_model', type: 'TEXT' },
            { name: 'is_active_llm', type: 'INTEGER DEFAULT 0' },
            { name: 'is_active_stt', type: 'INTEGER DEFAULT 0' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'updated_at', type: 'INTEGER' }
        ],
        constraints: ['PRIMARY KEY (provider)']
    },
    shortcuts: {
        columns: [
            { name: 'action', type: 'TEXT PRIMARY KEY' },
            { name: 'accelerator', type: 'TEXT NOT NULL' },
            { name: 'created_at', type: 'INTEGER' }
        ]
    },
    permissions: {
        columns: [
            { name: 'uid', type: 'TEXT PRIMARY KEY' },
            { name: 'keychain_completed', type: 'INTEGER DEFAULT 0' }
        ]
    },
    
    // UX Research Extension Tables
    research_studies: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'uid', type: 'TEXT NOT NULL' },
            { name: 'title', type: 'TEXT NOT NULL' },
            { name: 'description', type: 'TEXT' },
            { name: 'research_type', type: 'TEXT DEFAULT \'user_interview\'' }, // user_interview, usability_test, focus_group
            { name: 'methodology', type: 'TEXT' }, // structured, semi-structured, unstructured
            { name: 'participant_profile', type: 'TEXT' },
            { name: 'goals', type: 'TEXT' },
            { name: 'context', type: 'TEXT' },
            { name: 'status', type: 'TEXT DEFAULT \'draft\'' }, // draft, active, completed, archived
            { name: 'created_at', type: 'INTEGER' },
            { name: 'updated_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    },
    
    research_questions: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'study_id', type: 'TEXT NOT NULL' },
            { name: 'question_text', type: 'TEXT NOT NULL' },
            { name: 'question_type', type: 'TEXT DEFAULT \'open\'' }, // open, closed, follow_up, probe
            { name: 'category', type: 'TEXT' }, // background, behavior, attitude, demographic
            { name: 'priority', type: 'TEXT DEFAULT \'medium\'' }, // high, medium, low
            { name: 'order_index', type: 'INTEGER' },
            { name: 'is_required', type: 'INTEGER DEFAULT 0' },
            { name: 'follow_up_hints', type: 'TEXT' }, // JSON array of suggested follow-ups
            { name: 'created_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    },
    
    question_responses: {
        columns: [
            { name: 'id', type: 'TEXT PRIMARY KEY' },
            { name: 'session_id', type: 'TEXT NOT NULL' },
            { name: 'question_id', type: 'TEXT NOT NULL' },
            { name: 'transcript_segment_start', type: 'INTEGER' }, // timestamp when response started
            { name: 'transcript_segment_end', type: 'INTEGER' }, // timestamp when response ended
            { name: 'response_text', type: 'TEXT' }, // extracted relevant transcript
            { name: 'completeness_score', type: 'REAL DEFAULT 0.0' }, // 0.0-1.0 how complete the answer is
            { name: 'sentiment', type: 'TEXT' }, // positive, negative, neutral, mixed
            { name: 'key_insights', type: 'TEXT' }, // JSON array of insights
            { name: 'follow_up_needed', type: 'INTEGER DEFAULT 0' },
            { name: 'ai_confidence', type: 'REAL DEFAULT 0.0' }, // AI confidence in the mapping
            { name: 'status', type: 'TEXT DEFAULT \'partial\'' }, // not_asked, partial, complete, needs_clarification
            { name: 'created_at', type: 'INTEGER' },
            { name: 'updated_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    },
    
    research_sessions: {
        columns: [
            { name: 'session_id', type: 'TEXT PRIMARY KEY' },
            { name: 'study_id', type: 'TEXT NOT NULL' },
            { name: 'participant_id', type: 'TEXT' },
            { name: 'participant_notes', type: 'TEXT' },
            { name: 'session_notes', type: 'TEXT' },
            { name: 'research_mode', type: 'TEXT DEFAULT \'live\'' }, // live, review, analysis
            { name: 'questions_asked', type: 'INTEGER DEFAULT 0' },
            { name: 'questions_completed', type: 'INTEGER DEFAULT 0' },
            { name: 'session_quality_score', type: 'REAL DEFAULT 0.0' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'sync_state', type: 'TEXT DEFAULT \'clean\'' }
        ]
    }
};

module.exports = LATEST_SCHEMA; 
'use client'

import { useState, useEffect } from 'react'
import { ChevronRightIcon, PlayIcon, StopIcon, ChartBarIcon, UserGroupIcon, ClipboardDocumentListIcon, PlusIcon } from '@heroicons/react/24/outline'

interface ResearchStudy {
  id: string
  title: string
  description: string
  research_type: string
  methodology: string
  status: string
  created_at: number
  updated_at: number
}

interface StudyQuestion {
  id: string
  question_text: string
  category: string
  priority: string
  is_required: boolean
}

interface SessionReport {
  session: any
  study: ResearchStudy
  responses: any[]
}

export default function ResearchPage() {
  const [studies, setStudies] = useState<ResearchStudy[]>([])
  const [selectedStudy, setSelectedStudy] = useState<ResearchStudy | null>(null)
  const [questions, setQuestions] = useState<StudyQuestion[]>([])
  const [sessionReports, setSessionReports] = useState<SessionReport[]>([])
  const [view, setView] = useState<'overview' | 'study' | 'report'>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    loadStudies()
  }, [])

  const loadStudies = async () => {
    try {
      setIsLoading(true)
      // Simulate API call - in real implementation this would call the backend
      const response = await fetch('/api/research/studies')
      if (response.ok) {
        const data = await response.json()
        setStudies(data)
      }
    } catch (error) {
      console.error('Failed to load studies:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStudyDetails = async (study: ResearchStudy) => {
    try {
      setSelectedStudy(study)
      setView('study')
      
      // Load questions and session reports
      const [questionsRes, reportsRes] = await Promise.all([
        fetch(`/api/research/studies/${study.id}/questions`),
        fetch(`/api/research/studies/${study.id}/reports`)
      ])
      
      if (questionsRes.ok) {
        const questionsData = await questionsRes.json()
        setQuestions(questionsData)
      }
      
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json()
        setSessionReports(reportsData)
      }
    } catch (error) {
      console.error('Failed to load study details:', error)
    }
  }

  const createStudy = async (studyData: any) => {
    try {
      const response = await fetch('/api/research/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studyData)
      })
      
      if (response.ok) {
        await loadStudies()
        setShowCreateForm(false)
      }
    } catch (error) {
      console.error('Failed to create study:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      archived: 'bg-orange-100 text-orange-800'
    }
    return colors[status as keyof typeof colors] || colors.draft
  }

  const getTypeIcon = (type: string) => {
    const icons = {
      user_interview: UserGroupIcon,
      usability_test: ClipboardDocumentListIcon,
      focus_group: UserGroupIcon
    }
    const Icon = icons[type as keyof typeof icons] || UserGroupIcon
    return <Icon className="h-5 w-5" />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">UX Research Studio</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage research studies, track interview progress, and analyze insights
              </p>
            </div>
            
            <div className="flex space-x-3">
              {view !== 'overview' && (
                <button
                  onClick={() => setView('overview')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  ← Back to Studies
                </button>
              )}
              
              {view === 'overview' && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Study
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'overview' && (
          <StudiesOverview 
            studies={studies} 
            onStudySelect={loadStudyDetails}
            showCreateForm={showCreateForm}
            onCreateStudy={createStudy}
            onCloseCreateForm={() => setShowCreateForm(false)}
          />
        )}
        
        {view === 'study' && selectedStudy && (
          <StudyDetails 
            study={selectedStudy} 
            questions={questions}
            sessionReports={sessionReports}
            onViewReport={(report) => {
              setView('report')
            }}
          />
        )}
      </div>
    </div>
  )
}

function StudiesOverview({ 
  studies, 
  onStudySelect, 
  showCreateForm, 
  onCreateStudy, 
  onCloseCreateForm 
}: {
  studies: ResearchStudy[]
  onStudySelect: (study: ResearchStudy) => void
  showCreateForm: boolean
  onCreateStudy: (data: any) => void
  onCloseCreateForm: () => void
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    research_type: 'user_interview',
    methodology: 'semi_structured',
    participant_profile: '',
    goals: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreateStudy(formData)
    setFormData({
      title: '',
      description: '',
      research_type: 'user_interview',
      methodology: 'semi_structured',
      participant_profile: '',
      goals: ''
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClipboardDocumentListIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Studies</dt>
                  <dd className="text-lg font-medium text-gray-900">{studies.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PlayIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Studies</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {studies.filter(s => s.status === 'active').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Interviews</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {studies.filter(s => s.research_type === 'user_interview').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {studies.filter(s => s.status === 'completed').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Study Form */}
      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Research Study</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Study Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Mobile Banking App Usability Study"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Research Type</label>
                  <select
                    value={formData.research_type}
                    onChange={(e) => setFormData({...formData, research_type: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="user_interview">User Interview</option>
                    <option value="usability_test">Usability Test</option>
                    <option value="focus_group">Focus Group</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brief description of the study objectives and scope"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Methodology</label>
                  <select
                    value={formData.methodology}
                    onChange={(e) => setFormData({...formData, methodology: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="semi_structured">Semi-structured</option>
                    <option value="structured">Structured</option>
                    <option value="unstructured">Unstructured</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Goals</label>
                  <textarea
                    value={formData.goals}
                    onChange={(e) => setFormData({...formData, goals: e.target.value})}
                    rows={2}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Key research questions and objectives"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onCloseCreateForm}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Study
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Studies List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {studies.map((study) => (
            <li key={study.id}>
              <button
                onClick={() => onStudySelect(study)}
                className="w-full text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition duration-150 ease-in-out"
              >
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-3">
                        {getTypeIcon(study.research_type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-600">{study.title}</p>
                        <p className="text-sm text-gray-500">{study.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(study.status)}`}>
                        {study.status}
                      </span>
                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        {study.research_type.replace('_', ' ')} • {study.methodology}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <p>
                        Updated {new Date(study.updated_at * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StudyDetails({ 
  study, 
  questions, 
  sessionReports, 
  onViewReport 
}: {
  study: ResearchStudy
  questions: StudyQuestion[]
  sessionReports: SessionReport[]
  onViewReport: (report: SessionReport) => void
}) {
  return (
    <div className="space-y-6">
      {/* Study Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{study.title}</h2>
            <p className="mt-2 text-gray-600">{study.description}</p>
            <div className="mt-4 flex space-x-4">
              <span className="text-sm text-gray-500">
                <strong>Type:</strong> {study.research_type.replace('_', ' ')}
              </span>
              <span className="text-sm text-gray-500">
                <strong>Methodology:</strong> {study.methodology}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(study.status)}`}>
                {study.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Questions Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Interview Questions ({questions.length})</h3>
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div key={question.id} className="border-l-4 border-blue-400 pl-4">
              <p className="text-sm font-medium text-gray-900">{question.question_text}</p>
              <div className="mt-1 flex space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {question.category}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  question.priority === 'high' ? 'bg-red-100 text-red-800' :
                  question.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {question.priority}
                </span>
                {question.is_required && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    required
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session Reports */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Session Reports ({sessionReports.length})</h3>
        {sessionReports.length === 0 ? (
          <p className="text-gray-500">No sessions completed yet.</p>
        ) : (
          <div className="space-y-3">
            {sessionReports.map((report, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Session {index + 1}</p>
                    <p className="text-sm text-gray-500">
                      Participant: {report.session.participant_id}
                    </p>
                    <p className="text-sm text-gray-500">
                      Quality Score: {(report.session.session_quality_score * 100).toFixed(0)}%
                    </p>
                  </div>
                  <button
                    onClick={() => onViewReport(report)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                  >
                    View Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getStatusColor(status: string) {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-orange-100 text-orange-800'
  }
  return colors[status as keyof typeof colors] || colors.draft
}

function getTypeIcon(type: string) {
  const icons = {
    user_interview: UserGroupIcon,
    usability_test: ClipboardDocumentListIcon,
    focus_group: UserGroupIcon
  }
  const Icon = icons[type as keyof typeof icons] || UserGroupIcon
  return <Icon className="h-5 w-5" />
} 
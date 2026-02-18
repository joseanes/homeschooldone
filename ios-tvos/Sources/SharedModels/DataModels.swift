import Foundation
import FirebaseFirestore
import FirebaseFirestoreSwift

// MARK: - Homeschool
struct Homeschool: Codable, Identifiable {
    @DocumentID var id: String?
    let name: String
    let studentIds: [String]
    let parentEmails: [String]
    let tutorEmails: [String]?
    let observerEmails: [String]?
    let authorizedUsers: [String]
    let invitedUsers: [String]?
    let dashboardSettings: DashboardSettings?
    let timerAlarmEnabled: Bool?
    let publicDashboardId: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case studentIds
        case parentEmails
        case tutorEmails  
        case observerEmails
        case authorizedUsers
        case invitedUsers
        case dashboardSettings
        case timerAlarmEnabled
        case publicDashboardId
    }
}

// MARK: - Dashboard Settings
struct DashboardSettings: Codable {
    let cycleSeconds: Int
    let startOfWeek: Int // 0 = Sunday, 1 = Monday, etc.
    let timezone: String
    
    enum CodingKeys: String, CodingKey {
        case cycleSeconds
        case startOfWeek
        case timezone
    }
}

// MARK: - Person (Student)
struct Person: Codable, Identifiable {
    @DocumentID var id: String?
    let name: String
    let email: String?
    let mobile: String?
    let role: PersonRole
    let homeschoolId: String?
    let lastActivity: Timestamp?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case mobile
        case role
        case homeschoolId
        case lastActivity
    }
}

enum PersonRole: String, Codable, CaseIterable {
    case student = "student"
    case parent = "parent"
    case tutor = "tutor"
    case observer = "observer"
}

// MARK: - Activity
struct Activity: Codable, Identifiable {
    @DocumentID var id: String?
    let name: String
    let description: String
    let homeschoolId: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case homeschoolId
    }
}

// MARK: - Goal
struct Goal: Codable, Identifiable {
    @DocumentID var id: String?
    let activityId: String
    let homeschoolId: String
    let studentIds: [String]
    let sessionsPerWeek: Int
    let minutesPerSession: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case activityId
        case homeschoolId
        case studentIds
        case sessionsPerWeek
        case minutesPerSession
    }
}

// MARK: - Activity Instance
struct ActivityInstance: Codable, Identifiable {
    @DocumentID var id: String?
    let goalId: String
    let studentId: String
    let homeschoolId: String
    let date: Timestamp
    let durationMinutes: Int
    let notes: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case goalId
        case studentId
        case homeschoolId
        case date
        case durationMinutes
        case notes
    }
}

// MARK: - Student Progress (Computed)
struct StudentProgress {
    let student: Person
    let todayGoals: [Goal]
    let completedToday: Int
    let totalGoals: Int
    let weeklyProgress: [String: Int] // goalId: completed sessions
    let todayCompletedGoalIds: Set<String>
    let todayMinutes: [String: Int] // goalId: minutes completed today
}

// MARK: - Goal Status (Computed)
struct GoalStatus {
    let status: GoalStatusType
    let progress: Int
    let target: Int
    let minutesToday: Int
    let minutesTarget: Int
}

enum GoalStatusType: String, CaseIterable {
    case notStarted = "not-started"
    case inProgress = "in-progress" 
    case completedToday = "completed-today"
    case overTime = "over-time"
}
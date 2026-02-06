import Foundation
import FirebaseFirestore

// MARK: - Homeschool
public struct Homeschool: Codable, Identifiable {
    @DocumentID public var id: String?
    public let name: String
    public let studentIds: [String]
    public let parentEmails: [String]
    public let tutorEmails: [String]?
    public let observerEmails: [String]?
    public let authorizedUsers: [String]?
    public let invitedUsers: [String]?
    public let dashboardSettings: DashboardSettings?
    public let timerAlarmEnabled: Bool?
    public let publicDashboardId: String?
    
    // Additional fields found in Firestore
    public let parentIds: [String]?
    public let tutorIds: [String]?
    public let observerIds: [String]?
    public let createdBy: String?
    public let createdAt: Timestamp?
    
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
        case parentIds
        case tutorIds
        case observerIds
        case createdBy
        case createdAt
    }
}

// MARK: - Dashboard Settings
public struct DashboardSettings: Codable {
    public let cycleSeconds: Int
    public let startOfWeek: Int // 0 = Sunday, 1 = Monday, etc.
    public let timezone: String
    
    enum CodingKeys: String, CodingKey {
        case cycleSeconds
        case startOfWeek
        case timezone
    }
}

// MARK: - Person (Student)
public struct Person: Codable, Identifiable {
    @DocumentID public var id: String?
    public let name: String
    public let email: String?
    public let mobile: String?
    public let role: PersonRole
    public let homeschoolId: String?
    public let lastActivity: Timestamp?
    
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

public enum PersonRole: String, Codable, CaseIterable {
    case student = "student"
    case parent = "parent"
    case tutor = "tutor"
    case observer = "observer"
}

// MARK: - Activity
public struct Activity: Codable, Identifiable {
    @DocumentID public var id: String?
    public let name: String
    public let description: String
    public let homeschoolId: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case homeschoolId
    }
}

// MARK: - Goal
public struct Goal: Codable, Identifiable {
    @DocumentID public var id: String?
    public let activityId: String
    public let homeschoolId: String
    public let studentIds: [String]
    public let sessionsPerWeek: Int?
    public let minutesPerSession: Int?
    
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
public struct ActivityInstance: Codable, Identifiable {
    @DocumentID public var id: String?
    public let goalId: String
    public let studentId: String
    public let homeschoolId: String
    public let date: Timestamp
    public let durationMinutes: Int
    public let notes: String?
    
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
public struct StudentProgress {
    public let student: Person
    public let todayGoals: [Goal]
    public let completedToday: Int
    public let totalGoals: Int
    public let weeklyProgress: [String: Int] // goalId: completed sessions
    public let todayCompletedGoalIds: Set<String>
    public let todayMinutes: [String: Int] // goalId: minutes completed today
}

// MARK: - Goal Status (Computed)
public struct GoalStatus {
    public let status: GoalStatusType
    public let progress: Int
    public let target: Int
    public let minutesToday: Int
    public let minutesTarget: Int
}

public enum GoalStatusType: String, CaseIterable {
    case notStarted = "not-started"
    case inProgress = "in-progress" 
    case completedToday = "completed-today"
    case overTime = "over-time"
}
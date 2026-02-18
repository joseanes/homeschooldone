import Foundation
import FirebaseAuth
import FirebaseFirestore
import Combine

@MainActor
public class FirebaseService: ObservableObject {
    public static let shared = FirebaseService()
    
    private let db = Firestore.firestore()
    private let auth = Auth.auth()
    
    @Published public var currentUser: User?
    @Published public var homeschool: Homeschool?
    @Published public var students: [Person] = []
    @Published public var activities: [Activity] = []
    @Published public var goals: [Goal] = []
    @Published public var todayInstances: [ActivityInstance] = []
    @Published public var isLoading = false
    @Published public var error: String?
    
    private var listeners: [ListenerRegistration] = []
    
    private init() {
        // Listen for auth state changes
        auth.addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.currentUser = user
                if let user = user {
                    await self?.loadUserData(for: user)
                } else {
                    self?.clearData()
                }
            }
        }
    }
    
    deinit {
        removeAllListeners()
    }
    
    // MARK: - Authentication
    
    public func signIn(email: String, password: String) async throws {
        isLoading = true
        error = nil
        
        do {
            _ = try await auth.signIn(withEmail: email, password: password)
        } catch {
            self.error = error.localizedDescription
            throw error
        }
        
        isLoading = false
    }
    
    public func signOut() {
        do {
            try auth.signOut()
            clearData()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    // MARK: - Data Loading
    
    private func loadUserData(for user: User) async {
        isLoading = true
        error = nil
        
        do {
            // Check if user is a student first
            if let studentHomeschool = try await findHomeschoolForStudent(userEmail: user.email ?? "") {
                self.homeschool = studentHomeschool
                await setupRealtimeListeners()
                return
            }
            
            // Check parent/tutor/observer access
            if let homeschool = try await findHomeschoolForUser(userEmail: user.email ?? "") {
                self.homeschool = homeschool
                await setupRealtimeListeners()
            } else {
                self.error = "No homeschool access found"
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func findHomeschoolForStudent(userEmail: String) async throws -> Homeschool? {
        // Find student in people collection
        let peopleQuery = db.collection("people").whereField("email", isEqualTo: userEmail)
        let peopleSnapshot = try await peopleQuery.getDocuments()
        
        for document in peopleSnapshot.documents {
            let person = try document.data(as: Person.self)
            if person.role == .student, let homeschoolId = person.homeschoolId {
                // Find homeschool that contains this student
                let homeschoolQuery = db.collection("homeschools").whereField("studentIds", arrayContains: document.documentID)
                let homeschoolSnapshot = try await homeschoolQuery.getDocuments()
                
                if let homeschoolDoc = homeschoolSnapshot.documents.first {
                    return try homeschoolDoc.data(as: Homeschool.self)
                }
            }
        }
        
        return nil
    }
    
    private func findHomeschoolForUser(userEmail: String) async throws -> Homeschool? {
        let queries = [
            ("parentEmails", db.collection("homeschools").whereField("parentEmails", arrayContains: userEmail)),
            ("tutorEmails", db.collection("homeschools").whereField("tutorEmails", arrayContains: userEmail)),
            ("observerEmails", db.collection("homeschools").whereField("observerEmails", arrayContains: userEmail))
        ]
        
        for (_, query) in queries {
            let snapshot = try await query.getDocuments()
            if let document = snapshot.documents.first {
                return try document.data(as: Homeschool.self)
            }
        }
        
        return nil
    }
    
    // MARK: - Real-time Listeners
    
    private func setupRealtimeListeners() async {
        guard let homeschool = homeschool else { return }
        
        removeAllListeners()
        
        // Listen to students
        if !homeschool.studentIds.isEmpty {
            let studentsListener = db.collection("people")
                .whereField(FieldPath.documentID(), in: homeschool.studentIds)
                .addSnapshotListener { [weak self] snapshot, error in
                    Task { @MainActor in
                        if let error = error {
                            self?.error = error.localizedDescription
                            return
                        }
                        
                        guard let documents = snapshot?.documents else { return }
                        
                        do {
                            self?.students = try documents.map { try $0.data(as: Person.self) }
                        } catch {
                            self?.error = error.localizedDescription
                        }
                    }
                }
            listeners.append(studentsListener)
        }
        
        // Listen to activities
        let activitiesListener = db.collection("activities")
            .whereField("homeschoolId", isEqualTo: homeschool.id ?? "")
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    if let error = error {
                        self?.error = error.localizedDescription
                        return
                    }
                    
                    guard let documents = snapshot?.documents else { return }
                    
                    do {
                        self?.activities = try documents.map { try $0.data(as: Activity.self) }
                    } catch {
                        self?.error = error.localizedDescription
                    }
                }
            }
        listeners.append(activitiesListener)
        
        // Listen to goals
        let goalsListener = db.collection("goals")
            .whereField("homeschoolId", isEqualTo: homeschool.id ?? "")
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    if let error = error {
                        self?.error = error.localizedDescription
                        return
                    }
                    
                    guard let documents = snapshot?.documents else { return }
                    
                    do {
                        self?.goals = try documents.map { try $0.data(as: Goal.self) }
                    } catch {
                        self?.error = error.localizedDescription
                    }
                }
            }
        listeners.append(goalsListener)
        
        // Listen to today's activity instances
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
        
        let instancesListener = db.collection("activity-instances")
            .whereField("homeschoolId", isEqualTo: homeschool.id ?? "")
            .whereField("date", isGreaterThanOrEqualTo: Timestamp(date: today))
            .whereField("date", isLessThan: Timestamp(date: tomorrow))
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    if let error = error {
                        self?.error = error.localizedDescription
                        return
                    }
                    
                    guard let documents = snapshot?.documents else { return }
                    
                    do {
                        self?.todayInstances = try documents.map { try $0.data(as: ActivityInstance.self) }
                    } catch {
                        self?.error = error.localizedDescription
                    }
                }
            }
        listeners.append(instancesListener)
    }
    
    private func removeAllListeners() {
        listeners.forEach { $0.remove() }
        listeners.removeAll()
    }
    
    private func clearData() {
        homeschool = nil
        students = []
        activities = []
        goals = []
        todayInstances = []
        removeAllListeners()
    }
    
    // MARK: - Progress Calculation
    
    public func calculateStudentProgress() -> [StudentProgress] {
        return students.map { student in
            let studentGoals = goals.filter { goal in
                goal.studentIds.contains(student.id ?? "")
            }
            
            let todayCompletedGoalIds = Set(todayInstances.compactMap { instance in
                if instance.studentId == student.id {
                    return instance.goalId
                } else {
                    return nil
                }
            })
            
            let todayMinutes = Dictionary(uniqueKeysWithValues:
                studentGoals.map { goal in
                    let minutesToday = todayInstances
                        .filter { $0.goalId == goal.id && $0.studentId == student.id }
                        .reduce(0) { $0 + $1.durationMinutes }
                    return (goal.id ?? "", minutesToday)
                }
            )
            
            return StudentProgress(
                student: student,
                todayGoals: studentGoals,
                completedToday: todayCompletedGoalIds.count,
                totalGoals: studentGoals.count,
                weeklyProgress: [:], // TODO: Implement weekly calculation
                todayCompletedGoalIds: todayCompletedGoalIds,
                todayMinutes: todayMinutes
            )
        }
    }
    
    public func getGoalStatus(goalId: String, studentId: String) -> GoalStatus {
        guard let goal = goals.first(where: { $0.id == goalId }) else {
            return GoalStatus(status: .notStarted, progress: 0, target: 0, minutesToday: 0, minutesTarget: 0)
        }
        
        let minutesToday = todayInstances
            .filter { $0.goalId == goalId && $0.studentId == studentId }
            .reduce(0) { $0 + $1.durationMinutes }
        
        let minutesTarget = goal.minutesPerSession
        
        let status: GoalStatusType
        if minutesToday == 0 {
            status = .notStarted
        } else if minutesToday >= minutesTarget {
            status = minutesToday > minutesTarget ? .overTime : .completedToday
        } else {
            status = .inProgress
        }
        
        return GoalStatus(
            status: status,
            progress: min(minutesToday, minutesTarget),
            target: minutesTarget,
            minutesToday: minutesToday,
            minutesTarget: minutesTarget
        )
    }
}
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
    private var initialDataLoaded: Set<String> = []
    
    private func markDataLoaded(_ type: String) {
        initialDataLoaded.insert(type)
        let expectedTypes: Set<String> = ["students", "activities", "goals"]
        if initialDataLoaded.isSuperset(of: expectedTypes) && isLoading {
            print("✅ All initial data loaded, setting isLoading = false")
            isLoading = false
        }
    }
    
    private init() {
        // Listen for auth state changes
        _ = auth.addStateDidChangeListener { [weak self] _, user in
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
        Task { @MainActor in
            removeAllListeners()
        }
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
        initialDataLoaded.removeAll()
        print("🔄 Loading user data for: \(user.email ?? "no email")")
        
        do {
            // Check if user is a student first
            if let studentHomeschool = try await findHomeschoolForStudent(userEmail: user.email ?? "") {
                print("📚 Found as student in homeschool: \(studentHomeschool.name)")
                self.homeschool = studentHomeschool
                await setupRealtimeListeners()
                return
            }
            
            // Check parent/tutor/observer access
            if let homeschool = try await findHomeschoolForUser(userEmail: user.email ?? "") {
                print("👤 Found as parent/tutor/observer in homeschool: \(homeschool.name)")
                print("📊 Setting homeschool and starting listeners...")
                self.homeschool = homeschool
                print("✅ Homeschool set, now setting up real-time listeners")
                await setupRealtimeListeners()
                print("✅ Real-time listeners setup complete")
            } else {
                print("❌ No homeschool access found")
                self.error = "No homeschool access found"
            }
        } catch {
            print("❌ Error loading user data: \(error.localizedDescription)")
            self.error = error.localizedDescription
        }
        
        // Don't set isLoading = false here - wait for listeners to get first data
        print("🔄 Initial data loading complete, waiting for real-time listeners...")
    }
    
    private func findHomeschoolForStudent(userEmail: String) async throws -> Homeschool? {
        // Find student in people collection
        let peopleQuery = db.collection("people").whereField("email", isEqualTo: userEmail)
        let peopleSnapshot = try await peopleQuery.getDocuments()
        
        for document in peopleSnapshot.documents {
            let person = try document.data(as: Person.self)
            if person.role == .student, let _ = person.homeschoolId {
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
        print("🔍 Looking for homeschool access for email: \(userEmail)")
        
        // Also check by current user's UID
        let currentUserID = auth.currentUser?.uid
        print("🆔 Current user ID: \(currentUserID ?? "none")")
        
        let queries = [
            ("parentEmails", db.collection("homeschools").whereField("parentEmails", arrayContains: userEmail)),
            ("tutorEmails", db.collection("homeschools").whereField("tutorEmails", arrayContains: userEmail)),
            ("observerEmails", db.collection("homeschools").whereField("observerEmails", arrayContains: userEmail))
        ]
        
        // If we have a user ID, also query by ID fields
        if let userID = currentUserID {
            let idQueries = [
                ("parentIds", db.collection("homeschools").whereField("parentIds", arrayContains: userID)),
                ("tutorIds", db.collection("homeschools").whereField("tutorIds", arrayContains: userID)),
                ("observerIds", db.collection("homeschools").whereField("observerIds", arrayContains: userID))
            ]
            
            for (queryType, query) in idQueries {
                do {
                    let snapshot = try await query.getDocuments()
                    print("📊 Query \(queryType): found \(snapshot.documents.count) documents")
                    if let document = snapshot.documents.first {
                        let homeschool = try document.data(as: Homeschool.self)
                        print("✅ Found homeschool: \(homeschool.name) via \(queryType)")
                        return homeschool
                    }
                } catch {
                    print("❌ Error in \(queryType) query: \(error.localizedDescription)")
                }
            }
        }
        
        for (queryType, query) in queries {
            do {
                let snapshot = try await query.getDocuments()
                print("📊 Query \(queryType): found \(snapshot.documents.count) documents")
                if let document = snapshot.documents.first {
                    let homeschool = try document.data(as: Homeschool.self)
                    print("✅ Found homeschool: \(homeschool.name) via \(queryType)")
                    return homeschool
                }
            } catch {
                print("❌ Error in \(queryType) query: \(error.localizedDescription)")
            }
        }
        
        // Try a simpler approach - get all homeschools and check manually
        do {
            let allHomeschoolsSnapshot = try await db.collection("homeschools").getDocuments()
            print("🏠 Total homeschools in database: \(allHomeschoolsSnapshot.documents.count)")
            
            for doc in allHomeschoolsSnapshot.documents {
                
                do {
                    let hs = try doc.data(as: Homeschool.self)
                    if let userID = currentUserID {
                        if hs.parentIds?.contains(userID) == true {
                            print("✅ Found user access via parentIds")
                            return hs
                        }
                        if hs.tutorIds?.contains(userID) == true {
                            print("✅ Found user access via tutorIds")
                            return hs
                        }
                        if hs.observerIds?.contains(userID) == true {
                            print("✅ Found user access via observerIds")
                            return hs
                        }
                    }
                    
                    if hs.parentEmails.contains(userEmail) {
                        print("✅ Found user in parentEmails for \(hs.name)")
                        return hs
                    }
                    if hs.tutorEmails?.contains(userEmail) == true {
                        print("✅ Found user in tutorEmails for \(hs.name)")
                        return hs
                    }
                    if hs.observerEmails?.contains(userEmail) == true {
                        print("✅ Found user in observerEmails for \(hs.name)")
                        return hs
                    }
                    if hs.authorizedUsers?.contains(userEmail) == true {
                        print("✅ Found user in authorizedUsers for \(hs.name)")
                        return hs
                    }
                } catch {
                    print("❌ Error parsing homeschool document \(doc.documentID): \(error.localizedDescription)")
                    print("📄 Full error details: \(error)")
                    
                    // Try to manually check the raw data for the user email
                    let rawData = doc.data()
                    if let parentEmails = rawData["parentEmails"] as? [String], parentEmails.contains(userEmail) {
                        print("🔧 Found user in raw parentEmails data!")
                        // Try to create a minimal homeschool object
                        if let name = rawData["name"] as? String,
                           let studentIds = rawData["studentIds"] as? [String],
                           let authorizedUsers = rawData["authorizedUsers"] as? [String] {
                            print("🔧 Creating minimal homeschool from raw data")
                            // We can't return a proper Homeschool object here, but let's see what fields are missing
                            print("🔧 Raw data has: name=\(name), studentIds=\(studentIds), authorizedUsers=\(authorizedUsers)")
                        }
                    }
                    if let authorizedUsers = rawData["authorizedUsers"] as? [String], authorizedUsers.contains(userEmail) {
                        print("🔧 Found user in raw authorizedUsers data!")
                    }
                    if let tutorEmails = rawData["tutorEmails"] as? [String], tutorEmails.contains(userEmail) {
                        print("🔧 Found user in raw tutorEmails data!")
                    }
                    if let observerEmails = rawData["observerEmails"] as? [String], observerEmails.contains(userEmail) {
                        print("🔧 Found user in raw observerEmails data!")
                    }
                }
            }
        } catch {
            print("❌ Error getting homeschools: \(error.localizedDescription)")
            throw error
        }
        
        print("❌ No homeschool access found for \(userEmail)")
        return nil
    }
    
    // MARK: - Real-time Listeners
    
    private func setupRealtimeListeners() async {
        guard let homeschool = homeschool else { 
            print("❌ No homeschool available for setting up listeners")
            return 
        }
        
        print("🎯 Setting up real-time listeners for: \(homeschool.name)")
        print("👥 Student IDs: \(homeschool.studentIds)")
        
        removeAllListeners()
        
        // Listen to students
        if !homeschool.studentIds.isEmpty {
            print("👥 Setting up students listener...")
            let studentsListener = db.collection("people")
                .whereField(FieldPath.documentID(), in: homeschool.studentIds)
                .addSnapshotListener { [weak self] snapshot, error in
                    Task { @MainActor in
                        if let error = error {
                            print("❌ Error in students listener: \(error.localizedDescription)")
                            self?.error = error.localizedDescription
                            return
                        }
                        
                        guard let documents = snapshot?.documents else { 
                            print("❌ No documents in students snapshot")
                            self?.students = []
                            self?.markDataLoaded("students")
                            return 
                        }
                        
                        print("📄 Found \(documents.count) student documents")
                        
                        do {
                            let students = try documents.map { try $0.data(as: Person.self) }
                            print("✅ Successfully parsed \(students.count) students: \(students.map { $0.name })")
                            self?.students = students
                            self?.markDataLoaded("students")
                        } catch {
                            print("❌ Error parsing student documents: \(error)")
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
                    
                    guard let documents = snapshot?.documents else { 
                        print("❌ No documents in activities snapshot")
                        self?.activities = []
                        self?.markDataLoaded("activities")
                        return 
                    }
                    
                    print("📊 Found \(documents.count) activity documents")
                    
                    do {
                        let activities = try documents.map { try $0.data(as: Activity.self) }
                        self?.activities = activities
                        print("✅ Successfully loaded \(activities.count) activities")
                        self?.markDataLoaded("activities")
                    } catch {
                        print("❌ Error parsing activity documents: \(error)")
                        self?.error = error.localizedDescription
                    }
                }
            }
        listeners.append(activitiesListener)
        
        // Listen to goals
        print("🎯 Setting up goals listener for homeschoolId: \(homeschool.id ?? "nil")")
        let goalsListener = db.collection("goals")
            .whereField("homeschoolId", isEqualTo: homeschool.id ?? "")
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    if let error = error {
                        print("❌ Error in goals listener: \(error.localizedDescription)")
                        self?.error = error.localizedDescription
                        return
                    }
                    
                    guard let documents = snapshot?.documents else { 
                        print("❌ No documents in goals snapshot")
                        self?.goals = []
                        self?.markDataLoaded("goals")
                        return 
                    }
                    
                    print("📋 Found \(documents.count) goal documents")
                    
                    do {
                        let goals = try documents.map { try $0.data(as: Goal.self) }
                        self?.goals = goals
                        print("✅ Successfully loaded \(goals.count) goals")
                        self?.markDataLoaded("goals")
                    } catch {
                        print("❌ Error parsing goal documents: \(error)")
                        self?.error = error.localizedDescription
                    }
                }
            }
        listeners.append(goalsListener)
        
        // Listen to today's activity instances
        // TODO: Temporarily disabled due to missing Firebase index
        print("⚠️ Activity instances listener disabled - waiting for Firebase index to build")
        self.todayInstances = [] // Set empty array so UI doesn't hang
        
        // Uncomment when Firebase index is ready:
        /*
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
        */
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
        initialDataLoaded.removeAll()
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
        
        let minutesTarget = goal.minutesPerSession ?? 30
        
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
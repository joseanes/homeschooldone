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
    @Published public var weekInstances: [ActivityInstance] = []
    @Published public var isLoading = false
    @Published public var error: String?

    private var listeners: [ListenerRegistration] = []
    private var initialDataLoaded: Set<String> = []
    private var instanceRefreshTask: Task<Void, Never>?

    private func markDataLoaded(_ type: String) {
        initialDataLoaded.insert(type)
        let expectedTypes: Set<String> = ["students", "activities", "goals"]
        if initialDataLoaded.isSuperset(of: expectedTypes) && isLoading {
            print("✅ All initial data loaded, setting isLoading = false")
            isLoading = false
            // Fetch activity instances now that we have goals
            Task {
                await fetchWeekInstances()
            }
            startInstanceRefresh()
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
                self.homeschool = homeschool
                await setupRealtimeListeners()
            } else {
                print("❌ No homeschool access found")
                self.error = "No homeschool access found"
            }
        } catch {
            print("❌ Error loading user data: \(error.localizedDescription)")
            self.error = error.localizedDescription
        }

        print("🔄 Initial data loading complete, waiting for real-time listeners...")
    }

    private func findHomeschoolForStudent(userEmail: String) async throws -> Homeschool? {
        let peopleQuery = db.collection("people").whereField("email", isEqualTo: userEmail)
        let peopleSnapshot = try await peopleQuery.getDocuments()

        for document in peopleSnapshot.documents {
            let person = try document.data(as: Person.self)
            if person.role == .student, let _ = person.homeschoolId {
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

        let currentUserID = auth.currentUser?.uid
        print("🆔 Current user ID: \(currentUserID ?? "none")")

        // Check by user ID fields first
        if let userID = currentUserID {
            let idQueries = [
                ("parentIds", db.collection("homeschools").whereField("parentIds", arrayContains: userID)),
                ("tutorIds", db.collection("homeschools").whereField("tutorIds", arrayContains: userID)),
                ("observerIds", db.collection("homeschools").whereField("observerIds", arrayContains: userID))
            ]

            for (queryType, query) in idQueries {
                do {
                    let snapshot = try await query.getDocuments()
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

        // Check by email fields
        let emailQueries = [
            ("parentEmails", db.collection("homeschools").whereField("parentEmails", arrayContains: userEmail)),
            ("tutorEmails", db.collection("homeschools").whereField("tutorEmails", arrayContains: userEmail)),
            ("observerEmails", db.collection("homeschools").whereField("observerEmails", arrayContains: userEmail))
        ]

        for (queryType, query) in emailQueries {
            do {
                let snapshot = try await query.getDocuments()
                if let document = snapshot.documents.first {
                    let homeschool = try document.data(as: Homeschool.self)
                    print("✅ Found homeschool: \(homeschool.name) via \(queryType)")
                    return homeschool
                }
            } catch {
                print("❌ Error in \(queryType) query: \(error.localizedDescription)")
            }
        }

        // Fallback: scan all homeschools
        do {
            let allHomeschoolsSnapshot = try await db.collection("homeschools").getDocuments()
            print("🏠 Total homeschools in database: \(allHomeschoolsSnapshot.documents.count)")

            for doc in allHomeschoolsSnapshot.documents {
                do {
                    let hs = try doc.data(as: Homeschool.self)
                    if let userID = currentUserID {
                        if hs.parentIds?.contains(userID) == true ||
                           hs.tutorIds?.contains(userID) == true ||
                           hs.observerIds?.contains(userID) == true {
                            print("✅ Found user access via IDs in \(hs.name)")
                            return hs
                        }
                    }
                    if hs.parentEmails.contains(userEmail) ||
                       hs.tutorEmails?.contains(userEmail) == true ||
                       hs.observerEmails?.contains(userEmail) == true ||
                       hs.authorizedUsers?.contains(userEmail) == true {
                        print("✅ Found user access via emails in \(hs.name)")
                        return hs
                    }
                } catch {
                    print("❌ Error parsing homeschool \(doc.documentID): \(error)")
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
        removeAllListeners()

        // Listen to students
        if !homeschool.studentIds.isEmpty {
            let studentsListener = db.collection("people")
                .whereField(FieldPath.documentID(), in: homeschool.studentIds)
                .addSnapshotListener { [weak self] snapshot, error in
                    Task { @MainActor in
                        if let error = error {
                            print("❌ Students listener error: \(error.localizedDescription)")
                            return
                        }
                        guard let documents = snapshot?.documents else {
                            self?.students = []
                            self?.markDataLoaded("students")
                            return
                        }
                        do {
                            let students = try documents.map { try $0.data(as: Person.self) }
                            print("✅ Loaded \(students.count) students")
                            self?.students = students
                            self?.markDataLoaded("students")
                        } catch {
                            print("❌ Error parsing students: \(error)")
                        }
                    }
                }
            listeners.append(studentsListener)
        } else {
            markDataLoaded("students")
        }

        // Listen to activities
        let activitiesListener = db.collection("activities")
            .whereField("homeschoolId", isEqualTo: homeschool.id ?? "")
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    if let error = error {
                        print("❌ Activities listener error: \(error.localizedDescription)")
                        return
                    }
                    guard let documents = snapshot?.documents else {
                        self?.activities = []
                        self?.markDataLoaded("activities")
                        return
                    }
                    do {
                        let activities = try documents.map { try $0.data(as: Activity.self) }
                        print("✅ Loaded \(activities.count) activities")
                        self?.activities = activities
                        self?.markDataLoaded("activities")
                    } catch {
                        print("❌ Error parsing activities: \(error)")
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
                        print("❌ Goals listener error: \(error.localizedDescription)")
                        return
                    }
                    guard let documents = snapshot?.documents else {
                        self?.goals = []
                        self?.markDataLoaded("goals")
                        return
                    }
                    do {
                        let goals = try documents.map { try $0.data(as: Goal.self) }
                        print("✅ Loaded \(goals.count) goals")
                        self?.goals = goals
                        self?.markDataLoaded("goals")
                    } catch {
                        print("❌ Error parsing goals: \(error)")
                    }
                }
            }
        listeners.append(goalsListener)
    }

    // MARK: - Activity Instances (Week)

    public func fetchWeekInstances() async {
        let goalIds = goals.compactMap { $0.id }
        guard !goalIds.isEmpty else {
            weekInstances = []
            return
        }

        // Calculate start/end of current week using dashboard settings
        let settings = homeschool?.dashboardSettings
        let startOfWeekDay = settings?.startOfWeek ?? 1
        let tz = TimeZone(identifier: settings?.timezone ?? "America/New_York") ?? .current

        var calendar = Calendar.current
        calendar.timeZone = tz

        let now = Date()
        let today = calendar.startOfDay(for: now)
        let dayOfWeek = calendar.component(.weekday, from: today) - 1 // 0=Sun,1=Mon...
        let daysFromStart = (dayOfWeek - startOfWeekDay + 7) % 7
        guard let weekStart = calendar.date(byAdding: .day, value: -daysFromStart, to: today),
              let weekEnd = calendar.date(byAdding: .day, value: 7, to: weekStart) else {
            return
        }

        print("📅 Fetching week instances: \(weekStart) to \(weekEnd)")

        var allInstances: [ActivityInstance] = []

        // Query in chunks of 10 (Firestore 'in' query limit)
        let chunkSize = 10
        for i in stride(from: 0, to: goalIds.count, by: chunkSize) {
            let chunk = Array(goalIds[i..<min(i + chunkSize, goalIds.count)])
            do {
                let snapshot = try await db.collection("activityInstances")
                    .whereField("goalId", in: chunk)
                    .getDocuments()

                for doc in snapshot.documents {
                    if let instance = try? doc.data(as: ActivityInstance.self) {
                        let instanceDate = instance.date.dateValue()
                        if instanceDate >= weekStart && instanceDate < weekEnd {
                            allInstances.append(instance)
                        }
                    }
                }
            } catch {
                print("❌ Error fetching activity instances chunk: \(error)")
            }
        }

        print("✅ Fetched \(allInstances.count) week instances")
        weekInstances = allInstances
    }

    private func startInstanceRefresh() {
        instanceRefreshTask?.cancel()
        instanceRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds
                guard !Task.isCancelled else { break }
                await self?.fetchWeekInstances()
            }
        }
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
        weekInstances = []
        initialDataLoaded.removeAll()
        instanceRefreshTask?.cancel()
        instanceRefreshTask = nil
        removeAllListeners()
    }

    // MARK: - Progress Calculation

    public func calculateStudentProgress() -> [StudentProgress] {
        return students.map { student in
            let studentGoals = goals.filter { goal in
                goal.studentIds.contains(student.id ?? "")
            }

            // Count goals with weekly-complete status (matches web badge)
            let completedGoals = studentGoals.filter { goal in
                let status = getGoalStatus(goalId: goal.id ?? "", studentId: student.id ?? "")
                return status.status == .weeklyComplete
            }.count

            return StudentProgress(
                student: student,
                todayGoals: studentGoals,
                completedToday: completedGoals,
                totalGoals: studentGoals.count,
                weeklyProgress: [:],
                todayCompletedGoalIds: Set(),
                todayMinutes: [:]
            )
        }
    }

    /// Goal status matching web app conventions:
    /// - Green: weekly goal met (weeklyCount >= weeklyTarget)
    /// - Blue: done today (has instance today)
    /// - Yellow: progress this week (has instances this week but not today)
    /// - Gray: pending (no instances this week)
    public func getGoalStatus(goalId: String, studentId: String) -> GoalStatus {
        guard let goal = goals.first(where: { $0.id == goalId }) else {
            return GoalStatus(status: .pending, weeklyCount: 0, weeklyTarget: 0)
        }

        let target = goal.weeklyTarget ?? 0

        // Count instances this week for this student and goal
        let weeklyCount = weekInstances.filter {
            $0.goalId == goalId && $0.studentId == studentId
        }.count

        // Check if weekly requirement is met
        if target > 0 && weeklyCount >= target {
            return GoalStatus(status: .weeklyComplete, weeklyCount: weeklyCount, weeklyTarget: target)
        }

        // Check if done today
        let settings = homeschool?.dashboardSettings
        let tz = TimeZone(identifier: settings?.timezone ?? "America/New_York") ?? .current
        var calendar = Calendar.current
        calendar.timeZone = tz
        let todayStart = calendar.startOfDay(for: Date())

        let todayCount = weekInstances.filter {
            $0.goalId == goalId && $0.studentId == studentId &&
            $0.date.dateValue() >= todayStart
        }.count

        if todayCount > 0 {
            return GoalStatus(status: .doneToday, weeklyCount: weeklyCount, weeklyTarget: target)
        }

        // Check if any progress this week
        if weeklyCount > 0 {
            return GoalStatus(status: .progressWeek, weeklyCount: weeklyCount, weeklyTarget: target)
        }

        return GoalStatus(status: .pending, weeklyCount: weeklyCount, weeklyTarget: target)
    }
}

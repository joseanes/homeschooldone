import SwiftUI
import Combine
import FirebaseAuth

struct ContentView: View {
    @StateObject private var firebaseService = FirebaseService.shared
    @State private var currentStudentIndex = 0
    @State private var cycleBegan = Date()

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [Color(red: 0.1, green: 0.1, blue: 0.2), Color(red: 0.2, green: 0.2, blue: 0.3)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            if firebaseService.currentUser == nil {
                LoginView()
            } else if firebaseService.isLoading {
                VStack(spacing: 30) {
                    ProgressView()
                        .scaleEffect(2)
                        .tint(.white)
                    Text("Loading Dashboard...")
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundColor(.white)
                }
            } else if let error = firebaseService.error {
                VStack(spacing: 30) {
                    HStack {
                        Spacer()
                        Button(action: { firebaseService.signOut() }) {
                            HStack(spacing: 8) {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .font(.system(size: 20))
                                Text("Sign Out")
                                    .font(.system(size: 20, weight: .medium))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.red.opacity(0.8))
                            .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 60)

                    Spacer()

                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 60))
                        .foregroundColor(.red)
                    Text("Error")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.white)
                    Text(error)
                        .font(.system(size: 24))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 100)

                    Spacer()
                }
            } else if firebaseService.homeschool == nil {
                VStack(spacing: 30) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 60))
                        .foregroundColor(.orange)
                    Text("No Access")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.white)
                    Text("No homeschool access found for this account")
                        .font(.system(size: 24))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                }
            } else if firebaseService.students.isEmpty {
                VStack(spacing: 30) {
                    Image(systemName: "person.2.slash")
                        .font(.system(size: 60))
                        .foregroundColor(.orange)
                    Text("No Students")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.white)
                    Text("Add students in the web app to see dashboard")
                        .font(.system(size: 24))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                }
            } else {
                DashboardView(
                    currentStudentIndex: currentStudentIndex,
                    cycleBegan: cycleBegan
                )
                .environmentObject(firebaseService)
            }
        }
        .onReceive(timer) { _ in
            cycleThroughStudents()
        }
    }

    private func cycleThroughStudents() {
        guard !firebaseService.students.isEmpty else { return }
        let cycleSeconds = firebaseService.homeschool?.dashboardSettings?.cycleSeconds ?? 10
        if Date().timeIntervalSince(cycleBegan) >= Double(cycleSeconds) {
            currentStudentIndex = (currentStudentIndex + 1) % firebaseService.students.count
            cycleBegan = Date()
        }
    }
}

struct DashboardView: View {
    let currentStudentIndex: Int
    let cycleBegan: Date

    @EnvironmentObject var firebaseService: FirebaseService

    var body: some View {
        let students = firebaseService.students
        let progress = firebaseService.calculateStudentProgress()

        guard currentStudentIndex < students.count,
              currentStudentIndex < progress.count else {
            return AnyView(EmptyView())
        }

        let currentStudent = students[currentStudentIndex]
        let currentProgress = progress[currentStudentIndex]

        return AnyView(
            VStack(spacing: 0) {
                // Header
                HeaderView(
                    homeschoolName: firebaseService.homeschool?.name ?? "HomeschoolDone",
                    studentIndex: currentStudentIndex,
                    totalStudents: students.count,
                    cycleBegan: cycleBegan,
                    cycleSeconds: firebaseService.homeschool?.dashboardSettings?.cycleSeconds ?? 10
                )
                .environmentObject(firebaseService)
                .padding(.bottom, 30)

                // Student info and progress - fills remaining space
                StudentProgressView(
                    student: currentStudent,
                    progress: currentProgress,
                    activities: firebaseService.activities,
                    goals: firebaseService.goals
                )
                .environmentObject(firebaseService)
            }
            .padding(60)
        )
    }
}

struct HeaderView: View {
    let homeschoolName: String
    let studentIndex: Int
    let totalStudents: Int
    let cycleBegan: Date
    let cycleSeconds: Int

    @EnvironmentObject var firebaseService: FirebaseService
    @State private var timeRemaining = 0
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                Text(homeschoolName)
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(.white)
                Text("Dashboard")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(.gray)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 8) {
                Button(action: { firebaseService.signOut() }) {
                    HStack(spacing: 8) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 20))
                        Text("Sign Out")
                            .font(.system(size: 20, weight: .medium))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.8))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)

                Text("Student \(studentIndex + 1) of \(totalStudents)")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.white)

                HStack(spacing: 8) {
                    Image(systemName: "clock")
                        .font(.system(size: 20))
                        .foregroundColor(.gray)
                    Text("Next: \(timeRemaining)s")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(.gray)
                }
            }
        }
        .onReceive(timer) { _ in
            let elapsed = Date().timeIntervalSince(cycleBegan)
            timeRemaining = max(0, cycleSeconds - Int(elapsed))
        }
        .onAppear {
            let elapsed = Date().timeIntervalSince(cycleBegan)
            timeRemaining = max(0, cycleSeconds - Int(elapsed))
        }
    }
}

struct StudentProgressView: View {
    let student: Person
    let progress: StudentProgress
    let activities: [Activity]
    let goals: [Goal]

    @EnvironmentObject var firebaseService: FirebaseService

    var completionPercentage: Double {
        guard progress.totalGoals > 0 else { return 0.0 }
        return Double(progress.completedToday) / Double(progress.totalGoals)
    }

    var body: some View {
        GeometryReader { geometry in
            let leftWidth: CGFloat = 350
            let spacing: CGFloat = 60
            let rightWidth = geometry.size.width - leftWidth - spacing
            let totalHeight = geometry.size.height

            HStack(alignment: .top, spacing: spacing) {
                // Left side - Student info with circular progress
                VStack(spacing: 30) {
                    Text(student.name)
                        .font(.system(size: 56, weight: .bold))
                        .foregroundColor(Color(red: 0.4, green: 0.8, blue: 0.6))

                    // Circular progress chart
                    ZStack {
                        Circle()
                            .stroke(Color.gray.opacity(0.3), lineWidth: 16)
                            .frame(width: 250, height: 250)

                        Circle()
                            .trim(from: 0, to: completionPercentage)
                            .stroke(Color(red: 0.3, green: 0.69, blue: 0.31), style: StrokeStyle(lineWidth: 16, lineCap: .round))
                            .frame(width: 250, height: 250)
                            .rotationEffect(.degrees(-90))
                            .animation(.easeInOut(duration: 1.0), value: completionPercentage)

                        VStack(spacing: 8) {
                            Text("\(progress.completedToday)/\(progress.totalGoals)")
                                .font(.system(size: 48, weight: .bold))
                                .foregroundColor(.white)
                            Text("This Week")
                                .font(.system(size: 22))
                                .foregroundColor(.gray)
                        }
                    }

                    Text("\(Int(completionPercentage * 100))% Complete")
                        .font(.system(size: 28, weight: .medium))
                        .foregroundColor(.white)
                }
                .frame(width: leftWidth)

                // Right side - Goals grid (auto-sizing)
                GoalsGridView(
                    progress: progress,
                    activities: activities,
                    student: student,
                    availableWidth: rightWidth,
                    availableHeight: totalHeight
                )
                .environmentObject(firebaseService)
            }
        }
    }
}

struct GoalsGridView: View {
    let progress: StudentProgress
    let activities: [Activity]
    let student: Person
    let availableWidth: CGFloat
    let availableHeight: CGFloat

    @EnvironmentObject var firebaseService: FirebaseService

    private var columns: Int {
        let count = progress.todayGoals.count
        if count <= 2 { return 1 }
        if count <= 6 { return 2 }
        if count <= 9 { return 3 }
        return 4
    }

    private var rows: Int {
        let count = progress.todayGoals.count
        guard count > 0 else { return 1 }
        return Int(ceil(Double(count) / Double(columns)))
    }

    private let gridSpacing: CGFloat = 16
    private let headerHeight: CGFloat = 50

    private var cardHeight: CGFloat {
        let usableHeight = availableHeight - headerHeight - CGFloat(rows - 1) * gridSpacing
        let computed = usableHeight / CGFloat(rows)
        return min(350, max(100, computed))
    }

    // Sort goals: pending first, then progress, then done today, then weekly complete
    private var sortedGoals: [Goal] {
        progress.todayGoals.sorted { a, b in
            let statusA = firebaseService.getGoalStatus(goalId: a.id ?? "", studentId: student.id ?? "")
            let statusB = firebaseService.getGoalStatus(goalId: b.id ?? "", studentId: student.id ?? "")

            let priority: [GoalStatusType: Int] = [
                .pending: 1,
                .progressWeek: 2,
                .doneToday: 3,
                .weeklyComplete: 4
            ]

            let pA = priority[statusA.status] ?? 0
            let pB = priority[statusB.status] ?? 0
            if pA != pB { return pA < pB }

            let nameA = a.name ?? activities.first { $0.id == a.activityId }?.name ?? ""
            let nameB = b.name ?? activities.first { $0.id == b.activityId }?.name ?? ""
            return nameA < nameB
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Weekly Goals")
                .font(.system(size: 36, weight: .bold))
                .foregroundColor(Color(red: 0.4, green: 0.8, blue: 0.6))

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: gridSpacing), count: columns),
                spacing: gridSpacing
            ) {
                ForEach(sortedGoals, id: \.id) { goal in
                    GoalCardView(
                        goal: goal,
                        student: student,
                        activity: activities.first { $0.id == goal.activityId }
                    )
                    .environmentObject(firebaseService)
                    .frame(height: cardHeight)
                }
            }

            Spacer(minLength: 0)
        }
    }
}

struct GoalCardView: View {
    let goal: Goal
    let student: Person
    let activity: Activity?

    @EnvironmentObject var firebaseService: FirebaseService

    var body: some View {
        let status = firebaseService.getGoalStatus(goalId: goal.id ?? "", studentId: student.id ?? "")
        let goalDisplayName = goal.name ?? activity?.name ?? "Unknown"

        ZStack(alignment: .topTrailing) {
            VStack(spacing: 0) {
                Spacer(minLength: 8)

                // Icon
                Image(systemName: activityIcon(for: activity?.name ?? ""))
                    .font(.system(size: 36))
                    .foregroundColor(statusAccentColor(for: status.status))

                Spacer(minLength: 8)

                // Goal name
                Text(goalDisplayName)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.horizontal, 8)

                Spacer(minLength: 6)

                // Weekly progress
                if let target = goal.weeklyTarget, target > 0 {
                    Text("\(status.weeklyCount)/\(target) wk")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.gray)
                }

                Spacer(minLength: 6)

                // Status badge
                Text(statusText(for: status.status))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(statusTextColor(for: status.status))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(statusBadgeBackground(for: status.status))
                    )

                Spacer(minLength: 8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(cardBackgroundColor(for: status.status))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(cardBorderColor(for: status.status), lineWidth: status.status == .weeklyComplete ? 3 : 1.5)
                    )
            )

            // Green checkmark for weekly complete
            if status.status == .weeklyComplete {
                ZStack {
                    Circle()
                        .fill(Color(red: 0.30, green: 0.69, blue: 0.31))
                        .frame(width: 40, height: 40)
                    Image(systemName: "checkmark")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                }
                .offset(x: -8, y: 8)
            }
        }
    }

    private func activityIcon(for activityName: String) -> String {
        let name = activityName.lowercased()
        if name.contains("math") || name.contains("khan") { return "function" }
        if name.contains("english") || name.contains("ela") || name.contains("reading") || name.contains("book") { return "book.fill" }
        if name.contains("piano") || name.contains("music") { return "music.note" }
        if name.contains("tennis") || name.contains("soccer") || name.contains("sport") { return "figure.run" }
        if name.contains("robot") || name.contains("first") || name.contains("coding") { return "gearshape.2" }
        if name.contains("geography") || name.contains("map") { return "globe.americas" }
        if name.contains("duolingo") || name.contains("language") || name.contains("spanish") || name.contains("french") { return "globe" }
        if name.contains("radio") || name.contains("ham") { return "antenna.radiowaves.left.and.right" }
        if name.contains("science") || name.contains("chemistry") { return "flask" }
        if name.contains("art") || name.contains("draw") || name.contains("paint") { return "paintbrush" }
        if name.contains("history") { return "clock.arrow.circlepath" }
        return "star.fill"
    }

    // Web-matched colors: Green (#4caf50), Blue (#2196f3), Yellow (#ffc107), Gray (#9e9e9e)

    private func cardBackgroundColor(for status: GoalStatusType) -> Color {
        switch status {
        case .weeklyComplete: return Color(red: 0.91, green: 0.96, blue: 0.91) // #e8f5e9
        case .doneToday:      return Color(red: 0.89, green: 0.95, blue: 0.99) // #e3f2fd
        case .progressWeek:   return Color(red: 1.0,  green: 0.97, blue: 0.88) // #fff8e1
        case .pending:        return Color(red: 0.96, green: 0.96, blue: 0.96) // #f5f5f5
        }
    }

    private func cardBorderColor(for status: GoalStatusType) -> Color {
        switch status {
        case .weeklyComplete: return Color(red: 0.30, green: 0.69, blue: 0.31) // #4caf50
        case .doneToday:      return Color(red: 0.13, green: 0.59, blue: 0.95) // #2196f3
        case .progressWeek:   return Color(red: 1.0,  green: 0.76, blue: 0.03) // #ffc107
        case .pending:        return Color(red: 0.62, green: 0.62, blue: 0.62) // #9e9e9e
        }
    }

    private func statusAccentColor(for status: GoalStatusType) -> Color {
        switch status {
        case .weeklyComplete: return Color(red: 0.30, green: 0.69, blue: 0.31)
        case .doneToday:      return Color(red: 0.13, green: 0.59, blue: 0.95)
        case .progressWeek:   return Color(red: 0.96, green: 0.49, blue: 0.0)
        case .pending:        return Color(red: 0.62, green: 0.62, blue: 0.62)
        }
    }

    private func statusTextColor(for status: GoalStatusType) -> Color {
        switch status {
        case .weeklyComplete: return Color(red: 0.18, green: 0.49, blue: 0.20) // #2e7d32
        case .doneToday:      return Color(red: 0.08, green: 0.40, blue: 0.75) // #1565c0
        case .progressWeek:   return Color(red: 0.96, green: 0.49, blue: 0.0)  // #f57c00
        case .pending:        return Color(red: 0.38, green: 0.38, blue: 0.38) // #616161
        }
    }

    private func statusBadgeBackground(for status: GoalStatusType) -> Color {
        switch status {
        case .weeklyComplete: return Color(red: 0.30, green: 0.69, blue: 0.31).opacity(0.15)
        case .doneToday:      return Color(red: 0.13, green: 0.59, blue: 0.95).opacity(0.15)
        case .progressWeek:   return Color(red: 1.0,  green: 0.76, blue: 0.03).opacity(0.15)
        case .pending:        return Color.gray.opacity(0.15)
        }
    }

    private func statusText(for status: GoalStatusType) -> String {
        switch status {
        case .weeklyComplete: return "Weekly Complete"
        case .doneToday:      return "Done Today"
        case .progressWeek:   return "Progress This Week"
        case .pending:        return "Pending"
        }
    }
}

#Preview {
    ContentView()
}

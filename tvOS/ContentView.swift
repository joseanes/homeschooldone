import SwiftUI
import SharedModels
import FirebaseService

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
                LoginScreen()
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
            VStack(spacing: 40) {
                HeaderView(
                    homeschoolName: firebaseService.homeschool?.name ?? "HomeschoolDone",
                    studentIndex: currentStudentIndex,
                    totalStudents: students.count,
                    cycleBegan: cycleBegan,
                    cycleSeconds: firebaseService.homeschool?.dashboardSettings?.cycleSeconds ?? 10
                )

                StudentProgressView(
                    student: currentStudent,
                    progress: currentProgress,
                    activities: firebaseService.activities,
                    goals: firebaseService.goals
                )
                .environmentObject(firebaseService)

                Spacer()
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

    var body: some View {
        HStack(spacing: 80) {
            // Left side - Student info
            VStack(alignment: .leading, spacing: 20) {
                HStack(spacing: 20) {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(student.name)
                            .font(.system(size: 42, weight: .bold))
                            .foregroundColor(.white)
                        Text("Weekly Progress")
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(.gray)
                    }
                }

                HStack(spacing: 40) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(progress.completedToday)")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.green)
                        Text("Complete")
                            .font(.system(size: 18))
                            .foregroundColor(.gray)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(progress.totalGoals)")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.blue)
                        Text("Total Goals")
                            .font(.system(size: 18))
                            .foregroundColor(.gray)
                    }
                }
            }

            // Right side - Goals list
            VStack(alignment: .leading, spacing: 20) {
                Text("Weekly Goals")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(.white)

                LazyVStack(spacing: 12) {
                    ForEach(progress.todayGoals, id: \.id) { goal in
                        GoalRowView(
                            goal: goal,
                            student: student,
                            activity: activities.first { $0.id == goal.activityId }
                        )
                        .environmentObject(firebaseService)
                    }
                }
            }
        }
    }
}

struct GoalRowView: View {
    let goal: Goal
    let student: Person
    let activity: Activity?

    @EnvironmentObject var firebaseService: FirebaseService

    var body: some View {
        let status = firebaseService.getGoalStatus(goalId: goal.id ?? "", studentId: student.id ?? "")
        let goalDisplayName = goal.name ?? activity?.name ?? "Unknown"

        HStack(spacing: 20) {
            Circle()
                .fill(statusColor(for: status.status))
                .frame(width: 20, height: 20)

            Text(goalDisplayName)
                .font(.system(size: 22, weight: .medium))
                .foregroundColor(.white)
                .frame(minWidth: 200, alignment: .leading)

            if let target = goal.weeklyTarget, target > 0 {
                Text("\(status.weeklyCount)/\(target) wk")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.gray)
            }

            Spacer()

            Text(statusText(for: status.status))
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(statusColor(for: status.status))
        }
        .padding(.vertical, 8)
    }

    private func statusColor(for status: GoalStatusType) -> Color {
        switch status {
        case .pending:        return .gray
        case .progressWeek:   return .yellow
        case .doneToday:      return .blue
        case .weeklyComplete: return .green
        }
    }

    private func statusText(for status: GoalStatusType) -> String {
        switch status {
        case .pending:        return "Pending"
        case .progressWeek:   return "Progress This Week"
        case .doneToday:      return "Done Today"
        case .weeklyComplete: return "Weekly Complete"
        }
    }
}

#Preview {
    ContentView()
}

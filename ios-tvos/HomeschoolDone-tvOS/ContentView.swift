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
                // Login required
                LoginScreen()
            } else if firebaseService.isLoading {
                // Loading state
                VStack(spacing: 30) {
                    ProgressView()
                        .scaleEffect(2)
                        .tint(.white)
                    
                    Text("Loading Dashboard...")
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundColor(.white)
                }
            } else if let error = firebaseService.error {
                // Error state
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
                // No students state
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
                // Main dashboard
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
                // Header
                HeaderView(
                    homeschoolName: firebaseService.homeschool?.name ?? "HomeschoolDone",
                    studentIndex: currentStudentIndex,
                    totalStudents: students.count,
                    cycleBegan: cycleBegan,
                    cycleSeconds: firebaseService.homeschool?.dashboardSettings?.cycleSeconds ?? 10
                )
                
                // Student info and progress
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
                Text("Student \\(studentIndex + 1) of \\(totalStudents)")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.white)
                
                HStack(spacing: 8) {
                    Image(systemName: "clock")
                        .font(.system(size: 20))
                        .foregroundColor(.gray)
                    
                    Text("Next: \\(timeRemaining)s")
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
                        
                        Text("Today's Progress")
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(.gray)
                    }
                }
                
                // Progress summary
                HStack(spacing: 40) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\\(progress.completedToday)")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.green)
                        Text("Completed")
                            .font(.system(size: 18))
                            .foregroundColor(.gray)
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\\(progress.totalGoals)")
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
                Text("Today's Goals")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(.white)
                
                LazyVStack(spacing: 12) {
                    ForEach(progress.todayGoals, id: \\.id) { goal in
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
        
        HStack(spacing: 20) {
            // Status indicator
            Circle()
                .fill(statusColor(for: status.status))
                .frame(width: 20, height: 20)
            
            // Activity name
            Text(activity?.name ?? "Unknown Activity")
                .font(.system(size: 22, weight: .medium))
                .foregroundColor(.white)
                .frame(minWidth: 200, alignment: .leading)
            
            // Progress bar
            ProgressView(value: Double(status.progress), total: Double(status.target))
                .progressViewStyle(LinearProgressViewStyle(tint: statusColor(for: status.status)))
                .frame(width: 200)
            
            // Time info
            VStack(alignment: .trailing, spacing: 2) {
                Text("\\(status.minutesToday)/\\(status.minutesTarget) min")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.white)
                
                if status.status == .completedToday {
                    Text("✅ Complete")
                        .font(.system(size: 14))
                        .foregroundColor(.green)
                } else if status.status == .overTime {
                    Text("🎉 Extra time!")
                        .font(.system(size: 14))
                        .foregroundColor(.orange)
                } else if status.status == .inProgress {
                    Text("⏱ In progress")
                        .font(.system(size: 14))
                        .foregroundColor(.yellow)
                } else {
                    Text("Not started")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                }
            }
            .frame(minWidth: 120, alignment: .trailing)
        }
        .padding(.vertical, 8)
    }
    
    private func statusColor(for status: GoalStatusType) -> Color {
        switch status {
        case .notStarted:
            return .gray
        case .inProgress:
            return .yellow
        case .completedToday:
            return .green
        case .overTime:
            return .orange
        }
    }
}

struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isSigningIn = false
    @StateObject private var firebaseService = FirebaseService.shared
    @FocusState private var emailFocused: Bool
    @FocusState private var passwordFocused: Bool
    
    init() {
        print("🔴 LoginView INIT - THIS IS THE NEW VERSION WITH TEXT FIELDS")
    }
    
    var body: some View {
        VStack(spacing: 40) {
            Text("🚨 UPDATED VERSION WITH LOGIN FIELDS 🚨")
                .font(.system(size: 30, weight: .bold))
                .foregroundColor(.red)
            
            VStack(spacing: 16) {
                Image(systemName: "graduationcap.circle.fill")
                    .font(.system(size: 100))
                    .foregroundColor(.blue)
                
                Text("HomeschoolDone")
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(.white)
                
                Text("Apple TV Dashboard")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.gray)
            }
            
            VStack(spacing: 30) {
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 600)
                    .font(.system(size: 24))
                    .focused($emailFocused)
                
                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 600)
                    .font(.system(size: 24))
                    .focused($passwordFocused)
                
                Button {
                    Task {
                        await signIn()
                    }
                } label: {
                    if isSigningIn {
                        ProgressView()
                            .scaleEffect(1.5)
                            .tint(.white)
                            .frame(width: 200, height: 60)
                    } else {
                        Text("Sign In")
                            .font(.system(size: 24, weight: .semibold))
                            .frame(width: 200, height: 60)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(email.isEmpty || password.isEmpty || isSigningIn)
                
                if let error = firebaseService.error {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.system(size: 18))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 100)
                }
            }
        }
        .padding(60)
        .onAppear {
            emailFocused = true
        }
    }
    
    private func signIn() async {
        isSigningIn = true
        do {
            try await firebaseService.signIn(email: email, password: password)
        } catch {
            // Error shown via firebaseService.error
        }
        isSigningIn = false
    }
}

#Preview {
    ContentView()
}
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
                // Login required - Use LoginView from LoginScreen.swift
                LoginView()
            } else if firebaseService.isLoading {
                // Loading state
                VStack(spacing: 30) {
                    ProgressView()
                        .scaleEffect(2)
                        .tint(.white)
                    
                    Text("Loading Dashboard...")
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundColor(.white)
                    
                    Text("Debug: isLoading=\(firebaseService.isLoading), homeschool=\(firebaseService.homeschool?.name ?? "nil"), students=\(firebaseService.students.count)")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                        .padding(.top)
                }
            } else if let error = firebaseService.error {
                // Error state
                VStack(spacing: 30) {
                    HStack {
                        Spacer()
                        Button(action: {
                            firebaseService.signOut()
                        }) {
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
                    
                    // Debug: Show logged in user
                    if let user = firebaseService.currentUser {
                        Text("Logged in as: \(user.email ?? "Unknown")")
                            .font(.system(size: 18))
                            .foregroundColor(.yellow)
                            .padding(.top, 8)
                    }
                    
                    Spacer()
                }
            } else if firebaseService.homeschool == nil {
                // No homeschool access
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
                    
                    Text("Debug: Homeschool=\(firebaseService.homeschool?.name ?? "nil"), StudentIDs=\(firebaseService.homeschool?.studentIds.count ?? 0)")
                        .font(.system(size: 14))
                        .foregroundColor(.yellow)
                        .padding(.top)
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
                .environmentObject(firebaseService)
                
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
                
                // Debug: Show logged in user
                if let user = firebaseService.currentUser {
                    Text("Logged in as: \(user.email ?? "Unknown")")
                        .font(.system(size: 16))
                        .foregroundColor(.yellow)
                        .padding(.top, 4)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 8) {
                Button(action: {
                    firebaseService.signOut()
                }) {
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
        HStack(spacing: 100) {
            // Left side - Student info with circular progress
            VStack(alignment: .center, spacing: 40) {
                // Student name
                Text(student.name)
                    .font(.system(size: 56, weight: .bold))
                    .foregroundColor(Color(red: 0.4, green: 0.8, blue: 0.6))
                
                // Circular progress chart
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.3), lineWidth: 16)
                        .frame(width: 280, height: 280)
                    
                    Circle()
                        .trim(from: 0, to: completionPercentage)
                        .stroke(Color(red: 0.4, green: 0.8, blue: 0.6), style: StrokeStyle(lineWidth: 16, lineCap: .round))
                        .frame(width: 280, height: 280)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut(duration: 1.0), value: completionPercentage)
                    
                    VStack(spacing: 8) {
                        Text("\(progress.completedToday)/\(progress.totalGoals)")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.white)
                        
                        Text("Today")
                            .font(.system(size: 24))
                            .foregroundColor(.gray)
                    }
                }
                
                VStack(spacing: 8) {
                    Text("\(Int(completionPercentage * 100))% Complete")
                        .font(.system(size: 28, weight: .medium))
                        .foregroundColor(.white)
                    
                    Text("Last activity: 2 hours ago")
                        .font(.system(size: 20))
                        .foregroundColor(.gray)
                }
            }
            
            // Right side - Goals grid
            VStack(alignment: .leading, spacing: 30) {
                Text("Today's Goals")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(Color(red: 0.4, green: 0.8, blue: 0.6))
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 20), count: 2), spacing: 20) {
                    ForEach(progress.todayGoals, id: \.id) { goal in
                        GoalCardView(
                            goal: goal,
                            student: student,
                            activity: activities.first { $0.id == goal.activityId }
                        )
                        .environmentObject(firebaseService)
                    }
                }
            }
        }
        .padding(.horizontal, 60)
    }
}

struct GoalCardView: View {
    let goal: Goal
    let student: Person
    let activity: Activity?
    
    @EnvironmentObject var firebaseService: FirebaseService
    
    var body: some View {
        let status = firebaseService.getGoalStatus(goalId: goal.id ?? "", studentId: student.id ?? "")
        
        VStack(spacing: 0) {
            // Card content
            VStack(spacing: 16) {
                // Icon and activity name
                VStack(spacing: 12) {
                    Image(systemName: activityIcon(for: activity?.name ?? ""))
                        .font(.system(size: 40))
                        .foregroundColor(Color.orange.opacity(0.8))
                    
                    Text(activity?.name ?? "Unknown Activity")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
                
                // Sessions per week (if available)
                if let sessionsPerWeek = goal.sessionsPerWeek {
                    Text("\(sessionsPerWeek)x/week")
                        .font(.system(size: 16))
                        .foregroundColor(.gray)
                }
                
                // Minutes info
                if let minutesPerSession = goal.minutesPerSession {
                    Text("\(minutesPerSession) min")
                        .font(.system(size: 16))
                        .foregroundColor(.gray)
                }
                
                // Status
                Text(statusText(for: status.status))
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(statusTextColor(for: status.status))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
            }
            .padding(24)
            .frame(width: 280, height: 200)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(cardBackgroundColor(for: status.status))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(cardBorderColor(for: status.status), lineWidth: status.status == .completedToday ? 3 : 1)
                    )
            )
            
            // Checkmark for completed goals
            if status.status == .completedToday {
                ZStack {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: "checkmark")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)
                }
                .offset(y: -25)
            }
        }
    }
    
    private func activityIcon(for activityName: String) -> String {
        let name = activityName.lowercased()
        if name.contains("math") || name.contains("khan") {
            return "function"
        } else if name.contains("english") || name.contains("reading") || name.contains("book") {
            return "book.fill"
        } else if name.contains("piano") || name.contains("music") {
            return "music.note"
        } else if name.contains("tennis") || name.contains("sport") {
            return "figure.tennis"
        } else if name.contains("robot") || name.contains("coding") {
            return "gear"
        } else {
            return "hourglass"
        }
    }
    
    private func cardBackgroundColor(for status: GoalStatusType) -> Color {
        switch status {
        case .completedToday:
            return Color.green.opacity(0.15)
        case .inProgress:
            return Color.yellow.opacity(0.1)
        case .overTime:
            return Color.orange.opacity(0.15)
        case .notStarted:
            return Color.gray.opacity(0.2)
        }
    }
    
    private func cardBorderColor(for status: GoalStatusType) -> Color {
        switch status {
        case .completedToday:
            return Color.green
        case .inProgress:
            return Color.yellow.opacity(0.6)
        case .overTime:
            return Color.orange
        case .notStarted:
            return Color.gray.opacity(0.5)
        }
    }
    
    private func statusText(for status: GoalStatusType) -> String {
        switch status {
        case .completedToday:
            return "Complete"
        case .inProgress:
            return "In Progress"
        case .overTime:
            return "Extra Time!"
        case .notStarted:
            return "Pending"
        }
    }
    
    private func statusTextColor(for status: GoalStatusType) -> Color {
        switch status {
        case .completedToday:
            return Color.green
        case .inProgress:
            return Color.yellow
        case .overTime:
            return Color.orange
        case .notStarted:
            return Color.gray
        }
    }
}

#Preview {
    ContentView()
}
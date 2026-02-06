import SwiftUI
import SharedModels
import FirebaseService

struct ContentView: View {
    @StateObject private var firebaseService = FirebaseService.shared
    @State private var showingLoginSheet = false
    
    var body: some View {
        NavigationView {
            Group {
                if firebaseService.currentUser == nil {
                    LoginPromptView(showingLoginSheet: $showingLoginSheet)
                } else if firebaseService.isLoading {
                    LoadingView()
                } else if let error = firebaseService.error {
                    ErrorView(error: error)
                } else if firebaseService.students.isEmpty {
                    EmptyStateView()
                } else {
                    DashboardSettingsView()
                        .environmentObject(firebaseService)
                }
            }
            .navigationTitle("HomeschoolDone")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if firebaseService.currentUser != nil {
                        Button("Sign Out") {
                            firebaseService.signOut()
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showingLoginSheet) {
            LoginView()
                .environmentObject(firebaseService)
        }
    }
}

struct LoginPromptView: View {
    @Binding var showingLoginSheet: Bool
    
    var body: some View {
        VStack(spacing: 30) {
            Image(systemName: "graduationcap.circle.fill")
                .font(.system(size: 100))
                .foregroundColor(.blue)
            
            VStack(spacing: 16) {
                Text("HomeschoolDone")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Apple TV Dashboard Setup")
                    .font(.title2)
                    .foregroundColor(.secondary)
            }
            
            VStack(spacing: 12) {
                Text("Sign in to configure your Apple TV dashboard")
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                
                Button("Sign In") {
                    showingLoginSheet = true
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
        .padding()
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            
            Text("Loading your homeschool data...")
                .font(.headline)
                .foregroundColor(.secondary)
        }
    }
}

struct ErrorView: View {
    let error: String
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 60))
                .foregroundColor(.red)
            
            Text("Error")
                .font(.title)
                .fontWeight(.bold)
            
            Text(error)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
                .padding(.horizontal)
        }
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 60))
                .foregroundColor(.orange)
            
            Text("No Students Found")
                .font(.title)
                .fontWeight(.bold)
            
            Text("Add students in your web app to see the dashboard")
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
                .padding(.horizontal)
        }
    }
}

struct DashboardSettingsView: View {
    @EnvironmentObject var firebaseService: FirebaseService
    
    var body: some View {
        List {
            Section {
                HStack {
                    Image(systemName: "tv")
                        .foregroundColor(.blue)
                    VStack(alignment: .leading) {
                        Text("Apple TV Ready")
                            .font(.headline)
                        Text("Your dashboard is ready to display on Apple TV")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
                .padding(.vertical, 4)
            }
            
            Section("Dashboard Info") {
                if let homeschool = firebaseService.homeschool {
                    LabeledContent("Homeschool", value: homeschool.name)
                    LabeledContent("Students", value: "\\(firebaseService.students.count)")
                    LabeledContent("Activities", value: "\\(firebaseService.activities.count)")
                    LabeledContent("Goals", value: "\\(firebaseService.goals.count)")
                }
            }
            
            Section("TV Display Settings") {
                if let settings = firebaseService.homeschool?.dashboardSettings {
                    LabeledContent("Cycle Time", value: "\\(settings.cycleSeconds) seconds")
                    LabeledContent("Week Starts", value: dayName(for: settings.startOfWeek))
                    LabeledContent("Timezone", value: settings.timezone)
                } else {
                    Text("Using default settings")
                        .foregroundColor(.secondary)
                }
            }
            
            Section("Today's Activity") {
                if firebaseService.todayInstances.isEmpty {
                    Text("No activity recorded today")
                        .foregroundColor(.secondary)
                } else {
                    Text("\\(firebaseService.todayInstances.count) activities completed")
                        .foregroundColor(.green)
                }
            }
            
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Instructions")
                        .font(.headline)
                    
                    Text("1. Open HomeschoolDone app on your Apple TV")
                    Text("2. Sign in with the same account")
                    Text("3. Dashboard will automatically cycle through students")
                    Text("4. Changes made in web app appear instantly on TV")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
        }
    }
    
    private func dayName(for dayIndex: Int) -> String {
        let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        return days[safe: dayIndex] ?? "Monday"
    }
}

struct LoginView: View {
    @EnvironmentObject var firebaseService: FirebaseService
    @Environment(\\.dismiss) private var dismiss
    
    @State private var email = ""
    @State private var password = ""
    @State private var isSigningIn = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                VStack(spacing: 16) {
                    Image(systemName: "graduationcap.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)
                    
                    Text("Sign In")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Use your HomeschoolDone account")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                }
                
                Button {
                    Task {
                        await signIn()
                    }
                } label: {
                    if isSigningIn {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Sign In")
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(email.isEmpty || password.isEmpty || isSigningIn)
                
                if let error = firebaseService.error {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                        .multilineTextAlignment(.center)
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func signIn() async {
        isSigningIn = true
        
        do {
            try await firebaseService.signIn(email: email, password: password)
            dismiss()
        } catch {
            // Error is handled by FirebaseService
        }
        
        isSigningIn = false
    }
}

extension Array {
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}

#Preview {
    ContentView()
}
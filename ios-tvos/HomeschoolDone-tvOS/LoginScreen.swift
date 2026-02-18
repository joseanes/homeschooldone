import SwiftUI

struct LoginScreen: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isSigningIn = false
    @StateObject private var firebaseService = FirebaseService.shared
    @FocusState private var emailFocused: Bool
    @FocusState private var passwordFocused: Bool
    
    var body: some View {
        ZStack {
            Color.blue.opacity(0.1).ignoresSafeArea()
            
            VStack(spacing: 40) {
                Text("🎯 THIS IS THE NEW LOGIN SCREEN 🎯")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundColor(.red)
                
                VStack(spacing: 16) {
                    Image(systemName: "graduationcap.circle.fill")
                        .font(.system(size: 100))
                        .foregroundColor(.blue)
                    
                    Text("HomeschoolDone")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.white)
                }
                
                VStack(spacing: 30) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Email")
                            .font(.system(size: 20))
                            .foregroundColor(.white)
                        
                        TextField("Enter your email", text: $email)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 600)
                            .font(.system(size: 24))
                            .focused($emailFocused)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Password")
                            .font(.system(size: 20))
                            .foregroundColor(.white)
                        
                        SecureField("Enter your password", text: $password)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 600)
                            .font(.system(size: 24))
                            .focused($passwordFocused)
                    }
                    
                    Button {
                        Task {
                            await signIn()
                        }
                    } label: {
                        if isSigningIn {
                            ProgressView()
                                .scaleEffect(1.5)
                                .tint(.white)
                                .frame(width: 300, height: 70)
                        } else {
                            Text("Sign In")
                                .font(.system(size: 28, weight: .bold))
                                .frame(width: 300, height: 70)
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
        }
        .onAppear {
            print("✅ LoginScreen appeared - text fields should be visible")
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
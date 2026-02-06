import SwiftUI

struct AppIconView: View {
    var body: some View {
        ZStack {
            // Background
            RoundedRectangle(cornerRadius: 22)
                .fill(
                    LinearGradient(
                        colors: [Color.orange, Color.orange.opacity(0.8)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            VStack(spacing: 8) {
                // House icon
                ZStack {
                    // House body
                    Rectangle()
                        .fill(Color.white.opacity(0.9))
                        .frame(width: 60, height: 40)
                        .offset(y: 10)
                    
                    // Roof
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: 20))
                        path.addLine(to: CGPoint(x: 30, y: 0))
                        path.addLine(to: CGPoint(x: 60, y: 20))
                    }
                    .stroke(Color.white, lineWidth: 8)
                    .offset(y: -10)
                    
                    // Checkmark
                    Circle()
                        .fill(Color.white)
                        .frame(width: 32, height: 32)
                        .overlay(
                            Path { path in
                                path.move(to: CGPoint(x: 8, y: 16))
                                path.addLine(to: CGPoint(x: 14, y: 22))
                                path.addLine(to: CGPoint(x: 24, y: 10))
                            }
                            .stroke(Color.green, lineWidth: 4)
                        )
                        .offset(y: 5)
                }
                .frame(width: 80, height: 80)
            }
        }
        .frame(width: 1024, height: 1024)
    }
}
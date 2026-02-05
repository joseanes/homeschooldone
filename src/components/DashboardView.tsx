import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Goal, Activity, ActivityInstance } from '../types';
import { formatLastActivity } from '../utils/activityTracking';

interface DashboardViewProps {
  homeschool: Homeschool;
  students: Person[];
  goals: Goal[];
  activities: Activity[];
  onClose: () => void;
  cycleSeconds?: number;
  startOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  timezone?: string;
}

interface StudentProgress {
  student: Person;
  todayGoals: Goal[];
  completedToday: number;
  totalGoals: number;
  weeklyProgress: { [goalId: string]: number };
  todayCompletedGoalIds: Set<string>;
  todayMinutes: { [goalId: string]: number };
}

const DashboardView: React.FC<DashboardViewProps> = ({
  homeschool,
  students,
  goals,
  activities,
  onClose,
  cycleSeconds = 10,
  startOfWeek = 1, // Monday default
  timezone = 'America/New_York' // EST default
}) => {
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle ESC key
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [onClose]);

  // Cycle through students
  useEffect(() => {
    if (students.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStudentIndex((prev) => (prev + 1) % students.length);
    }, cycleSeconds * 1000);

    return () => clearInterval(interval);
  }, [students.length, cycleSeconds]);

  // Get start and end of current week
  const getWeekDates = () => {
    // Get current date in the specified timezone properly
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(part => part.type === 'year')?.value || '2024');
    const month = parseInt(parts.find(part => part.type === 'month')?.value || '1') - 1;
    const day = parseInt(parts.find(part => part.type === 'day')?.value || '1');
    
    const currentDate = new Date(year, month, day);
    const currentDay = currentDate.getDay(); // 0 = Sunday
    const daysFromStartOfWeek = (currentDay - startOfWeek + 7) % 7;
    const startOfCurrentWeek = new Date(currentDate);
    startOfCurrentWeek.setDate(currentDate.getDate() - daysFromStartOfWeek);
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    
    const endOfCurrentWeek = new Date(startOfCurrentWeek);
    endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 6);
    endOfCurrentWeek.setHours(23, 59, 59, 999);
    
    return { startOfWeek: startOfCurrentWeek, endOfWeek: endOfCurrentWeek };
  };

  // Fetch student progress
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { startOfWeek: weekStart, endOfWeek: weekEnd } = getWeekDates();
        // Get today's date in the specified timezone properly
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', { 
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        const parts = formatter.formatToParts(now);
        const year = parseInt(parts.find(part => part.type === 'year')?.value || '2024');
        const month = parseInt(parts.find(part => part.type === 'month')?.value || '1') - 1;
        const day = parseInt(parts.find(part => part.type === 'day')?.value || '1');
        
        const today = new Date(year, month, day);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const progressPromises = students.map(async (student) => {
          // Get goals for this student
          const studentGoals = goals.filter(goal => goal.studentIds?.includes(student.id));
          
          // Get today's activity instances for this student
          const instancesQuery = query(
            collection(db, 'activityInstances'),
            where('studentId', '==', student.id),
            where('date', '>=', today),
            where('date', '<', tomorrow)
          );
          const todayInstances = await getDocs(instancesQuery);
          const todayGoalIds = new Set(todayInstances.docs.map(doc => doc.data().goalId));
          
          // Calculate today's minutes per goal
          const todayMinutes: { [goalId: string]: number } = {};
          todayInstances.docs.forEach(doc => {
            const data = doc.data();
            const goalId = data.goalId;
            const duration = data.duration || 0;
            todayMinutes[goalId] = (todayMinutes[goalId] || 0) + duration;
          });

          // Get week's activity instances for weekly progress
          const weekInstancesQuery = query(
            collection(db, 'activityInstances'),
            where('studentId', '==', student.id),
            where('date', '>=', weekStart),
            where('date', '<=', weekEnd)
          );
          const weekInstances = await getDocs(weekInstancesQuery);
          const weeklyProgress: { [goalId: string]: number } = {};
          
          weekInstances.docs.forEach(doc => {
            const data = doc.data();
            const goalId = data.goalId;
            weeklyProgress[goalId] = (weeklyProgress[goalId] || 0) + 1;
          });

          return {
            student,
            todayGoals: studentGoals,
            completedToday: studentGoals.filter(goal => {
              if (!todayGoalIds.has(goal.id)) return false;
              if (goal.minutesPerSession) {
                return (todayMinutes[goal.id] || 0) >= goal.minutesPerSession;
              }
              return true; // Non-time based goals count as complete if they have activity
            }).length,
            totalGoals: studentGoals.length,
            weeklyProgress,
            todayCompletedGoalIds: todayGoalIds,
            todayMinutes
          };
        });

        const progress = await Promise.all(progressPromises);
        setStudentsProgress(progress);
      } catch (error) {
        console.error('Error fetching dashboard progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [students, goals, startOfWeek, timezone]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px'
      }}>
        Loading Dashboard...
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        flexDirection: 'column',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '20px' }}>No Students Found</h1>
        <p style={{ marginBottom: '30px' }}>Add some students to see their progress on the dashboard.</p>
        <button
          onClick={onClose}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#ff5722',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Back to Main
        </button>
      </div>
    );
  }

  const currentProgress = studentsProgress[currentStudentIndex];
  if (!currentProgress) return null;

  const progressPercentage = currentProgress.totalGoals > 0 
    ? (currentProgress.completedToday / currentProgress.totalGoals) * 100 
    : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#1a1a2e',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px'
      }}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>{homeschool.name} Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '18px', opacity: 0.8 }}>
            Student {currentStudentIndex + 1} of {students.length} • Auto-cycling every {cycleSeconds}s
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#ff5722',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ✕ Exit Dashboard
          </button>
        </div>
      </div>

      {/* Student Progress */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: '#16213e',
          borderRadius: '20px',
          padding: '60px',
          textAlign: 'center',
          minWidth: '600px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          {/* Student Name */}
          <h2 style={{ 
            margin: '0 0 40px 0', 
            fontSize: '48px',
            background: 'linear-gradient(45deg, #4caf50, #2196f3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {currentProgress.student.name}
          </h2>

          {/* Progress Circle */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: `conic-gradient(#4caf50 ${progressPercentage * 3.6}deg, #333 ${progressPercentage * 3.6}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              position: 'relative'
            }}>
              <div style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                backgroundColor: '#1a1a2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                  {currentProgress.completedToday}/{currentProgress.totalGoals}
                </div>
                <div style={{ fontSize: '16px', opacity: 0.8 }}>Today</div>
              </div>
            </div>
          </div>

          {/* Today's Goals */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '24px', marginBottom: '20px' }}>Today's Goals</h3>
            <div style={{ display: 'grid', gap: '15px' }}>
              {currentProgress.todayGoals.slice(0, 5).map(goal => {
                const activity = activities.find(a => a.id === goal.activityId);
                const weeklyCount = currentProgress.weeklyProgress[goal.id] || 0;
                const hasActivityToday = currentProgress.todayCompletedGoalIds.has(goal.id);
                
                // Check actual completion for time-based goals
                let isActuallyCompleted = hasActivityToday;
                const todayMinutesForGoal = currentProgress.todayMinutes[goal.id] || 0;
                
                if (hasActivityToday && goal.minutesPerSession) {
                  // Check if today's minutes meet the goal requirement
                  isActuallyCompleted = todayMinutesForGoal >= goal.minutesPerSession;
                }
                
                // Determine status and colors based on actual completion
                let backgroundColor, borderColor, statusIcon;
                if (isActuallyCompleted && hasActivityToday) {
                  // Green: actually completed today
                  backgroundColor = '#2d5a2d';
                  borderColor = '#4caf50';
                  statusIcon = '✅';
                } else if (hasActivityToday && !isActuallyCompleted) {
                  // Yellow/Orange: has activity but not complete
                  backgroundColor = '#4a3c00';
                  borderColor = '#ffc107';
                  statusIcon = '⏳';
                } else if (goal.timesPerWeek && weeklyCount >= goal.timesPerWeek) {
                  // Gray: weekly goal met but not done today
                  backgroundColor = '#4a4a4a';
                  borderColor = '#9e9e9e';
                  statusIcon = '📅';
                } else {
                  // Default: pending
                  backgroundColor = '#2d2d2d';
                  borderColor = '#444';
                  statusIcon = '⏳';
                }
                
                return (
                  <div
                    key={goal.id}
                    style={{
                      padding: '15px 25px',
                      backgroundColor,
                      borderRadius: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: `2px solid ${borderColor}`
                    }}
                  >
                    <div style={{ fontSize: '18px' }}>
                      {activity?.name} 
                      {goal.timesPerWeek && ` (${goal.timesPerWeek}x/week)`}
                    </div>
                    <div style={{ 
                      fontSize: '24px',
                      color: 'white'
                    }}>
                      {statusIcon}
                    </div>
                  </div>
                );
              })}
            </div>
            {currentProgress.todayGoals.length > 5 && (
              <div style={{ 
                marginTop: '15px', 
                fontSize: '16px', 
                opacity: 0.7 
              }}>
                ... and {currentProgress.todayGoals.length - 5} more goals
              </div>
            )}
          </div>

          {/* Last Activity */}
          {currentProgress.student.lastActivity && (
            <div style={{ 
              fontSize: '16px', 
              opacity: 0.7 
            }}>
              Last activity: {formatLastActivity(currentProgress.student.lastActivity)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
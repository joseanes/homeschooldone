import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Goal, Activity, ActivityInstance } from '../types';
import { formatLastActivity } from '../utils/activityTracking';
import { isGoalActiveForStudent } from '../utils/goalUtils';

interface DashboardViewProps {
  homeschool: Homeschool;
  students: Person[];
  goals: Goal[];
  activities: Activity[];
  onClose: () => void;
  cycleSeconds?: number;
  startOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  timezone?: string;
  isPublic?: boolean; // Hide exit button for public dashboards
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
  timezone = 'America/New_York', // EST default
  isPublic = false
}) => {
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Note: isGoalActiveForStudent is now imported from utils/goalUtils

  // Handle ESC key (disabled for public dashboards)
  useEffect(() => {
    if (isPublic) return; // Don't allow ESC to close public dashboards
    
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
          // Get goals for this student that are active (considering start date and completion date)
          const studentGoals = goals.filter(goal => goal.studentIds?.includes(student.id) && isGoalActiveForStudent(goal, student.id));
          
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

          // Calculate weekly completion for each goal
          const completedThisWeek = studentGoals.filter(goal => {
            const weeklyCount = weeklyProgress[goal.id] || 0;
            if (goal.timesPerWeek && weeklyCount >= goal.timesPerWeek) {
              return true; // Weekly requirement met
            }
            return false;
          }).length;

          // Filter out goals that are completed for the week - only show pending
          const pendingGoals = studentGoals.filter(goal => {
            const weeklyCount = weeklyProgress[goal.id] || 0;
            if (goal.timesPerWeek && weeklyCount >= goal.timesPerWeek) {
              return false; // Don't show weekly complete goals
            }
            return true; // Show pending goals
          });

          return {
            student,
            todayGoals: pendingGoals, // Now contains only pending goals
            completedToday: completedThisWeek, // Now represents weekly completion
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
        marginBottom: '2vh'
      }}>
        <h1 style={{ margin: 0, fontSize: '2.2vw' }}>{homeschool.name} Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '1.1vw', opacity: 0.8 }}>
            Student {currentStudentIndex + 1} of {students.length} • Auto-cycling every {cycleSeconds}s
          </div>
          {!isPublic && (
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
          )}
        </div>
      </div>

      {/* Student Progress - Horizontal Layout */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'stretch',
        gap: '30px',
        height: 'calc(100vh - 140px)',
        overflow: 'hidden'
      }}>
        {/* Left Side - Student Name and Progress Circle */}
        <div style={{
          backgroundColor: '#16213e',
          borderRadius: '20px',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '280px',
          flexShrink: 0,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          {/* Student Name */}
          <h2 style={{
            margin: '0 0 2vh 0',
            fontSize: '2.8vw',
            textAlign: 'center',
            background: 'linear-gradient(45deg, #4caf50, #2196f3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {currentProgress.student.name}
          </h2>

          {/* Progress Circle */}
          <div style={{ marginBottom: '2vh' }}>
            <div style={{
              width: '14vw',
              height: '14vw',
              borderRadius: '50%',
              background: `conic-gradient(#4caf50 ${progressPercentage * 3.6}deg, #333 ${progressPercentage * 3.6}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <div style={{
                width: '11.5vw',
                height: '11.5vw',
                borderRadius: '50%',
                backgroundColor: '#1a1a2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <div style={{ fontSize: '2.8vw', fontWeight: 'bold' }}>
                  {currentProgress.completedToday}/{currentProgress.totalGoals}
                </div>
                <div style={{ fontSize: '1.2vw', opacity: 0.8 }}>This Week</div>
              </div>
            </div>
          </div>

          {/* Progress Percentage */}
          <div style={{
            fontSize: '1.5vw',
            opacity: 0.9,
            textAlign: 'center',
            marginBottom: '1.5vh'
          }}>
            {Math.round(progressPercentage)}% Complete
          </div>

          {/* Last Activity */}
          {currentProgress.student.lastActivity && (
            <div style={{
              fontSize: '1vw',
              opacity: 0.7,
              textAlign: 'center'
            }}>
              Last activity: {formatLastActivity(currentProgress.student.lastActivity)}
            </div>
          )}
        </div>

        {/* Right Side - Today's Goals */}
        <div style={{
          backgroundColor: '#16213e',
          borderRadius: '20px',
          padding: '24px',
          flex: 1,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0
        }}>
          <h3 style={{
            fontSize: '2vw',
            marginBottom: '1.2vh',
            textAlign: 'center',
            background: 'linear-gradient(45deg, #4caf50, #2196f3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            flexShrink: 0
          }}>
            Tasks and Goals
          </h3>

          <div style={{
            display: 'grid',
            gap: '0.8vw',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridAutoRows: '1fr',
            flex: 1,
            overflow: 'hidden'
          }}>
            {/* Sort goals: gray (pending) first, then yellow (progress week), then blue (done today), then green (weekly complete) */}
            {[...currentProgress.todayGoals].sort((a, b) => {
              const activityA = activities.find(act => act.id === a.activityId);
              const activityB = activities.find(act => act.id === b.activityId);
              
              // Get status for each goal
              const weeklyCountA = currentProgress.weeklyProgress[a.id] || 0;
              const weeklyCountB = currentProgress.weeklyProgress[b.id] || 0;
              const hasActivityTodayA = currentProgress.todayCompletedGoalIds.has(a.id);
              const hasActivityTodayB = currentProgress.todayCompletedGoalIds.has(b.id);
              const weeklyCompleteA = !!(a.timesPerWeek && weeklyCountA >= a.timesPerWeek);
              const weeklyCompleteB = !!(b.timesPerWeek && weeklyCountB >= b.timesPerWeek);
              
              // Determine status priority
              const getStatusPriority = (goal: Goal, weeklyCount: number, hasToday: boolean, weeklyComplete: boolean) => {
                if (weeklyComplete) return 4; // Green - show last
                if (hasToday) return 3; // Blue - show third
                if (weeklyCount > 0) return 2; // Yellow - show second
                return 1; // Gray - show first
              };
              
              const priorityA = getStatusPriority(a, weeklyCountA, hasActivityTodayA, weeklyCompleteA);
              const priorityB = getStatusPriority(b, weeklyCountB, hasActivityTodayB, weeklyCompleteB);
              
              // Sort by status priority first
              if (priorityA !== priorityB) {
                return priorityA - priorityB;
              }
              
              // Within same status, sort alphabetically by goal name (or activity name if no goal name)
              const nameA = a.name || activityA?.name || '';
              const nameB = b.name || activityB?.name || '';
              return nameA.localeCompare(nameB);
            }).map(goal => {
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
              
              // Dark-themed status colors
              let cardBg, cardBorder, statusIcon, statusText, cardTextColor;

              const weeklyComplete = goal.timesPerWeek && weeklyCount >= goal.timesPerWeek;

              if (weeklyComplete) {
                cardBg = 'rgba(76, 175, 80, 0.15)';
                cardBorder = 'rgba(76, 175, 80, 0.4)';
                cardTextColor = '#a5d6a7';
                statusIcon = '✓';
                statusText = 'Complete';
              } else if (hasActivityToday) {
                cardBg = 'rgba(33, 150, 243, 0.15)';
                cardBorder = 'rgba(33, 150, 243, 0.4)';
                cardTextColor = '#90caf9';
                statusIcon = '✔';
                statusText = 'Today';
              } else if (weeklyCount > 0) {
                cardBg = 'rgba(255, 193, 7, 0.12)';
                cardBorder = 'rgba(255, 193, 7, 0.35)';
                cardTextColor = '#ffe082';
                statusIcon = '◐';
                statusText = 'Progress';
              } else {
                cardBg = 'rgba(255, 255, 255, 0.06)';
                cardBorder = 'rgba(255, 255, 255, 0.12)';
                cardTextColor = 'rgba(255, 255, 255, 0.6)';
                statusIcon = '○';
                statusText = 'Pending';
              }

              return (
                <div
                  key={goal.id}
                  style={{
                    padding: '1.4vh 0.8vw',
                    backgroundColor: cardBg,
                    borderRadius: '0.6vw',
                    border: `1px solid ${cardBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6vw',
                    color: cardTextColor,
                    minWidth: 0
                  }}
                >
                  <div style={{
                    fontSize: '2vw',
                    flexShrink: 0,
                    width: '2.4vw',
                    textAlign: 'center'
                  }}>
                    {statusIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '1.4vw',
                      fontWeight: '600',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {goal.name || activity?.name}
                    </div>
                    <div style={{ fontSize: '1.1vw', opacity: 0.7 }}>
                      {goal.timesPerWeek && `${weeklyCount}/${goal.timesPerWeek} wk`}
                      {goal.minutesPerSession && `${goal.timesPerWeek ? ' · ' : ''}${goal.minutesPerSession} min`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {currentProgress.todayGoals.length === 0 && (
            <div style={{ 
              textAlign: 'center',
              fontSize: '24px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px'
            }}>
              <div style={{ fontSize: '80px' }}>🏆</div>
              <div style={{ color: '#4caf50', fontWeight: 'bold' }}>
                All done for the week!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
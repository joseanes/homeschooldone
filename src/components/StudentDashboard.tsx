import React, { useState, useEffect } from 'react';
import { Person, Goal, Activity, ActivityInstance, Homeschool } from '../types';
import ActivityInstanceForm from './ActivityInstanceForm';
import { formatLastActivity } from '../utils/activityTracking';
import { 
  calculateGoalProgress, 
  filterActiveGoalsForStudent, 
  GoalProgress
} from '../utils/goalUtils';
import { 
  getTodayStart, 
  getTomorrowStart, 
  getTodayEnd, 
  getWeekStart, 
  getWeekEnd 
} from '../utils/dateUtils';
import { fetchCompleteStudentData } from '../utils/activityUtils';

interface StudentDashboardProps {
  student: Person;
  homeschool: Homeschool;
  onSignOut: () => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ 
  student, 
  homeschool, 
  onSignOut 
}) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [todayInstances, setTodayInstances] = useState<ActivityInstance[]>([]);
  const [weekInstances, setWeekInstances] = useState<ActivityInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [editingInstance, setEditingInstance] = useState<ActivityInstance | null>(null);

  // Get dashboard settings for week calculation and timezone
  const startOfWeek = homeschool.dashboardSettings?.startOfWeek !== undefined ? homeschool.dashboardSettings.startOfWeek : 1;
  const timezone = homeschool.dashboardSettings?.timezone || 'America/New_York';

  // Fetch student's data
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        console.log('StudentDashboard: Fetching data for student:', student.id, student.name);
        console.log('StudentDashboard: Homeschool ID:', homeschool.id);
        
        // Calculate date ranges using shared utilities
        const todayStart = getTodayStart();
        const tomorrowStart = getTomorrowStart();
        const weekStart = getWeekStart(startOfWeek);
        const weekEnd = getWeekEnd(startOfWeek);
        
        // Use shared utility to fetch all student data
        const data = await fetchCompleteStudentData(
          student.id,
          homeschool.id,
          todayStart,
          tomorrowStart,
          weekStart,
          weekEnd
        );
        
        // Filter for active goals only
        const activeGoals = filterActiveGoalsForStudent(data.goals, student.id);
        
        console.log('StudentDashboard: Student has', activeGoals.length, 'active assigned goals');
        setGoals(activeGoals);
        setActivities(data.activities);
        setTodayInstances(data.todayInstances);
        setWeekInstances(data.weekInstances);

      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [student.id, homeschool.id, startOfWeek]);

  // Helper functions using shared utilities
  const getProgressForGoal = (goalId: string): GoalProgress => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) {
      return {
        todayCount: 0,
        weekCount: 0,
        todayMinutes: 0,
        weekMinutes: 0,
        todayInstance: null,
        target: 0,
        total: 0
      };
    }

    const todayStart = getTodayStart();
    const todayEnd = getTodayEnd();
    const weekStart = getWeekStart(startOfWeek);
    const weekEnd = getWeekEnd(startOfWeek);

    return calculateGoalProgress(
      goalId,
      goal,
      [...todayInstances, ...weekInstances], // All instances for calculation
      todayStart,
      todayEnd,
      weekStart,
      weekEnd
    );
  };

  const getStatusForGoal = (goal: Goal) => {
    const progress = getProgressForGoal(goal.id);
    
    // Count instances this week for this goal and student
    const weeklyCount = weekInstances.filter(i => 
      i.goalId === goal.id && 
      i.studentId === student.id
    ).length;
    
    // Count instances today
    const todayCount = todayInstances.filter(i => 
      i.goalId === goal.id && 
      i.studentId === student.id
    ).length;
    
    // Check if weekly requirement is met
    const weeklyComplete = goal.timesPerWeek && weeklyCount >= goal.timesPerWeek;
    
    // If weekly requirement is met, show as completed (green)
    if (weeklyComplete) {
      return { 
        status: 'weekly-complete', 
        color: '#4caf50', // Green
        backgroundColor: '#e8f5e9', // Light green background
        textColor: '#2e7d32',
        text: 'Weekly Complete ✓'
      };
    }
    
    // Check if there's progress TODAY
    if (todayCount > 0) {
      // Has progress today but weekly not complete - show as done today (blue)
      return { 
        status: 'done-today', 
        color: '#2196f3', // Blue
        backgroundColor: '#e3f2fd', // Light blue background
        textColor: '#1565c0',
        text: 'Done Today'
      };
    }
    
    // Check if there's progress THIS WEEK (but not today)
    if (weeklyCount > 0) {
      // Has progress this week but not today - show as progress this week (yellow)
      return { 
        status: 'progress-week', 
        color: '#ffc107', // Yellow/Amber
        backgroundColor: '#fff8e1', // Light yellow background
        textColor: '#f57c00',
        text: 'Progress This Week'
      };
    }
    
    // Default: not done this week (gray)
    return { 
      status: 'pending', 
      color: '#9e9e9e', // Gray
      backgroundColor: '#f5f5f5', // Light gray background
      textColor: '#616161',
      text: 'Pending'
    };
  };

  const getLatestProgress = (goalId: string) => {
    // Get all instances for this goal from weekInstances (includes today)
    const allInstances = [...todayInstances, ...weekInstances]
      .filter(i => i.goalId === goalId && i.studentId === student.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (allInstances.length === 0) return null;
    
    const latest = allInstances[0];
    return {
      percentageCompleted: latest.percentageCompleted || latest.endingPercentage,
      countCompleted: latest.countCompleted
    };
  };

  const handleRecordActivity = (goal: Goal) => {
    const activity = activities.find(a => a.id === goal.activityId);
    if (activity) {
      const progress = getProgressForGoal(goal.id);
      if (progress.todayInstance) {
        // Edit existing instance
        setEditingInstance(progress.todayInstance);
      } else {
        // Create new instance
        setEditingInstance(null);
      }
      setSelectedGoal(goal);
      setSelectedActivity(activity);
      setShowActivityForm(true);
    }
  };

  const handleActivityFormClose = () => {
    setShowActivityForm(false);
    setSelectedGoal(null);
    setSelectedActivity(null);
    setEditingInstance(null);
    // Refresh data
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading your activities...
      </div>
    );
  }

  const completedToday = goals.filter(goal => {
    const status = getStatusForGoal(goal);
    return status.status === 'done-today' || status.status === 'weekly-complete';
  }).length;

  // Calculate weekly progress based on weekly goals completion
  const weeklyProgress = goals.reduce((totals, goal) => {
    const progress = getProgressForGoal(goal.id);
    if (goal.timesPerWeek) {
      totals.completed += Math.min(progress.weekCount, goal.timesPerWeek);
      totals.target += goal.timesPerWeek;
    } else {
      // For goals without weekly targets, count daily completion for this week
      totals.completed += progress.weekCount > 0 ? 1 : 0;
      totals.target += 1;
    }
    return totals;
  }, { completed: 0, target: 0 });

  const weeklyProgressPercentage = weeklyProgress.target > 0 ? (weeklyProgress.completed / weeklyProgress.target) * 100 : 0;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* CSS Animations */}
      <style>
        {`
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-10px);
            }
            60% {
              transform: translateY(-5px);
            }
          }
          
          @keyframes pulse {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
            100% {
              transform: scale(1);
            }
          }
          
          @keyframes shimmer {
            0% {
              background-position: -200px 0;
            }
            100% {
              background-position: calc(200px + 100%) 0;
            }
          }
        `}
      </style>
      {/* Header with integrated progress */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        padding: '25px 30px',
        background: weeklyProgressPercentage === 100
          ? 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '15px',
        color: 'white',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
          <h1 style={{
            margin: 0,
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            fontSize: '32px'
          }}>
            {weeklyProgressPercentage === 100 ? '🎉' : '🌟'} Welcome, {student.name}!
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'rgba(255,255,255,0.85)', fontSize: '16px' }}>
            {homeschool.name} • {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Weekly donut */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: weeklyProgressPercentage === 100
                ? 'conic-gradient(#ffd700 360deg, #ffd700 360deg)'
                : weeklyProgressPercentage > 50
                ? `conic-gradient(rgba(255,255,255,0.9) ${weeklyProgressPercentage * 3.6}deg, rgba(255,255,255,0.2) ${weeklyProgressPercentage * 3.6}deg)`
                : `conic-gradient(rgba(255,255,255,0.9) ${weeklyProgressPercentage * 3.6}deg, rgba(255,255,255,0.2) ${weeklyProgressPercentage * 3.6}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '62px',
                height: '62px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', lineHeight: 1 }}>
                  {Math.round(weeklyProgressPercentage)}%
                </span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', lineHeight: 1, marginTop: '2px' }}>week</span>
              </div>
            </div>
          </div>
          {/* Stats */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
              {weeklyProgress.completed}/{weeklyProgress.target} sessions
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
              {completedToday}/{goals.length} today
            </div>
          </div>
        </div>
      </div>

      {/* Today's Goals */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '15px',
        padding: '30px',
        marginBottom: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        background: 'linear-gradient(135deg, #fff 0%, #f8fffe 100%)'
      }}>
        <h2 style={{ 
          marginTop: 0, 
          marginBottom: '25px', 
          color: '#2c3e50',
          fontSize: '32px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          🎯 Today's Activities
        </h2>
        
        {goals.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            fontSize: '16px'
          }}>
            No activities assigned to you yet. Check with your teacher or parent.
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gap: '15px',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
          }}>
            {/* Sort goals: gray (pending) first, then yellow (progress week), then blue (done today), then green (weekly complete) */}
            {[...goals].sort((a, b) => {
              const statusA = getStatusForGoal(a);
              const statusB = getStatusForGoal(b);
              const activityA = activities.find(act => act.id === a.activityId);
              const activityB = activities.find(act => act.id === b.activityId);
              
              // Define status priority (lower number = higher priority)
              const statusPriority: { [key: string]: number } = {
                'pending': 1,           // Gray - show first
                'progress-week': 2,     // Yellow - show second
                'done-today': 3,        // Blue - show third
                'weekly-complete': 4    // Green - show last
              };
              
              const priorityA = statusPriority[statusA.status] || 999;
              const priorityB = statusPriority[statusB.status] || 999;
              
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
              const status = getStatusForGoal(goal);
              
              // Enhanced color scheme based on status - matching main Dashboard
              const getCardColors = () => {
                switch (status.status) {
                  case 'weekly-complete':
                    return {
                      border: `2px solid ${status.color}`,
                      background: status.backgroundColor,
                      shadow: '0 4px 15px rgba(76, 175, 80, 0.2)',
                      emoji: '✅',
                      titleColor: status.textColor
                    };
                  case 'done-today':
                    return {
                      border: `2px solid ${status.color}`,
                      background: status.backgroundColor,
                      shadow: '0 4px 15px rgba(33, 150, 243, 0.2)',
                      emoji: '✔️',
                      titleColor: status.textColor
                    };
                  case 'progress-week':
                    return {
                      border: `2px solid ${status.color}`,
                      background: status.backgroundColor,
                      shadow: '0 4px 15px rgba(255, 193, 7, 0.2)',
                      emoji: '📝',
                      titleColor: status.textColor
                    };
                  default: // pending
                    return {
                      border: `2px solid ${status.color}`,
                      background: status.backgroundColor,
                      shadow: '0 4px 15px rgba(158, 158, 158, 0.1)',
                      emoji: '⏳',
                      titleColor: status.textColor
                    };
                }
              };

              const cardColors = getCardColors();
              
              return (
                <div
                  key={goal.id}
                  style={{
                    border: cardColors.border,
                    borderRadius: '15px',
                    padding: '25px',
                    background: cardColors.background,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: cardColors.shadow,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => handleRecordActivity(goal)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                    e.currentTarget.style.boxShadow = `0 15px 40px ${cardColors.shadow.match(/rgba\([^)]+\)/)?.[0] || 'rgba(0,0,0,0.3)'}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = cardColors.shadow;
                  }}
                >
                  {/* Decorative corner element */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    fontSize: '40px',
                    opacity: 0.1,
                    transform: 'rotate(15deg)',
                    marginTop: '10px',
                    marginRight: '10px'
                  }}>
                    {cardColors.emoji}
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '15px'
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '22px',
                      color: cardColors.titleColor,
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {cardColors.emoji} {goal.name || activity?.name || 'Unknown Activity'}
                    </h3>
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '25px',
                      backgroundColor: status.color,
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}>
                      {status.text}
                    </div>
                  </div>
                  
                  <p style={{ 
                    margin: '0 0 20px 0', 
                    color: '#4b5563',
                    fontSize: '16px',
                    lineHeight: '1.5'
                  }}>
                    {activity?.description || 'No description available'}
                  </p>
                  
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '14px',
                    color: '#6b7280',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginTop: '10px'
                  }}>
                    <div style={{ fontWeight: '500' }}>
                      {goal.timesPerWeek && `📊 ${getProgressForGoal(goal.id).weekCount} of ${goal.timesPerWeek}/week`}
                      {goal.minutesPerSession && ` • ⏱️ ${goal.minutesPerSession} min`}
                      {(() => {
                        const latestProgress = getLatestProgress(goal.id);
                        const indicators = [];
                        
                        // Show percentage progress if activity tracks it and goal has percentage goal or daily increase
                        if (activity?.progressReportingStyle?.percentageCompletion && (goal.percentageGoal || goal.dailyPercentageIncrease) && latestProgress?.percentageCompleted !== undefined) {
                          indicators.push(` • 📈 ${latestProgress.percentageCompleted.toFixed(0)}% of ${goal.percentageGoal || 100}%`);
                        }
                        
                        // Show custom metric progress if activity tracks it and goal has target
                        if (activity?.progressReportingStyle?.progressCount && goal.progressCount && latestProgress?.countCompleted !== undefined) {
                          indicators.push(` • 📚 ${latestProgress.countCompleted} of ${goal.progressCount} ${activity.progressCountName || 'items'}`);
                        }
                        
                        return indicators.join('');
                      })()}
                    </div>
                    <div style={{ 
                      color: '#4f46e5', 
                      fontWeight: '600',
                      fontSize: '13px'
                    }}>
                      {getProgressForGoal(goal.id).todayInstance ? '✏️ Edit' : '➕ Record'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Last Activity & Encouragement */}
      <div style={{
        textAlign: 'center',
        marginTop: '30px',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '15px',
        color: 'white'
      }}>
        {student.lastActivity && (
          <p style={{
            margin: '0 0 10px 0',
            fontSize: '16px',
            opacity: 0.9
          }}>
            📅 Last activity: {formatLastActivity(student.lastActivity)}
          </p>
        )}
        
        <p style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '600',
          textShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }}>
          {weeklyProgressPercentage === 100
            ? "🎉 You've absolutely crushed this week! Outstanding work!" 
            : weeklyProgressPercentage > 75 
            ? "🔥 You're so close to finishing your weekly goals! Amazing progress!"
            : weeklyProgressPercentage > 50
            ? "💪 You're doing fantastic this week! More than halfway there!"
            : weeklyProgressPercentage > 25
            ? "🌟 Great weekly progress! You've got excellent momentum!"
            : "🚀 Ready to make this week amazing? Let's tackle those goals!"
          }
        </p>
      </div>

      {/* Activity Form Modal */}
      {showActivityForm && selectedGoal && selectedActivity && (
        <ActivityInstanceForm
          goals={[selectedGoal]}
          activities={[selectedActivity]}
          students={[student]} // Only show current student
          userId={student.id}
          preSelectedGoal={selectedGoal.id}
          preSelectedStudent={student.id}
          existingInstance={editingInstance || undefined}
          timezone={timezone}
          allowMultipleRecordsPerDay={homeschool.allowMultipleRecordsPerDay || false}
          onClose={handleActivityFormClose}
          onActivityRecorded={handleActivityFormClose}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
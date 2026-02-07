import React, { useState, useEffect } from 'react';
import { Person, Goal, Activity, ActivityInstance, Homeschool } from '../types';
import ActivityInstanceForm from './ActivityInstanceForm';
import { formatLastActivity } from '../utils/activityTracking';
import { 
  calculateGoalProgress, 
  getGoalStatus, 
  filterActiveGoalsForStudent, 
  sortGoalsForDisplay,
  GoalProgress,
  GoalStatus 
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

  // Get dashboard settings for week calculation
  const startOfWeek = homeschool.dashboardSettings?.startOfWeek !== undefined ? homeschool.dashboardSettings.startOfWeek : 1;

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

  const getStatusForGoal = (goal: Goal): GoalStatus => {
    const progress = getProgressForGoal(goal.id);
    return getGoalStatus(goal, progress);
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
    return status.status === 'complete';
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
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '25px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '15px',
        color: 'white',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            fontSize: '36px'
          }}>
            🌟 Welcome, {student.name}! 
            {completedToday === goals.length && goals.length > 0 && ' 🎉'}
          </h1>
          <p style={{ margin: '8px 0', color: 'rgba(255,255,255,0.9)', fontSize: '18px' }}>
            {homeschool.name} • {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
          <div style={{ 
            textAlign: 'center', 
            padding: '15px 20px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ 
              fontSize: '28px', 
              fontWeight: 'bold', 
              color: completedToday === goals.length && goals.length > 0 ? '#ffd700' : 'white'
            }}>
              {completedToday}/{goals.length}
            </div>
            <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.9)' }}>
              Goals Complete
            </div>
          </div>
          <button
            onClick={onSignOut}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Progress Overview */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '15px',
        padding: '30px',
        marginBottom: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
        background: weeklyProgressPercentage === 100 
          ? 'linear-gradient(135deg, #a8e6cf 0%, #88d8a3 100%)'
          : 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)'
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: weeklyProgressPercentage === 100 
              ? 'conic-gradient(#ffd700 360deg, #ffd700 360deg)' 
              : weeklyProgressPercentage > 50
              ? `conic-gradient(#4facfe ${weeklyProgressPercentage * 3.6}deg, #e8f4f8 ${weeklyProgressPercentage * 3.6}deg)`
              : `conic-gradient(#ff6b6b ${weeklyProgressPercentage * 3.6}deg, #ffe0e6 ${weeklyProgressPercentage * 3.6}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
          }}>
            <div style={{
              width: '95px',
              height: '95px',
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 'bold',
              color: weeklyProgressPercentage === 100 ? '#ffa500' : weeklyProgressPercentage > 50 ? '#4facfe' : '#ff6b6b'
            }}>
              {Math.round(weeklyProgressPercentage)}%
            </div>
            {weeklyProgressPercentage === 100 && (
              <div style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                fontSize: '24px',
                animation: 'bounce 1s infinite'
              }}>
                ⭐
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 15px 0', 
            color: weeklyProgressPercentage === 100 ? '#2d5016' : '#2c3e50',
            fontSize: '28px',
            fontWeight: '600'
          }}>
            {weeklyProgressPercentage === 100 
              ? "🎊 Weekly Goals Crushed!" 
              : "📊 Weekly Progress"
            }
          </h3>
          <p style={{ 
            margin: 0, 
            color: weeklyProgressPercentage === 100 ? '#2d5016' : '#666',
            fontSize: '18px',
            lineHeight: '1.5'
          }}>
            {weeklyProgressPercentage === 100 
              ? `Incredible! You've completed all your weekly goals! You're absolutely crushing it! 🔥`
              : `You've completed ${weeklyProgress.completed} out of ${weeklyProgress.target} weekly activity sessions.${weeklyProgressPercentage > 50 ? ' You\'re doing fantastic this week! 💪' : ' Keep going, you\'ve got this! 🌟'}`
            }
          </p>
          <div style={{
            marginTop: '15px',
            padding: '12px 16px',
            backgroundColor: 'rgba(79, 172, 254, 0.08)',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '16px', color: '#4facfe', fontWeight: '500' }}>
              📅 Today: {completedToday}/{goals.length} goals completed
            </span>
            {weeklyProgressPercentage < 100 && (
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                💡 {weeklyProgress.target - weeklyProgress.completed} more sessions to reach weekly targets
              </span>
            )}
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
            {/* Sort goals using shared utility */}
            {sortGoalsForDisplay(goals, activities, getStatusForGoal).map(goal => {
              const activity = activities.find(a => a.id === goal.activityId);
              const status = getStatusForGoal(goal);
              
              // Enhanced color scheme based on status
              const getCardColors = () => {
                switch (status.status) {
                  case 'complete':
                    return {
                      border: '3px solid #10b981',
                      background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                      shadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                      emoji: '✅',
                      titleColor: '#065f46'
                    };
                  case 'partial':
                    return {
                      border: '3px solid #f59e0b',
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      shadow: '0 8px 25px rgba(245, 158, 11, 0.3)',
                      emoji: '⚡',
                      titleColor: '#92400e'
                    };
                  case 'week_complete':
                    return {
                      border: '3px solid #8b5cf6',
                      background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                      shadow: '0 8px 25px rgba(139, 92, 246, 0.3)',
                      emoji: '🎖️',
                      titleColor: '#5b21b6'
                    };
                  default:
                    return {
                      border: '3px solid #6366f1',
                      background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                      shadow: '0 8px 25px rgba(99, 102, 241, 0.2)',
                      emoji: '🚀',
                      titleColor: '#3730a3'
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
                      {cardColors.emoji} {activity?.name || 'Unknown Activity'}
                    </h3>
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '25px',
                      backgroundColor: status.status === 'complete' ? '#10b981' : 
                                     status.status === 'partial' ? '#f59e0b' : 
                                     status.status === 'week_complete' ? '#8b5cf6' : '#6366f1',
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
          timezone="America/New_York" // Default timezone
          allowMultipleRecordsPerDay={homeschool.allowMultipleRecordsPerDay || false}
          onClose={handleActivityFormClose}
          onActivityRecorded={handleActivityFormClose}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
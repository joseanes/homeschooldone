import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Person, Goal, Activity, ActivityInstance, Homeschool } from '../types';
import ActivityInstanceForm from './ActivityInstanceForm';
import { formatLastActivity } from '../utils/activityTracking';

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

  // Get date helpers
  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const getWeekStart = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + 1; // Monday
    const weekStart = new Date(today.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const getWeekEnd = () => {
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  };

  // Fetch student's data
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        console.log('StudentDashboard: Fetching data for student:', student.id, student.name);
        console.log('StudentDashboard: Homeschool ID:', homeschool.id);
        
        // Get all goals for this student
        const goalsQuery = query(
          collection(db, 'goals'), 
          where('homeschoolId', '==', homeschool.id)
        );
        const goalsSnapshot = await getDocs(goalsQuery);
        const allGoals = goalsSnapshot.docs.map(doc => ({ 
          ...doc.data(), 
          id: doc.id 
        }) as Goal);
        
        console.log('StudentDashboard: Found', allGoals.length, 'total goals in homeschool');
        console.log('StudentDashboard: All goals:', allGoals);
        
        // Filter goals assigned to this student
        const studentGoals = allGoals.filter(goal => {
          const isAssigned = goal.studentIds?.includes(student.id);
          console.log(`Goal ${goal.id} (${goal.activityId}) assigned to student? ${isAssigned}. StudentIds:`, goal.studentIds);
          return isAssigned;
        });
        
        console.log('StudentDashboard: Student has', studentGoals.length, 'assigned goals');
        setGoals(studentGoals);

        // Get activities for these goals
        const activityIds = Array.from(new Set(studentGoals.map(g => g.activityId)));
        if (activityIds.length > 0) {
          const activitiesQuery = query(
            collection(db, 'activities'),
            where('homeschoolId', '==', homeschool.id)
          );
          const activitiesSnapshot = await getDocs(activitiesQuery);
          const allActivities = activitiesSnapshot.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id 
          }) as Activity);
          
          const studentActivities = allActivities.filter(activity =>
            activityIds.includes(activity.id)
          );
          setActivities(studentActivities);
        }

        // Get today's activity instances
        const today = getToday();
        const tomorrow = getTomorrow();
        const todayQuery = query(
          collection(db, 'activityInstances'),
          where('studentId', '==', student.id),
          where('date', '>=', today),
          where('date', '<', tomorrow)
        );
        const todaySnapshot = await getDocs(todayQuery);
        const todayData = todaySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }) as ActivityInstance);
        setTodayInstances(todayData);

        // Get this week's activity instances
        const weekStart = getWeekStart();
        const weekEnd = getWeekEnd();
        const weekQuery = query(
          collection(db, 'activityInstances'),
          where('studentId', '==', student.id),
          where('date', '>=', weekStart),
          where('date', '<=', weekEnd)
        );
        const weekSnapshot = await getDocs(weekQuery);
        const weekData = weekSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }) as ActivityInstance);
        setWeekInstances(weekData);

      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [student.id, homeschool.id]);

  // Get goal progress
  const getGoalProgress = (goalId: string) => {
    const todayInstancesForGoal = todayInstances.filter(i => i.goalId === goalId);
    const weekInstancesForGoal = weekInstances.filter(i => i.goalId === goalId);
    
    return {
      todayCount: todayInstancesForGoal.length,
      weekCount: weekInstancesForGoal.length,
      todayMinutes: todayInstancesForGoal.reduce((sum, inst) => sum + (inst.duration || 0), 0),
      todayInstance: todayInstancesForGoal.length > 0 ? todayInstancesForGoal[0] : null
    };
  };

  // Get goal status
  const getGoalStatus = (goal: Goal) => {
    const progress = getGoalProgress(goal.id);
    
    if (goal.minutesPerSession) {
      if (progress.todayMinutes >= goal.minutesPerSession) {
        return { status: 'complete', color: '#4caf50', text: 'Complete' };
      } else if (progress.todayMinutes > 0) {
        return { 
          status: 'partial', 
          color: '#ffc107', 
          text: `${progress.todayMinutes}/${goal.minutesPerSession}min` 
        };
      }
    } else {
      if (progress.todayCount > 0) {
        return { status: 'complete', color: '#4caf50', text: 'Complete' };
      }
    }

    // Check if weekly goal is met
    if (goal.timesPerWeek && progress.weekCount >= goal.timesPerWeek) {
      return { status: 'week_complete', color: '#9e9e9e', text: 'Week Complete' };
    }

    return { status: 'pending', color: '#666', text: 'Not Started' };
  };

  const handleRecordActivity = (goal: Goal) => {
    const activity = activities.find(a => a.id === goal.activityId);
    if (activity) {
      const progress = getGoalProgress(goal.id);
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
    const status = getGoalStatus(goal);
    return status.status === 'complete';
  }).length;

  const progressPercentage = goals.length > 0 ? (completedToday / goals.length) * 100 : 0;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>Welcome, {student.name}!</h1>
          <p style={{ margin: '5px 0', color: '#666', fontSize: '16px' }}>
            {homeschool.name} • {new Date().toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>
              {completedToday}/{goals.length}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Goals Complete
            </div>
          </div>
          <button
            onClick={onSignOut}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Progress Overview */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '10px',
        padding: '25px',
        marginBottom: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '30px'
      }}>
        <div>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: `conic-gradient(#4caf50 ${progressPercentage * 3.6}deg, #e0e0e0 ${progressPercentage * 3.6}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              {Math.round(progressPercentage)}%
            </div>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Today's Progress</h3>
          <p style={{ margin: 0, color: '#666' }}>
            You have completed {completedToday} out of {goals.length} assigned goals today.
            {completedToday === goals.length && goals.length > 0 && ' 🎉 Great job!'}
          </p>
        </div>
      </div>

      {/* Today's Goals */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '10px',
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>
          Today's Activities
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
            {/* Sort goals: completed at bottom, rest alphabetically */}
            {[...goals].sort((a, b) => {
              const activityA = activities.find(act => act.id === a.activityId);
              const activityB = activities.find(act => act.id === b.activityId);
              const statusA = getGoalStatus(a);
              const statusB = getGoalStatus(b);
              
              // Completed tasks go to bottom
              const isCompletedA = statusA.status === 'complete';
              const isCompletedB = statusB.status === 'complete';
              
              if (isCompletedA && !isCompletedB) return 1;
              if (!isCompletedA && isCompletedB) return -1;
              
              // For non-completed or both completed, sort alphabetically by activity name
              return (activityA?.name || '').localeCompare(activityB?.name || '');
            }).map(goal => {
              const activity = activities.find(a => a.id === goal.activityId);
              const status = getGoalStatus(goal);
              
              return (
                <div
                  key={goal.id}
                  style={{
                    border: `2px solid ${status.color}`,
                    borderRadius: '10px',
                    padding: '20px',
                    backgroundColor: status.status === 'complete' ? '#f8fff8' : '#fff',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                  onClick={() => handleRecordActivity(goal)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '10px'
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '18px',
                      color: '#2c3e50' 
                    }}>
                      {activity?.name || 'Unknown Activity'}
                    </h3>
                    <div style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      backgroundColor: status.color,
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {status.text}
                    </div>
                  </div>
                  
                  <p style={{ 
                    margin: '0 0 15px 0', 
                    color: '#666',
                    fontSize: '14px' 
                  }}>
                    {activity?.description || 'No description available'}
                  </p>
                  
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#999'
                  }}>
                    <div>
                      {goal.timesPerWeek && `${goal.timesPerWeek}x per week`}
                      {goal.minutesPerSession && ` • ${goal.minutesPerSession} minutes`}
                    </div>
                    <div>
                      Click to {getGoalProgress(goal.id).todayInstance ? 'edit' : 'record'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Last Activity */}
      {student.lastActivity && (
        <div style={{
          textAlign: 'center',
          color: '#999',
          fontSize: '14px',
          marginTop: '20px'
        }}>
          Last activity: {formatLastActivity(student.lastActivity)}
        </div>
      )}

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
          onClose={handleActivityFormClose}
          onActivityRecorded={handleActivityFormClose}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
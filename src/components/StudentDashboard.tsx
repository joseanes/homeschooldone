import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Person, Goal, Activity, ActivityInstance, Homeschool, AdHocTask } from '../types';
import ActivityInstanceForm from './ActivityInstanceForm';
import AdHocTaskForm from './AdHocTaskForm';
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
  const [showAdHocTaskForm, setShowAdHocTaskForm] = useState(false);
  const [adHocTasks, setAdHocTasks] = useState<AdHocTask[]>([]);
  const [editingTask, setEditingTask] = useState<AdHocTask | null>(null);

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

        // Fetch ad-hoc tasks for this homeschool
        const tasksQuery = query(collection(db, 'adHocTasks'), where('homeschoolId', '==', homeschool.id));
        const tasksSnapshot = await getDocs(tasksQuery);
        const tasksList = tasksSnapshot.docs.map(d => ({
          ...d.data(),
          id: d.id
        } as AdHocTask));
        setAdHocTasks(tasksList);

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
    
    if (weeklyComplete) {
      return {
        status: 'weekly-complete',
        color: 'var(--hs-goal-complete-border)',
        backgroundColor: 'var(--hs-goal-complete-bg)',
        textColor: 'var(--hs-goal-complete-text)',
        badgeBg: 'var(--hs-goal-complete-badge)',
        icon: '✓',
        text: 'Week complete'
      };
    }

    if (todayCount > 0) {
      return {
        status: 'done-today',
        color: 'var(--hs-goal-today-border)',
        backgroundColor: 'var(--hs-goal-today-bg)',
        textColor: 'var(--hs-goal-today-text)',
        badgeBg: 'var(--hs-goal-today-badge)',
        icon: '✔',
        text: 'Done today'
      };
    }

    if (weeklyCount > 0) {
      return {
        status: 'progress-week',
        color: 'var(--hs-goal-progress-border)',
        backgroundColor: 'var(--hs-goal-progress-bg)',
        textColor: 'var(--hs-goal-progress-text)',
        badgeBg: 'var(--hs-goal-progress-badge)',
        icon: '◐',
        text: 'In progress'
      };
    }

    return {
      status: 'pending',
      color: 'var(--hs-goal-pending-border)',
      backgroundColor: 'var(--hs-goal-pending-bg)',
      textColor: 'var(--hs-goal-pending-text)',
      badgeBg: 'var(--hs-goal-pending-badge)',
      icon: '○',
      text: 'Not started'
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

  // Weekly totals use the week list directly. Today's instances are already
  // included there, so they are not added a second time.
  const weeklyProgress = goals.reduce((totals, goal) => {
    const weekCount = weekInstances.filter(instance => instance.goalId === goal.id && instance.studentId === student.id).length;
    if (goal.timesPerWeek) {
      totals.completed += Math.min(weekCount, goal.timesPerWeek);
      totals.target += goal.timesPerWeek;
    } else {
      totals.completed += weekCount > 0 ? 1 : 0;
      totals.target += 1;
    }
    return totals;
  }, { completed: 0, target: 0 });

  const weeklyProgressPercentage = weeklyProgress.target > 0 ? (weeklyProgress.completed / weeklyProgress.target) * 100 : 0;

  const weekFill = weeklyProgressPercentage === 100
    ? 'var(--hs-goal-complete-border)'
    : 'var(--hs-goal-today-border)';

  return (
    <div className="hs-page">
      <header className="hs-welcome">
        <div>
          <h1 className="hs-title">Welcome, {student.name}</h1>
          <p className="hs-subtitle">
            {homeschool.name} · {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="hs-week">
          <div className="hs-week-label">
            {weeklyProgress.completed}/{weeklyProgress.target} sessions this week
          </div>
          <div
            className="hs-progress"
            role="progressbar"
            aria-valuenow={Math.round(weeklyProgressPercentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Weekly session progress"
          >
            <div
              className="hs-progress-fill"
              style={{ width: `${Math.min(weeklyProgressPercentage, 100)}%`, background: weekFill }}
            />
          </div>
          <div className="hs-week-meta">
            {completedToday}/{goals.length} done today
          </div>
        </div>
      </header>

      <section className="hs-panel">
        <div className="hs-panel-bar">
          <h2 className="hs-panel-title">Today's Activities</h2>
          <button
            className="hs-btn"
            onClick={() => setShowAdHocTaskForm(true)}
          >
            + Record Activity
          </button>
        </div>
        
        {goals.length === 0 ? (
          <div className="hs-empty">
            No activities assigned to you yet. Check with your teacher or parent.
          </div>
        ) : (
          <div className="hs-activity-grid">
            {/* Sort goals + tasks together: gray (pending) first, yellow, blue, green */}
            {(() => {
              const sp: { [key: string]: number } = { 'pending': 1, 'progress-week': 2, 'done-today': 3, 'weekly-complete': 4 };
              const toMid = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
              const toD = (v: any): Date => v instanceof Date ? v : v?.toDate ? v.toDate() : new Date(v);
              const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
              const wkS = getWeekStart(startOfWeek);
              const wkE = getWeekEnd(startOfWeek);

              type SI = { type: 'goal'; goal: typeof goals[0]; pri: number; nm: string }
                | { type: 'task'; task: typeof adHocTasks[0]; pri: number; nm: string };

              const gItems: SI[] = goals.map(g => {
                const s = getStatusForGoal(g);
                const a = activities.find(act => act.id === g.activityId);
                return { type: 'goal', goal: g, pri: sp[s.status] || 999, nm: g.name || a?.name || '' };
              });

              const tItems: SI[] = adHocTasks.filter(t => {
                if (t.studentId !== student.id) return false;
                if (t.completedDate) {
                  const cd = toMid(toD(t.completedDate));
                  return cd >= wkS && cd <= wkE;
                }
                return toMid(toD(t.startDate)) <= todayMid;
              }).map(t => ({ type: 'task' as const, task: t, pri: t.completedDate ? 4 : 1, nm: t.name }));

              return [...gItems, ...tItems].sort((a, b) => a.pri !== b.pri ? a.pri - b.pri : a.nm.localeCompare(b.nm)).map(item => {
                if (item.type === 'task') {
                  const task = item.task;
                  const isCompleted = !!task.completedDate;
                  const targetDate = task.targetDate ? toMid(toD(task.targetDate)) : null;
                  const taskColors = isCompleted
                    ? {
                        backgroundColor: 'var(--hs-goal-complete-bg)',
                        color: 'var(--hs-goal-complete-text)',
                        borderColor: 'var(--hs-goal-complete-border)'
                      }
                    : {
                        backgroundColor: 'var(--hs-goal-pending-bg)',
                        color: 'var(--hs-goal-pending-text)',
                        borderColor: 'var(--hs-goal-pending-border)'
                      };
                  return (
                    <div
                      key={`task-${task.id}`}
                      className={isCompleted ? 'hs-activity-card' : 'hs-activity-card is-clickable'}
                      style={taskColors}
                      onClick={() => { if (!isCompleted) { setEditingTask(task); setShowAdHocTaskForm(true); } }}
                    >
                      <div className="hs-activity-top">
                        <span className="hs-chip-icon">{isCompleted ? '✓' : '○'}</span>
                        <h3 className="hs-activity-title">{task.name}</h3>
                        <span className="hs-status-label">{isCompleted ? 'Done' : 'Task'}</span>
                      </div>
                      {task.description && <p className="hs-activity-desc">{task.description}</p>}
                      <div className="hs-activity-foot">
                        <div className="hs-chip-meta">
                          {targetDate ? `Due ${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : (isCompleted ? 'Completed' : 'Pending')}
                        </div>
                        {!isCompleted && <div className="hs-action-link">Mark Done</div>}
                      </div>
                    </div>
                  );
                }

                const goal = item.goal;
                const activity = activities.find(a => a.id === goal.activityId);
                const status = getStatusForGoal(goal);
                const progress = getProgressForGoal(goal.id);
                const latest = getLatestProgress(goal.id);
                const weeklyCount = weekInstances.filter(i => i.goalId === goal.id && i.studentId === student.id).length;
                const todayCount = todayInstances.filter(i => i.goalId === goal.id && i.studentId === student.id).length;
                const metaParts: string[] = [];
                if (goal.timesPerWeek) metaParts.push(`${weeklyCount}/${goal.timesPerWeek} wk`);
                if (goal.minutesPerSession) metaParts.push(`${goal.minutesPerSession} min`);
                if (activity?.progressReportingStyle?.percentageCompletion && (goal.percentageGoal || goal.dailyPercentageIncrease) && latest?.percentageCompleted !== undefined) {
                  metaParts.push(goal.percentageGoal ? `${latest.percentageCompleted.toFixed(0)}% of ${goal.percentageGoal}%` : `${latest.percentageCompleted.toFixed(0)}%`);
                }
                if (activity?.progressReportingStyle?.progressCount && goal.progressCount && latest?.countCompleted !== undefined) {
                  metaParts.push(`${latest.countCompleted}/${goal.progressCount} ${activity.progressCountName || 'items'}`);
                }
                if (todayCount > 1) metaParts.push(`${todayCount}x today`);

                return (
                  <div
                    key={goal.id}
                    className="hs-activity-card is-clickable"
                    style={{
                      backgroundColor: status.backgroundColor,
                      color: status.textColor,
                      borderColor: status.color
                    }}
                    onClick={() => handleRecordActivity(goal)}
                  >
                    <div className="hs-activity-top">
                      <span className="hs-chip-icon" title={status.text}>{status.icon}</span>
                      <h3 className="hs-activity-title">{goal.name || activity?.name || 'Unknown Activity'}</h3>
                      <span className="hs-status-label">{status.text}</span>
                    </div>
                    {activity?.description && <p className="hs-activity-desc">{activity.description}</p>}
                    <div className="hs-activity-foot">
                      <div className="hs-chip-meta">{metaParts.join(' · ') || 'No progress yet'}</div>
                      <div className="hs-action-link">{progress.todayInstance || todayCount > 0 ? 'Edit' : 'Record'}</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </section>

      <div className="hs-note">
        {student.lastActivity && (
          <p>Last activity: {formatLastActivity(student.lastActivity)}</p>
        )}
        <p className="hs-encouragement">
          {weeklyProgressPercentage === 100
            ? "You've finished every session for this week. Outstanding work."
            : weeklyProgressPercentage > 75
            ? "You're close to finishing your weekly goals."
            : weeklyProgressPercentage > 50
            ? "More than halfway through this week's sessions."
            : weeklyProgressPercentage > 25
            ? "Good start this week. Keep the momentum going."
            : "Ready when you are. Pick an activity to record."
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
          homeschoolId={homeschool.id}
          onClose={handleActivityFormClose}
          onActivityRecorded={handleActivityFormClose}
        />
      )}

      {/* Ad-Hoc Task Form Modal */}
      {showAdHocTaskForm && (
        <AdHocTaskForm
          homeschoolId={homeschool.id}
          students={[student]}
          userId={student.id}
          timezone={timezone}
          mode={editingTask ? 'record' : 'record'}
          existingTask={editingTask || undefined}
          preSelectedStudent={student.id}
          onClose={() => { setShowAdHocTaskForm(false); setEditingTask(null); }}
          onTaskAdded={async () => {
            setShowAdHocTaskForm(false);
            setEditingTask(null);
            // Refresh tasks
            const tasksQuery = query(collection(db, 'adHocTasks'), where('homeschoolId', '==', homeschool.id));
            const tasksSnapshot = await getDocs(tasksQuery);
            const tasksList = tasksSnapshot.docs.map(d => ({
              ...d.data(),
              id: d.id
            } as AdHocTask));
            setAdHocTasks(tasksList);
          }}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
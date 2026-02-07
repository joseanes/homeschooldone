import { Goal, ActivityInstance, Activity } from '../types';

/**
 * Helper function to check if a goal should be shown based on start date and student completion
 */
export function isGoalActiveForStudent(goal: Goal, studentId: string, currentDate: Date = new Date()): boolean {
  // Check start date
  if (goal.startDate) {
    const startDate = goal.startDate instanceof Date ? goal.startDate : new Date(goal.startDate);
    if (currentDate < startDate) return false;
  }
  
  // Check student completion date
  if (goal.studentCompletions?.[studentId]?.completionDate) {
    const completion = goal.studentCompletions[studentId].completionDate;
    const completionDate = completion instanceof Date 
      ? completion 
      : new Date(completion!);
    if (currentDate > completionDate) return false;
  }
  
  return true;
}

/**
 * Calculate goal progress for a specific student and time period
 */
export interface GoalProgress {
  todayCount: number;
  weekCount: number;
  todayMinutes: number;
  weekMinutes: number;
  todayInstance: ActivityInstance | null;
  target: number;
  total: number;
}

export function calculateGoalProgress(
  goalId: string,
  goal: Goal,
  activityInstances: ActivityInstance[],
  todayStart: Date,
  todayEnd: Date,
  weekStart: Date,
  weekEnd: Date
): GoalProgress {
  const goalInstances = activityInstances.filter(instance => instance.goalId === goalId);
  
  const todayInstances = goalInstances.filter(instance => {
    const instanceDate = new Date(instance.date);
    return instanceDate >= todayStart && instanceDate <= todayEnd;
  });
  
  const weekInstances = goalInstances.filter(instance => {
    const instanceDate = new Date(instance.date);
    return instanceDate >= weekStart && instanceDate <= weekEnd;
  });

  return {
    todayCount: todayInstances.length,
    weekCount: weekInstances.length,
    todayMinutes: todayInstances.reduce((sum, inst) => sum + (inst.duration || 0), 0),
    weekMinutes: weekInstances.reduce((sum, inst) => sum + (inst.duration || 0), 0),
    todayInstance: todayInstances.length > 0 ? todayInstances[0] : null,
    target: goal.timesPerWeek || 0,
    total: goalInstances.length
  };
}

/**
 * Get goal status (complete, partial, pending, etc.)
 */
export interface GoalStatus {
  status: 'complete' | 'partial' | 'pending' | 'week_complete';
  color: string;
  text: string;
}

export function getGoalStatus(goal: Goal, progress: GoalProgress): GoalStatus {
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
}

/**
 * Filter goals for a specific student that are currently active
 */
export function filterActiveGoalsForStudent(
  goals: Goal[], 
  studentId: string, 
  currentDate: Date = new Date()
): Goal[] {
  return goals.filter(goal => {
    const isAssigned = goal.studentIds?.includes(studentId);
    const isActive = isGoalActiveForStudent(goal, studentId, currentDate);
    return isAssigned && isActive;
  });
}

/**
 * Sort goals for display (completed tasks at bottom, rest alphabetically)
 */
export function sortGoalsForDisplay(
  goals: Goal[], 
  activities: Activity[], 
  getGoalStatusFn: (goal: Goal) => GoalStatus
): Goal[] {
  return [...goals].sort((a, b) => {
    const activityA = activities.find(act => act.id === a.activityId);
    const activityB = activities.find(act => act.id === b.activityId);
    const statusA = getGoalStatusFn(a);
    const statusB = getGoalStatusFn(b);
    
    // Completed tasks go to bottom
    const isCompletedA = statusA.status === 'complete';
    const isCompletedB = statusB.status === 'complete';
    
    if (isCompletedA && !isCompletedB) return 1;
    if (!isCompletedA && isCompletedB) return -1;
    
    // For non-completed or both completed, sort alphabetically by activity name
    return (activityA?.name || '').localeCompare(activityB?.name || '');
  });
}
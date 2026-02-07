import { collection, query, where, getDocs, QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityInstance, Goal, Activity, Person } from '../types';

/**
 * Fetches all activity instances for a student within a date range
 */
export async function fetchActivityInstancesForStudent(
  studentId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ActivityInstance[]> {
  try {
    const constraints: QueryConstraint[] = [
      where('studentId', '==', studentId)
    ];
    
    if (startDate) {
      constraints.push(where('date', '>=', startDate));
    }
    
    if (endDate) {
      constraints.push(where('date', '<=', endDate));
    }
    
    const instanceQuery = query(
      collection(db, 'activityInstances'),
      ...constraints
    );
    
    const snapshot = await getDocs(instanceQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
    } as ActivityInstance));
  } catch (error) {
    console.error('Error fetching activity instances:', error);
    return [];
  }
}

/**
 * Fetches all activity instances for multiple goals
 */
export async function fetchActivityInstancesForGoals(
  goalIds: string[]
): Promise<ActivityInstance[]> {
  if (goalIds.length === 0) return [];
  
  try {
    // Firestore 'in' queries are limited to 10 items
    const chunks = chunkArray(goalIds, 10);
    const allInstances: ActivityInstance[] = [];
    
    for (const chunk of chunks) {
      const instanceQuery = query(
        collection(db, 'activityInstances'),
        where('goalId', 'in', chunk)
      );
      
      const snapshot = await getDocs(instanceQuery);
      const instances = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
      } as ActivityInstance));
      
      allInstances.push(...instances);
    }
    
    // Sort by date in memory (newest first)
    allInstances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return allInstances;
  } catch (error) {
    console.error('Error fetching activity instances for goals:', error);
    return [];
  }
}

/**
 * Fetches goals for a homeschool
 */
export async function fetchGoalsForHomeschool(homeschoolId: string): Promise<Goal[]> {
  try {
    const goalsQuery = query(
      collection(db, 'goals'),
      where('homeschoolId', '==', homeschoolId)
    );
    
    const snapshot = await getDocs(goalsQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Goal));
  } catch (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
}

/**
 * Fetches activities for a homeschool
 */
export async function fetchActivitiesForHomeschool(homeschoolId: string): Promise<Activity[]> {
  try {
    const activitiesQuery = query(
      collection(db, 'activities'),
      where('homeschoolId', '==', homeschoolId)
    );
    
    const snapshot = await getDocs(activitiesQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Activity));
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
}

/**
 * Fetches students/people for a homeschool
 */
export async function fetchStudentsForHomeschool(homeschoolId: string): Promise<Person[]> {
  try {
    const studentsQuery = query(
      collection(db, 'people'),
      where('homeschoolIds', 'array-contains', homeschoolId)
    );
    
    const snapshot = await getDocs(studentsQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Person));
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
}

/**
 * Fetches complete student data (goals, activities, instances) for a specific student
 */
export async function fetchCompleteStudentData(
  studentId: string,
  homeschoolId: string,
  todayStart?: Date,
  todayEnd?: Date,
  weekStart?: Date,
  weekEnd?: Date
): Promise<{
  goals: Goal[];
  activities: Activity[];
  todayInstances: ActivityInstance[];
  weekInstances: ActivityInstance[];
}> {
  try {
    // Fetch all goals for homeschool
    const goals = await fetchGoalsForHomeschool(homeschoolId);
    
    // Filter goals for this student
    const studentGoals = goals.filter(goal => goal.studentIds?.includes(studentId));
    
    // Get activities for these goals
    const activityIds = Array.from(new Set(studentGoals.map(g => g.activityId)));
    const activities = await fetchActivitiesForHomeschool(homeschoolId);
    const studentActivities = activities.filter(activity => activityIds.includes(activity.id));
    
    // Fetch today's instances
    const todayInstances = todayStart && todayEnd 
      ? await fetchActivityInstancesForStudent(studentId, todayStart, todayEnd)
      : [];
    
    // Fetch week's instances
    const weekInstances = weekStart && weekEnd
      ? await fetchActivityInstancesForStudent(studentId, weekStart, weekEnd)
      : [];
    
    return {
      goals: studentGoals,
      activities: studentActivities,
      todayInstances,
      weekInstances
    };
  } catch (error) {
    console.error('Error fetching complete student data:', error);
    return {
      goals: [],
      activities: [],
      todayInstances: [],
      weekInstances: []
    };
  }
}

/**
 * Utility function to chunk an array into smaller arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
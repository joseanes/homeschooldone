import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc, updateDoc, arrayRemove, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Homeschool, Person, Activity, Goal, ActivityInstance, AdHocTask } from '../types';
import { isGoalActiveForStudent } from '../utils/goalUtils';
import { getWeekStart, getWeekEnd } from '../utils/dateUtils';
import StudentForm from './StudentForm';
import ActivityForm from './ActivityForm';
import GoalForm from './GoalForm';
import ActivityInstanceForm from './ActivityInstanceForm';
import Reports from './Reports';
import DeleteConfirmation from './DeleteConfirmation';
import HomeschoolEdit from './HomeschoolEdit';
import StudentEdit from './StudentEdit';
import ActivityEdit from './ActivityEdit';
import GoalEdit from './GoalEdit';
import InviteUser from './InviteUser';
import HomeschoolSwitcher from './HomeschoolSwitcher';
import HomeschoolDelete from './HomeschoolDelete';
import AuthorizedUsers from './AuthorizedUsers';
import DashboardView from './DashboardView';
import StudentDashboard from './StudentDashboard';
import SettingsModal from './SettingsModal';
import AdHocTaskForm from './AdHocTaskForm';

interface DashboardProps {
  user: User;
  onSignOut: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onSignOut }) => {
  const [homeschool, setHomeschool] = useState<Homeschool | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [homeschoolName, setHomeschoolName] = useState('');
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [students, setStudents] = useState<Person[]>([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'student' | 'activity' | 'goal';
    id: string;
    name: string;
  } | null>(null);
  const [showActivityInstanceForm, setShowActivityInstanceForm] = useState(false);
  const [preSelectedGoal, setPreSelectedGoal] = useState<string>('');
  const [preSelectedStudent, setPreSelectedStudent] = useState<string>('');
  const [editingActivityInstance, setEditingActivityInstance] = useState<ActivityInstance | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [editingHomeschool, setEditingHomeschool] = useState<Homeschool | null>(null);
  const [editingStudent, setEditingStudent] = useState<Person | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingGoal, setEditingGoal] = useState<{ goal: Goal; activity: Activity; students: Person[] } | null>(null);
  const [todayInstances, setTodayInstances] = useState<ActivityInstance[]>([]);
  const [weekInstances, setWeekInstances] = useState<ActivityInstance[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showHomeschoolSwitcher, setShowHomeschoolSwitcher] = useState(false);
  const [showDeleteHomeschool, setShowDeleteHomeschool] = useState(false);
  const [showAuthorizedUsers, setShowAuthorizedUsers] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [returnToSettings, setReturnToSettings] = useState(false);
  const [returnToReports, setReturnToReports] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'dashboard' | 'timer' | 'students' | 'activities' | 'users' | 'tasks'>('general');
  const [dashboardSettings, setDashboardSettings] = useState({
    cycleSeconds: 10,
    startOfWeek: 1, // 1 = Monday
    timezone: 'America/New_York' // EST/EDT
  });
  const [timerAlarmEnabled, setTimerAlarmEnabled] = useState(false);
  const [publicDashboardId, setPublicDashboardId] = useState<string | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Person | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAdHocTaskForm, setShowAdHocTaskForm] = useState(false);
  const [adHocTaskMode, setAdHocTaskMode] = useState<'assign' | 'record'>('record');
  const [adHocTaskStudent, setAdHocTaskStudent] = useState<string>('');
  const [adHocTasks, setAdHocTasks] = useState<AdHocTask[]>([]);
  const [editingAdHocTask, setEditingAdHocTask] = useState<AdHocTask | null>(null);

  // Note: isGoalActiveForStudent is now imported from utils/goalUtils

  // Load dashboard settings, timer alarm, and public dashboard from homeschool document
  useEffect(() => {
    if (homeschool?.dashboardSettings) {
      setDashboardSettings(homeschool.dashboardSettings);
    }
    if (homeschool?.timerAlarmEnabled !== undefined) {
      setTimerAlarmEnabled(homeschool.timerAlarmEnabled);
    }
    if (homeschool?.publicDashboardId !== undefined) {
      setPublicDashboardId(homeschool.publicDashboardId || null);
    }
  }, [homeschool]);

  // Set students array for student users
  useEffect(() => {
    if (userRole === 'student' && currentStudent) {
      setStudents([currentStudent]);
    }
  }, [userRole, currentStudent]);

  // Save dashboard settings to Firebase
  const saveDashboardSettings = async (newSettings: typeof dashboardSettings) => {
    if (!homeschool?.id) return;
    
    try {
      await updateDoc(doc(db, 'homeschools', homeschool.id), {
        dashboardSettings: newSettings
      });
      setDashboardSettings(newSettings);
    } catch (error) {
      console.error('Error saving dashboard settings:', error);
    }
  };

  const saveTimerAlarmSetting = async (enabled: boolean) => {
    if (!homeschool?.id) return;
    
    try {
      await updateDoc(doc(db, 'homeschools', homeschool.id), {
        timerAlarmEnabled: enabled
      });
      setTimerAlarmEnabled(enabled);
    } catch (error) {
      console.error('Error saving timer alarm setting:', error);
    }
  };

  // Save public dashboard setting to Firebase
  const savePublicDashboardSetting = async (dashboardId: string | null) => {
    if (!homeschool?.id) return;
    
    try {
      const updates: any = {};
      if (dashboardId) {
        updates.publicDashboardId = dashboardId;
      } else {
        updates.publicDashboardId = null;
      }
      
      await updateDoc(doc(db, 'homeschools', homeschool.id), updates);
      setPublicDashboardId(dashboardId);
    } catch (error) {
      console.error('Error saving public dashboard setting:', error);
    }
  };

  // Save multiple records per day setting to Firebase
  const saveMultipleRecordsSetting = async (enabled: boolean) => {
    if (!homeschool?.id) return;

    try {
      await updateDoc(doc(db, 'homeschools', homeschool.id), {
        allowMultipleRecordsPerDay: enabled
      });
      setHomeschool(prev => prev ? { ...prev, allowMultipleRecordsPerDay: enabled } : null);
    } catch (error) {
      console.error('Error saving multiple records setting:', error);
    }
  };

  // Save school year start setting to Firebase
  const saveSchoolYearStart = async (month: number, day: number) => {
    if (!homeschool?.id) return;
    try {
      await updateDoc(doc(db, 'homeschools', homeschool.id), {
        schoolYearStartMonth: month,
        schoolYearStartDay: day
      });
      setHomeschool(prev => prev ? { ...prev, schoolYearStartMonth: month, schoolYearStartDay: day } : null);
    } catch (error) {
      console.error('Error saving school year start:', error);
    }
  };

  // Save student sort order setting to Firebase
  const saveStudentSortOrder = async (order: string) => {
    if (!homeschool?.id) return;
    try {
      await updateDoc(doc(db, 'homeschools', homeschool.id), {
        studentSortOrder: order
      });
      setHomeschool(prev => prev ? { ...prev, studentSortOrder: order as any } : null);
    } catch (error) {
      console.error('Error saving student sort order:', error);
    }
  };

  useEffect(() => {
    // Accept pending invitations and link student records for this user's
    // verified email. This runs server-side: Firestore rules do not let
    // clients edit the membership lists of homeschools they don't belong to.
    const activateInvitations = async () => {
      if (!user.email) return;

      try {
        // Pick up a verification completed since the token was issued.
        if (!user.emailVerified) {
          await user.reload();
          if (user.emailVerified) await user.getIdToken(true);
        }
        await httpsCallable(functions, 'acceptInvitations')();
      } catch (error) {
        console.error('Error activating invitations:', error);
      }
    };

    // Check if user already has a homeschool
    const checkHomeschool = async () => {
      try {
        // First, activate any pending invitations
        await activateInvitations();
        // Check all possible role arrays for this user
        
        const queries = [
          { query: query(collection(db, 'homeschools'), where('parentIds', 'array-contains', user.uid)), role: 'parent' },
          { query: query(collection(db, 'homeschools'), where('tutorIds', 'array-contains', user.uid)), role: 'tutor' },
          { query: query(collection(db, 'homeschools'), where('observerIds', 'array-contains', user.uid)), role: 'observer' }
        ];
        
        let homeschoolData = null;
        let userRole = null;
        
        // First check if user is a linked student account
        const studentHomeschools = await getDocs(
          query(collection(db, 'homeschools'), where('studentUids', 'array-contains', user.uid))
        );

        if (!studentHomeschools.empty) {
          const hsDoc = studentHomeschools.docs[0];
          const studentSnapshot = await getDocs(query(
            collection(db, 'people'),
            where('homeschoolId', '==', hsDoc.id),
            where('authUid', '==', user.uid)
          ));

          if (!studentSnapshot.empty) {
            const studentDoc = studentSnapshot.docs[0];
            homeschoolData = { ...(hsDoc.data() as Homeschool), id: hsDoc.id };
            userRole = 'student';

            // Set the current student info
            setCurrentStudent({ ...studentDoc.data(), id: studentDoc.id } as Person);
          }
        }

        // If not a student, check parent/tutor/observer roles
        if (!homeschoolData) {
          for (const { query: q, role } of queries) {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const data = querySnapshot.docs[0].data() as Homeschool;
              homeschoolData = { ...data, id: querySnapshot.docs[0].id };
              userRole = role;
              break;
            }
          }
        }
        
        if (!homeschoolData) {
        }
        
        // Check if we have a saved homeschool preference
        const savedHomeschoolId = localStorage.getItem('selectedHomeschoolId');
        
        // If not a student, check parent/tutor/observer roles and look for all homeschools
        if (!homeschoolData) {
          const allHomeschools: Array<{ data: Homeschool; role: string }> = [];
          
          for (const { query: q, role } of queries) {
            const querySnapshot = await getDocs(q);
            querySnapshot.docs.forEach(doc => {
              const data = doc.data() as Homeschool;
              allHomeschools.push({ data: { ...data, id: doc.id }, role });
            });
          }
          
          if (allHomeschools.length > 0) {
            // If we have a saved preference and it's in the list, use it
            if (savedHomeschoolId) {
              const savedHomeschool = allHomeschools.find(h => h.data.id === savedHomeschoolId);
              if (savedHomeschool) {
                homeschoolData = savedHomeschool.data;
                userRole = savedHomeschool.role;
              }
            }
            
            // Otherwise use the first one
            if (!homeschoolData) {
              homeschoolData = allHomeschools[0].data;
              userRole = allHomeschools[0].role;
            }
          }
        }
        
        if (!homeschoolData) {
        }
        
        if (homeschoolData) {
          setHomeschool(homeschoolData);
          setUserRole(userRole);
          
          // Fetch students
          if (userRole === 'student') {
            // If user is a student, they should already be set in currentStudent
            // We'll set students array later after currentStudent state is updated
          } else if (homeschoolData.studentIds && homeschoolData.studentIds.length > 0) {
            // If user is parent/tutor/observer, show all students
            const studentPromises = homeschoolData.studentIds.map(async (studentId) => {
              const studentDoc = await getDoc(doc(db, 'people', studentId));
              if (studentDoc.exists()) {
                return { ...studentDoc.data(), id: studentDoc.id } as Person;
              }
              return null;
            });
            
            const studentResults = await Promise.all(studentPromises);
            setStudents(studentResults.filter(s => s !== null) as Person[]);
          }

          // Fetch activities
          const activitiesQuery = query(collection(db, 'activities'), where('homeschoolId', '==', homeschoolData.id));
          const activitiesSnapshot = await getDocs(activitiesQuery);
          const activitiesList = activitiesSnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          } as Activity)).sort((a, b) => a.name.localeCompare(b.name));
          setActivities(activitiesList);

          // Fetch goals
          const goalsQuery = query(collection(db, 'goals'), where('homeschoolId', '==', homeschoolData.id));
          const goalsSnapshot = await getDocs(goalsQuery);
          const goalsList = goalsSnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          } as Goal));
          setGoals(goalsList);

          // Fetch ad-hoc tasks
          const adHocTasksQuery = query(collection(db, 'adHocTasks'), where('homeschoolId', '==', homeschoolData.id));
          const adHocTasksSnapshot = await getDocs(adHocTasksQuery);
          const adHocTasksList = adHocTasksSnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          } as AdHocTask));
          setAdHocTasks(adHocTasksList);
        }
      } catch (error) {
        console.error('Error checking homeschool:', error);
      } finally {
        setLoading(false);
      }
    };

    checkHomeschool();
  }, [user.uid]);

  // Function to refresh homeschool data
  const refreshHomeschoolData = async () => {
    if (!homeschool?.id) return;
    
    try {
      const homeschoolDoc = await getDoc(doc(db, 'homeschools', homeschool.id));
      if (homeschoolDoc.exists()) {
        const updatedData = { ...homeschoolDoc.data(), id: homeschoolDoc.id } as Homeschool;
        setHomeschool(updatedData);
      }
    } catch (error) {
      console.error('Error refreshing homeschool data:', error);
    }
  };

  useEffect(() => {
    if (goals.length > 0) {
      fetchTodayInstances();
      fetchWeekInstances();
    }
  }, [goals, homeschool, dashboardSettings.startOfWeek]);

  const fetchTodayInstances = async () => {
    if (!homeschool) return;
    
    try {
      if (goals.length === 0) {
        setTodayInstances([]);
        return;
      }

      const q = query(
        collection(db, 'activityInstances'),
        where('homeschoolId', '==', homeschool.id)
      );
      
      const snapshot = await getDocs(q);
      const instances = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
        } as ActivityInstance;
      });
      
      // Filter for today using selected timezone
      const today = getCurrentDateInTimezone();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const todayFiltered = instances.filter(instance => {
        const instanceDate = new Date(instance.date);
        const instanceDateLocal = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), instanceDate.getDate());
        return instanceDateLocal.getTime() === todayStart.getTime();
      });
      
      setTodayInstances(todayFiltered);
    } catch (error) {
      console.error('Error fetching today instances:', error);
    }
  };

  // Helper function to get current date in selected timezone
  const getCurrentDateInTimezone = () => {
    const now = new Date();
    // Create a formatter for the selected timezone
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: dashboardSettings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(part => part.type === 'year')?.value || '2024');
    const month = parseInt(parts.find(part => part.type === 'month')?.value || '1') - 1; // Month is 0-indexed
    const day = parseInt(parts.find(part => part.type === 'day')?.value || '1');
    
    return new Date(year, month, day);
  };

  const fetchWeekInstances = async () => {
    if (!homeschool?.id) return;
    
    try {
      // Calculate start of current week based on settings using selected timezone
      const today = getCurrentDateInTimezone();
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      const startOfWeekDay = dashboardSettings.startOfWeek !== undefined ? dashboardSettings.startOfWeek : 1; // Default Monday
      
      // Calculate days to subtract to get to start of week
      const daysFromStartOfWeek = (dayOfWeek - startOfWeekDay + 7) % 7;
      startOfWeek.setDate(today.getDate() - daysFromStartOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      const querySnapshot = await getDocs(query(
        collection(db, 'activityInstances'),
        where('homeschoolId', '==', homeschool.id)
      ));
      const allInstances = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
      } as ActivityInstance));

      // Filter for current week in memory
      const instances = allInstances.filter(instance => {
        const instanceDate = instance.date instanceof Date ? instance.date : new Date(instance.date);
        return instanceDate >= startOfWeek && instanceDate <= endOfWeek;
      });
      
      setWeekInstances(instances);
    } catch (error) {
      console.error('Error fetching week instances:', error);
    }
  };

  const getGoalProgress = (goalId: string, studentId: string) => {
    const todayInstancesForGoal = todayInstances.filter(i => i.goalId === goalId && i.studentId === studentId);
    return { 
      today: todayInstancesForGoal.length,
      instance: todayInstancesForGoal.length > 0 ? todayInstancesForGoal[0] : null
    };
  };

  const getLatestProgress = (goalId: string, studentId: string) => {
    // Get all instances for this goal and student from weekInstances (includes today)
    const allInstances = weekInstances
      .filter(i => i.goalId === goalId && i.studentId === studentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (allInstances.length === 0) return null;
    
    const latest = allInstances[0];
    return {
      percentageCompleted: latest.percentageCompleted || latest.endingPercentage,
      countCompleted: latest.countCompleted
    };
  };

  const getWeeklyAttainmentChange = (goalId: string, studentId: string) => {
    // Get all instances for this goal and student from weekInstances, sorted by date asc
    const instances = weekInstances
      .filter(i => i.goalId === goalId && i.studentId === studentId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (instances.length < 1) return null;

    const latest = instances[instances.length - 1];
    const latestPct = latest.percentageCompleted ?? latest.endingPercentage;
    const latestCount = latest.countCompleted;

    // For percentage: compare with the starting value of the earliest instance this week
    // The "starting" value is either startingPercentage of earliest, or percentageCompleted of the previous week's last instance
    // Simplest: compare earliest instance's startingPercentage (or percentageCompleted) with latest's ending
    const earliest = instances[0];
    const earliestPct = earliest.startingPercentage ?? earliest.percentageCompleted ?? earliest.endingPercentage;

    let pctChange: number | null = null;
    if (latestPct !== undefined && earliestPct !== undefined) {
      pctChange = latestPct - earliestPct;
    }

    // For count: compare earliest countCompleted with latest countCompleted
    let countChange: number | null = null;
    if (latestCount !== undefined && earliest.countCompleted !== undefined) {
      countChange = latestCount - earliest.countCompleted;
    }

    return { pctChange, countChange, latestPct, latestCount };
  };

  const getGoalStatus = (goal: Goal, studentId: string) => {
    const progress = getGoalProgress(goal.id, studentId);

    // Count instances this week for this student and goal
    const weeklyCount = weekInstances.filter(i =>
      i.goalId === goal.id &&
      i.studentId === studentId
    ).length;

    // Check if weekly requirement is met
    const weeklyComplete = goal.timesPerWeek && weeklyCount >= goal.timesPerWeek;

    if (weeklyComplete) {
      return {
        status: 'weekly-complete',
        color: 'var(--hs-goal-complete-border)',
        backgroundColor: 'var(--hs-goal-complete-bg)',
        textColor: 'var(--hs-goal-complete-text)',
        text: '✓',
        label: 'Weekly Complete'
      };
    }

    if (progress.today > 0) {
      return {
        status: 'done-today',
        color: 'var(--hs-goal-today-border)',
        backgroundColor: 'var(--hs-goal-today-bg)',
        textColor: 'var(--hs-goal-today-text)',
        text: '✔',
        label: 'Done Today'
      };
    }

    if (weeklyCount > 0) {
      return {
        status: 'progress-week',
        color: 'var(--hs-goal-progress-border)',
        backgroundColor: 'var(--hs-goal-progress-bg)',
        textColor: 'var(--hs-goal-progress-text)',
        text: '◐',
        label: 'Progress This Week'
      };
    }

    return {
      status: 'pending',
      color: 'var(--hs-goal-pending-border)',
      backgroundColor: 'var(--hs-goal-pending-bg)',
      textColor: 'var(--hs-goal-pending-text)',
      text: '○',
      label: 'Pending'
    };
  };

  const handleOpenRecordActivity = (goalId: string, studentId: string) => {
    const progress = getGoalProgress(goalId, studentId);
    setPreSelectedGoal(goalId);
    setPreSelectedStudent(studentId);
    setEditingActivityInstance(progress.instance);
    setShowActivityInstanceForm(true);
  };

  const refreshStudents = async (studentIds?: string[]) => {
    const ids = studentIds || homeschool?.studentIds;
    if (!ids || ids.length === 0) {
      setStudents([]);
      return;
    }

    const studentPromises = ids.map(async (studentId) => {
      const studentDoc = await getDoc(doc(db, 'people', studentId));
      if (studentDoc.exists()) {
        return { ...studentDoc.data(), id: studentDoc.id } as Person;
      }
      return null;
    });
    
    const studentResults = await Promise.all(studentPromises);
    setStudents(studentResults.filter(s => s !== null) as Person[]);
  };

  const handleDelete = async () => {
    if (!deleteConfirmation || !homeschool) return;

    try {
      const { type, id } = deleteConfirmation;

      if (type === 'student') {
        const linkedUid = students.find(s => s.id === id)?.authUid;

        // Delete student document
        await deleteDoc(doc(db, 'people', id));
        
        // Remove student ID (and the linked student account's access) from homeschool
        await updateDoc(doc(db, 'homeschools', homeschool.id), {
          studentIds: arrayRemove(id),
          ...(linkedUid ? { studentUids: arrayRemove(linkedUid) } : {})
        });
        
        // Update local state
        setStudents(students.filter(s => s.id !== id));
        setHomeschool({
          ...homeschool,
          studentIds: homeschool.studentIds.filter(sid => sid !== id)
        });

        // Delete any goals associated with this student
        const studentGoals = goals.filter(g => g.studentIds?.includes(id));
        for (const goal of studentGoals) {
          await deleteDoc(doc(db, 'goals', goal.id));
        }
        setGoals(goals.filter(g => !g.studentIds?.includes(id)));

      } else if (type === 'activity') {
        // Delete activity document
        await deleteDoc(doc(db, 'activities', id));
        
        // Update local state
        setActivities(activities.filter(a => a.id !== id));

        // Delete any goals associated with this activity
        const activityGoals = goals.filter(g => g.activityId === id);
        for (const goal of activityGoals) {
          await deleteDoc(doc(db, 'goals', goal.id));
        }
        setGoals(goals.filter(g => g.activityId !== id));

      } else if (type === 'goal') {
        // Delete goal document
        await deleteDoc(doc(db, 'goals', id));
        
        // Update local state
        setGoals(goals.filter(g => g.id !== id));
      }

      setDeleteConfirmation(null);
      // Return to settings if we came from there
      if (returnToSettings) {
        setReturnToSettings(false);
        setShowSettings(true);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error deleting. Please try again.');
    }
  };

  const createHomeschool = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!homeschoolName.trim()) {
      alert('Please enter a homeschool name');
      return;
    }
    
    try {
      const newHomeschool = {
        name: homeschoolName,
        parentIds: [user.uid],
        tutorIds: [],
        observerIds: [],
        studentIds: [],
        createdBy: user.uid,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'homeschools'), newHomeschool);
      
      setHomeschool({ ...newHomeschool, id: docRef.id });
      setShowCreateForm(false);
      setHomeschoolName('');
    } catch (error: any) {
      console.error('Error creating homeschool:', error);
      alert(`Error creating homeschool: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ fontSize: '18px' }}>Loading HomeschoolDone...</div>
        <div style={{ fontSize: '14px', color: 'var(--hs-text-secondary)' }}>
          Please wait while we set up your dashboard
        </div>
      </div>
    );
  }

  // Handle student who can't access their data
  if (userRole === 'student' && !homeschool) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#dc3545' }}>Student Access Issue</h2>
        <p style={{ color: 'var(--hs-text-secondary)', maxWidth: '500px' }}>
          We found your student account ({user.email}), but you don't seem to be assigned to any homeschool.
          Please contact your teacher or parent to make sure you've been properly added to the homeschool system.
        </p>
        <button
          onClick={onSignOut}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
        <div style={{ fontSize: '12px', color: 'var(--hs-text-muted)', marginTop: '20px' }}>
          Debug info: Found student record but no homeschool assignment
        </div>
      </div>
    );
  }

  if (!homeschool) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h2>Welcome to HomeschoolDone!</h2>
        <p>Let's get started by creating your homeschool.</p>
        
        {!showCreateForm ? (
          <button 
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create Your Homeschool
          </button>
        ) : (
          <form onSubmit={createHomeschool} style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Homeschool Name:
              </label>
              <input
                type="text"
                value={homeschoolName}
                onChange={(e) => setHomeschoolName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid var(--hs-border-input)',
                  borderRadius: '4px'
                }}
                placeholder="e.g., Smith Family Homeschool"
              />
            </div>
            <button 
              type="button"
              onClick={createHomeschool}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Create
            </button>
            <button 
              type="button"
              onClick={() => setShowCreateForm(false)}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: 'var(--hs-btn-neutral)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    );
  }

  // If user is a student, show student dashboard
  if (userRole === 'student' && currentStudent && homeschool) {
    return (
      <StudentDashboard
        student={currentStudent}
        homeschool={homeschool}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <svg width="60" height="60" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 43L40 19L66 43V67C66 70.3137 63.3137 73 60 73H20C16.6863 73 14 70.3137 14 67V43Z" fill="#F59E0B"/>
            <path d="M8 45L40 15L72 45" stroke="#D97706" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="40" cy="53" r="16" fill="white"/>
            <path d="M32 53L38 59L50 47" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', color: 'var(--hs-text-primary)' }}>{homeschool.name}</h1>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowHomeschoolSwitcher(!showHomeschoolSwitcher)}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--hs-border-light)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '18px'
                }}
                title="Switch homeschool or create new"
              >
                🔄
              </button>
              {showHomeschoolSwitcher && (
                <HomeschoolSwitcher
                  user={user}
                  currentHomeschool={homeschool}
                  onHomeschoolChange={async (newHomeschool) => {
                    // Save selected homeschool ID to localStorage
                    localStorage.setItem('selectedHomeschoolId', newHomeschool.id);
                    setHomeschool(newHomeschool);
                    setShowHomeschoolSwitcher(false);
                    // Reset all data when switching homeschool
                    setStudents([]);
                    setActivities([]);
                    setGoals([]);
                    setTodayInstances([]);
                    setWeekInstances([]);
                    
                    // Fetch data for the new homeschool
                    try {
                      // Fetch students
                      if (newHomeschool.studentIds && newHomeschool.studentIds.length > 0) {
                        const studentPromises = newHomeschool.studentIds.map(async (studentId) => {
                          const studentDoc = await getDoc(doc(db, 'people', studentId));
                          if (studentDoc.exists()) {
                            return { ...studentDoc.data(), id: studentDoc.id } as Person;
                          }
                          return null;
                        });
                        const studentResults = await Promise.all(studentPromises);
                        setStudents(studentResults.filter(s => s !== null) as Person[]);
                      }

                      // Fetch activities
                      const activitiesQuery = query(collection(db, 'activities'), where('homeschoolId', '==', newHomeschool.id));
                      const activitiesSnapshot = await getDocs(activitiesQuery);
                      const activitiesList = activitiesSnapshot.docs.map(doc => ({
                        ...doc.data(),
                        id: doc.id
                      } as Activity)).sort((a, b) => a.name.localeCompare(b.name));
                      setActivities(activitiesList);

                      // Fetch goals
                      const goalsQuery = query(collection(db, 'goals'), where('homeschoolId', '==', newHomeschool.id));
                      const goalsSnapshot = await getDocs(goalsQuery);
                      const goalsList = goalsSnapshot.docs.map(doc => ({
                        ...doc.data(),
                        id: doc.id
                      } as Goal));
                      setGoals(goalsList);
                    } catch (error) {
                      console.error('Error loading new homeschool data:', error);
                    }
                  }}
                  onClose={() => setShowHomeschoolSwitcher(false)}
                />
              )}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '10px',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setShowActivityInstanceForm(true)}
            disabled={goals.length === 0}
            title="Record a new activity session for a student"
            style={{
              padding: '8px 18px',
              fontSize: '14px',
              backgroundColor: goals.length === 0 ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: goals.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            + Record Progress
          </button>
          <button
            onClick={() => { setAdHocTaskMode('record'); setAdHocTaskStudent(''); setShowAdHocTaskForm(true); }}
            disabled={students.length === 0}
            title="Record a one-off task or activity"
            style={{
              padding: '8px 18px',
              fontSize: '14px',
              backgroundColor: students.length === 0 ? '#ccc' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: students.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            + Record Activity
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Manage students, activities, goals, and settings"
            style={{
              padding: '8px 14px',
              fontSize: '14px',
              backgroundColor: 'var(--hs-btn-neutral)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Settings
          </button>
          <button
            onClick={() => setShowReports(true)}
            title="View progress reports, activity history, and export data"
            style={{
              padding: '8px 14px',
              fontSize: '14px',
              backgroundColor: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Reports
          </button>
          <button
            onClick={() => setShowDashboard(true)}
            title="Open full-screen TV dashboard for classroom display"
            style={{
              padding: '8px 14px',
              fontSize: '14px',
              backgroundColor: '#f57c00',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Dashboard
          </button>
          {goals.length === 0 && (
            <span style={{ fontSize: '13px', color: 'var(--hs-text-muted)', marginLeft: '8px' }}>
              Set up students, activities and goals first
            </span>
          )}
        </div>
      </div>

      {/* Today's Progress Overview - Grouped by Student */}
      <div style={{
        backgroundColor: 'var(--hs-bg-elevated)',
        border: '1px solid var(--hs-border)',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--hs-text-label)' }} title="Overview of today's activity and weekly goal progress for each student">Today's Progress</h3>
        {goals.length === 0 ? (
          <p style={{ color: 'var(--hs-text-secondary)' }}>No goals assigned yet</p>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {[...students].sort((a, b) => {
              const order = homeschool?.studentSortOrder || 'age-asc';
              if (order === 'alpha') {
                return a.name.localeCompare(b.name);
              }
              if (order === 'workload') {
                const workload = (s: typeof a) => goals.filter(g => g.studentIds?.includes(s.id)).reduce((sum, g) => sum + (g.minutesPerSession || 0) * (g.timesPerWeek || 0), 0);
                return workload(b) - workload(a);
              }
              // age-asc or age-desc
              if (a.dateOfBirth && b.dateOfBirth) {
                const dobA = a.dateOfBirth instanceof Date ? a.dateOfBirth : (a.dateOfBirth as any)?.toDate ? (a.dateOfBirth as any).toDate() : new Date(a.dateOfBirth);
                const dobB = b.dateOfBirth instanceof Date ? b.dateOfBirth : (b.dateOfBirth as any)?.toDate ? (b.dateOfBirth as any).toDate() : new Date(b.dateOfBirth);
                return order === 'age-asc'
                  ? dobB.getTime() - dobA.getTime()   // younger (more recent DOB) first
                  : dobA.getTime() - dobB.getTime();   // older (earlier DOB) first
              }
              return a.name.localeCompare(b.name);
            }).map(student => {
              const studentGoals = goals.filter(g => g.studentIds?.includes(student.id) && isGoalActiveForStudent(g, student.id));
              if (studentGoals.length === 0) return null;
              
              const completedGoals = studentGoals.filter(goal => {
                const status = getGoalStatus(goal, student.id);
                return status.status === 'weekly-complete';
              }).length;
              const totalGoals = studentGoals.length;
              const allCompleted = completedGoals === totalGoals;
              
              // Build combined sorted list of goals + tasks
              const statusPriority: { [key: string]: number } = {
                'pending': 1,           // Gray - show first
                'progress-week': 2,     // Yellow - show second
                'done-today': 3,        // Blue - show third
                'weekly-complete': 4    // Green - show last
              };

              type CardItem = { type: 'goal'; goal: typeof studentGoals[0]; priority: number; name: string }
                | { type: 'task'; task: typeof adHocTasks[0]; priority: number; name: string };

              const goalItems: CardItem[] = studentGoals.map(goal => {
                const status = getGoalStatus(goal, student.id);
                const activity = activities.find(act => act.id === goal.activityId);
                return { type: 'goal', goal, priority: statusPriority[status.status] || 999, name: goal.name || activity?.name || '' };
              });

              const todayNorm = new Date(); todayNorm.setHours(0, 0, 0, 0);
              const taskItems: CardItem[] = adHocTasks.filter(task => {
                if (task.studentId !== student.id) return false;
                const sd = task.startDate instanceof Date ? task.startDate : (task.startDate as any)?.toDate ? (task.startDate as any).toDate() : new Date(task.startDate);
                const startNorm = new Date(sd); startNorm.setHours(0, 0, 0, 0);
                if (task.completedDate) {
                  const weekStart = getWeekStart(dashboardSettings.startOfWeek);
                  const weekEnd = getWeekEnd(dashboardSettings.startOfWeek);
                  const cd = task.completedDate instanceof Date ? task.completedDate : (task.completedDate as any)?.toDate ? (task.completedDate as any).toDate() : new Date(task.completedDate);
                  const cdNorm = new Date(cd); cdNorm.setHours(0, 0, 0, 0);
                  return cdNorm >= weekStart && cdNorm <= weekEnd;
                }
                return startNorm <= todayNorm;
              }).map(task => ({
                type: 'task' as const, task, priority: task.completedDate ? 4 : 1, name: task.name
              }));

              const sortedItems = [...goalItems, ...taskItems].sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.name.localeCompare(b.name);
              });

              return (
                <div key={student.id} style={{
                  border: '1px solid var(--hs-border)',
                  borderRadius: '10px',
                  padding: '16px',
                  backgroundColor: allCompleted ? 'var(--hs-bg-card-success)' : 'var(--hs-bg-card)',
                  borderColor: allCompleted ? 'var(--hs-border-success)' : 'var(--hs-border)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '16px',
                      color: 'var(--hs-text-label)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {student.name}
                      {allCompleted && <span style={{ fontSize: '16px' }}>🎉</span>}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setAdHocTaskMode('assign');
                          setAdHocTaskStudent(student.id);
                          setShowAdHocTaskForm(true);
                        }}
                        title={`Assign a task to ${student.name}`}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Assign Task
                      </button>
                      <div
                        title={`${completedGoals} of ${totalGoals} weekly goals completed for ${student.name}`}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          backgroundColor: allCompleted ? 'var(--hs-badge-success-bg)' : 'var(--hs-badge-bg)',
                          color: allCompleted ? 'var(--hs-badge-success-text)' : 'var(--hs-badge-text)',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        {completedGoals}/{totalGoals} Complete
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
                    {sortedItems.map(item => {
                      if (item.type === 'goal') {
                        const goal = item.goal;
                        const activity = activities.find(a => a.id === goal.activityId);
                        const progress = getGoalProgress(goal.id, student.id);
                        const status = getGoalStatus(goal, student.id);
                        const weeklyCount = weekInstances.filter(i => i.goalId === goal.id && i.studentId === student.id).length;
                        if (!activity) return null;
                        const iconTooltips: { [key: string]: string } = {
                          'weekly-complete': `✓ Weekly goal complete (${weeklyCount}/${goal.timesPerWeek} sessions this week)`,
                          'done-today': `✔ Done today, weekly goal in progress (${weeklyCount}/${goal.timesPerWeek} this week)`,
                          'progress-week': `◐ Some progress this week (${weeklyCount}/${goal.timesPerWeek} sessions)`,
                          'pending': '○ No activity recorded this week yet'
                        };
                        const goalDisplayName = goal.name || activity.name;
                        return (
                          <div
                            key={goal.id}
                            onClick={() => handleOpenRecordActivity(goal.id, student.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                              backgroundColor: status.backgroundColor, color: status.textColor,
                              borderRadius: '6px', border: `1px solid ${status.color}`,
                              cursor: 'pointer', transition: 'all 0.2s ease', fontSize: '13px', lineHeight: '1.3'
                            }}
                            title={`${goalDisplayName} – Click to record activity`}
                          >
                            <span style={{ fontSize: '16px', flexShrink: 0 }} title={iconTooltips[status.status] || status.label}>{status.text}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={goal.name ? `Goal: ${goal.name} (Activity: ${activity.name})` : `Activity: ${activity.name}`}>
                                {goalDisplayName}
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.75 }} title={(() => {
                                const tipParts = [];
                                if (goal.timesPerWeek) tipParts.push(`${weeklyCount} of ${goal.timesPerWeek} weekly sessions completed`);
                                const lp = getLatestProgress(goal.id, student.id);
                                const wc = getWeeklyAttainmentChange(goal.id, student.id);
                                if (activity.progressReportingStyle?.percentageCompletion && (goal.percentageGoal || goal.dailyPercentageIncrease) && lp?.percentageCompleted !== undefined) {
                                  let pctTip = `Attainment: ${lp.percentageCompleted.toFixed(1)}%`;
                                  if (goal.percentageGoal) pctTip += ` of ${goal.percentageGoal}%`;
                                  if (wc?.pctChange !== null && wc?.pctChange !== undefined && wc.pctChange !== 0) {
                                    const sign = wc.pctChange > 0 ? '+' : '';
                                    pctTip += ` (${sign}${wc.pctChange.toFixed(1)}% this week)`;
                                  }
                                  tipParts.push(pctTip);
                                }
                                if (activity.progressReportingStyle?.progressCount && goal.progressCount && lp?.countCompleted !== undefined) {
                                  let countTip = `${lp.countCompleted} of ${goal.progressCount} ${activity.progressCountName || 'units'}`;
                                  if (wc?.countChange !== null && wc?.countChange !== undefined && wc.countChange !== 0) {
                                    const sign = wc.countChange > 0 ? '+' : '';
                                    countTip += ` (${sign}${wc.countChange} this week)`;
                                  }
                                  tipParts.push(countTip);
                                }
                                if (progress.today > 1) tipParts.push(`Recorded ${progress.today} times today`);
                                return tipParts.join(' · ') || 'No progress data yet';
                              })()}>
                                {goal.timesPerWeek && <span>{weeklyCount}/{goal.timesPerWeek} wk</span>}
                                {(() => {
                                  const latestProgress = getLatestProgress(goal.id, student.id);
                                  const parts = [];
                                  if (activity.progressReportingStyle?.percentageCompletion && (goal.percentageGoal || goal.dailyPercentageIncrease) && latestProgress?.percentageCompleted !== undefined) {
                                    parts.push(`${latestProgress.percentageCompleted.toFixed(0)}%`);
                                  }
                                  if (activity.progressReportingStyle?.progressCount && goal.progressCount && latestProgress?.countCompleted !== undefined) {
                                    parts.push(`${latestProgress.countCompleted}/${goal.progressCount}`);
                                  }
                                  return parts.length > 0 ? <span>{goal.timesPerWeek ? ' · ' : ''}{parts.join(' · ')}</span> : null;
                                })()}
                                {progress.today > 1 && <span> · {progress.today}x today</span>}
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        const task = item.task;
                        const isCompleted = !!task.completedDate;
                        const td = task.targetDate ? (task.targetDate instanceof Date ? task.targetDate : (task.targetDate as any)?.toDate ? (task.targetDate as any).toDate() : new Date(task.targetDate as any)) : null;
                        const isOverdue = td && !isCompleted && new Date(td).setHours(0,0,0,0) < todayNorm.getTime();
                        return (
                          <div
                            key={`task-${task.id}`}
                            onClick={() => {
                              if (!isCompleted) {
                                setAdHocTaskMode('assign');
                                setAdHocTaskStudent(student.id);
                                setEditingAdHocTask(task);
                                setShowAdHocTaskForm(true);
                              }
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                              backgroundColor: isCompleted ? 'var(--hs-task-complete-bg)' : 'var(--hs-task-pending-bg)',
                              color: isCompleted ? 'var(--hs-task-complete-text)' : 'var(--hs-task-pending-text)',
                              borderRadius: '6px', border: `1px solid ${isCompleted ? 'var(--hs-task-complete-border)' : 'var(--hs-task-pending-border)'}`,
                              cursor: isCompleted ? 'default' : 'pointer', transition: 'all 0.2s ease',
                              fontSize: '13px', lineHeight: '1.3'
                            }}
                            title={`Task: ${task.name}${td ? ` – Due ${td.toLocaleDateString()}` : ''}${isCompleted ? ' (Completed)' : ' – Click to complete'}`}
                          >
                            <span style={{ fontSize: '16px', flexShrink: 0 }}>{isCompleted ? '✅' : '📋'}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {task.name}
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.75 }}>
                                {isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}{td && !isCompleted ? ` · Due ${td.toLocaleDateString()}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Forms and Modals */}
      {showStudentForm && homeschool && (
        <StudentForm
          homeschoolId={homeschool.id}
          homeschool={homeschool}
          inviterName={user.displayName || user.email || 'Parent'}
          onClose={() => {
            setShowStudentForm(false);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
          onStudentAdded={async () => {
            // Refresh the homeschool data to get updated studentIds
            const homeschoolDoc = await getDoc(doc(db, 'homeschools', homeschool.id));
            if (homeschoolDoc.exists()) {
              const updatedHomeschool = { ...homeschoolDoc.data(), id: homeschoolDoc.id } as Homeschool;
              setHomeschool(updatedHomeschool);
              await refreshStudents(updatedHomeschool.studentIds);
            }
            setShowStudentForm(false);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {showActivityForm && homeschool && (
        <ActivityForm
          homeschoolId={homeschool.id}
          activities={activities}
          onClose={() => {
            setShowActivityForm(false);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
          onActivityAdded={async () => {
            // Refresh activities list
            const activitiesQuery = query(collection(db, 'activities'), where('homeschoolId', '==', homeschool.id));
            const activitiesSnapshot = await getDocs(activitiesQuery);
            const activitiesList = activitiesSnapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id
            } as Activity)).sort((a, b) => a.name.localeCompare(b.name));
            setActivities(activitiesList);
            setShowActivityForm(false);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {showGoalForm && homeschool && (
        <GoalForm
          activities={activities}
          students={students}
          userId={user.uid}
          homeschoolId={homeschool.id}
          onClose={() => {
            setShowGoalForm(false);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
          onGoalAdded={async () => {
            // Refresh goals list
            const goalsQuery = query(collection(db, 'goals'), where('homeschoolId', '==', homeschool.id));
            const goalsSnapshot = await getDocs(goalsQuery);
            const goalsList = goalsSnapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id
            } as Goal));
            setGoals(goalsList);
            setShowGoalForm(false);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {showActivityInstanceForm && (
        <ActivityInstanceForm
          goals={goals}
          activities={activities}
          students={students}
          userId={user.uid}
          homeschoolId={homeschool?.id ?? ''}
          preSelectedGoal={preSelectedGoal}
          preSelectedStudent={preSelectedStudent}
          existingInstance={editingActivityInstance || undefined}
          timezone={dashboardSettings.timezone}
          timerAlarmEnabled={timerAlarmEnabled}
          allowMultipleRecordsPerDay={homeschool?.allowMultipleRecordsPerDay || false}
          onClose={() => {
            setShowActivityInstanceForm(false);
            setPreSelectedGoal('');
            setPreSelectedStudent('');
            setEditingActivityInstance(null);
            if (returnToReports) {
              setReturnToReports(false);
              setShowReports(true);
            }
          }}
          onActivityRecorded={() => {
            // Refresh today's instances
            fetchTodayInstances();
            fetchWeekInstances();
            setShowActivityInstanceForm(false);
            setPreSelectedGoal('');
            setPreSelectedStudent('');
            setEditingActivityInstance(null);
            if (returnToReports) {
              setReturnToReports(false);
              setShowReports(true);
            }
          }}
        />
      )}

      {showAdHocTaskForm && homeschool && (
        <AdHocTaskForm
          homeschoolId={homeschool.id}
          students={students}
          userId={user.uid}
          timezone={dashboardSettings.timezone}
          mode={adHocTaskMode}
          preSelectedStudent={adHocTaskStudent || undefined}
          existingTask={editingAdHocTask || undefined}
          onClose={() => {
            setShowAdHocTaskForm(false);
            setAdHocTaskStudent('');
            setEditingAdHocTask(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
          onTaskAdded={async () => {
            // Refresh ad-hoc tasks
            const adHocTasksQuery = query(collection(db, 'adHocTasks'), where('homeschoolId', '==', homeschool.id));
            const adHocTasksSnapshot = await getDocs(adHocTasksQuery);
            const adHocTasksList = adHocTasksSnapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id
            } as AdHocTask));
            setAdHocTasks(adHocTasksList);
            setShowAdHocTaskForm(false);
            setEditingAdHocTask(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {showReports && homeschool && (
        <Reports
          homeschoolId={homeschool.id}
          homeschoolName={homeschool.name}
          goals={goals}
          activities={activities}
          students={students}
          adHocTasks={adHocTasks}
          schoolYearStartMonth={homeschool.schoolYearStartMonth || 8}
          schoolYearStartDay={homeschool.schoolYearStartDay || 1}
          onClose={() => setShowReports(false)}
          onEditActivity={(instance) => {
            setEditingActivityInstance(instance);
            setPreSelectedGoal(instance.goalId);
            setPreSelectedStudent(instance.studentId);
            setReturnToReports(true);
            setShowReports(false);
            setShowActivityInstanceForm(true);
          }}
        />
      )}

      {editingHomeschool && (
        <HomeschoolEdit
          homeschool={editingHomeschool}
          onClose={() => setEditingHomeschool(null)}
          onUpdate={(updatedHomeschool) => {
            setHomeschool(updatedHomeschool);
            setEditingHomeschool(null);
          }}
        />
      )}

      {editingStudent && (
        <StudentEdit
          student={editingStudent}
          homeschool={homeschool}
          inviterName={user.displayName || user.email || 'Parent'}
          onClose={() => {
            setEditingStudent(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
          onUpdate={(updatedStudent) => {
            setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
            setEditingStudent(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {editingActivity && (
        <ActivityEdit
          activity={editingActivity}
          onClose={() => {
            setEditingActivity(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
          onUpdate={(updatedActivity) => {
            setActivities(activities.map(a => a.id === updatedActivity.id ? updatedActivity : a));
            setEditingActivity(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {editingGoal && (
        <GoalEdit
          goal={editingGoal.goal}
          activity={editingGoal.activity}
          students={editingGoal.students}
          onClose={() => {
            setEditingGoal(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
          onUpdate={(updatedGoal) => {
            setGoals(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
            setEditingGoal(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {showInvite && homeschool && (
        <InviteUser
          homeschool={homeschool}
          currentUserName={user.displayName || user.email || 'A HomeschoolDone user'}
          onClose={() => setShowInvite(false)}
          onInviteSent={(updatedHomeschool) => {
            setHomeschool(updatedHomeschool);
          }}
        />
      )}

      {showDeleteHomeschool && homeschool && (
        <HomeschoolDelete
          homeschool={homeschool}
          onClose={() => setShowDeleteHomeschool(false)}
          onDeleted={() => {
            // Redirect to create new homeschool or reload page
            setHomeschool(null);
            setShowDeleteHomeschool(false);
          }}
        />
      )}

      {showAuthorizedUsers && homeschool && (
        <AuthorizedUsers
          homeschool={homeschool}
          currentUserId={user.uid}
          currentUserInfo={{ name: user.displayName || undefined, email: user.email || undefined }}
          currentUserRole={userRole || 'observer'}
          onClose={() => setShowAuthorizedUsers(false)}
          onUpdate={(updatedHomeschool) => {
            setHomeschool(updatedHomeschool);
          }}
        />
      )}

      {deleteConfirmation && (
        <DeleteConfirmation
          entityType={deleteConfirmation.type}
          entityName={deleteConfirmation.name}
          onConfirm={handleDelete}
          onCancel={() => {
            setDeleteConfirmation(null);
            if (returnToSettings) {
              setReturnToSettings(false);
              setShowSettings(true);
            }
          }}
        />
      )}

      {showDashboard && homeschool && (
        <DashboardView
          homeschool={homeschool}
          students={students}
          goals={goals}
          activities={activities}
          cycleSeconds={dashboardSettings.cycleSeconds}
          startOfWeek={dashboardSettings.startOfWeek}
          timezone={dashboardSettings.timezone}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {showSettings && homeschool && (
        <SettingsModal
          homeschool={homeschool}
          students={students}
          activities={activities}
          goals={goals}
          userRole={userRole}
          currentUserId={user.uid}
          currentUserInfo={{ name: user.displayName || undefined, email: user.email || undefined }}
          dashboardSettings={dashboardSettings}
          timerAlarmEnabled={timerAlarmEnabled}
          publicDashboardId={publicDashboardId}
          allowMultipleRecordsPerDay={homeschool.allowMultipleRecordsPerDay || false}
          studentSortOrder={homeschool.studentSortOrder || 'age-asc'}
          schoolYearStartMonth={homeschool.schoolYearStartMonth || 8}
          schoolYearStartDay={homeschool.schoolYearStartDay || 1}
          adHocTasks={adHocTasks}
          activeTab={settingsActiveTab}
          onTabChange={setSettingsActiveTab}
          onSaveSettings={saveDashboardSettings}
          onSaveTimerAlarm={saveTimerAlarmSetting}
          onSavePublicDashboard={savePublicDashboardSetting}
          onSaveMultipleRecords={saveMultipleRecordsSetting}
          onSaveStudentSortOrder={saveStudentSortOrder}
          onSaveSchoolYearStart={saveSchoolYearStart}
          onEditTask={(task) => {
            setSettingsActiveTab('tasks');
            setReturnToSettings(true);
            setShowSettings(false);
            setEditingAdHocTask(task);
            setAdHocTaskMode('assign');
            setShowAdHocTaskForm(true);
          }}
          onDeleteTask={async (taskId) => {
            try {
              await deleteDoc(doc(db, 'adHocTasks', taskId));
              const adHocTasksQuery = query(collection(db, 'adHocTasks'), where('homeschoolId', '==', homeschool.id));
              const adHocTasksSnapshot = await getDocs(adHocTasksQuery);
              setAdHocTasks(adHocTasksSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as AdHocTask)));
            } catch (error) {
              console.error('Error deleting task:', error);
            }
          }}
          onTasksUpdated={async () => {
            const adHocTasksQuery = query(collection(db, 'adHocTasks'), where('homeschoolId', '==', homeschool.id));
            const adHocTasksSnapshot = await getDocs(adHocTasksQuery);
            setAdHocTasks(adHocTasksSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as AdHocTask)));
          }}
          onShowStudentForm={() => {
            setSettingsActiveTab('students');
            setReturnToSettings(true);
            setShowStudentForm(true);
          }}
          onShowActivityForm={() => {
            setSettingsActiveTab('activities');
            setReturnToSettings(true);
            setShowActivityForm(true);
          }}
          onShowGoalForm={() => {
            setSettingsActiveTab('activities');
            setReturnToSettings(true);
            setShowGoalForm(true);
          }}
          onShowInvite={() => {
            setSettingsActiveTab('users');
            setReturnToSettings(true);
            setShowInvite(true);
          }}
          onShowAuthorizedUsers={() => {
            setSettingsActiveTab('users');
            setReturnToSettings(true);
            setShowAuthorizedUsers(true);
          }}
          onEditHomeschool={() => {
            setSettingsActiveTab('general');
            setReturnToSettings(true);
            setEditingHomeschool(homeschool);
          }}
          onDeleteHomeschool={() => {
            setSettingsActiveTab('general');
            setReturnToSettings(true);
            setShowDeleteHomeschool(true);
          }}
          onEditStudent={(student) => {
            setSettingsActiveTab('students');
            setReturnToSettings(true);
            setShowSettings(false);
            setEditingStudent(student);
          }}
          onEditActivity={(activity) => {
            setSettingsActiveTab('activities');
            setReturnToSettings(true);
            setShowSettings(false);
            setEditingActivity(activity);
          }}
          onEditGoal={(goal, activity, students) => {
            setSettingsActiveTab('activities');
            setReturnToSettings(true);
            setShowSettings(false);
            setEditingGoal({ goal, activity, students });
          }}
          onDeleteConfirmation={(type, id, name) => {
            if (type === 'student') setSettingsActiveTab('students');
            else if (type === 'activity' || type === 'goal') setSettingsActiveTab('activities');
            setReturnToSettings(true);
            setShowSettings(false);
            setDeleteConfirmation({ type, id, name });
          }}
          onClose={() => setShowSettings(false)}
          onHomeschoolUpdate={refreshHomeschoolData}
        />
      )}
    </div>
  );
};

export default Dashboard;
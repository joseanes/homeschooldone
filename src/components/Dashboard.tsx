import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc, updateDoc, arrayRemove, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Activity, Goal, ActivityInstance } from '../types';
import { isGoalActiveForStudent } from '../utils/goalUtils';
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
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'dashboard' | 'timer' | 'students' | 'activities' | 'users'>('general');
  const [dashboardSettings, setDashboardSettings] = useState({
    cycleSeconds: 10,
    startOfWeek: 1, // 1 = Monday
    timezone: 'America/New_York' // EST/EDT
  });
  const [timerAlarmEnabled, setTimerAlarmEnabled] = useState(false);
  const [publicDashboardId, setPublicDashboardId] = useState<string | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Person | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

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
      console.log('Dashboard: Saving publicDashboardId:', dashboardId, 'to homeschool:', homeschool.id);
      const updates: any = {};
      if (dashboardId) {
        updates.publicDashboardId = dashboardId;
      } else {
        updates.publicDashboardId = null;
      }
      
      console.log('Dashboard: About to update Firestore document with:', updates);
      await updateDoc(doc(db, 'homeschools', homeschool.id), updates);
      console.log('Dashboard: Successfully updated Firestore document');
      setPublicDashboardId(dashboardId);
      console.log('Dashboard: Set local state publicDashboardId to:', dashboardId);
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

  useEffect(() => {
    // Check for pending invitations and activate them
    const activateInvitations = async () => {
      if (!user.email) {
        console.log('No user email found for invitation activation');
        return;
      }
      
      console.log(`Checking for pending invitations for ${user.email}`);
      
      try {
        // Find homeschools where user's email is in invitation arrays
        const allHomeschoolsQuery = query(collection(db, 'homeschools'));
        const homeschoolsSnapshot = await getDocs(allHomeschoolsQuery);
        
        console.log(`Found ${homeschoolsSnapshot.docs.length} homeschools to check`);
        
        for (const homeschoolDoc of homeschoolsSnapshot.docs) {
          const homeschoolData = homeschoolDoc.data() as Homeschool;
          const homeschoolId = homeschoolDoc.id;
          let needsUpdate = false;
          const updates: any = {};
          
          console.log(`Checking homeschool ${homeschoolId}:`, {
            parentEmails: homeschoolData.parentEmails,
            tutorEmails: homeschoolData.tutorEmails,
            observerEmails: homeschoolData.observerEmails
          });
          
          // Check each role type
          if (homeschoolData.parentEmails?.includes(user.email)) {
            console.log(`Found ${user.email} in parentEmails, activating as parent`);
            updates.parentEmails = arrayRemove(user.email);
            updates.parentIds = arrayUnion(user.uid);
            needsUpdate = true;
          }
          
          if (homeschoolData.tutorEmails?.includes(user.email)) {
            console.log(`Found ${user.email} in tutorEmails, activating as tutor`);
            updates.tutorEmails = arrayRemove(user.email);
            updates.tutorIds = arrayUnion(user.uid);
            needsUpdate = true;
          }
          
          if (homeschoolData.observerEmails?.includes(user.email)) {
            console.log(`Found ${user.email} in observerEmails, activating as observer`);
            updates.observerEmails = arrayRemove(user.email);
            updates.observerIds = arrayUnion(user.uid);
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            console.log(`Updating homeschool ${homeschoolId} with:`, updates);
            await updateDoc(doc(db, 'homeschools', homeschoolId), updates);
            console.log(`Successfully activated invitation for ${user.email} in homeschool ${homeschoolId}`);
          }
        }
        
        if (!homeschoolsSnapshot.docs.some(doc => {
          const data = doc.data() as Homeschool;
          return (user.email && data.parentEmails?.includes(user.email)) || 
                 (user.email && data.tutorEmails?.includes(user.email)) || 
                 (user.email && data.observerEmails?.includes(user.email));
        })) {
          console.log(`No pending invitations found for ${user.email}`);
        }
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
        console.log(`Searching for homeschools for user ${user.uid} (${user.email})`);
        
        const queries = [
          { query: query(collection(db, 'homeschools'), where('parentIds', 'array-contains', user.uid)), role: 'parent' },
          { query: query(collection(db, 'homeschools'), where('tutorIds', 'array-contains', user.uid)), role: 'tutor' },
          { query: query(collection(db, 'homeschools'), where('observerIds', 'array-contains', user.uid)), role: 'observer' }
        ];
        
        let homeschoolData = null;
        let userRole = null;
        
        // First check if user is a student by looking in people collection
        console.log('Checking if user is a student...');
        console.log('User email:', user.email);
        
        // Debug: Check all people in collection to see if email matches
        console.log('=== DEBUGGING: Checking all people records ===');
        const allPeopleQuery = query(collection(db, 'people'));
        const allPeopleSnapshot = await getDocs(allPeopleQuery);
        console.log(`Total people in database: ${allPeopleSnapshot.docs.length}`);
        allPeopleSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`Person ${doc.id}: email="${data.email}", role="${data.role}", name="${data.name}"`);
          if (data.email === user.email) {
            console.log('*** MATCH FOUND ***');
          }
        });
        console.log('=== END DEBUG ===');
        
        const studentQuery = query(collection(db, 'people'), where('email', '==', user.email || ''));
        const studentSnapshot = await getDocs(studentQuery);
        
        console.log(`Found ${studentSnapshot.docs.length} people with email ${user.email}`);
        
        if (!studentSnapshot.empty) {
          // If multiple records exist, prioritize student role
          let studentRecord: { data: any; id: string } | null = null;
          for (const doc of studentSnapshot.docs) {
            const data = doc.data();
            console.log('Checking record:', doc.id, 'role:', data.role, 'name:', data.name);
            if (data.role === 'student') {
              studentRecord = { data, id: doc.id };
              console.log('Found student role record:', doc.id);
              break;
            }
          }
          
          // If no student role found, use first record
          if (!studentRecord) {
            studentRecord = { data: studentSnapshot.docs[0].data(), id: studentSnapshot.docs[0].id };
            console.log('No student role found, using first record:', studentRecord.id);
          }
          
          if (studentRecord) {
            const studentData = studentRecord.data;
            console.log('Using record:', studentRecord.id, 'with role:', studentData.role);
            
            if (studentData.role === 'student') {
              console.log(`User is a student: ${studentRecord.id}`);
              // Find homeschool that contains this student
              const homeschoolQuery = query(collection(db, 'homeschools'), where('studentIds', 'array-contains', studentRecord.id));
              const homeschoolSnapshot = await getDocs(homeschoolQuery);
              
              console.log(`Found ${homeschoolSnapshot.docs.length} homeschools containing student ${studentRecord.id}`);
              
              // Debug: Check all homeschools to see student assignments
              console.log('=== DEBUGGING: Checking all homeschool student assignments ===');
              const allHomeschoolsQuery = query(collection(db, 'homeschools'));
              const allHomeschoolsSnapshot = await getDocs(allHomeschoolsQuery);
              allHomeschoolsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                console.log(`Homeschool ${doc.id} (${data.name}): studentIds=`, data.studentIds);
                if (data.studentIds && studentRecord && data.studentIds.includes(studentRecord.id)) {
                  console.log(`*** STUDENT IS ASSIGNED TO THIS HOMESCHOOL ***`);
                }
              });
              console.log('=== END HOMESCHOOL DEBUG ===');
              
              if (!homeschoolSnapshot.empty) {
                const data = homeschoolSnapshot.docs[0].data() as Homeschool;
                homeschoolData = { ...data, id: homeschoolSnapshot.docs[0].id };
                userRole = 'student';
                console.log(`Found homeschool access as student: ${homeschoolData.id}`);
                console.log('Homeschool data:', homeschoolData);
                
                // Set the current student info
                setCurrentStudent({ ...studentData, id: studentRecord.id } as Person);
              } else {
                console.log('No homeschool found containing this student ID');
              }
            } else {
              console.log(`User role is not student, it is: ${studentData.role}`);
            }
          }
        } else {
          console.log('No student found with this email in people collection');
        }
        
        // If not a student, check parent/tutor/observer roles
        if (!homeschoolData) {
          for (const { query: q, role } of queries) {
            console.log(`Checking ${role} access...`);
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const data = querySnapshot.docs[0].data() as Homeschool;
              homeschoolData = { ...data, id: querySnapshot.docs[0].id };
              userRole = role;
              console.log(`Found homeschool access as ${role}: ${homeschoolData.id}`);
              break;
            }
          }
        }
        
        if (!homeschoolData) {
          console.log('No homeschool access found for user');
        }
        
        // Check if we have a saved homeschool preference
        const savedHomeschoolId = localStorage.getItem('selectedHomeschoolId');
        
        // If not a student, check parent/tutor/observer roles and look for all homeschools
        if (!homeschoolData) {
          const allHomeschools: Array<{ data: Homeschool; role: string }> = [];
          
          for (const { query: q, role } of queries) {
            console.log(`Checking ${role} access...`);
            const querySnapshot = await getDocs(q);
            querySnapshot.docs.forEach(doc => {
              const data = doc.data() as Homeschool;
              allHomeschools.push({ data: { ...data, id: doc.id }, role });
              console.log(`Found homeschool access as ${role}: ${doc.id} (${data.name})`);
            });
          }
          
          if (allHomeschools.length > 0) {
            // If we have a saved preference and it's in the list, use it
            if (savedHomeschoolId) {
              const savedHomeschool = allHomeschools.find(h => h.data.id === savedHomeschoolId);
              if (savedHomeschool) {
                homeschoolData = savedHomeschool.data;
                userRole = savedHomeschool.role;
                console.log(`Using saved homeschool preference: ${homeschoolData.id}`);
              }
            }
            
            // Otherwise use the first one
            if (!homeschoolData) {
              homeschoolData = allHomeschools[0].data;
              userRole = allHomeschools[0].role;
              console.log(`Using first available homeschool: ${homeschoolData.id}`);
            }
          }
        }
        
        if (!homeschoolData) {
          console.log('No homeschool access found for user');
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
      const goalIds = goals.map(g => g.id);
      if (goalIds.length === 0) {
        setTodayInstances([]);
        return;
      }

      const q = query(
        collection(db, 'activityInstances'),
        where('goalId', 'in', goalIds)
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
      

      // First get all goal IDs for this homeschool
      const goalsSnapshot = await getDocs(
        query(collection(db, 'goals'), where('homeschoolId', '==', homeschool.id))
      );
      const homeschoolGoalIds = goalsSnapshot.docs.map(doc => doc.id);
      
      if (homeschoolGoalIds.length === 0) {
        setWeekInstances([]);
        return;
      }
      
      // Query activity instances for these goals (handle 'in' query limitation of 10 items)
      let allInstances: ActivityInstance[] = [];
      
      // Split goal IDs into chunks of 10 (Firestore 'in' query limit)
      const chunkSize = 10;
      for (let i = 0; i < homeschoolGoalIds.length; i += chunkSize) {
        const chunk = homeschoolGoalIds.slice(i, i + chunkSize);
        const instancesQuery = query(
          collection(db, 'activityInstances'),
          where('goalId', 'in', chunk)
        );
        
        const querySnapshot = await getDocs(instancesQuery);
        const chunkInstances = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
        } as ActivityInstance));
        
        allInstances = [...allInstances, ...chunkInstances];
      }
      
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

  const getGoalStatus = (goal: Goal, studentId: string) => {
    const progress = getGoalProgress(goal.id, studentId);
    
    // Count instances this week for this student and goal
    const weeklyCount = weekInstances.filter(i => 
      i.goalId === goal.id && 
      i.studentId === studentId
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
    if (progress.today > 0) {
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
        // Delete student document
        await deleteDoc(doc(db, 'people', id));
        
        // Remove student ID from homeschool
        await updateDoc(doc(db, 'homeschools', homeschool.id), {
          studentIds: arrayRemove(id)
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
    console.log('Creating homeschool with name:', homeschoolName);
    
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
      console.log('Attempting to create document:', newHomeschool);

      console.log('About to call addDoc...');
      const docRef = await addDoc(collection(db, 'homeschools'), newHomeschool);
      console.log('Document created with ID:', docRef.id);
      
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
        <div style={{ fontSize: '14px', color: '#666' }}>
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
        <p style={{ color: '#666', maxWidth: '500px' }}>
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
        <div style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
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
                  border: '1px solid #ccc',
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
                backgroundColor: '#666',
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
    console.log('Dashboard: Rendering StudentDashboard for:', currentStudent.name, 'in homeschool:', homeschool.name);
    return (
      <StudentDashboard
        student={currentStudent}
        homeschool={homeschool}
        onSignOut={onSignOut}
      />
    );
  }

  // Debug logging for student access issues
  if (userRole === 'student') {
    console.log('Dashboard: Student role detected but missing data:');
    console.log('- currentStudent:', currentStudent);
    console.log('- homeschool:', homeschool);
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <svg width="60" height="60" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 43L40 19L66 43V67C66 70.3137 63.3137 73 60 73H20C16.6863 73 14 70.3137 14 67V43Z" fill="#F59E0B"/>
            <path d="M8 45L40 15L72 45" stroke="#D97706" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="40" cy="53" r="16" fill="white"/>
            <path d="M32 53L38 59L50 47" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#333' }}>{homeschool.name}</h1>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowHomeschoolSwitcher(!showHomeschoolSwitcher)}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #ddd',
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
          gap: '12px',
          marginTop: '10px',
          justifyContent: 'flex-start'
        }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '12px 20px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              flex: '1 1 150px',
              minWidth: '150px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => setShowReports(true)}
            style={{
              padding: '12px 20px',
              fontSize: '16px',
              backgroundColor: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              flex: '1 1 150px',
              minWidth: '150px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            📊 Reports
          </button>
          <button
            onClick={() => setShowDashboard(true)}
            style={{
              padding: '12px 20px',
              fontSize: '16px',
              backgroundColor: '#ff5722',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              flex: '1 1 150px',
              minWidth: '150px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            📺 Dashboard
          </button>
        </div>
      </div>
      
      {/* Main Activity Recording Section */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '30px',
        borderRadius: '12px',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <button 
          onClick={() => setShowActivityInstanceForm(true)}
          disabled={goals.length === 0}
          style={{
            padding: '16px 40px',
            fontSize: '20px',
            backgroundColor: goals.length === 0 ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: goals.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'transform 0.2s ease',
            boxShadow: goals.length === 0 ? 'none' : '0 4px 8px rgba(40,167,69,0.2)',
            minWidth: '240px'
          }}
          onMouseEnter={(e) => { if (goals.length > 0) e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { if (goals.length > 0) e.currentTarget.style.transform = 'translateY(0)' }}
        >
          🎯 Record Activity
        </button>
        {goals.length === 0 && (
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
Set up students, activities and goals first using the "Settings" menu
          </p>
        )}
      </div>

      {/* Today's Progress Overview - Grouped by Student */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '25px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Today's Progress</h3>
        {goals.length === 0 ? (
          <p style={{ color: '#666' }}>No goals assigned yet</p>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {[...students].sort((a, b) => {
              // Sort by age (ascending) - younger students first
              if (a.dateOfBirth && b.dateOfBirth) {
                const ageA = new Date(a.dateOfBirth);
                const ageB = new Date(b.dateOfBirth);
                return ageB.getTime() - ageA.getTime(); // More recent dateOfBirth = younger = comes first
              }
              // If no dateOfBirth, fall back to name sorting
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
              
              // Sort goals: gray (pending) first, then yellow (progress week), then blue (done today), then green (weekly complete)
              // Within each status group, sort alphabetically by goal name or activity name
              const sortedGoals = [...studentGoals].sort((a, b) => {
                const statusA = getGoalStatus(a, student.id);
                const statusB = getGoalStatus(b, student.id);
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
              });
              
              return (
                <div key={student.id} style={{
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  padding: '20px',
                  backgroundColor: allCompleted ? '#f0f8f0' : '#fff8f0',
                  borderColor: allCompleted ? '#4caf50' : '#ff9800'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px'
                  }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '18px',
                      color: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      {student.name}
                      {allCompleted && <span style={{ fontSize: '20px' }}>🎉</span>}
                    </h4>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      backgroundColor: allCompleted ? '#4caf50' : '#ff9800',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      {completedGoals}/{totalGoals} Weekly Goals Complete
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {sortedGoals.map(goal => {
                      const activity = activities.find(a => a.id === goal.activityId);
                      const progress = getGoalProgress(goal.id, student.id);
                      const status = getGoalStatus(goal, student.id);
                      
                      // Calculate weekly count for this goal and student
                      const weeklyCount = weekInstances.filter(i => 
                        i.goalId === goal.id && 
                        i.studentId === student.id
                      ).length;
                      
                      
                      if (!activity) return null;
                      
                      return (
                        <div 
                          key={goal.id} 
                          onClick={() => handleOpenRecordActivity(goal.id, student.id)}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            backgroundColor: status.backgroundColor,
                            color: status.textColor,
                            borderRadius: '6px',
                            border: `1px solid ${status.color}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title={
                            status.status === 'weekly-complete' 
                              ? 'Weekly goal met - Click to add more' 
                              : status.status === 'done-today'
                              ? 'Done today - Click to add more'
                              : status.status === 'progress-week'
                              ? 'Progress made this week - Click to continue today'
                              : 'Click to record this activity'
                          }
                        >
                          <div>
                            <span style={{ fontWeight: '500' }}>{goal.name || activity.name}</span>
                            {goal.timesPerWeek && (
                              <span style={{ color: status.textColor, opacity: 0.7, fontSize: '13px', marginLeft: '8px' }}>
                                ({weeklyCount} of {goal.timesPerWeek}/week)
                              </span>
                            )}
                            {(() => {
                              const latestProgress = getLatestProgress(goal.id, student.id);
                              const indicators = [];
                              
                              // Show percentage progress if activity tracks it and goal has percentage goal or daily increase
                              if (activity.progressReportingStyle?.percentageCompletion && (goal.percentageGoal || goal.dailyPercentageIncrease) && latestProgress?.percentageCompleted !== undefined) {
                                indicators.push(
                                  <span key="percent" style={{ color: status.textColor, opacity: 0.7, fontSize: '13px', marginLeft: '8px' }}>
                                    ({latestProgress.percentageCompleted.toFixed(0)}% of {goal.percentageGoal || 100}%)
                                  </span>
                                );
                              }
                              
                              // Show custom metric progress if activity tracks it and goal has target
                              if (activity.progressReportingStyle?.progressCount && goal.progressCount && latestProgress?.countCompleted !== undefined) {
                                indicators.push(
                                  <span key="count" style={{ color: status.textColor, opacity: 0.7, fontSize: '13px', marginLeft: '8px' }}>
                                    ({latestProgress.countCompleted} of {goal.progressCount} {activity.progressCountName || 'items'})
                                  </span>
                                );
                              }
                              
                              return indicators;
                            })()}
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: status.textColor
                          }}>
                            {status.text}
                            {progress.today > 1 && <span style={{ marginLeft: '6px' }}>({progress.today}x)</span>}
                          </div>
                        </div>
                      );
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

      {showReports && homeschool && (
        <Reports
          homeschoolId={homeschool.id}
          goals={goals}
          activities={activities}
          students={students}
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
          activeTab={settingsActiveTab}
          onTabChange={setSettingsActiveTab}
          onSaveSettings={saveDashboardSettings}
          onSaveTimerAlarm={saveTimerAlarmSetting}
          onSavePublicDashboard={savePublicDashboardSetting}
          onSaveMultipleRecords={saveMultipleRecordsSetting}
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
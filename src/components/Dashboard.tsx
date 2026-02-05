import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Activity, Goal, ActivityInstance } from '../types';
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
import { formatLastActivity } from '../utils/activityTracking';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
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
  const [showManagement, setShowManagement] = useState(false);
  const [todayInstances, setTodayInstances] = useState<ActivityInstance[]>([]);
  const [weekInstances, setWeekInstances] = useState<ActivityInstance[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showHomeschoolSwitcher, setShowHomeschoolSwitcher] = useState(false);
  const [showDeleteHomeschool, setShowDeleteHomeschool] = useState(false);
  const [showAuthorizedUsers, setShowAuthorizedUsers] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState({
    cycleSeconds: 10,
    startOfWeek: 1, // 1 = Monday
    timezone: 'America/New_York' // EST/EDT
  });

  // Load dashboard settings from homeschool document
  useEffect(() => {
    if (homeschool?.dashboardSettings) {
      setDashboardSettings(homeschool.dashboardSettings);
    }
  }, [homeschool]);

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
        for (const { query: q, role } of queries) {
          console.log(`Checking ${role} access...`);
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data() as Homeschool;
            homeschoolData = { ...data, id: querySnapshot.docs[0].id };
            console.log(`Found homeschool access as ${role}: ${homeschoolData.id}`);
            break;
          }
        }
        
        if (!homeschoolData) {
          console.log('No homeschool access found for user');
        }
        
        if (homeschoolData) {
          setHomeschool(homeschoolData);
          
          // Fetch students
          if (homeschoolData.studentIds && homeschoolData.studentIds.length > 0) {
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
          } as Activity));
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
      const startOfWeekDay = dashboardSettings.startOfWeek || 1; // Default Monday
      
      // Calculate days to subtract to get to start of week
      const daysFromStartOfWeek = (dayOfWeek - startOfWeekDay + 7) % 7;
      startOfWeek.setDate(today.getDate() - daysFromStartOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const instancesQuery = query(
        collection(db, 'activityInstances'),
        where('date', '>=', startOfWeek),
        where('date', '<=', endOfWeek)
      );
      
      const querySnapshot = await getDocs(instancesQuery);
      const instances = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
      } as ActivityInstance));

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

  const getGoalStatus = (goal: Goal, studentId: string) => {
    const progress = getGoalProgress(goal.id, studentId);
    
    // Check if today's work actually meets the goal requirements
    if (progress.today > 0) {
      // Get today's instances for this goal and student
      const todayInstancesForGoal = todayInstances.filter(i => 
        i.goalId === goal.id && i.studentId === studentId
      );
      
      // If goal has minutes requirement, check if total minutes meet requirement
      if (goal.minutesPerSession) {
        const totalMinutesToday = todayInstancesForGoal.reduce((sum, instance) => 
          sum + (instance.duration || 0), 0
        );
        
        if (totalMinutesToday >= goal.minutesPerSession) {
          return { status: 'completed-today', color: '#4caf50', textColor: 'white' };
        }
        // Has activity but not enough minutes - show as pending
        return { status: 'pending', color: '#f5f5f5', textColor: '#333' };
      }
      
      // For non-time based goals, any activity counts as complete
      return { status: 'completed-today', color: '#4caf50', textColor: 'white' };
    }
    
    // If goal has weekly requirements, check if weekly goal is met
    if (goal.timesPerWeek && goal.timesPerWeek > 0) {
      // Count instances this week for this student and goal
      const weeklyCount = weekInstances.filter(i => 
        i.goalId === goal.id && 
        i.studentId === studentId
      ).length;
      
      // If weekly requirement is met but not done today, it's gray
      if (weeklyCount >= goal.timesPerWeek) {
        return { status: 'weekly-complete', color: '#9e9e9e', textColor: 'white' };
      }
    }
    
    // Default: not completed, needs work
    return { status: 'pending', color: '#f5f5f5', textColor: '#333' };
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

  if (loading) return <div>Loading...</div>;

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
                  onHomeschoolChange={(newHomeschool) => {
                    setHomeschool(newHomeschool);
                    setShowHomeschoolSwitcher(false);
                    // Reset all data when switching homeschool
                    setStudents([]);
                    setActivities([]);
                    setGoals([]);
                    setTodayInstances([]);
                    // Trigger data refresh for new homeschool
                    window.location.reload();
                  }}
                  onClose={() => setShowHomeschoolSwitcher(false)}
                />
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowManagement(!showManagement)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: showManagement ? '#666' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
{showManagement ? 'Close Settings' : 'Settings'}
          </button>
          <button
            onClick={() => setShowReports(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reports
          </button>
          <button
            onClick={() => setShowDashboard(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#ff5722',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
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
        <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Record Today's Activities</h2>
        <button 
          onClick={() => setShowActivityInstanceForm(true)}
          disabled={goals.length === 0}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: goals.length === 0 ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: goals.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
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
            {students.map(student => {
              const studentGoals = goals.filter(g => g.studentIds?.includes(student.id));
              if (studentGoals.length === 0) return null;
              
              const completedGoals = studentGoals.filter(goal => getGoalProgress(goal.id, student.id).today > 0).length;
              const totalGoals = studentGoals.length;
              const allCompleted = completedGoals === totalGoals;
              
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
                      {completedGoals}/{totalGoals} Complete
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {studentGoals.map(goal => {
                      const activity = activities.find(a => a.id === goal.activityId);
                      const progress = getGoalProgress(goal.id, student.id);
                      const status = getGoalStatus(goal, student.id);
                      
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
                            backgroundColor: status.color,
                            color: status.textColor,
                            borderRadius: '6px',
                            border: `1px solid ${status.color}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title={
                            status.status === 'completed-today' 
                              ? 'Completed today - Click to edit' 
                              : status.status === 'weekly-complete'
                              ? 'Weekly goal met - Click to record today\'s session'
                              : 'Click to record this activity'
                          }
                        >
                          <div>
                            <span style={{ fontWeight: '500' }}>{activity.name}</span>
                            {goal.timesPerWeek && (
                              <span style={{ color: status.textColor, opacity: 0.7, fontSize: '13px', marginLeft: '8px' }}>
                                ({goal.timesPerWeek}x/week)
                              </span>
                            )}
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: status.textColor
                          }}>
                            {status.status === 'completed-today' ? '✅ Done Today' : 
                             status.status === 'weekly-complete' ? '📅 Week Complete' : 
                             '⏳ Pending'}
                            {progress.today > 1 && <span style={{ marginLeft: '6px' }}>({progress.today}x)</span>}
                            {goal.minutesPerSession && progress.today > 0 && status.status !== 'completed-today' && (
                              <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.8 }}>
                                {todayInstances.filter(i => i.goalId === goal.id && i.studentId === student.id)
                                  .reduce((sum, i) => sum + (i.duration || 0), 0)}/{goal.minutesPerSession}min
                              </span>
                            )}
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

      {/* Management Panel - Collapsible */}
      {showManagement && (
        <div style={{ 
          padding: '20px',
          backgroundColor: '#f1f3f4',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<h3 style={{ margin: 0 }}>Settings</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setEditingHomeschool(homeschool)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Edit Homeschool Name
              </button>
              <button
                onClick={() => setShowInvite(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                👥 Invite
              </button>
              <button
                onClick={() => setShowAuthorizedUsers(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔐 Users
              </button>
              <button
                onClick={() => setShowDeleteHomeschool(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Delete Homeschool
              </button>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {/* Students Management */}
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: 'white'
            }}>
              <h4>Students</h4>
              {students.length === 0 ? (
                <p>No students yet</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {students.map((student) => (
                    <li key={student.id} style={{ 
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '14px'
                    }}>
                      <div>
                        <div>{student.name}</div>
                        {student.email && (
                          <div style={{ color: '#007bff', fontSize: '12px' }}>
                            📧 {student.email}
                          </div>
                        )}
                        {student.mobile && (
                          <div style={{ color: '#4caf50', fontSize: '12px' }}>
                            📱 {student.mobile}
                          </div>
                        )}
                        {student.dateOfBirth && (
                          <div style={{ color: '#666', fontSize: '12px' }}>
                            📅 {new Date(student.dateOfBirth.seconds ? student.dateOfBirth.seconds * 1000 : student.dateOfBirth).toLocaleDateString()}
                          </div>
                        )}
                        {student.lastActivity && (
                          <div style={{ color: '#999', fontSize: '11px', fontStyle: 'italic' }}>
                            Last active: {formatLastActivity(student.lastActivity)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => setEditingStudent(student)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmation({
                            type: 'student',
                            id: student.id,
                            name: student.name
                          })}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button 
                onClick={() => setShowStudentForm(true)}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Student
              </button>
            </div>

            {/* Activities & Goals Management */}
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: 'white'
            }}>
              <h4>Activities & Goals</h4>
              {activities.length === 0 ? (
                <p>No activities yet</p>
              ) : (
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                  {activities.map((activity) => {
                    const activityGoals = goals.filter(g => g.activityId === activity.id);
                    return (
                      <div key={activity.id} style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{activity.name}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {activity.subjectId}
                            </div>
                            {activityGoals.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                {activityGoals.map(goal => {
                                  const goalStudents = students.filter(s => goal.studentIds?.includes(s.id));
                                  return (
                                    <div key={goal.id} style={{ 
                                      fontSize: '11px', 
                                      marginLeft: '12px',
                                      marginBottom: '4px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <div>
                                        • {goalStudents.map(s => s.name).join(', ') || 'Unknown students'}
                                        {goal.timesPerWeek && ` - ${goal.timesPerWeek}x/week`}
                                      </div>
                                      <div style={{ display: 'flex', gap: '3px' }}>
                                        <button
                                          onClick={() => goalStudents.length > 0 && setEditingGoal({ goal, activity, students: goalStudents })}
                                          style={{
                                            padding: '2px 6px',
                                            fontSize: '10px',
                                            backgroundColor: '#007bff',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => setDeleteConfirmation({
                                            type: 'goal',
                                            id: goal.id,
                                            name: `${goalStudents.map(s => s.name).join(', ')}'s ${activity.name} goal`
                                          })}
                                          style={{
                                            padding: '2px 6px',
                                            fontSize: '10px',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '5px', marginLeft: '8px' }}>
                            <button
                              onClick={() => setEditingActivity(activity)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation({
                                type: 'activity',
                                id: activity.id,
                                name: activity.name
                              })}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setShowActivityForm(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4285f4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Create Activity
                </button>
                {activities.length > 0 && students.length > 0 && (
                  <button 
                    onClick={() => setShowGoalForm(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Assign Goals
                  </button>
                )}
              </div>
            </div>

            {/* Dashboard Settings */}
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: 'white',
              marginTop: '20px'
            }}>
              <h4>📺 Dashboard Settings</h4>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 15px 0' }}>
                Configure the full-screen dashboard for display on TVs or monitors.
              </p>
              
              <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Cycle Time (seconds per student)
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="60"
                    value={dashboardSettings.cycleSeconds}
                    onChange={(e) => {
                      const newSettings = {
                        ...dashboardSettings,
                        cycleSeconds: parseInt(e.target.value) || 10
                      };
                      saveDashboardSettings(newSettings);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Start of Week
                  </label>
                  <select
                    value={dashboardSettings.startOfWeek}
                    onChange={(e) => {
                      const newSettings = {
                        ...dashboardSettings,
                        startOfWeek: parseInt(e.target.value)
                      };
                      saveDashboardSettings(newSettings);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Timezone
                  </label>
                  <select
                    value={dashboardSettings.timezone}
                    onChange={(e) => {
                      const newSettings = {
                        ...dashboardSettings,
                        timezone: e.target.value
                      };
                      saveDashboardSettings(newSettings);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="America/New_York">Eastern (EST/EDT)</option>
                    <option value="America/Chicago">Central (CST/CDT)</option>
                    <option value="America/Denver">Mountain (MST/MDT)</option>
                    <option value="America/Los_Angeles">Pacific (PST/PDT)</option>
                    <option value="America/Phoenix">Arizona (MST)</option>
                    <option value="America/Anchorage">Alaska (AKST/AKDT)</option>
                    <option value="Pacific/Honolulu">Hawaii (HST)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forms and Modals */}
      {showStudentForm && homeschool && (
        <StudentForm
          homeschoolId={homeschool.id}
          homeschool={homeschool}
          inviterName={user.displayName || user.email || 'Parent'}
          onClose={() => setShowStudentForm(false)}
          onStudentAdded={async () => {
            // Refresh the homeschool data to get updated studentIds
            const homeschoolDoc = await getDoc(doc(db, 'homeschools', homeschool.id));
            if (homeschoolDoc.exists()) {
              const updatedHomeschool = { ...homeschoolDoc.data(), id: homeschoolDoc.id } as Homeschool;
              setHomeschool(updatedHomeschool);
              await refreshStudents(updatedHomeschool.studentIds);
            }
          }}
        />
      )}

      {showActivityForm && homeschool && (
        <ActivityForm
          homeschoolId={homeschool.id}
          onClose={() => setShowActivityForm(false)}
          onActivityAdded={async () => {
            // Refresh activities list
            const activitiesQuery = query(collection(db, 'activities'), where('homeschoolId', '==', homeschool.id));
            const activitiesSnapshot = await getDocs(activitiesQuery);
            const activitiesList = activitiesSnapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id
            } as Activity));
            setActivities(activitiesList);
          }}
        />
      )}

      {showGoalForm && homeschool && (
        <GoalForm
          activities={activities}
          students={students}
          userId={user.uid}
          homeschoolId={homeschool.id}
          onClose={() => setShowGoalForm(false)}
          onGoalAdded={async () => {
            // Refresh goals list
            const goalsQuery = query(collection(db, 'goals'), where('homeschoolId', '==', homeschool.id));
            const goalsSnapshot = await getDocs(goalsQuery);
            const goalsList = goalsSnapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id
            } as Goal));
            setGoals(goalsList);
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
          onClose={() => {
            setShowActivityInstanceForm(false);
            setPreSelectedGoal('');
            setPreSelectedStudent('');
            setEditingActivityInstance(null);
          }}
          onActivityRecorded={() => {
            // Refresh today's instances
            fetchTodayInstances();
            fetchWeekInstances();
            setShowActivityInstanceForm(false);
            setPreSelectedGoal('');
            setPreSelectedStudent('');
            setEditingActivityInstance(null);
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
          onClose={() => setEditingStudent(null)}
          onUpdate={(updatedStudent) => {
            setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
            setEditingStudent(null);
          }}
        />
      )}

      {editingActivity && (
        <ActivityEdit
          activity={editingActivity}
          onClose={() => setEditingActivity(null)}
          onUpdate={(updatedActivity) => {
            setActivities(activities.map(a => a.id === updatedActivity.id ? updatedActivity : a));
            setEditingActivity(null);
          }}
        />
      )}

      {editingGoal && (
        <GoalEdit
          goal={editingGoal.goal}
          activity={editingGoal.activity}
          students={editingGoal.students}
          onClose={() => setEditingGoal(null)}
          onUpdate={(updatedGoal) => {
            setGoals(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
            setEditingGoal(null);
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
          onCancel={() => setDeleteConfirmation(null)}
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
    </div>
  );
};

export default Dashboard;
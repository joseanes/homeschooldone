import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Activity, Goal } from '../types';
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
  const [showReports, setShowReports] = useState(false);
  const [editingHomeschool, setEditingHomeschool] = useState<Homeschool | null>(null);
  const [editingStudent, setEditingStudent] = useState<Person | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingGoal, setEditingGoal] = useState<{ goal: Goal; activity: Activity; student: Person } | null>(null);

  useEffect(() => {
    // Check if user already has a homeschool
    const checkHomeschool = async () => {
      try {
        const q = query(collection(db, 'homeschools'), where('parentIds', 'array-contains', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data() as Homeschool;
          const homeschoolData = { ...data, id: querySnapshot.docs[0].id };
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

  const getGoalProgress = (goalId: string) => {
    // This is a placeholder - in a real app, we'd fetch today's activity instances
    // For now, return empty progress
    return { today: 0 };
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
        const studentGoals = goals.filter(g => g.studentId === id);
        for (const goal of studentGoals) {
          await deleteDoc(doc(db, 'goals', goal.id));
        }
        setGoals(goals.filter(g => g.studentId !== id));

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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ margin: 0 }}>{homeschool.name}</h1>
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
            Edit
          </button>
        </div>
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
          View Reports
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginTop: '30px'
      }}>
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3>Students</h3>
          {students.length === 0 ? (
            <p>No students yet</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {students.map((student) => (
                <li key={student.id} style={{ 
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    {student.name}
                    {student.dateOfBirth && (
                      <span style={{ color: '#666', fontSize: '14px', marginLeft: '8px' }}>
                        ({new Date(student.dateOfBirth.seconds ? student.dateOfBirth.seconds * 1000 : student.dateOfBirth).toLocaleDateString()})
                      </span>
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

        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3>Activities</h3>
          {activities.length === 0 ? (
            <p>No activities yet</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {activities.map((activity) => {
                const activityGoals = goals.filter(g => g.activityId === activity.id);
                return (
                  <li key={activity.id} style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold' }}>{activity.name}</div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {activity.subjectId}
                          {activity.description && ` • ${activity.description}`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                          Tracks: {[
                            activity.progressReportingStyle.percentageCompletion && 'Percentage',
                            activity.progressReportingStyle.timesTotal && 'Time',
                            activity.progressReportingStyle.progressCount && activity.progressCountName
                          ].filter(Boolean).join(', ')}
                        </div>
                        {activityGoals.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                              Goals:
                            </div>
                            {activityGoals.map(goal => {
                              const student = students.find(s => s.id === goal.studentId);
                              return (
                                <div key={goal.id} style={{ 
                                  fontSize: '12px', 
                                  marginLeft: '12px',
                                  marginBottom: '4px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <div>
                                    • {student?.name || 'Unknown student'}
                                    {goal.timesPerWeek && ` - ${goal.timesPerWeek}x/week`}
                                    {goal.minutesPerSession && ` - ${goal.minutesPerSession} min`}
                                    {goal.dailyPercentageIncrease && ` - ${goal.dailyPercentageIncrease}%/day`}
                                  </div>
                                  <div style={{ display: 'flex', gap: '3px' }}>
                                    <button
                                      onClick={() => student && setEditingGoal({ goal, activity, student })}
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '11px',
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
                                        name: `${student?.name}'s ${activity.name} goal`
                                      })}
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '11px',
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
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={() => setShowActivityForm(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
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
                  cursor: 'pointer'
                }}
              >
                Assign Goals
              </button>
            )}
          </div>
        </div>

        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3>Today's Progress</h3>
          <div style={{ marginBottom: '15px' }}>
            {goals.map(goal => {
              const activity = activities.find(a => a.id === goal.activityId);
              const student = students.find(s => s.id === goal.studentId);
              const progress = getGoalProgress(goal.id);
              
              if (!activity || !student) return null;
              
              return (
                <div key={goal.id} style={{ 
                  fontSize: '12px', 
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{student.name} - {activity.name}</span>
                  <span style={{ color: progress.today > 0 ? '#4caf50' : '#666' }}>
                    {progress.today > 0 ? '✓ Done' : 'Not done'}
                  </span>
                </div>
              );
            })}
            {goals.length === 0 && <p>No goals assigned yet</p>}
          </div>
          <button 
            onClick={() => setShowActivityInstanceForm(true)}
            disabled={goals.length === 0}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: goals.length === 0 ? '#ccc' : '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: goals.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Record Activity
          </button>
          {goals.length === 0 && (
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Create activities and assign goals first
            </p>
          )}
        </div>
      </div>

      {showStudentForm && homeschool && (
        <StudentForm
          homeschoolId={homeschool.id}
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
          onClose={() => setShowActivityInstanceForm(false)}
          onActivityRecorded={() => {
            // For now, just close the form
            // In the future, we could refresh today's activities
            setShowActivityInstanceForm(false);
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
          student={editingGoal.student}
          onClose={() => setEditingGoal(null)}
          onUpdate={(updatedGoal) => {
            setGoals(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
            setEditingGoal(null);
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
    </div>
  );
};

export default Dashboard;
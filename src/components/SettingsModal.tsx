import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Activity, Goal } from '../types';
import { formatLastActivity } from '../utils/activityTracking';
import { generatePublicDashboardId } from '../utils/publicDashboard';

interface UserWithStatus extends Person {
  status: 'active' | 'invited';
}

interface SettingsModalProps {
  homeschool: Homeschool;
  students: Person[];
  activities: Activity[];
  goals: Goal[];
  userRole: string | null;
  currentUserId: string;
  currentUserInfo: { name?: string; email?: string };
  dashboardSettings: {
    cycleSeconds: number;
    startOfWeek: number;
    timezone: string;
  };
  timerAlarmEnabled: boolean;
  publicDashboardId: string | null;
  onSaveSettings: (settings: {
    cycleSeconds: number;
    startOfWeek: number;
    timezone: string;
  }) => void;
  onSaveTimerAlarm: (enabled: boolean) => void;
  onSavePublicDashboard: (dashboardId: string | null) => void;
  onShowStudentForm: () => void;
  onShowActivityForm: () => void;
  onShowGoalForm: () => void;
  onShowInvite: () => void;
  onShowAuthorizedUsers: () => void;
  onEditHomeschool: () => void;
  onDeleteHomeschool: () => void;
  onEditStudent: (student: Person) => void;
  onEditActivity: (activity: Activity) => void;
  onEditGoal: (goal: Goal, activity: Activity, students: Person[]) => void;
  onDeleteConfirmation: (type: 'student' | 'activity' | 'goal', id: string, name: string) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  homeschool,
  students,
  activities,
  goals,
  userRole,
  currentUserId,
  currentUserInfo,
  dashboardSettings,
  timerAlarmEnabled,
  publicDashboardId,
  onSaveSettings,
  onSaveTimerAlarm,
  onSavePublicDashboard,
  onShowStudentForm,
  onShowActivityForm,
  onShowGoalForm,
  onShowInvite,
  onShowAuthorizedUsers,
  onEditHomeschool,
  onDeleteHomeschool,
  onEditStudent,
  onEditActivity,
  onEditGoal,
  onDeleteConfirmation,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'dashboard' | 'timer' | 'students' | 'activities' | 'users'>('general');
  const [cycleSeconds, setCycleSeconds] = useState(dashboardSettings.cycleSeconds);
  const [startOfWeek, setStartOfWeek] = useState(dashboardSettings.startOfWeek);
  const [timezone, setTimezone] = useState(dashboardSettings.timezone);
  const [timerAlarm, setTimerAlarm] = useState(timerAlarmEnabled);
  const [publicDashboard, setPublicDashboard] = useState(publicDashboardId);
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const weekDays = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  const timezones = [
    { value: 'America/New_York', label: 'Eastern (EST/EDT)' },
    { value: 'America/Chicago', label: 'Central (CST/CDT)' },
    { value: 'America/Denver', label: 'Mountain (MST/MDT)' },
    { value: 'America/Phoenix', label: 'Arizona (MST)' },
    { value: 'America/Los_Angeles', label: 'Pacific (PST/PDT)' },
    { value: 'America/Anchorage', label: 'Alaska (AKST/AKDT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
    { value: 'UTC', label: 'UTC' }
  ];

  // Fetch users when modal opens or when on users tab
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, homeschool]);

  const fetchUsers = async () => {
    if (loadingUsers) return;
    setLoadingUsers(true);
    
    try {
      const allUsers: UserWithStatus[] = [];
      
      // Get all user IDs from homeschool
      const allUserIds = [
        ...(homeschool.parentIds || []),
        ...(homeschool.tutorIds || []),
        ...(homeschool.observerIds || [])
      ];
      
      // Fetch active users from people collection
      if (allUserIds.length > 0) {
        const peopleQuery = query(collection(db, 'people'), where('__name__', 'in', allUserIds));
        const peopleSnapshot = await getDocs(peopleQuery);
        
        peopleSnapshot.docs.forEach(doc => {
          const person = { ...doc.data(), id: doc.id } as Person;
          allUsers.push({ ...person, status: 'active' });
        });
      }
      
      // Add invited users (emails without corresponding people records)
      const activeEmails = new Set(allUsers.map(u => u.email).filter(Boolean));
      const allEmails = [
        ...(homeschool.parentEmails || []),
        ...(homeschool.tutorEmails || []),
        ...(homeschool.observerEmails || [])
      ];
      
      allEmails.forEach(email => {
        if (email && !activeEmails.has(email)) {
          let role = 'observer';
          if (homeschool.parentEmails?.includes(email)) role = 'parent';
          else if (homeschool.tutorEmails?.includes(email)) role = 'tutor';
          
          allUsers.push({
            id: `invited-${email}`,
            email,
            name: email,
            role: role as Person['role'],
            status: 'invited'
          });
        }
      });
      
      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRemoveUser = async (userId: string, userEmail: string, userRole: string) => {
    try {
      const updates: any = {};
      
      // Remove from appropriate arrays
      if (userRole === 'parent') {
        if (userId && !userId.startsWith('invited-')) {
          updates.parentIds = arrayRemove(userId);
        }
        if (userEmail) {
          updates.parentEmails = arrayRemove(userEmail);
        }
      } else if (userRole === 'tutor') {
        if (userId && !userId.startsWith('invited-')) {
          updates.tutorIds = arrayRemove(userId);
        }
        if (userEmail) {
          updates.tutorEmails = arrayRemove(userEmail);
        }
      } else if (userRole === 'observer') {
        if (userId && !userId.startsWith('invited-')) {
          updates.observerIds = arrayRemove(userId);
        }
        if (userEmail) {
          updates.observerEmails = arrayRemove(userEmail);
        }
      }
      
      await updateDoc(doc(db, 'homeschools', homeschool.id), updates);
      
      // Refresh users list
      fetchUsers();
    } catch (error) {
      console.error('Error removing user:', error);
    }
  };

  const handleSave = () => {
    console.log('SettingsModal: handleSave called with publicDashboard:', publicDashboard);
    onSaveSettings({
      cycleSeconds,
      startOfWeek,
      timezone
    });
    onSaveTimerAlarm(timerAlarm);
    console.log('SettingsModal: About to call onSavePublicDashboard with:', publicDashboard);
    onSavePublicDashboard(publicDashboard);
    onClose();
  };

  const handleGeneratePublicLink = () => {
    const newId = generatePublicDashboardId();
    console.log('SettingsModal: Generated new public dashboard ID:', newId);
    setPublicDashboard(newId);
    console.log('SettingsModal: Set local state to:', newId);
    onSavePublicDashboard(newId);
  };

  const handleDisablePublicLink = () => {
    console.log('SettingsModal: Disabling public dashboard link');
    setPublicDashboard(null);
    onSavePublicDashboard(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div>
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px' }}>🏠 Homeschool Management</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                {userRole === 'parent' && (
                  <>
                    <button
                      onClick={() => { onEditHomeschool(); onClose(); }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      📝 Edit Homeschool Name
                    </button>
                    <button
                      onClick={() => { onShowInvite(); onClose(); }}
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
                      👥 Invite Users
                    </button>
                    <button
                      onClick={() => { onDeleteHomeschool(); onClose(); }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      🗑️ Delete Homeschool
                    </button>
                  </>
                )}
                {userRole !== 'parent' && (
                  <p style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                    Contact a parent to manage homeschool settings.
                  </p>
                )}
              </div>
              <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                {userRole === 'parent' ? 
                  'Manage your homeschool settings, invite users, and configure access.' :
                  'View homeschool information. Only parents can modify these settings.'
                }
              </p>
            </div>
          </div>
        );
        
      case 'students':
        return (
          <div>
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>👨‍🎓 Students</h3>
                {userRole === 'parent' && (
                  <button
                    onClick={() => { onShowStudentForm(); onClose(); }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#4285f4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    + Add Student
                  </button>
                )}
              </div>
              {students.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>No students added yet</p>
              ) : (
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                  {students.map((student) => (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px',
                        marginBottom: '8px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        border: '1px solid #ddd'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500' }}>{student.name}</div>
                        {student.email && (
                          <div style={{ fontSize: '12px', color: '#007bff' }}>📧 {student.email}</div>
                        )}
                      </div>
                      {userRole === 'parent' && (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={() => { onEditStudent(student); onClose(); }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { onDeleteConfirmation('student', student.id, student.name); onClose(); }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'activities':
        return (
          <div>
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>📚 Activities & Goals</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {userRole === 'parent' && (
                    <button
                      onClick={() => { onShowActivityForm(); onClose(); }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#4285f4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      + Create Activity
                    </button>
                  )}
                  {(userRole === 'parent' || userRole === 'tutor') && (
                    <button
                      onClick={() => { onShowGoalForm(); onClose(); }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      + Assign Goals
                    </button>
                  )}
                </div>
              </div>
              {activities.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>No activities created yet</p>
              ) : (
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                  {activities.map((activity) => {
                    const activityGoals = goals.filter(g => g.activityId === activity.id);
                    return (
                      <div
                        key={activity.id}
                        style={{
                          padding: '12px',
                          marginBottom: '12px',
                          backgroundColor: 'white',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{activity.name}</div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                              {activity.description}
                            </div>
                            {activityGoals.length > 0 && (
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>Goals:</div>
                                {activityGoals.map(goal => {
                                  const goalStudents = students.filter(s => goal.studentIds?.includes(s.id));
                                  return (
                                    <div key={goal.id} style={{ 
                                      fontSize: '11px', 
                                      marginLeft: '8px',
                                      marginBottom: '4px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <div>
                                        • {goalStudents.map(s => s.name).join(', ')}
                                        {goal.timesPerWeek && ` - ${goal.timesPerWeek}x/week`}
                                        {goal.minutesPerSession && ` - ${goal.minutesPerSession}min`}
                                      </div>
                                      <div style={{ display: 'flex', gap: '3px' }}>
                                        <button
                                          onClick={() => { onEditGoal(goal, activity, goalStudents); onClose(); }}
                                          style={{
                                            padding: '2px 6px',
                                            backgroundColor: '#007bff',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontSize: '10px'
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => { onDeleteConfirmation('goal', goal.id, `${goalStudents.map(s => s.name).join(', ')}'s ${activity.name} goal`); onClose(); }}
                                          style={{
                                            padding: '2px 6px',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontSize: '10px'
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
                          {userRole === 'parent' && (
                            <div style={{ display: 'flex', gap: '5px', marginLeft: '8px' }}>
                              <button
                                onClick={() => { onEditActivity(activity); onClose(); }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#007bff',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => { onDeleteConfirmation('activity', activity.id, activity.name); onClose(); }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'users':
        return (
          <div>
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>🔐 User Management</h3>
                {userRole === 'parent' && (
                  <button
                    onClick={() => { onShowInvite(); onClose(); }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    + Invite User
                  </button>
                )}
              </div>
              
              {loadingUsers ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Loading users...</p>
              ) : users.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>No users found</p>
              ) : (
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                  {users.map((user) => (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        marginBottom: '8px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        border: '1px solid #ddd'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '500' }}>{user.name || user.email}</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: 
                                user.role === 'parent' ? '#e3f2fd' : 
                                user.role === 'tutor' ? '#f3e5f5' : 
                                '#f1f8e9',
                              color:
                                user.role === 'parent' ? '#1976d2' :
                                user.role === 'tutor' ? '#7b1fa2' :
                                '#388e3c'
                            }}
                          >
                            {user.role}
                          </span>
                          {user.status === 'invited' && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: '#fff3e0',
                                color: '#f57c00'
                              }}
                            >
                              invited
                            </span>
                          )}
                          {user.id === currentUserId && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: '#e8f5e8',
                                color: '#2e7d32'
                              }}
                            >
                              you
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          📧 {user.email}
                          {user.mobile && (
                            <span style={{ marginLeft: '12px' }}>📱 {user.mobile}</span>
                          )}
                        </div>
                        {user.lastActivity && (
                          <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic', marginTop: '4px' }}>
                            Last active: {formatLastActivity(user.lastActivity)}
                          </div>
                        )}
                      </div>
                      
                      {userRole === 'parent' && user.id !== currentUserId && (
                        <button
                          onClick={() => handleRemoveUser(user.id, user.email || '', user.role)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          {user.status === 'invited' ? 'Revoke' : 'Remove'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <p style={{ fontSize: '12px', color: '#666', marginTop: '15px', margin: '15px 0 0 0' }}>
                {userRole === 'parent' ? 
                  'Parents can manage all users and settings. Tutors can only assign goals. Observers have read-only access.' :
                  'View users who have access to this homeschool. Contact a parent to make changes.'
                }
              </p>
            </div>
          </div>
        );
        
      case 'dashboard':
        return (
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '15px',
              fontSize: '18px',
              color: '#333'
            }}>
              📺 Dashboard Settings
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '20px'
            }}>
              Configure the full-screen dashboard for display on TVs or monitors.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '20px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Cycle Time (seconds per student)
                </label>
                <input
                  type="number"
                  min="3"
                  max="300"
                  value={cycleSeconds}
                  onChange={(e) => setCycleSeconds(parseInt(e.target.value) || 10)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Start of Week
                </label>
                <select
                  value={startOfWeek}
                  onChange={(e) => setStartOfWeek(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {weekDays.map(day => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {timezones.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Public Dashboard Settings - TEMPORARILY HIDDEN */}
            {/* 
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              padding: '20px',
              marginTop: '20px'
            }}>
              <h3 style={{ 
                marginTop: 0, 
                marginBottom: '15px',
                fontSize: '18px',
                color: '#333'
              }}>
                🔗 Public Dashboard Link
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#666',
                marginBottom: '20px'
              }}>
                Share your dashboard publicly without requiring login. Anyone with the link can view the dashboard.
              </p>

              {publicDashboard ? (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '15px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Public link is enabled</span>
                    <button
                      onClick={handleDisablePublicLink}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Disable
                    </button>
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    backgroundColor: '#f8f9fa',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0',
                    wordBreak: 'break-all'
                  }}>
                    {window.location.origin}/dashboard/{publicDashboard}
                  </div>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    marginTop: '8px',
                    margin: '8px 0 0 0'
                  }}>
                    Share this link to allow public viewing of your dashboard.
                  </p>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                    Public link is currently disabled. Generate a link to share your dashboard publicly.
                  </p>
                  <button
                    onClick={handleGeneratePublicLink}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Generate Public Link
                  </button>
                </div>
              )}
            </div>
            */}
          </div>
        );
        
      case 'timer':
        return (
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '15px',
              fontSize: '18px',
              color: '#333'
            }}>
              ⏰ Timer Settings
            </h3>
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '14px'
            }}>
              <input
                type="checkbox"
                checked={timerAlarm}
                onChange={(e) => setTimerAlarm(e.target.checked)}
                style={{
                  marginRight: '10px',
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
              <span>Play alarm sound when timer reaches goal duration</span>
            </label>
            <p style={{
              fontSize: '12px',
              color: '#666',
              marginTop: '8px',
              marginLeft: '28px'
            }}>
              When recording activities with a timer, an alarm will sound when you reach the goal's target duration.
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>⚙️ Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #ddd',
          marginBottom: '20px',
          gap: '5px'
        }}>
          {[
            { id: 'general', label: '🏠 General', icon: '🏠' },
            { id: 'students', label: '👨‍🎓 Students', icon: '👨‍🎓' },
            { id: 'activities', label: '📚 Activities', icon: '📚' },
            { id: 'users', label: '🔐 Users', icon: '🔐' },
            { id: 'dashboard', label: '📺 Dashboard', icon: '📺' },
            { id: 'timer', label: '⏰ Timer', icon: '⏰' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #007bff' : '2px solid transparent',
                backgroundColor: activeTab === tab.id ? '#f8f9fa' : 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? '600' : 'normal',
                color: activeTab === tab.id ? '#007bff' : '#666'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '30px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#333'
            }}
          >
            Close
          </button>
          {(activeTab === 'dashboard' || activeTab === 'timer') && (
            <button
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Save Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityInstance, Goal, Activity, Person } from '../types';
import DeleteConfirmation from './DeleteConfirmation';

interface ReportsProps {
  homeschoolId: string;
  goals: Goal[];
  activities: Activity[];
  students: Person[];
  onClose: () => void;
  onEditActivity?: (instance: ActivityInstance) => void;
}

const Reports: React.FC<ReportsProps> = ({ 
  homeschoolId,
  goals, 
  activities, 
  students,
  onClose,
  onEditActivity
}) => {
  const [activityInstances, setActivityInstances] = useState<ActivityInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    // Default to current week (start of week Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    return startOfWeek.toISOString().split('T')[0];
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Generate week options (current week and past 8 weeks)
  const getWeekOptions = () => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 9; i++) {
      const weekStart = new Date(today);
      const dayOfWeek = today.getDay();
      weekStart.setDate(today.getDate() - dayOfWeek - (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      const label = i === 0 ? `This Week (${startStr} - ${endStr})` : `${startStr} - ${endStr}`;
      
      options.push({
        value: weekStart.toISOString().split('T')[0],
        label: label
      });
    }
    
    return options;
  };

  const handleDelete = async (instanceId: string) => {
    try {
      await deleteDoc(doc(db, 'activityInstances', instanceId));
      setActivityInstances(prev => prev.filter(i => i.id !== instanceId));
      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error deleting activity instance:', error);
      alert('Error deleting activity instance. Please try again.');
    }
  };

  useEffect(() => {
    fetchActivityInstances();
  }, []);

  const fetchActivityInstances = async () => {
    try {
      // Get all goals for this homeschool
      const goalIds = goals.map(g => g.id);
      if (goalIds.length === 0) {
        setActivityInstances([]);
        setLoading(false);
        return;
      }

      // Fetch activity instances for these goals
      // Note: We can't use 'in' with orderBy without an index, so we'll sort in memory
      const q = query(
        collection(db, 'activityInstances'),
        where('goalId', 'in', goalIds)
      );
      
      const snapshot = await getDocs(q);
      const instances = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
      } as ActivityInstance));
      
      // Sort by date in memory
      instances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setActivityInstances(instances);
    } catch (error) {
      console.error('Error fetching activity instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredInstances = () => {
    let filtered = activityInstances;

    // Filter by student
    if (selectedStudent !== 'all') {
      filtered = filtered.filter(instance => instance.studentId === selectedStudent);
    }

    // Filter by date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        filtered = filtered.filter(instance => {
          const instanceDate = new Date(instance.date);
          return instanceDate >= today;
        });
        break;
      case 'week':
        const weekStart = new Date(selectedWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        filtered = filtered.filter(instance => {
          const instanceDate = new Date(instance.date);
          return instanceDate >= weekStart && instanceDate <= weekEnd;
        });
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(instance => {
          const instanceDate = new Date(instance.date);
          return instanceDate >= monthAgo;
        });
        break;
    }

    return filtered;
  };

  const getGoalProgress = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return null;

    const goalInstances = activityInstances.filter(i => i.goalId === goalId);
    const weekInstances = goalInstances.filter(instance => {
      const instanceDate = new Date(instance.date);
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return instanceDate >= weekStart && instanceDate <= weekEnd;
    });

    return {
      thisWeek: weekInstances.length,
      target: goal.timesPerWeek || 0,
      total: goalInstances.length
    };
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const filteredInstances = getFilteredInstances();

  if (loading) return <div>Loading...</div>;

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
        padding: '30px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Progress Reports</h2>
          <button
            onClick={onClose}
            style={{
              padding: '5px 10px',
              fontSize: '20px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            style={{
              padding: '8px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          >
            <option value="all">All Students</option>
            {students.map(student => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            style={{
              padding: '8px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          >
            <option value="today">Today</option>
            <option value="week">Week of</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>

          {dateRange === 'week' && (
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minWidth: '200px'
              }}
            >
              {getWeekOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Goals Progress Summary */}
        <div style={{ marginBottom: '30px' }}>
          <h3>Weekly Goal Progress</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {goals
              .filter(goal => selectedStudent === 'all' || goal.studentIds?.includes(selectedStudent))
              .map(goal => {
                const progress = getGoalProgress(goal.id);
                const activity = activities.find(a => a.id === goal.activityId);
                const goalStudents = students.filter(s => goal.studentIds?.includes(s.id));
                
                if (!progress || !activity || goalStudents.length === 0) return null;
                
                const percentage = progress.target > 0 ? 
                  Math.round((progress.thisWeek / progress.target) * 100) : 0;
                
                return (
                  <div key={goal.id} style={{
                    padding: '15px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <strong>
                          {selectedStudent === 'all' 
                            ? goalStudents.map(s => s.name).join(', ')
                            : goalStudents.filter(s => s.id === selectedStudent).map(s => s.name).join(', ')
                          }
                        </strong> - {activity.name}
                      </div>
                      <div>
                        {progress.thisWeek}/{progress.target} {dateRange === 'week' && selectedWeek !== getWeekOptions()[0].value ? 'that week' : 'this week'}
                      </div>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '20px',
                      backgroundColor: '#e0e0e0',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(percentage, 100)}%`,
                        height: '100%',
                        backgroundColor: percentage >= 100 ? '#4caf50' : '#2196f3',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Activity History */}
        <div>
          <h3>Activity History ({filteredInstances.length})</h3>
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {filteredInstances.length === 0 ? (
              <p style={{ color: '#666' }}>No activities recorded for this period.</p>
            ) : (
              filteredInstances.map(instance => {
                const goal = goals.find(g => g.id === instance.goalId);
                const activity = goal ? activities.find(a => a.id === goal.activityId) : null;
                const student = students.find(s => s.id === instance.studentId);
                
                if (!goal || !activity || !student) return null;
                
                return (
                  <div key={instance.id} style={{
                    padding: '15px',
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <strong>{student.name} - {activity.name}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>{new Date(instance.date).toLocaleDateString()}</span>
                        {onEditActivity && (
                          <button
                            onClick={() => onEditActivity(instance)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            title="Edit this activity instance"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmation({ 
                            id: instance.id, 
                            name: `${activity.name} on ${new Date(instance.date).toLocaleDateString()}` 
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
                          title="Delete this activity instance"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {instance.duration && (
                      <div>Duration: {formatDuration(instance.duration)}</div>
                    )}
                    
                    {instance.startingPercentage !== undefined && instance.endingPercentage !== undefined && (
                      <div>
                        Progress: {instance.startingPercentage}% → {instance.endingPercentage}% 
                        (+{(instance.endingPercentage - instance.startingPercentage).toFixed(1)}%)
                      </div>
                    )}
                    
                    {instance.countCompleted !== undefined && activity.progressCountName && (
                      <div>
                        {activity.progressCountName}: {instance.countCompleted}
                      </div>
                    )}
                    
                    {instance.description && (
                      <div style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
                        Notes: {instance.description}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {deleteConfirmation && (
          <DeleteConfirmation
            entityType="activity instance"
            entityName={deleteConfirmation.name}
            onConfirm={() => handleDelete(deleteConfirmation.id)}
            onCancel={() => setDeleteConfirmation(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Reports;
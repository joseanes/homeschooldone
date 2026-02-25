import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityInstance, Goal, Activity, Person, AdHocTask } from '../types';
import DeleteConfirmation from './DeleteConfirmation';

interface ReportsProps {
  homeschoolId: string;
  goals: Goal[];
  activities: Activity[];
  students: Person[];
  adHocTasks: AdHocTask[];
  onClose: () => void;
  onEditActivity?: (instance: ActivityInstance) => void;
}

const Reports: React.FC<ReportsProps> = ({
  homeschoolId,
  goals,
  activities,
  students,
  adHocTasks,
  onClose,
  onEditActivity
}) => {
  const [activityInstances, setActivityInstances] = useState<ActivityInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom' | 'all'>('week');
  const [activeTab, setActiveTab] = useState<'progress' | 'history' | 'transcript' | 'effort'>('progress');
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    return startOfWeek.toISOString().split('T')[0];
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
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

  const getMonthOptions = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames.map((name, index) => {
      const year = index > currentMonth ? currentYear - 1 : currentYear;
      const value = `${year}-${String(index + 1).padStart(2, '0')}`;
      return { value, label: `${name} ${year}` };
    });
  };

  const getYearOptions = () => {
    const yearsSet = new Set<number>();
    activityInstances.forEach(instance => {
      const year = new Date(instance.date).getFullYear();
      yearsSet.add(year);
    });
    yearsSet.add(new Date().getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
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
      const goalIds = goals.map(g => g.id);
      if (goalIds.length === 0) {
        setActivityInstances([]);
        setLoading(false);
        return;
      }

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

    if (selectedStudent !== 'all') {
      filtered = filtered.filter(instance => instance.studentId === selectedStudent);
    }

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
        const [monthYear, monthNum] = selectedMonth.split('-').map(Number);
        const monthStart = new Date(monthYear, monthNum - 1, 1);
        const monthEnd = new Date(monthYear, monthNum, 0, 23, 59, 59, 999);
        filtered = filtered.filter(instance => {
          const instanceDate = new Date(instance.date);
          return instanceDate >= monthStart && instanceDate <= monthEnd;
        });
        break;
      case 'year':
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        filtered = filtered.filter(instance => {
          const instanceDate = new Date(instance.date);
          return instanceDate >= yearStart && instanceDate <= yearEnd;
        });
        break;
      case 'custom':
        const customStart = new Date(customStartDate + 'T00:00:00');
        const customEnd = new Date(customEndDate + 'T23:59:59.999');
        filtered = filtered.filter(instance => {
          const instanceDate = new Date(instance.date);
          return instanceDate >= customStart && instanceDate <= customEnd;
        });
        break;
    }

    return filtered;
  };

  // Calculate number of weeks in the selected period
  const getWeeksInPeriod = (): number => {
    switch (dateRange) {
      case 'today':
        return 1;
      case 'week':
        return 1;
      case 'month': {
        const [y, m] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        return Math.ceil(daysInMonth / 7);
      }
      case 'year':
        return 52;
      case 'custom': {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        return Math.max(1, Math.ceil(days / 7));
      }
      case 'all':
        return 0; // show raw counts
    }
  };

  // Get goal progress within the filtered period for a specific student
  const getPeriodGoalProgress = (goalId: string, studentId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return null;

    const periodInstances = filteredInstances.filter(
      i => i.goalId === goalId && i.studentId === studentId
    );

    const weeksInPeriod = getWeeksInPeriod();
    const periodTarget = weeksInPeriod > 0 ? (goal.timesPerWeek || 0) * weeksInPeriod : 0;

    return {
      count: periodInstances.length,
      target: periodTarget,
      weeksInPeriod
    };
  };

  // Get status color for a goal based on period progress
  const getGoalStatusForPeriod = (goalId: string, studentId: string) => {
    const progress = getPeriodGoalProgress(goalId, studentId);
    if (!progress) return { color: '#9e9e9e', backgroundColor: '#f5f5f5', textColor: '#616161', text: 'No Data' };

    if (progress.target > 0 && progress.count >= progress.target) {
      return { color: '#4caf50', backgroundColor: '#e8f5e9', textColor: '#2e7d32', text: 'Complete' };
    }

    const percentage = progress.target > 0 ? (progress.count / progress.target) * 100 : 0;

    if (percentage >= 50) {
      return { color: '#2196f3', backgroundColor: '#e3f2fd', textColor: '#1565c0', text: 'On Track' };
    }

    if (progress.count > 0) {
      return { color: '#ffc107', backgroundColor: '#fff8e1', textColor: '#f57c00', text: 'In Progress' };
    }

    return { color: '#9e9e9e', backgroundColor: '#f5f5f5', textColor: '#616161', text: 'Pending' };
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Student', 'Goal', 'Activity', 'Duration', 'Notes'];
    const rows = filteredInstances.map(instance => {
      const goal = goals.find(g => g.id === instance.goalId);
      const activity = goal ? activities.find(a => a.id === goal.activityId) : null;
      const student = students.find(s => s.id === instance.studentId);
      if (!goal || !activity || !student) return null;
      return [
        new Date(instance.date).toLocaleDateString(),
        student.name,
        goal.name || '',
        activity.name,
        instance.duration ? formatDuration(instance.duration) : '',
        instance.description || ''
      ];
    }).filter(Boolean) as string[][];

    const escapeCsvField = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const studentLabel = selectedStudent === 'all' ? 'All' : (students.find(s => s.id === selectedStudent)?.name || 'All').replace(/\s+/g, '-');
    link.download = `${new Date().toISOString().split('T')[0]}-homeschooldone-${studentLabel}-activity-history.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredInstances = getFilteredInstances();

  // Check if a date falls within the currently selected date range
  const isDateInRange = (d: Date): boolean => {
    const checkDate = new Date(d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'today':
        return checkDate >= today;
      case 'week': {
        const weekStart = new Date(selectedWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return checkDate >= weekStart && checkDate <= weekEnd;
      }
      case 'month': {
        const [mY, mN] = selectedMonth.split('-').map(Number);
        const monthStart = new Date(mY, mN - 1, 1);
        const monthEnd = new Date(mY, mN, 0, 23, 59, 59, 999);
        return checkDate >= monthStart && checkDate <= monthEnd;
      }
      case 'year': {
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        return checkDate >= yearStart && checkDate <= yearEnd;
      }
      case 'custom': {
        const customStart = new Date(customStartDate + 'T00:00:00');
        const customEnd = new Date(customEndDate + 'T23:59:59.999');
        return checkDate >= customStart && checkDate <= customEnd;
      }
      case 'all':
        return true;
    }
  };

  // Period label for progress display
  const getPeriodLabel = () => {
    switch (dateRange) {
      case 'today': return 'today';
      case 'week': return 'this week';
      case 'month': return 'this month';
      case 'year': return 'this year';
      case 'custom': return 'this period';
      case 'all': return 'total';
    }
  };

  if (loading) return <div>Loading...</div>;

  const tabs: { key: 'progress' | 'history' | 'transcript' | 'effort'; label: string }[] = [
    { key: 'progress', label: 'Consistent Effort' },
    { key: 'history', label: 'Activity History' },
    { key: 'transcript', label: 'Transcript' },
    { key: 'effort', label: 'Effort Summary' },
  ];

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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Reports</h2>
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

        {/* Filters Row */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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
            <option value="month">Month</option>
            <option value="year">Year</option>
            <option value="custom">Custom</option>
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

          {dateRange === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minWidth: '200px'
              }}
            >
              {getMonthOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {dateRange === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minWidth: '120px'
              }}
            >
              {getYearOptions().map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <span>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
          )}

        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '20px'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px',
                fontSize: '15px',
                fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                color: activeTab === tab.key ? '#2196f3' : '#666',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '3px solid #2196f3' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'progress' && (
          <div>
            {goals.length === 0 ? (
              <p style={{ color: '#666' }}>No goals assigned yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '20px' }}>
                {[...students]
                  .sort((a, b) => {
                    if (a.dateOfBirth && b.dateOfBirth) {
                      return new Date(b.dateOfBirth).getTime() - new Date(a.dateOfBirth).getTime();
                    }
                    return a.name.localeCompare(b.name);
                  })
                  .filter(student => selectedStudent === 'all' || student.id === selectedStudent)
                  .map(student => {
                    const studentGoals = goals.filter(g => g.studentIds?.includes(student.id));
                    if (studentGoals.length === 0) return null;

                    const completedGoals = studentGoals.filter(goal => {
                      const status = getGoalStatusForPeriod(goal.id, student.id);
                      return status.text === 'Complete';
                    }).length;
                    const totalGoals = studentGoals.length;
                    const allCompleted = completedGoals === totalGoals && totalGoals > 0;

                    // Sort: pending first, then in progress, then on track, then complete
                    const statusPriority: { [key: string]: number } = {
                      'Pending': 1,
                      'In Progress': 2,
                      'On Track': 3,
                      'Complete': 4,
                      'No Data': 5
                    };

                    const sortedGoals = [...studentGoals].sort((a, b) => {
                      const statusA = getGoalStatusForPeriod(a.id, student.id);
                      const statusB = getGoalStatusForPeriod(b.id, student.id);
                      const prioA = statusPriority[statusA.text] || 99;
                      const prioB = statusPriority[statusB.text] || 99;
                      if (prioA !== prioB) return prioA - prioB;
                      const actA = activities.find(act => act.id === a.activityId);
                      const actB = activities.find(act => act.id === b.activityId);
                      const nameA = a.name || actA?.name || '';
                      const nameB = b.name || actB?.name || '';
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
                          </h4>
                          <div style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            backgroundColor: allCompleted ? '#4caf50' : '#ff9800',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {completedGoals}/{totalGoals} Goals {dateRange === 'all' ? '' : getPeriodLabel()}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: '8px' }}>
                          {sortedGoals.map(goal => {
                            const activity = activities.find(a => a.id === goal.activityId);
                            const progress = getPeriodGoalProgress(goal.id, student.id);
                            const status = getGoalStatusForPeriod(goal.id, student.id);

                            if (!activity || !progress) return null;

                            const percentage = progress.target > 0
                              ? Math.min(Math.round((progress.count / progress.target) * 100), 100)
                              : 0;

                            return (
                              <div
                                key={goal.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '12px',
                                  backgroundColor: status.backgroundColor,
                                  color: status.textColor,
                                  borderRadius: '6px',
                                  border: `1px solid ${status.color}`,
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontWeight: '500' }}>{goal.name || activity.name}</span>
                                  {goal.timesPerWeek && progress.target > 0 && (
                                    <span style={{ color: status.textColor, opacity: 0.7, fontSize: '13px', marginLeft: '8px' }}>
                                      ({progress.count} of {progress.target}{dateRange === 'all' ? '' : ` for ${progress.weeksInPeriod}w`})
                                    </span>
                                  )}
                                  {dateRange === 'all' && goal.timesPerWeek && (
                                    <span style={{ color: status.textColor, opacity: 0.7, fontSize: '13px', marginLeft: '8px' }}>
                                      ({progress.count} completed)
                                    </span>
                                  )}
                                  {/* Progress bar */}
                                  {progress.target > 0 && (
                                    <div style={{
                                      width: '100%',
                                      height: '6px',
                                      backgroundColor: 'rgba(0,0,0,0.1)',
                                      borderRadius: '3px',
                                      overflow: 'hidden',
                                      marginTop: '6px'
                                    }}>
                                      <div style={{
                                        width: `${percentage}%`,
                                        height: '100%',
                                        backgroundColor: status.color,
                                        transition: 'width 0.3s'
                                      }} />
                                    </div>
                                  )}
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  color: status.textColor,
                                  marginLeft: '12px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {status.text}
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
        )}

        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Activity History ({filteredInstances.length})</h3>
              {filteredInstances.length > 0 && (
                <button
                  onClick={exportToCSV}
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
                  Export CSV
                </button>
              )}
            </div>
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
                        <strong>{student.name} - {goal.name ? `${goal.name}: ` : ''}{activity.name}</strong>
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

                      {(instance.percentageCompleted !== undefined || instance.endingPercentage !== undefined) && (
                        <div>
                          Completion: {(instance.percentageCompleted || instance.endingPercentage || 0).toFixed(1)}%
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
        )}

        {activeTab === 'effort' && (
          <div>
            {/* Print styles for PDF output */}
            <style>{`
              @media print {
                body * { visibility: hidden; }
                .effort-print-area, .effort-print-area * { visibility: visible; }
                .effort-print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  padding: 10px 20px;
                  box-sizing: border-box;
                }
                .no-print { display: none !important; }
                .effort-student-section {
                  break-inside: avoid;
                  page-break-inside: avoid;
                  border: none !important;
                  border-radius: 0 !important;
                  padding: 10px 0 !important;
                  margin-bottom: 10px !important;
                }
                .effort-student-section h3 {
                  font-size: 18px !important;
                  margin-bottom: 10px !important;
                }
              }
            `}</style>

            {/* Print Report button at top */}
            <div className="no-print" style={{ marginBottom: '16px', textAlign: 'right' }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Print Report
              </button>
            </div>

            <div className="effort-print-area">
              {/* Report Title */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#333' }}>Effort Summary</h3>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {(() => {
                    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    switch (dateRange) {
                      case 'today': return fmt(new Date());
                      case 'week': {
                        const ws = new Date(selectedWeek);
                        const we = new Date(ws); we.setDate(ws.getDate() + 6);
                        return `Week of ${fmt(ws)} - ${fmt(we)}`;
                      }
                      case 'month': {
                        const [y, m] = selectedMonth.split('-').map(Number);
                        return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      }
                      case 'year': return String(selectedYear);
                      case 'custom': return `${fmt(new Date(customStartDate))} - ${fmt(new Date(customEndDate))}`;
                      case 'all': return 'All Time';
                    }
                  })()}
                </div>
              </div>

              {[...students]
                .sort((a, b) => {
                  if (a.dateOfBirth && b.dateOfBirth) {
                    return new Date(b.dateOfBirth).getTime() - new Date(a.dateOfBirth).getTime();
                  }
                  return a.name.localeCompare(b.name);
                })
                .filter(student => selectedStudent === 'all' || student.id === selectedStudent)
                .map(student => {
                  const studentGoals = goals.filter(g => g.studentIds?.includes(student.id));
                  const studentInstances = filteredInstances.filter(i => i.studentId === student.id);
                  const studentTasks = adHocTasks.filter(t => {
                    if (t.studentId !== student.id) return false;
                    if (!t.completedDate) return false; // only show completed tasks
                    const taskDate = t.completedDate instanceof Date ? t.completedDate : (t.completedDate as any)?.toDate ? (t.completedDate as any).toDate() : new Date(t.completedDate);
                    return isDateInRange(taskDate);
                  });

                  // Group goals by subject
                  const subjectGroups: { [subject: string]: Goal[] } = {};
                  studentGoals.forEach(goal => {
                    const activity = activities.find(a => a.id === goal.activityId);
                    const subject = activity?.subjectId || 'Other';
                    if (!subjectGroups[subject]) subjectGroups[subject] = [];
                    subjectGroups[subject].push(goal);
                  });

                  const sortedSubjects = Object.keys(subjectGroups).sort();

                  // Collect all goal rows across subjects for consistent column widths
                  const allGoalRows = sortedSubjects.flatMap(subject =>
                    subjectGroups[subject].map(goal => {
                      const activity = activities.find(a => a.id === goal.activityId);
                      const goalInstances = studentInstances.filter(i => i.goalId === goal.id);
                      const timesWorked = goalInstances.length;
                      const weeksInPeriod = getWeeksInPeriod();
                      const target = weeksInPeriod > 0 && goal.timesPerWeek ? goal.timesPerWeek * weeksInPeriod : 0;

                      let attainment: string = '-';
                      if (goalInstances.length > 0) {
                        const sorted = [...goalInstances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const latest = sorted[0];
                        if (latest.endingPercentage !== undefined) {
                          attainment = `${latest.endingPercentage.toFixed(1)}%`;
                        } else if (latest.percentageCompleted !== undefined) {
                          attainment = `${latest.percentageCompleted.toFixed(1)}%`;
                        }
                      }

                      const isComplete = goal.studentCompletions?.[student.id]?.completionDate != null;
                      const status = isComplete ? 'Complete' : (timesWorked > 0 ? 'In Progress' : 'Not Started');
                      const statusColor = isComplete ? '#4caf50' : (timesWorked > 0 ? '#ff9800' : '#9e9e9e');

                      return { goal, activity, subject, timesWorked, target, attainment, status, statusColor };
                    })
                  );

                  return (
                    <div key={student.id} className="effort-student-section" style={{
                      border: '2px solid #e0e0e0',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '20px',
                      backgroundColor: '#fff'
                    }}>
                      <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333', borderBottom: '2px solid #2196f3', paddingBottom: '8px' }}>
                        {student.name}
                      </h3>

                      <div style={{ display: 'flex', gap: '20px' }}>
                        {/* Left Column - Goals & Progress (2/3) */}
                        <div style={{ flex: 2, minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#555' }}>Goals &amp; Progress</h4>
                          {sortedSubjects.length === 0 ? (
                            <p style={{ color: '#999', fontSize: '14px' }}>No goals assigned.</p>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                              <colgroup>
                                <col style={{ width: '42%' }} />
                                <col style={{ width: '18%' }} />
                                <col style={{ width: '18%' }} />
                                <col style={{ width: '22%' }} />
                              </colgroup>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #ddd' }}>
                                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#666', fontWeight: '600' }}>Goal</th>
                                  <th style={{ textAlign: 'center', padding: '6px 8px', color: '#666', fontWeight: '600' }}>Times Worked</th>
                                  <th style={{ textAlign: 'center', padding: '6px 8px', color: '#666', fontWeight: '600' }}>Attainment</th>
                                  <th style={{ textAlign: 'center', padding: '6px 8px', color: '#666', fontWeight: '600' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedSubjects.map(subject => {
                                  const subjectRows = allGoalRows.filter(r => r.subject === subject);
                                  return (
                                    <React.Fragment key={subject}>
                                      <tr>
                                        <td colSpan={4} style={{ padding: '10px 8px 4px 8px' }}>
                                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#2196f3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {subject}
                                          </span>
                                        </td>
                                      </tr>
                                      {subjectRows.map(({ goal, activity, timesWorked, target, attainment, status, statusColor }) => (
                                        <tr key={goal.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                          <td style={{ padding: '8px', color: '#333', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                            {goal.name || activity?.name || 'Unnamed Goal'}
                                          </td>
                                          <td style={{ padding: '8px', textAlign: 'center', color: '#333' }}>
                                            {target > 0 ? `${timesWorked}/${target}` : `${timesWorked}`}
                                          </td>
                                          <td style={{ padding: '8px', textAlign: 'center', color: '#333' }}>
                                            {attainment}
                                          </td>
                                          <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <span style={{
                                              padding: '3px 10px',
                                              borderRadius: '12px',
                                              fontSize: '12px',
                                              fontWeight: '600',
                                              color: 'white',
                                              backgroundColor: statusColor,
                                              display: 'inline-block',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {/* Right Column - Tasks and Activities (1/3) */}
                        <div style={{ flex: 1, borderLeft: '1px solid #e0e0e0', paddingLeft: '20px', minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#555' }}>Tasks and Activities</h4>
                          {studentTasks.length === 0 ? (
                            <p style={{ color: '#999', fontSize: '14px' }}>No tasks recorded for this period.</p>
                          ) : (
                            <div style={{ display: 'grid', gap: '10px' }}>
                              {studentTasks.map(task => {
                                if (!task.completedDate) return null;
                                const taskDate = task.completedDate instanceof Date ? task.completedDate : (task.completedDate as any)?.toDate ? (task.completedDate as any).toDate() : new Date(task.completedDate as any);
                                return (
                                  <div key={task.id} style={{
                                    padding: '10px',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '6px',
                                    border: '1px solid #e9ecef'
                                  }}>
                                    <div style={{ fontWeight: '500', fontSize: '14px', color: '#333' }}>{task.name}</div>
                                    {task.description && (
                                      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{task.description}</div>
                                    )}
                                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                      {taskDate.toLocaleDateString()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {activeTab === 'transcript' && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
            <p style={{ fontSize: '16px' }}>Transcript view coming soon.</p>
          </div>
        )}

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

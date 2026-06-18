import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, increment, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityInstance, Goal, Activity, Person } from '../types';
import { updateStudentLastActivity, updateLastActivity } from '../utils/activityTracking';
import { playAlarmSound } from '../utils/alarmSound';
import { dateToFirestoreTimestamp, formatDateToStringUTC, localDateTimeToFirestoreTimestamp, formatTimeToString } from '../utils/dateUtils';

interface ActivityInstanceFormProps {
  goals: Goal[];
  activities: Activity[];
  students: Person[];
  userId: string;
  homeschoolId: string;
  preSelectedGoal?: string;
  preSelectedStudent?: string;
  existingInstance?: ActivityInstance;
  timezone?: string;
  timerAlarmEnabled?: boolean;
  allowMultipleRecordsPerDay?: boolean;
  onClose: () => void;
  onActivityRecorded: () => void;
}

const ActivityInstanceForm: React.FC<ActivityInstanceFormProps> = ({
  goals,
  activities,
  students,
  userId,
  homeschoolId,
  preSelectedGoal = '',
  preSelectedStudent = '',
  existingInstance,
  timezone = 'America/New_York',
  timerAlarmEnabled = false,
  allowMultipleRecordsPerDay = true,
  onClose,
  onActivityRecorded
}) => {
  const [selectedGoal, setSelectedGoal] = useState(preSelectedGoal);
  const [selectedStudent, setSelectedStudent] = useState(preSelectedStudent);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    // Get current date in selected timezone properly
    const now = new Date();
    // Create a formatter for the selected timezone
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    
    return `${year}-${month}-${day}`;
  });
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [percentageCompleted, setPercentageCompleted] = useState<number>(0);
  const [lastPercentageCompleted, setLastPercentageCompleted] = useState<number>(0);
  const [countComplete, setCountComplete] = useState<number | ''>('');
  const [progressCountCompleted, setProgressCountCompleted] = useState<number>(0);
  const [lastProgressCountCompleted, setLastProgressCountCompleted] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loadedExistingInstance, setLoadedExistingInstance] = useState<ActivityInstance | null>(null);

  const selectedGoalData = goals.find(g => g.id === selectedGoal);
  const selectedActivity = selectedGoalData ? activities.find(a => a.id === selectedGoalData.activityId) : null;
  const goalStudents = selectedGoalData ? students.filter(s => selectedGoalData.studentIds?.includes(s.id)) : [];
  const selectedStudentData = students.find(s => s.id === selectedStudent);

  // Auto-fill duration based on goal settings
  useEffect(() => {
    if (selectedGoalData?.minutesPerSession && selectedActivity?.progressReportingStyle.timesTotal) {
      setDuration(selectedGoalData.minutesPerSession);
    }
  }, [selectedGoalData, selectedActivity]);

  // Fetch last recorded percentage and progress count for Goal/Student combination
  useEffect(() => {
    const fetchLastProgress = async () => {
      if (selectedGoal && selectedStudent && selectedActivity) {
        try {
          const q = query(
            collection(db, 'activityInstances'),
            where('goalId', '==', selectedGoal),
            where('studentId', '==', selectedStudent)
          );
          const snapshot = await getDocs(q);
          
          let latestPercentage = 0;
          let latestProgressCount = 0;
          let latestPercentageDate: Date | null = null;
          let latestProgressCountDate: Date | null = null;

          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const instanceDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);

            // Skip the current instance if editing
            if (existingInstance && doc.id === existingInstance.id) return;
            if (loadedExistingInstance && doc.id === loadedExistingInstance.id) return;

            // Find latest instance that has a percentage value
            if (selectedActivity.progressReportingStyle.percentageCompletion) {
              const percentage = data.percentageCompleted || data.endingPercentage || 0;
              if (percentage > 0 && (!latestPercentageDate || instanceDate > latestPercentageDate)) {
                latestPercentageDate = instanceDate;
                latestPercentage = percentage;
              }
            }

            // Find latest instance that has a progress count value
            if (selectedActivity.progressReportingStyle.progressCount && data.countCompleted) {
              if (!latestProgressCountDate || instanceDate > latestProgressCountDate) {
                latestProgressCountDate = instanceDate;
                latestProgressCount = data.countCompleted;
              }
            }
          });
          
          if (selectedActivity.progressReportingStyle.percentageCompletion) {
            setLastPercentageCompleted(latestPercentage);
            // Set initial value if not editing an existing instance
            if (!existingInstance && !loadedExistingInstance) {
              setPercentageCompleted(latestPercentage);
            }
          }
          
          if (selectedActivity.progressReportingStyle.progressCount) {
            setLastProgressCountCompleted(latestProgressCount);
            // Set initial value if not editing an existing instance
            if (!existingInstance && !loadedExistingInstance) {
              setProgressCountCompleted(latestProgressCount);
            }
          }
        } catch (error) {
          console.error('Error fetching last progress:', error);
        }
      }
    };
    
    fetchLastProgress();
  }, [selectedGoal, selectedStudent, selectedActivity, existingInstance, loadedExistingInstance]);

  // Populate form fields when editing existing instance
  useEffect(() => {
    if (existingInstance) {
      setSelectedGoal(existingInstance.goalId);
      setSelectedStudent(existingInstance.studentId);
      setDescription(existingInstance.description || '');
      // Use UTC formatting since dates are stored as UTC in Firestore
      setDate(formatDateToStringUTC(existingInstance.date));
      setDuration(existingInstance.duration || '');
      // Use new percentageCompleted field if available, otherwise fallback to endingPercentage
      const percentage = existingInstance.percentageCompleted || existingInstance.endingPercentage || 0;
      setPercentageCompleted(percentage);
      setCountComplete(existingInstance.countCompleted || '');
      setProgressCountCompleted(existingInstance.countCompleted || 0);
      
      // Convert times if they exist
      if (existingInstance.startTime) {
        const startTimeDate = existingInstance.startTime instanceof Date 
          ? existingInstance.startTime
          : new Date(existingInstance.startTime);
        setStartTime(startTimeDate.toTimeString().slice(0, 5));
      }
      if (existingInstance.endTime) {
        const endTimeDate = existingInstance.endTime instanceof Date 
          ? existingInstance.endTime
          : new Date(existingInstance.endTime);
        setEndTime(endTimeDate.toTimeString().slice(0, 5));
      }
    }
  }, [existingInstance]);

  // Check for existing instance when multiple records per day is disabled
  useEffect(() => {
    let cancelled: boolean = false;

    const checkExistingInstance = async () => {
      if (!allowMultipleRecordsPerDay && selectedGoal && selectedStudent && date) {
        try {
          const instancesSnapshot = await getDocs(query(
            collection(db, 'activityInstances'),
            where('goalId', '==', selectedGoal),
            where('studentId', '==', selectedStudent)
          ));
          let matchingInstance: { doc: any; data: any } | null = null;
          instancesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const instanceDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
            // Use UTC formatting since dates are stored as UTC in Firestore
            const instanceDateStringUTC = formatDateToStringUTC(instanceDate);
            if (instanceDateStringUTC === date && !matchingInstance) {
              matchingInstance = { doc, data };
            }
          });

          // Check if this effect has been cancelled
          if (cancelled) return;

          if (matchingInstance) {
            const { doc, data } = matchingInstance as { doc: any; data: any };

            // Skip if this is the same instance we're already editing
            if (existingInstance && doc.id === existingInstance.id) {
              setLoadedExistingInstance(null);
              return;
            }

            // Convert and load the instance
            const storedDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
            const instance: ActivityInstance = {
              ...data,
              id: doc.id,
              date: storedDate,
              startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime,
              endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime
            } as ActivityInstance;

            setDescription(instance.description || '');
            setDuration(instance.duration || '');
            // Use new percentageCompleted field if available, otherwise fallback to endingPercentage
            const percentage = instance.percentageCompleted || instance.endingPercentage || 0;
            setPercentageCompleted(percentage);
            setCountComplete(instance.countCompleted || '');
            setProgressCountCompleted(instance.countCompleted || 0);

            // Convert times if they exist - use timezone-aware formatting
            if (instance.startTime) {
              setStartTime(formatTimeToString(instance.startTime, timezone));
            }
            if (instance.endTime) {
              setEndTime(formatTimeToString(instance.endTime, timezone));
            }

            setLoadedExistingInstance(instance);
            return;
          }

          // No match found — clear the form
          setLoadedExistingInstance(null);
          // Clear date-specific form fields when changing dates (unless we have an original existing instance)
          // Note: Don't reset percentageCompleted or progressCountCompleted here — those are
          // goal/student-dependent and managed by fetchLastProgress to avoid race conditions.
          if (!existingInstance) {
            setDescription('');
            setDuration('');
            setCountComplete('');
            setStartTime('');
            setEndTime('');
          }
        } catch (error) {
          console.error('Error checking for existing instance:', error);
        }
      } else {
        // Clear loaded instance if conditions are not met
        setLoadedExistingInstance(null);
      }
    };

    checkExistingInstance();

    // Cleanup function to cancel the effect if dependencies change
    return () => {
      cancelled = true;
    };
  }, [selectedGoal, selectedStudent, date, allowMultipleRecordsPerDay, existingInstance]);

  // Timer functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerRunning && timerStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((new Date().getTime() - timerStartTime.getTime()) / 1000);
        setElapsedTime(elapsed);
        
        // Check if we've reached the goal duration and should play alarm
        if (timerAlarmEnabled && selectedGoalData?.minutesPerSession) {
          const goalSeconds = selectedGoalData.minutesPerSession * 60;
          if (elapsed === goalSeconds) {
            playAlarmSound();
          }
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [timerRunning, timerStartTime, timerAlarmEnabled, selectedGoalData]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimerToggle = () => {
    if (!timerRunning) {
      // Start timer
      setTimerStartTime(new Date());
      const now = new Date();
      // Format time in user's timezone
      setStartTime(formatTimeToString(now, timezone));
      setTimerRunning(true);
    } else {
      // Stop timer
      const now = new Date();
      // Format time in user's timezone
      setEndTime(formatTimeToString(now, timezone));
      setDuration(Math.ceil(elapsedTime / 60)); // Convert to minutes
      setTimerRunning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!selectedGoalData || !selectedStudent || !selectedStudentData) return;

      // Calculate duration if start and end times are provided
      let calculatedDuration = duration;
      if (startTime && endTime) {
        const start = new Date(`${date} ${startTime}`);
        const end = new Date(`${date} ${endTime}`);
        calculatedDuration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes
      }

      // Create activity instance
      // Note: We use any type here because Firestore expects Timestamp objects but our type defines Date
      const activityInstanceData: any = {
        goalId: selectedGoal,
        studentId: selectedStudent,
        homeschoolId,
        description,
        date: dateToFirestoreTimestamp(date, timezone),
        createdBy: userId
      };

      if (startTime) activityInstanceData.startTime = localDateTimeToFirestoreTimestamp(date, startTime, timezone);
      if (endTime) activityInstanceData.endTime = localDateTimeToFirestoreTimestamp(date, endTime, timezone);
      if (calculatedDuration) activityInstanceData.duration = Number(calculatedDuration);
      
      // Add percentage tracking
      if (selectedActivity?.progressReportingStyle.percentageCompletion) {
        activityInstanceData.percentageCompleted = percentageCompleted;
        // Also save as endingPercentage for backward compatibility temporarily
        activityInstanceData.endingPercentage = percentageCompleted;
      }
      
      // Add count tracking
      if (selectedActivity?.progressReportingStyle.progressCount) {
        // Use slider value if goal has a target, otherwise use manual input
        if (selectedGoalData.progressCount) {
          activityInstanceData.countCompleted = progressCountCompleted;
        } else if (countComplete !== '') {
          activityInstanceData.countCompleted = Number(countComplete);
        }
      }

      const instanceToUpdate = existingInstance || loadedExistingInstance;

      if (instanceToUpdate) {
        // Update existing activity instance
        await updateDoc(doc(db, 'activityInstances', instanceToUpdate.id), activityInstanceData);
      } else {
        // Create new activity instance
        await addDoc(collection(db, 'activityInstances'), activityInstanceData);

        // Update goal progress (only for new instances)
        const updates: any = {};
        if (selectedGoalData.timesDone !== undefined) {
          updates.timesDone = increment(1);
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, 'goals', selectedGoal), updates);
        }
      }

      // Update last activity timestamps
      await updateStudentLastActivity(selectedStudent);
      await updateLastActivity(userId);

      onActivityRecorded();
      onClose();
    } catch (error: any) {
      console.error('Error recording activity:', error);
      alert(`Error recording activity: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
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
        backgroundColor: 'var(--hs-bg)',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2>{existingInstance || loadedExistingInstance ? 'Edit Activity' : 'Record Activity'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Select Goal *
            </label>
            <select
              value={selectedGoal}
              onChange={(e) => {
                setSelectedGoal(e.target.value);
                setSelectedStudent(''); // Clear student selection when goal changes
              }}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid var(--hs-border-input)',
                borderRadius: '4px'
              }}
            >
              <option value="">Choose a goal...</option>
              {goals.map(goal => {
                const activity = activities.find(a => a.id === goal.activityId);
                const goalStudents = students.filter(s => goal.studentIds?.includes(s.id));
                const studentNames = goalStudents.map(s => s.name).join(', ') || 'Unknown students';
                return (
                  <option key={goal.id} value={goal.id}>
                    {studentNames} - {activity?.name}
                    {goal.timesPerWeek && ` (${goal.timesPerWeek}x/week)`}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedGoalData && goalStudents.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Select Student *
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid var(--hs-border-input)',
                  borderRadius: '4px'
                }}
              >
                <option value="">Choose which student...</option>
                {goalStudents.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedGoalData && selectedActivity && selectedStudent && (
            <>
              <div style={{ 
                backgroundColor: 'var(--hs-bg-elevated)', 
                padding: '10px', 
                borderRadius: '4px',
                marginBottom: '15px' 
              }}>
                <strong>{selectedStudentData?.name || 'Select a student'}</strong> is doing <strong>{selectedActivity.name}</strong>
                {selectedGoalData.minutesPerSession && (
                  <div style={{ fontSize: '14px', marginTop: '4px' }}>
                    Goal: {selectedGoalData.minutesPerSession} minutes per session
                  </div>
                )}
                {selectedGoalData.dailyPercentageIncrease && (
                  <div style={{ fontSize: '14px', marginTop: '4px' }}>
                    Goal: {selectedGoalData.dailyPercentageIncrease}% increase
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '16px',
                    border: '1px solid var(--hs-border-input)',
                    borderRadius: '4px'
                  }}
                />
              </div>

              {selectedActivity.progressReportingStyle.timesTotal && (
                <>
                  <div style={{ 
                    marginBottom: '15px',
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: selectedGoalData?.minutesPerSession && elapsedTime >= selectedGoalData.minutesPerSession * 60 ? 'var(--hs-bg-card-success)' : 'var(--hs-bg-elevated)',
                    borderRadius: '8px',
                    border: selectedGoalData?.minutesPerSession && elapsedTime >= selectedGoalData.minutesPerSession * 60 ? '2px solid #28a745' : 'none'
                  }}>
                    <div style={{ fontSize: '32px', fontFamily: 'monospace', marginBottom: '10px' }}>
                      {formatTime(elapsedTime)}
                    </div>
                    {selectedGoalData?.minutesPerSession && elapsedTime >= selectedGoalData.minutesPerSession * 60 && (
                      <div style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
                        🎉 Goal Reached!
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleTimerToggle}
                      style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        backgroundColor: timerRunning ? '#dc3545' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {timerRunning ? 'Stop Timer' : 'Start Timer'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={timerRunning}
                        style={{
                          width: '100%',
                          padding: '8px',
                          fontSize: '16px',
                          border: '1px solid var(--hs-border-input)',
                          borderRadius: '4px',
                          backgroundColor: timerRunning ? 'var(--hs-bg-elevated)' : 'var(--hs-bg-input)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        End Time
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={timerRunning}
                        style={{
                          width: '100%',
                          padding: '8px',
                          fontSize: '16px',
                          border: '1px solid var(--hs-border-input)',
                          borderRadius: '4px',
                          backgroundColor: timerRunning ? 'var(--hs-bg-elevated)' : 'var(--hs-bg-input)'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
                      min="1"
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        border: '1px solid var(--hs-border-input)',
                        borderRadius: '4px'
                      }}
                      placeholder={selectedGoalData.minutesPerSession ? `Goal: ${selectedGoalData.minutesPerSession} minutes` : 'Enter duration'}
                    />
                    {startTime && endTime && (
                      <div style={{ fontSize: '12px', color: 'var(--hs-text-secondary)', marginTop: '4px' }}>
                        Duration will be calculated from times
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedActivity.progressReportingStyle.percentageCompletion && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px' }}>
                    Percent of Completion
                  </label>
                  <div style={{ 
                    backgroundColor: 'var(--hs-bg-elevated)', 
                    padding: '15px', 
                    borderRadius: '8px',
                    border: '1px solid var(--hs-border-light)'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px'
                    }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4285f4' }}>
                        {percentageCompleted.toFixed(1)}%
                      </span>
                      {lastPercentageCompleted > 0 && (
                        <span style={{ fontSize: '14px', color: 'var(--hs-text-secondary)' }}>
                          Last recorded: {lastPercentageCompleted.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={selectedGoalData.percentageGoal || 100}
                      step="0.5"
                      value={percentageCompleted}
                      onChange={(e) => setPercentageCompleted(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '4px',
                        outline: 'none',
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        background: `linear-gradient(to right, #4285f4 0%, #4285f4 ${(percentageCompleted / (selectedGoalData.percentageGoal || 100)) * 100}%, #ddd ${(percentageCompleted / (selectedGoalData.percentageGoal || 100)) * 100}%, #ddd 100%)`,
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '5px',
                      fontSize: '12px',
                      color: 'var(--hs-text-secondary)'
                    }}>
                      <span>0%</span>
                      <span>{selectedGoalData.percentageGoal || 100}%</span>
                    </div>
                    {(selectedGoalData.dailyPercentageIncrease || selectedGoalData.percentageGoal) && (
                      <div style={{ 
                        fontSize: '14px', 
                        color: 'var(--hs-text-secondary)', 
                        marginTop: '10px',
                        backgroundColor: 'var(--hs-bg)',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0'
                      }}>
                        {selectedGoalData.dailyPercentageIncrease && (
                          <>Target today: {Math.min(selectedGoalData.percentageGoal || 100, lastPercentageCompleted + selectedGoalData.dailyPercentageIncrease).toFixed(1)}% 
                          (+{selectedGoalData.dailyPercentageIncrease}% from last)</>
                        )}
                        {selectedGoalData.percentageGoal && (
                          <div>Goal: {selectedGoalData.percentageGoal}%</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedActivity.progressReportingStyle.progressCount && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px' }}>
                    {selectedActivity.progressCountName || 'Count'} Completed
                  </label>
                  {selectedGoalData.progressCount ? (
                    // Show slider when goal has a target
                    <div style={{ 
                      backgroundColor: 'var(--hs-bg-elevated)', 
                      padding: '15px', 
                      borderRadius: '8px',
                      border: '1px solid var(--hs-border-light)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px'
                      }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4285f4' }}>
                          {progressCountCompleted} / {selectedGoalData.progressCount}
                        </span>
                        {lastProgressCountCompleted > 0 && (
                          <span style={{ fontSize: '14px', color: 'var(--hs-text-secondary)' }}>
                            Last recorded: {lastProgressCountCompleted}
                          </span>
                        )}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={selectedGoalData.progressCount}
                        step="1"
                        value={progressCountCompleted}
                        onChange={(e) => setProgressCountCompleted(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: '8px',
                          borderRadius: '4px',
                          outline: 'none',
                          WebkitAppearance: 'none',
                          appearance: 'none',
                          background: `linear-gradient(to right, #4285f4 0%, #4285f4 ${(progressCountCompleted / selectedGoalData.progressCount) * 100}%, #ddd ${(progressCountCompleted / selectedGoalData.progressCount) * 100}%, #ddd 100%)`,
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '5px',
                        fontSize: '12px',
                        color: 'var(--hs-text-secondary)'
                      }}>
                        <span>0</span>
                        <span>{selectedGoalData.progressCount}</span>
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: 'var(--hs-text-secondary)', 
                        marginTop: '10px',
                        backgroundColor: 'var(--hs-bg)',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0'
                      }}>
                        Progress: {((progressCountCompleted / selectedGoalData.progressCount) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ) : (
                    // Show regular input when no goal target
                    <input
                      type="number"
                      value={countComplete}
                      onChange={(e) => setCountComplete(e.target.value ? Number(e.target.value) : '')}
                      min="0"
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        border: '1px solid var(--hs-border-input)',
                        borderRadius: '4px'
                      }}
                      placeholder={`Number of ${selectedActivity.progressCountName || 'items'} completed`}
                    />
                  )}
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Notes (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '16px',
                    border: '1px solid var(--hs-border-input)',
                    borderRadius: '4px',
                    minHeight: '60px'
                  }}
                  placeholder="Any notes about this activity session..."
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving || !selectedGoal || !selectedStudent}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !selectedGoal || !selectedStudent ? 0.6 : 1
              }}
            >
              {saving ? (existingInstance || loadedExistingInstance ? 'Updating...' : 'Recording...') : (existingInstance || loadedExistingInstance ? 'Update Activity' : 'Record Activity')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityInstanceForm;
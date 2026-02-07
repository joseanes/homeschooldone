import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, increment, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityInstance, Goal, Activity, Person } from '../types';
import { updateStudentLastActivity, updateLastActivity } from '../utils/activityTracking';
import { playAlarmSound } from '../utils/alarmSound';
import { createUTCDateFromString, getStartOfDayUTC, getEndOfDayUTC, dateToFirestoreTimestamp, formatDateToString, formatDateToStringUTC } from '../utils/dateUtils';

interface ActivityInstanceFormProps {
  goals: Goal[];
  activities: Activity[];
  students: Person[];
  userId: string;
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
  const [startingPercentage, setStartingPercentage] = useState<number | ''>('');
  const [endingPercentage, setEndingPercentage] = useState<number | ''>('');
  const [countComplete, setCountComplete] = useState<number | ''>('');
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

  // Populate form fields when editing existing instance
  useEffect(() => {
    if (existingInstance) {
      setSelectedGoal(existingInstance.goalId);
      setSelectedStudent(existingInstance.studentId);
      setDescription(existingInstance.description || '');
      // Use UTC formatting since dates are stored as UTC in Firestore
      setDate(formatDateToStringUTC(existingInstance.date));
      setDuration(existingInstance.duration || '');
      setStartingPercentage(existingInstance.startingPercentage || '');
      setEndingPercentage(existingInstance.endingPercentage || '');
      setCountComplete(existingInstance.countCompleted || '');
      
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
      console.log('=== ActivityInstanceForm: useEffect triggered ===');
      console.log('Checking for existing instances with:', {
        allowMultipleRecordsPerDay,
        selectedGoal,
        selectedStudent,
        date,
        existingInstance: !!existingInstance,
        existingInstanceId: existingInstance?.id,
        loadedExistingInstance: !!loadedExistingInstance,
        loadedExistingInstanceId: loadedExistingInstance?.id
      });
      
      // Check if all conditions are met for searching
      if (!allowMultipleRecordsPerDay) {
        console.log('Multiple records per day is disabled');
        if (!selectedGoal) console.log('Missing selectedGoal');
        if (!selectedStudent) console.log('Missing selectedStudent');
        if (!date) console.log('Missing date');
      }
      
      if (!allowMultipleRecordsPerDay && selectedGoal && selectedStudent && date) {
        console.log('ActivityInstanceForm: Searching for existing instance for', { selectedGoal, selectedStudent, date });
        try {
          // First, let's debug by getting ALL instances for this goal/student combo
          const debugQuery = query(
            collection(db, 'activityInstances'),
            where('goalId', '==', selectedGoal),
            where('studentId', '==', selectedStudent)
          );
          const debugSnapshot = await getDocs(debugQuery);
          console.log('DEBUG: All instances for this goal/student:', debugSnapshot.docs.length);
          let matchingInstance: { doc: any; data: any } | null = null;
          debugSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const instanceDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
            // Use UTC formatting since dates are stored as UTC in Firestore
            const instanceDateStringUTC = formatDateToStringUTC(instanceDate);
            const instanceDateStringLocal = formatDateToString(instanceDate);
            console.log('DEBUG: Instance', {
              id: doc.id,
              date: instanceDate,
              dateStringUTC: instanceDateStringUTC,
              dateStringLocal: instanceDateStringLocal,
              dateISO: instanceDate.toISOString(),
              rawDate: data.date,
              matchesSelectedDate: instanceDateStringUTC === date
            });
            
            // If we find a match, store it
            if (instanceDateStringUTC === date && !matchingInstance) {
              matchingInstance = { doc, data };
            }
          });
          
          // Check if this effect has been cancelled
          if (cancelled) return;
          
          // If we found a matching instance through simple date string comparison, load it
          if (matchingInstance) {
            console.log('DEBUG: Found matching instance through string comparison!', (matchingInstance as any).doc.id);
            const { doc, data } = matchingInstance as { doc: any; data: any };
            
            // Skip if this is the same instance we're already editing
            if (existingInstance && doc.id === existingInstance.id) {
              console.log('ActivityInstanceForm: Same instance already loaded, skipping');
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
            
            // Populate form with existing data
            console.log('ActivityInstanceForm: Populating form with matching instance');
            setDescription(instance.description || '');
            setDuration(instance.duration || '');
            setStartingPercentage(instance.startingPercentage || '');
            setEndingPercentage(instance.endingPercentage || '');
            setCountComplete(instance.countCompleted || '');
            
            // Convert times if they exist
            if (instance.startTime) {
              const startTimeDate = instance.startTime instanceof Date 
                ? instance.startTime
                : new Date(instance.startTime);
              setStartTime(startTimeDate.toTimeString().slice(0, 5));
            }
            if (instance.endTime) {
              const endTimeDate = instance.endTime instanceof Date 
                ? instance.endTime
                : new Date(instance.endTime);
              setEndTime(endTimeDate.toTimeString().slice(0, 5));
            }
            
            // Store the instance for updating
            setLoadedExistingInstance(instance);
            console.log('ActivityInstanceForm: Instance loaded successfully', instance.id);
            return; // Skip the date range query since we found it
          }
          
          // Parse the date to get start and end of day in UTC
          // Use utility functions for consistent date handling
          const dateObj = createUTCDateFromString(date);
          const startOfDay = getStartOfDayUTC(dateObj);
          const endOfDay = getEndOfDayUTC(dateObj);
          
          console.log('Date range for query:', {
            date,
            dateObj: dateObj.toISOString(),
            dateObjLocal: dateObj.toString(),
            startOfDay: startOfDay.toISOString(),
            endOfDay: endOfDay.toISOString(),
            timezoneOffset: dateObj.getTimezoneOffset()
          });

          // Since we already found a match with simple date comparison above,
          // we don't need to run the date range query anymore
          console.log('ActivityInstanceForm: Skipping date range query since we already checked all instances');
          
          // If no match was found, clear the form
          if (!matchingInstance) {
            console.log('ActivityInstanceForm: No instances found for this date, clearing form');
            setLoadedExistingInstance(null);
            // Clear form fields when changing dates (unless we have an original existing instance)
            if (!existingInstance) {
              setDescription('');
              setDuration('');
              setStartingPercentage('');
              setEndingPercentage('');
              setCountComplete('');
              setStartTime('');
              setEndTime('');
            }
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
      setStartTime(now.toTimeString().slice(0, 5));
      setTimerRunning(true);
    } else {
      // Stop timer
      const now = new Date();
      setEndTime(now.toTimeString().slice(0, 5));
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
        description,
        date: dateToFirestoreTimestamp(date),
        createdBy: userId
      };

      if (startTime) activityInstanceData.startTime = Timestamp.fromDate(new Date(`${date} ${startTime}`));
      if (endTime) activityInstanceData.endTime = Timestamp.fromDate(new Date(`${date} ${endTime}`));
      if (calculatedDuration) activityInstanceData.duration = Number(calculatedDuration);
      
      // Add percentage tracking
      if (selectedActivity?.progressReportingStyle.percentageCompletion) {
        if (startingPercentage !== '') activityInstanceData.startingPercentage = Number(startingPercentage);
        if (endingPercentage !== '') activityInstanceData.endingPercentage = Number(endingPercentage);
      }
      
      // Add count tracking
      if (selectedActivity?.progressReportingStyle.progressCount && countComplete !== '') {
        activityInstanceData.countCompleted = Number(countComplete);
      }

      const instanceToUpdate = existingInstance || loadedExistingInstance;
      console.log('ActivityInstanceForm: Saving activity', {
        allowMultipleRecordsPerDay,
        existingInstance: !!existingInstance,
        loadedExistingInstance: !!loadedExistingInstance,
        willUpdate: !!instanceToUpdate,
        instanceId: instanceToUpdate?.id
      });
      
      if (instanceToUpdate) {
        // Update existing activity instance
        console.log('ActivityInstanceForm: Updating existing instance', instanceToUpdate.id);
        await updateDoc(doc(db, 'activityInstances', instanceToUpdate.id), activityInstanceData);
      } else {
        // Create new activity instance
        console.log('ActivityInstanceForm: Creating new instance');
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
        backgroundColor: 'white',
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
                border: '1px solid #ccc',
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
                  border: '1px solid #ccc',
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
                backgroundColor: '#f0f0f0', 
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
                  onChange={(e) => {
                    console.log('Date input changed:', e.target.value);
                    setDate(e.target.value);
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '16px',
                    border: '1px solid #ccc',
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
                    backgroundColor: selectedGoalData?.minutesPerSession && elapsedTime >= selectedGoalData.minutesPerSession * 60 ? '#d4edda' : '#f0f0f0',
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
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          backgroundColor: timerRunning ? '#f0f0f0' : 'white'
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
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          backgroundColor: timerRunning ? '#f0f0f0' : 'white'
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
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      placeholder={selectedGoalData.minutesPerSession ? `Goal: ${selectedGoalData.minutesPerSession} minutes` : 'Enter duration'}
                    />
                    {startTime && endTime && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Duration will be calculated from times
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedActivity.progressReportingStyle.percentageCompletion && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        Starting Percentage
                      </label>
                      <input
                        type="number"
                        value={startingPercentage}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : '';
                          setStartingPercentage(val);
                          // Auto-calculate ending if we have daily increase
                          if (val !== '' && selectedGoalData.dailyPercentageIncrease) {
                            setEndingPercentage(Number(val) + selectedGoalData.dailyPercentageIncrease);
                          }
                        }}
                        min="0"
                        max="100"
                        step="0.1"
                        style={{
                          width: '100%',
                          padding: '8px',
                          fontSize: '16px',
                          border: '1px solid #ccc',
                          borderRadius: '4px'
                        }}
                        placeholder="e.g., 45"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        Ending Percentage
                      </label>
                      <input
                        type="number"
                        value={endingPercentage}
                        onChange={(e) => setEndingPercentage(e.target.value ? Number(e.target.value) : '')}
                        min="0"
                        max="100"
                        step="0.1"
                        style={{
                          width: '100%',
                          padding: '8px',
                          fontSize: '16px',
                          border: '1px solid #ccc',
                          borderRadius: '4px'
                        }}
                        placeholder="e.g., 47"
                      />
                    </div>
                  </div>
                  {selectedGoalData.dailyPercentageIncrease && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '-10px', marginBottom: '15px' }}>
                      Daily goal: {selectedGoalData.dailyPercentageIncrease}% increase
                    </div>
                  )}
                </>
              )}

              {selectedActivity.progressReportingStyle.progressCount && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    {selectedActivity.progressCountName || 'Count'} Completed
                  </label>
                  <input
                    type="number"
                    value={countComplete}
                    onChange={(e) => setCountComplete(e.target.value ? Number(e.target.value) : '')}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '16px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    placeholder={`Number of ${selectedActivity.progressCountName || 'items'} completed`}
                  />
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
                    border: '1px solid #ccc',
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
                backgroundColor: '#666',
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
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityInstance, Goal, Activity, Person } from '../types';

interface ActivityInstanceFormProps {
  goals: Goal[];
  activities: Activity[];
  students: Person[];
  userId: string;
  onClose: () => void;
  onActivityRecorded: () => void;
}

const ActivityInstanceForm: React.FC<ActivityInstanceFormProps> = ({
  goals,
  activities,
  students,
  userId,
  onClose,
  onActivityRecorded
}) => {
  const [selectedGoal, setSelectedGoal] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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

  const selectedGoalData = goals.find(g => g.id === selectedGoal);
  const selectedActivity = selectedGoalData ? activities.find(a => a.id === selectedGoalData.activityId) : null;
  const selectedStudent = selectedGoalData ? students.find(s => s.id === selectedGoalData.studentId) : null;

  // Auto-fill duration based on goal settings
  useEffect(() => {
    if (selectedGoalData?.minutesPerSession && selectedActivity?.progressReportingStyle.timesTotal) {
      setDuration(selectedGoalData.minutesPerSession);
    }
  }, [selectedGoalData, selectedActivity]);

  // Timer functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerRunning && timerStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - timerStartTime.getTime()) / 1000));
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [timerRunning, timerStartTime]);

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
      if (!selectedGoalData || !selectedStudent) return;

      // Calculate duration if start and end times are provided
      let calculatedDuration = duration;
      if (startTime && endTime) {
        const start = new Date(`${date} ${startTime}`);
        const end = new Date(`${date} ${endTime}`);
        calculatedDuration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes
      }

      // Create activity instance
      const activityInstanceData: Omit<ActivityInstance, 'id'> = {
        goalId: selectedGoal,
        studentId: selectedGoalData.studentId,
        description,
        date: new Date(date),
        createdBy: userId
      };

      if (startTime) activityInstanceData.startTime = new Date(`${date} ${startTime}`);
      if (endTime) activityInstanceData.endTime = new Date(`${date} ${endTime}`);
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

      await addDoc(collection(db, 'activityInstances'), activityInstanceData);

      // Update goal progress
      const updates: any = {};
      if (selectedGoalData.timesDone !== undefined) {
        updates.timesDone = increment(1);
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'goals', selectedGoal), updates);
      }

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
        <h2>Record Activity</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Select Goal *
            </label>
            <select
              value={selectedGoal}
              onChange={(e) => setSelectedGoal(e.target.value)}
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
                const student = students.find(s => s.id === goal.studentId);
                return (
                  <option key={goal.id} value={goal.id}>
                    {student?.name} - {activity?.name}
                    {goal.timesPerWeek && ` (${goal.timesPerWeek}x/week)`}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedGoalData && selectedActivity && (
            <>
              <div style={{ 
                backgroundColor: '#f0f0f0', 
                padding: '10px', 
                borderRadius: '4px',
                marginBottom: '15px' 
              }}>
                <strong>{selectedStudent?.name}</strong> is doing <strong>{selectedActivity.name}</strong>
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
                    backgroundColor: '#f0f0f0',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '32px', fontFamily: 'monospace', marginBottom: '10px' }}>
                      {formatTime(elapsedTime)}
                    </div>
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
              disabled={saving || !selectedGoal}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !selectedGoal ? 0.6 : 1
              }}
            >
              {saving ? 'Recording...' : 'Record Activity'}
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
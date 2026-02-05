import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Goal, Activity, Person } from '../types';

interface GoalFormProps {
  activities: Activity[];
  students: Person[];
  userId: string;
  homeschoolId: string;
  onClose: () => void;
  onGoalAdded: () => void;
}

const GoalForm: React.FC<GoalFormProps> = ({ 
  activities, 
  students, 
  userId, 
  homeschoolId,
  onClose, 
  onGoalAdded 
}) => {
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [timesPerWeek, setTimesPerWeek] = useState<number | ''>('');
  const [minutesPerSession, setMinutesPerSession] = useState<number | ''>('');
  const [targetPercentage, setTargetPercentage] = useState<number | ''>('');
  const [targetCount, setTargetCount] = useState<number | ''>('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedActivityData = activities.find(a => a.id === selectedActivity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const goalData: any = {
        studentIds: selectedStudents,
        activityId: selectedActivity,
        tutorOrParentId: userId,
        homeschoolId,
        createdAt: new Date()
      };

      // Add optional fields based on activity type and user input
      if (timesPerWeek) goalData.timesPerWeek = Number(timesPerWeek);
      if (selectedActivityData?.progressReportingStyle.timesTotal && minutesPerSession) {
        goalData.minutesPerSession = Number(minutesPerSession);
      }
      if (selectedActivityData?.progressReportingStyle.percentageCompletion && targetPercentage) {
        goalData.dailyPercentageIncrease = Number(targetPercentage);
      }
      if (selectedActivityData?.progressReportingStyle.progressCount && targetCount) {
        goalData.progressCount = Number(targetCount);
      }
      if (deadline) goalData.deadline = new Date(deadline);

      await addDoc(collection(db, 'goals'), goalData);
      onGoalAdded();
      onClose();
    } catch (error: any) {
      console.error('Error creating goal:', error);
      alert(`Error creating goal: ${error.message || 'Unknown error'}`);
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
        <h2>Create Goal</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Select Students * (Choose one or more)
            </label>
            <div style={{
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '10px',
              maxHeight: '150px',
              overflow: 'auto'
            }}>
              {students.map(student => (
                <label key={student.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudents([...selectedStudents, student.id]);
                      } else {
                        setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  {student.name}
                </label>
              ))}
            </div>
            {selectedStudents.length === 0 && (
              <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                Please select at least one student
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Select Activity *
            </label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            >
              <option value="">Choose an activity...</option>
              {activities.map(activity => (
                <option key={activity.id} value={activity.id}>
                  {activity.name} ({activity.subjectId})
                </option>
              ))}
            </select>
          </div>

          {selectedActivityData && (
            <>
              <div style={{ 
                backgroundColor: '#f0f0f0', 
                padding: '10px', 
                borderRadius: '4px',
                marginBottom: '15px' 
              }}>
                <strong>This activity tracks:</strong>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {selectedActivityData.progressReportingStyle.percentageCompletion && 
                    <li>Percentage completion</li>}
                  {selectedActivityData.progressReportingStyle.timesTotal && 
                    <li>Time spent</li>}
                  {selectedActivityData.progressReportingStyle.progressCount && 
                    <li>{selectedActivityData.progressCountName || 'Count'}</li>}
                </ul>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Times per Week
                </label>
                <input
                  type="number"
                  value={timesPerWeek}
                  onChange={(e) => setTimesPerWeek(e.target.value ? Number(e.target.value) : '')}
                  min="1"
                  max="7"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  placeholder="e.g., 5 (for 5 days a week)"
                />
              </div>

              {selectedActivityData.progressReportingStyle.timesTotal && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    Minutes per Session
                  </label>
                  <input
                    type="number"
                    value={minutesPerSession}
                    onChange={(e) => setMinutesPerSession(e.target.value ? Number(e.target.value) : '')}
                    min="1"
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
              )}

              {selectedActivityData.progressReportingStyle.percentageCompletion && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    Daily Percentage Increase
                  </label>
                  <input
                    type="number"
                    value={targetPercentage}
                    onChange={(e) => setTargetPercentage(e.target.value ? Number(e.target.value) : '')}
                    min="0.1"
                    max="100"
                    step="0.1"
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '16px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    placeholder="e.g., 2 (for 2% increase per day)"
                  />
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    How much percentage progress per day when the activity is performed
                  </div>
                </div>
              )}

              {selectedActivityData.progressReportingStyle.progressCount && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    Target {selectedActivityData.progressCountName || 'Count'}
                  </label>
                  <input
                    type="number"
                    value={targetCount}
                    onChange={(e) => setTargetCount(e.target.value ? Number(e.target.value) : '')}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '16px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    placeholder="e.g., 50 (chapters, problems, etc.)"
                  />
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Deadline (optional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving || selectedStudents.length === 0 || !selectedActivity}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || selectedStudents.length === 0 || !selectedActivity ? 0.6 : 1
              }}
            >
              {saving ? 'Creating...' : 'Create Goal'}
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

export default GoalForm;
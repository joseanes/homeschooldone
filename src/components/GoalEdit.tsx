import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Goal, Activity, Person } from '../types';

interface GoalEditProps {
  goal: Goal;
  activity: Activity;
  student: Person;
  onClose: () => void;
  onUpdate: (updatedGoal: Goal) => void;
}

const GoalEdit: React.FC<GoalEditProps> = ({ goal, activity, student, onClose, onUpdate }) => {
  const [timesPerWeek, setTimesPerWeek] = useState<number | ''>(goal.timesPerWeek || '');
  const [minutesPerSession, setMinutesPerSession] = useState<number | ''>(goal.minutesPerSession || '');
  const [dailyPercentageIncrease, setDailyPercentageIncrease] = useState<number | ''>(goal.dailyPercentageIncrease || '');
  const [targetCount, setTargetCount] = useState<number | ''>(goal.progressCount || '');
  const [deadline, setDeadline] = useState(
    goal.deadline ? 
      (goal.deadline instanceof Date ? 
        goal.deadline.toISOString().split('T')[0] : 
        new Date((goal.deadline as any).seconds * 1000).toISOString().split('T')[0]) : 
      ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates: any = {};

      if (timesPerWeek) updates.timesPerWeek = Number(timesPerWeek);
      if (activity.progressReportingStyle.timesTotal && minutesPerSession) {
        updates.minutesPerSession = Number(minutesPerSession);
      }
      if (activity.progressReportingStyle.percentageCompletion && dailyPercentageIncrease) {
        updates.dailyPercentageIncrease = Number(dailyPercentageIncrease);
      }
      if (activity.progressReportingStyle.progressCount && targetCount) {
        updates.progressCount = Number(targetCount);
      }
      if (deadline) {
        updates.deadline = new Date(deadline);
      } else if (goal.deadline) {
        // Remove deadline if cleared
        updates.deadline = null;
      }

      await updateDoc(doc(db, 'goals', goal.id), updates);

      const updatedGoal = { 
        ...goal,
        timesPerWeek: timesPerWeek ? Number(timesPerWeek) : undefined,
        minutesPerSession: minutesPerSession ? Number(minutesPerSession) : undefined,
        dailyPercentageIncrease: dailyPercentageIncrease ? Number(dailyPercentageIncrease) : undefined,
        progressCount: targetCount ? Number(targetCount) : undefined,
        deadline: deadline ? new Date(deadline) : undefined
      };
      
      onUpdate(updatedGoal);
      onClose();
    } catch (error: any) {
      console.error('Error updating goal:', error);
      alert(`Error updating goal: ${error.message || 'Unknown error'}`);
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
      zIndex: 2000
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
        <h2>Edit Goal</h2>
        <div style={{ 
          backgroundColor: '#f0f0f0', 
          padding: '10px', 
          borderRadius: '4px',
          marginBottom: '15px' 
        }}>
          <strong>{student.name}</strong> is doing <strong>{activity.name}</strong>
        </div>

        <form onSubmit={handleSubmit}>
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

          {activity.progressReportingStyle.timesTotal && (
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

          {activity.progressReportingStyle.percentageCompletion && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Daily Percentage Increase
              </label>
              <input
                type="number"
                value={dailyPercentageIncrease}
                onChange={(e) => setDailyPercentageIncrease(e.target.value ? Number(e.target.value) : '')}
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
            </div>
          )}

          {activity.progressReportingStyle.progressCount && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Target {activity.progressCountName || 'Count'}
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

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
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

export default GoalEdit;
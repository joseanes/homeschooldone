import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Goal, Activity, Person } from '../types';

interface GoalEditProps {
  goal: Goal;
  activity: Activity;
  students: Person[];
  onClose: () => void;
  onUpdate: (updatedGoal: Goal) => void;
}

const GoalEdit: React.FC<GoalEditProps> = ({ goal, activity, students, onClose, onUpdate }) => {
  const [goalName, setGoalName] = useState(goal.name || '');
  const [timesPerWeek, setTimesPerWeek] = useState<number | ''>(goal.timesPerWeek || '');
  const [minutesPerSession, setMinutesPerSession] = useState<number | ''>(goal.minutesPerSession || '');
  const [dailyPercentageIncrease, setDailyPercentageIncrease] = useState<number | ''>(goal.dailyPercentageIncrease || '');
  const [percentageGoal, setPercentageGoal] = useState<number | ''>(goal.percentageGoal || '');
  const [targetCount, setTargetCount] = useState<number | ''>(goal.progressCount || '');
  const [startDate, setStartDate] = useState(
    goal.startDate ? 
      (goal.startDate instanceof Date ? 
        goal.startDate.toISOString().split('T')[0] : 
        new Date((goal.startDate as any).seconds * 1000).toISOString().split('T')[0]) : 
      ''
  );
  const [deadline, setDeadline] = useState(
    goal.deadline ? 
      (goal.deadline instanceof Date ? 
        goal.deadline.toISOString().split('T')[0] : 
        new Date((goal.deadline as any).seconds * 1000).toISOString().split('T')[0]) : 
      ''
  );
  const [studentCompletions, setStudentCompletions] = useState<{[studentId: string]: {completionDate?: string; grade?: string}}>(
    goal.studentCompletions ? Object.fromEntries(
      Object.entries(goal.studentCompletions).map(([studentId, completion]) => [
        studentId, 
        {
          completionDate: completion.completionDate ? 
            (completion.completionDate instanceof Date ? 
              completion.completionDate.toISOString().split('T')[0] : 
              new Date((completion.completionDate as any).seconds * 1000).toISOString().split('T')[0]) : 
            '',
          grade: completion.grade || ''
        }
      ])
    ) : {}
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates: any = {};

      // Save name
      if (goalName) updates.name = goalName;

      if (timesPerWeek) updates.timesPerWeek = Number(timesPerWeek);
      
      // Always save minutes per session if provided
      if (minutesPerSession) {
        updates.minutesPerSession = Number(minutesPerSession);
      }
      
      if (activity.progressReportingStyle.percentageCompletion) {
        if (dailyPercentageIncrease) updates.dailyPercentageIncrease = Number(dailyPercentageIncrease);
        if (percentageGoal) updates.percentageGoal = Number(percentageGoal);
      }
      if (activity.progressReportingStyle.progressCount && targetCount) {
        updates.progressCount = Number(targetCount);
      }
      
      // Save start date
      if (startDate) {
        updates.startDate = new Date(startDate);
      } else if (goal.startDate) {
        updates.startDate = null;
      }
      
      if (deadline) {
        updates.deadline = new Date(deadline);
      } else if (goal.deadline) {
        // Remove deadline if cleared
        updates.deadline = null;
      }

      // Save student completions
      const formattedCompletions: {[studentId: string]: {completionDate?: Date; grade?: string}} = {};
      Object.entries(studentCompletions).forEach(([studentId, completion]) => {
        if (completion.completionDate || completion.grade) {
          formattedCompletions[studentId] = {
            ...(completion.completionDate && { completionDate: new Date(completion.completionDate) }),
            ...(completion.grade && { grade: completion.grade })
          };
        }
      });
      
      if (Object.keys(formattedCompletions).length > 0) {
        updates.studentCompletions = formattedCompletions;
      } else if (goal.studentCompletions) {
        updates.studentCompletions = null;
      }

      await updateDoc(doc(db, 'goals', goal.id), updates);

      const updatedGoal = { 
        ...goal,
        name: goalName,
        timesPerWeek: timesPerWeek ? Number(timesPerWeek) : undefined,
        minutesPerSession: minutesPerSession ? Number(minutesPerSession) : undefined,
        dailyPercentageIncrease: dailyPercentageIncrease ? Number(dailyPercentageIncrease) : undefined,
        percentageGoal: percentageGoal ? Number(percentageGoal) : undefined,
        progressCount: targetCount ? Number(targetCount) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
        studentCompletions: formattedCompletions
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
          <strong>{students.map(s => s.name).join(', ')}</strong> {students.length === 1 ? 'is' : 'are'} doing <strong>{activity.name}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Goal Name
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="e.g., Chemistry 101 - First Semester"
            />
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

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Minutes per Session {(activity.requiresTimeTracking || activity.progressReportingStyle.timesTotal) ? '*' : '(optional)'}
            </label>
            <input
              type="number"
              value={minutesPerSession}
              onChange={(e) => setMinutesPerSession(e.target.value ? Number(e.target.value) : '')}
              min="1"
              required={activity.requiresTimeTracking || activity.progressReportingStyle.timesTotal}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="e.g., 45"
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Expected duration of each session in minutes
            </div>
          </div>

          {activity.progressReportingStyle.percentageCompletion && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Percentage Goal
                </label>
                <input
                  type="number"
                  value={percentageGoal}
                  onChange={(e) => setPercentageGoal(e.target.value ? Number(e.target.value) : '')}
                  min="1"
                  max="100"
                  step="1"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  placeholder="e.g., 95 (for 95% completion goal)"
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Target percentage completion for this goal (default: 100%)
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Daily Percentage Increase Goal (optional)
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
            </>
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
              Start Date (optional)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Goals will not appear on dashboards before this date
            </div>
          </div>

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

          {/* Student Completion Tracking */}
          <div style={{ 
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Student Completion Tracking</h3>
            {students.map(student => (
              <div key={student.id} style={{
                backgroundColor: 'white',
                borderRadius: '6px',
                padding: '15px',
                marginBottom: '10px',
                border: '1px solid #ddd'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>{student.name}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                      Completion Date
                    </label>
                    <input
                      type="date"
                      value={studentCompletions[student.id]?.completionDate || ''}
                      onChange={(e) => setStudentCompletions(prev => ({
                        ...prev,
                        [student.id]: {
                          ...prev[student.id],
                          completionDate: e.target.value
                        }
                      }))}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '14px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                      Grade/Score
                    </label>
                    <input
                      type="text"
                      value={studentCompletions[student.id]?.grade || ''}
                      onChange={(e) => setStudentCompletions(prev => ({
                        ...prev,
                        [student.id]: {
                          ...prev[student.id],
                          grade: e.target.value
                        }
                      }))}
                      placeholder="e.g., A+, 95%, Pass"
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '14px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
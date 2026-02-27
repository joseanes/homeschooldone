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
  const toISODate = (v: any): string => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (v.seconds) return new Date(v.seconds * 1000).toISOString().split('T')[0];
    return new Date(v).toISOString().split('T')[0];
  };

  const [studentCompletions, setStudentCompletions] = useState<{[studentId: string]: {completionDate?: string; grade?: string; startDate?: string; deadline?: string}}>(
    () => {
      const result: {[id: string]: {completionDate?: string; grade?: string; startDate?: string; deadline?: string}} = {};
      // Initialize for all students assigned to this goal
      for (const sid of goal.studentIds || []) {
        const sc = goal.studentCompletions?.[sid];
        result[sid] = {
          completionDate: toISODate(sc?.completionDate),
          grade: sc?.grade || '',
          startDate: toISODate(sc?.startDate || goal.startDate),
          deadline: toISODate(sc?.deadline || goal.deadline),
        };
      }
      return result;
    }
  );
  const [description, setDescription] = useState(goal.description || '');
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

      // Save description
      if (description) {
        updates.description = description;
      } else if (goal.description) {
        updates.description = null;
      }

      // Save student completions (includes per-student startDate, deadline, completionDate, grade)
      const formattedCompletions: {[studentId: string]: {completionDate?: Date; grade?: string; startDate?: Date; deadline?: Date}} = {};
      Object.entries(studentCompletions).forEach(([studentId, completion]) => {
        if (completion.completionDate || completion.grade || completion.startDate || completion.deadline) {
          formattedCompletions[studentId] = {
            ...(completion.completionDate && { completionDate: new Date(completion.completionDate) }),
            ...(completion.grade && { grade: completion.grade }),
            ...(completion.startDate && { startDate: new Date(completion.startDate) }),
            ...(completion.deadline && { deadline: new Date(completion.deadline) }),
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
        description: description || undefined,
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
                      Start Date (optional)
                    </label>
                    <input
                      type="date"
                      value={studentCompletions[student.id]?.startDate || ''}
                      onChange={(e) => setStudentCompletions(prev => ({
                        ...prev,
                        [student.id]: { ...prev[student.id], startDate: e.target.value }
                      }))}
                      style={{ width: '100%', padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                      Deadline (optional)
                    </label>
                    <input
                      type="date"
                      value={studentCompletions[student.id]?.deadline || ''}
                      onChange={(e) => setStudentCompletions(prev => ({
                        ...prev,
                        [student.id]: { ...prev[student.id], deadline: e.target.value }
                      }))}
                      style={{ width: '100%', padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                      Completion Date
                    </label>
                    <input
                      type="date"
                      value={studentCompletions[student.id]?.completionDate || ''}
                      onChange={(e) => setStudentCompletions(prev => ({
                        ...prev,
                        [student.id]: { ...prev[student.id], completionDate: e.target.value }
                      }))}
                      style={{ width: '100%', padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
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
                        [student.id]: { ...prev[student.id], grade: e.target.value }
                      }))}
                      placeholder="e.g., A+, 95%, Pass"
                      style={{ width: '100%', padding: '6px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for the transcript..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical'
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
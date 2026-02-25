import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Person, AdHocTask } from '../types';

interface AdHocTaskFormProps {
  homeschoolId: string;
  students: Person[];
  userId: string;
  timezone?: string;
  mode?: 'assign' | 'record';
  preSelectedStudent?: string;
  existingTask?: AdHocTask;
  onClose: () => void;
  onTaskAdded: () => void;
}

const AdHocTaskForm: React.FC<AdHocTaskFormProps> = ({
  homeschoolId,
  students,
  userId,
  timezone = 'America/New_York',
  mode = 'record',
  preSelectedStudent,
  existingTask,
  onClose,
  onTaskAdded
}) => {
  const getLocalDate = () => {
    const now = new Date();
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
  };

  const getEndOfWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + daysUntilSunday);
    return endOfWeek.toISOString().split('T')[0];
  };

  const isEditing = !!existingTask;
  const isAssignMode = mode === 'assign' && !isEditing;

  const [name, setName] = useState(existingTask?.name || '');
  const [description, setDescription] = useState(existingTask?.description || '');
  const [selectedStudent, setSelectedStudent] = useState(
    existingTask?.studentId || preSelectedStudent || (students.length === 1 ? students[0].id : '')
  );
  const [startDate, setStartDate] = useState(() => {
    if (existingTask?.startDate) {
      const d = existingTask.startDate instanceof Date ? existingTask.startDate : (existingTask.startDate as any)?.toDate ? (existingTask.startDate as any).toDate() : new Date(existingTask.startDate);
      return d.toISOString().split('T')[0];
    }
    return getLocalDate();
  });
  const [targetDate, setTargetDate] = useState(() => {
    if (existingTask?.targetDate) {
      const d = existingTask.targetDate instanceof Date ? existingTask.targetDate : (existingTask.targetDate as any)?.toDate ? (existingTask.targetDate as any).toDate() : new Date(existingTask.targetDate);
      return d.toISOString().split('T')[0];
    }
    return getEndOfWeek();
  });
  const [completedDate, setCompletedDate] = useState(() => {
    if (existingTask?.completedDate) {
      const d = existingTask.completedDate instanceof Date ? existingTask.completedDate : (existingTask.completedDate as any)?.toDate ? (existingTask.completedDate as any).toDate() : new Date(existingTask.completedDate);
      return d.toISOString().split('T')[0];
    }
    if (!isAssignMode && !isEditing) return getLocalDate();
    return '';
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedStudent) return;
    setSaving(true);

    try {
      if (isEditing && existingTask) {
        // Update existing task
        const updates: any = {
          name: name.trim(),
          description: description.trim() || null,
          targetDate: targetDate ? Timestamp.fromDate(new Date(targetDate + 'T12:00:00')) : null
        };
        if (completedDate) {
          updates.completedDate = Timestamp.fromDate(new Date(completedDate + 'T12:00:00'));
        } else {
          updates.completedDate = null;
        }
        await updateDoc(doc(db, 'adHocTasks', existingTask.id), updates);
      } else {
        // Create new task
        const taskData: any = {
          name: name.trim(),
          description: description.trim() || null,
          studentId: selectedStudent,
          homeschoolId,
          startDate: Timestamp.fromDate(new Date(startDate + 'T12:00:00')),
          createdBy: userId,
          createdAt: Timestamp.fromDate(new Date())
        };

        if (targetDate) {
          taskData.targetDate = Timestamp.fromDate(new Date(targetDate + 'T12:00:00'));
        }

        if (isAssignMode) {
          taskData.completedDate = null;
        } else {
          // Record mode: completed immediately
          taskData.completedDate = Timestamp.fromDate(new Date(completedDate + 'T12:00:00'));
        }

        await addDoc(collection(db, 'adHocTasks'), taskData);
      }

      onTaskAdded();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error saving task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = isEditing ? 'Complete Task' : isAssignMode ? 'Assign Task' : 'Record Activity';
  const subtitle = isEditing
    ? 'Mark this task as completed'
    : isAssignMode
    ? 'Assign a one-off task to a student'
    : 'Log a one-off task or activity (e.g., college application, project, field trip)';

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
        maxWidth: '450px',
        width: '90%'
      }}>
        <h2>{title}</h2>
        <p style={{ fontSize: '14px', color: '#666', marginTop: '-10px', marginBottom: '20px' }}>
          {subtitle}
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Student *
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              required
              disabled={isEditing || !!preSelectedStudent}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: (isEditing || !!preSelectedStudent) ? '#f0f0f0' : 'white'
              }}
            >
              <option value="">Select a student...</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Task Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isEditing}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: isEditing ? '#f0f0f0' : 'white'
              }}
              placeholder="e.g., Apply to XYZ College"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isEditing}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minHeight: '60px',
                resize: 'vertical',
                backgroundColor: isEditing ? '#f0f0f0' : 'white'
              }}
              placeholder="Additional details..."
            />
          </div>

          {/* Start Date - shown in assign mode or when creating */}
          {!isEditing && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
          )}

          {/* Target Date - shown in assign mode or when creating */}
          {(isAssignMode || !isEditing) && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
          )}

          {/* Date Completed - shown in record mode or when editing an existing task */}
          {(!isAssignMode || isEditing) && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Date Completed {isEditing ? '' : '*'}
              </label>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                required={!isAssignMode && !isEditing}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              {isEditing && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Set the date to mark this task as completed
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving || !name.trim() || !selectedStudent}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: isAssignMode ? '#17a2b8' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !name.trim() || !selectedStudent ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : isEditing ? 'Save' : isAssignMode ? 'Assign Task' : 'Save Activity'}
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

export default AdHocTaskForm;

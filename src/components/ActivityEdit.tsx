import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity } from '../types';

interface ActivityEditProps {
  activity: Activity;
  onClose: () => void;
  onUpdate: (updatedActivity: Activity) => void;
}

const ActivityEdit: React.FC<ActivityEditProps> = ({ activity, onClose, onUpdate }) => {
  const [name, setName] = useState(activity.name);
  const [subject, setSubject] = useState(activity.subjectId);
  const [description, setDescription] = useState(activity.description);
  const [progressTypes, setProgressTypes] = useState(activity.progressReportingStyle);
  const [progressCountName, setProgressCountName] = useState(activity.progressCountName || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates: any = {
        name: name.trim(),
        subjectId: subject.trim(),
        description: description.trim(),
        progressReportingStyle: progressTypes,
        requiresTimeTracking: progressTypes.timesTotal || false
      };

      if (progressTypes.progressCount && progressCountName.trim()) {
        updates.progressCountName = progressCountName.trim();
      }

      await updateDoc(doc(db, 'activities', activity.id), updates);

      const updatedActivity = { 
        ...activity,
        name: name.trim(),
        subjectId: subject.trim(),
        description: description.trim(),
        progressReportingStyle: progressTypes,
        requiresTimeTracking: progressTypes.timesTotal || false,
        progressCountName: progressTypes.progressCount ? progressCountName.trim() : undefined
      };
      
      onUpdate(updatedActivity);
      onClose();
    } catch (error: any) {
      console.error('Error updating activity:', error);
      alert(`Error updating activity: ${error.message || 'Unknown error'}`);
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
        <h2>Edit Activity</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Activity Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="e.g., Piano Practice, 4th Grade Math"
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Subject/Area *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="e.g., Music, Mathematics, Science"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Description
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
              placeholder="Describe this activity..."
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              How to Track Progress:
            </label>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '-5px', marginBottom: '10px' }}>
              Times/Week always tracked.
            </p>
            
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={progressTypes.percentageCompletion}
                onChange={(e) => setProgressTypes({
                  ...progressTypes,
                  percentageCompletion: e.target.checked
                })}
                style={{ marginRight: '8px' }}
              />
              Percent of Completion
            </label>

            <label style={{ display: 'block', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={progressTypes.timesTotal}
                onChange={(e) => setProgressTypes({
                  ...progressTypes,
                  timesTotal: e.target.checked
                })}
                style={{ marginRight: '8px' }}
              />
              Track Time (requires minutes in goals)
            </label>


            <label style={{ display: 'block', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={progressTypes.progressCount}
                onChange={(e) => setProgressTypes({
                  ...progressTypes,
                  progressCount: e.target.checked
                })}
                style={{ marginRight: '8px' }}
              />
              Custom Progress Metric
            </label>

            {progressTypes.progressCount && (
              <input
                type="text"
                value={progressCountName}
                onChange={(e) => setProgressCountName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  marginTop: '8px'
                }}
                placeholder="What to count? (e.g., chapters, problems, laps)"
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving || !name.trim() || !subject.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !name.trim() || !subject.trim() ? 0.6 : 1
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

export default ActivityEdit;
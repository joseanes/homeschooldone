import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity } from '../types';

interface ActivityFormProps {
  homeschoolId: string;
  onClose: () => void;
  onActivityAdded: () => void;
}

const ActivityForm: React.FC<ActivityFormProps> = ({ homeschoolId, onClose, onActivityAdded }) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [progressTypes, setProgressTypes] = useState({
    percentageCompletion: false,
    timesTotal: false,
    progressCount: false
  });
  const [progressCountName, setProgressCountName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const activityData: any = {
        name,
        subjectId: subject, // For now, using subject name as ID
        description,
        progressReportingStyle: progressTypes,
        homeschoolId
      };
      
      // Only add progressCountName if progressCount is enabled
      if (progressTypes.progressCount) {
        activityData.progressCountName = progressCountName;
      }

      await addDoc(collection(db, 'activities'), activityData);
      onActivityAdded();
      onClose();
    } catch (error: any) {
      console.error('Error adding activity:', error);
      alert(`Error adding activity: ${error.message || 'Unknown error'}`);
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
        <h2>Create Activity Template</h2>
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
              Percentage Completion (0-100%)
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
              Track Time (minutes/hours)
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
              Count Progress
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
              disabled={saving || (!progressTypes.percentageCompletion && !progressTypes.timesTotal && !progressTypes.progressCount)}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || (!progressTypes.percentageCompletion && !progressTypes.timesTotal && !progressTypes.progressCount) ? 0.6 : 1
              }}
            >
              {saving ? 'Creating...' : 'Create Activity'}
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
          
          {(!progressTypes.percentageCompletion && !progressTypes.timesTotal && !progressTypes.progressCount) && (
            <p style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
              Please select at least one progress tracking method.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default ActivityForm;
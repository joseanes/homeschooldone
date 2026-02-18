import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity } from '../types';

interface ActivityFormProps {
  homeschoolId: string;
  activities: Activity[];
  onClose: () => void;
  onActivityAdded: () => void;
}

const ActivityForm: React.FC<ActivityFormProps> = ({ homeschoolId, activities, onClose, onActivityAdded }) => {
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
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  
  // Get unique subjects from existing activities
  const existingSubjects = Array.from(new Set(activities.map(a => a.subjectId).filter(Boolean)));
  const filteredSubjects = existingSubjects.filter(s => 
    s.toLowerCase().includes(subject.toLowerCase()) && s !== subject
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const activityData: any = {
        name,
        subjectId: subject, // For now, using subject name as ID
        description,
        progressReportingStyle: progressTypes,
        homeschoolId,
        requiresTimeTracking: progressTypes.timesTotal || false
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
        <h2>Create Activity</h2>
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
          
          <div style={{ marginBottom: '15px', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Subject/Area *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setShowSubjectSuggestions(true);
              }}
              onFocus={() => setShowSubjectSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSubjectSuggestions(false), 200)}
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
            {showSubjectSuggestions && filteredSubjects.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderTop: 'none',
                borderRadius: '0 0 4px 4px',
                maxHeight: '150px',
                overflow: 'auto',
                zIndex: 10
              }}>
                {filteredSubjects.map((subj, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSubject(subj);
                      setShowSubjectSuggestions(false);
                    }}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      backgroundColor: '#f8f9fa',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  >
                    {subj}
                  </div>
                ))}
              </div>
            )}
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
        </form>
      </div>
    </div>
  );
};

export default ActivityForm;
import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Homeschool, Person, Goal, Activity, ActivityInstance } from '../types';
import DashboardView from './DashboardView';

interface PublicDashboardProps {
  publicId: string;
}

interface PublicDashboardData {
  homeschool: Pick<Homeschool, 'id' | 'name' | 'dashboardSettings' | 'studentSortOrder'>;
  students: Person[];
  activities: Activity[];
  goals: Goal[];
  activityInstances: ActivityInstance[];
}

const PublicDashboard: React.FC<PublicDashboardProps> = ({ publicId }) => {
  const [data, setData] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicDashboard = async () => {
      try {
        // Served by a Cloud Function: visitors are not signed in, and
        // Firestore rules deny unauthenticated reads.
        const getPublicDashboard = httpsCallable<{ publicId: string }, PublicDashboardData>(
          functions,
          'getPublicDashboard'
        );
        const result = await getPublicDashboard({ publicId });
        setData(result.data);
      } catch (err: any) {
        console.error('Error fetching public dashboard:', err);
        setError(err?.code === 'functions/not-found'
          ? 'Public dashboard not found or has been disabled.'
          : 'Failed to load dashboard. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicDashboard();
  }, [publicId]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px'
      }}>
        Loading Public Dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        flexDirection: 'column',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '20px', color: '#ff6b6b' }}>Dashboard Not Found</h1>
        <p style={{ marginBottom: '30px', maxWidth: '500px' }}>
          {error || 'The public dashboard you\'re looking for doesn\'t exist or has been disabled.'}
        </p>
        <p style={{ color: '#999' }}>
          Contact the homeschool administrator for a valid link.
        </p>
      </div>
    );
  }

  return (
    <DashboardView
      homeschool={data.homeschool as Homeschool}
      students={data.students}
      goals={data.goals}
      activities={data.activities}
      activityInstances={data.activityInstances}
      cycleSeconds={data.homeschool.dashboardSettings?.cycleSeconds || 10}
      startOfWeek={data.homeschool.dashboardSettings?.startOfWeek ?? 1}
      timezone={data.homeschool.dashboardSettings?.timezone || 'America/New_York'}
      isPublic={true}
      onClose={() => {
        // For public dashboard, we can't really "close" - just reload to show error
        window.location.reload();
      }}
    />
  );
};

export default PublicDashboard;
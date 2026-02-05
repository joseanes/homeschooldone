import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Goal, Activity } from '../types';
import DashboardView from './DashboardView';

interface PublicDashboardProps {
  publicId: string;
}

const PublicDashboard: React.FC<PublicDashboardProps> = ({ publicId }) => {
  const [homeschool, setHomeschool] = useState<Homeschool | null>(null);
  const [students, setStudents] = useState<Person[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicDashboard = async () => {
      try {
        // Find homeschool with matching public dashboard ID
        const homeschoolQuery = query(
          collection(db, 'homeschools'), 
          where('publicDashboardId', '==', publicId)
        );
        const homeschoolSnapshot = await getDocs(homeschoolQuery);

        if (homeschoolSnapshot.empty) {
          setError('Public dashboard not found or has been disabled.');
          return;
        }

        const homeschoolDoc = homeschoolSnapshot.docs[0];
        const homeschoolData = { ...homeschoolDoc.data(), id: homeschoolDoc.id } as Homeschool;
        setHomeschool(homeschoolData);

        // Fetch students
        if (homeschoolData.studentIds && homeschoolData.studentIds.length > 0) {
          const studentsQuery = query(
            collection(db, 'people'),
            where('__name__', 'in', homeschoolData.studentIds)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          const studentsList = studentsSnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          } as Person));
          setStudents(studentsList);
        }

        // Fetch activities
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('homeschoolId', '==', homeschoolData.id)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        const activitiesList = activitiesSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as Activity));
        setActivities(activitiesList);

        // Fetch goals
        const goalsQuery = query(
          collection(db, 'goals'),
          where('homeschoolId', '==', homeschoolData.id)
        );
        const goalsSnapshot = await getDocs(goalsQuery);
        const goalsList = goalsSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as Goal));
        setGoals(goalsList);

      } catch (err) {
        console.error('Error fetching public dashboard:', err);
        setError('Failed to load dashboard. Please try again later.');
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

  if (error || !homeschool) {
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
      homeschool={homeschool}
      students={students}
      goals={goals}
      activities={activities}
      cycleSeconds={homeschool.dashboardSettings?.cycleSeconds || 10}
      startOfWeek={homeschool.dashboardSettings?.startOfWeek || 1}
      timezone={homeschool.dashboardSettings?.timezone || 'America/New_York'}
      isPublic={true}
      onClose={() => {
        // For public dashboard, we can't really "close" - just reload to show error
        window.location.reload();
      }}
    />
  );
};

export default PublicDashboard;
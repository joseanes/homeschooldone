import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Goal, Activity, ActivityInstance } from '../types';
import { isGoalActiveForStudent } from '../utils/goalUtils';

interface DashboardViewProps {
  homeschool: Homeschool;
  students: Person[];
  goals: Goal[];
  activities: Activity[];
  onClose: () => void;
  cycleSeconds?: number;
  startOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  timezone?: string;
  isPublic?: boolean; // Hide exit button for public dashboards
  // Pre-fetched recent activity instances (public dashboards have no Firestore access)
  activityInstances?: ActivityInstance[];
}

interface StudentProgress {
  student: Person;
  todayGoals: Goal[];
  completedToday: number;
  totalGoals: number;
  weeklyProgress: { [goalId: string]: number };
  todayCompletedGoalIds: Set<string>;
  todayMinutes: { [goalId: string]: number };
}

// Instance dates arrive as Firestore Timestamps, Dates or ISO strings
const toDate = (value: any): Date =>
  value instanceof Date ? value : value?.toDate ? value.toDate() : new Date(value);

// Map activity name to emoji icon (matches tvOS SF Symbol mapping)
const activityIcon = (activityName: string): string => {
  const name = activityName.toLowerCase();
  if (name.includes('math') || name.includes('khan')) return 'ƒ';
  if (name.includes('english') || name.includes('ela') || name.includes('reading') || name.includes('book')) return '📖';
  if (name.includes('piano') || name.includes('music')) return '♪';
  if (name.includes('tennis') || name.includes('soccer') || name.includes('sport')) return '🏃';
  if (name.includes('robot') || name.includes('first') || name.includes('coding')) return '⚙';
  if (name.includes('geography') || name.includes('map')) return '🌎';
  if (name.includes('duolingo') || name.includes('language') || name.includes('spanish') || name.includes('french')) return '🌐';
  if (name.includes('radio') || name.includes('ham')) return '📡';
  if (name.includes('science') || name.includes('chemistry')) return '🧪';
  if (name.includes('art') || name.includes('draw') || name.includes('paint')) return '🎨';
  if (name.includes('history')) return '🕰';
  return '⭐';
};

// TV-first sizing in vw, with a pixel floor so text stays readable on phones
// and laptops; on a 1920px-wide TV the vw value is always the larger one.
const vw = (v: number) => `max(${Math.round(Math.max(11, v * 8))}px, ${v}vw)`;

const NARROW_QUERY = '(max-width: 700px)';
const matchesNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches;

const DashboardView: React.FC<DashboardViewProps> = ({
  homeschool,
  students,
  goals,
  activities,
  onClose,
  cycleSeconds = 10,
  startOfWeek = 1, // Monday default
  timezone = 'America/New_York', // EST default
  isPublic = false,
  activityInstances
}) => {
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [allWeekInstances, setAllWeekInstances] = useState<ActivityInstance[]>([]);
  const [loading, setLoading] = useState(true);
  // Phones: stack the panels and scroll instead of the fixed TV layout
  const [isNarrow, setIsNarrow] = useState(matchesNarrow);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Note: isGoalActiveForStudent is now imported from utils/goalUtils

  // Handle ESC key (disabled for public dashboards)
  useEffect(() => {
    if (isPublic) return; // Don't allow ESC to close public dashboards
    
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [onClose]);

  // Cycle through students
  useEffect(() => {
    if (students.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStudentIndex((prev) => (prev + 1) % students.length);
    }, cycleSeconds * 1000);

    return () => clearInterval(interval);
  }, [students.length, cycleSeconds]);

  // Get start and end of current week
  const getWeekDates = () => {
    // Get current date in the specified timezone properly
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(part => part.type === 'year')?.value || '2024');
    const month = parseInt(parts.find(part => part.type === 'month')?.value || '1') - 1;
    const day = parseInt(parts.find(part => part.type === 'day')?.value || '1');
    
    const currentDate = new Date(year, month, day);
    const currentDay = currentDate.getDay(); // 0 = Sunday
    const daysFromStartOfWeek = (currentDay - startOfWeek + 7) % 7;
    const startOfCurrentWeek = new Date(currentDate);
    startOfCurrentWeek.setDate(currentDate.getDate() - daysFromStartOfWeek);
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    
    const endOfCurrentWeek = new Date(startOfCurrentWeek);
    endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 6);
    endOfCurrentWeek.setHours(23, 59, 59, 999);
    
    return { startOfWeek: startOfCurrentWeek, endOfWeek: endOfCurrentWeek };
  };

  // Fetch student progress
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { startOfWeek: weekStart, endOfWeek: weekEnd } = getWeekDates();
        // Get today's date in the specified timezone properly
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', { 
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        const parts = formatter.formatToParts(now);
        const year = parseInt(parts.find(part => part.type === 'year')?.value || '2024');
        const month = parseInt(parts.find(part => part.type === 'month')?.value || '1') - 1;
        const day = parseInt(parts.find(part => part.type === 'day')?.value || '1');
        
        const today = new Date(year, month, day);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // Last 5 weeks of instances: covers today, this week and the charts
        // (Last 7 Days + Weekly Completion)
        const fiveWeeksAgo = new Date(weekStart);
        fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 28); // 4 additional weeks back
        let instances: ActivityInstance[];
        if (activityInstances) {
          instances = activityInstances;
        } else {
          const allInstancesSnap = await getDocs(query(
            collection(db, 'activityInstances'),
            where('homeschoolId', '==', homeschool.id),
            where('date', '>=', fiveWeeksAgo),
            where('date', '<=', weekEnd)
          ));
          instances = allInstancesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ActivityInstance));
        }
        instances = instances
          .map(inst => ({ ...inst, date: toDate(inst.date) }))
          .filter(inst => inst.date >= fiveWeeksAgo && inst.date <= weekEnd);

        const progress = students.map((student) => {
          // Get goals for this student that are active (considering start date and completion date)
          const studentGoals = goals.filter(goal => goal.studentIds?.includes(student.id) && isGoalActiveForStudent(goal, student.id));
          const studentInstances = instances.filter(inst => inst.studentId === student.id);

          // Today's activity instances for this student
          const todayInstances = studentInstances.filter(inst => inst.date >= today && inst.date < tomorrow);
          const todayGoalIds = new Set(todayInstances.map(inst => inst.goalId));
          
          // Calculate today's minutes per goal
          const todayMinutes: { [goalId: string]: number } = {};
          todayInstances.forEach(inst => {
            todayMinutes[inst.goalId] = (todayMinutes[inst.goalId] || 0) + (inst.duration || 0);
          });

          // Week's activity instances for weekly progress
          const weeklyProgress: { [goalId: string]: number } = {};
          studentInstances
            .filter(inst => inst.date >= weekStart && inst.date <= weekEnd)
            .forEach(inst => {
              weeklyProgress[inst.goalId] = (weeklyProgress[inst.goalId] || 0) + 1;
            });

          // Calculate weekly completion for each goal
          const completedThisWeek = studentGoals.filter(goal => {
            const weeklyCount = weeklyProgress[goal.id] || 0;
            if (goal.timesPerWeek && weeklyCount >= goal.timesPerWeek) {
              return true; // Weekly requirement met
            }
            return false;
          }).length;

          // Filter out goals that are completed for the week - only show pending
          const pendingGoals = studentGoals.filter(goal => {
            const weeklyCount = weeklyProgress[goal.id] || 0;
            if (goal.timesPerWeek && weeklyCount >= goal.timesPerWeek) {
              return false; // Don't show weekly complete goals
            }
            return true; // Show pending goals
          });

          return {
            student,
            todayGoals: pendingGoals, // Now contains only pending goals
            completedToday: completedThisWeek, // Now represents weekly completion
            totalGoals: studentGoals.length,
            weeklyProgress,
            todayCompletedGoalIds: todayGoalIds,
            todayMinutes
          };
        });

        setStudentsProgress(progress);
        setAllWeekInstances(instances);
      } catch (error) {
        console.error('Error fetching dashboard progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [homeschool.id, students, goals, startOfWeek, timezone, activityInstances]);

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
        Loading Dashboard...
      </div>
    );
  }

  if (students.length === 0) {
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
        <h1 style={{ marginBottom: '20px' }}>No Students Found</h1>
        <p style={{ marginBottom: '30px' }}>Add some students to see their progress on the dashboard.</p>
        <button
          onClick={onClose}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#ff5722',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Back to Main
        </button>
      </div>
    );
  }

  const currentProgress = studentsProgress[currentStudentIndex];
  if (!currentProgress) return null;

  const progressPercentage = currentProgress.totalGoals > 0
    ? (currentProgress.completedToday / currentProgress.totalGoals) * 100
    : 0;

  // Dynamic grid and text scaling based on card count
  const goalCount = currentProgress.todayGoals.length;
  const cols = goalCount <= 2 ? 1 : goalCount <= 6 ? 2 : goalCount <= 9 ? 3 : 4;
  // Scale: fewer cards = bigger text (1.6x for 1-2, down to 0.85x for 10+)
  const scale = goalCount <= 2 ? 1.6 : goalCount <= 4 ? 1.3 : goalCount <= 6 ? 1.1 : goalCount <= 9 ? 1.0 : 0.85;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#1a1a2e',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      padding: isNarrow ? '16px' : '40px',
      overflowY: isNarrow ? 'auto' : undefined
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '2vh'
      }}>
        <h1 style={{ margin: 0, fontSize: vw(2.2) }}>{homeschool.name} Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isNarrow ? '12px' : '20px' }}>
          <div style={{ fontSize: vw(1.1), opacity: 0.8 }}>
            Student {currentStudentIndex + 1} of {students.length} • Auto-cycling every {cycleSeconds}s
          </div>
          {!isPublic && (
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#ff5722',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ✕ Exit Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Student Progress - Horizontal Layout */}
      <div style={{
        flex: isNarrow ? 'none' : 1,
        display: 'flex',
        flexDirection: isNarrow ? 'column' : 'row',
        alignItems: 'stretch',
        gap: isNarrow ? '16px' : '30px',
        height: isNarrow ? 'auto' : 'calc(100vh - 140px)',
        overflow: isNarrow ? 'visible' : 'hidden'
      }}>
        {/* Left Side - Student Name and Progress Circle */}
        <div style={{
          backgroundColor: '#16213e',
          borderRadius: '20px',
          padding: isNarrow ? '20px' : '30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: isNarrow ? 'auto' : '280px',
          flexShrink: 0,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          {/* Student Name */}
          <h2 style={{
            margin: '0 0 2vh 0',
            fontSize: vw(2.8),
            textAlign: 'center',
            background: 'linear-gradient(45deg, #4caf50, #2196f3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {currentProgress.student.name}
          </h2>

          {/* Progress Circle */}
          <div style={{ marginBottom: '2vh' }}>
            <div style={{
              width: isNarrow ? '160px' : '14vw',
              height: isNarrow ? '160px' : '14vw',
              borderRadius: '50%',
              background: `conic-gradient(#4caf50 ${progressPercentage * 3.6}deg, #333 ${progressPercentage * 3.6}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <div style={{
                width: isNarrow ? '130px' : '11.5vw',
                height: isNarrow ? '130px' : '11.5vw',
                borderRadius: '50%',
                backgroundColor: '#1a1a2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <div style={{ fontSize: vw(2.8), fontWeight: 'bold' }}>
                  {currentProgress.completedToday}/{currentProgress.totalGoals}
                </div>
                <div style={{ fontSize: vw(1.1), fontWeight: '500', color: '#4caf50' }}>
                  {Math.round(progressPercentage)}%
                </div>
                <div style={{ fontSize: vw(1), opacity: 0.8 }}>This Week</div>
              </div>
            </div>
          </div>

          {/* Last 7 Days bar chart */}
          <div style={{ width: '100%', marginTop: '2vh' }}>
            <div style={{ fontSize: vw(0.9), opacity: 0.7, textAlign: 'center', marginBottom: '0.8vh' }}>Last 7 Days</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', justifyContent: 'center' }}>
              {(() => {
                const dayLetters = ['S','M','T','W','T','F','S'];
                const studentId = currentProgress.student.id;
                const days: { letter: string; count: number; isToday: boolean }[] = [];
                const now = new Date();
                for (let i = 6; i >= 0; i--) {
                  const d = new Date(now);
                  d.setDate(d.getDate() - i);
                  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                  const dayEnd = new Date(dayStart);
                  dayEnd.setDate(dayEnd.getDate() + 1);
                  const count = allWeekInstances.filter(inst => {
                    const instDate = inst.date instanceof Date ? inst.date : new Date((inst.date as any).seconds ? (inst.date as any).seconds * 1000 : inst.date);
                    return inst.studentId === studentId && instDate >= dayStart && instDate < dayEnd;
                  }).length;
                  days.push({ letter: dayLetters[dayStart.getDay()], count, isToday: i === 0 });
                }
                const maxCount = Math.max(1, ...days.map(d => d.count));
                return days.map((day, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', maxWidth: '24px' }}>
                    {day.count > 0 && <span style={{ fontSize: vw(0.7), opacity: 0.8 }}>{day.count}</span>}
                    <div style={{
                      width: '100%',
                      height: day.count > 0 ? Math.max(4, (day.count / maxCount) * 40) : 4,
                      backgroundColor: day.count > 0 ? (day.isToday ? '#2196f3' : '#4caf50') : 'rgba(255,255,255,0.1)',
                      borderRadius: '2px'
                    }} />
                    <span style={{ fontSize: vw(0.65), opacity: day.isToday ? 1 : 0.5, color: day.isToday ? '#2196f3' : 'white' }}>{day.letter}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Weekly Completion chart - last 5 weeks */}
          <div style={{ width: '100%', marginTop: '1.5vh' }}>
            <div style={{ fontSize: vw(0.9), opacity: 0.7, textAlign: 'center', marginBottom: '0.8vh' }}>Weekly Completion</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', justifyContent: 'center' }}>
              {(() => {
                const studentId = currentProgress.student.id;
                const studentGoals = goals.filter(g => g.studentIds?.includes(studentId) && isGoalActiveForStudent(g, studentId));
                const weeks: { weekNum: number; pct: number; isCurrent: boolean }[] = [];
                const now = new Date();

                for (let w = 4; w >= 0; w--) {
                  const wStart = new Date(now);
                  // Go back to start of current week, then subtract w weeks
                  const currentDay = wStart.getDay();
                  const daysFromStart = (currentDay - startOfWeek + 7) % 7;
                  wStart.setDate(wStart.getDate() - daysFromStart - (w * 7));
                  wStart.setHours(0, 0, 0, 0);
                  const wEnd = new Date(wStart);
                  wEnd.setDate(wStart.getDate() + 6);
                  wEnd.setHours(23, 59, 59, 999);

                  // Count completed goals this week
                  let completed = 0;
                  studentGoals.forEach(goal => {
                    const weeklyTarget = goal.timesPerWeek || 1;
                    const count = allWeekInstances.filter(inst => {
                      const instDate = inst.date instanceof Date ? inst.date : new Date((inst.date as any).seconds ? (inst.date as any).seconds * 1000 : inst.date);
                      return inst.studentId === studentId && inst.goalId === goal.id && instDate >= wStart && instDate <= wEnd;
                    }).length;
                    if (count >= weeklyTarget) completed++;
                  });

                  const pct = studentGoals.length > 0 ? (completed / studentGoals.length) * 100 : 0;
                  const jan1 = new Date(wStart.getFullYear(), 0, 1);
                  const weekNum = Math.ceil(((wStart.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
                  weeks.push({ weekNum, pct, isCurrent: w === 0 });
                }

                return weeks.map((week, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', maxWidth: '36px' }}>
                    {week.pct > 0 && <span style={{ fontSize: vw(0.7), opacity: 0.8 }}>{Math.round(week.pct)}%</span>}
                    <div style={{
                      width: '100%',
                      height: week.pct > 0 ? Math.max(4, (week.pct / 100) * 40) : 4,
                      backgroundColor: week.pct >= 100 ? '#4caf50' : week.pct > 0 ? '#2196f3' : 'rgba(255,255,255,0.1)',
                      borderRadius: '2px'
                    }} />
                    <span style={{ fontSize: vw(0.65), color: week.isCurrent ? '#2196f3' : 'white', opacity: week.isCurrent ? 1 : 0.5 }}>W{week.weekNum}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Right Side - Today's Goals */}
        <div style={{
          backgroundColor: '#16213e',
          borderRadius: '20px',
          padding: '24px',
          flex: 1,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: isNarrow ? 'visible' : 'hidden',
          minWidth: 0
        }}>
          <h3 style={{
            fontSize: vw(2),
            marginBottom: '1.2vh',
            textAlign: 'center',
            background: 'linear-gradient(45deg, #4caf50, #2196f3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            flexShrink: 0
          }}>
            Tasks and Goals
          </h3>

          <div style={{
            display: 'grid',
            gap: isNarrow ? '10px' : `${goalCount <= 4 ? 1.2 : 0.8}vw`,
            gridTemplateColumns: `repeat(${isNarrow ? Math.min(cols, 2) : cols}, 1fr)`,
            gridAutoRows: '1fr',
            flex: isNarrow ? 'none' : 1,
            overflow: isNarrow ? 'visible' : 'hidden'
          }}>
            {/* Sort goals: gray (pending) first, then yellow (progress week), then blue (done today), then green (weekly complete) */}
            {[...currentProgress.todayGoals].sort((a, b) => {
              const activityA = activities.find(act => act.id === a.activityId);
              const activityB = activities.find(act => act.id === b.activityId);
              
              // Get status for each goal
              const weeklyCountA = currentProgress.weeklyProgress[a.id] || 0;
              const weeklyCountB = currentProgress.weeklyProgress[b.id] || 0;
              const hasActivityTodayA = currentProgress.todayCompletedGoalIds.has(a.id);
              const hasActivityTodayB = currentProgress.todayCompletedGoalIds.has(b.id);
              const weeklyCompleteA = !!(a.timesPerWeek && weeklyCountA >= a.timesPerWeek);
              const weeklyCompleteB = !!(b.timesPerWeek && weeklyCountB >= b.timesPerWeek);
              
              // Determine status priority
              const getStatusPriority = (goal: Goal, weeklyCount: number, hasToday: boolean, weeklyComplete: boolean) => {
                if (weeklyComplete) return 4; // Green - show last
                if (hasToday) return 3; // Blue - show third
                if (weeklyCount > 0) return 2; // Yellow - show second
                return 1; // Gray - show first
              };
              
              const priorityA = getStatusPriority(a, weeklyCountA, hasActivityTodayA, weeklyCompleteA);
              const priorityB = getStatusPriority(b, weeklyCountB, hasActivityTodayB, weeklyCompleteB);
              
              // Sort by status priority first
              if (priorityA !== priorityB) {
                return priorityA - priorityB;
              }
              
              // Within same status, sort alphabetically by goal name (or activity name if no goal name)
              const nameA = a.name || activityA?.name || '';
              const nameB = b.name || activityB?.name || '';
              return nameA.localeCompare(nameB);
            }).map(goal => {
              const activity = activities.find(a => a.id === goal.activityId);
              const weeklyCount = currentProgress.weeklyProgress[goal.id] || 0;
              const hasActivityToday = currentProgress.todayCompletedGoalIds.has(goal.id);
              
              // Check actual completion for time-based goals
              let isActuallyCompleted = hasActivityToday;
              const todayMinutesForGoal = currentProgress.todayMinutes[goal.id] || 0;
              
              if (hasActivityToday && goal.minutesPerSession) {
                // Check if today's minutes meet the goal requirement
                isActuallyCompleted = todayMinutesForGoal >= goal.minutesPerSession;
              }
              
              // Dark-themed status colors
              let cardBg, cardBorder, statusIcon, statusText, cardTextColor;

              const weeklyComplete = goal.timesPerWeek && weeklyCount >= goal.timesPerWeek;

              if (weeklyComplete) {
                cardBg = 'rgba(76, 175, 80, 0.15)';
                cardBorder = 'rgba(76, 175, 80, 0.4)';
                cardTextColor = '#a5d6a7';
                statusIcon = '✓';
                statusText = 'Complete';
              } else if (hasActivityToday) {
                cardBg = 'rgba(33, 150, 243, 0.15)';
                cardBorder = 'rgba(33, 150, 243, 0.4)';
                cardTextColor = '#90caf9';
                statusIcon = '✔';
                statusText = 'Today';
              } else if (weeklyCount > 0) {
                cardBg = 'rgba(255, 193, 7, 0.12)';
                cardBorder = 'rgba(255, 193, 7, 0.35)';
                cardTextColor = '#ffe082';
                statusIcon = '◐';
                statusText = 'Progress';
              } else {
                cardBg = 'rgba(255, 255, 255, 0.06)';
                cardBorder = 'rgba(255, 255, 255, 0.12)';
                cardTextColor = 'rgba(255, 255, 255, 0.6)';
                statusIcon = '○';
                statusText = 'Pending';
              }

              const icon = activityIcon(activity?.name || goal.name || '');

              return (
                <div
                  key={goal.id}
                  style={{
                    padding: isNarrow ? '12px 8px' : `${1.5 * scale}vh ${1.0 * scale}vw`,
                    backgroundColor: cardBg,
                    borderRadius: 'max(6px, 0.6vw)',
                    border: `1px solid ${cardBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: `${0.5 * scale}vh`,
                    color: cardTextColor,
                    minWidth: 0,
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: vw(2.2 * scale), lineHeight: 1 }}>
                    {icon}
                  </div>
                  <div style={{
                    fontSize: vw(1.2 * scale),
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}>
                    {goal.name || activity?.name}
                  </div>
                  <div style={{ fontSize: vw(0.9 * scale), opacity: 0.7 }}>
                    {goal.timesPerWeek && `${weeklyCount}/${goal.timesPerWeek} wk`}
                    {goal.minutesPerSession && `${goal.timesPerWeek ? ' · ' : ''}${goal.minutesPerSession} min`}
                  </div>
                  <div style={{
                    fontSize: vw(0.85 * scale),
                    fontWeight: '500',
                    opacity: 0.9
                  }}>
                    {statusIcon} {statusText}
                  </div>
                </div>
              );
            })}
          </div>
          
          {currentProgress.todayGoals.length === 0 && (
            <div style={{ 
              textAlign: 'center',
              fontSize: '24px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px'
            }}>
              <div style={{ fontSize: '80px' }}>🏆</div>
              <div style={{ color: '#4caf50', fontWeight: 'bold' }}>
                All done for the week!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
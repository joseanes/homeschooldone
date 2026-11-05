import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person, Goal, Activity, ActivityInstance, DashboardProgressMode } from '../types';
import { isGoalActiveForStudent } from '../utils/goalUtils';
import {
  CARD_COLORS,
  ClassroomCardView,
  STATUS_SORT_ORDER,
  classroomSummary,
  presentClassroomCard,
  resolveProgressMode
} from '../utils/dashboardProgress';

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
  /** Saved TV / public board mode. Missing values render as weekly. */
  progressMode?: DashboardProgressMode;
}

interface StudentProgress {
  student: Person;
  goals: Goal[];
  weeklyProgress: { [goalId: string]: number };
  todayCompletedGoalIds: Set<string>;
  todayMinutes: { [goalId: string]: number };
  latestPercentage: { [goalId: string]: number };
}

// Instance dates arrive as Firestore Timestamps, Dates or ISO strings
const toDate = (value: any): Date =>
  value instanceof Date ? value : value?.toDate ? value.toDate() : new Date(value);

// Map activity name to emoji icon (matches tvOS SF Symbol mapping)
const activityIcon = (activityName: string): string => {
  const name = activityName.toLowerCase();
  if (name.includes('algebra') || name.includes('math') || name.includes('khan')) return '∑';
  if (name.includes('chem')) return '🧪';
  if (name.includes('physics')) return '💧';
  if (name.includes('english') || name.includes('ela')) return '📘';
  if (name.includes('reading') || name.includes('book')) return '📖';
  if (name.includes('piano') || name.includes('music')) return '🎹';
  if (name.includes('horse')) return '🐴';
  if (name.includes('soccer')) return '⚽';
  if (name.includes('tennis') || name.includes('pickle')) return '🎾';
  if (name.includes('robot') || name.includes('first') || name.includes('coding')) return '🏆';
  if (name.includes('geography') || name.includes('map')) return '🌎';
  if (name.includes('duolingo') || name.includes('language') || name.includes('spanish') || name.includes('french')) return '◐';
  if (name.includes('radio') || name.includes('ham')) return '📡';
  if (name.includes('science')) return '🔬';
  if (name.includes('art') || name.includes('draw') || name.includes('paint')) return '🎨';
  if (name.includes('history')) return '🕰';
  return '⭐';
};

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
  activityInstances,
  progressMode
}) => {
  const mode = resolveProgressMode(progressMode ?? homeschool.dashboardSettings?.progressMode);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [onClose, isPublic]);

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

        // Last 5 weeks of instances covers today and this week.
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
          // Active goals stay on the board in both modes, including ones whose
          // week target is already met. Hiding them collapsed the grid.
          const studentGoals = goals.filter(goal => goal.studentIds?.includes(student.id) && isGoalActiveForStudent(goal, student.id));
          const studentInstances = instances.filter(inst => inst.studentId === student.id);

          const todayInstances = studentInstances.filter(inst => inst.date >= today && inst.date < tomorrow);
          const todayGoalIds = new Set(todayInstances.map(inst => inst.goalId));

          const todayMinutes: { [goalId: string]: number } = {};
          todayInstances.forEach(inst => {
            todayMinutes[inst.goalId] = (todayMinutes[inst.goalId] || 0) + (inst.duration || 0);
          });

          const weeklyProgress: { [goalId: string]: number } = {};
          const latestPercentage: { [goalId: string]: number } = {};
          studentInstances
            .filter(inst => inst.date >= weekStart && inst.date <= weekEnd)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .forEach(inst => {
              weeklyProgress[inst.goalId] = (weeklyProgress[inst.goalId] || 0) + 1;
              const pct = inst.percentageCompleted ?? inst.endingPercentage;
              if (pct !== undefined && pct !== null) {
                latestPercentage[inst.goalId] = pct;
              }
            });

          return {
            student,
            goals: studentGoals,
            weeklyProgress,
            todayCompletedGoalIds: todayGoalIds,
            todayMinutes,
            latestPercentage
          };
        });

        setStudentsProgress(progress);
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
        backgroundColor: '#07111f',
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
        backgroundColor: '#07111f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        flexDirection: 'column',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '20px' }}>No Students Found</h1>
        <p style={{ marginBottom: '30px' }}>Add some students to see their progress on the dashboard.</p>
        {!isPublic && (
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
        )}
      </div>
    );
  }

  const currentProgress = studentsProgress[currentStudentIndex];
  if (!currentProgress) return null;

  const cards = currentProgress.goals.map(goal => {
    const view = presentClassroomCard(mode, {
      timesPerWeek: goal.timesPerWeek,
      minutesPerSession: goal.minutesPerSession,
      weeklyCount: currentProgress.weeklyProgress[goal.id] || 0,
      todayCount: currentProgress.todayCompletedGoalIds.has(goal.id) ? 1 : 0,
      todayMinutes: currentProgress.todayMinutes[goal.id] || 0
    });
    const pct = currentProgress.latestPercentage[goal.id];
    const detail = [
      view.weekDetail,
      pct !== undefined ? `${Math.round(pct)}%` : null
    ].filter(Boolean).join(' · ');
    return { goal, view, detail };
  }).sort((a, b) => {
    const priority = STATUS_SORT_ORDER[a.view.status] - STATUS_SORT_ORDER[b.view.status];
    if (priority !== 0) return priority;
    const activityA = activities.find(act => act.id === a.goal.activityId);
    const activityB = activities.find(act => act.id === b.goal.activityId);
    const nameA = a.goal.name || activityA?.name || '';
    const nameB = b.goal.name || activityB?.name || '';
    return nameA.localeCompare(nameB);
  });

  const summary = classroomSummary(mode, cards.map(card => card.view));
  const goalCount = cards.length;
  const cols = goalCount <= 1 ? 1 : goalCount <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(goalCount / cols));
  const ringColor = mode === 'daily' ? '#2196f3' : '#4caf50';

  return (
    <div
      data-testid="classroom-board"
      data-progress-mode={mode}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(1000px 480px at 0% -10%, rgba(33,150,243,0.18), transparent 55%), radial-gradient(800px 420px at 100% 110%, rgba(76,175,80,0.10), transparent 50%), #07111f',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 36px 32px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}
    >
      <header style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '24px',
        marginBottom: '22px',
        flexShrink: 0
      }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 2.4vw, 44px)', fontWeight: 750, letterSpacing: '-0.02em' }}>
          {homeschool.name}
        </h1>

        <div
          data-testid="progress-mode-switch"
          role="group"
          aria-label="Progress mode"
          style={{
            display: 'inline-flex',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '999px',
            padding: '4px',
            gap: '4px'
          }}
        >
          {(['daily', 'weekly'] as DashboardProgressMode[]).map(option => {
            const selected = mode === option;
            const activeColor = option === 'daily' ? '#2196f3' : '#22c55e';
            return (
              <span
                key={option}
                data-mode={option}
                aria-current={selected ? 'true' : undefined}
                style={{
                  minWidth: '92px',
                  textAlign: 'center',
                  padding: '8px 18px',
                  borderRadius: '999px',
                  background: selected ? activeColor : 'transparent',
                  color: selected ? '#fff' : 'rgba(255,255,255,0.72)',
                  fontWeight: 700,
                  fontSize: '16px',
                  letterSpacing: '0.01em'
                }}
              >
                {option === 'daily' ? 'Daily' : 'Weekly'}
              </span>
            );
          })}
        </div>

        <div style={{ justifySelf: 'end', textAlign: 'right' }}>
          <div style={{ fontSize: 'clamp(26px, 2vw, 36px)', fontWeight: 750, lineHeight: 1.1 }}>
            {currentProgress.student.name}
          </div>
          <div
            data-testid="progress-summary"
            style={{ marginTop: '4px', fontSize: 'clamp(14px, 1.1vw, 18px)', color: 'rgba(255,255,255,0.78)' }}
          >
            {summary.label}
          </div>
          <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            {students.length > 1 && (
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                Student {currentStudentIndex + 1} of {students.length} · {cycleSeconds}s
              </span>
            )}
            {!isPublic && (
              <button
                onClick={onClose}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: '999px',
                  cursor: 'pointer'
                }}
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </header>

      <div style={{
        flex: '1 1 auto',
        display: 'flex',
        alignItems: 'stretch',
        gap: '28px',
        minHeight: 0
      }}>
        <aside
          aria-label={summary.ringCaption}
          style={{
            width: '168px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            width: '148px',
            height: '148px',
            borderRadius: '50%',
            background: `conic-gradient(${ringColor} ${summary.percent * 3.6}deg, rgba(255,255,255,0.12) ${summary.percent * 3.6}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 24px ${ringColor}33`
          }}>
            <div style={{
              width: '116px',
              height: '116px',
              borderRadius: '50%',
              backgroundColor: '#07111f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}>
              <div style={{ fontSize: '13px', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.7)' }}>
                {summary.ringCaption}
              </div>
              <div data-testid="progress-percent" style={{ fontSize: '32px', fontWeight: 750, lineHeight: 1.1, color: ringColor }}>
                {summary.percent}%
              </div>
            </div>
          </div>
        </aside>

        <section
          aria-label="Tasks"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {goalCount === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              color: 'rgba(255,255,255,0.75)'
            }}>
              No active tasks for {currentProgress.student.name}.
            </div>
          ) : (
            <div
              data-testid="task-grid"
              style={{
                flex: 1,
                height: '100%',
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                gap: '14px'
              }}
            >
              {cards.map(({ goal, view, detail }) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  activityName={activities.find(activity => activity.id === goal.activityId)?.name}
                  view={view}
                  detail={detail}
                  emphasizeWeek={mode === 'weekly'}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const GoalCard: React.FC<{
  goal: Goal;
  activityName?: string;
  view: ClassroomCardView;
  detail: string;
  emphasizeWeek: boolean;
}> = ({ goal, activityName, view, detail, emphasizeWeek }) => {
  const colors = CARD_COLORS[view.status];
  const name = goal.name || activityName || 'Task';
  const icon = activityIcon(activityName || goal.name || '');
  const primaryLine = emphasizeWeek && detail ? detail : view.label;
  const secondaryLine = emphasizeWeek ? view.label : detail;

  return (
    <article
      data-testid="goal-card"
      data-goal-id={goal.id}
      data-status={view.status}
      aria-label={`${name}. ${view.label}${detail ? `. ${detail}` : ''}`}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '18px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        minWidth: 0,
        color: colors.text
      }}
    >
      <div aria-hidden="true" style={{ fontSize: '30px', lineHeight: 1, width: '40px', textAlign: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'clamp(16px, 1.35vw, 22px)',
          fontWeight: 750,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {name}
        </div>
        <div style={{ marginTop: '3px', fontSize: 'clamp(13px, 1vw, 16px)', fontWeight: 650 }}>
          {primaryLine}
        </div>
        {secondaryLine && (
          <div style={{ marginTop: '1px', fontSize: 'clamp(12px, 0.9vw, 14px)', opacity: 0.75 }}>
            {secondaryLine}
          </div>
        )}
      </div>
      <StatusMark status={view.status} accent={colors.accent} label={view.label} />
    </article>
  );
};

const StatusMark: React.FC<{ status: ClassroomCardView['status']; accent: string; label: string }> = ({
  status,
  accent,
  label
}) => {
  const filled = status === 'done-today' || status === 'week-complete';
  return (
    <span
      title={label}
      style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        border: `2.5px solid ${accent}`,
        background: filled ? accent : 'transparent',
        color: filled ? '#07111f' : accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: status === 'in-progress' ? '20px' : '16px',
        fontWeight: 800
      }}
    >
      <span aria-hidden="true">{status === 'pending' ? '' : status === 'in-progress' ? '◐' : '✓'}</span>
    </span>
  );
};

export default DashboardView;

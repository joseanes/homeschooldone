import { DashboardProgressMode } from '../types';

/**
 * Weekly is the default because the classroom board already measured the
 * week: the ring was "This Week", cards led with "N/M wk", and green meant
 * the weekly target was met. Homeschools that have never saved a mode keep
 * that reading.
 */
export const DEFAULT_PROGRESS_MODE: DashboardProgressMode = 'weekly';

export function resolveProgressMode(value: unknown): DashboardProgressMode {
  return value === 'daily' ? 'daily' : DEFAULT_PROGRESS_MODE;
}

/** Same four states the rest of the app already paints. */
export type ClassroomCardStatus = 'pending' | 'in-progress' | 'done-today' | 'week-complete';

export interface GoalProgressFacts {
  timesPerWeek?: number;
  minutesPerSession?: number;
  weeklyCount: number;
  /** Logged sessions today. Any positive count means the task was touched today. */
  todayCount: number;
  todayMinutes: number;
}

export interface ClassroomCardView {
  status: ClassroomCardStatus;
  /** Status line. Daily is day-scoped; weekly names the week outcome. */
  label: string;
  /** Week fraction when the goal has a weekly target, e.g. "2/5 wk". */
  weekDetail: string | null;
  /** Included in the header sentence and the secondary ring. */
  countsTowardSummary: boolean;
}

export const CARD_COLORS: Record<ClassroomCardStatus, {
  bg: string;
  border: string;
  text: string;
  accent: string;
}> = {
  pending: {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.14)',
    text: 'rgba(232, 240, 248, 0.92)',
    accent: 'rgba(255, 255, 255, 0.45)'
  },
  'in-progress': {
    bg: 'rgba(255, 193, 7, 0.13)',
    border: 'rgba(255, 193, 7, 0.45)',
    text: '#ffe082',
    accent: '#ffc107'
  },
  'done-today': {
    bg: 'rgba(33, 150, 243, 0.16)',
    border: 'rgba(33, 150, 243, 0.5)',
    text: '#90caf9',
    accent: '#2196f3'
  },
  'week-complete': {
    bg: 'rgba(76, 175, 80, 0.16)',
    border: 'rgba(76, 175, 80, 0.5)',
    text: '#a5d6a7',
    accent: '#4caf50'
  }
};

export const STATUS_SORT_ORDER: Record<ClassroomCardStatus, number> = {
  pending: 1,
  'in-progress': 2,
  'done-today': 3,
  'week-complete': 4
};

export function weekTargetOf(timesPerWeek?: number): number {
  return timesPerWeek && timesPerWeek > 0 ? timesPerWeek : 0;
}

function touchedToday(facts: GoalProgressFacts): boolean {
  return facts.todayCount > 0 || facts.todayMinutes > 0;
}

/**
 * A timed goal is done for the day only after today's minutes meet the
 * session length. Anything else with a log today counts as done today,
 * matching the parent board.
 */
export function meetsTodayBar(facts: GoalProgressFacts): boolean {
  if (!touchedToday(facts)) return false;
  if (facts.minutesPerSession && facts.minutesPerSession > 0) {
    return facts.todayMinutes >= facts.minutesPerSession;
  }
  return true;
}

export function isWeekComplete(facts: GoalProgressFacts): boolean {
  const target = weekTargetOf(facts.timesPerWeek);
  return target > 0 && facts.weeklyCount >= target;
}

export function presentClassroomCard(
  mode: DashboardProgressMode,
  facts: GoalProgressFacts
): ClassroomCardView {
  const target = weekTargetOf(facts.timesPerWeek);
  const weekDetail = target > 0 ? `${facts.weeklyCount}/${target} wk` : null;
  const today = touchedToday(facts);

  if (mode === 'daily') {
    // Day status wins, including when the week target is already met.
    // A habits year still needs to see what has not been done today.
    // The week fraction stays on the card as the secondary line.
    if (meetsTodayBar(facts)) {
      return { status: 'done-today', label: 'Done today', weekDetail, countsTowardSummary: true };
    }
    if (today) {
      return { status: 'in-progress', label: 'In progress', weekDetail, countsTowardSummary: false };
    }
    return { status: 'pending', label: 'Not yet', weekDetail, countsTowardSummary: false };
  }

  // Weekly: same priority the classroom board and parent chips already use.
  if (isWeekComplete(facts)) {
    return { status: 'week-complete', label: 'Complete', weekDetail, countsTowardSummary: true };
  }
  if (today) {
    return { status: 'done-today', label: 'Done today', weekDetail, countsTowardSummary: false };
  }
  if (facts.weeklyCount > 0) {
    return { status: 'in-progress', label: 'Progress', weekDetail, countsTowardSummary: false };
  }
  return { status: 'pending', label: 'Pending', weekDetail, countsTowardSummary: false };
}

export function classroomSummary(mode: DashboardProgressMode, cards: ClassroomCardView[]): {
  done: number;
  total: number;
  label: string;
  percent: number;
  ringCaption: string;
} {
  const total = cards.length;
  const done = cards.filter(card => card.countsTowardSummary).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  if (mode === 'daily') {
    return {
      done,
      total,
      label: `${done} of ${total} done today`,
      percent,
      ringCaption: 'Today'
    };
  }
  return {
    done,
    total,
    label: `${done} of ${total} week goals met`,
    percent,
    ringCaption: 'This week'
  };
}

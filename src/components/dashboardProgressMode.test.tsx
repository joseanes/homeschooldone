import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardView from './DashboardView';
import SettingsModal from './SettingsModal';
import { Activity, ActivityInstance, Goal, Homeschool, Person } from '../types';

jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayRemove: jest.fn(),
  arrayUnion: jest.fn()
}));

jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: jest.fn()
}));

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const localNow = new Date();
const todayNoon = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate(), 12, 0, 0);
const yesterdayNoon = new Date(todayNoon);
yesterdayNoon.setDate(todayNoon.getDate() - 1);
// Week starts yesterday, so a yesterday log is still "this week" and not today.
const startOfWeek = (todayNoon.getDay() + 6) % 7;

const homeschool: Homeschool = {
  id: 'hs1',
  name: 'Anes Rincon School',
  parentIds: ['parent1'],
  tutorIds: [],
  observerIds: [],
  studentIds: ['sophia'],
  createdBy: 'parent1',
  createdAt: new Date('2024-08-01'),
  dashboardSettings: { cycleSeconds: 30, startOfWeek, timezone: zone, progressMode: 'weekly' }
};

const sophia: Person = { id: 'sophia', name: 'Sophia', role: 'student' };

const activities: Activity[] = [
  { id: 'algebra', name: 'Algebra 1', subjectId: 'math', description: '', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'piano', name: 'Piano Practice', subjectId: 'music', description: '', progressReportingStyle: {}, homeschoolId: 'hs1', requiresTimeTracking: true },
  { id: 'soccer', name: 'Soccer', subjectId: 'pe', description: '', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'bonnie', name: 'Bonnie ELA', subjectId: 'ela', description: '', progressReportingStyle: {}, homeschoolId: 'hs1' }
];

function goal(partial: Partial<Goal> & Pick<Goal, 'id' | 'activityId' | 'timesPerWeek'>): Goal {
  return {
    name: activities.find(activity => activity.id === partial.activityId)?.name || '',
    studentIds: ['sophia'],
    tutorOrParentId: 'parent1',
    homeschoolId: 'hs1',
    ...partial
  };
}

const goals: Goal[] = [
  goal({ id: 'algebra', activityId: 'algebra', timesPerWeek: 5 }),
  goal({ id: 'piano', activityId: 'piano', timesPerWeek: 5, minutesPerSession: 30 }),
  goal({ id: 'soccer', activityId: 'soccer', timesPerWeek: 2 }),
  goal({ id: 'bonnie', activityId: 'bonnie', timesPerWeek: 3 })
];

function inst(id: string, goalId: string, when: Date, extra: Partial<ActivityInstance> = {}): ActivityInstance {
  return {
    id,
    goalId,
    studentId: 'sophia',
    description: '',
    date: when,
    createdBy: 'parent1',
    ...extra
  };
}

const instances: ActivityInstance[] = [
  inst('piano-today', 'piano', todayNoon, { duration: 10 }),
  inst('soccer-yesterday', 'soccer', yesterdayNoon, { duration: 40 }),
  inst('bonnie-1', 'bonnie', todayNoon),
  inst('bonnie-2', 'bonnie', todayNoon),
  inst('bonnie-3', 'bonnie', todayNoon)
];

function renderBoard(progressMode: 'daily' | 'weekly') {
  return render(
    <DashboardView
      homeschool={{ ...homeschool, dashboardSettings: { ...homeschool.dashboardSettings!, progressMode } }}
      students={[sophia]}
      goals={goals}
      activities={activities}
      activityInstances={instances}
      cycleSeconds={600}
      startOfWeek={startOfWeek}
      timezone={zone}
      progressMode={progressMode}
      isPublic
      onClose={() => undefined}
    />
  );
}

function card(goalId: string): HTMLElement {
  const node = document.querySelector(`[data-goal-id="${goalId}"]`);
  if (!node) throw new Error(`missing card ${goalId}`);
  return node as HTMLElement;
}

describe('classroom board progress mode', () => {
  test('daily mode shows day status on every task and a today summary', async () => {
    renderBoard('daily');

    expect(await screen.findByTestId('classroom-board')).toHaveAttribute('data-progress-mode', 'daily');
    expect(screen.getByTestId('progress-summary')).toHaveTextContent('1 of 4 done today');
    expect(screen.getByTestId('progress-percent')).toHaveTextContent('25%');
    expect(screen.getByTestId('task-grid').querySelectorAll('[data-testid="goal-card"]')).toHaveLength(4);

    expect(card('algebra')).toHaveAttribute('data-status', 'pending');
    expect(within(card('algebra')).getByText('Not yet')).toBeInTheDocument();
    expect(within(card('algebra')).getByText('0/5 wk')).toBeInTheDocument();

    expect(card('piano')).toHaveAttribute('data-status', 'in-progress');
    expect(within(card('piano')).getByText('In progress')).toBeInTheDocument();
    expect(within(card('piano')).getByText('1/5 wk')).toBeInTheDocument();

    expect(card('soccer')).toHaveAttribute('data-status', 'pending');
    expect(within(card('soccer')).getByText('Not yet')).toBeInTheDocument();
    expect(within(card('soccer')).getByText('1/2 wk')).toBeInTheDocument();

    expect(card('bonnie')).toHaveAttribute('data-status', 'done-today');
    expect(within(card('bonnie')).getByText('Done today')).toBeInTheDocument();
    expect(within(card('bonnie')).getByText('3/3 wk')).toBeInTheDocument();
  });

  test('weekly mode keeps finished goals on the board and marks the week target Complete', async () => {
    renderBoard('weekly');

    expect(await screen.findByTestId('classroom-board')).toHaveAttribute('data-progress-mode', 'weekly');
    expect(screen.getByTestId('progress-summary')).toHaveTextContent('1 of 4 week goals met');
    expect(screen.getByTestId('task-grid').querySelectorAll('[data-testid="goal-card"]')).toHaveLength(4);

    expect(card('algebra')).toHaveAttribute('data-status', 'pending');
    expect(within(card('algebra')).getByText('Pending')).toBeInTheDocument();

    expect(card('soccer')).toHaveAttribute('data-status', 'in-progress');
    expect(within(card('soccer')).getByText('Progress')).toBeInTheDocument();
    expect(within(card('soccer')).getByText('1/2 wk')).toBeInTheDocument();

    expect(card('piano')).toHaveAttribute('data-status', 'done-today');
    expect(card('bonnie')).toHaveAttribute('data-status', 'week-complete');
    expect(within(card('bonnie')).getByText('Complete')).toBeInTheDocument();
    expect(within(card('bonnie')).getByText('3/3 wk')).toBeInTheDocument();
  });

  test('an omitted mode still renders the weekly board', async () => {
    render(
      <DashboardView
        homeschool={{ ...homeschool, dashboardSettings: { cycleSeconds: 30, startOfWeek, timezone: zone } }}
        students={[sophia]}
        goals={goals}
        activities={activities}
        activityInstances={instances}
        startOfWeek={startOfWeek}
        timezone={zone}
        isPublic
        onClose={() => undefined}
      />
    );

    await waitFor(() => expect(screen.getByTestId('classroom-board')).toHaveAttribute('data-progress-mode', 'weekly'));
    expect(screen.getByTestId('progress-summary')).toHaveTextContent('week goals met');
  });
});

describe('dashboard settings progress mode', () => {
  const baseSettings = { cycleSeconds: 30, startOfWeek: 1, timezone: 'America/New_York' };

  function renderSettings(progressMode?: 'daily' | 'weekly') {
    const onSaveSettings = jest.fn();
    render(
      <SettingsModal
        homeschool={homeschool}
        students={[sophia]}
        activities={activities}
        goals={goals}
        userRole="parent"
        currentUserId="parent1"
        currentUserInfo={{ name: 'Parent' }}
        dashboardSettings={progressMode ? { ...baseSettings, progressMode } : baseSettings}
        timerAlarmEnabled={false}
        publicDashboardId={null}
        allowMultipleRecordsPerDay={false}
        studentSortOrder="alpha"
        schoolYearStartMonth={8}
        schoolYearStartDay={1}
        adHocTasks={[]}
        activeTab="dashboard"
        onSaveSettings={onSaveSettings}
        onSaveTimerAlarm={() => undefined}
        onSavePublicDashboard={() => undefined}
        onSaveMultipleRecords={() => undefined}
        onSaveStudentSortOrder={() => undefined}
        onSaveSchoolYearStart={() => undefined}
        onEditTask={() => undefined}
        onDeleteTask={() => undefined}
        onTasksUpdated={() => undefined}
        onShowStudentForm={() => undefined}
        onShowActivityForm={() => undefined}
        onShowGoalForm={() => undefined}
        onShowInvite={() => undefined}
        onShowAuthorizedUsers={() => undefined}
        onEditHomeschool={() => undefined}
        onDeleteHomeschool={() => undefined}
        onEditStudent={() => undefined}
        onEditActivity={() => undefined}
        onEditGoal={() => undefined}
        onDeleteConfirmation={() => undefined}
        onClose={() => undefined}
      />
    );
    return onSaveSettings;
  }

  test('defaults the control to weekly and saves a chosen daily mode', async () => {
    const onSaveSettings = renderSettings();

    expect(screen.getByRole('heading', { name: /Dashboard Settings/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Daily' }));
    expect(screen.getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Not yet or Done today/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(onSaveSettings).toHaveBeenCalledWith(expect.objectContaining({
      cycleSeconds: 30,
      startOfWeek: 1,
      timezone: 'America/New_York',
      progressMode: 'daily'
    }));
  });
});

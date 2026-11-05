import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import path from 'path';
import App from '../App';
import { Activity, ActivityInstance, AdHocTask, Goal, Homeschool, Person } from '../types';

type Role = 'parent' | 'student';

const today = new Date();
today.setHours(15, 0, 0, 0);
const earlier = new Date(today);
earlier.setDate(today.getDate() - 2);
earlier.setHours(15, 0, 0, 0);

const homeschool: Homeschool = {
  id: 'hs1',
  name: 'Anes Rincon School',
  parentIds: ['parent1'],
  tutorIds: [],
  observerIds: [],
  studentIds: ['nico', 'alex'],
  createdBy: 'parent1',
  createdAt: new Date('2024-08-01'),
  dashboardSettings: { cycleSeconds: 30, startOfWeek: 1, timezone: 'America/New_York' },
  studentSortOrder: 'alpha'
};

const people: Person[] = [
  { id: 'nico', name: 'Nico', role: 'student', email: 'nico@example.com', dateOfBirth: new Date('2016-04-01') },
  { id: 'alex', name: 'Alex', role: 'student', email: 'alex@example.com', dateOfBirth: new Date('2014-04-01') }
];

const activities: Activity[] = [
  { id: 'soccer', name: 'Soccer', subjectId: 'pe', description: 'Outdoor practice', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'piano', name: 'Piano Practice', subjectId: 'music', description: 'Scales and the piece for this week.', progressReportingStyle: {}, homeschoolId: 'hs1', requiresTimeTracking: true },
  { id: 'algebra', name: 'Algebra 1', subjectId: 'math', description: 'Linear equations', progressReportingStyle: { percentageCompletion: true }, homeschoolId: 'hs1' },
  { id: 'duolingo', name: 'Duolingo', subjectId: 'language', description: '', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'first', name: 'FIRST 2025-2026 Season', subjectId: 'stem', description: 'Robot build', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'geography', name: 'Geography', subjectId: 'social', description: '', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'radio', name: 'Radio Test Preparation', subjectId: 'stem', description: 'Ham radio practice', progressReportingStyle: { progressCount: true }, progressCountName: 'questions', homeschoolId: 'hs1' },
  { id: 'reading', name: 'Read a Book', subjectId: 'ela', description: '', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'bonnie', name: 'Bonnie ELA', subjectId: 'ela', description: 'Writing workshop', progressReportingStyle: {}, homeschoolId: 'hs1' },
  { id: 'ballet', name: 'Ballet', subjectId: 'pe', description: '', progressReportingStyle: {}, homeschoolId: 'hs1' }
];

function goal(partial: Partial<Goal> & Pick<Goal, 'id' | 'activityId' | 'studentIds' | 'timesPerWeek'>): Goal {
  return {
    name: '',
    tutorOrParentId: 'parent1',
    homeschoolId: 'hs1',
    minutesPerSession: partial.activityId === 'piano' ? 30 : undefined,
    ...partial
  };
}

const goals: Goal[] = [
  goal({ id: 'g-soccer', activityId: 'soccer', studentIds: ['nico'], timesPerWeek: 2 }),
  goal({ id: 'g-piano-n', activityId: 'piano', studentIds: ['nico'], timesPerWeek: 5, percentageGoal: undefined }),
  goal({ id: 'g-algebra-n', activityId: 'algebra', studentIds: ['nico'], timesPerWeek: 5, percentageGoal: 100 }),
  goal({ id: 'g-duo-n', activityId: 'duolingo', studentIds: ['nico'], timesPerWeek: 5 }),
  goal({ id: 'g-first-n', activityId: 'first', studentIds: ['nico'], timesPerWeek: 3 }),
  goal({ id: 'g-geo-n', activityId: 'geography', studentIds: ['nico'], timesPerWeek: 3 }),
  goal({ id: 'g-radio-n', activityId: 'radio', studentIds: ['nico'], timesPerWeek: 5, progressCount: 90 }),
  goal({ id: 'g-read-n', activityId: 'reading', studentIds: ['nico'], timesPerWeek: 7 }),
  goal({ id: 'g-bonnie-n', activityId: 'bonnie', studentIds: ['nico'], timesPerWeek: 3 }),
  goal({ id: 'g-ballet', activityId: 'ballet', studentIds: ['alex'], timesPerWeek: 2 }),
  goal({ id: 'g-duo-a', activityId: 'duolingo', studentIds: ['alex'], timesPerWeek: 5 }),
  goal({ id: 'g-read-a', activityId: 'reading', studentIds: ['alex'], timesPerWeek: 7 }),
  goal({ id: 'g-piano-a', activityId: 'piano', studentIds: ['alex'], timesPerWeek: 5 }),
  goal({ id: 'g-radio-a', activityId: 'radio', studentIds: ['alex'], timesPerWeek: 5, progressCount: 90 }),
  goal({ id: 'g-algebra-a', activityId: 'algebra', studentIds: ['alex'], timesPerWeek: 5, percentageGoal: 100 }),
  goal({ id: 'g-first-a', activityId: 'first', studentIds: ['alex'], timesPerWeek: 3 }),
  goal({ id: 'g-geo-a', activityId: 'geography', studentIds: ['alex'], timesPerWeek: 3 }),
  goal({ id: 'g-bonnie-a', activityId: 'bonnie', studentIds: ['alex'], timesPerWeek: 3 })
];

function inst(id: string, goalId: string, studentId: string, when: Date, extra: Partial<ActivityInstance> = {}): ActivityInstance {
  return {
    id,
    goalId,
    studentId,
    description: '',
    date: when,
    createdBy: 'parent1',
    ...extra
  };
}

const instances: ActivityInstance[] = [
  inst('i1', 'g-piano-n', 'nico', earlier),
  inst('i2', 'g-piano-n', 'nico', earlier),
  inst('i3', 'g-algebra-n', 'nico', earlier),
  inst('i4', 'g-algebra-n', 'nico', earlier),
  inst('i5', 'g-algebra-n', 'nico', today, { percentageCompleted: 93 }),
  inst('i6', 'g-algebra-n', 'nico', today, { percentageCompleted: 93 }),
  inst('i7', 'g-duo-n', 'nico', earlier),
  inst('i8', 'g-duo-n', 'nico', earlier),
  inst('i9', 'g-duo-n', 'nico', today),
  inst('i10', 'g-first-n', 'nico', earlier),
  inst('i11', 'g-first-n', 'nico', earlier),
  inst('i12', 'g-geo-n', 'nico', earlier),
  inst('i13', 'g-geo-n', 'nico', earlier),
  inst('i14', 'g-radio-n', 'nico', earlier, { countCompleted: 40 }),
  inst('i15', 'g-radio-n', 'nico', earlier, { countCompleted: 55 }),
  inst('i16', 'g-radio-n', 'nico', today, { countCompleted: 65 }),
  inst('i17', 'g-read-n', 'nico', earlier),
  inst('i18', 'g-read-n', 'nico', earlier),
  inst('i19', 'g-read-n', 'nico', earlier),
  inst('i20', 'g-read-n', 'nico', today),
  inst('i21', 'g-bonnie-n', 'nico', earlier),
  inst('i22', 'g-bonnie-n', 'nico', earlier),
  inst('i23', 'g-bonnie-n', 'nico', earlier),
  inst('i24', 'g-piano-a', 'alex', earlier),
  inst('i25', 'g-radio-a', 'alex', earlier, { countCompleted: 65 }),
  inst('i26', 'g-algebra-a', 'alex', earlier, { percentageCompleted: 20 }),
  inst('i27', 'g-algebra-a', 'alex', earlier, { percentageCompleted: 25 }),
  inst('i28', 'g-algebra-a', 'alex', today, { percentageCompleted: 29 }),
  inst('i29', 'g-first-a', 'alex', earlier),
  inst('i30', 'g-first-a', 'alex', today),
  inst('i31', 'g-geo-a', 'alex', earlier),
  inst('i32', 'g-geo-a', 'alex', today),
  inst('i33', 'g-bonnie-a', 'alex', earlier),
  inst('i34', 'g-bonnie-a', 'alex', earlier),
  inst('i35', 'g-bonnie-a', 'alex', earlier)
];

const tasks: AdHocTask[] = [
  {
    id: 'task1',
    name: 'Science fair poster',
    description: 'Sketch the layout before Friday.',
    studentId: 'nico',
    homeschoolId: 'hs1',
    startDate: earlier,
    targetDate: today,
    createdBy: 'parent1',
    createdAt: earlier
  }
];

const mockState: { role: Role } = { role: 'parent' };

function mockRows(items: Array<{ id: string }>) {
  return {
    empty: items.length === 0,
    docs: items.map(item => ({
      id: item.id,
      data: () => item
    }))
  };
}

jest.mock('../firebase', () => ({
  db: {},
  auth: {
    signOut: jest.fn(),
    currentUser: null
  },
  functions: {}
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: any) => void) => {
    const state = (global as any).__HS_MOCK__;
    const student = state?.role === 'student';
    callback({
      uid: student ? 'nico' : 'parent1',
      email: student ? 'nico@example.com' : 'parent@example.com',
      displayName: student ? 'Nico' : 'Parent'
    });
    return jest.fn();
  }
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  setDoc: jest.fn(),
  arrayRemove: jest.fn((value: unknown) => value),
  arrayUnion: jest.fn((value: unknown) => value),
  increment: jest.fn((value: unknown) => value),
  Timestamp: { now: () => ({ toDate: () => new Date() }), fromDate: (date: Date) => date }
}));

jest.mock('../utils/activityUtils', () => ({
  fetchCompleteStudentData: jest.fn()
}));

function installState(role: Role) {
  mockState.role = role;
  (global as any).__HS_MOCK__ = {
    role,
    homeschool,
    people,
    activities,
    goals,
    tasks,
    instances
  };
}

function writePreview(name: string, html: string) {
  const dir = '/tmp/hs-preview';
  fs.mkdirSync(dir, { recursive: true });
  const paints: { [icon: string]: string } = {
    '○': 'background-color:#f5f5f5;color:#616161;border-color:#9e9e9e',
    '◐': 'background-color:#fff8e1;color:#f57c00;border-color:#ffc107',
    '✔': 'background-color:#e3f2fd;color:#1565c0;border-color:#2196f3',
    '✓': 'background-color:#e8f5e9;color:#2e7d32;border-color:#4caf50'
  };
  // jsdom drops CSS variables from inline styles. Paint the saved preview from
  // the same status icon the components render, using the light-mode tokens.
  const painted = html.replace(/<div class="(hs-chip|hs-activity-card)((?: [^"]*)?)"([^>]*)>/g, (full, className, extra, rest, offset, source) => {
    const ahead = source.slice(offset, offset + 700);
    const icon = ahead.match(/class="hs-chip-icon"[^>]*>([○◐✔✓])/);
    if (!icon || String(rest).includes('style="background-color')) return full;
    return `<div class="${className}${extra || ''}" style="${paints[icon[1]]}"${rest}>`;
  }).replace(/class="hs-progress-fill" style="([^"]*)"/g, (_full, style) => {
    return `class="hs-progress-fill" style="${style};background-color:#2196f3"`;
  });
  const document = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="file://${path.resolve('src/index.css')}" />
  <link rel="stylesheet" href="file://${path.resolve('src/App.css')}" />
</head>
<body>${painted}</body>
</html>`;
  fs.writeFileSync(path.join(dir, name), document);
}

describe('parent and student surface polish', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    localStorage.clear();
    const firestore = jest.requireMock('firebase/firestore');
    firestore.collection.mockImplementation((_db: unknown, name: string) => name);
    firestore.where.mockImplementation((field: string, op: string, value: unknown) => ({ field, op, value }));
    firestore.query.mockImplementation((col: string, ...constraints: any[]) => ({ col, constraints }));
    firestore.doc.mockImplementation((_db: unknown, coll: string, id?: string) => ({ coll, id }));
    firestore.getDoc.mockImplementation(async (ref: { coll: string; id?: string }) => {
      const state = (global as any).__HS_MOCK__;
      if (ref?.coll === 'people' && ref.id) {
        const person = state.people.find((item: Person) => item.id === ref.id);
        if (!person) return { exists: () => false };
        return { exists: () => true, id: person.id, data: () => person };
      }
      return { exists: () => false };
    });
    firestore.getDocs.mockImplementation(async (q: { col: string; constraints?: Array<{ field: string }> }) => {
      const state = (global as any).__HS_MOCK__;
      const fields = (q?.constraints || []).map(constraint => constraint.field);
      if (q?.col === 'homeschools') {
        if (fields.includes('parentIds') && state.role === 'parent') return mockRows([state.homeschool]);
        if (fields.includes('studentIds') && state.role === 'student') return mockRows([state.homeschool]);
        return mockRows([]);
      }
      if (q?.col === 'people') {
        if (fields.includes('email') && state.role === 'student') {
          return mockRows(state.people.filter((person: Person) => person.id === 'nico'));
        }
        return mockRows([]);
      }
      if (q?.col === 'activities') return mockRows(state.activities);
      if (q?.col === 'goals') return mockRows(state.goals);
      if (q?.col === 'adHocTasks') return mockRows(state.tasks);
      if (q?.col === 'activityInstances') {
        const goalIn = (q.constraints || []).find(constraint => constraint.field === 'goalId' && (constraint as { op?: string }).op === 'in');
        const goalIds = goalIn ? (goalIn as unknown as { value: string[] }).value : null;
        const matched = goalIds
          ? state.instances.filter((item: ActivityInstance) => goalIds.includes(item.goalId))
          : state.instances;
        return mockRows(matched);
      }
      return mockRows([]);
    });
    const activityUtils = jest.requireMock('../utils/activityUtils');
    activityUtils.fetchCompleteStudentData.mockImplementation(async () => {
      const state = (global as any).__HS_MOCK__;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const nicoGoals = state.goals.filter((item: Goal) => item.studentIds.includes('nico'));
      const activityIds = new Set(nicoGoals.map((item: Goal) => item.activityId));
      return {
        goals: nicoGoals,
        activities: state.activities.filter((item: Activity) => activityIds.has(item.id)),
        todayInstances: state.instances.filter((item: ActivityInstance) => item.studentId === 'nico' && item.date >= start && item.date < end),
        weekInstances: state.instances.filter((item: ActivityInstance) => item.studentId === 'nico')
      };
    });
  });

  test('parent dashboard uses quiet actions and shared status chips', async () => {
    installState('parent');
    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { name: 'Anes Rincon School' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Today's Progress" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Record Progress' })).toHaveClass('hs-btn');
    expect(screen.getByRole('button', { name: '+ Record Activity' })).toHaveClass('hs-btn');
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveClass('hs-btn');
    expect(screen.getByRole('button', { name: 'Reports' })).toHaveClass('hs-btn');
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveClass('hs-btn');
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Apple TV/i);
    expect(container.querySelector('.hs-student-grid')).toBeTruthy();
    expect(await screen.findByTitle(/Attainment: 93.0%/)).toBeInTheDocument();

    const nicoCard = screen.getByRole('heading', { name: /Nico/ }).closest('article') as HTMLElement;
    expect(within(nicoCard).getByText('1/9 Complete')).toBeInTheDocument();
    expect(within(nicoCard).getByText('Soccer')).toBeInTheDocument();
    const bonnieChip = within(nicoCard).getByText('Bonnie ELA').closest('.hs-chip') as HTMLElement;
    expect(bonnieChip.querySelector('.hs-chip-icon')?.textContent).toBe('✓');
    expect(within(nicoCard).getByRole('button', { name: 'Assign Task' })).toHaveClass('hs-btn-accent');

    writePreview('parent.html', container.innerHTML);

    await userEvent.click(within(nicoCard).getByText('Piano Practice'));
    expect(await screen.findByRole('heading', { name: 'Record Activity' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(nicoCard).getByRole('button', { name: 'Assign Task' }));
    expect(await screen.findByRole('heading', { name: 'Assign Task' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { level: 2, name: /Settings/ })).toBeInTheDocument();
  });

  test('student dashboard shares status colors and still records work', async () => {
    installState('student');
    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { name: 'Welcome, Nico' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Today's Activities" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Record Activity' })).toHaveClass('hs-btn');
    expect(screen.getAllByText('Not started').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Done today').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Week complete').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/Apple TV/i);
    expect(container.querySelector('.hs-activity-card')).toBeTruthy();
    expect(screen.getByText(/sessions this week/)).toBeInTheDocument();

    const algebra = screen.getByRole('heading', { name: 'Algebra 1' }).closest('.hs-activity-card') as HTMLElement;
    expect(algebra.querySelector('.hs-chip-icon')?.textContent).toBe('✔');
    expect(within(algebra).getByText('4/5 wk · 93% of 100% · 2x today')).toBeInTheDocument();

    writePreview('student.html', container.innerHTML);

    await userEvent.click(screen.getByRole('heading', { name: 'Soccer' }));
    expect(await screen.findByRole('heading', { name: 'Record Activity' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Record Activity' }));
    expect(await screen.findByRole('heading', { name: 'Record Activity' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByText('Science fair poster'));
    expect(await screen.findByRole('heading', { name: 'Complete Task' })).toBeInTheDocument();
  });
});

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
    const focus = state?.people?.find((person: Person) => person.id === (state.focusStudentId || 'nico'));
    callback({
      uid: student ? (focus?.id || 'nico') : 'parent1',
      email: student ? (focus?.email || 'nico@example.com') : 'parent@example.com',
      displayName: student ? (focus?.name || 'Nico') : 'Parent'
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
  }).replace(/<select([^>]*)>(\s*)<option value="">Select a student\.\.\.<\/option><option value="([^"]+)">/g, (_full, attrs, space, id) => {
    return `<select${attrs}>${space}<option value="">Select a student...</option><option value="${id}" selected>`;
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
  beforeAll(() => {
    installStyleCapture();
  });

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
          const id = state.focusStudentId || 'nico';
          return mockRows(state.people.filter((person: Person) => person.id === id));
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
      const studentId = state.focusStudentId || 'nico';
      const studentGoals = state.goals.filter((item: Goal) => item.studentIds.includes(studentId));
      const activityIds = new Set(studentGoals.map((item: Goal) => item.activityId));
      return {
        goals: studentGoals,
        activities: state.activities.filter((item: Activity) => activityIds.has(item.id)),
        todayInstances: state.instances.filter((item: ActivityInstance) => item.studentId === studentId && item.date >= start && item.date < end),
        weekInstances: state.instances.filter((item: ActivityInstance) => item.studentId === studentId)
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

  test('student home matches the live dark student surface', async () => {
    installLiveStudent();
    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { name: /Welcome, Alex/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Today's Activities/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Record Activity' })).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0 of 5\/week/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Go up 1%').length).toBeGreaterThan(0);
    expect(screen.getByText('Session and Assignment')).toBeInTheDocument();
    expect(screen.getAllByText('➕ Record').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/Apple TV/);
    expect(container.querySelector('.hs-student-live')).toBeTruthy();
    expect(container.querySelector('.hs-student-grid')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign Task' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Record Progress' })).not.toBeInTheDocument();
    expect(screen.getByText('0/44 sessions')).toBeInTheDocument();
    expect(screen.getByText('0/11 today')).toBeInTheDocument();
    expect(document.documentElement.dataset.view).toBe('student');

    materializeStyles(container);
    expect(container.innerHTML).toContain('linear-gradient(135deg, #667eea');
    writeDarkPreview('student-live.html', container.innerHTML);

    await userEvent.click(screen.getByRole('heading', { name: /Algebra 1/ }));
    expect(await screen.findByRole('heading', { name: 'Record Activity' })).toBeInTheDocument();
  });
});

const styleBag = new WeakMap<CSSStyleDeclaration, Record<string, string>>();

function installStyleCapture() {
  const proto = CSSStyleDeclaration.prototype as any;
  if (proto.__hsCaptured) return;
  proto.__hsCaptured = true;
  for (const prop of Object.getOwnPropertyNames(proto)) {
    if (prop === 'cssText' || prop === 'length' || prop === 'parentRule') continue;
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    const get = desc && desc.get;
    const set = desc && desc.set;
    if (typeof get !== 'function' || typeof set !== 'function') continue;
    const kebab = prop.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: Boolean(desc && desc.enumerable),
      get() {
        const bag = styleBag.get(this);
        if (bag && Object.prototype.hasOwnProperty.call(bag, kebab)) return bag[kebab];
        return get.call(this);
      },
      set(value: string) {
        let bag = styleBag.get(this);
        if (!bag) {
          bag = {};
          styleBag.set(this, bag);
        }
        bag[kebab] = value;
        try { set.call(this, value); } catch (error) { /* jsdom drops var() and gradients */ }
      }
    });
  }
}

function materializeStyles(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const bag = styleBag.get(el.style);
    if (!bag) return;
    const existing = el.getAttribute('style') || '';
    const extra = Object.entries(bag)
      .filter(([key, value]) => value != null && value !== '' && !existing.includes(key + ':'))
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    const next = [existing.replace(/;\s*$/, ''), extra].filter(Boolean).join('; ');
    if (next) el.setAttribute('style', next);
  });
}

function installLiveStudent() {
  const live = [
    ['Algebra 1', 'Go up 1%', 5, 60],
    ['Algebra 2', 'Go up 1%', 5, 60],
    ['Bonnie ELA', 'Session and Assignment', 5, 60],
    ['Duolingo', '', 5, 5],
    ['FIRST 2026-2027 Season', '', 3, 120],
    ['Geography', '', 3, 20],
    ['Science', 'Lab', 4, 30],
    ['History', 'Reading', 4, 30],
    ['Piano', 'Practice', 4, 20],
    ['Writing', 'Studio', 3, 30],
    ['Reading', 'Chapter', 3, 20]
  ] as const;
  const activities: Activity[] = live.map((row, index) => ({
    id: `live-${index}`,
    name: row[0],
    subjectId: 's',
    description: row[1],
    progressReportingStyle: {},
    homeschoolId: 'hs1'
  }));
  const goals: Goal[] = live.map((row, index) => ({
    id: `lg-${index}`,
    name: row[0],
    studentIds: ['alex'],
    activityId: `live-${index}`,
    tutorOrParentId: 'parent1',
    homeschoolId: 'hs1',
    timesPerWeek: row[2],
    minutesPerSession: row[3]
  }));
  (global as any).__HS_MOCK__ = {
    role: 'student',
    focusStudentId: 'alex',
    homeschool: { ...homeschool, name: 'Anés Rincón School', studentIds: ['alex'] },
    people: [{ id: 'alex', name: 'Alex', role: 'student', email: 'alex@example.com' }],
    activities,
    goals,
    tasks: [],
    instances: []
  };
}

function writeDarkPreview(name: string, html: string) {
  const dir = '/tmp/hs-preview';
  fs.mkdirSync(dir, { recursive: true });
  const document = `<!doctype html>
<html data-view="student">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="file://${path.resolve('src/index.css')}" />
  <link rel="stylesheet" href="file://${path.resolve('src/App.css')}" />
  <style>
    :root {
      color-scheme: dark;
      --hs-bg: #0f172a;
      --hs-bg-elevated: #1e293b;
      --hs-bg-card: #1e3048;
      --hs-text-primary: #f1f5f9;
      --hs-text-secondary: #b8c8d8;
      --hs-text-label: #e8edf3;
      --hs-border: #334155;
      --hs-goal-complete-bg: rgba(76, 175, 80, 0.12);
      --hs-goal-complete-text: #a5d6a7;
      --hs-goal-complete-border: rgba(76, 175, 80, 0.4);
      --hs-goal-today-bg: rgba(33, 150, 243, 0.12);
      --hs-goal-today-text: #90caf9;
      --hs-goal-today-border: rgba(33, 150, 243, 0.4);
      --hs-goal-progress-bg: rgba(255, 193, 7, 0.10);
      --hs-goal-progress-text: #ffe082;
      --hs-goal-progress-border: rgba(255, 193, 7, 0.4);
      --hs-goal-pending-bg: rgba(255, 255, 255, 0.06);
      --hs-goal-pending-text: #b8c8d8;
      --hs-goal-pending-border: rgba(255, 255, 255, 0.28);
      --hs-goal-pending-badge: #94a3b8;
      --hs-link-action: #818cf8;
    }
    .hs-goal-badge { color: #0f172a; }
    body, #root, .App { background: #0f172a; color: #f1f5f9; }
  </style>
</head>
<body>${html}</body>
</html>`;
  fs.writeFileSync(path.join(dir, name), document);
}

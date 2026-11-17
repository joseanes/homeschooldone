import {
  classroomSummary,
  presentClassroomCard,
  resolveProgressMode
} from './dashboardProgress';

const weekFacts = {
  timesPerWeek: 5,
  weeklyCount: 2,
  todayCount: 0,
  todayMinutes: 0
};

describe('resolveProgressMode', () => {
  test('treats a missing or unknown value as weekly', () => {
    expect(resolveProgressMode(undefined)).toBe('weekly');
    expect(resolveProgressMode(null)).toBe('weekly');
    expect(resolveProgressMode('')).toBe('weekly');
    expect(resolveProgressMode('Weekly')).toBe('weekly');
  });

  test('accepts daily', () => {
    expect(resolveProgressMode('daily')).toBe('daily');
  });
});

describe('presentClassroomCard', () => {
  test('weekly mode leads with the week target and Complete when it is met', () => {
    expect(presentClassroomCard('weekly', weekFacts)).toMatchObject({
      status: 'in-progress',
      label: 'Progress',
      weekDetail: '2/5 wk',
      countsTowardSummary: false
    });

    expect(presentClassroomCard('weekly', {
      timesPerWeek: 3,
      weeklyCount: 3,
      todayCount: 1,
      todayMinutes: 20
    })).toMatchObject({
      status: 'week-complete',
      label: 'Complete',
      weekDetail: '3/3 wk',
      countsTowardSummary: true
    });

    expect(presentClassroomCard('weekly', {
      timesPerWeek: 2,
      weeklyCount: 0,
      todayCount: 0,
      todayMinutes: 0
    })).toMatchObject({ status: 'pending', label: 'Pending' });

    // A log today is "done today" even when the session is shorter than the
    // minute target. That matches the parent board's week-centric colors.
    expect(presentClassroomCard('weekly', {
      timesPerWeek: 5,
      minutesPerSession: 30,
      weeklyCount: 1,
      todayCount: 1,
      todayMinutes: 10
    })).toMatchObject({ status: 'done-today', label: 'Done today', countsTowardSummary: false });
  });

  test('daily mode is day-scoped and keeps the week fraction as detail', () => {
    expect(presentClassroomCard('daily', weekFacts)).toMatchObject({
      status: 'pending',
      label: 'Not yet',
      weekDetail: '2/5 wk',
      countsTowardSummary: false
    });

    expect(presentClassroomCard('daily', {
      timesPerWeek: 3,
      weeklyCount: 3,
      todayCount: 1,
      todayMinutes: 30,
      minutesPerSession: 30
    })).toMatchObject({
      status: 'done-today',
      label: 'Done today',
      weekDetail: '3/3 wk',
      countsTowardSummary: true
    });

    expect(presentClassroomCard('daily', {
      timesPerWeek: 5,
      minutesPerSession: 30,
      weeklyCount: 1,
      todayCount: 1,
      todayMinutes: 10
    })).toMatchObject({
      status: 'in-progress',
      label: 'In progress',
      weekDetail: '1/5 wk',
      countsTowardSummary: false
    });

    // A finished week that was not touched today still reads as not yet,
    // so a habits year does not hide today's remaining work.
    expect(presentClassroomCard('daily', {
      timesPerWeek: 3,
      weeklyCount: 3,
      todayCount: 0,
      todayMinutes: 0
    })).toMatchObject({
      status: 'pending',
      label: 'Not yet',
      weekDetail: '3/3 wk',
      countsTowardSummary: false
    });
  });
});

describe('classroomSummary', () => {
  const cards = [
    presentClassroomCard('daily', { timesPerWeek: 1, weeklyCount: 0, todayCount: 1, todayMinutes: 0 }),
    presentClassroomCard('daily', weekFacts),
    presentClassroomCard('daily', { timesPerWeek: 2, weeklyCount: 0, todayCount: 0, todayMinutes: 0 })
  ];

  test('counts done today in daily mode', () => {
    expect(classroomSummary('daily', cards)).toMatchObject({
      done: 1,
      total: 3,
      label: '1 of 3 done today',
      percent: 33,
      ringCaption: 'Today'
    });
  });

  test('counts week goals met in weekly mode', () => {
    const weekly = [
      presentClassroomCard('weekly', { timesPerWeek: 2, weeklyCount: 2, todayCount: 1, todayMinutes: 0 }),
      presentClassroomCard('weekly', { timesPerWeek: 5, weeklyCount: 1, todayCount: 1, todayMinutes: 0 }),
      presentClassroomCard('weekly', weekFacts)
    ];
    expect(classroomSummary('weekly', weekly)).toMatchObject({
      done: 1,
      total: 3,
      label: '1 of 3 week goals met',
      percent: 33,
      ringCaption: 'This week'
    });
  });
});

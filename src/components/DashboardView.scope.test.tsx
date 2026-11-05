import React from 'react';
import { render, waitFor } from '@testing-library/react';
import DashboardView from './DashboardView';
import { Activity, Goal, Homeschool, Person } from '../types';

type Constraint = { field: string; op: string; value: unknown };

jest.mock('../firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  query: (_collection: unknown, ...constraints: Constraint[]) => {
    const bag = ((global as unknown as { __HS_QUERIES__?: Constraint[][] }).__HS_QUERIES__ =
      (global as unknown as { __HS_QUERIES__?: Constraint[][] }).__HS_QUERIES__ || []);
    bag.push(constraints);
    return { constraints };
  },
  getDocs: async () => ({ docs: [] }),
}));

const homeschool: Homeschool = {
  id: 'hs1',
  name: 'Anes Rincon School',
  parentIds: ['parent1'],
  tutorIds: [],
  observerIds: [],
  studentIds: ['alex'],
  createdBy: 'parent1',
  createdAt: new Date('2024-08-01'),
};

const students: Person[] = [
  { id: 'alex', name: 'Alex', role: 'student' },
];

function recordedQueries(): Constraint[][] {
  return (global as unknown as { __HS_QUERIES__?: Constraint[][] }).__HS_QUERIES__ || [];
}

test('classroom chart history is limited to this homeschool\'s students', async () => {
  (global as unknown as { __HS_QUERIES__?: Constraint[][] }).__HS_QUERIES__ = [];

  render(
    <DashboardView
      homeschool={homeschool}
      students={students}
      goals={[] as Goal[]}
      activities={[] as Activity[]}
      onClose={() => undefined}
      isPublic
    />
  );

  await waitFor(() => {
    const scoped = recordedQueries().some((constraints) =>
      constraints.some((item) => item.op === 'in' && item.field === 'studentId' &&
        Array.isArray(item.value) && item.value[0] === 'alex')
    );
    expect(scoped).toBe(true);
  });

  const dateOnly = recordedQueries().filter((constraints) => {
    const fields = constraints.map((constraint) => constraint.field);
    return fields.includes('date') && !fields.includes('studentId');
  });
  expect(dateOnly).toHaveLength(0);
});

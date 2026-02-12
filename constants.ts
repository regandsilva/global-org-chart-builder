import { Country, Person } from './types';

export const INITIAL_PEOPLE: Person[] = [];

export const DEPARTMENTS = [
  'Executive',
  'Sales',
  'Design and Creativity',
  'Marketing',
  'Engineering',
  'HR',
  'Finance',
  'Operations',
];

export const LOCATIONS = [
  'UK',
  'Hong Kong',
  'China',
  'USA',
  'Remote'
];

export const JOB_TITLES = [
  'CEO',
  'Director',
  'Manager',
  'Team Lead',
  'Senior Associate',
  'Associate',
  'Junior Associate',
  'Intern'
];

export const DEPT_COLORS: Record<string, string> = {
  'Executive': 'slate',
  'Sales': 'emerald',
  'Design and Creativity': 'rose',
  'Marketing': 'blue',
  'Engineering': 'amber',
  'HR': 'rose',
  'Finance': 'purple',
  'Operations': 'cyan',
};

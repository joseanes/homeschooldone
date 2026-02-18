export interface Person {
  id: string;
  email?: string;
  mobile?: string;
  name: string;
  role: 'parent' | 'tutor' | 'observer' | 'student';
  dateOfBirth?: Date | any; // Firestore Timestamp
  lastLogin?: Date | any; // Last time user logged in
  lastActivity?: Date | any; // Last time user performed any action
  // Students of different ages and abilities do different daily hours of education
  dailyWorkHoursGoal?: number; // Daily educational hours goal for students
}

export interface Homeschool {
  id: string;
  name: string;
  parentIds: string[];
  tutorIds: string[];
  observerIds: string[];
  parentEmails?: string[];
  tutorEmails?: string[];
  observerEmails?: string[];
  studentIds: string[];
  createdBy: string;
  createdAt: Date;
  dashboardSettings?: {
    cycleSeconds: number;
    startOfWeek: number;
    timezone: string;
  };
  timerAlarmEnabled?: boolean;
  publicDashboardId?: string;
  allowMultipleRecordsPerDay?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  homeschoolId: string;
}

export interface Activity {
  id: string;
  name: string;
  subjectId: string;
  description: string;
  progressReportingStyle: {
    percentageCompletion?: boolean;
    timesTotal?: boolean;
    progressCount?: boolean;
  };
  progressCountName?: string;
  homeschoolId: string;
  // Activities that track time require minutes to be specified in goals
  requiresTimeTracking?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  studentIds: string[];
  activityId: string;
  tutorOrParentId: string;
  startDate?: Date;
  completionDate?: Date;
  deadline?: Date;
  timesDone?: number;
  timesPerWeek?: number;
  progressCount?: number;
  minutesPerSession?: number;
  dailyPercentageIncrease?: number;
  percentageGoal?: number; // Target percentage completion (e.g., 95)
  homeschoolId: string;
  createdAt?: Date;
  studentCompletions?: { [studentId: string]: { completionDate?: Date; grade?: string } };
}

export interface ActivityInstance {
  id: string;
  goalId: string;
  description: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // in minutes
  date: Date;
  createdBy: string;
  studentId: string;
  startingPercentage?: number;
  endingPercentage?: number;
  percentageCompleted?: number; // Single percentage value
  countCompleted?: number;
}
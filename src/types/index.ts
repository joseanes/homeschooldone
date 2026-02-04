export interface Person {
  id: string;
  email?: string;
  name: string;
  role: 'parent' | 'tutor' | 'observer' | 'student';
  dateOfBirth?: Date | any; // Firestore Timestamp
}

export interface Homeschool {
  id: string;
  name: string;
  parentIds: string[];
  tutorIds: string[];
  observerIds: string[];
  studentIds: string[];
  createdBy: string;
  createdAt: Date;
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
}

export interface Goal {
  id: string;
  studentId: string;
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
  homeschoolId: string;
  createdAt?: Date;
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
  countCompleted?: number;
}
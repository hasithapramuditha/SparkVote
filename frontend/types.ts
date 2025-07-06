export interface User {
  id: string;
  username: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
}

export interface Group {
  id: string;
  name: string;
  weight: number; // Percentage, e.g., 40
  password?: string;
  hasPassword?: boolean;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  closeTime: string;
  ownerId: string;
  voteCode: string;
  groups: Group[];
  projects: Project[];
  criteria: VoteCriterion[];
  isVotingOpen?: boolean | null;
  votingStatus?: 'open' | 'closed' | 'upcoming';
}

export interface Vote {
  id: string;
  voterGroupId: string;
  projectId: string;
  scores: { [criteria: string]: number };
}

export interface VoteCriterion {
  id: string;
  name: string;
  maxScore: number;
}
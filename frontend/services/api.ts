import { User, Event, Group, Project, Vote } from '../types';

const API_BASE_URL = '/api';

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

// Data transformation functions
const transformUser = (user: any): User => ({
  id: user._id || user.id,
  username: user.username,
});

const transformGroup = (group: any): Group => ({
  id: group._id || group.id,
  name: group.name,
  weight: group.weight || 50,
  password: group.password,
  hasPassword: group.hasPassword || !!group.password,
});

const transformProject = (project: any): Project => ({
  id: project._id || project.id,
  name: project.name,
  description: project.description || '',
});

const transformEvent = (event: any): Event => ({
  id: event._id || event.id,
  name: event.name,
  description: event.description || '',
  date: event.date,
  startTime: event.startTime,
  closeTime: event.closeTime,
  ownerId: event.owner?._id || event.owner?.id || event.ownerId,
  voteCode: event.voteCode,
  groups: (event.groups || []).map(transformGroup),
  projects: (event.projects || []).map(transformProject),
  criteria: event.criteria || []
});

// Helper function to make API requests
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['x-auth-token'] = token;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Attach the full error object for frontend parsing
    const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
    (error as any).response = errorData;
    throw error;
  }

  return response.json();
};

// --- Auth ---
export const apiLogin = async (username: string, password: string): Promise<{ user: User; token: string } | null> => {
  try {
    const data = await apiRequest<{ success: boolean; user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (data.success) {
      return { user: transformUser(data.user), token: data.token };
    }
    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
};

export const apiRegister = async (username: string, password: string, email?: string): Promise<{ user: User; token: string } | null> => {
  try {
    const data = await apiRequest<{ success: boolean; user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });

    if (data.success) {
      return { user: transformUser(data.user), token: data.token };
    }
    return null;
  } catch (error) {
    // Re-throw error so the registration page can handle it
    throw error;
  }
};

export const apiLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const data = await apiRequest<{ success: boolean; user: any }>('/auth/me');
    return data.success ? transformUser(data.user) : null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

// --- Events ---
export const getEventsByOwner = async (): Promise<Event[]> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any[] }>('/events');
    return data.success ? data.data.map(transformEvent) : [];
  } catch (error) {
    console.error('Get events error:', error);
    return [];
  }
};

export const getEventById = async (eventId: string): Promise<Event | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/${eventId}`);
    return data.success ? transformEvent(data.data) : null;
  } catch (error) {
    console.error('Get event error:', error);
    return null;
  }
};

export const getEventByVoteCode = async (voteCode: string): Promise<Event | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/vote/${voteCode}`);
    return data.success ? transformEvent(data.data) : null;
  } catch (error) {
    console.error('Get event by vote code error:', error);
    return null;
  }
};

export const validateGroupPassword = async (voteCode: string, groupId: string, password: string): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean; isValid: boolean }>(`/events/vote/${voteCode}/validate-password`, {
      method: 'POST',
      body: JSON.stringify({ groupId, password }),
    });
    return data.success && data.isValid;
  } catch (error) {
    console.error('Validate password error:', error);
    return false;
  }
};

export const createEvent = async (eventData: {
  name: string;
  description?: string;
  date: string;
  startTime: string;
  closeTime: string;
}): Promise<Event | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
    return data.success ? transformEvent(data.data) : null;
  } catch (error) {
    console.error('Create event error:', error);
    return null;
  }
};

export const updateEvent = async (eventId: string, eventData: Partial<Event>): Promise<Event | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(eventData),
    });
    return data.success ? transformEvent(data.data) : null;
  } catch (error) {
    console.error('Update event error:', error);
    return null;
  }
};

export const deleteEvent = async (eventId: string): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean; message: string }>(`/events/${eventId}`, {
      method: 'DELETE',
    });
    return data.success;
  } catch (error) {
    console.error('Delete event error:', error);
    return false;
  }
};

// --- Groups & Projects ---
export const addGroupToEvent = async (eventId: string, groupData: { name: string; weight?: number; password?: string }): Promise<Group | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/${eventId}/groups`, {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
    return data.success ? transformGroup(data.data) : null;
  } catch (error) {
    console.error('Add group error:', error);
    return null;
  }
};

export const updateGroupWeight = async (eventId: string, groupId: string, weight: number): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>(`/events/${eventId}/groups/${groupId}/weight`, {
      method: 'PUT',
      body: JSON.stringify({ weight }),
    });
    return data.success;
  } catch (error) {
    console.error('Update group weight error:', error);
    return false;
  }
};

export const removeGroupFromEvent = async (eventId: string, groupId: string): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>(`/events/${eventId}/groups/${groupId}`, {
      method: 'DELETE',
    });
    return data.success;
  } catch (error) {
    console.error('Remove group error:', error);
    return false;
  }
};

export const addProjectToEvent = async (eventId: string, projectData: { name: string; description: string; teamMembers?: string[] }): Promise<Project | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/${eventId}/projects`, {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    return data.success ? transformProject(data.data) : null;
  } catch (error) {
    console.error('Add project error:', error);
    return null;
  }
};

export const removeProjectFromEvent = async (eventId: string, projectId: string): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>(`/events/${eventId}/projects/${projectId}`, {
      method: 'DELETE',
    });
    return data.success;
  } catch (error) {
    console.error('Remove project error:', error);
    return false;
  }
};

// --- Criteria Management ---
export const addCriteriaToEvent = async (eventId: string, criteriaData: { name: string; maxScore: number }): Promise<any> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/${eventId}/criteria`, {
      method: 'POST',
      body: JSON.stringify(criteriaData),
    });
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Add criteria error:', error);
    return null;
  }
};

export const removeCriteriaFromEvent = async (eventId: string, index: number): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>(`/events/${eventId}/criteria/${index}`, {
      method: 'DELETE',
    });
    return data.success;
  } catch (error) {
    console.error('Remove criteria error:', error);
    return false;
  }
};

// --- Voting ---
export const submitVote = async (eventId: string, voteData: {
  votes: Array<{
    projectId: string;
    groupId: string;
    scores: { [key: string]: number };
  }>;
  voterName?: string;
  groupPassword?: string;
}): Promise<boolean> => {
  try {
    const data = await apiRequest<{ success: boolean }>(`/vote/${eventId}`, {
      method: 'POST',
      body: JSON.stringify(voteData),
    });
    return data.success;
  } catch (error) {
    console.error('Submit vote error:', error);
    return false;
  }
};

// --- Results ---
export const getEventResults = async (eventId: string): Promise<any> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/results/${eventId}`);
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Get results error:', error);
    return null;
  }
};

export const getPublicEventResults = async (eventId: string, weights?: { [groupId: string]: number }): Promise<any> => {
  try {
    let endpoint = `/results/public/${eventId}`;
    if (weights && Object.keys(weights).length > 0) {
      endpoint += `?weights=${encodeURIComponent(JSON.stringify(weights))}`;
    }
    const data = await apiRequest<{ success: boolean; data: any }>(endpoint);
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Get public results error:', error);
    return null;
  }
}; 

export const openVoting = async (eventId: string): Promise<Event | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/${eventId}/open-voting`, {
      method: 'POST',
    });
    return data.success ? transformEvent(data.data) : null;
  } catch (error) {
    console.error('Open voting error:', error);
    return null;
  }
};

export const closeVoting = async (eventId: string): Promise<Event | null> => {
  try {
    const data = await apiRequest<{ success: boolean; data: any }>(`/events/${eventId}/close-voting`, {
      method: 'POST',
    });
    return data.success ? transformEvent(data.data) : null;
  } catch (error) {
    console.error('Close voting error:', error);
    return null;
  }
};
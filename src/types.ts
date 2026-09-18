export interface StatusItem {
  id: string;
  title: string;
  description: string;
  category: 'core' | 'service' | 'infrastructure' | 'docs';
  status: 'operational' | 'in_progress' | 'planned' | 'paused';
  priority: 'low' | 'medium' | 'high';
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  tag: string;
  createdAt: string;
}

export interface DevNote {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  text: string;
  timestamp: string;
  type: 'status' | 'task' | 'note' | 'system';
}

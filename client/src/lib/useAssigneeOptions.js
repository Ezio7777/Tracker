'use client';
import { api } from './api';
import { useAsync } from './useAsync';

// Eligible assignees mirror the server rule: project manager + members, or managers/admins for project-less tickets.
export function useAssigneeOptions(projectId, enabled = true) {
  const { data } = useAsync(async () => {
    if (!enabled) return [];
    if (projectId) {
      const j = await api(`/projects/${projectId}`);
      return [j.data.manager, ...j.data.members];
    }
    const j = await api('/users?limit=50');
    return j.data.filter((u) => u.role !== 'MEMBER' && u.isActive !== false);
  }, [projectId, enabled]);
  return data || [];
}

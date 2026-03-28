// Harvest API client for the Power-Up
const HarvestAPI = {
  BASE_URL: 'https://api.harvestapp.com/v2',

  async getCredentials(t) {
    const token = await t.loadSecret('harvestToken');
    const accountId = await t.loadSecret('harvestAccountId');
    return { token, accountId };
  },

  async request(t, path, params = {}) {
    const { token, accountId } = await this.getCredentials(t);
    if (!token || !accountId) return null;

    const url = new URL(`${this.BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Harvest-Account-Id': accountId,
        'User-Agent': 'HarvestTrelloPowerUp'
      }
    });

    if (!res.ok) return null;
    return res.json();
  },

  // Get time entries for a Trello card by its shortLink or card ID
  async getEntriesForCard(t, cardId, shortLink) {
    // Try fetching by external_reference (shortLink is what Harvest stores)
    const data = await this.request(t, '/time_entries', {
      external_reference_id: shortLink,
      per_page: 100
    });

    if (data && data.time_entries && data.time_entries.length > 0) {
      return data.time_entries;
    }

    // Fallback: search by card URL in notes (less reliable)
    return [];
  },

  // Get total hours for a card
  async getTotalHours(t, cardId, shortLink) {
    const entries = await this.getEntriesForCard(t, cardId, shortLink);
    if (!entries || entries.length === 0) return null;

    let totalHours = 0;
    let billableHours = 0;
    let unbillableHours = 0;

    entries.forEach(e => {
      totalHours += e.rounded_hours || 0;
      if (e.billable) {
        billableHours += e.rounded_hours || 0;
      } else {
        unbillableHours += e.rounded_hours || 0;
      }
    });

    return { totalHours, billableHours, unbillableHours, count: entries.length };
  },

  // Create a new time entry linked to this card
  async createEntry(t, { projectId, taskId, spentDate, hours, notes, shortLink, boardId }) {
    const { token, accountId } = await this.getCredentials(t);
    if (!token || !accountId) return null;

    const body = {
      project_id: parseInt(projectId),
      task_id: parseInt(taskId),
      spent_date: spentDate,
      hours: parseFloat(hours),
      notes: notes,
      external_reference: {
        id: shortLink,
        group_id: boardId,
        permalink: `https://trello.com/c/${shortLink}`,
        service: 'trello.com',
        service_icon_url: 'https://proxy.harvestfiles.com/production_harvestapp_public/uploads/platform_icons/trello.com.png?1594322878'
      }
    };

    const res = await fetch(`${this.BASE_URL}/time_entries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Harvest-Account-Id': accountId,
        'User-Agent': 'HarvestTrelloPowerUp',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    return res.ok ? res.json() : null;
  },

  // Get projects (for dropdowns)
  async getProjects(t) {
    const data = await this.request(t, '/projects', { is_active: true, per_page: 100 });
    return data ? data.projects : [];
  },

  // Get task assignments for a project
  async getTaskAssignments(t, projectId) {
    const data = await this.request(t, `/projects/${projectId}/task_assignments`, { is_active: true });
    return data ? data.task_assignments : [];
  }
};

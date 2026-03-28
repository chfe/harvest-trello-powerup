// Harvest API client for the Power-Up
const HarvestAPI = {
  BASE_URL: 'https://api.harvestapp.com/v2',

  async getCredentials(t) {
    const data = await t.get('member', 'private', 'harvestCredentials', null);
    if (!data) return {};
    return { token: data.token, accountId: data.accountId };
  },

  async saveCredentials(t, token, accountId) {
    await t.set('member', 'private', 'harvestCredentials', { token, accountId });
  },

  async request(path, token, accountId, params = {}) {
    if (!token || !accountId) return null;

    const url = new URL(`${this.BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, v);
    });

    try {
      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Harvest-Account-Id': accountId,
          'User-Agent': 'HarvestTrelloPowerUp'
        }
      });
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      console.error('Harvest API error:', e);
      return null;
    }
  },

  async getEntriesForCard(token, accountId, shortLink) {
    const data = await this.request('/time_entries', token, accountId, {
      external_reference_id: shortLink,
      per_page: 100
    });
    return (data && data.time_entries) ? data.time_entries : [];
  },

  async getTotalHours(token, accountId, shortLink) {
    const entries = await this.getEntriesForCard(token, accountId, shortLink);
    if (!entries || entries.length === 0) return null;

    let totalHours = 0, billableHours = 0, unbillableHours = 0;
    entries.forEach(e => {
      totalHours += e.rounded_hours || 0;
      if (e.billable) billableHours += e.rounded_hours || 0;
      else unbillableHours += e.rounded_hours || 0;
    });

    return { totalHours, billableHours, unbillableHours, count: entries.length };
  }
};

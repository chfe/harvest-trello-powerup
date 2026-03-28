// Cache to avoid hammering Harvest API on every card render
const cache = {};
const CACHE_TTL = 60000; // 1 minute

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { data, time: Date.now() };
}

// Extract shortLink from card URL
function getShortLink(url) {
  const match = url && url.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

TrelloPowerUp.initialize({
  // Card front badges — shows total hours
  'card-badges': async function(t, opts) {
    const { token } = await HarvestAPI.getCredentials(t).catch(() => ({}));
    if (!token) return [];

    const card = await t.card('shortLink');
    const shortLink = card.shortLink;
    if (!shortLink) return [];

    const cacheKey = `badge_${shortLink}`;
    let totals = getCached(cacheKey);

    if (!totals) {
      totals = await HarvestAPI.getTotalHours(t, null, shortLink);
      if (totals) setCache(cacheKey, totals);
    }

    if (!totals || totals.totalHours === 0) return [];

    // Visibility setting
    const visibility = await t.get('board', 'shared', 'badgeVisibility', 'full');

    if (visibility === 'hidden') return [];

    if (visibility === 'minimal') {
      return [{
        icon: 'https://proxy.harvestfiles.com/production_harvestapp_public/uploads/platform_icons/trello.com.png?1594322878',
        text: '✓',
        color: 'green'
      }];
    }

    // Full visibility
    const badges = [{
      icon: 'https://proxy.harvestfiles.com/production_harvestapp_public/uploads/platform_icons/trello.com.png?1594322878',
      text: `${totals.totalHours.toFixed(2)}h`,
      color: totals.unbillableHours > 0 ? 'yellow' : 'green'
    }];

    return badges;
  },

  // Card detail badges — summary at top of card back
  'card-detail-badges': async function(t, opts) {
    const { token } = await HarvestAPI.getCredentials(t).catch(() => ({}));
    if (!token) return [];

    const card = await t.card('shortLink');
    const shortLink = card.shortLink;
    if (!shortLink) return [];

    const totals = await HarvestAPI.getTotalHours(t, null, shortLink);
    if (!totals || totals.count === 0) return [];

    const badges = [
      {
        title: 'Harvest Total',
        text: `${totals.totalHours.toFixed(2)}h (${totals.count} entries)`,
        color: 'green'
      }
    ];

    if (totals.billableHours > 0) {
      badges.push({
        title: 'Billable',
        text: `${totals.billableHours.toFixed(2)}h`,
        color: 'blue'
      });
    }

    if (totals.unbillableHours > 0) {
      badges.push({
        title: 'Non-billable',
        text: `${totals.unbillableHours.toFixed(2)}h`,
        color: 'yellow'
      });
    }

    return badges;
  },

  // Card back section — full list of time entries
  'card-back-section': function(t, opts) {
    return {
      title: 'Harvest Time Entries',
      icon: 'https://proxy.harvestfiles.com/production_harvestapp_public/uploads/platform_icons/trello.com.png?1594322878',
      content: {
        type: 'iframe',
        url: t.signUrl('./card-back.html'),
        height: 300
      }
    };
  },

  // Board button for settings
  'board-buttons': function(t, opts) {
    return [{
      icon: {
        dark: 'https://proxy.harvestfiles.com/production_harvestapp_public/uploads/platform_icons/trello.com.png?1594322878',
        light: 'https://proxy.harvestfiles.com/production_harvestapp_public/uploads/platform_icons/trello.com.png?1594322878'
      },
      text: 'Harvest Settings',
      callback: function(t) {
        return t.popup({
          title: 'Harvest Settings',
          url: './settings.html',
          height: 300
        });
      }
    }];
  },

  // Show authorize button if not configured
  'authorization-status': async function(t, opts) {
    const { token } = await HarvestAPI.getCredentials(t).catch(() => ({}));
    return { authorized: !!token };
  },

  'show-authorization': function(t, opts) {
    return t.popup({
      title: 'Connect Harvest',
      url: './settings.html',
      height: 300
    });
  }
});

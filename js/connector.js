var BADGE_CACHE = {};
var CACHE_TTL = 120000; // 2 minutes

TrelloPowerUp.initialize({
  'card-badges': function(t) {
    return t.card('shortLink').then(function(card) {
      return t.get('member', 'private', 'harvestCredentials', null).then(function(creds) {
        if (!creds || !creds.token) return [];

        var key = 'b_' + card.shortLink;
        var cached = BADGE_CACHE[key];
        if (cached && Date.now() - cached.time < CACHE_TTL) {
          return cached.badges;
        }

        return HarvestAPI.getTotalHours(creds.token, creds.accountId, card.shortLink).then(function(totals) {
          if (!totals || totals.totalHours === 0) return [];

          return t.get('board', 'shared', 'badgeVisibility', 'full').then(function(visibility) {
            if (visibility === 'hidden') return [];

            if (visibility === 'minimal') {
              var minBadges = [{ text: '✓ tracked', color: 'green' }];
              BADGE_CACHE[key] = { badges: minBadges, time: Date.now() };
              return minBadges;
            }

            var badges = [{
              text: '⏱ ' + totals.totalHours.toFixed(1) + 'h',
              color: totals.unbillableHours > 0 ? 'orange' : 'sky'
            }];

            BADGE_CACHE[key] = { badges: badges, time: Date.now() };
            return badges;
          });
        }).catch(function() { return []; });
      }).catch(function() { return []; });
    });
  },

  'card-detail-badges': function(t) {
    return t.card('shortLink').then(function(card) {
      return t.get('member', 'private', 'harvestCredentials', null).then(function(creds) {
        if (!creds || !creds.token) return [];

        return HarvestAPI.getTotalHours(creds.token, creds.accountId, card.shortLink).then(function(totals) {
          if (!totals || totals.count === 0) return [];

          var badges = [{
            title: 'Total',
            text: totals.totalHours.toFixed(2) + 'h (' + totals.count + ' entries)',
            color: 'green'
          }];

          if (totals.billableHours > 0) {
            badges.push({ title: 'Billable', text: totals.billableHours.toFixed(2) + 'h', color: 'blue' });
          }
          if (totals.unbillableHours > 0) {
            badges.push({ title: 'Non-billable', text: totals.unbillableHours.toFixed(2) + 'h', color: 'yellow' });
          }

          return badges;
        }).catch(function() { return []; });
      }).catch(function() { return []; });
    });
  },

  'card-back-section': function(t) {
    return t.get('member', 'private', 'harvestCredentials', null).then(function(creds) {
      if (!creds || !creds.token) return [];
      return {
        title: 'Harvest Time Entries',
        icon: '',
        content: {
          type: 'iframe',
          url: t.signUrl('./card-back.html'),
          height: 300
        }
      };
    }).catch(function() { return []; });
  },

  'board-buttons': function(t) {
    return [{
      text: 'Harvest Settings',
      callback: function(t) {
        return t.popup({
          title: 'Harvest Settings',
          url: './settings.html',
          height: 320
        });
      }
    }];
  },

  'show-settings': function(t) {
    return t.popup({
      title: 'Harvest Settings',
      url: './settings.html',
      height: 320
    });
  }
});

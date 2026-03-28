var BADGE_CACHE = {};
var CACHE_TTL = 120000; // 2 minutes
var BASE_URL = 'https://chfe.github.io/harvest-trello-powerup';
var ICON_URL = BASE_URL + '/img/harvest-logo-orange.svg';
var ICON_WHITE_URL = BASE_URL + '/img/harvest-logo-white.svg';

TrelloPowerUp.initialize({
  'card-badges': function(t, opts) {
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
              text: totals.totalHours.toFixed(1) + 'h',
              color: totals.unbillableHours > 0 ? 'orange' : 'sky'
            }];

            if (totals.uninvoicedHours > 0 && totals.uninvoicedHours < totals.totalHours) {
              badges.push({
                text: totals.uninvoicedHours.toFixed(1) + 'h unbilled',
                color: 'yellow'
              });
            }

            BADGE_CACHE[key] = { badges: badges, time: Date.now() };
            return badges;
          });
        }).catch(function() { return []; });
      }).catch(function() { return []; });
    });
  },

  'card-detail-badges': function(t) {
    return [];
  },

  'card-buttons': function(t) {
    return t.get('member', 'private', 'harvestCredentials', null).then(function(creds) {
      if (!creds || !creds.token) return [];
      return [{
        icon: ICON_URL,
        text: 'Log Time',
        callback: function(t) {
          return t.card('shortLink', 'name', 'url').then(function(card) {
            var url = './entry-form.html?shortLink=' + encodeURIComponent(card.shortLink)
              + '&cardName=' + encodeURIComponent(card.name || '')
              + '&cardUrl=' + encodeURIComponent(card.url || '');
            return t.popup({
              title: 'New Time Entry',
              url: url,
              height: 340
            });
          });
        }
      }];
    });
  },

  'card-back-section': function(t) {
    return t.get('member', 'private', 'harvestCredentials', null).then(function(creds) {
      if (!creds || !creds.token) return [];
      return {
        title: 'Harvest Time Entries',
        icon: ICON_URL,
        content: {
          type: 'iframe',
          url: t.signUrl('./card-back.html'),
          height: 300
        },
        action: {
          text: 'Log Time',
          callback: function(t) {
            return t.card('shortLink', 'name', 'url').then(function(card) {
              var url = './entry-form.html?shortLink=' + encodeURIComponent(card.shortLink)
                + '&cardName=' + encodeURIComponent(card.name || '')
                + '&cardUrl=' + encodeURIComponent(card.url || '');
              return t.popup({
                title: 'New Time Entry',
                url: url,
                height: 340
              });
            });
          }
        }
      };
    }).catch(function() { return []; });
  },

  'board-buttons': function(t) {
    return [{
      icon: {
        dark: ICON_WHITE_URL,
        light: ICON_URL
      },
      text: 'Harvest',
      callback: function(t) {
        return t.popup({
          title: 'Harvest',
          url: './board-summary.html',
          height: 420
        });
      }
    }];
  },

  'show-settings': function(t) {
    return t.popup({
      title: 'Harvest Settings',
      url: './settings.html',
      height: 400
    });
  }
});

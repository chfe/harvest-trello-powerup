    var t = TrelloPowerUp.iframe();

    function formatCHF(amount) {
      var parts = amount.toFixed(2).split('.');
      var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
      return "CHF " + intPart + '.' + parts[1];
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    Promise.all([
      t.get('member', 'private', 'harvestCredentials', null),
      t.get('board', 'shared', 'harvestProjectId', null),
      t.get('board', 'shared', 'badgeVisibility', 'full')
    ]).then(function(results) {
      var creds = results[0];
      var projectId = results[1];
      var visibility = results[2];
      var container = document.getElementById('content');

      if (!creds || !creds.token) {
        container.innerHTML = '<div class="empty-text">No Harvest credentials configured.<br>Use "Authorize Account" in the Power-Up menu.</div>';
        return;
      }

      // Load projects for dropdown
      HarvestAPI.request('/projects', creds.token, creds.accountId, { is_active: true, per_page: 100 }).then(function(projData) {
        var projects = (projData && projData.projects) ? projData.projects.slice().sort(function(a, b) {
          var aName = (a.client ? a.client.name + ' — ' + a.name : a.name).toLowerCase();
          var bName = (b.client ? b.client.name + ' — ' + b.name : b.name).toLowerCase();
          return aName.localeCompare(bName, 'de');
        }) : [];

        var html = '';

        // Board Settings
        html += '<div class="section">';
        html += '<div class="section-title">Board Project</div>';
        html += '<select id="projectId">';
        html += '<option value="">— none —</option>';
        projects.forEach(function(p) {
          var label = p.client ? escapeHtml(p.client.name) + ' — ' + escapeHtml(p.name) : escapeHtml(p.name);
          var sel = (projectId && String(p.id) === String(projectId)) ? ' selected' : '';
          html += '<option value="' + p.id + '"' + sel + '>' + label + '</option>';
        });
        html += '</select>';
        html += '<div class="section-title">Card Badge</div>';
        html += '<select id="visibility">';
        html += '<option value="full"' + (visibility === 'full' ? ' selected' : '') + '>Show hours (e.g. 2.5h)</option>';
        html += '<option value="minimal"' + (visibility === 'minimal' ? ' selected' : '') + '>Show only ✓ tracked</option>';
        html += '<option value="hidden"' + (visibility === 'hidden' ? ' selected' : '') + '>Hidden</option>';
        html += '</select>';
        html += '</div>';

        html += '<div class="divider"></div>';
        html += '<div id="summary"></div>';

        container.innerHTML = html;

        // Auto-save on change
        document.getElementById('projectId').addEventListener('change', saveAndReload);
        document.getElementById('visibility').addEventListener('change', saveAndReload);

        // Load summary if project is set
        if (projectId) loadSummary(creds, projectId, projects);
        else document.getElementById('summary').innerHTML = '<div class="empty-text">Select a project to see totals.</div>';
      });

      function saveAndReload() {
        var newProjectId = document.getElementById('projectId').value;
        var newVisibility = document.getElementById('visibility').value;
        Promise.all([
          t.set('board', 'shared', 'harvestProjectId', newProjectId || null),
          t.set('board', 'shared', 'badgeVisibility', newVisibility)
        ]).then(function() {
          if (newProjectId) {
            document.getElementById('summary').innerHTML = '<div class="loader"><div class="spinner"></div></div>';
            HarvestAPI.request('/projects', creds.token, creds.accountId, { is_active: true, per_page: 100 }).then(function(projData) {
              var projects = (projData && projData.projects) ? projData.projects : [];
              loadSummary(creds, newProjectId, projects);
            });
          } else {
            document.getElementById('summary').innerHTML = '<div class="empty-text">Select a project to see totals.</div>';
          }
        });
      }

      // Shared state for the unassigned-entries view
      var viewState = null;

      function loadSummary(creds, pid, projects) {
        Promise.all([
          HarvestAPI.request('/projects/' + pid, creds.token, creds.accountId),
          HarvestAPI.requestAllPages('/time_entries', creds.token, creds.accountId, { project_id: pid }, 'time_entries')
        ]).then(function(data) {
          var project = data[0];
          var entries = data[1] || [];
          var summaryEl = document.getElementById('summary');

          if (!project) {
            summaryEl.innerHTML = '<div class="error">Could not load project.</div>';
            return;
          }

          viewState = {
            creds: creds,
            projectId: pid,
            project: project,
            entries: entries,
            unassigned: entries.filter(function(e) {
              return !e.external_reference || !e.external_reference.id;
            }).sort(function(a, b) {
              return (b.spent_date || '').localeCompare(a.spent_date || '');
            }),
            selected: {},
            cards: null
          };

          renderSummaryView();
        }).catch(function() {
          document.getElementById('summary').innerHTML = '<div class="error">Could not load Harvest data.</div>';
        });
      }

      function renderSummaryView() {
        var project = viewState.project;
        var entries = viewState.entries;

        var totalH = 0, billH = 0, nonBillH = 0, invoicedH = 0, uninvoicedH = 0;
        var uninvoicedAmount = 0;
        entries.forEach(function(e) {
          var h = e.rounded_hours || 0;
          var rate = e.billable_rate || 0;
          totalH += h;
          if (e.billable && e.billable_rate > 0) billH += h; else nonBillH += h;
          if (e.is_billed) { invoicedH += h; }
          else { uninvoicedH += h; uninvoicedAmount += h * rate; }
        });

        var unassignedH = viewState.unassigned.reduce(function(s, e) { return s + (e.rounded_hours || 0); }, 0);

        var clientName = project.client ? escapeHtml(project.client.name) : '';
        var projectName = escapeHtml(project.name);

        var html = '';
        html += '<div class="header">';
        html += '<img src="./img/harvest-logo-orange.svg" alt="">';
        html += '<div>';
        if (clientName) html += '<div class="client-name">' + clientName + '</div>';
        html += '<div class="project-name">' + projectName + '</div>';
        html += '</div></div>';

        html += '<div class="stats">';
        html += '<div class="stat-card unbilled"><div class="value">' + uninvoicedH.toFixed(1) + 'h</div><div class="label">Unbilled</div></div>';
        html += '<div class="stat-card amount"><div class="value">' + formatCHF(uninvoicedAmount) + '</div><div class="label">Unbilled Amount</div></div>';
        html += '<div class="stat-card invoiced"><div class="value">' + invoicedH.toFixed(1) + 'h</div><div class="label">Invoiced</div></div>';
        html += '<div class="stat-card total"><div class="value">' + totalH.toFixed(1) + 'h</div><div class="label">Total</div></div>';
        html += '</div>';

        if (viewState.unassigned.length > 0) {
          html += '<div class="unassigned-banner">';
          html += '<span class="label">⚠ ' + viewState.unassigned.length + ' unassigned · ' + unassignedH.toFixed(2) + 'h</span>';
          html += '<button id="reviewUnassigned">Review</button>';
          html += '</div>';
        }

        html += '<div class="divider"></div>';
        html += '<div class="breakdown">';
        html += '<div class="breakdown-row"><span class="label">Billable</span><span class="value">' + billH.toFixed(1) + 'h</span></div>';
        if (nonBillH > 0) {
          html += '<div class="breakdown-row"><span class="label">Non-billable</span><span class="value">' + nonBillH.toFixed(1) + 'h</span></div>';
        }
        html += '<div class="breakdown-row"><span class="label">Time entries</span><span class="value">' + entries.length + '</span></div>';
        if (project.budget) {
          var budgetType = project.budget_by === 'project' ? 'h' : '';
          html += '<div class="breakdown-row"><span class="label">Budget</span><span class="value">' + project.budget + budgetType + '</span></div>';
          if (project.budget_by === 'project') {
            var pct = Math.round((totalH / project.budget) * 100);
            html += '<div class="breakdown-row"><span class="label">Used</span><span class="value">' + pct + '%</span></div>';
          }
        }
        html += '</div>';

        document.getElementById('summary').innerHTML = html;

        var reviewBtn = document.getElementById('reviewUnassigned');
        if (reviewBtn) reviewBtn.addEventListener('click', renderUnassignedView);
      }

      function formatDate(iso) {
        if (!iso) return '';
        var parts = iso.split('-');
        if (parts.length !== 3) return iso;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
      }

      function renderUnassignedView() {
        viewState.selected = {};
        ensureCardsLoaded().then(function() {
          drawUnassignedList();
        });
      }

      function ensureCardsLoaded() {
        if (viewState.cards) return Promise.resolve();
        return t.cards('id', 'name', 'shortLink', 'url', 'closed').then(function(cards) {
          viewState.cards = (cards || []).filter(function(c) { return !c.closed; });
        }).catch(function() {
          viewState.cards = [];
        });
      }

      function drawUnassignedList() {
        var html = '';
        html += '<button class="back-link" id="backToSummary">← Back to summary</button>';

        if (viewState.unassigned.length === 0) {
          html += '<div class="empty-text">All entries are assigned to cards.</div>';
          document.getElementById('summary').innerHTML = html;
          document.getElementById('backToSummary').addEventListener('click', renderSummaryView);
          return;
        }

        html += '<div class="entry-list">';
        viewState.unassigned.forEach(function(e) {
          html += buildEntryRowHtml(e);
        });
        html += '</div>';

        html += '<div class="selection-footer" id="selectionFooter" style="display:none">';
        html += '<span class="count" id="selectionCount"></span>';
        html += '<div class="buttons">';
        html += '<button class="attach-btn" id="bulkAttachBtn">Attach to card…</button>';
        html += '<button class="create-btn" id="bulkCreateBtn">Create card</button>';
        html += '</div></div>';

        document.getElementById('summary').innerHTML = html;
        document.getElementById('backToSummary').addEventListener('click', renderSummaryView);
        wireEntryRows();
      }

      function buildEntryRowHtml(e) {
        var notes = (e.notes || '').trim();
        var taskName = e.task ? escapeHtml(e.task.name) : '';
        var hours = (e.rounded_hours || 0).toFixed(2);
        var date = formatDate(e.spent_date);
        var displayText = notes ? escapeHtml(notes) : '<em style="color:#999">(no notes)</em>';

        var html = '<div class="entry-row" data-entry-id="' + e.id + '">';
        html += '<input type="checkbox" class="entry-check" data-entry-id="' + e.id + '">';
        html += '<div class="meta">';
        html += '<div class="meta-top"><span class="date">' + date + '</span>';
        html += '<span class="hours">' + hours + 'h</span>';
        if (taskName) html += '<span class="task">· ' + taskName + '</span>';
        html += '</div>';
        html += '<div class="notes">' + displayText + '</div>';
        html += '<div class="attach-picker" data-entry-id="' + e.id + '" style="display:none">';
        html += '<input type="text" list="cardsDatalist" placeholder="Type card name…">';
        html += '<button class="confirm-attach">Attach</button>';
        html += '<button class="cancel-attach" style="background:#f4f5f7;color:#172b4d;border:1px solid #dfe1e6">✕</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="actions">';
        html += '<button class="row-attach-btn" data-entry-id="' + e.id + '">Attach▾</button>';
        html += '<button class="row-create-btn" data-entry-id="' + e.id + '">New card</button>';
        html += '</div>';
        html += '</div>';
        return html;
      }

      function wireEntryRows() {
        // Card datalist for autocomplete
        if (!document.getElementById('cardsDatalist')) {
          var dl = document.createElement('datalist');
          dl.id = 'cardsDatalist';
          (viewState.cards || []).forEach(function(c) {
            var opt = document.createElement('option');
            opt.value = c.name;
            opt.dataset.shortLink = c.shortLink;
            opt.dataset.url = c.url;
            dl.appendChild(opt);
          });
          document.body.appendChild(dl);
        }

        // Checkbox handlers
        Array.prototype.forEach.call(document.querySelectorAll('.entry-check'), function(cb) {
          cb.addEventListener('change', function() {
            var id = cb.getAttribute('data-entry-id');
            if (cb.checked) viewState.selected[id] = true;
            else delete viewState.selected[id];
            updateSelectionFooter();
          });
        });

        // Per-row attach buttons
        Array.prototype.forEach.call(document.querySelectorAll('.row-attach-btn'), function(btn) {
          btn.addEventListener('click', function() {
            var id = btn.getAttribute('data-entry-id');
            var picker = document.querySelector('.attach-picker[data-entry-id="' + id + '"]');
            picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
            if (picker.style.display === 'flex') picker.querySelector('input').focus();
          });
        });
        Array.prototype.forEach.call(document.querySelectorAll('.cancel-attach'), function(btn) {
          btn.addEventListener('click', function() {
            btn.closest('.attach-picker').style.display = 'none';
          });
        });
        Array.prototype.forEach.call(document.querySelectorAll('.confirm-attach'), function(btn) {
          btn.addEventListener('click', function() {
            var picker = btn.closest('.attach-picker');
            var id = picker.getAttribute('data-entry-id');
            var name = picker.querySelector('input').value.trim();
            var card = findCardByName(name);
            if (!card) {
              showRowError(id, 'Card not found');
              return;
            }
            attachEntriesToCard([id], card);
          });
        });

        // Per-row create button
        Array.prototype.forEach.call(document.querySelectorAll('.row-create-btn'), function(btn) {
          btn.addEventListener('click', function() {
            var id = btn.getAttribute('data-entry-id');
            createCardFromEntries([id]);
          });
        });

        // Bulk footer buttons
        var bulkAttach = document.getElementById('bulkAttachBtn');
        if (bulkAttach) {
          bulkAttach.addEventListener('click', function() {
            var ids = Object.keys(viewState.selected);
            if (ids.length === 0) return;
            promptBulkAttach(ids);
          });
        }
        var bulkCreate = document.getElementById('bulkCreateBtn');
        if (bulkCreate) {
          bulkCreate.addEventListener('click', function() {
            var ids = Object.keys(viewState.selected);
            if (ids.length === 0) return;
            createCardFromEntries(ids);
          });
        }
      }

      function updateSelectionFooter() {
        var footer = document.getElementById('selectionFooter');
        if (!footer) return;
        var n = Object.keys(viewState.selected).length;
        if (n === 0) {
          footer.style.display = 'none';
        } else {
          footer.style.display = 'flex';
          document.getElementById('selectionCount').textContent = n + ' selected';
        }
      }

      function findCardByName(name) {
        var lower = name.toLowerCase();
        return (viewState.cards || []).find(function(c) {
          return c.name.toLowerCase() === lower;
        });
      }

      function showRowError(id, msg) {
        var row = document.querySelector('.entry-row[data-entry-id="' + id + '"]');
        if (!row) return;
        row.classList.add('error-row');
        var existing = row.querySelector('.row-error');
        if (existing) existing.remove();
        var errEl = document.createElement('div');
        errEl.className = 'row-error';
        errEl.textContent = msg;
        row.querySelector('.meta').appendChild(errEl);
      }

      function promptBulkAttach(ids) {
        // Reuse a single inline form below the back link
        var existing = document.querySelector('.inline-form.bulk-attach');
        if (existing) { existing.remove(); return; }
        var form = document.createElement('div');
        form.className = 'inline-form bulk-attach';
        form.innerHTML = '<label>Attach ' + ids.length + ' entr' + (ids.length === 1 ? 'y' : 'ies') + ' to card:</label>'
          + '<input type="text" list="cardsDatalist" placeholder="Type card name…" autofocus>'
          + '<div class="row"><button class="primary">Attach</button><button class="secondary">Cancel</button></div>';
        var container = document.getElementById('summary');
        container.insertBefore(form, container.querySelector('.entry-list'));
        var input = form.querySelector('input');
        input.focus();
        form.querySelector('.secondary').addEventListener('click', function() { form.remove(); });
        form.querySelector('.primary').addEventListener('click', function() {
          var card = findCardByName(input.value.trim());
          if (!card) {
            input.style.borderColor = 'var(--ds-text-danger, #de350b)';
            return;
          }
          form.remove();
          attachEntriesToCard(ids, card);
        });
      }

      function attachEntriesToCard(ids, card) {
        var creds = viewState.creds;
        var promises = ids.map(function(id) {
          return HarvestAPI.setEntryExternalReference(creds.token, creds.accountId, id, card.shortLink, card.url)
            .then(function() { return { id: id, ok: true }; })
            .catch(function(err) { return { id: id, ok: false, err: err }; });
        });
        Promise.all(promises).then(function(results) {
          results.forEach(function(r) {
            if (r.ok) {
              viewState.unassigned = viewState.unassigned.filter(function(e) { return String(e.id) !== String(r.id); });
              delete viewState.selected[r.id];
            } else {
              showRowError(r.id, 'Attach failed');
            }
          });
          drawUnassignedList();
        });
      }

      function deriveCardTitle(entries) {
        if (entries.length === 1) {
          var e = entries[0];
          var notes = (e.notes || '').trim();
          if (notes) return notes.slice(0, 80);
          return (e.task ? e.task.name : 'Time entry') + ' — ' + (e.spent_date || '');
        }
        var allSame = entries.every(function(x) { return (x.notes || '').trim() === (entries[0].notes || '').trim(); });
        var firstNotes = (entries[0].notes || '').trim();
        if (allSame && firstNotes) return firstNotes.slice(0, 80);
        return null; // caller will prompt
      }

      function createCardFromEntries(ids) {
        var selectedEntries = viewState.unassigned.filter(function(e) {
          return ids.some(function(id) { return String(e.id) === String(id); });
        });
        var title = deriveCardTitle(selectedEntries);

        var go = function(finalTitle) {
          if (!finalTitle) return;
          ensureTrelloClient().then(function(ok) {
            if (!ok) return;
            return getFirstOpenListId().then(function(listId) {
              if (!listId) throw new Error('No open list found on this board.');
              return window.Trello.post('/cards', { idList: listId, name: finalTitle, pos: 'top' });
            }).then(function(card) {
              // After card creation, attach entries
              attachEntriesToCard(ids, {
                shortLink: card.shortLink,
                url: card.shortUrl || card.url || ('https://trello.com/c/' + card.shortLink)
              });
              // Invalidate badge cache for the new card
              try { t.set('board', 'shared', 'badgeRefresh_' + card.shortLink, Date.now()); } catch (e) {}
            }).catch(function(err) {
              alert('Could not create card: ' + (err && err.message ? err.message : err));
            });
          });
        };

        if (title) {
          go(title);
        } else {
          promptNewCardTitle(selectedEntries, go);
        }
      }

      function promptNewCardTitle(entries, callback) {
        var existing = document.querySelector('.inline-form.create-card');
        if (existing) existing.remove();
        var form = document.createElement('div');
        form.className = 'inline-form create-card';
        var suggested = (entries[0].notes || '').trim();
        if (!suggested) suggested = entries[0].task ? entries[0].task.name : '';
        form.innerHTML = '<label>New card title (' + entries.length + ' entries):</label>'
          + '<input type="text" value="' + escapeHtml(suggested) + '">'
          + '<div class="row"><button class="primary">Create</button><button class="secondary">Cancel</button></div>';
        var container = document.getElementById('summary');
        container.insertBefore(form, container.querySelector('.entry-list'));
        var input = form.querySelector('input');
        input.focus();
        input.select();
        form.querySelector('.secondary').addEventListener('click', function() { form.remove(); });
        form.querySelector('.primary').addEventListener('click', function() {
          var val = input.value.trim();
          if (!val) return;
          form.remove();
          callback(val);
        });
      }

      function getFirstOpenListId() {
        return t.board('id').then(function(board) {
          return window.Trello.get('/boards/' + board.id + '/lists', { filter: 'open', fields: 'id,name,pos' });
        }).then(function(lists) {
          if (!lists || lists.length === 0) return null;
          lists.sort(function(a, b) { return a.pos - b.pos; });
          return lists[0].id;
        });
      }

      function ensureTrelloClient() {
        if (window.Trello && window.Trello.post) {
          return maybeAuthorize();
        }
        return t.get('member', 'private', 'trelloApiKey', null).then(function(apiKey) {
          if (!apiKey) {
            apiKey = prompt('Enter your Trello API key (get it at https://trello.com/app-key):');
            if (!apiKey) return false;
            return t.set('member', 'private', 'trelloApiKey', apiKey).then(function() {
              return loadTrelloClient(apiKey);
            });
          }
          return loadTrelloClient(apiKey);
        });
      }

      function loadTrelloClient(apiKey) {
        return new Promise(function(resolve) {
          var s = document.createElement('script');
          s.src = 'https://trello.com/1/client.js?key=' + encodeURIComponent(apiKey);
          s.onload = function() {
            maybeAuthorize().then(resolve);
          };
          s.onerror = function() {
            alert('Failed to load Trello client library.');
            resolve(false);
          };
          document.head.appendChild(s);
        });
      }

      function maybeAuthorize() {
        return new Promise(function(resolve) {
          if (!window.Trello) { resolve(false); return; }
          if (window.Trello.authorized && window.Trello.authorized()) {
            resolve(true);
            return;
          }
          window.Trello.authorize({
            type: 'popup',
            name: 'Harvest Power-Up',
            scope: { read: true, write: true },
            expiration: 'never',
            persist: true,
            success: function() { resolve(true); },
            error: function() {
              alert('Trello authorization failed or was cancelled.');
              resolve(false);
            }
          });
        });
      }
    }).catch(function(err) {
      document.getElementById('content').innerHTML = '<div class="error">Error: ' + escapeHtml(err.message) + '</div>';
    });

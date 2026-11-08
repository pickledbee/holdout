/****************************************************************
 * HOLDOUT ADMIN PANEL
 * Open it from the spreadsheet: Holdout Admin > Open Admin Panel
 *
 * Every function here checks that the person calling it is you
 * (the owner of this script), so players can never use them.
 ****************************************************************/

const SETTING_FIELDS = [
  { key: 'Game Name', type: 'text', help: 'Shown at the top of the game page.' },
  { key: 'Tagline', type: 'text', help: 'Shown under the game name.' },
  { key: 'Run Length (days)', type: 'number', help: 'How many questions in a row a player must get right to make the Hall of Fame.' },
  { key: 'Pause Days Per Run', type: 'number', help: 'Days a player can miss in one run. Missing one more than this ends the run.' },
  { key: 'Bonus Questions Per Day', type: 'number', help: 'Most comebacks (bonus questions) a player can use in one day.' },
  { key: 'Show Amazon Picks', type: 'yesno', help: 'Show your Amazon product picks in the game.' },
  { key: 'Amazon Associate Tag', type: 'text', help: 'Your Amazon affiliate tag. Added to every Amazon link automatically.' },
  { key: 'Email Cheat Alerts', type: 'yesno', help: 'Email you each new cheat alert.' },
  { key: 'Cheat Alert Email', type: 'text', help: 'Where cheat alerts are emailed.' },
  { key: 'Game Website', type: 'text', help: 'The address players use, like https://pickledbee.github.io/holdout/ (invite links use it).' },
  { key: 'Time Zone', type: 'text', help: 'Everyone\'s next question unlocks at midnight in this time zone. Example: America/Chicago' }
];

/* ---------------- open the panel ---------------- */

function openAdminPanel() {
  const html = HtmlService.createHtmlOutputFromFile('admin').setWidth(1250).setHeight(820);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Holdout Admin Panel');
}

/* ---------------- read everything ---------------- */

function panelGetData() {
  requireOwner_();
  const s = settings_();
  const ss = ss_();
  const now = Date.now();
  const today = todayKey_(s);
  const fmt = d => d instanceof Date ? Utilities.formatDate(d, s.tz, 'MMM d, yyyy h:mm a') : String(d || '');

  // ---- players ----
  const rawPlayers = readPlayers_().rows;
  const nameById = {};
  rawPlayers.forEach(r => { nameById[r[P.ID]] = String(r[P.NAME]); });
  const players = rawPlayers.filter(r => r[P.NAME]).map(r => {
    const c = r.slice();
    checkMissed_(c, now, s);
    const days = Number(c[P.DAYS]) || 0;
    const status = String(c[P.STATUS]);
    const answeredToday = status === 'Alive' && normDate_(c[P.LASTDATE], s) === today;
    return {
      id: String(c[P.ID]),
      name: String(c[P.NAME]),
      status: status,
      day: status === 'Alive' ? Math.min(days + 1, s.length) : '',
      survived: days,
      best: Math.max(Number(c[P.BEST]) || 0, days),
      attempt: Number(c[P.ATTEMPT]) || 1,
      outOnDay: Number(c[P.OUTDAY]) || '',
      reason: String(c[P.REASON] || ''),
      bonus: Number(c[P.BONUS]) || 0,
      bonusUsedToday: bonusUsedToday_(c, s),
      friends: Number(c[P.FRIENDS]) || 0,
      invitedBy: c[P.REFBY] ? (nameById[c[P.REFBY]] || '(deleted player)') : '',
      joined: fmt(c[P.JOINED]),
      joinedMs: c[P.JOINED] instanceof Date ? c[P.JOINED].getTime() : 0,
      joinedToday: c[P.JOINED] instanceof Date && Utilities.formatDate(c[P.JOINED], s.tz, 'yyyy-MM-dd') === today,
      devices: String(c[P.DEVICES] || '').split(',').filter(Boolean).length,
      fast: Number(c[P.FAST]) || 0,
      pausesLeft: Math.max(0, s.pauseLimit - (Number(c[P.PAUSES]) || 0)),
      comebacks: Number(c[P.COMEBACKS]) || 0,
      lastQ: String(c[P.LASTQ] || ''),
      nextAt: status === 'Alive' ? (answeredToday ? 'Answered today. Next question unlocks at midnight.' : 'Has a question waiting (due by midnight).') : ''
    };
  });

  // ---- answers: today's numbers and the player funnel ----
  const ansSh = ss.getSheetByName(TAB.ANSWERS);
  let answersToday = 0, correctToday = 0, guestTries = 0, guestToday = 0;
  const daysByPlayer = {};
  if (ansSh && ansSh.getLastRow() > 1) {
    ansSh.getRange(2, 1, ansSh.getLastRow() - 1, ANSWER_HEADERS.length).getValues().forEach(r => {
      const d = r[0] instanceof Date ? Utilities.formatDate(r[0], s.tz, 'yyyy-MM-dd') : '';
      if (r[1] === 'GUEST') { guestTries++; if (d === today) guestToday++; return; }
      if (d === today) { answersToday++; if (r[7] === 'Yes') correctToday++; }
      if (r[1]) (daysByPlayer[r[1]] = daysByPlayer[r[1]] || {})[d] = true;
    });
  }
  const playDays = Object.keys(daysByPlayer).map(k => Object.keys(daysByPlayer[k]).length);

  // ---- questions ----
  const questions = allQuestionsForPanel_();
  const levelCounts = {};
  ['Easy', 'Medium', 'Hard', 'Very Hard'].forEach(t => {
    levelCounts[t] = questions.filter(q => q.active && q.difficulty === t).length;
  });

  // ---- Amazon picks ----
  const adSh = ss.getSheetByName(TAB.ADS);
  const ads = (adSh && adSh.getLastRow() > 1)
    ? adSh.getRange(2, 1, adSh.getLastRow() - 1, ADS_HEADERS.length).getValues()
      .map((r, i) => ({ row: i + 2, showOn: String(r[0]).trim(), headline: String(r[1]), product: String(r[2]),
        url: String(r[3]).trim(), finalUrl: safeAmazonUrl_(r[3], s.amazonTag),
        active: String(r[4]).trim().toLowerCase().indexOf('y') === 0 }))
      .filter(a => a.showOn || a.product)
    : [];

  // ---- cheat alerts ----
  const alSh = ss.getSheetByName(TAB.ALERTS);
  const alerts = (alSh && alSh.getLastRow() > 1)
    ? alSh.getRange(2, 1, alSh.getLastRow() - 1, ALERT_HEADERS.length).getValues()
      .map((r, i) => ({ row: i + 2, time: fmt(r[0]), type: String(r[1]), players: String(r[2]), details: String(r[3]),
        reviewed: String(r[4]).trim().toLowerCase().indexOf('y') === 0 }))
      .filter(a => a.type)
      .reverse()
    : [];

  // ---- settings ----
  const rawSettings = {};
  ss.getSheetByName(TAB.SETTINGS).getDataRange().getValues().slice(1)
    .forEach(r => { rawSettings[String(r[0]).trim()] = r[1] instanceof Date ? fmt(r[1]) : String(r[1]); });
  const settingsList = SETTING_FIELDS.map(f => ({ key: f.key, type: f.type, help: f.help, value: rawSettings[f.key] || '' }));

  return {
    gameName: s.gameName,
    length: s.length,
    gameUrl: gameUrl_(),
    apiUrl: apiUrl_(),
    sheetUrl: ss.getUrl(),
    stats: {
      total: players.length,
      alive: players.filter(p => p.status === 'Alive').length,
      out: players.filter(p => p.status === 'Out').length,
      champions: players.filter(p => p.status === 'Champion').length,
      joinedToday: players.filter(p => p.joinedToday).length,
      answersToday: answersToday,
      correctToday: correctToday,
      guestToday: guestToday,
      newAlerts: alerts.filter(a => !a.reviewed).length,
      bonusesWaiting: players.reduce((t, p) => t + p.bonus, 0),
      friendsInvited: players.reduce((t, p) => t + p.friends, 0),
      hallOfFame: Math.max(0, (ss.getSheetByName(TAB.HALL).getLastRow() || 1) - 1)
    },
    funnel: {
      guestTries: guestTries,
      signups: players.length,
      answered1: playDays.filter(n => n >= 1).length,
      days2: playDays.filter(n => n >= 2).length,
      days7: playDays.filter(n => n >= 7).length,
      restarts: players.reduce((t, p) => t + Math.max(0, p.attempt - 1), 0),
      comebacks: players.reduce((t, p) => t + p.comebacks, 0),
      shares: Number(PropertiesService.getScriptProperties().getProperty('SHARES_TOTAL')) || 0
    },
    levelCounts: levelCounts,
    players: players,
    questions: questions,
    problems: findProblems_(questions, ads, s),
    ads: ads,
    alerts: alerts.slice(0, 300),
    settings: settingsList
  };
}

function allQuestionsForPanel_() {
  const qSh = ss_().getSheetByName(TAB.QUESTIONS);
  if (!qSh || qSh.getLastRow() < 2) return [];
  return qSh.getRange(2, 1, qSh.getLastRow() - 1, QUESTION_HEADERS.length).getValues()
    .map((r, i) => ({ row: i + 2, id: String(r[0]).trim(), difficulty: normDifficulty_(r[1]), question: String(r[2]),
      A: String(r[3]), B: String(r[4]), C: String(r[5]), D: String(r[6]),
      correct: String(r[7]).trim().toUpperCase(), funFact: String(r[8]),
      active: String(r[9] === '' ? 'Yes' : r[9]).trim().toLowerCase().indexOf('y') === 0 }))
    .filter(q => q.id || q.question);
}

function findProblems_(questions, ads, s) {
  const problems = [];
  const ids = {};
  questions.forEach(q => { (ids[q.id] = ids[q.id] || []).push(q); });
  Object.keys(ids).forEach(id => {
    if (!id) problems.push('A question on row ' + ids[id][0].row + ' has no ID, so it will never be used.');
    else if (ids[id].length > 1) problems.push('ID ' + id + ' is used ' + ids[id].length + ' times. Every question needs its own ID.');
  });
  ['Easy', 'Medium', 'Hard', 'Very Hard'].forEach(t => {
    const n = questions.filter(q => q.active && q.difficulty === t).length;
    if (n === 0) problems.push('No active ' + t + ' questions. Players who reach that level will get questions from other levels.');
    else if (n < 20) problems.push('Only ' + n + ' active ' + t + ' questions. Aim for at least 20 so repeat players see new ones.');
  });
  questions.forEach(q => {
    if (!q.active) return;
    const label = q.id || 'Row ' + q.row;
    if (!q.question.trim()) problems.push(label + ' has no question text.');
    if (['A', 'B', 'C', 'D'].indexOf(q.correct) < 0) problems.push(label + ': Correct must be A, B, C, or D, so this question is skipped.');
    ['A', 'B', 'C', 'D'].forEach(L => { if (!q[L].trim()) problems.push(label + ': answer ' + L + ' is blank.'); });
  });
  ads.forEach(a => {
    if (a.active && !a.finalUrl) problems.push('Amazon pick "' + (a.product || a.headline) + '" has a link that is not a working Amazon link, so it will not show.');
    if (a.active && /^Q\d+$/i.test(a.showOn) && !ids[a.showOn.toUpperCase()]) problems.push('Amazon pick "' + a.product + '" is set to show on ' + a.showOn + ', but there is no question with that ID.');
  });
  return problems;
}

/* ---------------- players ---------------- */

function panelPlayerAction(id, action, value) {
  requireOwner_();
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => r[P.ID] === id);
    if (i < 0) throw new Error('That player was not found. Click Refresh.');
    const row = data.rows[i];
    checkMissed_(row, Date.now(), s);
    const name = String(row[P.NAME]);

    switch (action) {
      case 'bonusAdd':
        row[P.BONUS] = (Number(row[P.BONUS]) || 0) + 1;
        break;
      case 'bonusRemove':
        row[P.BONUS] = Math.max(0, (Number(row[P.BONUS]) || 0) - 1);
        break;
      case 'pauseAdd':
        row[P.PAUSES] = (Number(row[P.PAUSES]) || 0) - 1;
        break;
      case 'revive':
        if (row[P.STATUS] !== 'Out') throw new Error(name + ' is not out.');
        comeBack_(row, s);
        break;
      case 'knockout':
        if (row[P.STATUS] !== 'Alive') throw new Error(name + ' is not in a run.');
        row[P.STATUS] = 'Out';
        row[P.OUTDAY] = Math.min((Number(row[P.DAYS]) || 0) + 1, s.length);
        row[P.REASON] = 'Removed by admin';
        row[P.CURQ] = '';
        break;
      case 'newRun':
        startRun_(row, s, true);
        break;
      case 'resetPin': {
        const pin = String(value || '').trim();
        if (!/^\d{4,6}$/.test(pin)) throw new Error('The new PIN must be 4 to 6 numbers.');
        row[P.HASH] = hash_(row[P.ID], pin);
        CacheService.getScriptCache().remove('fail_' + name.toLowerCase());
        break;
      }
      case 'logout':
        row[P.TOKEN] = '';
        break;
      case 'rename': {
        const newName = String(value || '').trim().replace(/\s+/g, ' ');
        if (!/^[A-Za-z0-9 _.\-]{2,20}$/.test(newName)) throw new Error('Names must be 2 to 20 letters, numbers, spaces, dashes, dots, or underscores.');
        if (data.rows.some((r, j) => j !== i && String(r[P.NAME]).toLowerCase() === newName.toLowerCase())) throw new Error('That name is taken.');
        row[P.NAME] = newName;
        break;
      }
      case 'delete':
        data.sh.deleteRow(i + 2);
        return name + ' was deleted.';
      default:
        throw new Error('Unknown action.');
    }
    writePlayer_(data.sh, i, row);
    return 'Done: ' + name + ' updated.';
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- questions ---------------- */

function panelSaveQuestion(q) {
  requireOwner_();
  const correct = String(q.correct || '').trim().toUpperCase();
  if (!String(q.question || '').trim()) throw new Error('Question text is required.');
  if (['A', 'B', 'C', 'D'].indexOf(correct) < 0) throw new Error('Correct must be A, B, C, or D.');
  ['A', 'B', 'C', 'D'].forEach(L => { if (!String(q[L] || '').trim()) throw new Error('Answer ' + L + ' is blank.'); });
  const sh = ss_().getSheetByName(TAB.QUESTIONS);
  const existing = allQuestionsForPanel_();
  let id = String(q.id || '').trim().toUpperCase();
  if (!id) {
    const max = existing.reduce((m, x) => Math.max(m, Number((x.id.match(/^Q(\d+)$/) || [0, 0])[1])), 0);
    id = 'Q' + ('00' + (max + 1)).slice(-3);
  }
  if (!/^Q\d+$/.test(id)) throw new Error('IDs look like Q157.');
  if (existing.some(x => x.id === id && x.row !== Number(q.row))) throw new Error('ID ' + id + ' is already used by another question.');
  const values = [[id, normDifficulty_(q.difficulty), String(q.question).trim(), String(q.A).trim(), String(q.B).trim(),
    String(q.C).trim(), String(q.D).trim(), correct, String(q.funFact || '').trim(), q.active === false ? 'No' : 'Yes']];
  const row = Number(q.row) || sh.getLastRow() + 1;
  sh.getRange(row, 1).setNumberFormat('@');
  sh.getRange(row, 1, 1, QUESTION_HEADERS.length).setValues(values);
  return (q.row ? 'Question ' : 'Question added as ') + id + (q.row ? ' saved.' : '.');
}

function panelToggleQuestion(row, active) {
  requireOwner_();
  ss_().getSheetByName(TAB.QUESTIONS).getRange(Number(row), 10).setValue(active ? 'Yes' : 'No');
  return active ? 'Question turned on.' : 'Question turned off. Players will not get it anymore.';
}

function panelDeleteQuestion(row) {
  requireOwner_();
  row = Number(row);
  if (row < 2) throw new Error('Cannot delete that row.');
  ss_().getSheetByName(TAB.QUESTIONS).deleteRow(row);
  return 'Question deleted.';
}

function panelReviveQuestion(id) {
  requireOwner_();
  return reviveByQuestion_(id);
}

/* ---------------- Amazon picks ---------------- */

function panelSaveAd(a) {
  requireOwner_();
  const s = settings_();
  const showOn = String(a.showOn || '').trim();
  if (!showOn) throw new Error('Show On is required: a question ID (like Q012), Knockout, Waiting, or Champion.');
  if (!String(a.product || '').trim()) throw new Error('Product name is required.');
  let url = String(a.url || '').trim();
  const words = String(a.searchWords || '').trim();
  if (!url && words) url = amazonSearchUrl_(words, s.amazonTag);
  if (!url) throw new Error('Paste an Amazon link, or type search words so the link can be made for you.');
  if (!safeAmazonUrl_(url, s.amazonTag)) throw new Error('That is not a working Amazon link. It must start with https://www.amazon.com, https://amzn.to, or https://a.co');
  const sh = ss_().getSheetByName(TAB.ADS);
  const row = Number(a.row) || sh.getLastRow() + 1;
  sh.getRange(row, 1).setNumberFormat('@');
  sh.getRange(row, 1, 1, ADS_HEADERS.length).setValues([[showOn, String(a.headline || '').trim(),
    String(a.product).trim(), url, a.active === false ? 'No' : 'Yes']]);
  return a.row ? 'Amazon pick saved.' : 'Amazon pick added.';
}

function panelToggleAd(row, active) {
  requireOwner_();
  ss_().getSheetByName(TAB.ADS).getRange(Number(row), 5).setValue(active ? 'Yes' : 'No');
  return active ? 'Pick turned on.' : 'Pick turned off.';
}

function panelDeleteAd(row) {
  requireOwner_();
  row = Number(row);
  if (row < 2) throw new Error('Cannot delete that row.');
  ss_().getSheetByName(TAB.ADS).deleteRow(row);
  return 'Amazon pick deleted.';
}

/* ---------------- cheat alerts ---------------- */

function panelMarkAlert(row, reviewed) {
  requireOwner_();
  ss_().getSheetByName(TAB.ALERTS).getRange(Number(row), 5).setValue(reviewed ? 'Yes' : '');
  return reviewed ? 'Marked as reviewed.' : 'Marked as new.';
}

function panelMarkAllAlerts() {
  requireOwner_();
  const sh = ss_().getSheetByName(TAB.ALERTS);
  if (sh.getLastRow() > 1) {
    const n = sh.getLastRow() - 1;
    sh.getRange(2, 5, n, 1).setValues(new Array(n).fill(['Yes']));
  }
  return 'All alerts marked as reviewed.';
}

/* ---------------- settings ---------------- */

function panelSaveSettings(values) {
  requireOwner_();
  const sh = ss_().getSheetByName(TAB.SETTINGS);
  const all = sh.getDataRange().getValues();
  SETTING_FIELDS.forEach(f => {
    if (!(f.key in values)) return;
    let v = String(values[f.key]).trim();
    if (f.type === 'number') {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 0) throw new Error(f.key + ' must be a number.');
      if (f.key === 'Run Length (days)' && n < 1) throw new Error('Run Length must be at least 1.');
      v = String(n);
    }
    if (f.type === 'yesno') v = /^y/i.test(v) ? 'Yes' : 'No';
    if (f.key === 'Time Zone') {
      try { Utilities.formatDate(new Date(), v, 'yyyy'); } catch (e) { throw new Error('Time Zone is not valid. Example: America/Chicago'); }
    }
    let found = false;
    for (let r = 1; r < all.length; r++) {
      if (String(all[r][0]).trim() === f.key) {
        sh.getRange(r + 1, 2).setNumberFormat('@').setValue(v);
        found = true;
        break;
      }
    }
    if (!found) addSettingIfMissing_(sh, f.key, v, f.help);
  });
  return 'Settings saved.';
}

/* ---------------- tools ---------------- */

function panelGiveEveryoneBonus() {
  requireOwner_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = readPlayers_();
    let count = 0;
    data.rows.forEach(r => { if (r[P.NAME]) { r[P.BONUS] = (Number(r[P.BONUS]) || 0) + 1; count++; } });
    if (count) data.sh.getRange(2, 1, data.rows.length, PLAYER_HEADERS.length).setValues(data.rows);
    return count + ' player(s) got 1 bonus question.';
  } finally {
    lock.releaseLock();
  }
}

function panelRunChecks() {
  requireOwner_();
  const before = alertCount_();
  sweepMissed();
  const added = alertCount_() - before;
  return 'Missed-day check and cheat check finished. ' + (added > 0 ? added + ' new cheat alert(s).' : 'No new cheat alerts.');
}

/* ---------------- safety ---------------- */

// Only the owner of this script can use the admin functions.
function requireOwner_() {
  const me = Session.getEffectiveUser().getEmail();
  const caller = Session.getActiveUser().getEmail();
  if (!caller || !me || caller.toLowerCase() !== me.toLowerCase()) {
    throw new Error('Only the game owner can do that.');
  }
}

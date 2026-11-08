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
  { key: 'Run Length (days)', type: 'number', help: 'Days a player must survive to make the Hall of Fame. You need a question for every day.' },
  { key: 'Bonus Questions Per Day', type: 'number', help: 'Most bonus questions a player can use in one day.' },
  { key: 'Show Amazon Picks', type: 'yesno', help: 'Show your Amazon product picks in the game.' },
  { key: 'Amazon Associate Tag', type: 'text', help: 'Your Amazon affiliate tag. Added to every Amazon link automatically.' },
  { key: 'Email Cheat Alerts', type: 'yesno', help: 'Email you each new cheat alert.' },
  { key: 'Cheat Alert Email', type: 'text', help: 'Where cheat alerts are emailed.' },
  { key: 'Game Website', type: 'text', help: 'The address players use, like https://pickledbee.github.io/holdout/ (invite links use it).' },
  { key: 'Time Zone', type: 'text', help: 'Used for dates and for when the daily bonus limit resets. Example: America/Chicago' }
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
    const pd = personalDay_(c, now);
    const status = String(c[P.STATUS]);
    let nextAt = '';
    if (status === 'Alive') {
      nextAt = days >= pd ? 'Next question unlocks ' + fmt(new Date(startMs_(c) + pd * DAY_MS))
        : 'Must answer by ' + fmt(new Date(startMs_(c) + pd * DAY_MS));
    }
    return {
      id: String(c[P.ID]),
      name: String(c[P.NAME]),
      status: status,
      day: status === 'Alive' ? Math.min(pd, s.length) : '',
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
      nextAt: nextAt
    };
  });

  // ---- answers today ----
  const ansSh = ss.getSheetByName(TAB.ANSWERS);
  let answersToday = 0, correctToday = 0;
  if (ansSh && ansSh.getLastRow() > 1) {
    ansSh.getRange(2, 1, ansSh.getLastRow() - 1, ANSWER_HEADERS.length).getValues().forEach(r => {
      if (r[0] instanceof Date && Utilities.formatDate(r[0], s.tz, 'yyyy-MM-dd') === today) {
        answersToday++;
        if (r[7] === 'Yes') correctToday++;
      }
    });
  }

  // ---- questions ----
  const qSh = ss.getSheetByName(TAB.QUESTIONS);
  const questions = (qSh && qSh.getLastRow() > 1)
    ? qSh.getRange(2, 1, qSh.getLastRow() - 1, QUESTION_HEADERS.length).getValues()
      .map((r, i) => ({ row: i + 2, day: String(r[0]).trim(), difficulty: String(r[1]), question: String(r[2]),
        A: String(r[3]), B: String(r[4]), C: String(r[5]), D: String(r[6]),
        correct: String(r[7]).trim().toUpperCase(), funFact: String(r[8]) }))
      .filter(q => q.day || q.question)
    : [];

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
      newAlerts: alerts.filter(a => !a.reviewed).length,
      bonusesWaiting: players.reduce((t, p) => t + p.bonus, 0),
      friendsInvited: players.reduce((t, p) => t + p.friends, 0),
      hallOfFame: Math.max(0, (ss.getSheetByName(TAB.HALL).getLastRow() || 1) - 1)
    },
    players: players,
    questions: questions,
    problems: findProblems_(questions, ads, s),
    ads: ads,
    alerts: alerts.slice(0, 300),
    settings: settingsList
  };
}

function findProblems_(questions, ads, s) {
  const problems = [];
  const byDay = {};
  questions.forEach(q => { (byDay[q.day] = byDay[q.day] || []).push(q); });
  for (let d = 1; d <= s.length; d++) {
    if (!byDay[String(d)]) problems.push('Day ' + d + ' has no question. Players who reach Day ' + d + ' will be stuck.');
  }
  Object.keys(byDay).forEach(d => {
    if (d && byDay[d].length > 1) problems.push('Day ' + d + ' has ' + byDay[d].length + ' questions. Only the first one (row ' + byDay[d][0].row + ') is used.');
  });
  questions.forEach(q => {
    const label = q.day ? 'Day ' + q.day : 'Row ' + q.row;
    if (!q.question.trim()) problems.push(label + ' has no question text.');
    if (['A', 'B', 'C', 'D'].indexOf(q.correct) < 0) problems.push(label + ': Correct must be A, B, C, or D.');
    ['A', 'B', 'C', 'D'].forEach(L => { if (!q[L].trim()) problems.push(label + ': answer ' + L + ' is blank.'); });
  });
  const backups = questions.filter(q => /^backup/i.test(q.day)).length;
  if (backups < 3) problems.push('Only ' + backups + ' Backup questions. Keep at least 3 for Second Chance questions.');
  ads.forEach(a => {
    if (a.active && !a.finalUrl) problems.push('Amazon pick "' + (a.product || a.headline) + '" has a link that is not a working Amazon link, so it will not show.');
  });
  return problems;
}

/* ---------------- players ---------------- */

function panelPlayerAction(id, action, value) {
  requireOwner_();
  const s = settings_();
  const now = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => r[P.ID] === id);
    if (i < 0) throw new Error('That player was not found. Click Refresh.');
    const row = data.rows[i];
    checkMissed_(row, now, s);
    const name = String(row[P.NAME]);

    switch (action) {
      case 'bonusAdd':
        row[P.BONUS] = (Number(row[P.BONUS]) || 0) + 1;
        break;
      case 'bonusRemove':
        row[P.BONUS] = Math.max(0, (Number(row[P.BONUS]) || 0) - 1);
        break;
      case 'revive': {
        if (row[P.STATUS] !== 'Out') throw new Error(name + ' is not out.');
        const days = Number(row[P.DAYS]) || 0;
        const outDay = Number(row[P.OUTDAY]) || (days + 1);
        const wasWrong = row[P.REASON] === 'Wrong answer';
        row[P.STATUS] = 'Alive';
        row[P.DAYS] = outDay - 1;
        row[P.START] = new Date(now - (outDay - 1) * DAY_MS);
        row[P.OUTDAY] = '';
        row[P.REASON] = '';
        row[P.OVERRIDE] = wasWrong ? pickSecondChance_(String(row[P.LASTQ] || '')) : '';
        break;
      }
      case 'skipWait': {
        if (row[P.STATUS] !== 'Alive') throw new Error(name + ' is not in a run.');
        const pd = personalDay_(row, now);
        if ((Number(row[P.DAYS]) || 0) < pd) throw new Error(name + ' already has a question waiting.');
        row[P.START] = new Date(startMs_(row) - DAY_MS);
        break;
      }
      case 'knockout':
        if (row[P.STATUS] !== 'Alive') throw new Error(name + ' is not in a run.');
        row[P.STATUS] = 'Out';
        row[P.OUTDAY] = Math.min(personalDay_(row, now), s.length);
        row[P.REASON] = 'Removed by admin';
        row[P.OVERRIDE] = '';
        break;
      case 'newRun':
        row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, Number(row[P.DAYS]) || 0);
        row[P.STATUS] = 'Alive';
        row[P.START] = new Date(now);
        row[P.ATTEMPT] = (Number(row[P.ATTEMPT]) || 1) + 1;
        row[P.DAYS] = 0;
        row[P.OUTDAY] = '';
        row[P.REASON] = '';
        row[P.OVERRIDE] = '';
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
  if (!String(q.day || '').trim()) throw new Error('Day is required (a number like 5, or Backup 7, or Retired).');
  if (!String(q.question || '').trim()) throw new Error('Question text is required.');
  if (['A', 'B', 'C', 'D'].indexOf(correct) < 0) throw new Error('Correct must be A, B, C, or D.');
  ['A', 'B', 'C', 'D'].forEach(L => { if (!String(q[L] || '').trim()) throw new Error('Answer ' + L + ' is blank.'); });
  const values = [[String(q.day).trim(), String(q.difficulty || '').trim(), String(q.question).trim(),
    String(q.A).trim(), String(q.B).trim(), String(q.C).trim(), String(q.D).trim(), correct, String(q.funFact || '').trim()]];
  const sh = ss_().getSheetByName(TAB.QUESTIONS);
  const row = Number(q.row) || sh.getLastRow() + 1;
  sh.getRange(row, 1).setNumberFormat('@');
  sh.getRange(row, 1, 1, QUESTION_HEADERS.length).setValues(values);
  return q.row ? 'Question saved.' : 'Question added.';
}

function panelDeleteQuestion(row) {
  requireOwner_();
  row = Number(row);
  if (row < 2) throw new Error('Cannot delete that row.');
  ss_().getSheetByName(TAB.QUESTIONS).deleteRow(row);
  return 'Question deleted.';
}

/* ---------------- Amazon picks ---------------- */

function panelSaveAd(a) {
  requireOwner_();
  const s = settings_();
  const showOn = String(a.showOn || '').trim();
  if (!showOn) throw new Error('Show On is required: a Day number, Knockout, Waiting, or Champion.');
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

function panelReviveDay(day) {
  requireOwner_();
  const n = parseInt(day, 10);
  if (!n || n < 1) throw new Error('Type a day number, like 5.');
  const now = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let count = 0;
  try {
    const data = readPlayers_();
    data.rows.forEach(r => {
      if (r[P.STATUS] === 'Out' && Number(r[P.OUTDAY]) === n && r[P.REASON] === 'Wrong answer') {
        r[P.STATUS] = 'Alive';
        r[P.DAYS] = n;
        r[P.BEST] = Math.max(Number(r[P.BEST]) || 0, n);
        r[P.START] = new Date(now - n * DAY_MS);
        r[P.OUTDAY] = '';
        r[P.REASON] = '';
        r[P.OVERRIDE] = '';
        count++;
      }
    });
    if (count) data.sh.getRange(2, 1, data.rows.length, PLAYER_HEADERS.length).setValues(data.rows);
  } finally {
    lock.releaseLock();
  }
  return count + ' player(s) brought back from Day ' + n + '.';
}

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

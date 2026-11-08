/****************************************************************
 * HOLDOUT
 * Your game starts the moment you join. One question every 24 hours.
 * One wrong answer (or a skipped day) and you're out.
 *
 * BONUS QUESTIONS: every player has a personal invite link. Each friend
 * who joins through it earns that player one bonus question.
 *   - Still alive: a bonus lets you answer your next question right now.
 *   - Knocked out: a bonus puts you back in where you left off with a
 *     new question for that day.
 *   - Limit: 2 bonus questions per day (change it in Settings).
 *
 * AMAZON PICKS: the Ads tab holds Amazon affiliate product picks. Each pick
 * shows on a day's answer reveal, the knockout screen, the waiting screen,
 * or the champion screen, always with the Amazon Associates disclosure.
 * Players never get anything in the game for clicking or buying.
 *
 * CHEAT ALERTS: suspicious activity is logged on the Cheat Alerts tab and
 * emailed to you (see Settings). The game itself is not changed.
 *
 * Files in this Apps Script project:
 *   Code.gs     (this file)  - sheet setup, game rules, admin menu, and the
 *                              API the game website talks to
 *   Admin.gs                 - the Admin Panel's behind-the-scenes code
 *   admin.html               - the Admin Panel you open from the spreadsheet
 *
 * The game page players see lives on GitHub Pages
 * (github.com/pickledbee/holdout). It sends every request to doPost below.
 * The answers never leave this script, so players can't peek at them.
 *
 * After pasting a new version of this file: choose "setup" in the
 * function menu and click Run.
 ****************************************************************/

const SHEET_ID = '1t9UAH3MJf7GWhUytTM2HwT5JIYYrLlTlyRj0Ej6R-Mg';
const DAY_MS = 24 * 60 * 60 * 1000;

const TAB = {
  SETTINGS: 'Settings',
  QUESTIONS: 'Questions',
  PLAYERS: 'Players',
  ANSWERS: 'Answers',
  HALL: 'Hall of Fame',
  ALERTS: 'Cheat Alerts',
  ADS: 'Ads',
  HOWTO: 'How It Works'
};

const PLAYER_HEADERS = ['Player ID', 'Display Name', 'PIN Hash', 'Login Token', 'Joined', 'Confirmed 13+',
  'Status', 'Run Started', 'Attempt', 'Days Survived', 'Out On Day', 'Out Reason', 'Best Run',
  'Bonus Questions', 'Bonus Date', 'Bonus Used That Date', 'Invited By', 'Friends Invited',
  'Second Chance Question', 'Last Question', 'Devices', 'Fast Answers', 'Question Shown At', 'Shown Question'];
const P = { ID: 0, NAME: 1, HASH: 2, TOKEN: 3, JOINED: 4, AGE: 5, STATUS: 6, START: 7, ATTEMPT: 8,
  DAYS: 9, OUTDAY: 10, REASON: 11, BEST: 12, BONUS: 13, BONUSDATE: 14, BONUSUSED: 15,
  REFBY: 16, FRIENDS: 17, OVERRIDE: 18, LASTQ: 19, DEVICES: 20, FAST: 21, SHOWNAT: 22, SHOWNQ: 23 };

const QUESTION_HEADERS = ['Day', 'Difficulty', 'Question', 'A', 'B', 'C', 'D', 'Correct', 'Fun Fact'];
const ANSWER_HEADERS = ['Timestamp', 'Player ID', 'Display Name', 'Attempt', 'Day', 'Question Used', 'Choice', 'Correct?', 'Seconds To Answer'];
const HALL_HEADERS = ['Finished On', 'Display Name', 'Attempt', 'Days Survived'];
const ADS_HEADERS = ['Show On', 'Headline', 'Product', 'Amazon Link', 'Active?'];
const AMAZON_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

// Starter picks: [Show On, Headline, Product, what to search for on Amazon]
// Show On = a question's Day (like 12 or Backup 1), or Knockout, Waiting, or Champion.
const STARTER_ADS = [
  ['1', 'Want a closer look at Mars?', 'Beginner telescopes', 'beginner telescope'],
  ['2', 'Curious about creepy crawlers?', 'Insect and spider field guides', 'insect spider field guide book'],
  ['3', 'Explore every ocean from home', 'Scratch-off world map posters', 'scratch off world map poster'],
  ['4', 'Try those 88 keys yourself', 'Beginner keyboards', 'beginner keyboard piano 88 keys'],
  ['5', 'Watch photosynthesis on your counter', 'Indoor herb garden kits', 'indoor herb garden kit'],
  ['6', 'Go deeper into ancient Egypt', 'Ancient Egypt history books', 'ancient egypt history book'],
  ['7', 'Taste the honeybees\' hard work', 'Raw honey samplers', 'raw honey sampler gift set'],
  ['8', 'Dreaming of the biggest state?', 'Alaska travel guides', 'alaska travel guide book'],
  ['9', 'Find your own gold', 'Gold panning kits', 'gold panning kit'],
  ['10', 'More masterpieces to explore', 'Art history books', 'art history book'],
  ['11', 'Never mix up a capital again', 'World atlases', 'world atlas book'],
  ['12', 'Practicing an instrument at home?', 'No More Practice Wars (book)', 'No More Practice Wars Bruce Bowers'],
  ['13', 'Start a rock and mineral collection', 'Rock and mineral collection kits', 'rock and mineral collection kit'],
  ['14', 'See how the human body works', 'Human body encyclopedias', 'human body encyclopedia book'],
  ['15', 'The story behind the Wall', 'Cold War history books', 'cold war history book'],
  ['16', 'Love a good number puzzle?', 'Math puzzle books', 'math puzzle book adults'],
  ['17', 'All 118 elements on your wall', 'Periodic table posters', 'periodic table poster'],
  ['18', 'Get out on the water', 'Inflatable kayaks', 'inflatable kayak'],
  ['19', 'Every bone, labeled', 'Human skeleton models', 'human skeleton model'],
  ['20', 'Hear The Four Seasons', 'Vivaldi The Four Seasons recordings', 'Vivaldi Four Seasons CD'],
  ['21', 'The universe, explained', 'Cosmos by Carl Sagan', 'Cosmos Carl Sagan book'],
  ['22', 'A little piece of Maine', 'Lighthouse jigsaw puzzles', 'lighthouse jigsaw puzzle 1000 piece'],
  ['23', 'Learn all 50 states for good', 'United States map puzzles', 'united states map puzzle'],
  ['24', 'See Jupiter\'s moons yourself', 'Telescopes for planet viewing', 'telescope for viewing planets'],
  ['25', 'All 206 bones in color', 'Anatomy coloring books', 'anatomy coloring book'],
  ['26', 'Plan a trip to the land of unicorns', 'Scotland travel guides', 'scotland travel guide book'],
  ['27', 'Every coastline on one wall', 'World map posters', 'world map poster'],
  ['28', 'Fall in love with octopuses', 'The Soul of an Octopus by Sy Montgomery', 'The Soul of an Octopus Sy Montgomery'],
  ['29', 'Visit the smallest country', 'Rome travel guides', 'rome travel guide book'],
  ['30', 'The greatest Antarctic survival story', 'Endurance by Alfred Lansing', 'Endurance Shackleton Alfred Lansing'],
  ['Knockout', 'Study up for your comeback', 'Guinness World Records book', 'Guinness World Records book'],
  ['Knockout', 'Study up for your comeback', 'The World Almanac', 'World Almanac and Book of Facts'],
  ['Knockout', 'Study up for your comeback', 'Trivia question books', 'trivia questions book adults'],
  ['Waiting', 'While you wait for your next question', 'Logic puzzle books', 'logic puzzle book adults'],
  ['Waiting', 'While you wait for your next question', 'Trivial Pursuit', 'Trivial Pursuit board game'],
  ['Waiting', 'While you wait for your next question', 'Wits and Wagers', 'Wits and Wagers board game'],
  ['Champion', 'Gifts for the know-it-all in your life', 'Trivia board games', 'trivia board game'],
  ['Champion', 'Gifts for the know-it-all in your life', 'Brain teaser puzzle sets', 'brain teaser puzzle set adults']
];

const ALERT_HEADERS = ['Time', 'Alert', 'Player(s)', 'Details', 'Reviewed?', 'Key'];

// Cheat alert thresholds
const CHEAT = {
  FAST_SECONDS: 3,        // a correct answer on a Hard or Very Hard question faster than this is "lightning fast"
  FAST_COUNT: 3,          // alert after this many lightning-fast correct answers
  BURST_FRIENDS: 4,       // alert if one player's link brings in this many sign-ups within 24 hours
  DUD_FRIENDS: 3,         // alert if this many of a player's invited friends never answered a single question
  PIN_FAILS: 5            // alert after this many wrong PIN tries on one account
};

const STARTER_QUESTIONS = [
  ['1', 'Easy', "Which planet is known as the Red Planet?", 'Venus', 'Mars', 'Jupiter', 'Mercury', 'B', "Mars gets its red color from iron oxide, which is basically rust, in its soil."],
  ['2', 'Easy', "How many legs does a spider have?", '6', '10', '8', '12', 'C', "Spiders are arachnids, not insects. Insects have 6 legs."],
  ['3', 'Easy', "What is the largest ocean on Earth?", 'Atlantic', 'Indian', 'Arctic', 'Pacific', 'D', "The Pacific covers roughly a third of Earth's surface."],
  ['4', 'Easy', "Which instrument has 88 keys on a standard modern model?", 'Piano', 'Violin', 'Trumpet', 'Harp', 'A', "Those 88 keys are made up of 52 white keys and 36 black keys."],
  ['5', 'Easy', "Which gas do plants take in from the air to make their food?", 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium', 'C', "Plants release oxygen as a byproduct of photosynthesis."],
  ['6', 'Easy', "In which country are the Pyramids of Giza?", 'Mexico', 'Egypt', 'Peru', 'Greece', 'B', "The Great Pyramid was the tallest human-made structure on Earth for thousands of years."],
  ['7', 'Easy', "How many sides does a hexagon have?", '5', '7', '6', '8', 'C', "Honeybees build their honeycomb cells in hexagon shapes."],
  ['8', 'Medium', "Which U.S. state is the largest by area?", 'Texas', 'California', 'Montana', 'Alaska', 'D', "Alaska is more than twice the size of Texas."],
  ['9', 'Medium', "What is the chemical symbol for gold?", 'Au', 'Ag', 'Gd', 'Go', 'A', "Au comes from the Latin word for gold, aurum."],
  ['10', 'Medium', "Who painted the Mona Lisa?", 'Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Rembrandt', 'C', "The Mona Lisa hangs in the Louvre museum in Paris."],
  ['11', 'Medium', "What is the capital of Australia?", 'Sydney', 'Canberra', 'Melbourne', 'Perth', 'B', "Canberra was built as a compromise because Sydney and Melbourne both wanted to be the capital."],
  ['12', 'Medium', "How many strings does a standard violin have?", '4', '5', '6', '8', 'A', "A violin's strings are tuned G, D, A, and E."],
  ['13', 'Medium', "What is the hardest naturally occurring mineral?", 'Quartz', 'Titanium', 'Granite', 'Diamond', 'D', "Diamonds are made of pure carbon."],
  ['14', 'Medium', "Which organ in the human body produces insulin?", 'Liver', 'Pancreas', 'Kidney', 'Spleen', 'B', "The pancreas sits tucked behind the stomach."],
  ['15', 'Hard', "In what year did the Berlin Wall fall?", '1987', '1991', '1989', '1993', 'C', "The wall came down on November 9, 1989."],
  ['16', 'Hard', "What is the smallest prime number?", '0', '1', '2', '3', 'C', "2 is also the only even prime number."],
  ['17', 'Hard', "Which element has atomic number 1?", 'Helium', 'Hydrogen', 'Lithium', 'Oxygen', 'B', "Hydrogen is the most abundant element in the universe."],
  ['18', 'Hard', "Which country has the most natural lakes?", 'Russia', 'United States', 'Finland', 'Canada', 'D', "Canada is often said to have more lakes than the rest of the world combined."],
  ['19', 'Hard', "What is the longest bone in the human body?", 'Femur', 'Tibia', 'Humerus', 'Pelvis', 'A', "The femur, or thigh bone, is roughly a quarter of a person's height."],
  ['20', 'Hard', "Which composer wrote The Four Seasons?", 'Bach', 'Handel', 'Vivaldi', 'Mozart', 'C', "Vivaldi was also a priest, nicknamed the Red Priest because of his red hair."],
  ['21', 'Hard', "Roughly how fast does light travel?", '18,600 miles per second', '186,000 miles per second', '1,860,000 miles per second', '18,600,000 miles per second', 'B', "Light from the Sun takes about 8 minutes to reach Earth."],
  ['22', 'Very Hard', "Which is the only U.S. state whose name has just one syllable?", 'Utah', 'Iowa', 'Ohio', 'Maine', 'D', "Maine is also the only state that borders exactly one other state, New Hampshire."],
  ['23', 'Very Hard', "Which letter does not appear in the name of any U.S. state?", 'Q', 'Z', 'X', 'J', 'A', "J is in New Jersey, X is in Texas, and Z is in Arizona."],
  ['24', 'Very Hard', "Which planet has the shortest day?", 'Earth', 'Saturn', 'Jupiter', 'Mercury', 'C', "Jupiter spins all the way around in about 10 hours."],
  ['25', 'Very Hard', "How many bones are in the typical adult human body?", '196', '206', '216', '226', 'B', "Babies are born with around 270 bones, and many fuse together as they grow."],
  ['26', 'Very Hard', "What is the national animal of Scotland?", 'Lion', 'Stag', 'Eagle', 'Unicorn', 'D', "The unicorn has appeared on Scotland's royal coat of arms for centuries."],
  ['27', 'Very Hard', "Which country has the longest coastline in the world?", 'Russia', 'Australia', 'Canada', 'Indonesia', 'C', "Canada's coastline touches three oceans: the Atlantic, Pacific, and Arctic."],
  ['28', 'Very Hard', "How many hearts does an octopus have?", '2', '3', '1', '4', 'B', "Two hearts pump blood to the gills, and the third pumps it to the rest of the body."],
  ['29', 'Very Hard', "What is the smallest country in the world by area?", 'Monaco', 'Vatican City', 'San Marino', 'Liechtenstein', 'B', "Vatican City covers only about 0.17 square miles."],
  ['30', 'Very Hard', "Counting both hot and cold deserts, what is the largest desert on Earth?", 'Sahara', 'Gobi', 'Arabian', 'Antarctic', 'D', "A desert is defined by how little precipitation it gets, not by heat, so frozen Antarctica counts."],
  ['Backup 1', 'Medium', "Which gas makes up most of Earth's air?", 'Oxygen', 'Nitrogen', 'Argon', 'Carbon dioxide', 'B', "Nitrogen makes up about 78 percent of the air we breathe."],
  ['Backup 2', 'Hard', "Which blood type is known as the universal donor for red blood cells?", 'AB positive', 'A negative', 'O negative', 'B positive', 'C', "Because it can go to almost anyone, O negative is often used in emergencies."],
  ['Backup 3', 'Medium', "How many half steps (semitones) are in one octave?", '8', '10', '12', '14', 'C', "That is why the pattern of black and white keys on a piano repeats every 12 keys."],
  ['Backup 4', 'Medium', "Which metal is a liquid at room temperature?", 'Lead', 'Mercury', 'Tin', 'Aluminum', 'B', "Mercury was once widely used in thermometers."],
  ['Backup 5', 'Easy', "What is the capital of Canada?", 'Toronto', 'Montreal', 'Vancouver', 'Ottawa', 'D', "Queen Victoria chose Ottawa as the capital in 1857."],
  ['Backup 6', 'Very Hard', "How many official time zones does China use?", '1', '3', '4', '5', 'A', "China stretches across about five geographic time zones but runs everything on Beijing Time."]
];

/* =============================================================
 * WEB PAGE
 * ============================================================= */

// Anyone who opens the old Apps Script link gets sent to the game website.
function doGet(e) {
  rememberApiUrl_();
  const site = websiteUrl_();
  const ref = String((e && e.parameter && e.parameter.ref) || '');
  const target = site ? site + (/^P[a-f0-9]{10}$/.test(ref) ? (site.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + ref : '') : '';
  const body = target
    ? '<h1 style="color:#ffb547;letter-spacing:6px">HOLDOUT</h1><p>The game is here:</p>' +
      '<p><a style="color:#ffb547;font-size:20px" href="' + target + '">' + site + '</a></p>'
    : '<p>The game website has not been set up yet.</p>';
  return HtmlService.createHtmlOutput('<!DOCTYPE html><html><head><base target="_top"></head>' +
      '<body style="font-family:sans-serif;background:#0f1626;color:#eef2fa;text-align:center;padding:60px 20px">' +
      body + '</body></html>')
    .setTitle('Holdout')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// The game website (GitHub Pages) calls this for everything it does.
// Only these actions can be called from the website. Admin tools are not on this list.
const API_ACTIONS = {
  getState: getState,
  getLeaderboard: getLeaderboard,
  join: join,
  login: login,
  submitAnswer: submitAnswer,
  useBonus: useBonus,
  newRun: newRun
};

function doPost(e) {
  rememberApiUrl_();
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = Object.prototype.hasOwnProperty.call(API_ACTIONS, body.action) ? API_ACTIONS[body.action] : null;
    if (!fn) throw new Error('Unknown request.');
    const args = Array.isArray(body.args) ? body.args.slice(0, 6) : [];
    out = { ok: true, data: fn.apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* =============================================================
 * SETUP  (run once, and again any time you update this file)
 * Never erases your questions. If a tab is from an older version
 * of the game, it is renamed with "(old)" and a fresh one is made.
 * ============================================================= */

function setup() {
  const ss = ss_();
  const tz = 'America/Chicago';

  // ---- Settings (rebuilt if it is the old month-based version) ----
  let settings = ss.getSheetByName(TAB.SETTINGS);
  const oldLayout = settings && settings.getLastRow() > 0 &&
    settings.getDataRange().getValues().some(r => String(r[0]).trim() === 'Season Start Date');
  if (!settings) settings = ss.insertSheet(TAB.SETTINGS);
  if (settings.getLastRow() === 0 || oldLayout) {
    settings.clear();
    settings.getRange('B1:B20').setNumberFormat('@');
    settings.getRange(1, 1, 1, 3).setValues([['Setting', 'Value', 'What it does']]);
    settings.getRange(2, 1, 4, 3).setValues([
      ['Game Name', 'Holdout', 'Shown at the top of the game page.'],
      ['Tagline', 'One question a day. One wrong answer and you are out.', 'Shown under the game name.'],
      ['Run Length (days)', '30', 'How many days a player must survive to make the Hall of Fame. You need a question for every day.'],
      ['Time Zone', tz, 'Used for Hall of Fame dates and for when the daily bonus limit resets (midnight).']
    ]);
    styleHeader_(settings, 3);
    settings.setColumnWidth(1, 220);
    settings.setColumnWidth(2, 420);
    settings.setColumnWidth(3, 560);
  }
  addSettingIfMissing_(settings, 'Bonus Questions Per Day', '2',
    'Most bonus questions a player can use in one day. Players earn a bonus each time a friend joins with their invite link.');
  addSettingIfMissing_(settings, 'Email Cheat Alerts', 'Yes',
    'Yes = email you each new cheat alert. No = only list them on the Cheat Alerts tab.');
  addSettingIfMissing_(settings, 'Cheat Alert Email', Session.getEffectiveUser().getEmail(),
    'Where cheat alerts are emailed.');
  addSettingIfMissing_(settings, 'Game Website', 'https://pickledbee.github.io/holdout/',
    'The address players use. Invite links and the Admin Panel use it.');
  addSettingIfMissing_(settings, 'Amazon Associate Tag', 'bumblepickleb-20',
    'Your Amazon affiliate tag. It is added to every Amazon link on the Ads tab automatically.');
  addSettingIfMissing_(settings, 'Show Amazon Picks', 'Yes',
    'Yes = show product picks from the Ads tab. No = hide all of them.');
  MailApp.getRemainingDailyQuota(); // makes Google ask for email permission during setup

  // ---- Questions (only filled in if empty) ----
  const questions = getOrCreate_(ss, TAB.QUESTIONS);
  if (questions.getLastRow() === 0) {
    questions.getRange('A1:A500').setNumberFormat('@');
    questions.getRange(1, 1, 1, QUESTION_HEADERS.length).setValues([QUESTION_HEADERS]);
    questions.getRange(2, 1, STARTER_QUESTIONS.length, QUESTION_HEADERS.length).setValues(STARTER_QUESTIONS);
    styleHeader_(questions, QUESTION_HEADERS.length);
    questions.setColumnWidth(1, 80);
    questions.setColumnWidth(2, 90);
    questions.setColumnWidth(3, 420);
    [4, 5, 6, 7].forEach(c => questions.setColumnWidth(c, 170));
    questions.setColumnWidth(8, 70);
    questions.setColumnWidth(9, 520);
    questions.getRange(2, 1, 499, QUESTION_HEADERS.length).setWrap(true).setVerticalAlignment('top');
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['A', 'B', 'C', 'D'], true).build();
    questions.getRange(2, 8, 499, 1).setDataValidation(rule);
  }

  // ---- Players, Answers, Hall of Fame ----
  const players = ensureTab_(ss, TAB.PLAYERS, PLAYER_HEADERS);
  players.setColumnWidth(2, 180);
  players.hideColumns(P.HASH + 1, 2); // hide PIN Hash and Login Token
  ensureTab_(ss, TAB.ANSWERS, ANSWER_HEADERS);
  ensureTab_(ss, TAB.HALL, HALL_HEADERS).setColumnWidth(2, 220);
  const ads = ensureTab_(ss, TAB.ADS, ADS_HEADERS);
  if (ads.getLastRow() === 1) {
    const tag = settings_().amazonTag || 'bumblepickleb-20';
    ads.getRange('A2:A500').setNumberFormat('@');
    const adRows = STARTER_ADS.map(a => [a[0], a[1], a[2], amazonSearchUrl_(a[3], tag), 'Yes']);
    ads.getRange(2, 1, adRows.length, ADS_HEADERS.length).setValues(adRows);
    ads.setColumnWidth(1, 90);
    ads.setColumnWidth(2, 300);
    ads.setColumnWidth(3, 300);
    ads.setColumnWidth(4, 520);
    ads.setColumnWidth(5, 70);
    const yesNo = SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).build();
    ads.getRange(2, 5, 499, 1).setDataValidation(yesNo);
  }
  const alerts = ensureTab_(ss, TAB.ALERTS, ALERT_HEADERS);
  alerts.setColumnWidth(1, 150);
  alerts.setColumnWidth(2, 230);
  alerts.setColumnWidth(3, 220);
  alerts.setColumnWidth(4, 620);
  alerts.hideColumns(ALERT_HEADERS.length); // hide the Key column

  // ---- How It Works (rewritten every time) ----
  const howto = getOrCreate_(ss, TAB.HOWTO);
  howto.clear();
  const notes = [
    ['HOLDOUT: HOW THIS SHEET WORKS'],
    [''],
    ['THE GAME'],
    ['   Each player\'s game starts the moment they join. Their Day 1 question is waiting right away.'],
    ['   A new question unlocks every 24 hours from the time they joined, and they have 24 hours to answer it.'],
    ['   A wrong answer, or letting 24 hours pass without answering, puts them out.'],
    ['   Survive every day (Run Length in Settings) and they go into the Hall of Fame.'],
    [''],
    ['BONUS QUESTIONS'],
    ['   Every player has a personal invite link. Each friend who joins through it earns that player 1 bonus question.'],
    ['   Still alive: a bonus lets them answer their next question right now instead of waiting.'],
    ['   Knocked out: a bonus puts them back in where they left off. If a wrong answer knocked them out,'],
    ['      they get a Second Chance question pulled from the Backup rows, so it is not the same question again.'],
    ['   Players can use up to 2 bonus questions per day (Bonus Questions Per Day in Settings). Unused bonuses carry over.'],
    [''],
    ['AMAZON PICKS (the Ads tab)'],
    ['   Show On: a question\'s Day (like 12 or Backup 1) shows the pick on that question\'s answer reveal.'],
    ['      Knockout = the screen players see when they are out. Waiting = while they wait for their next question.'],
    ['      Champion = the screen for players who survived every day. If a spot has several picks, one is chosen at random.'],
    ['   Amazon Link: any amazon.com link. Your tag (Amazon Associate Tag in Settings) is added automatically.'],
    ['      Easiest way to swap in a specific product: open it on Amazon, use the SiteStripe Text link, and paste it here.'],
    ['   Active?: Yes shows the pick, No hides it.'],
    ['   The disclosure "As an Amazon Associate I earn from qualifying purchases." shows next to every pick and at the bottom of the page.'],
    ['   Amazon rules: never offer anything in the game for clicking or buying, never type prices,'],
    ['      and add the game link to your Associates account (Account Settings > Website and Mobile App List).'],
    [''],
    ['CHEAT ALERTS (logged on the Cheat Alerts tab and emailed to you)'],
    ['   Same device, more than one account: two or more accounts were played on the same phone or computer.'],
    ['      Flagged as high priority when one of those accounts earned a bonus from the other.'],
    ['   Sign-up burst: one player\'s invite link brought in 4 or more sign-ups within 24 hours.'],
    ['   Invited friends never played: 3 or more of a player\'s invited friends joined but never answered a question.'],
    ['   Lightning answers: a player got 3 Hard or Very Hard questions right in under 3 seconds each (answers shared by a friend?).'],
    ['   PIN guessing: someone typed a wrong PIN 5 times in a row on one account.'],
    ['   An alert is a reason to look, not proof. To deal with a cheater: delete their row on the Players tab,'],
    ['      or lower their Bonus Questions number. Type Yes in the Reviewed? column when you have checked an alert.'],
    [''],
    ['THE TABS'],
    ['   Settings: game name, tagline, run length, and the daily bonus limit.'],
    ['   Questions: one row per day, plus Backup rows. Correct must be A, B, C, or D. Players never see the Correct column.'],
    ['      Keep at least a few Backup rows. They are used for Second Chance questions and for swapping out a bad question.'],
    ['   Players: filled in automatically. Status is Alive, Out, or Champion. PIN Hash and Login Token are hidden on purpose.'],
    ['   Answers: a log of every answer.'],
    ['   Hall of Fame: everyone who survived a full run.'],
    ['   Ads: your Amazon affiliate product picks.'],
    ['   Cheat Alerts: anything suspicious, newest at the bottom.'],
    [''],
    ['HOLDOUT ADMIN MENU (at the top of this sheet, next to Help)'],
    ['   Bring back players knocked out by a bad question: use it if a question was wrong or unfair.'],
    ['   Give a player a bonus question: type their display name and they get 1 bonus.'],
    ['   Run the missed-day check now: this also runs by itself every hour.'],
    ['   Check for cheating now: also runs by itself every hour.'],
    ['   Show the game link: the web address to share with players.'],
    [''],
    ['Keep this spreadsheet private (Share > General access > Restricted). The game page does not need it to be shared.']
  ];
  howto.getRange(1, 1, notes.length, 1).setValues(notes);
  howto.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  notes.forEach((n, idx) => { if (/^[A-Z]/.test(n[0])) howto.getRange(idx + 1, 1).setFontWeight('bold'); });
  howto.setColumnWidth(1, 980);

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  [TAB.HOWTO, TAB.SETTINGS, TAB.QUESTIONS, TAB.PLAYERS, TAB.ANSWERS, TAB.HALL, TAB.ADS, TAB.ALERTS].forEach((name, i) => {
    ss.setActiveSheet(ss.getSheetByName(name));
    ss.moveActiveSheet(i + 1);
  });

  installHourlyCheck_();
  Logger.log('Setup finished. Now deploy: Deploy > Manage deployments > pencil > New version > Deploy.');
}

/* =============================================================
 * CALLED BY THE GAME PAGE
 * ============================================================= */

function getState(token, ref) {
  const s = settings_();
  const now = Date.now();
  const baseUrl = gameUrl_();
  const state = {
    gameName: s.gameName,
    tagline: s.tagline,
    length: s.length,
    bonusLimit: s.bonusPerDay,
    shareUrl: baseUrl,
    referrerName: '',
    player: null,
    question: null,
    questionMissing: false,
    countdown: 0,
    reveal: null,
    ads: { reveal: null, slot: null },
    disclosure: s.showAds ? AMAZON_DISCLOSURE : ''
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();

    if (ref && !token) {
      const refRow = data.rows.find(r => r[P.ID] === ref);
      if (refRow) state.referrerName = String(refRow[P.NAME]);
    }
    if (!token) return state;

    const i = data.rows.findIndex(r => r[P.TOKEN] && r[P.TOKEN] === token);
    if (i < 0) return state;
    const row = data.rows[i];
    if (checkMissed_(row, now, s)) writePlayer_(data.sh, i, row);

    const days = Number(row[P.DAYS]) || 0;
    const start = startMs_(row);
    const pd = personalDay_(row, now);
    const status = String(row[P.STATUS]);
    const usedToday = bonusUsedToday_(row, s);

    state.player = {
      name: String(row[P.NAME]),
      status: status,
      daysSurvived: days,
      outOnDay: Number(row[P.OUTDAY]) || 0,
      outReason: String(row[P.REASON] || ''),
      best: Math.max(Number(row[P.BEST]) || 0, days),
      attempt: Number(row[P.ATTEMPT]) || 1,
      day: Math.min(pd, s.length),
      bonus: Number(row[P.BONUS]) || 0,
      bonusUsedToday: usedToday,
      friendsInvited: Number(row[P.FRIENDS]) || 0,
      inviteUrl: baseUrl ? baseUrl + '?ref=' + row[P.ID] : ''
    };

    const answeredCurrent = status === 'Alive' && days >= pd;
    state.player.answeredToday = answeredCurrent;
    state.player.canUseBonus = state.player.bonus > 0 && usedToday < s.bonusPerDay &&
      ((status === 'Alive' && answeredCurrent && days < s.length) || status === 'Out');

    if (status === 'Alive') {
      state.countdown = Math.max(0, Math.round((start + pd * DAY_MS - now) / 1000));
      if (!answeredCurrent) {
        const label = row[P.OVERRIDE] ? String(row[P.OVERRIDE]) : String(pd);
        const q = question_(label);
        if (q) {
          state.question = { day: pd, secondChance: !!row[P.OVERRIDE], difficulty: q.difficulty, text: q.text,
            choices: { A: q.A, B: q.B, C: q.C, D: q.D } };
          const shownKey = label + '|' + (Number(row[P.ATTEMPT]) || 1) + '|' + pd;
          if (String(row[P.SHOWNQ]) !== shownKey) {
            row[P.SHOWNQ] = shownKey;
            row[P.SHOWNAT] = now;
            writePlayer_(data.sh, i, row);
          }
        } else {
          state.questionMissing = true;
        }
        if (row[P.LASTQ]) state.reveal = reveal_(row[P.LASTQ]);
      }
    } else if (status === 'Out') {
      const outDay = Number(row[P.OUTDAY]) || 0;
      if (row[P.REASON] === 'Wrong answer' && row[P.LASTQ] && now >= start + outDay * DAY_MS) {
        state.reveal = reveal_(row[P.LASTQ]);
      }
    } else if (status === 'Champion' && row[P.LASTQ]) {
      state.reveal = reveal_(row[P.LASTQ]);
    }
  } finally {
    lock.releaseLock();
  }

  // Amazon picks
  try {
    if (s.showAds && state.player) {
      if (state.reveal) state.ads.reveal = pickAd_(state.reveal.label, s);
      const st = state.player.status;
      const slot = st === 'Out' ? 'Knockout'
        : st === 'Champion' ? 'Champion'
        : (st === 'Alive' && state.player.answeredToday) ? 'Waiting' : '';
      if (slot) state.ads.slot = pickAd_(slot, s);
    }
  } catch (err) { Logger.log(err); }
  return state;
}

function getLeaderboard() {
  const s = settings_();
  const now = Date.now();
  const rows = readPlayers_().rows.filter(r => r[P.NAME]).map(r => {
    const copy = r.slice();
    checkMissed_(copy, now, s); // display only; the hourly check saves it
    return copy;
  });

  const alive = rows.filter(r => r[P.STATUS] === 'Alive').map(r => {
    const days = Number(r[P.DAYS]) || 0;
    const pd = personalDay_(r, now);
    return { name: String(r[P.NAME]), survived: days, answeredToday: days >= pd };
  }).sort((a, b) => b.survived - a.survived || a.name.localeCompare(b.name));

  const out = rows.filter(r => r[P.STATUS] === 'Out').map(r => ({
    name: String(r[P.NAME]),
    outOnDay: Number(r[P.OUTDAY]) || 0,
    reason: String(r[P.REASON] || ''),
    best: Number(r[P.BEST]) || 0
  })).sort((a, b) => b.best - a.best || b.outOnDay - a.outOnDay || a.name.localeCompare(b.name)).slice(0, 100);

  const recruiters = rows.filter(r => Number(r[P.FRIENDS]) > 0)
    .map(r => ({ name: String(r[P.NAME]), friends: Number(r[P.FRIENDS]) }))
    .sort((a, b) => b.friends - a.friends || a.name.localeCompare(b.name)).slice(0, 5);

  const hallSheet = ss_().getSheetByName(TAB.HALL);
  let hall = [];
  if (hallSheet.getLastRow() > 1) {
    hall = hallSheet.getRange(2, 1, hallSheet.getLastRow() - 1, HALL_HEADERS.length).getValues()
      .filter(r => r[1])
      .map(r => ({
        name: String(r[1]),
        date: r[0] instanceof Date ? Utilities.formatDate(r[0], s.tz, 'MMM d, yyyy') : String(r[0]),
        attempt: Number(r[2]) || 1
      }))
      .reverse().slice(0, 25);
  }

  return { alive: alive, out: out, hall: hall, recruiters: recruiters, total: rows.length, length: s.length };
}

function join(name, pin, confirmed13, ref, deviceId) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  pin = String(pin || '').trim();
  ref = String(ref || '');
  deviceId = cleanDevice_(deviceId);
  if (!confirmed13) throw new Error('You must confirm you are 13 or older to play.');
  if (!/^[A-Za-z0-9 _.\-]{2,20}$/.test(name)) {
    throw new Error('Pick a display name 2 to 20 characters long, using letters, numbers, spaces, dashes, dots, or underscores.');
  }
  if (!/^\d{4,6}$/.test(pin)) throw new Error('Your PIN must be 4 to 6 numbers.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    if (data.rows.some(r => String(r[P.NAME]).toLowerCase() === name.toLowerCase())) {
      throw new Error('That display name is taken. Try another one.');
    }

    // Credit the friend who invited them
    const now = Date.now();
    let refId = '';
    let refRow = null;
    if (/^P[a-f0-9]{10}$/.test(ref)) {
      const ri = data.rows.findIndex(r => r[P.ID] === ref);
      if (ri >= 0) {
        refRow = data.rows[ri];
        refRow[P.BONUS] = (Number(refRow[P.BONUS]) || 0) + 1;
        refRow[P.FRIENDS] = (Number(refRow[P.FRIENDS]) || 0) + 1;
        writePlayer_(data.sh, ri, refRow);
        refId = ref;
      }
    }
    const id = 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    const token = Utilities.getUuid();
    const row = new Array(PLAYER_HEADERS.length).fill('');
    row[P.ID] = id;
    row[P.NAME] = name;
    row[P.HASH] = hash_(id, pin);
    row[P.TOKEN] = token;
    row[P.JOINED] = new Date(now);
    row[P.AGE] = 'Yes';
    row[P.STATUS] = 'Alive';
    row[P.START] = new Date(now);
    row[P.ATTEMPT] = 1;
    row[P.DAYS] = 0;
    row[P.BEST] = 0;
    row[P.BONUS] = 0;
    row[P.BONUSUSED] = 0;
    row[P.REFBY] = refId;
    row[P.FRIENDS] = 0;
    row[P.DEVICES] = deviceId;
    row[P.FAST] = 0;
    data.sh.appendRow(row);

    // ---- cheat checks (never block a sign-up) ----
    try {
      if (deviceId) sameDeviceCheck_(data.rows, row, deviceId);
      if (refRow) {
        const recent = data.rows.filter(r => r[P.REFBY] === refId &&
          r[P.JOINED] instanceof Date && now - r[P.JOINED].getTime() < DAY_MS).length + 1;
        if (recent >= CHEAT.BURST_FRIENDS) {
          alert_('Sign-up burst', String(refRow[P.NAME]),
            recent + ' people joined with ' + refRow[P.NAME] + '\'s invite link in the last 24 hours. Newest: ' + name +
            '. Could be real friends, or fake accounts made to earn bonus questions.',
            'burst|' + refId + '|' + todayKey_(settings_()));
        }
      }
    } catch (err) { Logger.log(err); }

    return { token: token };
  } finally {
    lock.releaseLock();
  }
}

function login(name, pin, deviceId) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  pin = String(pin || '').trim();
  deviceId = cleanDevice_(deviceId);
  const cache = CacheService.getScriptCache();
  const key = 'fail_' + name.toLowerCase();
  const fails = Number(cache.get(key) || 0);
  if (fails >= 5) throw new Error('Too many wrong tries. Please wait 15 minutes and try again.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => String(r[P.NAME]).toLowerCase() === name.toLowerCase());
    if (i < 0 || data.rows[i][P.HASH] !== hash_(data.rows[i][P.ID], pin)) {
      cache.put(key, String(fails + 1), 900);
      if (i >= 0 && fails + 1 >= CHEAT.PIN_FAILS) {
        try {
          alert_('PIN guessing', String(data.rows[i][P.NAME]),
            'Someone typed the wrong PIN ' + (fails + 1) + ' times in a row on ' + data.rows[i][P.NAME] +
            '\'s account. The account is locked for 15 minutes. Could be the owner forgetting, or someone trying to get in.',
            'pin|' + data.rows[i][P.ID] + '|' + todayKey_(settings_()));
        } catch (err) { Logger.log(err); }
      }
      throw new Error('That name and PIN do not match.');
    }
    const row = data.rows[i];
    let changed = false;
    if (!row[P.TOKEN]) {
      row[P.TOKEN] = Utilities.getUuid();
      changed = true;
    }
    if (deviceId && String(row[P.DEVICES]).split(',').indexOf(deviceId) < 0) {
      row[P.DEVICES] = String(row[P.DEVICES] || '').split(',').filter(Boolean).concat(deviceId).slice(-8).join(',');
      changed = true;
      try { sameDeviceCheck_(data.rows, row, deviceId); } catch (err) { Logger.log(err); }
    }
    if (changed) writePlayer_(data.sh, i, row);
    cache.remove(key);
    return { token: row[P.TOKEN] };
  } finally {
    lock.releaseLock();
  }
}

function submitAnswer(token, choice) {
  choice = String(choice || '').toUpperCase();
  if (!/^[ABCD]$/.test(choice)) throw new Error('Pick A, B, C, or D.');
  const s = settings_();
  const now = Date.now();

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => r[P.TOKEN] && r[P.TOKEN] === token);
    if (i < 0) throw new Error('Please log in again.');
    const row = data.rows[i];

    if (checkMissed_(row, now, s)) {
      writePlayer_(data.sh, i, row);
      return { result: 'missed', outOnDay: row[P.OUTDAY] };
    }
    if (row[P.STATUS] !== 'Alive') throw new Error('You are not in a run right now.');

    const days = Number(row[P.DAYS]) || 0;
    const pd = personalDay_(row, now);
    if (days >= pd) throw new Error('You already answered this one. Come back when the next question unlocks!');

    const label = row[P.OVERRIDE] ? String(row[P.OVERRIDE]) : String(pd);
    const q = question_(label);
    if (!q) throw new Error('This question is not posted yet. Check back soon.');

    const correct = choice === q.correct;
    const shownKey = label + '|' + (Number(row[P.ATTEMPT]) || 1) + '|' + pd;
    const secs = (String(row[P.SHOWNQ]) === shownKey && Number(row[P.SHOWNAT]))
      ? Math.round((now - Number(row[P.SHOWNAT])) / 100) / 10 : '';
    ss_().getSheetByName(TAB.ANSWERS).appendRow(
      [new Date(now), row[P.ID], row[P.NAME], row[P.ATTEMPT], pd, label, choice, correct ? 'Yes' : 'No', secs]);

    if (correct && secs !== '' && secs < CHEAT.FAST_SECONDS && /hard/i.test(q.difficulty)) {
      row[P.FAST] = (Number(row[P.FAST]) || 0) + 1;
      if (Number(row[P.FAST]) % CHEAT.FAST_COUNT === 0) { // alerts at 3, 6, 9...
        try {
          alert_('Lightning answers', String(row[P.NAME]),
            row[P.NAME] + ' has answered ' + row[P.FAST] + ' Hard or Very Hard questions correctly in under ' +
            CHEAT.FAST_SECONDS + ' seconds each. Latest: Day ' + pd + ' in ' + secs +
            ' seconds. They may be getting answers from a friend who already played that day.',
            'fast|' + row[P.ID] + '|' + row[P.FAST]);
        } catch (err) { Logger.log(err); }
      }
    }

    row[P.OVERRIDE] = '';
    row[P.LASTQ] = label;
    let champion = false;
    if (correct) {
      row[P.DAYS] = pd;
      row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, pd);
      if (pd >= s.length) {
        champion = true;
        row[P.STATUS] = 'Champion';
        ss_().getSheetByName(TAB.HALL).appendRow([new Date(now), row[P.NAME], row[P.ATTEMPT], pd]);
      }
    } else {
      row[P.STATUS] = 'Out';
      row[P.OUTDAY] = pd;
      row[P.REASON] = 'Wrong answer';
    }
    writePlayer_(data.sh, i, row);
    let ad = null;
    try {
      if (s.showAds) ad = pickAd_(champion ? 'Champion' : correct ? 'Waiting' : 'Knockout', s);
    } catch (err) { Logger.log(err); }
    return {
      ad: ad,
      disclosure: s.showAds ? AMAZON_DISCLOSURE : '',
      result: correct ? 'correct' : 'wrong',
      day: pd,
      champion: champion,
      secondsToNext: Math.max(0, Math.round((startMs_(row) + pd * DAY_MS - now) / 1000))
    };
  } finally {
    lock.releaseLock();
  }
}

// Spend 1 bonus question (earned by inviting friends). Limit per day is in Settings.
function useBonus(token) {
  const s = settings_();
  const now = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => r[P.TOKEN] && r[P.TOKEN] === token);
    if (i < 0) throw new Error('Please log in again.');
    const row = data.rows[i];
    checkMissed_(row, now, s);

    if ((Number(row[P.BONUS]) || 0) <= 0) {
      throw new Error('You do not have a bonus question yet. Share your invite link. Each friend who joins earns you one.');
    }
    const used = bonusUsedToday_(row, s);
    if (used >= s.bonusPerDay) {
      throw new Error('You have used your ' + s.bonusPerDay + ' bonus questions for today. Your bonuses will still be here tomorrow.');
    }

    const status = String(row[P.STATUS]);
    const days = Number(row[P.DAYS]) || 0;

    if (status === 'Alive') {
      const pd = personalDay_(row, now);
      if (days < pd) throw new Error('Answer your current question first.');
      if (days >= s.length) throw new Error('You have already finished your run!');
      // Move their clock back one day so the next question unlocks right now.
      // The time it must be answered by stays the same as their normal schedule.
      row[P.START] = new Date(startMs_(row) - DAY_MS);
    } else if (status === 'Out') {
      const outDay = Number(row[P.OUTDAY]) || (days + 1);
      const wasWrong = row[P.REASON] === 'Wrong answer';
      row[P.STATUS] = 'Alive';
      row[P.DAYS] = outDay - 1;
      row[P.START] = new Date(now - (outDay - 1) * DAY_MS); // Day outDay starts right now with a full 24 hours
      row[P.OUTDAY] = '';
      row[P.REASON] = '';
      row[P.OVERRIDE] = wasWrong ? pickSecondChance_(String(row[P.LASTQ] || '')) : '';
    } else {
      throw new Error('You finished your run! Start a new run to keep playing.');
    }

    row[P.BONUS] = (Number(row[P.BONUS]) || 0) - 1;
    row[P.BONUSDATE] = todayKey_(s);
    row[P.BONUSUSED] = used + 1;
    writePlayer_(data.sh, i, row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// Champions can start a fresh run any time.
function newRun(token) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => r[P.TOKEN] && r[P.TOKEN] === token);
    if (i < 0) throw new Error('Please log in again.');
    const row = data.rows[i];
    if (row[P.STATUS] !== 'Champion') throw new Error('You can start a new run after you finish this one.');
    row[P.STATUS] = 'Alive';
    row[P.START] = new Date();
    row[P.ATTEMPT] = (Number(row[P.ATTEMPT]) || 1) + 1;
    row[P.DAYS] = 0;
    row[P.OUTDAY] = '';
    row[P.REASON] = '';
    row[P.OVERRIDE] = '';
    writePlayer_(data.sh, i, row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* =============================================================
 * HOURLY CHECK: anyone who let 24 hours pass without answering is out
 * ============================================================= */

function sweepMissed() {
  const s = settings_();
  const now = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = readPlayers_();
    let changed = false;
    data.rows.forEach(r => { if (checkMissed_(r, now, s)) changed = true; });
    if (changed) data.sh.getRange(2, 1, data.rows.length, PLAYER_HEADERS.length).setValues(data.rows);
  } finally {
    lock.releaseLock();
  }
  try { dudReferralCheck_(); } catch (err) { Logger.log(err); }
}

/* =============================================================
 * ADMIN MENU (shows up at the top of the spreadsheet)
 * ============================================================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Holdout Admin')
    .addItem('Open Admin Panel', 'openAdminPanel')
    .addSeparator()
    .addItem('Bring back players knocked out by a bad question', 'adminReviveDay')
    .addItem('Give a player a bonus question', 'adminGiveBonus')
    .addItem('Run the missed-day check now', 'sweepMissed')
    .addItem('Check for cheating now', 'adminCheckCheating')
    .addItem('Test the Amazon picks', 'adminTestAds')
    .addSeparator()
    .addItem('Show the game link', 'adminShowLink')
    .addToUi();
}

function adminReviveDay() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Bring back players',
    'Which day number had the bad question? Everyone who got that day wrong will be set back to Alive, and their next question unlocks right away.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const n = parseInt(res.getResponseText(), 10);
  if (!n || n < 1) { ui.alert('Please type a day number, like 5.'); return; }

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
        r[P.START] = new Date(now - n * DAY_MS); // puts them at the start of Day n+1 right now
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
  ui.alert(count + ' player(s) brought back from Day ' + n + '.');
}

function adminGiveBonus() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Give a bonus question', 'Type the player\'s display name:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const name = res.getResponseText().trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => String(r[P.NAME]).toLowerCase() === name);
    if (i < 0) { ui.alert('No player found with that name.'); return; }
    const row = data.rows[i];
    row[P.BONUS] = (Number(row[P.BONUS]) || 0) + 1;
    writePlayer_(data.sh, i, row);
    ui.alert(row[P.NAME] + ' now has ' + row[P.BONUS] + ' bonus question(s).');
  } finally {
    lock.releaseLock();
  }
}

function adminCheckCheating() {
  const before = alertCount_();
  dudReferralCheck_();
  const added = alertCount_() - before;
  SpreadsheetApp.getUi().alert(added > 0
    ? added + ' new cheat alert(s). See the Cheat Alerts tab.'
    : 'No new cheat alerts. (Same-device, sign-up burst, lightning answer, and PIN alerts are caught the moment they happen.)');
}

function adminTestAds() {
  const ui = SpreadsheetApp.getUi();
  const s = settings_();
  const sh = ss_().getSheetByName(TAB.ADS);
  if (!sh) {
    ui.alert('There is no Ads tab yet. In the Apps Script editor, choose setup and click Run, then try again.');
    return;
  }
  const rows = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, ADS_HEADERS.length).getValues();
  const active = rows.filter(r => r[0] && r[2] && String(r[4]).trim().toLowerCase().indexOf('y') === 0);
  const usable = active.filter(r => safeAmazonUrl_(r[3], s.amazonTag));
  const count = slot => usable.filter(r => String(r[0]).trim().toLowerCase() === slot.toLowerCase()).length;
  const sample = pickAd_('Waiting', s);
  ui.alert('Amazon picks check',
    'Show Amazon Picks setting: ' + (s.showAds ? 'Yes' : 'NO (picks are turned off on the Settings tab)') + '\n' +
    'Amazon Associate Tag: ' + s.amazonTag + '\n\n' +
    'Picks on the Ads tab: ' + rows.length + ' (active: ' + active.length + ', with a working Amazon link: ' + usable.length + ')\n' +
    'Knockout picks: ' + count('Knockout') + '\nWaiting picks: ' + count('Waiting') + '\nChampion picks: ' + count('Champion') + '\n\n' +
    (sample ? 'Sample link players would see:\n' + sample.url : 'No Waiting pick could be shown.') + '\n\n' +
    'If this all looks right but the game still shows no picks, the game page is running an older version. ' +
    'In Apps Script: Deploy > Manage deployments > pencil > Version: New version > Deploy.',
    ui.ButtonSet.OK);
}

function adminShowLink() {
  const url = gameUrl_();
  SpreadsheetApp.getUi().alert(url ? 'Share this link with players:\n\n' + url
    : 'No link yet. In the Apps Script editor, click Deploy > New deployment > Web app first.');
}

/* =============================================================
 * HELPERS
 * ============================================================= */

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

function readSetting_(key) {
  try {
    const row = ss_().getSheetByName(TAB.SETTINGS).getDataRange().getValues()
      .find(r => String(r[0]).trim() === key);
    return row ? String(row[1]).trim() : '';
  } catch (e) { return ''; }
}

// The game website players use (GitHub Pages). Used for invite links.
function websiteUrl_() {
  const site = readSetting_('Game Website');
  return /^https:\/\/[^\s"'<>]+$/.test(site) ? site : '';
}

// The address players should be sent to.
function gameUrl_() {
  return websiteUrl_() || apiUrl_();
}

// This script's public /exec link: the API address the website's config.js needs.
// Inside the spreadsheet, Google sometimes reports a private test link ending in /dev,
// so we use the link saved the last time the website or link was used.
function apiUrl_() {
  const saved = PropertiesService.getScriptProperties().getProperty('GAME_URL') || '';
  if (saved) return saved;
  const url = ScriptApp.getService().getUrl() || '';
  return /\/exec$/.test(url) ? url : '';
}

function rememberApiUrl_() {
  try {
    const url = ScriptApp.getService().getUrl() || '';
    if (!/\/exec$/.test(url)) return;
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('GAME_URL') !== url) props.setProperty('GAME_URL', url);
  } catch (e) {}
}

function getOrCreate_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }

function styleHeader_(sh, n) {
  sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#1f2a44').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}

// Makes sure a tab exists with the right headers. If it holds data from an
// older version with different headers, that tab is renamed "(old)".
function ensureTab_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (sh && sh.getLastRow() > 0) {
    const current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const same = current.length >= headers.length && headers.every((h, i) => current[i] === h);
    const onlyAdded = !same && current.length < headers.length && current.every((h, i) => h === headers[i]);
    if (onlyAdded) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      styleHeader_(sh, headers.length);
    } else if (!same) {
      if (sh.getLastRow() > 1) {
        let oldName = name + ' (old)';
        if (ss.getSheetByName(oldName)) oldName = name + ' (old ' + Date.now() + ')';
        sh.setName(oldName);
        sh = null;
      } else {
        sh.clear();
        sh.showColumns(1, sh.getMaxColumns());
      }
    }
  }
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    styleHeader_(sh, headers.length);
  }
  return sh;
}

function settings_() {
  const vals = ss_().getSheetByName(TAB.SETTINGS).getDataRange().getValues();
  const m = {};
  vals.slice(1).forEach(r => { m[String(r[0]).trim()] = r[1]; });
  const perDay = parseInt(m['Bonus Questions Per Day'], 10);
  return {
    gameName: String(m['Game Name'] || 'Holdout'),
    tagline: String(m['Tagline'] || ''),
    length: parseInt(m['Run Length (days)'], 10) || 30,
    bonusPerDay: isNaN(perDay) ? 2 : perDay,
    amazonTag: String(m['Amazon Associate Tag'] || 'bumblepickleb-20').trim(),
    showAds: String(m['Show Amazon Picks'] || 'Yes').trim().toLowerCase().indexOf('y') === 0,
    emailAlerts: String(m['Email Cheat Alerts'] || 'Yes').trim().toLowerCase().indexOf('y') === 0,
    alertEmail: String(m['Cheat Alert Email'] || '').trim(),
    tz: String(m['Time Zone'] || 'America/Chicago').trim()
  };
}

function addSettingIfMissing_(sh, key, value, note) {
  const keys = sh.getDataRange().getValues().map(r => String(r[0]).trim());
  if (keys.indexOf(key) >= 0) return;
  const row = sh.getLastRow() + 1;
  sh.getRange(row, 2).setNumberFormat('@');
  sh.getRange(row, 1, 1, 3).setValues([[key, value, note]]);
}

/* ---------- Amazon picks ---------- */

function amazonSearchUrl_(query, tag) {
  return 'https://www.amazon.com/s?k=' + encodeURIComponent(query).replace(/%20/g, '+') +
    '&tag=' + encodeURIComponent(tag);
}

// Only allows real Amazon links, and makes sure amazon.com links carry your tag.
function safeAmazonUrl_(url, tag) {
  url = String(url || '').trim();
  const m = url.match(/^https:\/\/(www\.)?(amazon\.com|amzn\.to|a\.co)(\/[^\s"'<>]*)?$/i);
  if (!m) return '';
  if (/amazon\.com/i.test(m[2])) {
    url = url.replace(/([?&])tag=[^&#]*/i, '$1tag=' + encodeURIComponent(tag));
    if (!/[?&]tag=/i.test(url)) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'tag=' + encodeURIComponent(tag);
  }
  return url;
}

function pickAd_(showOn, s) {
  const sh = ss_().getSheetByName(TAB.ADS);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, ADS_HEADERS.length).getValues()
    .filter(r => String(r[0]).trim().toLowerCase() === String(showOn).trim().toLowerCase() &&
      String(r[4]).trim().toLowerCase().indexOf('y') === 0 && r[2] && r[3]);
  const choices = rows.map(r => ({ headline: String(r[1]), product: String(r[2]), url: safeAmazonUrl_(r[3], s.amazonTag) }))
    .filter(a => a.url);
  if (!choices.length) return null;
  return choices[Math.floor(Math.random() * choices.length)];
}

/* ---------- cheat detection ---------- */

function cleanDevice_(d) {
  d = String(d || '');
  return /^[A-Za-z0-9]{8,40}$/.test(d) ? d : '';
}

// Alerts when two or more accounts are played on the same phone or computer.
function sameDeviceCheck_(rows, row, deviceId) {
  const others = rows.filter(r => r[P.ID] !== row[P.ID] && r[P.NAME] &&
    String(r[P.DEVICES]).split(',').indexOf(deviceId) >= 0);
  if (!others.length) return;
  const names = [String(row[P.NAME])].concat(others.map(r => String(r[P.NAME])));
  const bonusLink = others.some(r => r[P.ID] === row[P.REFBY] || r[P.REFBY] === row[P.ID]);
  alert_(bonusLink ? 'Same device + bonus (high priority)' : 'Same device, more than one account',
    names.join(', '),
    names.length + ' accounts have been played on the same phone or computer: ' + names.join(', ') + '.' +
    (bonusLink ? ' One of them earned a bonus question when another one joined, which is how fake-account bonus farming looks.'
      : ' Could be family members sharing a device, or one person with extra accounts.'),
    'device|' + names.slice().sort().join('|'));
}

// Alerts when a player's invited friends joined but never answered anything.
function dudReferralCheck_() {
  const now = Date.now();
  const rows = readPlayers_().rows.filter(r => r[P.NAME]);
  const byRef = {};
  rows.forEach(r => {
    if (!r[P.REFBY]) return;
    const joined = r[P.JOINED] instanceof Date ? r[P.JOINED].getTime() : 0;
    const neverPlayed = !r[P.LASTQ] && !(Number(r[P.DAYS]) > 0);
    if (joined && now - joined > DAY_MS && neverPlayed) {
      (byRef[r[P.REFBY]] = byRef[r[P.REFBY]] || []).push(String(r[P.NAME]));
    }
  });
  Object.keys(byRef).forEach(refId => {
    const duds = byRef[refId];
    if (duds.length < CHEAT.DUD_FRIENDS) return;
    const referrer = rows.find(r => r[P.ID] === refId);
    if (!referrer) return;
    alert_('Invited friends never played', String(referrer[P.NAME]),
      duds.length + ' people who joined with ' + referrer[P.NAME] + '\'s invite link never answered a single question: ' +
      duds.join(', ') + '. These may be fake accounts made to earn bonus questions.',
      'dud|' + refId + '|' + duds.length);
  });
}

// Logs an alert once (by key) and emails it if turned on in Settings.
function alert_(type, players, details, key) {
  const sh = ss_().getSheetByName(TAB.ALERTS);
  if (!sh) return;
  const last = sh.getLastRow();
  if (last > 1) {
    const keys = sh.getRange(2, ALERT_HEADERS.length, last - 1, 1).getValues().map(r => String(r[0]));
    if (keys.indexOf(key) >= 0) return;
  }
  sh.appendRow([new Date(), type, players, details, '', key]);
  const s = settings_();
  if (s.emailAlerts && s.alertEmail) {
    try {
      MailApp.sendEmail(s.alertEmail, s.gameName + ' cheat alert: ' + type,
        type + '\n\nPlayer(s): ' + players + '\n\n' + details +
        '\n\nOpen your spreadsheet and check the Cheat Alerts tab:\n' + ss_().getUrl() +
        '\n\nAn alert is a reason to look, not proof.');
    } catch (err) { Logger.log(err); }
  }
}

function alertCount_() {
  const sh = ss_().getSheetByName(TAB.ALERTS);
  return sh ? Math.max(0, sh.getLastRow() - 1) : 0;
}

function readPlayers_() {
  const sh = ss_().getSheetByName(TAB.PLAYERS);
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, PLAYER_HEADERS.length).getValues();
  return { sh: sh, rows: rows };
}

function writePlayer_(sh, index, row) {
  sh.getRange(index + 2, 1, 1, row.length).setValues([row]);
}

function startMs_(row) {
  const v = row[P.START];
  if (v instanceof Date) return v.getTime();
  const t = new Date(v).getTime();
  return isNaN(t) ? Date.now() : t;
}

// Which day of their run a player is on right now (Day 1 starts the moment they join)
function personalDay_(row, now) {
  return Math.floor((now - startMs_(row)) / DAY_MS) + 1;
}

function todayKey_(s) {
  return Utilities.formatDate(new Date(), s.tz, 'yyyy-MM-dd');
}

function bonusUsedToday_(row, s) {
  let d = row[P.BONUSDATE];
  if (d instanceof Date) d = Utilities.formatDate(d, s.tz, 'yyyy-MM-dd');
  return String(d) === todayKey_(s) ? (Number(row[P.BONUSUSED]) || 0) : 0;
}

// Marks a player Out if 24 hours passed without an answer. Returns true if it changed the row.
function checkMissed_(row, now, s) {
  if (!row[P.NAME] || row[P.STATUS] !== 'Alive') return false;
  const days = Number(row[P.DAYS]) || 0;
  if (days >= s.length) return false;
  if (personalDay_(row, now) - 1 > days) {
    row[P.STATUS] = 'Out';
    row[P.OUTDAY] = days + 1;
    row[P.REASON] = 'Missed a day';
    row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, days);
    row[P.OVERRIDE] = '';
    return true;
  }
  return false;
}

// Picks a Backup question for a Second Chance, avoiding the one they just missed.
function pickSecondChance_(avoid) {
  const sh = ss_().getSheetByName(TAB.QUESTIONS);
  const last = sh.getLastRow();
  if (last < 2) return '';
  const labels = sh.getRange(2, 1, last - 1, 3).getValues()
    .filter(r => /^backup/i.test(String(r[0]).trim()) && r[2])
    .map(r => String(r[0]).trim())
    .filter(l => l !== avoid);
  if (!labels.length) return '';
  return labels[Math.floor(Math.random() * labels.length)];
}

function question_(label) {
  const sh = ss_().getSheetByName(TAB.QUESTIONS);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const rows = sh.getRange(2, 1, last - 1, QUESTION_HEADERS.length).getValues();
  const r = rows.find(x => String(x[0]).trim() === String(label).trim());
  if (!r || !r[2]) return null;
  return { difficulty: String(r[1]), text: String(r[2]), A: String(r[3]), B: String(r[4]),
    C: String(r[5]), D: String(r[6]), correct: String(r[7]).trim().toUpperCase(), funFact: String(r[8] || '') };
}

function reveal_(label) {
  const q = question_(label);
  if (!q) return null;
  const stats = answerStats_(label);
  return { label: String(label), text: q.text, correctLetter: q.correct, correctText: q[q.correct] || '',
    funFact: q.funFact, answered: stats.answered, correct: stats.correct };
}

function answerStats_(label) {
  const sh = ss_().getSheetByName(TAB.ANSWERS);
  const last = sh.getLastRow();
  if (last < 2) return { answered: 0, correct: 0 };
  const rows = sh.getRange(2, 1, last - 1, ANSWER_HEADERS.length).getValues();
  let answered = 0, correct = 0;
  rows.forEach(r => {
    if (String(r[5]).trim() === String(label).trim()) {
      answered++;
      if (r[7] === 'Yes') correct++;
    }
  });
  return { answered: answered, correct: correct };
}

function hash_(id, pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id + ':' + pin + ':holdout');
  return Utilities.base64Encode(bytes);
}

function installHourlyCheck_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sweepMissed')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sweepMissed').timeBased().everyHours(1).create();
}

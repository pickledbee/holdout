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
  REPORTS: 'Question Reports',
  HOWTO: 'How It Works'
};

const PLAYER_HEADERS = ['Player ID', 'Display Name', 'PIN Hash', 'Login Token', 'Joined', 'Confirmed 13+',
  'Status', 'Run Started', 'Attempt', 'Current Run Score', 'Out On Question', 'Out Reason', 'Best Endless Run',
  'Bonus Questions', 'Bonus Date', 'Bonus Used That Date', 'Invited By', 'Friends Invited',
  'Current Question', 'Last Question', 'Devices', 'Fast Answers', 'Question Shown At', 'Shown Question',
  'Last Day Played', 'Pause Days Used', 'Comebacks', 'Seen Questions', 'Last Restart Date',
  'Saved Account', 'Total Answers', 'Invite Credited', 'Best Today Date', 'Best Today', 'Daily Date', 'Daily Question',
  'Daily Score', 'Daily Done', 'Daily Streak', 'Daily Last Played', 'Daily Best'];
const P = { ID: 0, NAME: 1, HASH: 2, TOKEN: 3, JOINED: 4, AGE: 5, STATUS: 6, START: 7, ATTEMPT: 8,
  DAYS: 9, OUTDAY: 10, REASON: 11, BEST: 12, BONUS: 13, BONUSDATE: 14, BONUSUSED: 15,
  REFBY: 16, FRIENDS: 17, CURQ: 18, LASTQ: 19, DEVICES: 20, FAST: 21, SHOWNAT: 22, SHOWNQ: 23,
  LASTDATE: 24, PAUSES: 25, COMEBACKS: 26, SEEN: 27, RESTARTDATE: 28,
  SAVED: 29, TOTALANS: 30, REFCREDITED: 31, TODAYDATE: 32, TODAYBEST: 33, DAILYDATE: 34, DAILYIDX: 35,
  DAILYSCORE: 36, DAILYDONE: 37, DAILYSTREAK: 38, DAILYLASTDATE: 39, DAILYBEST: 40 };

const QUESTION_HEADERS = ['ID', 'Difficulty', 'Question', 'A', 'B', 'C', 'D', 'Correct', 'Fun Fact', 'Active?', 'Source'];
const ANSWER_HEADERS = ['Timestamp', 'Player ID', 'Display Name', 'Attempt', 'Day', 'Question Used', 'Choice', 'Correct?', 'Seconds To Answer', 'Mode'];
const HALL_HEADERS = ['Finished On', 'Display Name', 'Attempt', 'Days Survived', 'Comebacks'];
const ADS_HEADERS = ['Show On', 'Headline', 'Product', 'Amazon Link', 'Active?'];
const AMAZON_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

// Starter picks: [Show On, Headline, Product, what to search for on Amazon]
// Show On = a question ID (like Q012), or Knockout, Waiting, or Champion.
const STARTER_ADS = [
  ['Q001', 'Want a closer look at Mars?', 'Beginner telescopes', 'beginner telescope'],
  ['Q002', 'Curious about creepy crawlers?', 'Insect and spider field guides', 'insect spider field guide book'],
  ['Q003', 'Explore every ocean from home', 'Scratch-off world map posters', 'scratch off world map poster'],
  ['Q004', 'Try those 88 keys yourself', 'Beginner keyboards', 'beginner keyboard piano 88 keys'],
  ['Q005', 'Watch photosynthesis on your counter', 'Indoor herb garden kits', 'indoor herb garden kit'],
  ['Q006', 'Go deeper into ancient Egypt', 'Ancient Egypt history books', 'ancient egypt history book'],
  ['Q007', 'Taste the honeybees\' hard work', 'Raw honey samplers', 'raw honey sampler gift set'],
  ['Q008', 'Dreaming of the biggest state?', 'Alaska travel guides', 'alaska travel guide book'],
  ['Q009', 'Find your own gold', 'Gold panning kits', 'gold panning kit'],
  ['Q010', 'More masterpieces to explore', 'Art history books', 'art history book'],
  ['Q011', 'Never mix up a capital again', 'World atlases', 'world atlas book'],
  ['Q012', 'Practicing an instrument at home?', 'No More Practice Wars (book)', 'No More Practice Wars Bruce Bowers'],
  ['Q013', 'Start a rock and mineral collection', 'Rock and mineral collection kits', 'rock and mineral collection kit'],
  ['Q014', 'See how the human body works', 'Human body encyclopedias', 'human body encyclopedia book'],
  ['Q015', 'The story behind the Wall', 'Cold War history books', 'cold war history book'],
  ['Q016', 'Love a good number puzzle?', 'Math puzzle books', 'math puzzle book adults'],
  ['Q017', 'All 118 elements on your wall', 'Periodic table posters', 'periodic table poster'],
  ['Q018', 'Get out on the water', 'Inflatable kayaks', 'inflatable kayak'],
  ['Q019', 'Every bone, labeled', 'Human skeleton models', 'human skeleton model'],
  ['Q020', 'Hear The Four Seasons', 'Vivaldi The Four Seasons recordings', 'Vivaldi Four Seasons CD'],
  ['Q021', 'The universe, explained', 'Cosmos by Carl Sagan', 'Cosmos Carl Sagan book'],
  ['Q022', 'A little piece of Maine', 'Lighthouse jigsaw puzzles', 'lighthouse jigsaw puzzle 1000 piece'],
  ['Q023', 'Learn all 50 states for good', 'United States map puzzles', 'united states map puzzle'],
  ['Q024', 'See Jupiter\'s moons yourself', 'Telescopes for planet viewing', 'telescope for viewing planets'],
  ['Q025', 'All 206 bones in color', 'Anatomy coloring books', 'anatomy coloring book'],
  ['Q026', 'Plan a trip to the land of unicorns', 'Scotland travel guides', 'scotland travel guide book'],
  ['Q027', 'Every coastline on one wall', 'World map posters', 'world map poster'],
  ['Q028', 'Fall in love with octopuses', 'The Soul of an Octopus by Sy Montgomery', 'The Soul of an Octopus Sy Montgomery'],
  ['Q029', 'Visit the smallest country', 'Rome travel guides', 'rome travel guide book'],
  ['Q030', 'The greatest Antarctic survival story', 'Endurance by Alfred Lansing', 'Endurance Shackleton Alfred Lansing'],
  ['Knockout', 'Study up for your comeback', 'Guinness World Records book', 'Guinness World Records book'],
  ['Knockout', 'Study up for your comeback', 'The World Almanac', 'World Almanac and Book of Facts'],
  ['Knockout', 'Study up for your comeback', 'Trivia question books', 'trivia questions book adults'],
  ['Waiting', 'While you wait for your next question', 'Logic puzzle books', 'logic puzzle book adults'],
  ['Waiting', 'While you wait for your next question', 'Trivial Pursuit', 'Trivial Pursuit board game'],
  ['Waiting', 'While you wait for your next question', 'Wits and Wagers', 'Wits and Wagers board game'],
  ['Champion', 'Gifts for the know-it-all in your life', 'Trivia board games', 'trivia board game'],
  ['Champion', 'Gifts for the know-it-all in your life', 'Brain teaser puzzle sets', 'brain teaser puzzle set adults']
];

const REPORT_HEADERS = ['Time', 'Question ID', 'Player ID', 'Display Name', 'Reason', 'Note', 'Status'];
const REPORT_ALERT_AT = 2; // email an alert when a question gets this many open reports
const ALERT_HEADERS = ['Time', 'Alert', 'Player(s)', 'Details', 'Reviewed?', 'Key'];

// Cheat alert thresholds
const CHEAT = {
  FAST_SECONDS: 3,        // a correct answer on a Hard or Very Hard question faster than this is "lightning fast"
  FAST_COUNT: 3,          // alert after this many lightning-fast correct answers
  BURST_FRIENDS: 4,       // alert if one player's link brings in this many sign-ups within 24 hours
  DUD_FRIENDS: 3,         // alert if this many of a player's invited friends never answered a single question
  PIN_FAILS: 5            // alert after this many wrong PIN tries on one account
};

// Question bank: [ID, Difficulty, Question, A, B, C, D, Correct, Fun Fact, Active?, Source]
const STARTER_QUESTIONS = [
  ["Q001", "Easy", "Which planet is known as the Red Planet?", "Venus", "Mars", "Jupiter", "Mercury", "B", "Mars gets its red color from iron oxide, which is basically rust, in its soil.", "Yes", "Holdout"],
  ["Q002", "Easy", "How many legs does a spider have?", "6", "10", "8", "12", "C", "Spiders are arachnids, not insects. Insects have 6 legs.", "Yes", "Holdout"],
  ["Q003", "Easy", "What is the largest ocean on Earth?", "Atlantic", "Indian", "Arctic", "Pacific", "D", "The Pacific covers roughly a third of Earth's surface.", "Yes", "Holdout"],
  ["Q004", "Easy", "Which instrument has 88 keys on a standard modern model?", "Piano", "Violin", "Trumpet", "Harp", "A", "Those 88 keys are made up of 52 white keys and 36 black keys.", "Yes", "Holdout"],
  ["Q005", "Easy", "Which gas do plants take in from the air to make their food?", "Oxygen", "Nitrogen", "Carbon dioxide", "Helium", "C", "Plants release oxygen as a byproduct of photosynthesis.", "Yes", "Holdout"],
  ["Q006", "Easy", "In which country are the Pyramids of Giza?", "Mexico", "Egypt", "Peru", "Greece", "B", "The Great Pyramid was the tallest human-made structure on Earth for thousands of years.", "Yes", "Holdout"],
  ["Q007", "Easy", "How many sides does a hexagon have?", "5", "7", "6", "8", "C", "Honeybees build their honeycomb cells in hexagon shapes.", "Yes", "Holdout"],
  ["Q008", "Medium", "Which U.S. state is the largest by area?", "Texas", "California", "Montana", "Alaska", "D", "Alaska is more than twice the size of Texas.", "Yes", "Holdout"],
  ["Q009", "Medium", "What is the chemical symbol for gold?", "Au", "Ag", "Gd", "Go", "A", "Au comes from the Latin word for gold, aurum.", "Yes", "Holdout"],
  ["Q010", "Medium", "Who painted the Mona Lisa?", "Michelangelo", "Raphael", "Leonardo da Vinci", "Rembrandt", "C", "The Mona Lisa hangs in the Louvre museum in Paris.", "Yes", "Holdout"],
  ["Q011", "Medium", "What is the capital of Australia?", "Sydney", "Canberra", "Melbourne", "Perth", "B", "Canberra was built as a compromise because Sydney and Melbourne both wanted to be the capital.", "Yes", "Holdout"],
  ["Q012", "Medium", "How many strings does a standard violin have?", "4", "5", "6", "8", "A", "A violin's strings are tuned G, D, A, and E.", "Yes", "Holdout"],
  ["Q013", "Medium", "Which of these is the hardest mineral?", "Topaz", "Quartz", "Talc", "Diamond", "D", "Diamonds are made of pure carbon.", "Yes", "Holdout"],
  ["Q014", "Medium", "Which organ in the human body produces insulin?", "Liver", "Pancreas", "Kidney", "Spleen", "B", "The pancreas sits tucked behind the stomach.", "Yes", "Holdout"],
  ["Q015", "Hard", "In what year did the Berlin Wall fall?", "1987", "1991", "1989", "1993", "C", "The wall came down on November 9, 1989.", "Yes", "Holdout"],
  ["Q016", "Hard", "What is the smallest prime number?", "0", "1", "2", "3", "C", "2 is also the only even prime number.", "Yes", "Holdout"],
  ["Q017", "Hard", "Which element has atomic number 1?", "Helium", "Hydrogen", "Lithium", "Oxygen", "B", "Hydrogen is the most abundant element in the universe.", "Yes", "Holdout"],
  ["Q018", "Hard", "Which of these countries is known for having the most lakes?", "Russia", "United States", "Finland", "Canada", "D", "Canada is often said to have more lakes than the rest of the world combined.", "Yes", "Holdout"],
  ["Q019", "Hard", "What is the longest bone in the human body?", "Femur", "Tibia", "Humerus", "Pelvis", "A", "The femur, or thigh bone, is roughly a quarter of a person's height.", "Yes", "Holdout"],
  ["Q020", "Hard", "Which composer wrote The Four Seasons?", "Bach", "Handel", "Vivaldi", "Mozart", "C", "Vivaldi was also a priest, nicknamed the Red Priest because of his red hair.", "Yes", "Holdout"],
  ["Q021", "Hard", "Roughly how fast does light travel?", "18,600 miles per second", "186,000 miles per second", "1,860,000 miles per second", "18,600,000 miles per second", "B", "Light from the Sun takes about 8 minutes to reach Earth.", "Yes", "Holdout"],
  ["Q022", "Very Hard", "Which is the only U.S. state whose name has just one syllable?", "Utah", "Iowa", "Ohio", "Maine", "D", "Maine is also the only state that borders exactly one other state, New Hampshire.", "Yes", "Holdout"],
  ["Q023", "Very Hard", "Which letter does not appear in the name of any U.S. state?", "Q", "Z", "X", "J", "A", "J is in New Jersey, X is in Texas, and Z is in Arizona.", "Yes", "Holdout"],
  ["Q024", "Very Hard", "Which planet has the shortest day?", "Earth", "Saturn", "Jupiter", "Mercury", "C", "Jupiter spins all the way around in about 10 hours.", "Yes", "Holdout"],
  ["Q025", "Very Hard", "How many bones are in the typical adult human body?", "196", "206", "216", "226", "B", "Babies are born with around 270 bones, and many fuse together as they grow.", "Yes", "Holdout"],
  ["Q026", "Very Hard", "What is the national animal of Scotland?", "Lion", "Stag", "Eagle", "Unicorn", "D", "The unicorn has appeared on Scotland's royal coat of arms for centuries.", "Yes", "Holdout"],
  ["Q027", "Very Hard", "Which of these countries has the longest coastline?", "Russia", "Australia", "Canada", "Indonesia", "C", "Canada's coastline touches three oceans: the Atlantic, Pacific, and Arctic.", "Yes", "Holdout"],
  ["Q028", "Very Hard", "How many hearts does an octopus have?", "2", "3", "1", "4", "B", "Two hearts pump blood to the gills, and the third pumps it to the rest of the body.", "Yes", "Holdout"],
  ["Q029", "Very Hard", "What is the smallest country in the world by area?", "Monaco", "Vatican City", "San Marino", "Liechtenstein", "B", "Vatican City covers only about 0.17 square miles.", "Yes", "Holdout"],
  ["Q030", "Very Hard", "Counting both hot and cold deserts, what is the largest desert on Earth?", "Sahara", "Gobi", "Arabian", "Antarctic", "D", "A desert is defined by how little precipitation it gets, not by heat, so frozen Antarctica counts.", "Yes", "Holdout"],
  ["Q031", "Medium", "Which gas makes up most of Earth's air?", "Oxygen", "Nitrogen", "Argon", "Carbon dioxide", "B", "Nitrogen makes up about 78 percent of the air we breathe.", "Yes", "Holdout"],
  ["Q032", "Hard", "Which blood type is known as the universal donor for red blood cells?", "AB positive", "A negative", "O negative", "B positive", "C", "Because it can go to almost anyone, O negative is often used in emergencies.", "Yes", "Holdout"],
  ["Q033", "Medium", "How many half steps (semitones) are in one octave?", "8", "10", "12", "14", "C", "That is why the pattern of black and white keys on a piano repeats every 12 keys.", "Yes", "Holdout"],
  ["Q034", "Medium", "Which metal is a liquid at room temperature?", "Lead", "Mercury", "Tin", "Aluminum", "B", "Mercury was once widely used in thermometers.", "Yes", "Holdout"],
  ["Q035", "Easy", "What is the capital of Canada?", "Toronto", "Montreal", "Vancouver", "Ottawa", "D", "Queen Victoria chose Ottawa as the capital in 1857.", "Yes", "Holdout"],
  ["Q036", "Very Hard", "How many official time zones does China use?", "1", "3", "4", "5", "A", "China stretches across about five geographic time zones but runs everything on Beijing Time.", "Yes", "Holdout"],
  ["Q037", "Easy", "What color do you get by mixing blue and yellow paint?", "Green", "Purple", "Orange", "Brown", "A", "Red, yellow, and blue are the traditional primary colors used in painting.", "Yes", "Holdout"],
  ["Q038", "Easy", "How many continents are usually taught in U.S. schools?", "5", "6", "7", "8", "C", "Some countries teach 5 or 6 continents by counting the Americas, or Europe and Asia, as one.", "Yes", "Holdout"],
  ["Q039", "Easy", "What is the largest planet in our solar system?", "Saturn", "Jupiter", "Neptune", "Earth", "B", "More than 1,000 Earths could fit inside Jupiter.", "Yes", "Holdout"],
  ["Q040", "Easy", "At what temperature does water freeze in degrees Fahrenheit?", "0", "100", "32", "212", "C", "At sea level, water boils at 212 degrees Fahrenheit.", "Yes", "Holdout"],
  ["Q041", "Easy", "Which animal is often called the King of the Jungle?", "Tiger", "Elephant", "Lion", "Gorilla", "C", "Despite the nickname, most lions live on grasslands and savannas, not in jungles.", "Yes", "Holdout"],
  ["Q042", "Easy", "How many days are in a leap year?", "364", "365", "366", "367", "C", "Leap years add February 29 to keep the calendar in step with Earth's trip around the Sun.", "Yes", "Holdout"],
  ["Q043", "Easy", "What is the capital of France?", "Paris", "Lyon", "Marseille", "Nice", "A", "The Eiffel Tower was built for the 1889 World's Fair in Paris.", "Yes", "Holdout"],
  ["Q044", "Easy", "Which bird is a well-known symbol of peace?", "Eagle", "Dove", "Crow", "Owl", "B", "Doves and pigeons belong to the same bird family.", "Yes", "Holdout"],
  ["Q045", "Easy", "What do honeybees make?", "Silk", "Maple syrup", "Cheese", "Honey", "D", "A single honeybee makes only about one-twelfth of a teaspoon of honey in its whole life.", "Yes", "Holdout"],
  ["Q046", "Easy", "Which ocean lies between the United States and Europe?", "Pacific", "Atlantic", "Indian", "Arctic", "B", "The Atlantic is the second-largest ocean on Earth.", "Yes", "Holdout"],
  ["Q047", "Easy", "What is the tallest animal in the world?", "Giraffe", "Elephant", "Camel", "Moose", "A", "A giraffe's long neck has seven bones, the same number as a human neck.", "Yes", "Holdout"],
  ["Q048", "Easy", "Which planet is closest to the Sun?", "Venus", "Mars", "Mercury", "Earth", "C", "A year on Mercury lasts only 88 Earth days.", "Yes", "Holdout"],
  ["Q049", "Easy", "How many players does one soccer team have on the field at a time?", "9", "10", "12", "11", "D", "That count of 11 includes the goalkeeper.", "Yes", "Holdout"],
  ["Q050", "Easy", "What is the main ingredient in guacamole?", "Avocado", "Tomato", "Cucumber", "Pea", "A", "Botanically, an avocado is a large berry with a single seed.", "Yes", "Holdout"],
  ["Q051", "Easy", "Which month has the fewest days?", "January", "February", "April", "November", "B", "February has 28 days, or 29 in a leap year.", "Yes", "Holdout"],
  ["Q052", "Easy", "Which gas in the air do people need to breathe to stay alive?", "Oxygen", "Helium", "Hydrogen", "Neon", "A", "The air around us is only about 21 percent oxygen.", "Yes", "Holdout"],
  ["Q053", "Easy", "In which country is the Great Wall?", "China", "Japan", "India", "Korea", "A", "Despite the popular myth, the Great Wall cannot be seen with the naked eye from the Moon.", "Yes", "Holdout"],
  ["Q054", "Easy", "What is the largest animal on Earth?", "African elephant", "Blue whale", "Giraffe", "Hippopotamus", "B", "A blue whale's heart is roughly the size of a small car.", "Yes", "Holdout"],
  ["Q055", "Easy", "Which instrument usually has six strings and is often strummed?", "Violin", "Harp", "Cello", "Guitar", "D", "Some guitars have 12 strings, set up in pairs.", "Yes", "Holdout"],
  ["Q056", "Easy", "What do you call a shape with four equal sides and four right angles?", "Triangle", "Square", "Pentagon", "Octagon", "B", "A square also counts as a rectangle and a rhombus.", "Yes", "Holdout"],
  ["Q057", "Easy", "Which famous ship sank in 1912 after hitting an iceberg?", "Lusitania", "Mayflower", "Titanic", "Britannic", "C", "The Titanic was on its very first voyage, from Southampton, England, to New York.", "Yes", "Holdout"],
  ["Q058", "Easy", "What is the capital of the United States?", "New York City", "Washington, D.C.", "Philadelphia", "Boston", "B", "Both New York City and Philadelphia served as the capital before Washington, D.C.", "Yes", "Holdout"],
  ["Q059", "Easy", "How many legs does an insect have?", "6", "4", "8", "10", "A", "Every insect body has three main parts: the head, thorax, and abdomen.", "Yes", "Holdout"],
  ["Q060", "Easy", "At what temperature does water boil in degrees Celsius at sea level?", "50", "90", "100", "120", "C", "Water boils at a lower temperature high in the mountains because the air pressure is lower.", "Yes", "Holdout"],
  ["Q061", "Easy", "Finish the saying: An apple a day keeps the ___ away.", "Dentist", "Doctor", "Teacher", "Rain", "B", "An early version of the saying appeared in Wales in the 1860s.", "Yes", "Holdout"],
  ["Q062", "Easy", "Who was the first President of the United States?", "Thomas Jefferson", "John Adams", "George Washington", "Abraham Lincoln", "C", "George Washington is the only president who never lived in the White House.", "Yes", "Holdout"],
  ["Q063", "Easy", "How many colors are in a rainbow, as traditionally listed?", "5", "6", "7", "8", "C", "The traditional list is red, orange, yellow, green, blue, indigo, and violet.", "Yes", "Holdout"],
  ["Q064", "Easy", "What is the largest country in the world by area?", "Canada", "China", "United States", "Russia", "D", "Russia covers more than one-ninth of all the land on Earth.", "Yes", "Holdout"],
  ["Q065", "Easy", "Which of your senses depends most on your nose?", "Taste", "Smell", "Touch", "Hearing", "B", "Much of what we think of as taste actually comes from smell.", "Yes", "Holdout"],
  ["Q066", "Easy", "What does a caterpillar turn into?", "A beetle", "A spider", "A butterfly or moth", "A dragonfly", "C", "Butterflies form a chrysalis, while many moths spin a silk cocoon.", "Yes", "Holdout"],
  ["Q067", "Medium", "What is the chemical symbol for sodium?", "So", "Sd", "Na", "Sn", "C", "Na comes from natrium, the Latin name for sodium.", "Yes", "Holdout"],
  ["Q068", "Medium", "Which planet is famous for its Great Red Spot?", "Mars", "Jupiter", "Saturn", "Neptune", "B", "The Great Red Spot is a giant storm wider than Earth.", "Yes", "Holdout"],
  ["Q069", "Medium", "Who wrote Romeo and Juliet?", "Charles Dickens", "Jane Austen", "Mark Twain", "William Shakespeare", "D", "The play is set in the Italian city of Verona.", "Yes", "Holdout"],
  ["Q070", "Medium", "What is the smallest planet in our solar system?", "Mercury", "Mars", "Venus", "Earth", "A", "Pluto used to be called the smallest planet until it was reclassified as a dwarf planet in 2006.", "Yes", "Holdout"],
  ["Q071", "Medium", "What is the capital of Japan?", "Kyoto", "Osaka", "Tokyo", "Hiroshima", "C", "Kyoto was Japan's capital for more than 1,000 years before Tokyo.", "Yes", "Holdout"],
  ["Q072", "Medium", "Which country gave the Statue of Liberty to the United States?", "France", "England", "Spain", "Italy", "A", "The Statue of Liberty was dedicated in 1886.", "Yes", "Holdout"],
  ["Q073", "Medium", "What is the longest river in South America?", "Amazon", "Orinoco", "Parana", "Magdalena", "A", "The Amazon carries more water than any other river on Earth.", "Yes", "Holdout"],
  ["Q074", "Medium", "In what year did people first walk on the Moon?", "1965", "1969", "1972", "1959", "B", "Neil Armstrong and Buzz Aldrin landed on the Moon on July 20, 1969.", "Yes", "Holdout"],
  ["Q075", "Medium", "Which type of blood cell helps the body fight infections?", "Red blood cells", "White blood cells", "Platelets", "Plasma", "B", "Platelets are the cells that help blood clot when you get a cut.", "Yes", "Holdout"],
  ["Q076", "Medium", "Which language has the most native speakers in the world?", "English", "Spanish", "Mandarin Chinese", "Hindi", "C", "If you count people who speak it as a second language, English has the most speakers overall.", "Yes", "Holdout"],
  ["Q077", "Medium", "Which metal has the chemical symbol Fe?", "Lead", "Fluorine", "Tin", "Iron", "D", "Fe comes from ferrum, the Latin word for iron.", "Yes", "Holdout"],
  ["Q078", "Medium", "How many strings does a standard cello have?", "4", "5", "6", "3", "A", "A cello's strings are tuned C, G, D, and A.", "Yes", "Holdout"],
  ["Q079", "Medium", "Which painter famously cut off part of his own ear?", "Vincent van Gogh", "Pablo Picasso", "Claude Monet", "Salvador Dali", "A", "Van Gogh sold very few paintings during his lifetime.", "Yes", "Holdout"],
  ["Q080", "Medium", "What is the Sun mostly made of?", "Oxygen", "Helium", "Hydrogen", "Carbon", "C", "About three-quarters of the Sun's mass is hydrogen.", "Yes", "Holdout"],
  ["Q081", "Medium", "Which U.S. state is nicknamed the Sunshine State?", "California", "Arizona", "Hawaii", "Florida", "D", "Florida is also home to the Kennedy Space Center.", "Yes", "Holdout"],
  ["Q082", "Medium", "Which of these is the largest organ of the human body?", "Liver", "Brain", "Skin", "Lungs", "C", "An adult's skin weighs about 8 pounds.", "Yes", "Holdout"],
  ["Q083", "Medium", "Which scientist developed the theory of relativity?", "Isaac Newton", "Albert Einstein", "Galileo Galilei", "Nikola Tesla", "B", "Einstein's Nobel Prize in 1921 was for the photoelectric effect, not for relativity.", "Yes", "Holdout"],
  ["Q084", "Medium", "What is the capital of Italy?", "Rome", "Milan", "Venice", "Florence", "A", "Vatican City, the world's smallest country, sits inside Rome.", "Yes", "Holdout"],
  ["Q085", "Medium", "Which planet rotates on its side?", "Uranus", "Neptune", "Saturn", "Venus", "A", "Uranus is tilted about 98 degrees, so it spins almost on its side.", "Yes", "Holdout"],
  ["Q086", "Medium", "What is a group of lions called?", "A pride", "A pack", "A herd", "A flock", "A", "A pride usually includes several related females, their cubs, and a few males.", "Yes", "Holdout"],
  ["Q087", "Medium", "In what year did World War II end?", "1943", "1944", "1945", "1946", "C", "The war ended in Europe in May 1945 and in the Pacific in September 1945.", "Yes", "Holdout"],
  ["Q088", "Medium", "How many players from one basketball team are on the court at a time?", "4", "6", "7", "5", "D", "Basketball was invented by James Naismith in 1891 using peach baskets.", "Yes", "Holdout"],
  ["Q089", "Medium", "What is the currency of Japan?", "Yuan", "Won", "Yen", "Ringgit", "C", "The yuan is China's currency, and the won is South Korea's.", "Yes", "Holdout"],
  ["Q090", "Medium", "Which mountain is the tallest above sea level?", "K2", "Kilimanjaro", "Mount Everest", "Denali", "C", "Mount Everest sits on the border between Nepal and China.", "Yes", "Holdout"],
  ["Q091", "Medium", "How many degrees are in a right angle?", "45", "90", "180", "360", "B", "The angles inside any triangle always add up to 180 degrees.", "Yes", "Holdout"],
  ["Q092", "Medium", "Kangaroos are native to which of these countries?", "Australia", "New Zealand", "South Africa", "Argentina", "A", "A baby kangaroo is called a joey.", "Yes", "Holdout"],
  ["Q093", "Medium", "What color is a ruby?", "Blue", "Green", "Red", "Purple", "C", "Rubies and sapphires are the same mineral, called corundum.", "Yes", "Holdout"],
  ["Q094", "Medium", "Who painted the ceiling of the Sistine Chapel?", "Leonardo da Vinci", "Michelangelo", "Raphael", "Botticelli", "B", "Michelangelo spent about four years painting the ceiling, from 1508 to 1512.", "Yes", "Holdout"],
  ["Q095", "Medium", "In which city is the ancient Colosseum?", "Athens", "Rome", "Istanbul", "Paris", "B", "The Colosseum could hold around 50,000 spectators.", "Yes", "Holdout"],
  ["Q096", "Medium", "What is the square root of 144?", "12", "10", "11", "14", "A", "144 is also called a gross, meaning a dozen dozens.", "Yes", "Holdout"],
  ["Q097", "Hard", "How many bones are in the middle ear?", "1", "2", "3", "4", "C", "The hammer, anvil, and stirrup are the smallest bones in the human body.", "Yes", "Holdout"],
  ["Q098", "Hard", "Which is the hottest planet in our solar system?", "Mercury", "Venus", "Mars", "Jupiter", "B", "Venus's thick carbon dioxide atmosphere traps heat, making it even hotter than Mercury.", "Yes", "Holdout"],
  ["Q099", "Hard", "What is the capital of Turkey?", "Ankara", "Istanbul", "Izmir", "Antalya", "A", "Istanbul is Turkey's largest city, but Ankara has been the capital since 1923.", "Yes", "Holdout"],
  ["Q100", "Hard", "Who wrote the novel 1984?", "Aldous Huxley", "Ray Bradbury", "George Orwell", "H. G. Wells", "C", "George Orwell's real name was Eric Arthur Blair.", "Yes", "Holdout"],
  ["Q101", "Hard", "Which element has the chemical symbol K?", "Krypton", "Potassium", "Calcium", "Carbon", "B", "K comes from kalium, the Latin name for potassium.", "Yes", "Holdout"],
  ["Q102", "Hard", "In what year did Christopher Columbus first reach the Americas?", "1492", "1498", "1507", "1520", "A", "Columbus sailed with three ships: the Nina, the Pinta, and the Santa Maria.", "Yes", "Holdout"],
  ["Q103", "Hard", "How many symphonies did Beethoven complete?", "5", "7", "9", "12", "C", "Beethoven was almost completely deaf when he wrote his Ninth Symphony.", "Yes", "Holdout"],
  ["Q104", "Hard", "What is the longest river in Africa?", "Congo", "Niger", "Nile", "Zambezi", "C", "The Nile flows north and empties into the Mediterranean Sea.", "Yes", "Holdout"],
  ["Q105", "Hard", "Which planet has a moon named Titan?", "Jupiter", "Uranus", "Neptune", "Saturn", "D", "Titan is the only moon known to have a thick atmosphere.", "Yes", "Holdout"],
  ["Q106", "Hard", "What is the only mammal that can truly fly?", "Flying squirrel", "Sugar glider", "Bat", "Colugo", "C", "Flying squirrels and sugar gliders glide, but they can't truly fly.", "Yes", "Holdout"],
  ["Q107", "Hard", "Who was the first woman to win a Nobel Prize?", "Marie Curie", "Florence Nightingale", "Rosalind Franklin", "Jane Addams", "A", "Marie Curie won two Nobel Prizes, one in physics and one in chemistry.", "Yes", "Holdout"],
  ["Q108", "Hard", "How many time zones does Russia have?", "7", "9", "11", "13", "C", "When it is morning in western Russia, it is already evening in the far east.", "Yes", "Holdout"],
  ["Q109", "Hard", "What is the capital of Brazil?", "Brasilia", "Rio de Janeiro", "Sao Paulo", "Salvador", "A", "Brasilia was built from scratch and became the capital in 1960.", "Yes", "Holdout"],
  ["Q110", "Hard", "Which composer wrote the Moonlight Sonata?", "Mozart", "Beethoven", "Chopin", "Bach", "B", "The name Moonlight was given by a music critic after Beethoven died.", "Yes", "Holdout"],
  ["Q111", "Hard", "What is the chemical symbol for silver?", "Si", "Sv", "Ag", "Au", "C", "Ag comes from argentum, the Latin word for silver.", "Yes", "Holdout"],
  ["Q112", "Hard", "Which ancient wonder stood in Alexandria, Egypt?", "The Colossus", "The Lighthouse", "The Hanging Gardens", "The Temple of Artemis", "B", "The Lighthouse of Alexandria was one of the tallest structures in the world for centuries.", "Yes", "Holdout"],
  ["Q113", "Hard", "How many players from one baseball team are on the field while their team is on defense?", "8", "10", "11", "9", "D", "Those 9 players include the pitcher and the catcher.", "Yes", "Holdout"],
  ["Q114", "Hard", "Which planet takes the longest to spin around once?", "Venus", "Mercury", "Mars", "Jupiter", "A", "A single day on Venus is longer than its whole year.", "Yes", "Holdout"],
  ["Q115", "Hard", "What is the heaviest organ inside the human body?", "Liver", "Heart", "Lungs", "Kidneys", "A", "The liver can grow back after part of it is removed.", "Yes", "Holdout"],
  ["Q116", "Hard", "In which country did the ancient Olympic Games begin?", "Italy", "Greece", "Egypt", "France", "B", "The ancient Games began in Olympia around 776 BC.", "Yes", "Holdout"],
  ["Q117", "Hard", "Who received the first U.S. patent for the telephone?", "Thomas Edison", "Nikola Tesla", "Alexander Graham Bell", "Samuel Morse", "C", "Bell received the telephone patent in 1876.", "Yes", "Holdout"],
  ["Q118", "Hard", "What is the main ingredient in traditional hummus?", "Lentils", "Chickpeas", "Black beans", "Green peas", "B", "Traditional hummus also includes tahini, a paste made from sesame seeds.", "Yes", "Holdout"],
  ["Q119", "Hard", "How many sides does a dodecagon have?", "12", "10", "14", "20", "A", "Dodeca comes from the Greek word for twelve.", "Yes", "Holdout"],
  ["Q120", "Hard", "What is the largest moon in our solar system?", "Titan", "Ganymede", "Europa", "Earth's Moon", "B", "Ganymede, one of Jupiter's moons, is bigger than the planet Mercury.", "Yes", "Holdout"],
  ["Q121", "Hard", "Which physicist wrote A Brief History of Time?", "Carl Sagan", "Neil deGrasse Tyson", "Richard Feynman", "Stephen Hawking", "D", "The book was first published in 1988.", "Yes", "Holdout"],
  ["Q122", "Hard", "What city is the seat of Switzerland's government?", "Zurich", "Geneva", "Bern", "Basel", "C", "Switzerland officially calls Bern its federal city rather than its capital.", "Yes", "Holdout"],
  ["Q123", "Hard", "Phobos is a moon of which planet?", "Mars", "Jupiter", "Venus", "Saturn", "A", "Phobos is slowly spiraling closer to Mars.", "Yes", "Holdout"],
  ["Q124", "Hard", "What is the tallest uninterrupted waterfall in the world?", "Niagara Falls", "Victoria Falls", "Angel Falls", "Iguazu Falls", "C", "Angel Falls in Venezuela drops about 3,200 feet.", "Yes", "Holdout"],
  ["Q125", "Hard", "How many teeth does a typical adult have, counting wisdom teeth?", "28", "30", "32", "36", "C", "Many adults have some or all of their four wisdom teeth removed.", "Yes", "Holdout"],
  ["Q126", "Hard", "Who painted The Starry Night?", "Claude Monet", "Vincent van Gogh", "Rembrandt", "Paul Cezanne", "B", "Van Gogh painted it in 1889 while staying at an asylum in southern France.", "Yes", "Holdout"],
  ["Q127", "Very Hard", "What is the smallest bone in the human body?", "Incus", "Stapes", "Malleus", "Coccyx", "B", "The stapes, or stirrup, is about the size of a grain of rice.", "Yes", "Holdout"],
  ["Q128", "Very Hard", "What is the capital of New Zealand?", "Auckland", "Christchurch", "Wellington", "Queenstown", "C", "Wellington is the southernmost capital city of any country.", "Yes", "Holdout"],
  ["Q129", "Very Hard", "How many strings does a standard concert pedal harp have?", "36", "41", "47", "52", "C", "Harpists use seven foot pedals to change the pitch of the strings.", "Yes", "Holdout"],
  ["Q130", "Very Hard", "In what year did the American Civil War end?", "1861", "1863", "1865", "1868", "C", "General Lee surrendered at Appomattox Court House in April 1865.", "Yes", "Holdout"],
  ["Q131", "Very Hard", "Who composed the music for the ballet The Nutcracker?", "Rachmaninoff", "Stravinsky", "Prokofiev", "Tchaikovsky", "D", "The Nutcracker premiered in St. Petersburg in 1892.", "Yes", "Holdout"],
  ["Q132", "Very Hard", "What is the chemical symbol for tungsten?", "T", "Tu", "W", "Tn", "C", "W comes from wolfram, another name for tungsten.", "Yes", "Holdout"],
  ["Q133", "Very Hard", "Which continent has no permanent human residents?", "Australia", "Antarctica", "Europe", "South America", "B", "The only people living in Antarctica are scientists and staff who stay for a few months at a time.", "Yes", "Holdout"],
  ["Q134", "Very Hard", "What is the largest species of shark?", "Great white shark", "Whale shark", "Basking shark", "Tiger shark", "B", "Despite its size, the whale shark eats mostly plankton.", "Yes", "Holdout"],
  ["Q135", "Very Hard", "Which U.S. state has the longest coastline?", "California", "Florida", "Alaska", "Hawaii", "C", "Alaska has more coastline than all the other states combined.", "Yes", "Holdout"],
  ["Q136", "Very Hard", "Which planet was found by math before anyone saw it in a telescope?", "Uranus", "Neptune", "Saturn", "Mars", "B", "Astronomers spotted Neptune in 1846, right where the math said it would be.", "Yes", "Holdout"],
  ["Q137", "Very Hard", "Who wrote The Canterbury Tales?", "John Milton", "Edmund Spenser", "Geoffrey Chaucer", "Thomas Malory", "C", "Chaucer wrote The Canterbury Tales in the late 1300s.", "Yes", "Holdout"],
  ["Q138", "Very Hard", "What is the largest lake in Africa?", "Lake Tanganyika", "Lake Malawi", "Lake Chad", "Lake Victoria", "D", "Lake Victoria is shared by Uganda, Kenya, and Tanzania.", "Yes", "Holdout"],
  ["Q139", "Very Hard", "Where is the deepest known point in Earth's oceans?", "Puerto Rico Trench", "Mariana Trench", "Java Trench", "Tonga Trench", "B", "The deepest part of the Mariana Trench, called the Challenger Deep, is nearly 7 miles down.", "Yes", "Holdout"],
  ["Q140", "Very Hard", "How many official national languages does Switzerland have?", "2", "3", "4", "5", "C", "They are German, French, Italian, and Romansh.", "Yes", "Holdout"],
  ["Q141", "Very Hard", "Which number, written in English, has its letters in alphabetical order?", "Fifty", "Seventy", "Eighty", "Forty", "D", "F, O, R, T, Y: each letter comes later in the alphabet than the one before it.", "Yes", "Holdout"],
  ["Q142", "Very Hard", "Who was the second person to walk on the Moon?", "Michael Collins", "Pete Conrad", "Buzz Aldrin", "Alan Shepard", "C", "Michael Collins stayed in orbit, flying the command module, while the others walked on the Moon.", "Yes", "Holdout"],
  ["Q143", "Very Hard", "What is the most common element in Earth's crust?", "Silicon", "Oxygen", "Iron", "Aluminum", "B", "Most of that oxygen is locked inside rocks and minerals.", "Yes", "Holdout"],
  ["Q144", "Very Hard", "How many light and dark squares make up a standard chessboard?", "48", "56", "64", "72", "C", "Count every size of square, from 1-by-1 up to the full 8-by-8 board, and there are 204.", "Yes", "Holdout"],
  ["Q145", "Very Hard", "Which musical closed in 2023 as the longest-running show in Broadway history?", "Chicago", "The Lion King", "The Phantom of the Opera", "Cats", "C", "The Phantom of the Opera ran on Broadway for 35 years, from 1988 to 2023.", "Yes", "Holdout"],
  ["Q146", "Very Hard", "Which planet has the fastest winds in the solar system?", "Jupiter", "Saturn", "Neptune", "Uranus", "C", "Winds on Neptune can blow faster than 1,000 miles per hour.", "Yes", "Holdout"],
  ["Q147", "Very Hard", "Which bird can fly backward?", "Swift", "Kingfisher", "Sparrow", "Hummingbird", "D", "Some hummingbirds beat their wings more than 50 times per second.", "Yes", "Holdout"],
  ["Q148", "Very Hard", "What is the capital of Morocco?", "Casablanca", "Marrakesh", "Rabat", "Fez", "C", "Casablanca is Morocco's largest city.", "Yes", "Holdout"],
  ["Q149", "Very Hard", "How many moons does Mars have?", "0", "1", "2", "3", "C", "The two moons of Mars are named Phobos and Deimos.", "Yes", "Holdout"],
  ["Q150", "Very Hard", "Besides mercury, which element is a liquid at room temperature?", "Chlorine", "Bromine", "Iodine", "Fluorine", "B", "Bromine is a reddish-brown liquid with a strong smell.", "Yes", "Holdout"],
  ["Q151", "Very Hard", "What is the longest river in Europe?", "Danube", "Rhine", "Volga", "Dnieper", "C", "The Volga flows through Russia and empties into the Caspian Sea.", "Yes", "Holdout"],
  ["Q152", "Very Hard", "How many amendments make up the U.S. Bill of Rights?", "5", "10", "12", "27", "B", "The Constitution has 27 amendments in total.", "Yes", "Holdout"],
  ["Q153", "Very Hard", "What is the tallest mountain in Africa?", "Mount Kenya", "Mount Toubkal", "Mount Stanley", "Mount Kilimanjaro", "D", "Kilimanjaro is a dormant volcano in Tanzania.", "Yes", "Holdout"],
  ["Q154", "Very Hard", "Which planet in our solar system is the densest?", "Jupiter", "Earth", "Mercury", "Venus", "B", "Saturn is the least dense planet. It is less dense than water.", "Yes", "Holdout"],
  ["Q155", "Very Hard", "What is the largest living bird?", "Emu", "Albatross", "Ostrich", "Cassowary", "C", "An ostrich egg is the largest egg laid by any living bird.", "Yes", "Holdout"],
  ["Q156", "Very Hard", "Which mathematician wrote the famous 'last theorem' that went unproven for more than 350 years?", "Leonhard Euler", "Pierre de Fermat", "Carl Friedrich Gauss", "Blaise Pascal", "B", "Andrew Wiles finally proved it in the mid-1990s.", "Yes", "Holdout"],
  ["Q157", "Easy", "How many sides does a pentagon have?", "4", "5", "6", "8", "B", "The Pentagon building near Washington, D.C., has five sides.", "Yes", "Holdout"],
  ["Q158", "Easy", "Which animal is famous for building dams in rivers?", "Otter", "Muskrat", "Raccoon", "Beaver", "D", "A beaver's front teeth never stop growing.", "Yes", "Holdout"],
  ["Q159", "Easy", "In which direction does the Sun rise?", "North", "East", "South", "West", "B", "It rises exactly due east only around the spring and fall equinoxes.", "Yes", "Holdout"],
  ["Q160", "Easy", "How many hours are in a day?", "12", "24", "20", "36", "B", "Measured against the stars, one spin of Earth takes about 23 hours and 56 minutes.", "Yes", "Holdout"],
  ["Q161", "Easy", "What is a baby cat called?", "Kitten", "Pup", "Cub", "Calf", "A", "Kittens are born with their eyes closed.", "Yes", "Holdout"],
  ["Q162", "Easy", "What is the closest star to Earth?", "Polaris", "Sirius", "The Sun", "Betelgeuse", "C", "The next closest star, Proxima Centauri, is about 4.2 light-years away.", "Yes", "Holdout"],
  ["Q163", "Easy", "How many wheels does a tricycle have?", "2", "4", "5", "3", "D", "Tri means three, as in triangle and tripod.", "Yes", "Holdout"],
  ["Q164", "Easy", "Which yellow fruit is long and curved?", "Apple", "Grape", "Cherry", "Banana", "D", "Botanically, bananas are berries.", "Yes", "Holdout"],
  ["Q165", "Easy", "Which season comes after summer?", "Winter", "Spring", "Monsoon", "Fall (autumn)", "D", "In the Southern Hemisphere, the seasons are flipped.", "Yes", "Holdout"],
  ["Q166", "Easy", "What is H2O more commonly called?", "Salt", "Water", "Sugar", "Air", "B", "Each water molecule has two hydrogen atoms and one oxygen atom.", "Yes", "Holdout"],
  ["Q167", "Easy", "What do you call a group of fish swimming together?", "A flock", "A herd", "A pack", "A school", "D", "Fish in a school often move in sync to confuse predators.", "Yes", "Holdout"],
  ["Q168", "Easy", "Which shape is round and has no corners?", "Square", "Triangle", "Rectangle", "Circle", "D", "The distance around a circle is called its circumference.", "Yes", "Holdout"],
  ["Q169", "Easy", "What is the capital of England?", "London", "Manchester", "Liverpool", "Oxford", "A", "Big Ben is the nickname of the great bell, not the clock tower.", "Yes", "Holdout"],
  ["Q170", "Easy", "What color do you get by mixing red and white paint?", "Purple", "Orange", "Brown", "Pink", "D", "Adding white to any color makes a lighter version called a tint.", "Yes", "Holdout"],
  ["Q171", "Easy", "What is a baby dog called?", "Kitten", "Puppy", "Foal", "Lamb", "B", "Puppies are born with their eyes and ears closed.", "Yes", "Holdout"],
  ["Q172", "Easy", "Which planet is famous for its bright rings?", "Mars", "Saturn", "Mercury", "Venus", "B", "Saturn's rings are made mostly of chunks of ice.", "Yes", "Holdout"],
  ["Q173", "Easy", "How many days are in a week?", "5", "7", "6", "8", "B", "Several days of the week are named after Norse gods, like Thursday after Thor.", "Yes", "Holdout"],
  ["Q174", "Easy", "Which holiday is celebrated on December 25?", "Christmas", "Halloween", "Thanksgiving", "Easter", "A", "Many countries also celebrate Boxing Day on December 26.", "Yes", "Holdout"],
  ["Q175", "Easy", "What is the main language spoken in Mexico?", "Spanish", "Portuguese", "French", "English", "A", "Mexico has more Spanish speakers than any other country.", "Yes", "Holdout"],
  ["Q176", "Easy", "How many minutes are in an hour?", "60", "30", "90", "100", "A", "The 60-minute hour comes from ancient Babylonian counting, which was based on 60.", "Yes", "Holdout"],
  ["Q177", "Easy", "What color is an emerald?", "Red", "Blue", "Green", "Yellow", "C", "Emeralds are a green form of the mineral beryl.", "Yes", "Holdout"],
  ["Q178", "Easy", "Which bird is famous for fanning out a colorful tail?", "Crow", "Peacock", "Robin", "Pigeon", "B", "Only the males, called peacocks, have the big colorful tails.", "Yes", "Holdout"],
  ["Q179", "Easy", "What do plants need from the Sun to make their food?", "Light", "Sound", "Wind", "Snow", "A", "The process plants use is called photosynthesis.", "Yes", "Holdout"],
  ["Q180", "Easy", "Bamboo is a giant type of what plant?", "Tree", "Fern", "Grass", "Cactus", "C", "Some bamboo can grow nearly 3 feet in a single day.", "Yes", "Holdout"],
  ["Q181", "Easy", "How many strings does a standard ukulele have?", "3", "4", "6", "8", "B", "The ukulele grew popular in Hawaii in the late 1800s.", "Yes", "Holdout"],
  ["Q182", "Easy", "What is the largest land animal?", "African elephant", "Rhinoceros", "Hippopotamus", "Giraffe", "A", "An adult male African elephant can weigh more than 6 tons.", "Yes", "Holdout"],
  ["Q183", "Easy", "What do bees collect from flowers to make honey?", "Pollen", "Nectar", "Sap", "Dew", "B", "Bees also collect pollen, but they use it as food, not to make honey.", "Yes", "Holdout"],
  ["Q184", "Easy", "Which is the coldest continent?", "Asia", "Antarctica", "Europe", "North America", "B", "The coldest air temperature ever measured, about minus 128.6 degrees Fahrenheit, was in Antarctica.", "Yes", "Holdout"],
  ["Q185", "Easy", "Which toy bricks were invented in Denmark?", "LEGO", "K'NEX", "Lincoln Logs", "Tinkertoy", "A", "LEGO comes from the Danish words leg godt, meaning play well.", "Yes", "Holdout"],
  ["Q186", "Easy", "How many cents is a U.S. quarter worth?", "10", "20", "25", "50", "C", "A U.S. dime is worth 10 cents.", "Yes", "Holdout"],
  ["Q187", "Easy", "Which is the smallest ocean?", "Indian", "Southern", "Atlantic", "Arctic", "D", "Much of the Arctic Ocean is covered by sea ice for most of the year.", "Yes", "Holdout"],
  ["Q188", "Easy", "What gives plants their green color?", "Carotene", "Melanin", "Chlorophyll", "Hemoglobin", "C", "In fall, chlorophyll breaks down and other colors in leaves show through.", "Yes", "Holdout"],
  ["Q189", "Easy", "Which animal is famous for changing color to blend in?", "Iguana", "Salamander", "Toad", "Chameleon", "D", "Chameleons also change color to show their mood and control their temperature.", "Yes", "Holdout"],
  ["Q190", "Easy", "How many players from one volleyball team are on the court at a time?", "6", "5", "7", "9", "A", "Volleyball was invented in Massachusetts in 1895.", "Yes", "Holdout"],
  ["Q191", "Easy", "What is the main ingredient in most bread?", "Rice", "Flour", "Corn syrup", "Butter", "B", "Yeast makes bread rise by giving off tiny bubbles of gas.", "Yes", "Holdout"],
  ["Q192", "Easy", "Which planet is often called Earth's twin because of its similar size?", "Mars", "Venus", "Mercury", "Neptune", "B", "Venus is almost exactly the same size as Earth.", "Yes", "Holdout"],
  ["Q193", "Easy", "What does a thermometer measure?", "Wind", "Temperature", "Rain", "Weight", "B", "Early thermometers were filled with alcohol or mercury.", "Yes", "Holdout"],
  ["Q194", "Easy", "Which animal is the fastest on land?", "Lion", "Cheetah", "Horse", "Greyhound", "B", "Cheetahs can reach about 60 to 70 miles per hour in short bursts.", "Yes", "Holdout"],
  ["Q195", "Easy", "How many planets are in our solar system?", "7", "8", "9", "10", "B", "There were nine until Pluto was reclassified as a dwarf planet in 2006.", "Yes", "Holdout"],
  ["Q196", "Easy", "Which famous detective lived at 221B Baker Street?", "Sherlock Holmes", "Hercule Poirot", "Nancy Drew", "Miss Marple", "A", "Sherlock Holmes was created by Arthur Conan Doyle.", "Yes", "Holdout"],
  ["Q197", "Easy", "Who wrote Green Eggs and Ham?", "Dr. Seuss", "Roald Dahl", "Shel Silverstein", "Maurice Sendak", "A", "Dr. Seuss wrote it using only 50 different words.", "Yes", "Holdout"],
  ["Q198", "Easy", "What color are most school buses in the United States?", "Red", "Blue", "Yellow", "Green", "C", "The bright color helps buses stand out in early morning light.", "Yes", "Holdout"],
  ["Q199", "Easy", "Which country is shaped like a boot?", "Spain", "Italy", "Greece", "Portugal", "B", "The island of Sicily sits just off the toe of the boot.", "Yes", "Holdout"],
  ["Q200", "Easy", "What is a baby frog called?", "Cub", "Kit", "Tadpole", "Fawn", "C", "Tadpoles breathe through gills, like fish.", "Yes", "Holdout"],
  ["Q201", "Easy", "How many sides does an octagon have?", "6", "7", "10", "8", "D", "Stop signs in the United States are octagons.", "Yes", "Holdout"],
  ["Q202", "Easy", "Which part of a plant usually grows underground?", "Leaves", "Petals", "Flowers", "Roots", "D", "Roots soak up water and nutrients from the soil.", "Yes", "Holdout"],
  ["Q203", "Easy", "What is the capital of Spain?", "Madrid", "Barcelona", "Seville", "Valencia", "A", "Madrid sits near the middle of Spain.", "Yes", "Holdout"],
  ["Q204", "Easy", "Which animal is called the ship of the desert?", "Horse", "Donkey", "Camel", "Llama", "C", "A camel's hump stores fat, not water.", "Yes", "Holdout"],
  ["Q205", "Easy", "What do you call a scientist who studies stars and planets?", "Astrologer", "Geologist", "Astronomer", "Botanist", "C", "Galileo was one of the first people to study the sky with a telescope.", "Yes", "Holdout"],
  ["Q206", "Easy", "Which color mixes with yellow to make orange?", "Blue", "Green", "Purple", "Red", "D", "Red, yellow, and blue are the traditional primary colors in painting.", "Yes", "Holdout"],
  ["Q207", "Easy", "How many letters are in the English alphabet?", "26", "24", "25", "28", "A", "E is the most commonly used letter in English.", "Yes", "Holdout"],
  ["Q208", "Easy", "What is the capital of Germany?", "Munich", "Hamburg", "Berlin", "Frankfurt", "C", "Bonn was the capital of West Germany before the country reunified.", "Yes", "Holdout"],
  ["Q209", "Easy", "What kind of animal is a Komodo dragon?", "Snake", "Crocodile", "Lizard", "Dinosaur", "C", "Komodo dragons are the largest living lizards.", "Yes", "Holdout"],
  ["Q210", "Easy", "Which sport uses a puck?", "Soccer", "Basketball", "Ice hockey", "Tennis", "C", "Hockey pucks are often frozen before games so they bounce less.", "Yes", "Holdout"],
  ["Q211", "Easy", "At what temperature does water freeze in degrees Celsius?", "-10", "10", "0", "32", "C", "That's the same as 32 degrees Fahrenheit.", "Yes", "Holdout"],
  ["Q212", "Easy", "Which organ pumps blood through your body?", "Lungs", "Liver", "Stomach", "Heart", "D", "An adult heart beats about 100,000 times a day.", "Yes", "Holdout"],
  ["Q213", "Easy", "What is the name of our galaxy?", "The Milky Way", "Andromeda", "Whirlpool", "Sombrero", "A", "The Andromeda galaxy is our closest large neighbor.", "Yes", "Holdout"],
  ["Q214", "Easy", "Which fairy tale character leaves behind a glass slipper?", "Snow White", "Rapunzel", "Little Red Riding Hood", "Cinderella", "D", "Versions of the Cinderella story have been told for centuries around the world.", "Yes", "Holdout"],
  ["Q215", "Easy", "What is a baby horse called?", "Calf", "Kid", "Joey", "Foal", "D", "Foals can usually stand within an hour or two of being born.", "Yes", "Holdout"],
  ["Q216", "Easy", "How many years are in a century?", "10", "50", "100", "1,000", "C", "A period of 1,000 years is called a millennium.", "Yes", "Holdout"],
  ["Q217", "Easy", "Which U.S. state is home to Hollywood?", "California", "Nevada", "Texas", "Florida", "A", "Hollywood is a neighborhood in the city of Los Angeles.", "Yes", "Holdout"],
  ["Q218", "Easy", "What is the national bird of the United States?", "Wild turkey", "Bald eagle", "Robin", "Great horned owl", "B", "Benjamin Franklin once praised the turkey as a more respectable bird.", "Yes", "Holdout"],
  ["Q219", "Easy", "How many inches are in a foot?", "10", "12", "16", "36", "B", "Three feet make a yard.", "Yes", "Holdout"],
  ["Q220", "Easy", "Which scientist is famous for the laws of motion and gravity?", "Isaac Newton", "Albert Einstein", "Charles Darwin", "Galileo Galilei", "A", "The story of a falling apple inspiring Newton comes from his own later accounts.", "Yes", "Holdout"],
  ["Q221", "Easy", "What do you call a shape with three sides?", "Triangle", "Square", "Pentagon", "Circle", "A", "The angles inside a triangle always add up to 180 degrees.", "Yes", "Holdout"],
  ["Q222", "Easy", "Which black-and-white animal eats mostly bamboo?", "Giant panda", "Koala", "Raccoon", "Skunk", "A", "Giant pandas spend about half of each day eating.", "Yes", "Holdout"],
  ["Q223", "Easy", "What is the name of the fairy in Peter Pan?", "Flora", "Fauna", "Merryweather", "Tinker Bell", "D", "Peter Pan was created by Scottish author J. M. Barrie.", "Yes", "Holdout"],
  ["Q224", "Easy", "Which metal are magnets strongly attracted to?", "Gold", "Copper", "Aluminum", "Iron", "D", "Nickel and cobalt are also attracted to magnets.", "Yes", "Holdout"],
  ["Q225", "Easy", "What is the main ingredient in french fries?", "Carrots", "Rice", "Potatoes", "Corn", "C", "Potatoes were first grown in South America.", "Yes", "Holdout"],
  ["Q226", "Easy", "What is the capital of Russia?", "St. Petersburg", "Moscow", "Kazan", "Sochi", "B", "St. Petersburg was Russia's capital for about 200 years.", "Yes", "Holdout"],
  ["Q227", "Easy", "In which ocean are the Hawaiian Islands?", "Atlantic", "Indian", "Pacific", "Arctic", "C", "Hawaii is the only U.S. state made up entirely of islands.", "Yes", "Holdout"],
  ["Q228", "Easy", "What is an adult male deer often called?", "Doe", "Fawn", "Mare", "Buck", "D", "A female deer is called a doe, and a baby is a fawn.", "Yes", "Holdout"],
  ["Q229", "Easy", "Which brass instrument changes pitch with a slide?", "Trumpet", "Trombone", "Tuba", "French horn", "B", "Moving the slide out makes the notes lower.", "Yes", "Holdout"],
  ["Q230", "Easy", "How many centimeters are in a meter?", "10", "12", "100", "1,000", "C", "Centi means one hundredth.", "Yes", "Holdout"],
  ["Q231", "Easy", "What is a group of wolves called?", "A pack", "A pride", "A school", "A flock", "A", "A wolf pack is usually a family group.", "Yes", "Holdout"],
  ["Q232", "Medium", "In which country is Machu Picchu?", "Mexico", "Chile", "Bolivia", "Peru", "D", "Machu Picchu was built by the Inca in the 1400s.", "Yes", "Holdout"],
  ["Q233", "Medium", "What is the capital of Egypt?", "Alexandria", "Cairo", "Luxor", "Giza", "B", "Cairo sits on the banks of the Nile.", "Yes", "Holdout"],
  ["Q234", "Medium", "Who painted The Last Supper?", "Michelangelo", "Leonardo da Vinci", "Raphael", "Caravaggio", "B", "It was painted on a wall of a monastery dining hall in Milan.", "Yes", "Holdout"],
  ["Q235", "Medium", "What is the largest volcano in our solar system?", "Mauna Kea", "Olympus Mons", "Mount Etna", "Mount Fuji", "B", "Olympus Mons on Mars is about two and a half times taller than Mount Everest.", "Yes", "Holdout"],
  ["Q236", "Medium", "What is the chemical symbol for helium?", "H", "Hl", "He", "Hm", "C", "Helium is lighter than air, which is why helium balloons float.", "Yes", "Holdout"],
  ["Q237", "Medium", "Who wrote Pride and Prejudice?", "Jane Austen", "Charlotte Bronte", "Mary Shelley", "Emily Dickinson", "A", "Pride and Prejudice was first published in 1813.", "Yes", "Holdout"],
  ["Q238", "Medium", "How many sides does a heptagon have?", "6", "8", "9", "7", "D", "Hepta comes from the Greek word for seven.", "Yes", "Holdout"],
  ["Q239", "Medium", "Which planet has a day only a little longer than Earth's?", "Venus", "Mercury", "Mars", "Jupiter", "C", "A day on Mars lasts about 24 hours and 37 minutes.", "Yes", "Holdout"],
  ["Q240", "Medium", "What is the capital of Greece?", "Athens", "Sparta", "Thessaloniki", "Corinth", "A", "The Parthenon in Athens was finished in 432 BC.", "Yes", "Holdout"],
  ["Q241", "Medium", "Which scientist is famous for the theory of evolution by natural selection?", "Gregor Mendel", "Louis Pasteur", "Isaac Newton", "Charles Darwin", "D", "His ideas were shaped by his voyage on the ship HMS Beagle.", "Yes", "Holdout"],
  ["Q242", "Medium", "What is the capital of South Korea?", "Busan", "Incheon", "Pyongyang", "Seoul", "D", "About half of South Korea's people live in or around Seoul.", "Yes", "Holdout"],
  ["Q243", "Medium", "How many bones are in one adult human hand?", "19", "27", "32", "45", "B", "Your two hands together hold more than a quarter of all the bones in your body.", "Yes", "Holdout"],
  ["Q244", "Medium", "Which ship carried the Pilgrims to America in 1620?", "Santa Maria", "Endeavour", "Beagle", "Mayflower", "D", "The Pilgrims settled at Plymouth in what is now Massachusetts.", "Yes", "Holdout"],
  ["Q245", "Medium", "What is the currency of the United Kingdom?", "Euro", "Franc", "Krona", "Pound sterling", "D", "The United Kingdom never switched to the euro.", "Yes", "Holdout"],
  ["Q246", "Medium", "Who was the 16th President of the United States?", "George Washington", "Abraham Lincoln", "Thomas Jefferson", "Ulysses S. Grant", "B", "Lincoln gave the Gettysburg Address in 1863.", "Yes", "Holdout"],
  ["Q247", "Medium", "Which element has the chemical symbol C?", "Carbon", "Calcium", "Copper", "Chlorine", "A", "Diamonds and pencil graphite are both made of carbon.", "Yes", "Holdout"],
  ["Q248", "Medium", "What is the capital of Kenya?", "Mombasa", "Nairobi", "Kampala", "Addis Ababa", "B", "Nairobi has a national park with lions and giraffes inside the city limits.", "Yes", "Holdout"],
  ["Q249", "Medium", "What is the largest city in Canada?", "Toronto", "Vancouver", "Montreal", "Ottawa", "A", "Toronto is the capital of the province of Ontario.", "Yes", "Holdout"],
  ["Q250", "Medium", "In tennis, what is a score of zero called?", "Love", "Nil", "Zero", "Duck", "A", "Nobody knows for sure where the word love in tennis came from.", "Yes", "Holdout"],
  ["Q251", "Medium", "Which organ makes bile to help digest fat?", "Pancreas", "Kidney", "Liver", "Stomach", "C", "Bile is stored in the gallbladder until it's needed.", "Yes", "Holdout"],
  ["Q252", "Medium", "Which Canadian province makes most of the world's maple syrup?", "Ontario", "British Columbia", "Alberta", "Quebec", "D", "It takes about 40 gallons of sap to make 1 gallon of maple syrup.", "Yes", "Holdout"],
  ["Q253", "Medium", "Who discovered penicillin?", "Louis Pasteur", "Alexander Fleming", "Jonas Salk", "Edward Jenner", "B", "Fleming noticed it in 1928 when mold killed bacteria in a dish.", "Yes", "Holdout"],
  ["Q254", "Medium", "Which planet is often called the Morning Star?", "Mars", "Jupiter", "Venus", "Mercury", "C", "Venus is the brightest planet in our night sky.", "Yes", "Holdout"],
  ["Q255", "Medium", "Who wrote The Adventures of Tom Sawyer?", "Charles Dickens", "Jack London", "Herman Melville", "Mark Twain", "D", "Mark Twain's real name was Samuel Clemens.", "Yes", "Holdout"],
  ["Q256", "Medium", "What is the capital of Argentina?", "Buenos Aires", "Santiago", "Lima", "Montevideo", "A", "Buenos Aires is known as the birthplace of the tango.", "Yes", "Holdout"],
  ["Q257", "Medium", "Which of these animals can doze while standing up?", "Dog", "Cat", "Horse", "Rabbit", "C", "Horses have a locking system in their legs that lets them rest standing up.", "Yes", "Holdout"],
  ["Q258", "Medium", "How many strings does a standard bass guitar have?", "4", "3", "6", "8", "A", "Its four strings are usually tuned like the lowest four strings of a guitar.", "Yes", "Holdout"],
  ["Q259", "Medium", "Europa is a moon of which planet?", "Saturn", "Uranus", "Neptune", "Jupiter", "D", "Scientists think Europa has a huge ocean under its icy surface.", "Yes", "Holdout"],
  ["Q260", "Medium", "Which city is nicknamed the Big Apple?", "Chicago", "Boston", "Los Angeles", "New York City", "D", "The nickname became popular through a 1970s tourism campaign.", "Yes", "Holdout"],
  ["Q261", "Medium", "In what year was the Declaration of Independence adopted?", "1765", "1783", "1776", "1789", "C", "It was adopted on July 4, 1776.", "Yes", "Holdout"],
  ["Q262", "Medium", "What language do most people speak in Brazil?", "Spanish", "French", "Portuguese", "Italian", "C", "Brazil is the largest Portuguese-speaking country in the world.", "Yes", "Holdout"],
  ["Q263", "Medium", "Which of these is the largest island?", "Borneo", "Madagascar", "Greenland", "New Guinea", "C", "Greenland is part of the Kingdom of Denmark.", "Yes", "Holdout"],
  ["Q264", "Medium", "What is the chemical formula for table salt?", "KCl", "NaCl", "H2O", "CO2", "B", "Table salt is made of sodium and chlorine.", "Yes", "Holdout"],
  ["Q265", "Medium", "What is the capital of India?", "Mumbai", "Kolkata", "New Delhi", "Bangalore", "C", "New Delhi became India's capital in 1931.", "Yes", "Holdout"],
  ["Q266", "Medium", "Which instrument did Louis Armstrong famously play?", "Trumpet", "Saxophone", "Clarinet", "Piano", "A", "Armstrong was also famous for his gravelly singing voice.", "Yes", "Holdout"],
  ["Q267", "Medium", "Which planet is the farthest from the Sun?", "Uranus", "Saturn", "Neptune", "Jupiter", "C", "Neptune takes about 165 Earth years to circle the Sun once.", "Yes", "Holdout"],
  ["Q268", "Medium", "Where was paper first invented?", "Egypt", "China", "Greece", "India", "B", "Papermaking spread from China along trade routes over many centuries.", "Yes", "Holdout"],
  ["Q269", "Medium", "What is the capital of Ireland?", "Cork", "Galway", "Dublin", "Limerick", "C", "Dublin sits where the River Liffey meets the Irish Sea.", "Yes", "Holdout"],
  ["Q270", "Medium", "Which of these is the largest muscle in the human body?", "Biceps", "Deltoid", "Gluteus maximus", "Heart", "C", "It is the main muscle in your buttocks.", "Yes", "Holdout"],
  ["Q271", "Medium", "Who painted the melting clocks in The Persistence of Memory?", "Pablo Picasso", "Rene Magritte", "Joan Miro", "Salvador Dali", "D", "The painting is only about 9.5 by 13 inches.", "Yes", "Holdout"],
  ["Q272", "Medium", "What does DNA stand for?", "Dinitrogen acid", "Double nucleic acid", "Dynamic nuclear acid", "Deoxyribonucleic acid", "D", "DNA's double-helix shape was described in 1953.", "Yes", "Holdout"],
  ["Q273", "Medium", "Which U.S. state is nicknamed the Lone Star State?", "Arizona", "Oklahoma", "Texas", "Nevada", "C", "Texas was an independent republic from 1836 to 1845.", "Yes", "Holdout"],
  ["Q274", "Medium", "What is a group of crows called?", "A pride", "A school", "A murder", "A gaggle", "C", "A group of geese on the ground is called a gaggle.", "Yes", "Holdout"],
  ["Q275", "Medium", "What is the capital of Thailand?", "Phuket", "Chiang Mai", "Bangkok", "Hanoi", "C", "Bangkok's full ceremonial name is one of the longest place names in the world.", "Yes", "Holdout"],
  ["Q276", "Medium", "Who was the first person to walk on the Moon?", "Buzz Aldrin", "Yuri Gagarin", "John Glenn", "Neil Armstrong", "D", "Armstrong stepped onto the Moon on July 20, 1969.", "Yes", "Holdout"],
  ["Q277", "Medium", "What is the square root of 81?", "9", "7", "8", "11", "A", "81 is also 3 times 3 times 3 times 3.", "Yes", "Holdout"],
  ["Q278", "Medium", "Which famous composer was born in Salzburg, Austria?", "Beethoven", "Mozart", "Bach", "Haydn", "B", "Mozart began composing when he was about five years old.", "Yes", "Holdout"],
  ["Q279", "Medium", "What is the capital of Portugal?", "Porto", "Madrid", "Lisbon", "Faro", "C", "Lisbon is one of the oldest cities in Western Europe.", "Yes", "Holdout"],
  ["Q280", "Medium", "What do fish use to breathe underwater?", "Gills", "Lungs", "Fins", "Scales", "A", "Gills pull oxygen out of the water as it flows past.", "Yes", "Holdout"],
  ["Q281", "Medium", "How many players from one ice hockey team are on the ice at a time?", "6", "5", "7", "11", "A", "That count includes the goalie.", "Yes", "Holdout"],
  ["Q282", "Medium", "In which city is the Golden Gate Bridge?", "Los Angeles", "Seattle", "San Diego", "San Francisco", "D", "The Golden Gate Bridge opened in 1937.", "Yes", "Holdout"],
  ["Q283", "Medium", "Which artist is famous for paintings of soup cans?", "Roy Lichtenstein", "Andy Warhol", "Jackson Pollock", "Keith Haring", "B", "Warhol painted 32 different Campbell's soup flavors in one series.", "Yes", "Holdout"],
  ["Q284", "Medium", "Which mountain range is often used as the border between Europe and Asia?", "Alps", "Carpathians", "Pyrenees", "Ural Mountains", "D", "The Urals run north to south through Russia.", "Yes", "Holdout"],
  ["Q285", "Medium", "What is the capital of Norway?", "Bergen", "Oslo", "Stockholm", "Helsinki", "B", "Oslo hosts the Nobel Peace Prize ceremony every year.", "Yes", "Holdout"],
  ["Q286", "Medium", "How many minutes are in a full day?", "1,200", "1,440", "1,600", "2,400", "B", "That's 24 hours times 60 minutes.", "Yes", "Holdout"],
  ["Q287", "Medium", "Which vitamin does your skin make when it gets sunlight?", "Vitamin A", "Vitamin C", "Vitamin K", "Vitamin D", "D", "Vitamin D helps your body absorb calcium.", "Yes", "Holdout"],
  ["Q288", "Medium", "Who wrote the poem The Raven?", "Walt Whitman", "Robert Frost", "Emily Dickinson", "Edgar Allan Poe", "D", "The Raven was published in 1845.", "Yes", "Holdout"],
  ["Q289", "Medium", "What is the capital of Vietnam?", "Ho Chi Minh City", "Da Nang", "Hanoi", "Hue", "C", "Hanoi has been a capital city for about 1,000 years.", "Yes", "Holdout"],
  ["Q290", "Medium", "Which is the largest coral reef system in the world?", "Belize Barrier Reef", "Red Sea Reef", "Great Barrier Reef", "Florida Reef", "C", "It stretches more than 1,400 miles along Australia's coast.", "Yes", "Holdout"],
  ["Q291", "Medium", "Which country is called the Land of the Rising Sun?", "Japan", "China", "South Korea", "Thailand", "A", "Japan's name in Japanese, Nihon, means origin of the sun.", "Yes", "Holdout"],
  ["Q292", "Medium", "What do you call animals that eat only plants?", "Carnivores", "Herbivores", "Omnivores", "Insectivores", "B", "Cows, deer, and rabbits are all herbivores.", "Yes", "Holdout"],
  ["Q293", "Medium", "What is the capital of Poland?", "Krakow", "Gdansk", "Prague", "Warsaw", "D", "Krakow was Poland's capital until about 1600.", "Yes", "Holdout"],
  ["Q294", "Medium", "In U.S. cooking, how many teaspoons make one tablespoon?", "2", "4", "3", "5", "C", "In U.S. cooking, 16 tablespoons make one cup.", "Yes", "Holdout"],
  ["Q295", "Medium", "Who developed the first widely used polio vaccine?", "Jonas Salk", "Louis Pasteur", "Edward Jenner", "Robert Koch", "A", "Salk's vaccine was declared safe and effective in 1955.", "Yes", "Holdout"],
  ["Q296", "Medium", "What is the capital of Cuba?", "Santiago de Cuba", "Kingston", "San Juan", "Havana", "D", "Havana was founded by the Spanish in the early 1500s.", "Yes", "Holdout"],
  ["Q297", "Medium", "What is the colored part of the eye called?", "Iris", "Pupil", "Retina", "Cornea", "A", "The pupil is the black opening in the middle of the iris.", "Yes", "Holdout"],
  ["Q298", "Medium", "What is melted rock called once it flows out of a volcano?", "Magma", "Lava", "Basalt", "Ash", "B", "While it's still underground, melted rock is called magma.", "Yes", "Holdout"],
  ["Q299", "Medium", "What is the capital of Austria?", "Salzburg", "Graz", "Innsbruck", "Vienna", "D", "Vienna was home to Mozart, Beethoven, and Haydn at different times.", "Yes", "Holdout"],
  ["Q300", "Medium", "What does a seismograph measure?", "Wind speed", "Earthquakes", "Rainfall", "Air pressure", "B", "It records the shaking of the ground as wavy lines.", "Yes", "Holdout"],
  ["Q301", "Medium", "Who painted Girl with a Pearl Earring?", "Rembrandt", "Johannes Vermeer", "Jan van Eyck", "Peter Paul Rubens", "B", "Vermeer painted it in the Dutch city of Delft around 1665.", "Yes", "Holdout"],
  ["Q302", "Medium", "What is the capital of Peru?", "Cusco", "Quito", "Bogota", "Lima", "D", "Lima was founded by Spanish conquistador Francisco Pizarro in 1535.", "Yes", "Holdout"],
  ["Q303", "Medium", "What is the longest river in Asia?", "Yangtze", "Ganges", "Mekong", "Indus", "A", "The Yangtze flows entirely within China.", "Yes", "Holdout"],
  ["Q304", "Medium", "What is the capital of Sweden?", "Stockholm", "Gothenburg", "Oslo", "Malmo", "A", "Stockholm is built on 14 islands.", "Yes", "Holdout"],
  ["Q305", "Medium", "What is the longest side of a right triangle called?", "Radius", "Hypotenuse", "Diagonal", "Base", "B", "It's always the side across from the right angle.", "Yes", "Holdout"],
  ["Q306", "Medium", "What is the tallest mountain in North America?", "Mount Whitney", "Mount Rainier", "Denali", "Pikes Peak", "C", "Denali is in Alaska and rises about 20,300 feet.", "Yes", "Holdout"],
  ["Q307", "Medium", "Which planet is named after the Greek god of the sky?", "Neptune", "Saturn", "Mars", "Uranus", "D", "Uranus is the only planet named after a Greek god instead of a Roman one.", "Yes", "Holdout"],
  ["Q308", "Medium", "How many years are in a decade?", "5", "12", "10", "100", "C", "Deca comes from the Greek word for ten.", "Yes", "Holdout"],
  ["Q309", "Hard", "What is the smallest country in South America by area?", "Uruguay", "Suriname", "Guyana", "Ecuador", "B", "Suriname is the only country in South America where Dutch is the official language.", "Yes", "Holdout"],
  ["Q310", "Hard", "Triton is a moon of which planet?", "Neptune", "Uranus", "Saturn", "Jupiter", "A", "Triton orbits in the opposite direction to Neptune's spin.", "Yes", "Holdout"],
  ["Q311", "Hard", "What is the chemical symbol for lead?", "Ld", "Le", "Pl", "Pb", "D", "Pb comes from plumbum, the Latin word for lead.", "Yes", "Holdout"],
  ["Q312", "Hard", "Who wrote One Hundred Years of Solitude?", "Isabel Allende", "Jorge Luis Borges", "Gabriel Garcia Marquez", "Pablo Neruda", "C", "Garcia Marquez won the Nobel Prize in Literature in 1982.", "Yes", "Holdout"],
  ["Q313", "Hard", "In what year did the Soviet Union break apart?", "1989", "1990", "1991", "1993", "C", "It split into 15 independent countries.", "Yes", "Holdout"],
  ["Q314", "Hard", "Which element has atomic number 79?", "Silver", "Platinum", "Mercury", "Gold", "D", "Gold can be hammered into sheets thin enough to see light through.", "Yes", "Holdout"],
  ["Q315", "Hard", "Who composed the opera The Magic Flute?", "Verdi", "Wagner", "Mozart", "Puccini", "C", "It premiered in Vienna in 1791, just months before Mozart died.", "Yes", "Holdout"],
  ["Q316", "Hard", "What is the capital of Nigeria?", "Lagos", "Kano", "Abuja", "Ibadan", "C", "Lagos was Nigeria's capital until 1991.", "Yes", "Holdout"],
  ["Q317", "Hard", "How many chromosomes do humans usually have?", "23", "44", "46", "48", "C", "They come in 23 pairs.", "Yes", "Holdout"],
  ["Q318", "Hard", "Who painted The Birth of Venus?", "Sandro Botticelli", "Titian", "Raphael", "Leonardo da Vinci", "A", "It hangs in the Uffizi Gallery in Florence.", "Yes", "Holdout"],
  ["Q319", "Hard", "What is the largest artery in the human body?", "Aorta", "Carotid artery", "Femoral artery", "Pulmonary artery", "A", "The aorta carries blood straight from the heart.", "Yes", "Holdout"],
  ["Q320", "Hard", "Which astronomer worked out the laws of planetary motion?", "Nicolaus Copernicus", "Galileo Galilei", "Tycho Brahe", "Johannes Kepler", "D", "Kepler showed that planets move in ovals, not perfect circles.", "Yes", "Holdout"],
  ["Q321", "Hard", "What is the capital of the Canadian province of British Columbia?", "Vancouver", "Kelowna", "Victoria", "Surrey", "C", "Vancouver is the province's largest city, but Victoria is the capital.", "Yes", "Holdout"],
  ["Q322", "Hard", "In what year did the Wright brothers make their first powered airplane flight?", "1899", "1908", "1903", "1911", "C", "The first flight lasted about 12 seconds.", "Yes", "Holdout"],
  ["Q323", "Hard", "What is the longest river in Australia?", "Darling River", "Murray River", "Murrumbidgee River", "Lachlan River", "B", "The Murray flows about 1,560 miles to the sea.", "Yes", "Holdout"],
  ["Q324", "Hard", "What is the main language of Iran?", "Arabic", "Persian", "Turkish", "Urdu", "B", "Persian is also called Farsi.", "Yes", "Holdout"],
  ["Q325", "Hard", "Who wrote Don Quixote?", "Lope de Vega", "Dante Alighieri", "Federico Garcia Lorca", "Miguel de Cervantes", "D", "It's often called the first modern novel.", "Yes", "Holdout"],
  ["Q326", "Hard", "What is the capital of Saudi Arabia?", "Jeddah", "Riyadh", "Mecca", "Medina", "B", "Riyadh is in the center of the Arabian Peninsula.", "Yes", "Holdout"],
  ["Q327", "Hard", "What is the largest moon of Uranus?", "Oberon", "Titania", "Miranda", "Ariel", "B", "Most of Uranus's moons are named after characters from Shakespeare.", "Yes", "Holdout"],
  ["Q328", "Hard", "Who painted The Night Watch?", "Johannes Vermeer", "Peter Paul Rubens", "Frans Hals", "Rembrandt", "D", "It hangs in the Rijksmuseum in Amsterdam.", "Yes", "Holdout"],
  ["Q329", "Hard", "What is the deepest lake in the world?", "Lake Tanganyika", "Lake Baikal", "Lake Superior", "Caspian Sea", "B", "Baikal holds about a fifth of the world's unfrozen fresh surface water.", "Yes", "Holdout"],
  ["Q330", "Hard", "Who composed Clair de Lune?", "Erik Satie", "Maurice Ravel", "Claude Debussy", "Frederic Chopin", "C", "Clair de lune means moonlight in French.", "Yes", "Holdout"],
  ["Q331", "Hard", "What is the capital of Chile?", "Valparaiso", "Lima", "Buenos Aires", "Santiago", "D", "Santiago sits in a valley with the Andes mountains to its east.", "Yes", "Holdout"],
  ["Q332", "Hard", "Which ancient civilization built Chichen Itza?", "The Aztecs", "The Maya", "The Inca", "The Olmecs", "B", "Chichen Itza is on Mexico's Yucatan Peninsula.", "Yes", "Holdout"],
  ["Q333", "Hard", "What is the unit of electrical resistance?", "Ohm", "Volt", "Ampere", "Watt", "A", "It's named after German physicist Georg Ohm.", "Yes", "Holdout"],
  ["Q334", "Hard", "Who was the first emperor of Rome?", "Augustus", "Julius Caesar", "Nero", "Caligula", "A", "Julius Caesar was a dictator, but never actually emperor.", "Yes", "Holdout"],
  ["Q335", "Hard", "In which country is the ancient city of Petra?", "Egypt", "Syria", "Jordan", "Lebanon", "C", "Petra's buildings were carved directly into rose-colored rock.", "Yes", "Holdout"],
  ["Q336", "Hard", "How many lines are on a standard music staff?", "4", "5", "6", "7", "B", "The spaces between the lines stand for notes too.", "Yes", "Holdout"],
  ["Q337", "Hard", "What is the capital of Hungary?", "Prague", "Vienna", "Bucharest", "Budapest", "D", "Budapest was formed in 1873 by joining the cities of Buda, Obuda, and Pest.", "Yes", "Holdout"],
  ["Q338", "Hard", "Which physicist is known for the uncertainty principle?", "Niels Bohr", "Werner Heisenberg", "Erwin Schrodinger", "Max Planck", "B", "He published the idea in 1927.", "Yes", "Holdout"],
  ["Q339", "Hard", "Which part of a cell is often called its powerhouse?", "Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus", "A", "Mitochondria turn food into energy the cell can use.", "Yes", "Holdout"],
  ["Q340", "Hard", "Who wrote Moby-Dick?", "Nathaniel Hawthorne", "Jack London", "Herman Melville", "Mark Twain", "C", "Moby-Dick begins with the famous line, Call me Ishmael.", "Yes", "Holdout"],
  ["Q341", "Hard", "In which country is the city of Timbuktu?", "Niger", "Chad", "Mali", "Senegal", "C", "Timbuktu was once a great center of learning and trade.", "Yes", "Holdout"],
  ["Q342", "Hard", "What is the capital of Colombia?", "Bogota", "Medellin", "Cali", "Cartagena", "A", "Bogota sits about 8,660 feet above sea level.", "Yes", "Holdout"],
  ["Q343", "Hard", "Which woodwind instrument uses a double reed?", "Clarinet", "Flute", "Oboe", "Saxophone", "C", "Orchestras usually tune to a note played by the oboe.", "Yes", "Holdout"],
  ["Q344", "Hard", "In what year did the first iPhone go on sale?", "2005", "2007", "2008", "2010", "B", "It first went on sale in the United States on June 29, 2007.", "Yes", "Holdout"],
  ["Q345", "Hard", "What is the second-highest mountain in the world?", "Kangchenjunga", "Lhotse", "K2", "Makalu", "C", "K2 sits on the border between Pakistan and China.", "Yes", "Holdout"],
  ["Q346", "Hard", "What is the capital of Finland?", "Tampere", "Turku", "Tallinn", "Helsinki", "D", "Tallinn, the capital of Estonia, is just across the sea from Helsinki.", "Yes", "Holdout"],
  ["Q347", "Hard", "Who discovered the planet Uranus?", "William Herschel", "Galileo Galilei", "Johannes Kepler", "Clyde Tombaugh", "A", "Herschel spotted it in 1781.", "Yes", "Holdout"],
  ["Q348", "Hard", "What is the largest country in Africa by area?", "Algeria", "Sudan", "DR Congo", "Libya", "A", "Sudan held the title until South Sudan became independent in 2011.", "Yes", "Holdout"],
  ["Q349", "Hard", "About how many kelvins is the boiling point of water at sea level?", "100", "212", "273", "373", "D", "Water freezes at about 273 kelvins.", "Yes", "Holdout"],
  ["Q350", "Hard", "Who wrote War and Peace?", "Fyodor Dostoevsky", "Anton Chekhov", "Leo Tolstoy", "Alexander Pushkin", "C", "War and Peace is set during Napoleon's invasion of Russia.", "Yes", "Holdout"],
  ["Q351", "Hard", "Which flightless bird is a famous symbol of New Zealand?", "Emu", "Cassowary", "Rhea", "Kiwi", "D", "New Zealanders are often called Kiwis.", "Yes", "Holdout"],
  ["Q352", "Hard", "How many players are on a cricket team?", "9", "10", "11", "12", "C", "A cricket match can last up to five days.", "Yes", "Holdout"],
  ["Q353", "Hard", "What is the capital of Iceland?", "Akureyri", "Reykjavik", "Oslo", "Nuuk", "B", "Reykjavik is the world's northernmost capital of a sovereign country.", "Yes", "Holdout"],
  ["Q354", "Hard", "Which element has the chemical symbol Hg?", "Mercury", "Silver", "Helium", "Magnesium", "A", "Hg comes from hydrargyrum, meaning water-silver.", "Yes", "Holdout"],
  ["Q355", "Hard", "Which philosopher wrote The Republic?", "Aristotle", "Socrates", "Plato", "Homer", "C", "Socrates is the main speaker in it, though he wrote nothing himself.", "Yes", "Holdout"],
  ["Q356", "Hard", "In which country is Angkor Wat?", "Cambodia", "Thailand", "Vietnam", "Laos", "A", "Angkor Wat appears on Cambodia's national flag.", "Yes", "Holdout"],
  ["Q357", "Hard", "What do you call a word that reads the same backward and forward?", "Palindrome", "Anagram", "Homonym", "Acronym", "A", "Racecar and level are both palindromes.", "Yes", "Holdout"],
  ["Q358", "Hard", "Which president appears on the U.S. 50-dollar bill?", "Benjamin Franklin", "Ulysses S. Grant", "Andrew Jackson", "Alexander Hamilton", "B", "Grant led Union forces before becoming president.", "Yes", "Holdout"],
  ["Q359", "Hard", "What is the capital of Ukraine?", "Lviv", "Odesa", "Kyiv", "Kharkiv", "C", "Kyiv sits on the Dnipro River.", "Yes", "Holdout"],
  ["Q360", "Hard", "Who sculpted The Thinker?", "Michelangelo", "Auguste Rodin", "Donatello", "Gian Lorenzo Bernini", "B", "The Thinker was first designed as part of a huge set of doors.", "Yes", "Holdout"],
  ["Q361", "Hard", "What force slows down two surfaces rubbing against each other?", "Gravity", "Inertia", "Momentum", "Friction", "D", "Friction is why rubbing your hands together warms them.", "Yes", "Holdout"],
  ["Q362", "Hard", "What is the official language of Austria?", "Dutch", "Hungarian", "Czech", "German", "D", "Austrian German has some of its own words, like Jause for snack.", "Yes", "Holdout"],
  ["Q363", "Hard", "Who wrote The Odyssey?", "Virgil", "Sophocles", "Ovid", "Homer", "D", "The Odyssey follows Odysseus on his long trip home after the Trojan War.", "Yes", "Holdout"],
  ["Q364", "Hard", "What was the giant supercontinent that broke apart about 200 million years ago?", "Atlantis", "Pangaea", "Lemuria", "Avalonia", "B", "Pangaea means all lands in Greek.", "Yes", "Holdout"],
  ["Q365", "Hard", "In what year did the Chernobyl nuclear disaster happen?", "1979", "1984", "1991", "1986", "D", "Chernobyl is in northern Ukraine.", "Yes", "Holdout"],
  ["Q366", "Hard", "What is the chemical symbol for tin?", "Ti", "Tn", "Si", "Sn", "D", "Sn comes from stannum, the Latin word for tin.", "Yes", "Holdout"],
  ["Q367", "Hard", "Who composed The Rite of Spring?", "Igor Stravinsky", "Claude Debussy", "Maurice Ravel", "Sergei Prokofiev", "A", "Its 1913 premiere in Paris caused an uproar in the audience.", "Yes", "Holdout"],
  ["Q368", "Hard", "What is the capital of Denmark?", "Aarhus", "Oslo", "Odense", "Copenhagen", "D", "The Little Mermaid statue sits in Copenhagen's harbor.", "Yes", "Holdout"],
  ["Q369", "Hard", "What is the largest species of penguin?", "King penguin", "Adelie penguin", "Emperor penguin", "Gentoo penguin", "C", "Emperor penguins can stand about 4 feet tall.", "Yes", "Holdout"],
  ["Q370", "Hard", "Who painted The Scream?", "Gustav Klimt", "Wassily Kandinsky", "Egon Schiele", "Edvard Munch", "D", "Munch made several versions of The Scream.", "Yes", "Holdout"],
  ["Q371", "Hard", "What is the capital of Belgium?", "Antwerp", "Brussels", "Bruges", "Ghent", "B", "Brussels is also home to the main offices of the European Union.", "Yes", "Holdout"],
  ["Q372", "Hard", "In which country did the Renaissance begin?", "France", "Greece", "Italy", "Spain", "C", "It began in Florence in the 1300s and 1400s.", "Yes", "Holdout"],
  ["Q373", "Hard", "What is the longest river in the United Kingdom?", "River Thames", "River Trent", "River Severn", "River Tay", "C", "The Severn flows through both Wales and England.", "Yes", "Holdout"],
  ["Q374", "Hard", "What is the main gas in natural gas?", "Propane", "Methane", "Butane", "Ethane", "B", "Natural gas has no smell, so companies add one to help people notice leaks.", "Yes", "Holdout"],
  ["Q375", "Hard", "Who was the first woman to fly solo across the Atlantic Ocean?", "Bessie Coleman", "Harriet Quimby", "Jacqueline Cochran", "Amelia Earhart", "D", "She made the flight in 1932.", "Yes", "Holdout"],
  ["Q376", "Hard", "Which country has been the world's top coffee producer for more than 150 years?", "Colombia", "Brazil", "Vietnam", "Ethiopia", "B", "Coffee is believed to have first been used in Ethiopia.", "Yes", "Holdout"],
  ["Q377", "Hard", "What is the capital of the Philippines?", "Cebu City", "Manila", "Davao City", "Makati", "B", "The Philippines is made up of more than 7,000 islands.", "Yes", "Holdout"],
  ["Q378", "Hard", "What word describes animals that are active at night?", "Diurnal", "Migratory", "Dormant", "Nocturnal", "D", "Animals that are active during the day are called diurnal.", "Yes", "Holdout"],
  ["Q379", "Hard", "Who wrote The Divine Comedy?", "Petrarch", "Dante Alighieri", "Giovanni Boccaccio", "Virgil", "B", "In the poem, the Roman poet Virgil guides Dante through the afterlife.", "Yes", "Holdout"],
  ["Q380", "Hard", "What is the largest of the Great Lakes?", "Lake Michigan", "Lake Huron", "Lake Erie", "Lake Superior", "D", "Lake Superior holds more water than the other four Great Lakes combined.", "Yes", "Holdout"],
  ["Q381", "Hard", "What particle in an atom has a positive charge?", "Proton", "Electron", "Neutron", "Photon", "A", "Electrons have a negative charge, and neutrons have none.", "Yes", "Holdout"],
  ["Q382", "Hard", "How many degrees are in a full circle?", "360", "180", "270", "400", "A", "The 360 may come from the ancient Babylonians, who counted in sixties.", "Yes", "Holdout"],
  ["Q383", "Hard", "Which planet's moon Io is covered in active volcanoes?", "Jupiter", "Saturn", "Mars", "Neptune", "A", "Io is the most volcanically active place in the solar system.", "Yes", "Holdout"],
  ["Q384", "Very Hard", "What is the capital of Mongolia?", "Ulaanbaatar", "Almaty", "Bishkek", "Hohhot", "A", "Ulaanbaatar is often called the coldest capital city in the world.", "Yes", "Holdout"],
  ["Q385", "Very Hard", "Who composed the Brandenburg Concertos?", "Johann Sebastian Bach", "George Frideric Handel", "Georg Philipp Telemann", "Antonio Vivaldi", "A", "Bach dedicated them to a German nobleman in 1721.", "Yes", "Holdout"],
  ["Q386", "Very Hard", "What is the capital of Bhutan?", "Kathmandu", "Thimphu", "Paro", "Lhasa", "B", "Thimphu is known for having no traffic lights.", "Yes", "Holdout"],
  ["Q387", "Very Hard", "In what year was the Magna Carta sealed?", "1066", "1215", "1314", "1415", "B", "King John of England sealed it at Runnymede.", "Yes", "Holdout"],
  ["Q388", "Very Hard", "Who painted Guernica?", "Pablo Picasso", "Joan Miro", "Salvador Dali", "Francisco Goya", "A", "Picasso painted it in 1937 in response to the bombing of a Spanish town.", "Yes", "Holdout"],
  ["Q389", "Very Hard", "What is the capital of Burkina Faso?", "Ouagadougou", "Bamako", "Niamey", "Accra", "A", "Burkina Faso means land of upright people.", "Yes", "Holdout"],
  ["Q390", "Very Hard", "Which Renaissance astronomer argued that Earth goes around the Sun?", "Johannes Kepler", "Nicolaus Copernicus", "Galileo Galilei", "Ptolemy", "B", "His book on the idea was published in 1543, the year he died.", "Yes", "Holdout"],
  ["Q391", "Very Hard", "How many electrons does a carbon atom have in its outer shell?", "2", "6", "4", "8", "C", "That's why carbon can bond with four other atoms at once.", "Yes", "Holdout"],
  ["Q392", "Very Hard", "Who wrote the novel Things Fall Apart?", "Wole Soyinka", "Ngugi wa Thiong'o", "Chinua Achebe", "Chimamanda Ngozi Adichie", "C", "Things Fall Apart was published in 1958.", "Yes", "Holdout"],
  ["Q393", "Very Hard", "What is the boundary between Earth's crust and mantle called?", "Mohorovicic discontinuity", "Gutenberg discontinuity", "Lehmann discontinuity", "Conrad discontinuity", "A", "Geologists usually just call it the Moho.", "Yes", "Holdout"],
  ["Q394", "Very Hard", "Who composed the opera Carmen?", "Giuseppe Verdi", "Georges Bizet", "Giacomo Puccini", "Gioachino Rossini", "B", "Bizet died just three months after Carmen's first performance.", "Yes", "Holdout"],
  ["Q395", "Very Hard", "What is the capital of Laos?", "Luang Prabang", "Vientiane", "Phnom Penh", "Yangon", "B", "Vientiane sits on the Mekong River, across from Thailand.", "Yes", "Holdout"],
  ["Q396", "Very Hard", "In what year did Constantinople fall to the Ottoman Empire?", "1204", "1389", "1492", "1453", "D", "The city is known today as Istanbul.", "Yes", "Holdout"],
  ["Q397", "Very Hard", "Of the eight planets, which has the most oval-shaped orbit?", "Mercury", "Mars", "Earth", "Neptune", "A", "Mercury's distance from the Sun changes by millions of miles during its orbit.", "Yes", "Holdout"],
  ["Q398", "Very Hard", "Who created the first widely recognized periodic table in 1869?", "Antoine Lavoisier", "John Dalton", "Dmitri Mendeleev", "Niels Bohr", "C", "Mendeleev left gaps for elements that hadn't been discovered yet.", "Yes", "Holdout"],
  ["Q399", "Very Hard", "What is the capital of Slovenia?", "Zagreb", "Ljubljana", "Bratislava", "Maribor", "B", "Ljubljana's symbol is a dragon.", "Yes", "Holdout"],
  ["Q400", "Very Hard", "In Greek mythology, who flew too close to the Sun on wings of wax?", "Daedalus", "Icarus", "Perseus", "Theseus", "B", "His father, Daedalus, built the wings.", "Yes", "Holdout"],
  ["Q401", "Very Hard", "What is Earth's inner core mostly made of?", "Silicon", "Iron", "Lead", "Uranium", "B", "The inner core is solid, even though it's hotter than the surface of the Sun.", "Yes", "Holdout"],
  ["Q402", "Very Hard", "Who composed Rhapsody in Blue?", "Aaron Copland", "Leonard Bernstein", "George Gershwin", "Cole Porter", "C", "Rhapsody in Blue premiered in New York in 1924.", "Yes", "Holdout"],
  ["Q403", "Very Hard", "What is the capital of Paraguay?", "Montevideo", "Asuncion", "La Paz", "Sucre", "B", "Asuncion is one of the oldest cities in South America.", "Yes", "Holdout"],
  ["Q404", "Very Hard", "In what year was the Battle of Hastings?", "1016", "1086", "1066", "1215", "C", "The battle made William the Conqueror king of England.", "Yes", "Holdout"],
  ["Q405", "Very Hard", "What is the study of fungi called?", "Mycology", "Phycology", "Bryology", "Virology", "A", "Mykes is the Greek word for mushroom.", "Yes", "Holdout"],
  ["Q406", "Very Hard", "Who wrote The Brothers Karamazov?", "Leo Tolstoy", "Ivan Turgenev", "Nikolai Gogol", "Fyodor Dostoevsky", "D", "It was Dostoevsky's last novel, finished in 1880.", "Yes", "Holdout"],
  ["Q407", "Very Hard", "What is the capital of Azerbaijan?", "Tbilisi", "Baku", "Yerevan", "Ashgabat", "B", "Baku is on the shore of the Caspian Sea.", "Yes", "Holdout"],
  ["Q408", "Very Hard", "What is the largest moon of Pluto?", "Nix", "Hydra", "Styx", "Charon", "D", "Charon is about half the width of Pluto.", "Yes", "Holdout"],
  ["Q409", "Very Hard", "Who painted The Garden of Earthly Delights?", "Hieronymus Bosch", "Pieter Bruegel the Elder", "Albrecht Durer", "Jan van Eyck", "A", "It hangs in the Prado Museum in Madrid.", "Yes", "Holdout"],
  ["Q410", "Very Hard", "What is the next prime number after 31?", "33", "35", "37", "39", "C", "33, 35, and 39 can all be divided by smaller numbers.", "Yes", "Holdout"],
  ["Q411", "Very Hard", "In which country are the ruins of Persepolis?", "Iran", "Iraq", "Turkey", "Syria", "A", "Persepolis was a capital of the ancient Persian Empire.", "Yes", "Holdout"],
  ["Q412", "Very Hard", "Who composed the famous 1816 opera The Barber of Seville?", "Giuseppe Verdi", "Gioachino Rossini", "Gaetano Donizetti", "Vincenzo Bellini", "B", "Rossini is said to have written it in just a few weeks.", "Yes", "Holdout"],
  ["Q413", "Very Hard", "What is the chemical symbol for antimony?", "An", "Sb", "Am", "At", "B", "Sb comes from stibium, its Latin name.", "Yes", "Holdout"],
  ["Q414", "Very Hard", "Who was the first person to reach the South Pole?", "Robert Falcon Scott", "Ernest Shackleton", "Richard Byrd", "Roald Amundsen", "D", "Amundsen arrived in December 1911, about five weeks before Scott.", "Yes", "Holdout"],
  ["Q415", "Very Hard", "What is the capital of Latvia?", "Vilnius", "Tallinn", "Minsk", "Riga", "D", "Riga's old town is known for its colorful old buildings.", "Yes", "Holdout"],
  ["Q416", "Very Hard", "Who discovered the electron?", "J. J. Thomson", "Ernest Rutherford", "Niels Bohr", "James Chadwick", "A", "Thomson discovered it in 1897.", "Yes", "Holdout"],
  ["Q417", "Very Hard", "Who wrote Les Miserables?", "Victor Hugo", "Alexandre Dumas", "Emile Zola", "Gustave Flaubert", "A", "Victor Hugo also wrote The Hunchback of Notre-Dame.", "Yes", "Holdout"],
  ["Q418", "Very Hard", "In what year were the first modern Olympic Games held?", "1888", "1900", "1896", "1912", "C", "They were held in Athens, Greece.", "Yes", "Holdout"],
  ["Q419", "Very Hard", "Which hormone, made by the pineal gland, helps control sleep?", "Serotonin", "Cortisol", "Melatonin", "Adrenaline", "C", "Darkness signals the body to make more melatonin.", "Yes", "Holdout"],
  ["Q420", "Very Hard", "What is the capital of Eritrea?", "Djibouti", "Mogadishu", "Asmara", "Khartoum", "C", "Asmara is known for its Italian-era modernist buildings.", "Yes", "Holdout"],
  ["Q421", "Very Hard", "Who composed The Planets orchestral suite?", "Edward Elgar", "Gustav Holst", "Ralph Vaughan Williams", "Benjamin Britten", "B", "Its seven movements are named for planets, including Mars, the Bringer of War.", "Yes", "Holdout"],
  ["Q422", "Very Hard", "Which element has atomic number 26?", "Copper", "Nickel", "Iron", "Cobalt", "C", "Iron is the most common element in Earth by mass.", "Yes", "Holdout"],
  ["Q423", "Very Hard", "Who painted Liberty Leading the People?", "Eugene Delacroix", "Jacques-Louis David", "Theodore Gericault", "Edouard Manet", "A", "It celebrates the French revolution of July 1830.", "Yes", "Holdout"],
  ["Q424", "Very Hard", "Which sea lies between Italy and Croatia?", "Aegean Sea", "Adriatic Sea", "Tyrrhenian Sea", "Black Sea", "B", "Venice sits at the northern end of the Adriatic.", "Yes", "Holdout"],
  ["Q425", "Very Hard", "Enceladus, a moon that sprays water geysers, orbits which planet?", "Jupiter", "Uranus", "Neptune", "Saturn", "D", "Its geysers feed one of Saturn's outer rings.", "Yes", "Holdout"],
  ["Q426", "Very Hard", "Who wrote Brave New World?", "George Orwell", "H. G. Wells", "Ray Bradbury", "Aldous Huxley", "D", "Brave New World was published in 1932.", "Yes", "Holdout"],
  ["Q427", "Very Hard", "What is the capital of Myanmar?", "Yangon", "Naypyidaw", "Mandalay", "Bangkok", "B", "Yangon was the capital until the government moved to Naypyidaw in 2005 and 2006.", "Yes", "Holdout"],
  ["Q428", "Very Hard", "In what year did the Spanish Armada sail against England?", "1492", "1603", "1588", "1666", "C", "Storms wrecked many of the Armada's ships on the way home.", "Yes", "Holdout"],
  ["Q429", "Very Hard", "What is the SI unit of force?", "Joule", "Pascal", "Watt", "Newton", "D", "It's named after Isaac Newton.", "Yes", "Holdout"],
  ["Q430", "Very Hard", "Who composed The Blue Danube waltz?", "Johann Strauss II", "Franz Schubert", "Johannes Brahms", "Franz Liszt", "A", "Strauss was known as the Waltz King.", "Yes", "Holdout"],
  ["Q431", "Very Hard", "Which Roman emperor ordered a wall built across northern Britain in AD 122?", "Trajan", "Claudius", "Hadrian", "Nero", "C", "Parts of Hadrian's Wall still stand today.", "Yes", "Holdout"],
  ["Q432", "Very Hard", "What is the capital of Ecuador?", "Quito", "Guayaquil", "Cuenca", "Lima", "A", "Quito sits about 9,350 feet above sea level, close to the equator.", "Yes", "Holdout"],
  ["Q433", "Very Hard", "Who discovered the neutron?", "Ernest Rutherford", "J. J. Thomson", "Enrico Fermi", "James Chadwick", "D", "Chadwick discovered it in 1932.", "Yes", "Holdout"],
  ["Q434", "Very Hard", "The Rosetta Stone helped scholars decode which writing system?", "Linear B", "Cuneiform", "Mayan glyphs", "Egyptian hieroglyphs", "D", "The same text appears on it in three scripts.", "Yes", "Holdout"],
  ["Q435", "Very Hard", "What is the capital of the country of Georgia?", "Baku", "Tbilisi", "Yerevan", "Batumi", "B", "Tbilisi is famous for its sulfur bathhouses.", "Yes", "Holdout"],
  ["Q436", "Very Hard", "What is the longest bone in the human arm?", "Humerus", "Radius", "Ulna", "Scapula", "A", "The funny bone is actually a nerve that runs near the humerus.", "Yes", "Holdout"],
  ["Q437", "Very Hard", "Which author created the detective Hercule Poirot?", "Dorothy L. Sayers", "Arthur Conan Doyle", "Agatha Christie", "P. D. James", "C", "Agatha Christie wrote more than 30 novels about Poirot.", "Yes", "Holdout"],
  ["Q438", "Very Hard", "In what year did a person first travel into space?", "1957", "1963", "1961", "1969", "C", "Yuri Gagarin orbited Earth on April 12, 1961.", "Yes", "Holdout"],
  ["Q439", "Very Hard", "What is the capital of Croatia?", "Zagreb", "Split", "Belgrade", "Sarajevo", "A", "The necktie traces its roots to scarves worn by Croatian soldiers.", "Yes", "Holdout"],
  ["Q440", "Very Hard", "Who wrote the music that includes In the Hall of the Mountain King?", "Edvard Grieg", "Jean Sibelius", "Carl Nielsen", "Antonin Dvorak", "A", "It was written for the play Peer Gynt.", "Yes", "Holdout"],
  ["Q441", "Very Hard", "Which protein carries oxygen in red blood cells?", "Insulin", "Keratin", "Collagen", "Hemoglobin", "D", "Hemoglobin is what makes blood red.", "Yes", "Holdout"],
  ["Q442", "Very Hard", "Which country used to be called Siam?", "Cambodia", "Myanmar", "Laos", "Thailand", "D", "Siam officially became Thailand in 1939.", "Yes", "Holdout"],
  ["Q443", "Very Hard", "Which country used to be called Ceylon?", "Bangladesh", "Myanmar", "Maldives", "Sri Lanka", "D", "Ceylon tea is still sold under the old name.", "Yes", "Holdout"],
  ["Q444", "Very Hard", "Which country was known to the West as Persia until 1935?", "Iraq", "Turkey", "Afghanistan", "Iran", "D", "Iranians had long called their country Iran.", "Yes", "Holdout"],
  ["Q445", "Very Hard", "What is the capital of Albania?", "Skopje", "Podgorica", "Tirana", "Pristina", "C", "Tirana became Albania's capital in 1920.", "Yes", "Holdout"],
  ["Q446", "Very Hard", "Which ancient Greek mathematician wrote the geometry book Elements?", "Archimedes", "Pythagoras", "Thales", "Euclid", "D", "Elements was used as a textbook for more than 2,000 years.", "Yes", "Holdout"],
  ["Q447", "Very Hard", "In what year did the Wall Street stock market crash that began the Great Depression?", "1919", "1929", "1933", "1939", "B", "The worst days were in late October 1929.", "Yes", "Holdout"],
  ["Q448", "Very Hard", "Which instrument family does the bassoon belong to?", "Brass", "Strings", "Percussion", "Woodwinds", "D", "Unrolled, a bassoon's tube would be about 8 feet long.", "Yes", "Holdout"],
  ["Q449", "Very Hard", "Who wrote The Prince, a famous book about political power?", "Thomas Hobbes", "Thomas More", "Niccolo Machiavelli", "Erasmus", "C", "The word Machiavellian comes from his name.", "Yes", "Holdout"],
  ["Q450", "Very Hard", "What is the capital of Namibia?", "Windhoek", "Gaborone", "Lusaka", "Harare", "A", "Namibia is home to some of the tallest sand dunes in the world.", "Yes", "Holdout"],
  ["Q451", "Very Hard", "Which element has the chemical symbol Ar?", "Arsenic", "Argon", "Silver", "Gold", "B", "Argon makes up about 1 percent of the air we breathe.", "Yes", "Holdout"],
  ["Q452", "Very Hard", "Who painted the Water Lilies series?", "Claude Monet", "Pierre-Auguste Renoir", "Edgar Degas", "Paul Cezanne", "A", "Monet painted the lily pond at his home in Giverny for decades.", "Yes", "Holdout"],
  ["Q453", "Very Hard", "What is the capital of Uruguay?", "Asuncion", "Montevideo", "Buenos Aires", "Punta del Este", "B", "Montevideo sits on the Rio de la Plata, across from Buenos Aires.", "Yes", "Holdout"],
  ["Q454", "Very Hard", "Whose experiments with pea plants founded the science of genetics?", "Gregor Mendel", "Charles Darwin", "Louis Pasteur", "James Watson", "A", "Mendel was a monk in what is now the Czech Republic.", "Yes", "Holdout"],
  ["Q455", "Very Hard", "What is the longest river entirely within France?", "Seine", "Rhone", "Garonne", "Loire", "D", "The Loire Valley is famous for its castles.", "Yes", "Holdout"],
  ["Q456", "Very Hard", "In what year was Napoleon defeated at the Battle of Waterloo?", "1805", "1815", "1812", "1821", "B", "Waterloo is in present-day Belgium.", "Yes", "Holdout"],
  ["Q457", "Very Hard", "What is the capital of Kyrgyzstan?", "Almaty", "Tashkent", "Dushanbe", "Bishkek", "D", "Bishkek sits at the foot of the Tian Shan mountains.", "Yes", "Holdout"],
  ["Q458", "Very Hard", "Who wrote the epic poem Paradise Lost?", "John Milton", "William Blake", "Geoffrey Chaucer", "Edmund Spenser", "A", "Milton was blind when he wrote it and dictated the lines.", "Yes", "Holdout"],
  ["Q459", "Very Hard", "Which composer wrote the Messiah oratorio, including the Hallelujah chorus?", "Johann Sebastian Bach", "George Frideric Handel", "Joseph Haydn", "Henry Purcell", "B", "Handel wrote Messiah in about three weeks in 1741.", "Yes", "Holdout"],
  ["Q460", "Very Hard", "What is the smallest bone in the human ear called in plain English?", "Hammer", "Anvil", "Stirrup", "Drum", "C", "Its scientific name is the stapes.", "Yes", "Holdout"],
  ["Q461", "Very Hard", "What is the capital of Mozambique?", "Lusaka", "Harare", "Lilongwe", "Maputo", "D", "Maputo sits on a bay of the Indian Ocean.", "Yes", "Holdout"]
];

// Version 8 fairness fixes: [question ID]: the old wording. If your sheet still has the old
// wording for that ID, setup replaces the row with the fixed version from STARTER_QUESTIONS.
// If you already edited that question yourself, it is left alone.
const QUESTION_FIXES_V8 = {
  "Q013": "What is the hardest naturally occurring mineral?",
  "Q018": "Which country has the most natural lakes?",
  "Q027": "Which country has the longest coastline in the world?",
  "Q038": "How many continents are there?",
  "Q056": "What shape has four equal sides and four right angles?",
  "Q082": "What is the largest organ of the human body?",
  "Q092": "Kangaroos are native to which country?",
  "Q115": "What is the largest organ inside the human body?",
  "Q144": "How many squares are on a standard chessboard?",
  "Q145": "What is the longest-running show in Broadway history?"
};

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
  login: login,
  useBonus: useBonus,
  getGuestQuestion: getGuestQuestion,
  logShare: logShare,
  reportQuestion: reportQuestion,
  createGuest: createGuest,
  saveAccount: saveAccount,
  startGuestEndless: startGuestEndless,
  startEndless: startEndless,
  answerEndless: answerEndless,
  getDaily: getDaily,
  answerDaily: answerDaily
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
      ['Tagline', 'How many trivia questions can you get right in a row?', 'Shown under the game name.'],
      ['Run Length (days)', '30', 'Endless runs that reach this many in a row go into the Hall of Fame.'],
      ['Time Zone', tz, 'Everyone\'s next question unlocks at midnight in this time zone. Also used for dates.']
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
  addSettingIfMissing_(settings, 'Game Website', 'https://holdouttrivia.com/',
    'The address players use. Invite links and the Admin Panel use it.');
  // Version 9: the old one-a-day tagline no longer fits the game.
  settings.getDataRange().getValues().forEach((r, k) => {
    if (String(r[0]).trim() === 'Tagline' && /^One question a day\. One wrong answer and you are out\.?$/.test(String(r[1]).trim())) {
      settings.getRange(k + 1, 2).setValue('How many trivia questions can you get right in a row?');
    }
  });
  // The site moved to holdouttrivia.com: update the old GitHub address so invite links use the real name.
  settings.getDataRange().getValues().forEach((r, k) => {
    if (String(r[0]).trim() === 'Game Website' && /^https:\/\/pickledbee\.github\.io\/holdout\/?$/i.test(String(r[1]).trim())) {
      settings.getRange(k + 1, 2).setValue('https://holdouttrivia.com/');
    }
  });
  addSettingIfMissing_(settings, 'Amazon Associate Tag', 'bumblepickleb-20',
    'Your Amazon affiliate tag. It is added to every Amazon link on the Ads tab automatically.');
  addSettingIfMissing_(settings, 'Show Amazon Picks', 'Yes',
    'Yes = show product picks from the Ads tab. No = hide all of them.');
  MailApp.getRemainingDailyQuota(); // makes Google ask for email permission during setup

  // ---- Upgrade data from earlier versions (safe to run again) ----
  const upgradeNotes = upgradeToV7_(ss);
  upgradeNotes.forEach(n => Logger.log(n));
  upgradeToV9_(ss).forEach(n => Logger.log(n));
  const fixed = applyQuestionFixes_(ss);
  if (fixed) Logger.log(fixed + ' question(s) updated with fairness fixes.');
  const added = addNewStarterQuestions_(ss);
  if (added) Logger.log(added + ' new question(s) added to the Questions tab.');

  // ---- Questions (filled in if empty) ----
  const questions = getOrCreate_(ss, TAB.QUESTIONS);
  if (questions.getLastRow() === 0) {
    questions.getRange(1, 1, 1, QUESTION_HEADERS.length).setValues([QUESTION_HEADERS]);
    questions.getRange(2, 1, STARTER_QUESTIONS.length, QUESTION_HEADERS.length).setValues(STARTER_QUESTIONS);
  }
  styleHeader_(questions, QUESTION_HEADERS.length);
  questions.setColumnWidth(1, 70);
  questions.setColumnWidth(2, 90);
  questions.setColumnWidth(3, 420);
  [4, 5, 6, 7].forEach(c => questions.setColumnWidth(c, 170));
  questions.setColumnWidth(8, 70);
  questions.setColumnWidth(9, 480);
  questions.setColumnWidth(10, 70);
  questions.setColumnWidth(11, 110);
  const qRows = Math.max(questions.getMaxRows() - 1, 500);
  if (questions.getMaxRows() < qRows + 1) questions.insertRowsAfter(questions.getMaxRows(), qRows + 1 - questions.getMaxRows());
  questions.getRange(2, 1, qRows, QUESTION_HEADERS.length).setWrap(true).setVerticalAlignment('top');
  questions.getRange(2, 1, qRows, 1).setNumberFormat('@');
  questions.getRange(2, 2, qRows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Easy', 'Medium', 'Hard', 'Very Hard'], true).build());
  questions.getRange(2, 8, qRows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['A', 'B', 'C', 'D'], true).build());
  questions.getRange(2, 10, qRows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Yes', 'No'], true).build());

  // ---- Players, Answers, Hall of Fame ----
  const players = ensureTab_(ss, TAB.PLAYERS, PLAYER_HEADERS);
  players.setColumnWidth(2, 180);
  players.hideColumns(P.HASH + 1, 2); // hide PIN Hash and Login Token
  players.getRange(2, P.LASTDATE + 1, Math.max(1, players.getMaxRows() - 1), 1).setNumberFormat('@');
  players.getRange(2, P.RESTARTDATE + 1, Math.max(1, players.getMaxRows() - 1), 1).setNumberFormat('@');
  [P.TODAYDATE, P.DAILYDATE, P.DAILYLASTDATE, P.BONUSDATE].forEach(c =>
    players.getRange(2, c + 1, Math.max(1, players.getMaxRows() - 1), 1).setNumberFormat('@'));
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
  const reports = ensureTab_(ss, TAB.REPORTS, REPORT_HEADERS);
  reports.setColumnWidth(1, 150);
  reports.setColumnWidth(6, 420);
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
    ['THE GAME (version 9)'],
    ['   ENDLESS: the main game. Play as much as you want. One life: a wrong answer ends the run, then just start another.'],
    ['      Questions get harder as a run goes: 1-5 Easy, 6-12 Medium, 13-20 Hard, 21 and up Very Hard.'],
    ['      The correct answer and fun fact show right after every answer. Score = how many in a row.'],
    ['      Reaching Run Length (Settings) in a row puts a player in the Hall of Fame.'],
    ['   DAILY HOLDOUT: the same 10 questions for everyone each day (3 Easy, 3 Medium, 2 Hard, 2 Very Hard).'],
    ['      One try per day, it stops at the first miss, and answers are revealed the next day. Daily streaks count days in a row.'],
    ['   NO SIGN-UP: the first answer creates a player with a fun automatic name saved on that device.'],
    ['      "Save my spot" lets them pick a name and PIN so they can log in on any device. Saved Account shows Yes or No.'],
    [''],
    ['COMEBACKS'],
    ['   Every player has a personal invite link. When a friend joins with it AND answers 3 questions, the inviter gets 1 comeback.'],
    ['   A comeback continues a run that just ended, with a different question at the same level.'],
    ['   Players can use up to Bonus Questions Per Day comebacks per day (Settings). Unused ones carry over.'],
    [''],
    ['QUESTION REPORTS'],
    ['   Players can tap "Report this question" (wrong answer, more than one right answer, or confusing).'],
    ['   Each report lands on the Question Reports tab. When a question gets 2 open reports, you get an email alert.'],
    ['   In the Admin Panel (Questions tab) you can bring back everyone a question knocked out, turn it off, edit it,'],
    ['      or mark the reports reviewed. The Admin Panel also flags questions that far fewer players get right than'],
    ['      others at the same level, which usually means confusing wording or a wrong answer key.'],
    [''],
    ['QUESTIONS TAB'],
    ['   ID: a code like Q012. Never change an ID once players have seen the question (answer history uses it).'],
    ['   Difficulty: Easy, Medium, Hard, or Very Hard. Correct: A, B, C, or D. Active?: No takes a question out of use.'],
    ['   Keep at least 20 active questions at each level so repeat players see new ones.'],
    [''],
    ['AMAZON PICKS (the Ads tab)'],
    ['   Show On: a question ID (like Q012) shows the pick on that question\'s answer reveal.'],
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
    ['   Questions: the question bank. Players never see the Correct column.'],
    ['   Players: filled in automatically. Status is Alive, Out, or Champion. PIN Hash and Login Token are hidden on purpose.'],
    ['   Answers: a log of every answer.'],
    ['   Hall of Fame: everyone who survived a full run.'],
    ['   Ads: your Amazon affiliate product picks.'],
    ['   Question Reports: questions players think are wrong or unfair.'],
    ['   Cheat Alerts: anything suspicious, newest at the bottom.'],
    [''],
    ['HOLDOUT ADMIN MENU (at the top of this sheet, next to Help)'],
    ['   Bring back players knocked out by a bad question: type its ID (like Q012). Also set that question to Active? No.'],
    ['   Give a player a bonus question: type their display name and they get 1 bonus.'],
    ['   Run the missed-day check now: counts missed days and pause days. Also runs by itself every hour.'],
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

  [TAB.HOWTO, TAB.SETTINGS, TAB.QUESTIONS, TAB.PLAYERS, TAB.ANSWERS, TAB.HALL, TAB.ADS, TAB.REPORTS, TAB.ALERTS].forEach((name, i) => {
    ss.setActiveSheet(ss.getSheetByName(name));
    ss.moveActiveSheet(i + 1);
  });

  installHourlyCheck_();
  Logger.log('Setup finished. Now deploy: Deploy > Manage deployments > pencil > New version > Deploy.');
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






// A visitor can try one Easy question before signing up.
function getGuestQuestion() {
  const id = pickQuestion_('Easy', [], []);
  const q = id ? question_(id) : null;
  if (!q) throw new Error('No questions are set up yet.');
  return { id: q.id, difficulty: q.difficulty, text: q.text, choices: { A: q.A, B: q.B, C: q.C, D: q.D } };
}






// Counts shares for the Admin Panel. Nothing in the game depends on it.
function logShare(kind) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'SHARES_TOTAL';
    props.setProperty(key, String((Number(props.getProperty(key)) || 0) + 1));
  } catch (err) { Logger.log(err); }
  return { ok: true };
}

// A player flags a question they think is wrong, has two right answers, or is confusing.
function reportQuestion(token, questionId, reason, note) {
  const reasons = { wrong: 'The answer key is wrong', two: 'More than one answer is right', confusing: 'The question is confusing' };
  if (!reasons[reason]) throw new Error('Pick a reason.');
  note = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  questionId = String(questionId || '').trim();
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const row = data.rows.find(r => r[P.TOKEN] && r[P.TOKEN] === token);
    if (!row) throw new Error('Please log in again.');
    const seen = seenList_(row[P.SEEN]);
    if (seen.indexOf(questionId) < 0 && String(row[P.LASTQ]) !== questionId) {
      throw new Error('You can only report a question you have answered.');
    }
    const q = question_(questionId);
    if (!q) throw new Error('That question was not found.');
    const sh = ss_().getSheetByName(TAB.REPORTS);
    const existing = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, REPORT_HEADERS.length).getValues() : [];
    if (existing.some(r => r[1] === questionId && r[2] === row[P.ID])) {
      return { ok: true, message: 'You already reported this question. Thanks!' };
    }
    sh.appendRow([new Date(), questionId, row[P.ID], row[P.NAME], reasons[reason], note, 'Open']);
    const open = existing.filter(r => r[1] === questionId && r[6] === 'Open').length + 1;
    if (open >= REPORT_ALERT_AT) {
      try {
        alert_('Question reported', String(row[P.NAME]),
          questionId + ' has ' + open + ' open reports. Latest: "' + reasons[reason] + '"' + (note ? ' (' + note + ')' : '') +
          '. Question: ' + q.text + ' Answer key: ' + q.correct + '. ' + (q[q.correct] || '') +
          '. Check it on the Questions tab of the Admin Panel. If it is unfair, use "Bring back everyone it knocked out."',
          'report|' + questionId + '|' + (open >= 5 ? 5 : REPORT_ALERT_AT));
      } catch (err) { Logger.log(err); }
    }
    return { ok: true, message: 'Thanks! The game organizer will review this question.' };
  } finally {
    lock.releaseLock();
  }
}

// Replaces questions that still have their old wording with the version 8 fairness fixes.
function applyQuestionFixes_(ss) {
  const sh = ss.getSheetByName(TAB.QUESTIONS);
  if (!sh || sh.getLastRow() < 2) return 0;
  const n = sh.getLastRow() - 1;
  const rows = sh.getRange(2, 1, n, QUESTION_HEADERS.length).getValues();
  const fresh = {};
  STARTER_QUESTIONS.forEach(r => { fresh[r[0]] = r; });
  let count = 0;
  rows.forEach((r, i) => {
    const id = String(r[0]).trim();
    if (QUESTION_FIXES_V8[id] && String(r[2]).trim() === QUESTION_FIXES_V8[id] && fresh[id]) {
      const f = fresh[id].slice();
      f[9] = r[9] === '' ? 'Yes' : r[9]; // keep the on/off setting
      sh.getRange(i + 2, 1, 1, QUESTION_HEADERS.length).setValues([f]);
      count++;
    }
  });
  return count;
}

// Adds any built-in questions the Questions tab doesn't have yet (runs once per question set).
// If one of your own questions already uses the same ID, the new question gets the next free ID instead.
const STARTER_SET_VERSION = 'v9';
function addNewStarterQuestions_(ss) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('STARTER_SET') === STARTER_SET_VERSION) return 0;
  const sh = ss.getSheetByName(TAB.QUESTIONS);
  if (!sh || sh.getLastRow() < 2) { props.setProperty('STARTER_SET', STARTER_SET_VERSION); return 0; }
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, QUESTION_HEADERS.length).getValues();
  const ids = {}, texts = {};
  let max = 0;
  rows.forEach(r => {
    const id = String(r[0]).trim();
    ids[id] = true;
    texts[normText_(r[2])] = true;
    const m = id.match(/^Q(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  const add = [];
  STARTER_QUESTIONS.forEach(r => {
    if (texts[normText_(r[2])]) return;
    const row = r.slice();
    if (ids[row[0]]) { max = Math.max(max, Number(String(row[0]).slice(1))); row[0] = qid_(++max); }
    ids[row[0]] = true;
    add.push(row);
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, QUESTION_HEADERS.length).setValues(add);
  QUESTION_CACHE_ = null;
  props.setProperty('STARTER_SET', STARTER_SET_VERSION);
  return add.length;
}

/* ---------------- run helpers ---------------- */






// Picks a random active question at a difficulty level, skipping ones already seen when possible.
function pickQuestion_(tier, seen, avoid) {
  const all = allQuestions_().filter(q => q.active);
  const notAvoid = all.filter(q => avoid.indexOf(q.id) < 0);
  const pools = [
    notAvoid.filter(q => q.difficulty === tier && seen.indexOf(q.id) < 0),
    notAvoid.filter(q => q.difficulty === tier),
    notAvoid.filter(q => seen.indexOf(q.id) < 0),
    notAvoid
  ];
  for (let p = 0; p < pools.length; p++) {
    if (pools[p].length) return pools[p][Math.floor(Math.random() * pools[p].length)].id;
  }
  return '';
}

function seenList_(v) { return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }

function addSeen_(v, id) {
  const list = seenList_(v).filter(x => x !== id);
  list.push(id);
  return list.slice(-1500).join(',');
}

let QUESTION_CACHE_ = null;
function allQuestions_() {
  if (QUESTION_CACHE_) return QUESTION_CACHE_;
  const sh = ss_().getSheetByName(TAB.QUESTIONS);
  const last = sh.getLastRow();
  if (last < 2) return (QUESTION_CACHE_ = []);
  QUESTION_CACHE_ = sh.getRange(2, 1, last - 1, QUESTION_HEADERS.length).getValues()
    .filter(r => String(r[0]).trim() && String(r[2]).trim())
    .map(r => ({
      id: String(r[0]).trim(), difficulty: normDifficulty_(r[1]), text: String(r[2]),
      A: String(r[3]), B: String(r[4]), C: String(r[5]), D: String(r[6]),
      correct: String(r[7]).trim().toUpperCase(), funFact: String(r[8] || ''),
      active: String(r[9] === '' ? 'Yes' : r[9]).trim().toLowerCase().indexOf('y') === 0
    }))
    .filter(q => ['A', 'B', 'C', 'D'].indexOf(q.correct) >= 0);
  return QUESTION_CACHE_;
}

function normDifficulty_(v) {
  const t = String(v || '').trim().toLowerCase();
  if (t.indexOf('very') === 0) return 'Very Hard';
  if (t.indexOf('hard') === 0) return 'Hard';
  if (t.indexOf('med') === 0) return 'Medium';
  return 'Easy';
}

function question_(id) {
  id = String(id || '').trim();
  return allQuestions_().find(q => q.id === id) || null;
}

function reveal_(id) {
  const q = question_(id);
  if (!q) return null;
  const stats = answerStats_(q.id);
  return { id: q.id, text: q.text, correctLetter: q.correct, correctText: q[q.correct] || '',
    funFact: q.funFact, answered: stats.answered, correct: stats.correct };
}

function answerStats_(id) {
  const sh = ss_().getSheetByName(TAB.ANSWERS);
  const last = sh.getLastRow();
  if (last < 2) return { answered: 0, correct: 0 };
  const rows = sh.getRange(2, 6, last - 1, 3).getValues(); // Question Used, Choice, Correct?
  let answered = 0, correct = 0;
  rows.forEach(r => {
    if (String(r[0]).trim() === id) {
      answered++;
      if (r[2] === 'Yes') correct++;
    }
  });
  return { answered: answered, correct: correct };
}

/* ---------------- date helpers (calendar days in the Time Zone setting) ---------------- */

function normDate_(v, s) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, s.tz, 'yyyy-MM-dd');
  const t = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}

function dayNum_(ymd) {
  const p = String(ymd).split('-').map(Number);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / DAY_MS);
}

function fromDayNum_(n) {
  return Utilities.formatDate(new Date(n * DAY_MS), 'UTC', 'yyyy-MM-dd');
}

function yesterdayKey_(s) { return fromDayNum_(dayNum_(todayKey_(s)) - 1); }

function secondsToReset_(s) {
  const t = Utilities.formatDate(new Date(), s.tz, 'HH:mm:ss').split(':').map(Number);
  return Math.max(1, 86400 - (t[0] * 3600 + t[1] * 60 + t[2]));
}

/* ---------------- one-time upgrade from earlier versions ---------------- */

const OLD_PLAYER_HEADERS_V6 = ['Player ID', 'Display Name', 'PIN Hash', 'Login Token', 'Joined', 'Confirmed 13+',
  'Status', 'Run Started', 'Attempt', 'Days Survived', 'Out On Day', 'Out Reason', 'Best Run',
  'Bonus Questions', 'Bonus Date', 'Bonus Used That Date', 'Invited By', 'Friends Invited',
  'Second Chance Question', 'Last Question', 'Devices', 'Fast Answers', 'Question Shown At', 'Shown Question'];

function legacyId_(label) {
  const t = String(label || '').trim();
  if (/^\d+$/.test(t)) return 'Q' + ('00' + t).slice(-3);
  const m = t.match(/^backup\s*(\d+)$/i);
  if (m) return 'Q' + ('00' + (30 + Number(m[1]))).slice(-3);
  return t;
}

function upgradeToV7_(ss) {
  const s = settings_();
  const notes = [];

  // Questions: Day labels -> question IDs, add Active? column, add the new question bank
  const qs = ss.getSheetByName(TAB.QUESTIONS);
  if (qs && qs.getLastRow() > 0 && String(qs.getRange(1, 1).getValue()).trim() === 'Day') {
    qs.copyTo(ss).setName('Questions (before v7)');
    const old = qs.getLastRow() > 1 ? qs.getRange(2, 1, qs.getLastRow() - 1, 9).getValues() : [];
    let extra = 900;
    const rows = old.filter(r => String(r[2]).trim()).map(r => {
      const label = String(r[0]).trim();
      let id = legacyId_(label), active = 'Yes';
      if (!/^Q\d{3}$/.test(id)) { id = 'Q' + (extra++); active = 'No'; }
      let text = String(r[2]);
      if (id === 'Q030' && /^What is the largest desert on Earth\?$/.test(text.trim())) text = STARTER_QUESTIONS[29][2];
      return [id, normDifficulty_(r[1]), text, r[3], r[4], r[5], r[6], String(r[7]).trim().toUpperCase(), r[8], active, 'Holdout'];
    });
    const have = {};
    rows.forEach(r => { have[r[0]] = true; });
    STARTER_QUESTIONS.forEach(r => { if (!have[r[0]]) rows.push(r.slice()); });
    qs.clear();
    qs.getRange(1, 1, 1, QUESTION_HEADERS.length).setValues([QUESTION_HEADERS]);
    if (rows.length) qs.getRange(2, 1, rows.length, QUESTION_HEADERS.length).setValues(rows);
    notes.push('Questions upgraded to question IDs (old copy saved as "Questions (before v7)").');
  }

  // Players: rename one column, add new columns, keep everyone's progress
  const ps = ss.getSheetByName(TAB.PLAYERS);
  if (ps && ps.getLastRow() > 0 && String(ps.getRange(1, P.CURQ + 1).getValue()) === 'Second Chance Question') {
    ps.getRange(1, 1, 1, PLAYER_HEADERS.length).setValues([PLAYER_HEADERS]);
    styleHeader_(ps, PLAYER_HEADERS.length);
    if (ps.getLastRow() > 1) {
      const n = ps.getLastRow() - 1;
      const rows = ps.getRange(2, 1, n, PLAYER_HEADERS.length).getValues();
      const yesterday = yesterdayKey_(s);
      rows.forEach(r => {
        r[P.CURQ] = '';
        r[P.LASTQ] = legacyId_(r[P.LASTQ]);
        r[P.SHOWNQ] = '';
        r[P.PAUSES] = 0;
        r[P.COMEBACKS] = 0;
        r[P.SEEN] = r[P.LASTQ] || '';
        r[P.LASTDATE] = r[P.STATUS] === 'Alive' ? yesterday : '';
        r[P.RESTARTDATE] = '';
        if (r[P.REASON] === 'Missed a day') r[P.REASON] = 'Missed too many days';
      });
      ps.getRange(2, P.LASTDATE + 1, n, 1).setNumberFormat('@');
      ps.getRange(2, 1, n, PLAYER_HEADERS.length).setValues(rows);
    }
    notes.push('Players upgraded. Everyone still in a run keeps their progress, and their next question is available now.');
  }

  // Answers: old Day labels in Question Used -> question IDs
  const as = ss.getSheetByName(TAB.ANSWERS);
  if (as && as.getLastRow() > 1 && !PropertiesService.getScriptProperties().getProperty('V7_ANSWERS')) {
    const n = as.getLastRow() - 1;
    const col = as.getRange(2, 6, n, 1).getValues().map(r => [legacyId_(r[0])]);
    as.getRange(2, 6, n, 1).setValues(col);
    PropertiesService.getScriptProperties().setProperty('V7_ANSWERS', 'done');
  }

  // Ads: Day numbers in Show On -> question IDs
  const ads = ss.getSheetByName(TAB.ADS);
  if (ads && ads.getLastRow() > 1) {
    const n = ads.getLastRow() - 1;
    const col = ads.getRange(2, 1, n, 1).getValues().map(r => [legacyId_(r[0])]);
    ads.getRange(2, 1, n, 1).setNumberFormat('@').setValues(col);
  }

  return notes;
}

/* =============================================================
 * CALLED BY THE GAME WEBSITE (version 9: Endless + Daily)
 * =============================================================
 * ENDLESS (the main game)
 *   - Play as much as you want. One life: a wrong answer ends the run.
 *   - Questions get harder as the run goes: 1-5 Easy, 6-12 Medium,
 *     13-20 Hard, 21 and up Very Hard. Score = how many in a row.
 *   - The correct answer and fun fact show right after each answer.
 *   - Start a new run any time. Reaching Run Length in a row (30)
 *     puts you in the Hall of Fame.
 *   - Comebacks: each friend who joins with your link AND answers
 *     3 questions earns you 1 bonus. A bonus continues a lost run
 *     with a different question. Up to Bonus Questions Per Day per day.
 * DAILY HOLDOUT
 *   - The same 10 questions for everyone each day (3 Easy, 3 Medium,
 *     2 Hard, 2 Very Hard). One try per day, stops at the first miss.
 *   - Answers are revealed the next day. Daily streaks count days played in a row.
 * ACCOUNTS
 *   - No sign-up needed. The first answer creates a player with a fun
 *     automatic name saved on that device. "Save my spot" adds a name
 *     and PIN so they can log in anywhere.
 * ============================================================= */

const DAILY_PLAN = ['Easy', 'Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Very Hard', 'Very Hard'];
const REF_CREDIT_AFTER = 3; // a friend must answer this many questions before the inviter gets a bonus

function endlessTier_(n) {
  if (n <= 5) return 'Easy';
  if (n <= 12) return 'Medium';
  if (n <= 20) return 'Hard';
  return 'Very Hard';
}

/* ---------------- state ---------------- */

function getState(token, ref) {
  const s = settings_();
  const state = {
    gameName: s.gameName,
    tagline: s.tagline,
    hallAt: s.length,
    bonusLimit: s.bonusPerDay,
    shareUrl: gameUrl_(),
    referrerName: '',
    player: null,
    question: null,
    answeredToday: dayCount_('ANS_', s),
    playersToday: dayCount_('PLAY_', s),
    disclosure: s.showAds ? AMAZON_DISCLOSURE : '',
    slotAd: null
  };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    if (ref && !token) {
      const refRow = data.rows.find(r => r[P.ID] === ref);
      if (refRow) state.referrerName = String(refRow[P.NAME]);
    }
    const i = token ? findTokenRow_(data, token) : -1;
    if (i < 0) return state;
    const row = data.rows[i];
    let changed = false;
    if (row[P.STATUS] === 'Alive') {
      const served = serveEndless_(row, s);
      if (served.changed) changed = true;
      if (served.q) state.question = publicQuestion_(served.q, (Number(row[P.DAYS]) || 0) + 1, served.secondChance);
    }
    if (changed) writePlayer_(data.sh, i, row);
    state.player = profile_(row, data, s);
    state.circle = circle_(row, data, s);
  } finally {
    lock.releaseLock();
  }
  try {
    if (s.showAds && state.player && state.player.status === 'Out') state.slotAd = pickAd_('Knockout', s);
  } catch (err) { Logger.log(err); }
  return state;
}

function profile_(row, data, s) {
  const today = todayKey_(s);
  const score = Number(row[P.DAYS]) || 0;
  const status = String(row[P.STATUS] || 'Ready');
  const bonus = Number(row[P.BONUS]) || 0;
  const usedToday = bonusUsedToday_(row, s);
  const reason = String(row[P.REASON] || '');
  const bestOf = r => Math.max(Number(r[P.BEST]) || 0, Number(r[P.DAYS]) || 0);
  const named = data.rows.filter(r => r[P.NAME]);
  const myBest = bestOf(row);
  const base = gameUrl_();
  return {
    name: String(row[P.NAME]),
    saved: String(row[P.SAVED]) === 'Yes',
    status: status,
    score: score,
    best: myBest,
    attempt: Number(row[P.ATTEMPT]) || 1,
    outOn: Number(row[P.OUTDAY]) || 0,
    outReason: reason,
    comebacks: Number(row[P.COMEBACKS]) || 0,
    bonus: bonus,
    bonusUsedToday: usedToday,
    canComeBack: status === 'Out' && reason === 'Wrong answer' && bonus > 0 && usedToday < s.bonusPerDay,
    friendsInvited: Number(row[P.FRIENDS]) || 0,
    inviteUrl: base ? base + (base.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + row[P.ID] : '',
    lastQuestionId: String(row[P.LASTQ] || ''),
    rank: 1 + named.filter(r => bestOf(r) > myBest).length,
    totalPlayers: named.length,
    dailyDoneToday: normDate_(row[P.DAILYDATE], s) === today && String(row[P.DAILYDONE]) === 'Yes',
    dailyStreak: dailyStreakNow_(row, s),
    dailyBest: Number(row[P.DAILYBEST]) || 0
  };
}

function circle_(row, data, s) {
  const today = todayKey_(s);
  return data.rows.filter(r => r[P.NAME] && r[P.ID] !== row[P.ID] && (r[P.ID] === row[P.REFBY] || r[P.REFBY] === row[P.ID]))
    .map(r => ({
      name: String(r[P.NAME]),
      relation: r[P.ID] === row[P.REFBY] ? 'invited you' : 'you invited',
      best: Math.max(Number(r[P.BEST]) || 0, Number(r[P.DAYS]) || 0),
      playing: r[P.STATUS] === 'Alive' ? Number(r[P.DAYS]) || 0 : null,
      dailyToday: normDate_(r[P.DAILYDATE], s) === today && String(r[P.DAILYDONE]) === 'Yes' ? Number(r[P.DAILYSCORE]) || 0 : null
    }))
    .sort((a, b) => b.best - a.best || a.name.localeCompare(b.name));
}

function getLeaderboard() {
  const s = settings_();
  const today = todayKey_(s);
  const rows = readPlayers_().rows.filter(r => r[P.NAME]);
  const bestOf = r => Math.max(Number(r[P.BEST]) || 0, Number(r[P.DAYS]) || 0);

  const allTime = rows.map(r => ({ name: String(r[P.NAME]), best: bestOf(r) }))
    .filter(r => r.best > 0).sort((a, b) => b.best - a.best || a.name.localeCompare(b.name)).slice(0, 20);
  const todayBest = rows.filter(r => normDate_(r[P.TODAYDATE], s) === today)
    .map(r => ({ name: String(r[P.NAME]), best: Number(r[P.TODAYBEST]) || 0 }))
    .filter(r => r.best > 0).sort((a, b) => b.best - a.best || a.name.localeCompare(b.name)).slice(0, 10);
  const liveNow = rows.filter(r => r[P.STATUS] === 'Alive' && Number(r[P.DAYS]) > 0)
    .map(r => ({ name: String(r[P.NAME]), score: Number(r[P.DAYS]) || 0, comebacks: Number(r[P.COMEBACKS]) || 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 10);
  const daily = rows.filter(r => normDate_(r[P.DAILYDATE], s) === today && String(r[P.DAILYDONE]) === 'Yes')
    .map(r => ({ name: String(r[P.NAME]), score: Number(r[P.DAILYSCORE]) || 0, streak: dailyStreakNow_(r, s) }))
    .sort((a, b) => b.score - a.score || b.streak - a.streak || a.name.localeCompare(b.name));
  const recruiters = rows.filter(r => Number(r[P.FRIENDS]) > 0)
    .map(r => ({ name: String(r[P.NAME]), friends: Number(r[P.FRIENDS]) }))
    .sort((a, b) => b.friends - a.friends || a.name.localeCompare(b.name)).slice(0, 5);

  const hallSheet = ss_().getSheetByName(TAB.HALL);
  let hall = [];
  if (hallSheet.getLastRow() > 1) {
    hall = hallSheet.getRange(2, 1, hallSheet.getLastRow() - 1, HALL_HEADERS.length).getValues()
      .filter(r => r[1])
      .map(r => ({ name: String(r[1]), date: r[0] instanceof Date ? Utilities.formatDate(r[0], s.tz, 'MMM d, yyyy') : String(r[0]),
        comebacks: Number(r[4]) || 0 }))
      .reverse().slice(0, 25);
  }
  return {
    allTime: allTime, today: todayBest, liveNow: liveNow, daily: daily.slice(0, 20), dailyPlayed: daily.length,
    recruiters: recruiters, hall: hall, hallAt: s.length, total: rows.length,
    answeredToday: dayCount_('ANS_', s)
  };
}

/* ---------------- accounts ---------------- */

const NAME_ADJ = ['Curious', 'Brave', 'Clever', 'Lucky', 'Swift', 'Sunny', 'Witty', 'Bold', 'Jolly', 'Mighty', 'Quiet', 'Zippy',
  'Cosmic', 'Daring', 'Eager', 'Fancy', 'Gentle', 'Happy', 'Nimble', 'Plucky', 'Rapid', 'Sharp', 'Snappy', 'Wise'];
const NAME_ANIMAL = ['Otter', 'Falcon', 'Badger', 'Panda', 'Fox', 'Owl', 'Moose', 'Koala', 'Tiger', 'Walrus', 'Heron', 'Lynx',
  'Puffin', 'Beaver', 'Gecko', 'Llama', 'Raven', 'Bison', 'Dolphin', 'Hedgehog', 'Penguin', 'Squirrel', 'Turtle', 'Yak'];

function autoName_(rows) {
  const taken = {};
  rows.forEach(r => { taken[String(r[P.NAME]).toLowerCase()] = true; });
  for (let t = 0; t < 50; t++) {
    const n = NAME_ADJ[Math.floor(Math.random() * NAME_ADJ.length)] + ' ' +
      NAME_ANIMAL[Math.floor(Math.random() * NAME_ANIMAL.length)] + ' ' + (10 + Math.floor(Math.random() * 90));
    if (!taken[n.toLowerCase()]) return n;
  }
  return 'Player ' + Utilities.getUuid().slice(0, 6);
}

// Creates a player with an automatic name. Returns the row index.
function createPlayer_(data, s, deviceId, ref) {
  const now = Date.now();
  const id = 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  const row = new Array(PLAYER_HEADERS.length).fill('');
  row[P.ID] = id;
  row[P.NAME] = autoName_(data.rows);
  row[P.TOKEN] = Utilities.getUuid();
  row[P.JOINED] = new Date(now);
  row[P.AGE] = 'Yes (played)';
  row[P.STATUS] = 'Ready';
  row[P.START] = new Date(now);
  row[P.ATTEMPT] = 0;
  row[P.DAYS] = 0;
  row[P.BEST] = 0;
  row[P.BONUS] = 0;
  row[P.FRIENDS] = 0;
  row[P.FAST] = 0;
  row[P.COMEBACKS] = 0;
  row[P.TOTALANS] = 0;
  row[P.SAVED] = 'No';
  row[P.DEVICES] = cleanDevice_(deviceId);
  ref = String(ref || '');
  if (/^P[a-f0-9]{10}$/.test(ref) && data.rows.some(r => r[P.ID] === ref)) row[P.REFBY] = ref;
  data.sh.appendRow(row);
  data.rows.push(row);
  bumpCount_('PLAY_', s);
  try { if (row[P.DEVICES]) sameDeviceCheck_(data.rows.slice(0, -1), row, row[P.DEVICES]); } catch (err) { Logger.log(err); }
  return data.rows.length - 1;
}

function createGuest(deviceId, ref) {
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = createPlayer_(data, s, deviceId, ref);
    return { token: data.rows[i][P.TOKEN] };
  } finally {
    lock.releaseLock();
  }
}

// Turns an automatic player into a saved one with a chosen name and PIN.
function saveAccount(token, name, pin, confirmed13) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  pin = String(pin || '').trim();
  if (!confirmed13) throw new Error('Please confirm you are 13 or older.');
  if (!/^[A-Za-z0-9 _.\-]{2,20}$/.test(name)) {
    throw new Error('Pick a name 2 to 20 characters long, using letters, numbers, spaces, dashes, dots, or underscores.');
  }
  if (!/^\d{4,6}$/.test(pin)) throw new Error('Your PIN must be 4 to 6 numbers.');
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = findTokenRow_(data, token);
    if (i < 0) throw new Error('Please play a question first.');
    if (data.rows.some((r, j) => j !== i && String(r[P.NAME]).toLowerCase() === name.toLowerCase())) {
      throw new Error('That name is taken. Try another one.');
    }
    const row = data.rows[i];
    row[P.NAME] = name;
    row[P.HASH] = hash_(row[P.ID], pin);
    row[P.SAVED] = 'Yes';
    row[P.AGE] = 'Yes';
    writePlayer_(data.sh, i, row);
    return { ok: true, player: profile_(row, data, s) };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Endless ---------------- */

// First answer from a brand-new visitor: creates their player and starts their first run.
// The website sends the question text too, so an answer is never graded against a different question.
function startGuestEndless(deviceId, ref, questionId, choice, questionText) {
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = createPlayer_(data, s, deviceId, ref);
    const row = data.rows[i];
    startRun_(row, s);
    const q = question_(String(questionId || ''));
    const same = q && q.active && (!questionText || normText_(q.text) === normText_(questionText));
    if (!same) {
      // The page had an old copy of that question: hand them a fresh one instead of grading.
      const served = serveEndless_(row, s);
      writePlayer_(data.sh, i, row);
      return { retry: true, token: row[P.TOKEN], question: served.q ? publicQuestion_(served.q, 1, false) : null,
        player: profile_(row, data, s) };
    }
    row[P.CURQ] = q.id;
    const res = answerEndlessRow_(data, i, choice, s);
    res.token = row[P.TOKEN];
    return res;
  } finally {
    lock.releaseLock();
  }
}

function startEndless(token) {
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = findTokenRow_(data, token);
    if (i < 0) throw new Error('Please refresh the page.');
    const row = data.rows[i];
    if (row[P.STATUS] === 'Alive' && (Number(row[P.DAYS]) || 0) > 0) {
      throw new Error('You are in the middle of a run. Finish it first!');
    }
    if (row[P.REASON] === 'Removed by admin' && row[P.STATUS] === 'Out') throw new Error('This account was paused by the game organizer.');
    startRun_(row, s);
    const served = serveEndless_(row, s);
    writePlayer_(data.sh, i, row);
    return { question: served.q ? publicQuestion_(served.q, 1, false) : null, player: profile_(row, data, s) };
  } finally {
    lock.releaseLock();
  }
}

function answerEndless(token, choice) {
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = findTokenRow_(data, token);
    if (i < 0) throw new Error('Please refresh the page.');
    return answerEndlessRow_(data, i, choice, s);
  } finally {
    lock.releaseLock();
  }
}

function answerEndlessRow_(data, i, choice, s) {
  choice = String(choice || '').toUpperCase();
  if (!/^[ABCD]$/.test(choice)) throw new Error('Pick A, B, C, or D.');
  const row = data.rows[i];
  if (row[P.STATUS] !== 'Alive') throw new Error('Start a new run to keep playing.');
  const served = serveEndless_(row, s);
  const q = served.q;
  if (!q) throw new Error('No questions are available right now.');
  const now = Date.now();
  const n = (Number(row[P.DAYS]) || 0) + 1;
  const correct = choice === q.correct;
  const shownKey = q.id + '|' + (Number(row[P.ATTEMPT]) || 1) + '|' + n;
  const secs = (String(row[P.SHOWNQ]) === shownKey && Number(row[P.SHOWNAT]))
    ? Math.round((now - Number(row[P.SHOWNAT])) / 100) / 10 : '';
  ss_().getSheetByName(TAB.ANSWERS).appendRow(
    [new Date(now), row[P.ID], row[P.NAME], row[P.ATTEMPT], n, q.id, choice, correct ? 'Yes' : 'No', secs, 'Endless']);
  bumpCount_('ANS_', s);
  lightningCheck_(row, q, correct, secs);

  row[P.TOTALANS] = (Number(row[P.TOTALANS]) || 0) + 1;
  row[P.LASTQ] = q.id;
  row[P.LASTDATE] = todayKey_(s);
  row[P.CURQ] = '';
  row[P.SEEN] = addSeen_(row[P.SEEN], q.id);
  let hall = false;
  if (correct) {
    row[P.DAYS] = n;
    row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, n);
    const today = todayKey_(s);
    if (normDate_(row[P.TODAYDATE], s) !== today) { row[P.TODAYDATE] = today; row[P.TODAYBEST] = 0; }
    row[P.TODAYBEST] = Math.max(Number(row[P.TODAYBEST]) || 0, n);
    if (n === s.length) {
      hall = true;
      ss_().getSheetByName(TAB.HALL).appendRow([new Date(now), row[P.NAME], row[P.ATTEMPT], n, Number(row[P.COMEBACKS]) || 0]);
    }
  } else {
    row[P.STATUS] = 'Out';
    row[P.OUTDAY] = n;
    row[P.REASON] = 'Wrong answer';
  }
  let next = null;
  if (correct) {
    const sv = serveEndless_(row, s);
    if (sv.q) next = publicQuestion_(sv.q, n + 1, false);
  }
  creditReferral_(data, row, s);
  writePlayer_(data.sh, i, row);
  formatDateCells_(data.sh, i);

  let ad = null;
  try {
    if (s.showAds && !correct) ad = pickAd_(q.id, s) || pickAd_('Knockout', s);
  } catch (err) { Logger.log(err); }
  return {
    correct: correct,
    questionId: q.id,
    yourChoice: choice,
    correctLetter: q.correct,
    correctText: q[q.correct] || '',
    funFact: q.funFact,
    stats: answerStats_(q.id),
    score: correct ? n : n - 1,
    hallOfFame: hall,
    next: next,
    player: profile_(row, data, s),
    ad: ad,
    disclosure: s.showAds ? AMAZON_DISCLOSURE : ''
  };
}

// Spend 1 bonus to continue a lost run with a different question at the same level.
function useBonus(token) {
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = findTokenRow_(data, token);
    if (i < 0) throw new Error('Please refresh the page.');
    const row = data.rows[i];
    if (row[P.STATUS] !== 'Out' || row[P.REASON] !== 'Wrong answer') throw new Error('Comebacks are for continuing a run that just ended.');
    if ((Number(row[P.BONUS]) || 0) <= 0) throw new Error('You need a comeback first. When a friend joins with your link and answers 3 questions, you get one.');
    const used = bonusUsedToday_(row, s);
    if (used >= s.bonusPerDay) throw new Error('You have used your ' + s.bonusPerDay + ' comebacks for today. They will still be here tomorrow.');
    comeBack_(row, s);
    row[P.BONUS] = (Number(row[P.BONUS]) || 0) - 1;
    row[P.BONUSDATE] = todayKey_(s);
    row[P.BONUSUSED] = used + 1;
    const served = serveEndless_(row, s);
    writePlayer_(data.sh, i, row);
    return { question: served.q ? publicQuestion_(served.q, (Number(row[P.DAYS]) || 0) + 1, true) : null, player: profile_(row, data, s) };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Daily Holdout ---------------- */

function getDaily(token) {
  const s = settings_();
  const today = todayKey_(s);
  const ids = dailyIds_(today);
  const out = {
    date: today,
    label: Utilities.formatDate(new Date(), s.tz, 'MMMM d'),
    total: ids.length,
    started: false, done: false, index: 0, score: 0, results: [],
    question: null,
    streak: 0,
    secondsToTomorrow: secondsToReset_(s),
    yesterday: yesterdayReveal_(s)
  };
  if (!token) {
    const q = question_(ids[0]);
    if (q) out.question = publicQuestion_(q, 1, false);
    return out;
  }
  const data = readPlayers_();
  const i = findTokenRow_(data, token);
  if (i < 0) {
    const q = question_(ids[0]);
    if (q) out.question = publicQuestion_(q, 1, false);
    return out;
  }
  const row = data.rows[i];
  out.streak = dailyStreakNow_(row, s);
  if (normDate_(row[P.DAILYDATE], s) === today) {
    out.started = true;
    out.index = Number(row[P.DAILYIDX]) || 0;
    out.score = Number(row[P.DAILYSCORE]) || 0;
    out.done = String(row[P.DAILYDONE]) === 'Yes';
    out.results = dailyResults_(out.score, out.index, out.done);
  }
  if (!out.done) {
    const q = question_(ids[out.index]);
    if (q) out.question = publicQuestion_(q, out.index + 1, false);
  }
  return out;
}

function answerDaily(token, choice) {
  choice = String(choice || '').toUpperCase();
  if (!/^[ABCD]$/.test(choice)) throw new Error('Pick A, B, C, or D.');
  const s = settings_();
  const today = todayKey_(s);
  const ids = dailyIds_(today);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = findTokenRow_(data, token);
    if (i < 0) throw new Error('Please refresh the page.');
    const row = data.rows[i];
    if (normDate_(row[P.DAILYDATE], s) !== today) {
      row[P.DAILYDATE] = today; row[P.DAILYIDX] = 0; row[P.DAILYSCORE] = 0; row[P.DAILYDONE] = '';
    }
    if (String(row[P.DAILYDONE]) === 'Yes') throw new Error('You already played today\'s Daily. Come back tomorrow!');
    const idx = Number(row[P.DAILYIDX]) || 0;
    const q = question_(ids[idx]);
    if (!q) throw new Error('Today\'s Daily is not ready. Please try again later.');
    const correct = choice === q.correct;
    ss_().getSheetByName(TAB.ANSWERS).appendRow(
      [new Date(), row[P.ID], row[P.NAME], 'Daily ' + today, idx + 1, q.id, choice, correct ? 'Yes' : 'No', '', 'Daily']);
    bumpCount_('ANS_', s);
    row[P.TOTALANS] = (Number(row[P.TOTALANS]) || 0) + 1;
    row[P.SEEN] = addSeen_(row[P.SEEN], q.id);
    row[P.DAILYIDX] = idx + 1;
    if (correct) row[P.DAILYSCORE] = (Number(row[P.DAILYSCORE]) || 0) + 1;
    const finished = !correct || idx + 1 >= ids.length;
    if (finished) {
      row[P.DAILYDONE] = 'Yes';
      const prev = normDate_(row[P.DAILYLASTDATE], s);
      row[P.DAILYSTREAK] = prev === yesterdayKey_(s) ? (Number(row[P.DAILYSTREAK]) || 0) + 1 : 1;
      row[P.DAILYLASTDATE] = today;
      row[P.DAILYBEST] = Math.max(Number(row[P.DAILYBEST]) || 0, Number(row[P.DAILYSCORE]) || 0);
    }
    creditReferral_(data, row, s);
    writePlayer_(data.sh, i, row);
    formatDateCells_(data.sh, i);
    const score = Number(row[P.DAILYSCORE]) || 0;
    let next = null;
    if (!finished) {
      const nq = question_(ids[idx + 1]);
      if (nq) next = publicQuestion_(nq, idx + 2, false);
    }
    return {
      correct: correct, score: score, total: ids.length, done: finished, next: next,
      results: dailyResults_(score, idx + 1, finished),
      streak: dailyStreakNow_(row, s),
      secondsToTomorrow: secondsToReset_(s),
      player: profile_(row, data, s)
    };
  } finally {
    lock.releaseLock();
  }
}

// The same 10 questions for everyone on a given date. Saved once per day so later edits don't change it.
function dailyIds_(date) {
  const props = PropertiesService.getScriptProperties();
  const key = 'DAILY_' + date;
  const saved = props.getProperty(key);
  if (saved) { try { return JSON.parse(saved); } catch (e) {} }
  let seed = 0;
  for (let k = 0; k < date.length; k++) seed = (seed * 31 + date.charCodeAt(k)) >>> 0;
  const rand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const all = allQuestions_().filter(q => q.active);
  const used = {};
  const ids = DAILY_PLAN.map(tier => {
    let pool = all.filter(q => q.difficulty === tier && !used[q.id]);
    if (!pool.length) pool = all.filter(q => !used[q.id]);
    if (!pool.length) return '';
    const pick = pool[Math.floor(rand() * pool.length)];
    used[pick.id] = true;
    return pick.id;
  }).filter(Boolean);
  if (ids.length) props.setProperty(key, JSON.stringify(ids));
  return ids;
}

function dailyResults_(score, answered, done) {
  // 'g' = right, 'r' = the miss that ended it, 'n' = not reached
  const out = [];
  for (let k = 0; k < DAILY_PLAN.length; k++) {
    if (k < score) out.push('g');
    else if (done && k === score && answered > score) out.push('r');
    else out.push('n');
  }
  return out;
}

function yesterdayReveal_(s) {
  const y = yesterdayKey_(s);
  const saved = PropertiesService.getScriptProperties().getProperty('DAILY_' + y);
  if (!saved) return null;
  let ids = [];
  try { ids = JSON.parse(saved); } catch (e) { return null; }
  return {
    label: Utilities.formatDate(new Date(Date.now() - DAY_MS), s.tz, 'MMMM d'),
    questions: ids.map((id, k) => {
      const q = question_(id);
      return q ? { number: k + 1, text: q.text, answer: q.correct + '. ' + (q[q.correct] || ''), funFact: q.funFact } : null;
    }).filter(Boolean)
  };
}

function dailyStreakNow_(row, s) {
  const last = normDate_(row[P.DAILYLASTDATE], s);
  if (!last) return 0;
  return (last === todayKey_(s) || last === yesterdayKey_(s)) ? Number(row[P.DAILYSTREAK]) || 0 : 0;
}

/* ---------------- helpers for runs ---------------- */

function findTokenRow_(data, token) {
  if (!token) return -1;
  return data.rows.findIndex(r => r[P.TOKEN] && r[P.TOKEN] === token);
}

function publicQuestion_(q, number, secondChance) {
  return { id: q.id, number: number, difficulty: q.difficulty, secondChance: !!secondChance,
    text: q.text, choices: { A: q.A, B: q.B, C: q.C, D: q.D } };
}

// Resets a row to a fresh Endless run.
function startRun_(row, s) {
  row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, Number(row[P.DAYS]) || 0);
  row[P.STATUS] = 'Alive';
  row[P.START] = new Date();
  row[P.ATTEMPT] = (Number(row[P.ATTEMPT]) || 0) + 1;
  row[P.DAYS] = 0;
  row[P.OUTDAY] = '';
  row[P.REASON] = '';
  row[P.CURQ] = '';
  row[P.COMEBACKS] = 0;
  return true;
}

// Continues a lost run where it ended, with a different question at the same level.
function comeBack_(row, s) {
  const score = Number(row[P.DAYS]) || 0;
  row[P.STATUS] = 'Alive';
  row[P.OUTDAY] = '';
  row[P.REASON] = '';
  row[P.COMEBACKS] = (Number(row[P.COMEBACKS]) || 0) + 1;
  const pick = pickQuestion_(endlessTier_(score + 1), seenList_(row[P.SEEN]), [String(row[P.LASTQ] || '')]);
  row[P.CURQ] = pick ? '!' + pick : '';
}

// Kept so older admin tools keep working. Missed days no longer matter.
function checkMissed_(row, now, s) { return false; }

function serveEndless_(row, s) {
  const cur = String(row[P.CURQ] || '');
  const n = (Number(row[P.DAYS]) || 0) + 1;
  let q = null, second = false, changed = false;
  if (cur) {
    second = cur.charAt(0) === '!';
    q = question_(second ? cur.slice(1) : cur);
    if (q && !q.active) q = null;
  }
  if (!q) {
    const id = pickQuestion_(endlessTier_(n), seenList_(row[P.SEEN]), [String(row[P.LASTQ] || '')]);
    if (!id) return { q: null, changed: false, secondChance: false };
    row[P.CURQ] = id;
    q = question_(id);
    second = false;
    changed = true;
  }
  const shownKey = q.id + '|' + (Number(row[P.ATTEMPT]) || 1) + '|' + n;
  if (String(row[P.SHOWNQ]) !== shownKey) {
    row[P.SHOWNQ] = shownKey;
    row[P.SHOWNAT] = Date.now();
    changed = true;
  }
  return { q: q, changed: changed, secondChance: second };
}

// The inviter gets a bonus once the friend has really played (answered a few questions).
function creditReferral_(data, row, s) {
  if (!row[P.REFBY] || String(row[P.REFCREDITED]) === 'Yes') return;
  if ((Number(row[P.TOTALANS]) || 0) < REF_CREDIT_AFTER) return;
  const ri = data.rows.findIndex(r => r[P.ID] === row[P.REFBY]);
  row[P.REFCREDITED] = 'Yes';
  if (ri < 0) return;
  const refRow = data.rows[ri];
  refRow[P.BONUS] = (Number(refRow[P.BONUS]) || 0) + 1;
  refRow[P.FRIENDS] = (Number(refRow[P.FRIENDS]) || 0) + 1;
  writePlayer_(data.sh, ri, refRow);
  try {
    const now = Date.now();
    const recent = data.rows.filter(r => r[P.REFBY] === refRow[P.ID] && String(r[P.REFCREDITED]) === 'Yes' &&
      r[P.JOINED] instanceof Date && now - r[P.JOINED].getTime() < DAY_MS).length;
    if (recent >= CHEAT.BURST_FRIENDS) {
      alert_('Sign-up burst', String(refRow[P.NAME]),
        recent + ' people who joined with ' + refRow[P.NAME] + '\'s invite link in the last 24 hours have played. Newest: ' +
        row[P.NAME] + '. Could be real friends, or extra accounts made to earn comebacks.',
        'burst|' + refRow[P.ID] + '|' + todayKey_(s));
    }
  } catch (err) { Logger.log(err); }
}

function lightningCheck_(row, q, correct, secs) {
  if (!(correct && secs !== '' && secs < CHEAT.FAST_SECONDS && /hard/i.test(q.difficulty))) return;
  row[P.FAST] = (Number(row[P.FAST]) || 0) + 1;
  if (Number(row[P.FAST]) % CHEAT.FAST_COUNT !== 0) return;
  try {
    alert_('Lightning answers', String(row[P.NAME]),
      row[P.NAME] + ' has answered ' + row[P.FAST] + ' Hard or Very Hard questions correctly in under ' +
      CHEAT.FAST_SECONDS + ' seconds each. Latest: ' + q.id + ' in ' + secs + ' seconds.',
      'fast|' + row[P.ID] + '|' + row[P.FAST]);
  } catch (err) { Logger.log(err); }
}

function formatDateCells_(sh, i) {
  [P.LASTDATE, P.TODAYDATE, P.DAILYDATE, P.DAILYLASTDATE, P.BONUSDATE].forEach(c => {
    sh.getRange(i + 2, c + 1, 1, 1).setNumberFormat('@');
  });
}

// Simple daily counters (answers today, new players today) for social proof.
function bumpCount_(prefix, s) {
  try {
    const props = PropertiesService.getScriptProperties();
    const k = prefix + todayKey_(s);
    props.setProperty(k, String((Number(props.getProperty(k)) || 0) + 1));
  } catch (err) { Logger.log(err); }
}

function dayCount_(prefix, s) {
  try { return Number(PropertiesService.getScriptProperties().getProperty(prefix + todayKey_(s))) || 0; } catch (e) { return 0; }
}

/* ---------------- Open Trivia Database import ---------------- */
// Questions from opentdb.com are licensed CC BY-SA 4.0. The website shows a credit line for them.
// Only multiple-choice questions from evergreen categories are kept, and anything that could be
// tricky, outdated, or argued over is filtered out. Imported questions are marked Source = Open Trivia DB.

const OTDB_CATEGORIES = [9, 10, 12, 17, 20, 22, 23, 25, 27, 28]; // General, Books, Music, Science & Nature, Mythology, Geography, History, Art, Animals, Vehicles
const OTDB_DIFFICULTY = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function importOpenTrivia_(target) {
  target = Math.min(Math.max(Number(target) || 300, 50), 1000);
  const sh = ss_().getSheetByName(TAB.QUESTIONS);
  QUESTION_CACHE_ = null;
  const existing = allQuestions_();
  const seenText = {};
  existing.forEach(q => { seenText[normText_(q.text)] = true; });
  let maxId = existing.reduce((m, q) => Math.max(m, Number((q.id.match(/^Q(\d+)$/) || [0, 0])[1])), 0);
  const tokenRes = JSON.parse(UrlFetchApp.fetch('https://opentdb.com/api_token.php?command=request', { muteHttpExceptions: true }).getContentText() || '{}');
  const token = tokenRes.token || '';
  const added = [];
  let skipped = 0, calls = 0, emptyCats = {};
  const started = Date.now();
  while (added.length < target && calls < 40 && Date.now() - started < 4.5 * 60 * 1000) {
    const live = OTDB_CATEGORIES.filter(c => !emptyCats[c]);
    if (!live.length) break;
    const cat = live[calls % live.length];
    calls++;
    if (calls > 1) Utilities.sleep(5200); // the site allows one request every 5 seconds
    let res;
    try {
      res = JSON.parse(UrlFetchApp.fetch('https://opentdb.com/api.php?amount=50&type=multiple&encode=url3986&category=' + cat +
        (token ? '&token=' + token : ''), { muteHttpExceptions: true }).getContentText());
    } catch (e) { continue; }
    if (!res || res.response_code === 4 || res.response_code === 1) { emptyCats[cat] = true; continue; }
    if (res.response_code !== 0) continue;
    res.results.forEach(item => {
      if (added.length >= target) return;
      const d = s => decodeURIComponent(String(s || ''));
      const text = d(item.question).trim();
      const right = d(item.correct_answer).trim();
      const wrong = (item.incorrect_answers || []).map(x => d(x).trim());
      if (!okImported_(text, right, wrong) || seenText[normText_(text)]) { skipped++; return; }
      seenText[normText_(text)] = true;
      const letters = ['A', 'B', 'C', 'D'];
      const options = wrong.concat([right]);
      for (let k = options.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); const t = options[k]; options[k] = options[j]; options[j] = t; }
      const correct = letters[options.indexOf(right)];
      maxId++;
      added.push([qid_(maxId), OTDB_DIFFICULTY[item.difficulty] || 'Medium', text,
        options[0], options[1], options[2], options[3], correct, '', 'Yes', 'Open Trivia DB']);
    });
  }
  if (added.length) {
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, added.length, 1).setNumberFormat('@');
    sh.getRange(start, 1, added.length, QUESTION_HEADERS.length).setValues(added);
  }
  QUESTION_CACHE_ = null;
  return added.length + ' questions imported from the Open Trivia Database (' + skipped + ' skipped as tricky, outdated, or duplicates).';
}

function qid_(n) { return 'Q' + (n < 1000 ? ('00' + n).slice(-3) : String(n)); }

function normText_(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

// Keeps only questions with one clear, lasting answer.
function okImported_(text, right, wrong) {
  if (!text || !right || wrong.length !== 3) return false;
  if (text.length > 170 || [right].concat(wrong).some(a => !a || a.length > 60)) return false;
  if (/\b(NOT|EXCEPT|never)\b/.test(text)) return false; // trick wording
  if (/\b(currently|current|as of|latest|recent|recently|this year|today|still|now|newest|upcoming)\b/i.test(text)) return false;
  if (/(all|none) of the above|both|neither/i.test([right].concat(wrong).join(' | '))) return false;
  if (/(anime|manga|video game|pok[eé]mon|minecraft|fortnite|netflix|youtube|twitter|tiktok|instagram)/i.test(text)) return false;
  if (/\b(19|20)\d\d\b/.test(text) && /\b(best|most|highest|largest|record)\b/i.test(text)) return false; // records that may change
  const all = [right].concat(wrong).map(a => a.toLowerCase());
  if (new Set(all).size !== 4) return false;
  return true;
}

/* ---------------- one-time upgrade to version 9 ---------------- */

function upgradeToV9_(ss) {
  const notes = [];
  const ps = ss.getSheetByName(TAB.PLAYERS);
  if (ps && ps.getLastRow() > 0 && ps.getLastColumn() < PLAYER_HEADERS.length && String(ps.getRange(1, 1).getValue()) === 'Player ID') {
    ps.getRange(1, 1, 1, PLAYER_HEADERS.length).setValues([PLAYER_HEADERS]);
    styleHeader_(ps, PLAYER_HEADERS.length);
    if (ps.getLastRow() > 1) {
      const n = ps.getLastRow() - 1;
      const rows = ps.getRange(2, 1, n, PLAYER_HEADERS.length).getValues();
      rows.forEach(r => {
        r[P.BEST] = Math.max(Number(r[P.BEST]) || 0, Number(r[P.DAYS]) || 0);
        r[P.SAVED] = r[P.HASH] ? 'Yes' : 'No';
        r[P.TOTALANS] = seenList_(r[P.SEEN]).length;
        r[P.REFCREDITED] = r[P.REFBY] ? 'Yes' : ''; // already credited under the old rules
        r[P.STATUS] = 'Ready';
        r[P.DAYS] = 0;
        r[P.CURQ] = '';
        r[P.OUTDAY] = '';
        if (r[P.REASON] !== 'Removed by admin') r[P.REASON] = '';
      });
      ps.getRange(2, 1, n, PLAYER_HEADERS.length).setValues(rows);
    }
    notes.push('Players upgraded to Endless. Everyone keeps their best run and starts a fresh Endless run.');
  }
  const qs = ss.getSheetByName(TAB.QUESTIONS);
  if (qs && qs.getLastRow() > 0 && String(qs.getRange(1, 11).getValue()) !== 'Source') {
    qs.getRange(1, 11).setValue('Source');
    if (qs.getLastRow() > 1) {
      const n = qs.getLastRow() - 1;
      const col = qs.getRange(2, 11, n, 1).getValues().map(r => [r[0] || 'Holdout']);
      qs.getRange(2, 11, n, 1).setValues(col);
    }
  }
  return notes;
}

/* =============================================================
 * HOURLY CHECK: counts missed days (pause days) for everyone
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
    .addItem('Import 300 questions from Open Trivia Database', 'adminImportOpenTrivia')
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
    'Type the ID of the bad question (like Q012). Everyone knocked out by it is set back to Alive, it counts as a correct answer, and their next question is available right away.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  ui.alert(reviveByQuestion_(res.getResponseText()));
}

function reviveByQuestion_(id) {
  id = String(id || '').trim().toUpperCase();
  if (!/^Q\d+$/.test(id)) throw new Error('Type a question ID like Q012.');
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let count = 0;
  try {
    const data = readPlayers_();
    data.rows.forEach(r => {
      if (r[P.STATUS] === 'Out' && r[P.REASON] === 'Wrong answer' && String(r[P.LASTQ]).toUpperCase() === id) {
        const n = Number(r[P.OUTDAY]) || ((Number(r[P.DAYS]) || 0) + 1);
        r[P.STATUS] = 'Alive';
        r[P.DAYS] = n;
        r[P.BEST] = Math.max(Number(r[P.BEST]) || 0, n);
        r[P.OUTDAY] = '';
        r[P.REASON] = '';
        r[P.CURQ] = '';
        r[P.LASTDATE] = yesterdayKey_(s);
        count++;
      }
    });
    if (count) data.sh.getRange(2, 1, data.rows.length, PLAYER_HEADERS.length).setValues(data.rows);
  } finally {
    lock.releaseLock();
  }
  return count + ' player(s) knocked out by ' + id + ' were brought back.';
}

function adminImportOpenTrivia() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(importOpenTrivia_(300) + '\n\nThey are on the Questions tab with Source = Open Trivia DB. Turn off any you don\'t like.');
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
    pauseLimit: (function () { const n = parseInt(m['Pause Days Per Run'], 10); return isNaN(n) ? 2 : Math.max(0, n); })(),
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


function todayKey_(s) {
  return Utilities.formatDate(new Date(), s.tz, 'yyyy-MM-dd');
}

function bonusUsedToday_(row, s) {
  let d = row[P.BONUSDATE];
  if (d instanceof Date) d = Utilities.formatDate(d, s.tz, 'yyyy-MM-dd');
  return String(d) === todayKey_(s) ? (Number(row[P.BONUSUSED]) || 0) : 0;
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

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
  'Status', 'Run Started', 'Attempt', 'Days Survived', 'Out On Day', 'Out Reason', 'Best Run',
  'Bonus Questions', 'Bonus Date', 'Bonus Used That Date', 'Invited By', 'Friends Invited',
  'Current Question', 'Last Question', 'Devices', 'Fast Answers', 'Question Shown At', 'Shown Question',
  'Last Day Played', 'Pause Days Used', 'Comebacks', 'Seen Questions', 'Last Restart Date'];
const P = { ID: 0, NAME: 1, HASH: 2, TOKEN: 3, JOINED: 4, AGE: 5, STATUS: 6, START: 7, ATTEMPT: 8,
  DAYS: 9, OUTDAY: 10, REASON: 11, BEST: 12, BONUS: 13, BONUSDATE: 14, BONUSUSED: 15,
  REFBY: 16, FRIENDS: 17, CURQ: 18, LASTQ: 19, DEVICES: 20, FAST: 21, SHOWNAT: 22, SHOWNQ: 23,
  LASTDATE: 24, PAUSES: 25, COMEBACKS: 26, SEEN: 27, RESTARTDATE: 28 };

const QUESTION_HEADERS = ['ID', 'Difficulty', 'Question', 'A', 'B', 'C', 'D', 'Correct', 'Fun Fact', 'Active?'];
const ANSWER_HEADERS = ['Timestamp', 'Player ID', 'Display Name', 'Attempt', 'Day', 'Question Used', 'Choice', 'Correct?', 'Seconds To Answer'];
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

// Question bank: [ID, Difficulty, Question, A, B, C, D, Correct, Fun Fact, Active?]
const STARTER_QUESTIONS = [
  ["Q001", "Easy", "Which planet is known as the Red Planet?", "Venus", "Mars", "Jupiter", "Mercury", "B", "Mars gets its red color from iron oxide, which is basically rust, in its soil.", "Yes"],
  ["Q002", "Easy", "How many legs does a spider have?", "6", "10", "8", "12", "C", "Spiders are arachnids, not insects. Insects have 6 legs.", "Yes"],
  ["Q003", "Easy", "What is the largest ocean on Earth?", "Atlantic", "Indian", "Arctic", "Pacific", "D", "The Pacific covers roughly a third of Earth's surface.", "Yes"],
  ["Q004", "Easy", "Which instrument has 88 keys on a standard modern model?", "Piano", "Violin", "Trumpet", "Harp", "A", "Those 88 keys are made up of 52 white keys and 36 black keys.", "Yes"],
  ["Q005", "Easy", "Which gas do plants take in from the air to make their food?", "Oxygen", "Nitrogen", "Carbon dioxide", "Helium", "C", "Plants release oxygen as a byproduct of photosynthesis.", "Yes"],
  ["Q006", "Easy", "In which country are the Pyramids of Giza?", "Mexico", "Egypt", "Peru", "Greece", "B", "The Great Pyramid was the tallest human-made structure on Earth for thousands of years.", "Yes"],
  ["Q007", "Easy", "How many sides does a hexagon have?", "5", "7", "6", "8", "C", "Honeybees build their honeycomb cells in hexagon shapes.", "Yes"],
  ["Q008", "Medium", "Which U.S. state is the largest by area?", "Texas", "California", "Montana", "Alaska", "D", "Alaska is more than twice the size of Texas.", "Yes"],
  ["Q009", "Medium", "What is the chemical symbol for gold?", "Au", "Ag", "Gd", "Go", "A", "Au comes from the Latin word for gold, aurum.", "Yes"],
  ["Q010", "Medium", "Who painted the Mona Lisa?", "Michelangelo", "Raphael", "Leonardo da Vinci", "Rembrandt", "C", "The Mona Lisa hangs in the Louvre museum in Paris.", "Yes"],
  ["Q011", "Medium", "What is the capital of Australia?", "Sydney", "Canberra", "Melbourne", "Perth", "B", "Canberra was built as a compromise because Sydney and Melbourne both wanted to be the capital.", "Yes"],
  ["Q012", "Medium", "How many strings does a standard violin have?", "4", "5", "6", "8", "A", "A violin's strings are tuned G, D, A, and E.", "Yes"],
  ["Q013", "Medium", "Which of these is the hardest mineral?", "Topaz", "Quartz", "Talc", "Diamond", "D", "Diamonds are made of pure carbon.", "Yes"],
  ["Q014", "Medium", "Which organ in the human body produces insulin?", "Liver", "Pancreas", "Kidney", "Spleen", "B", "The pancreas sits tucked behind the stomach.", "Yes"],
  ["Q015", "Hard", "In what year did the Berlin Wall fall?", "1987", "1991", "1989", "1993", "C", "The wall came down on November 9, 1989.", "Yes"],
  ["Q016", "Hard", "What is the smallest prime number?", "0", "1", "2", "3", "C", "2 is also the only even prime number.", "Yes"],
  ["Q017", "Hard", "Which element has atomic number 1?", "Helium", "Hydrogen", "Lithium", "Oxygen", "B", "Hydrogen is the most abundant element in the universe.", "Yes"],
  ["Q018", "Hard", "Which of these countries is known for having the most lakes?", "Russia", "United States", "Finland", "Canada", "D", "Canada is often said to have more lakes than the rest of the world combined.", "Yes"],
  ["Q019", "Hard", "What is the longest bone in the human body?", "Femur", "Tibia", "Humerus", "Pelvis", "A", "The femur, or thigh bone, is roughly a quarter of a person's height.", "Yes"],
  ["Q020", "Hard", "Which composer wrote The Four Seasons?", "Bach", "Handel", "Vivaldi", "Mozart", "C", "Vivaldi was also a priest, nicknamed the Red Priest because of his red hair.", "Yes"],
  ["Q021", "Hard", "Roughly how fast does light travel?", "18,600 miles per second", "186,000 miles per second", "1,860,000 miles per second", "18,600,000 miles per second", "B", "Light from the Sun takes about 8 minutes to reach Earth.", "Yes"],
  ["Q022", "Very Hard", "Which is the only U.S. state whose name has just one syllable?", "Utah", "Iowa", "Ohio", "Maine", "D", "Maine is also the only state that borders exactly one other state, New Hampshire.", "Yes"],
  ["Q023", "Very Hard", "Which letter does not appear in the name of any U.S. state?", "Q", "Z", "X", "J", "A", "J is in New Jersey, X is in Texas, and Z is in Arizona.", "Yes"],
  ["Q024", "Very Hard", "Which planet has the shortest day?", "Earth", "Saturn", "Jupiter", "Mercury", "C", "Jupiter spins all the way around in about 10 hours.", "Yes"],
  ["Q025", "Very Hard", "How many bones are in the typical adult human body?", "196", "206", "216", "226", "B", "Babies are born with around 270 bones, and many fuse together as they grow.", "Yes"],
  ["Q026", "Very Hard", "What is the national animal of Scotland?", "Lion", "Stag", "Eagle", "Unicorn", "D", "The unicorn has appeared on Scotland's royal coat of arms for centuries.", "Yes"],
  ["Q027", "Very Hard", "Which of these countries has the longest coastline?", "Russia", "Australia", "Canada", "Indonesia", "C", "Canada's coastline touches three oceans: the Atlantic, Pacific, and Arctic.", "Yes"],
  ["Q028", "Very Hard", "How many hearts does an octopus have?", "2", "3", "1", "4", "B", "Two hearts pump blood to the gills, and the third pumps it to the rest of the body.", "Yes"],
  ["Q029", "Very Hard", "What is the smallest country in the world by area?", "Monaco", "Vatican City", "San Marino", "Liechtenstein", "B", "Vatican City covers only about 0.17 square miles.", "Yes"],
  ["Q030", "Very Hard", "Counting both hot and cold deserts, what is the largest desert on Earth?", "Sahara", "Gobi", "Arabian", "Antarctic", "D", "A desert is defined by how little precipitation it gets, not by heat, so frozen Antarctica counts.", "Yes"],
  ["Q031", "Medium", "Which gas makes up most of Earth's air?", "Oxygen", "Nitrogen", "Argon", "Carbon dioxide", "B", "Nitrogen makes up about 78 percent of the air we breathe.", "Yes"],
  ["Q032", "Hard", "Which blood type is known as the universal donor for red blood cells?", "AB positive", "A negative", "O negative", "B positive", "C", "Because it can go to almost anyone, O negative is often used in emergencies.", "Yes"],
  ["Q033", "Medium", "How many half steps (semitones) are in one octave?", "8", "10", "12", "14", "C", "That is why the pattern of black and white keys on a piano repeats every 12 keys.", "Yes"],
  ["Q034", "Medium", "Which metal is a liquid at room temperature?", "Lead", "Mercury", "Tin", "Aluminum", "B", "Mercury was once widely used in thermometers.", "Yes"],
  ["Q035", "Easy", "What is the capital of Canada?", "Toronto", "Montreal", "Vancouver", "Ottawa", "D", "Queen Victoria chose Ottawa as the capital in 1857.", "Yes"],
  ["Q036", "Very Hard", "How many official time zones does China use?", "1", "3", "4", "5", "A", "China stretches across about five geographic time zones but runs everything on Beijing Time.", "Yes"],
  ["Q037", "Easy", "What color do you get by mixing blue and yellow paint?", "Green", "Purple", "Orange", "Brown", "A", "Red, yellow, and blue are the traditional primary colors used in painting.", "Yes"],
  ["Q038", "Easy", "How many continents are usually taught in U.S. schools?", "5", "6", "7", "8", "C", "Some countries teach 5 or 6 continents by counting the Americas, or Europe and Asia, as one.", "Yes"],
  ["Q039", "Easy", "What is the largest planet in our solar system?", "Saturn", "Jupiter", "Neptune", "Earth", "B", "More than 1,000 Earths could fit inside Jupiter.", "Yes"],
  ["Q040", "Easy", "At what temperature does water freeze in degrees Fahrenheit?", "0", "100", "32", "212", "C", "At sea level, water boils at 212 degrees Fahrenheit.", "Yes"],
  ["Q041", "Easy", "Which animal is often called the King of the Jungle?", "Tiger", "Elephant", "Lion", "Gorilla", "C", "Despite the nickname, most lions live on grasslands and savannas, not in jungles.", "Yes"],
  ["Q042", "Easy", "How many days are in a leap year?", "364", "365", "366", "367", "C", "Leap years add February 29 to keep the calendar in step with Earth's trip around the Sun.", "Yes"],
  ["Q043", "Easy", "What is the capital of France?", "Paris", "Lyon", "Marseille", "Nice", "A", "The Eiffel Tower was built for the 1889 World's Fair in Paris.", "Yes"],
  ["Q044", "Easy", "Which bird is a well-known symbol of peace?", "Eagle", "Dove", "Crow", "Owl", "B", "Doves and pigeons belong to the same bird family.", "Yes"],
  ["Q045", "Easy", "What do honeybees make?", "Silk", "Maple syrup", "Cheese", "Honey", "D", "A single honeybee makes only about one-twelfth of a teaspoon of honey in its whole life.", "Yes"],
  ["Q046", "Easy", "Which ocean lies between the United States and Europe?", "Pacific", "Atlantic", "Indian", "Arctic", "B", "The Atlantic is the second-largest ocean on Earth.", "Yes"],
  ["Q047", "Easy", "What is the tallest animal in the world?", "Giraffe", "Elephant", "Camel", "Moose", "A", "A giraffe's long neck has seven bones, the same number as a human neck.", "Yes"],
  ["Q048", "Easy", "Which planet is closest to the Sun?", "Venus", "Mars", "Mercury", "Earth", "C", "A year on Mercury lasts only 88 Earth days.", "Yes"],
  ["Q049", "Easy", "How many players does one soccer team have on the field at a time?", "9", "10", "12", "11", "D", "That count of 11 includes the goalkeeper.", "Yes"],
  ["Q050", "Easy", "What is the main ingredient in guacamole?", "Avocado", "Tomato", "Cucumber", "Pea", "A", "Botanically, an avocado is a large berry with a single seed.", "Yes"],
  ["Q051", "Easy", "Which month has the fewest days?", "January", "February", "April", "November", "B", "February has 28 days, or 29 in a leap year.", "Yes"],
  ["Q052", "Easy", "Which gas in the air do people need to breathe to stay alive?", "Oxygen", "Helium", "Hydrogen", "Neon", "A", "The air around us is only about 21 percent oxygen.", "Yes"],
  ["Q053", "Easy", "In which country is the Great Wall?", "China", "Japan", "India", "Korea", "A", "Despite the popular myth, the Great Wall cannot be seen with the naked eye from the Moon.", "Yes"],
  ["Q054", "Easy", "What is the largest animal on Earth?", "African elephant", "Blue whale", "Giraffe", "Hippopotamus", "B", "A blue whale's heart is roughly the size of a small car.", "Yes"],
  ["Q055", "Easy", "Which instrument usually has six strings and is often strummed?", "Violin", "Harp", "Cello", "Guitar", "D", "Some guitars have 12 strings, set up in pairs.", "Yes"],
  ["Q056", "Easy", "What do you call a shape with four equal sides and four right angles?", "Triangle", "Square", "Pentagon", "Octagon", "B", "A square also counts as a rectangle and a rhombus.", "Yes"],
  ["Q057", "Easy", "Which famous ship sank in 1912 after hitting an iceberg?", "Lusitania", "Mayflower", "Titanic", "Britannic", "C", "The Titanic was on its very first voyage, from Southampton, England, to New York.", "Yes"],
  ["Q058", "Easy", "What is the capital of the United States?", "New York City", "Washington, D.C.", "Philadelphia", "Boston", "B", "Both New York City and Philadelphia served as the capital before Washington, D.C.", "Yes"],
  ["Q059", "Easy", "How many legs does an insect have?", "6", "4", "8", "10", "A", "Every insect body has three main parts: the head, thorax, and abdomen.", "Yes"],
  ["Q060", "Easy", "At what temperature does water boil in degrees Celsius at sea level?", "50", "90", "100", "120", "C", "Water boils at a lower temperature high in the mountains because the air pressure is lower.", "Yes"],
  ["Q061", "Easy", "Finish the saying: An apple a day keeps the ___ away.", "Dentist", "Doctor", "Teacher", "Rain", "B", "An early version of the saying appeared in Wales in the 1860s.", "Yes"],
  ["Q062", "Easy", "Who was the first President of the United States?", "Thomas Jefferson", "John Adams", "George Washington", "Abraham Lincoln", "C", "George Washington is the only president who never lived in the White House.", "Yes"],
  ["Q063", "Easy", "How many colors are in a rainbow, as traditionally listed?", "5", "6", "7", "8", "C", "The traditional list is red, orange, yellow, green, blue, indigo, and violet.", "Yes"],
  ["Q064", "Easy", "What is the largest country in the world by area?", "Canada", "China", "United States", "Russia", "D", "Russia covers more than one-ninth of all the land on Earth.", "Yes"],
  ["Q065", "Easy", "Which of your senses depends most on your nose?", "Taste", "Smell", "Touch", "Hearing", "B", "Much of what we think of as taste actually comes from smell.", "Yes"],
  ["Q066", "Easy", "What does a caterpillar turn into?", "A beetle", "A spider", "A butterfly or moth", "A dragonfly", "C", "Butterflies form a chrysalis, while many moths spin a silk cocoon.", "Yes"],
  ["Q067", "Medium", "What is the chemical symbol for sodium?", "So", "Sd", "Na", "Sn", "C", "Na comes from natrium, the Latin name for sodium.", "Yes"],
  ["Q068", "Medium", "Which planet is famous for its Great Red Spot?", "Mars", "Jupiter", "Saturn", "Neptune", "B", "The Great Red Spot is a giant storm wider than Earth.", "Yes"],
  ["Q069", "Medium", "Who wrote Romeo and Juliet?", "Charles Dickens", "Jane Austen", "Mark Twain", "William Shakespeare", "D", "The play is set in the Italian city of Verona.", "Yes"],
  ["Q070", "Medium", "What is the smallest planet in our solar system?", "Mercury", "Mars", "Venus", "Earth", "A", "Pluto used to be called the smallest planet until it was reclassified as a dwarf planet in 2006.", "Yes"],
  ["Q071", "Medium", "What is the capital of Japan?", "Kyoto", "Osaka", "Tokyo", "Hiroshima", "C", "Kyoto was Japan's capital for more than 1,000 years before Tokyo.", "Yes"],
  ["Q072", "Medium", "Which country gave the Statue of Liberty to the United States?", "France", "England", "Spain", "Italy", "A", "The Statue of Liberty was dedicated in 1886.", "Yes"],
  ["Q073", "Medium", "What is the longest river in South America?", "Amazon", "Orinoco", "Parana", "Magdalena", "A", "The Amazon carries more water than any other river on Earth.", "Yes"],
  ["Q074", "Medium", "In what year did people first walk on the Moon?", "1965", "1969", "1972", "1959", "B", "Neil Armstrong and Buzz Aldrin landed on the Moon on July 20, 1969.", "Yes"],
  ["Q075", "Medium", "Which type of blood cell helps the body fight infections?", "Red blood cells", "White blood cells", "Platelets", "Plasma", "B", "Platelets are the cells that help blood clot when you get a cut.", "Yes"],
  ["Q076", "Medium", "Which language has the most native speakers in the world?", "English", "Spanish", "Mandarin Chinese", "Hindi", "C", "If you count people who speak it as a second language, English has the most speakers overall.", "Yes"],
  ["Q077", "Medium", "Which metal has the chemical symbol Fe?", "Lead", "Fluorine", "Tin", "Iron", "D", "Fe comes from ferrum, the Latin word for iron.", "Yes"],
  ["Q078", "Medium", "How many strings does a standard cello have?", "4", "5", "6", "3", "A", "A cello's strings are tuned C, G, D, and A.", "Yes"],
  ["Q079", "Medium", "Which painter famously cut off part of his own ear?", "Vincent van Gogh", "Pablo Picasso", "Claude Monet", "Salvador Dali", "A", "Van Gogh sold very few paintings during his lifetime.", "Yes"],
  ["Q080", "Medium", "What is the Sun mostly made of?", "Oxygen", "Helium", "Hydrogen", "Carbon", "C", "About three-quarters of the Sun's mass is hydrogen.", "Yes"],
  ["Q081", "Medium", "Which U.S. state is nicknamed the Sunshine State?", "California", "Arizona", "Hawaii", "Florida", "D", "Florida is also home to the Kennedy Space Center.", "Yes"],
  ["Q082", "Medium", "Which of these is the largest organ of the human body?", "Liver", "Brain", "Skin", "Lungs", "C", "An adult's skin weighs about 8 pounds.", "Yes"],
  ["Q083", "Medium", "Which scientist developed the theory of relativity?", "Isaac Newton", "Albert Einstein", "Galileo Galilei", "Nikola Tesla", "B", "Einstein's Nobel Prize in 1921 was for the photoelectric effect, not for relativity.", "Yes"],
  ["Q084", "Medium", "What is the capital of Italy?", "Rome", "Milan", "Venice", "Florence", "A", "Vatican City, the world's smallest country, sits inside Rome.", "Yes"],
  ["Q085", "Medium", "Which planet rotates on its side?", "Uranus", "Neptune", "Saturn", "Venus", "A", "Uranus is tilted about 98 degrees, so it spins almost on its side.", "Yes"],
  ["Q086", "Medium", "What is a group of lions called?", "A pride", "A pack", "A herd", "A flock", "A", "A pride usually includes several related females, their cubs, and a few males.", "Yes"],
  ["Q087", "Medium", "In what year did World War II end?", "1943", "1944", "1945", "1946", "C", "The war ended in Europe in May 1945 and in the Pacific in September 1945.", "Yes"],
  ["Q088", "Medium", "How many players from one basketball team are on the court at a time?", "4", "6", "7", "5", "D", "Basketball was invented by James Naismith in 1891 using peach baskets.", "Yes"],
  ["Q089", "Medium", "What is the currency of Japan?", "Yuan", "Won", "Yen", "Ringgit", "C", "The yuan is China's currency, and the won is South Korea's.", "Yes"],
  ["Q090", "Medium", "Which mountain is the tallest above sea level?", "K2", "Kilimanjaro", "Mount Everest", "Denali", "C", "Mount Everest sits on the border between Nepal and China.", "Yes"],
  ["Q091", "Medium", "How many degrees are in a right angle?", "45", "90", "180", "360", "B", "The angles inside any triangle always add up to 180 degrees.", "Yes"],
  ["Q092", "Medium", "Kangaroos are native to which of these countries?", "Australia", "New Zealand", "South Africa", "Argentina", "A", "A baby kangaroo is called a joey.", "Yes"],
  ["Q093", "Medium", "What color is a ruby?", "Blue", "Green", "Red", "Purple", "C", "Rubies and sapphires are the same mineral, called corundum.", "Yes"],
  ["Q094", "Medium", "Who painted the ceiling of the Sistine Chapel?", "Leonardo da Vinci", "Michelangelo", "Raphael", "Botticelli", "B", "Michelangelo spent about four years painting the ceiling, from 1508 to 1512.", "Yes"],
  ["Q095", "Medium", "In which city is the ancient Colosseum?", "Athens", "Rome", "Istanbul", "Paris", "B", "The Colosseum could hold around 50,000 spectators.", "Yes"],
  ["Q096", "Medium", "What is the square root of 144?", "12", "10", "11", "14", "A", "144 is also called a gross, meaning a dozen dozens.", "Yes"],
  ["Q097", "Hard", "How many bones are in the middle ear?", "1", "2", "3", "4", "C", "The hammer, anvil, and stirrup are the smallest bones in the human body.", "Yes"],
  ["Q098", "Hard", "Which is the hottest planet in our solar system?", "Mercury", "Venus", "Mars", "Jupiter", "B", "Venus's thick carbon dioxide atmosphere traps heat, making it even hotter than Mercury.", "Yes"],
  ["Q099", "Hard", "What is the capital of Turkey?", "Ankara", "Istanbul", "Izmir", "Antalya", "A", "Istanbul is Turkey's largest city, but Ankara has been the capital since 1923.", "Yes"],
  ["Q100", "Hard", "Who wrote the novel 1984?", "Aldous Huxley", "Ray Bradbury", "George Orwell", "H. G. Wells", "C", "George Orwell's real name was Eric Arthur Blair.", "Yes"],
  ["Q101", "Hard", "Which element has the chemical symbol K?", "Krypton", "Potassium", "Calcium", "Carbon", "B", "K comes from kalium, the Latin name for potassium.", "Yes"],
  ["Q102", "Hard", "In what year did Christopher Columbus first reach the Americas?", "1492", "1498", "1507", "1520", "A", "Columbus sailed with three ships: the Nina, the Pinta, and the Santa Maria.", "Yes"],
  ["Q103", "Hard", "How many symphonies did Beethoven complete?", "5", "7", "9", "12", "C", "Beethoven was almost completely deaf when he wrote his Ninth Symphony.", "Yes"],
  ["Q104", "Hard", "What is the longest river in Africa?", "Congo", "Niger", "Nile", "Zambezi", "C", "The Nile flows north and empties into the Mediterranean Sea.", "Yes"],
  ["Q105", "Hard", "Which planet has a moon named Titan?", "Jupiter", "Uranus", "Neptune", "Saturn", "D", "Titan is the only moon known to have a thick atmosphere.", "Yes"],
  ["Q106", "Hard", "What is the only mammal that can truly fly?", "Flying squirrel", "Sugar glider", "Bat", "Colugo", "C", "Flying squirrels and sugar gliders glide, but they can't truly fly.", "Yes"],
  ["Q107", "Hard", "Who was the first woman to win a Nobel Prize?", "Marie Curie", "Florence Nightingale", "Rosalind Franklin", "Jane Addams", "A", "Marie Curie won two Nobel Prizes, one in physics and one in chemistry.", "Yes"],
  ["Q108", "Hard", "How many time zones does Russia have?", "7", "9", "11", "13", "C", "When it is morning in western Russia, it is already evening in the far east.", "Yes"],
  ["Q109", "Hard", "What is the capital of Brazil?", "Brasilia", "Rio de Janeiro", "Sao Paulo", "Salvador", "A", "Brasilia was built from scratch and became the capital in 1960.", "Yes"],
  ["Q110", "Hard", "Which composer wrote the Moonlight Sonata?", "Mozart", "Beethoven", "Chopin", "Bach", "B", "The name Moonlight was given by a music critic after Beethoven died.", "Yes"],
  ["Q111", "Hard", "What is the chemical symbol for silver?", "Si", "Sv", "Ag", "Au", "C", "Ag comes from argentum, the Latin word for silver.", "Yes"],
  ["Q112", "Hard", "Which ancient wonder stood in Alexandria, Egypt?", "The Colossus", "The Lighthouse", "The Hanging Gardens", "The Temple of Artemis", "B", "The Lighthouse of Alexandria was one of the tallest structures in the world for centuries.", "Yes"],
  ["Q113", "Hard", "How many players from one baseball team are on the field while their team is on defense?", "8", "10", "11", "9", "D", "Those 9 players include the pitcher and the catcher.", "Yes"],
  ["Q114", "Hard", "Which planet takes the longest to spin around once?", "Venus", "Mercury", "Mars", "Jupiter", "A", "A single day on Venus is longer than its whole year.", "Yes"],
  ["Q115", "Hard", "What is the heaviest organ inside the human body?", "Liver", "Heart", "Lungs", "Kidneys", "A", "The liver can grow back after part of it is removed.", "Yes"],
  ["Q116", "Hard", "In which country did the ancient Olympic Games begin?", "Italy", "Greece", "Egypt", "France", "B", "The ancient Games began in Olympia around 776 BC.", "Yes"],
  ["Q117", "Hard", "Who received the first U.S. patent for the telephone?", "Thomas Edison", "Nikola Tesla", "Alexander Graham Bell", "Samuel Morse", "C", "Bell received the telephone patent in 1876.", "Yes"],
  ["Q118", "Hard", "What is the main ingredient in traditional hummus?", "Lentils", "Chickpeas", "Black beans", "Green peas", "B", "Traditional hummus also includes tahini, a paste made from sesame seeds.", "Yes"],
  ["Q119", "Hard", "How many sides does a dodecagon have?", "12", "10", "14", "20", "A", "Dodeca comes from the Greek word for twelve.", "Yes"],
  ["Q120", "Hard", "What is the largest moon in our solar system?", "Titan", "Ganymede", "Europa", "Earth's Moon", "B", "Ganymede, one of Jupiter's moons, is bigger than the planet Mercury.", "Yes"],
  ["Q121", "Hard", "Which physicist wrote A Brief History of Time?", "Carl Sagan", "Neil deGrasse Tyson", "Richard Feynman", "Stephen Hawking", "D", "The book was first published in 1988.", "Yes"],
  ["Q122", "Hard", "What city is the seat of Switzerland's government?", "Zurich", "Geneva", "Bern", "Basel", "C", "Switzerland officially calls Bern its federal city rather than its capital.", "Yes"],
  ["Q123", "Hard", "Phobos is a moon of which planet?", "Mars", "Jupiter", "Venus", "Saturn", "A", "Phobos is slowly spiraling closer to Mars.", "Yes"],
  ["Q124", "Hard", "What is the tallest uninterrupted waterfall in the world?", "Niagara Falls", "Victoria Falls", "Angel Falls", "Iguazu Falls", "C", "Angel Falls in Venezuela drops about 3,200 feet.", "Yes"],
  ["Q125", "Hard", "How many teeth does a typical adult have, counting wisdom teeth?", "28", "30", "32", "36", "C", "Many adults have some or all of their four wisdom teeth removed.", "Yes"],
  ["Q126", "Hard", "Who painted The Starry Night?", "Claude Monet", "Vincent van Gogh", "Rembrandt", "Paul Cezanne", "B", "Van Gogh painted it in 1889 while staying at an asylum in southern France.", "Yes"],
  ["Q127", "Very Hard", "What is the smallest bone in the human body?", "Incus", "Stapes", "Malleus", "Coccyx", "B", "The stapes, or stirrup, is about the size of a grain of rice.", "Yes"],
  ["Q128", "Very Hard", "What is the capital of New Zealand?", "Auckland", "Christchurch", "Wellington", "Queenstown", "C", "Wellington is the southernmost capital city of any country.", "Yes"],
  ["Q129", "Very Hard", "How many strings does a standard concert pedal harp have?", "36", "41", "47", "52", "C", "Harpists use seven foot pedals to change the pitch of the strings.", "Yes"],
  ["Q130", "Very Hard", "In what year did the American Civil War end?", "1861", "1863", "1865", "1868", "C", "General Lee surrendered at Appomattox Court House in April 1865.", "Yes"],
  ["Q131", "Very Hard", "Who composed the music for the ballet The Nutcracker?", "Rachmaninoff", "Stravinsky", "Prokofiev", "Tchaikovsky", "D", "The Nutcracker premiered in St. Petersburg in 1892.", "Yes"],
  ["Q132", "Very Hard", "What is the chemical symbol for tungsten?", "T", "Tu", "W", "Tn", "C", "W comes from wolfram, another name for tungsten.", "Yes"],
  ["Q133", "Very Hard", "Which continent has no permanent human residents?", "Australia", "Antarctica", "Europe", "South America", "B", "The only people living in Antarctica are scientists and staff who stay for a few months at a time.", "Yes"],
  ["Q134", "Very Hard", "What is the largest species of shark?", "Great white shark", "Whale shark", "Basking shark", "Tiger shark", "B", "Despite its size, the whale shark eats mostly plankton.", "Yes"],
  ["Q135", "Very Hard", "Which U.S. state has the longest coastline?", "California", "Florida", "Alaska", "Hawaii", "C", "Alaska has more coastline than all the other states combined.", "Yes"],
  ["Q136", "Very Hard", "Which planet was found by math before anyone saw it in a telescope?", "Uranus", "Neptune", "Saturn", "Mars", "B", "Astronomers spotted Neptune in 1846, right where the math said it would be.", "Yes"],
  ["Q137", "Very Hard", "Who wrote The Canterbury Tales?", "John Milton", "Edmund Spenser", "Geoffrey Chaucer", "Thomas Malory", "C", "Chaucer wrote The Canterbury Tales in the late 1300s.", "Yes"],
  ["Q138", "Very Hard", "What is the largest lake in Africa?", "Lake Tanganyika", "Lake Malawi", "Lake Chad", "Lake Victoria", "D", "Lake Victoria is shared by Uganda, Kenya, and Tanzania.", "Yes"],
  ["Q139", "Very Hard", "Where is the deepest known point in Earth's oceans?", "Puerto Rico Trench", "Mariana Trench", "Java Trench", "Tonga Trench", "B", "The deepest part of the Mariana Trench, called the Challenger Deep, is nearly 7 miles down.", "Yes"],
  ["Q140", "Very Hard", "How many official national languages does Switzerland have?", "2", "3", "4", "5", "C", "They are German, French, Italian, and Romansh.", "Yes"],
  ["Q141", "Very Hard", "Which number, written in English, has its letters in alphabetical order?", "Fifty", "Seventy", "Eighty", "Forty", "D", "F, O, R, T, Y: each letter comes later in the alphabet than the one before it.", "Yes"],
  ["Q142", "Very Hard", "Who was the second person to walk on the Moon?", "Michael Collins", "Pete Conrad", "Buzz Aldrin", "Alan Shepard", "C", "Michael Collins stayed in orbit, flying the command module, while the others walked on the Moon.", "Yes"],
  ["Q143", "Very Hard", "What is the most common element in Earth's crust?", "Silicon", "Oxygen", "Iron", "Aluminum", "B", "Most of that oxygen is locked inside rocks and minerals.", "Yes"],
  ["Q144", "Very Hard", "How many light and dark squares make up a standard chessboard?", "48", "56", "64", "72", "C", "Count every size of square, from 1-by-1 up to the full 8-by-8 board, and there are 204.", "Yes"],
  ["Q145", "Very Hard", "Which musical closed in 2023 as the longest-running show in Broadway history?", "Chicago", "The Lion King", "The Phantom of the Opera", "Cats", "C", "The Phantom of the Opera ran on Broadway for 35 years, from 1988 to 2023.", "Yes"],
  ["Q146", "Very Hard", "Which planet has the fastest winds in the solar system?", "Jupiter", "Saturn", "Neptune", "Uranus", "C", "Winds on Neptune can blow faster than 1,000 miles per hour.", "Yes"],
  ["Q147", "Very Hard", "Which bird can fly backward?", "Swift", "Kingfisher", "Sparrow", "Hummingbird", "D", "Some hummingbirds beat their wings more than 50 times per second.", "Yes"],
  ["Q148", "Very Hard", "What is the capital of Morocco?", "Casablanca", "Marrakesh", "Rabat", "Fez", "C", "Casablanca is Morocco's largest city.", "Yes"],
  ["Q149", "Very Hard", "How many moons does Mars have?", "0", "1", "2", "3", "C", "The two moons of Mars are named Phobos and Deimos.", "Yes"],
  ["Q150", "Very Hard", "Besides mercury, which element is a liquid at room temperature?", "Chlorine", "Bromine", "Iodine", "Fluorine", "B", "Bromine is a reddish-brown liquid with a strong smell.", "Yes"],
  ["Q151", "Very Hard", "What is the longest river in Europe?", "Danube", "Rhine", "Volga", "Dnieper", "C", "The Volga flows through Russia and empties into the Caspian Sea.", "Yes"],
  ["Q152", "Very Hard", "How many amendments make up the U.S. Bill of Rights?", "5", "10", "12", "27", "B", "The Constitution has 27 amendments in total.", "Yes"],
  ["Q153", "Very Hard", "What is the tallest mountain in Africa?", "Mount Kenya", "Mount Toubkal", "Mount Stanley", "Mount Kilimanjaro", "D", "Kilimanjaro is a dormant volcano in Tanzania.", "Yes"],
  ["Q154", "Very Hard", "Which planet in our solar system is the densest?", "Jupiter", "Earth", "Mercury", "Venus", "B", "Saturn is the least dense planet. It is less dense than water.", "Yes"],
  ["Q155", "Very Hard", "What is the largest living bird?", "Emu", "Albatross", "Ostrich", "Cassowary", "C", "An ostrich egg is the largest egg laid by any living bird.", "Yes"],
  ["Q156", "Very Hard", "Which mathematician wrote the famous 'last theorem' that went unproven for more than 350 years?", "Leonhard Euler", "Pierre de Fermat", "Carl Friedrich Gauss", "Blaise Pascal", "B", "Andrew Wiles finally proved it in the mid-1990s.", "Yes"]
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
  join: join,
  login: login,
  submitAnswer: submitAnswer,
  useBonus: useBonus,
  newRun: newRun,
  getGuestQuestion: getGuestQuestion,
  guestAnswer: guestAnswer,
  logShare: logShare,
  reportQuestion: reportQuestion
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
      ['Run Length (days)', '30', 'How many questions in a row a player must get right to make the Hall of Fame.'],
      ['Time Zone', tz, 'Everyone\'s next question unlocks at midnight in this time zone. Also used for dates.']
    ]);
    styleHeader_(settings, 3);
    settings.setColumnWidth(1, 220);
    settings.setColumnWidth(2, 420);
    settings.setColumnWidth(3, 560);
  }
  addSettingIfMissing_(settings, 'Bonus Questions Per Day', '2',
    'Most bonus questions a player can use in one day. Players earn a bonus each time a friend joins with their invite link.');
  addSettingIfMissing_(settings, 'Pause Days Per Run', '2',
    'Days a player can miss in one run. Each missed day uses one. Missing one more than this ends the run.');
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

  // ---- Upgrade data from earlier versions (safe to run again) ----
  const upgradeNotes = upgradeToV7_(ss);
  upgradeNotes.forEach(n => Logger.log(n));
  const fixed = applyQuestionFixes_(ss);
  if (fixed) Logger.log(fixed + ' question(s) updated with fairness fixes.');

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
    ['THE GAME'],
    ['   Visitors can answer one Easy question before signing up. If they get it right and join, it counts as their question 1.'],
    ['   A player\'s first question is available the moment they join. After that, everyone gets one question per day,'],
    ['      and the next one unlocks at midnight (Time Zone in Settings).'],
    ['   Each player gets a random question from the right difficulty level for their question number,'],
    ['      skipping questions they have already seen. With a 30-question run: 1-7 Easy, 8-14 Medium, 15-21 Hard, 22-30 Very Hard.'],
    ['   A wrong answer ends the run. The correct answer is revealed after the next midnight.'],
    ['   Missing a day uses a pause day (Pause Days Per Run in Settings). Missing more days than that ends the run.'],
    ['   Get every question in a run right (Run Length in Settings) and they go into the Hall of Fame.'],
    ['   Anyone who is out can start a new run for free. The first restart each day gets a question right away.'],
    [''],
    ['BONUS QUESTIONS (COMEBACKS)'],
    ['   Every player has a personal invite link. Each friend who joins through it earns that player 1 bonus question.'],
    ['   Knocked out? A bonus brings them back where they left off. After a wrong answer they get a different question'],
    ['      at the same level. Comebacks show a small badge on the leaderboard and Hall of Fame.'],
    ['   Players can use up to 2 bonus questions per day (Bonus Questions Per Day in Settings). Unused bonuses carry over.'],
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




/* =============================================================
 * CALLED BY THE GAME WEBSITE
 * =============================================================
 * HOW A RUN WORKS (version 7)
 *   - Day 1's question is available the moment you join (or after a restart).
 *   - After that, one question per calendar day. Everyone's next question
 *     unlocks at midnight in the Time Zone setting.
 *   - Each player gets a random question from the right difficulty level
 *     for their question number, never one they've already seen if possible.
 *   - Wrong answer = out. Missing a day uses one of your pause days
 *     (Pause Days Per Run). Running out of pause days = out.
 *   - Out? Start a new run for free any time. Or use a bonus question
 *     (earned when a friend joins with your link) to come back where you left off.
 * ============================================================= */

function getState(token, ref) {
  const s = settings_();
  const state = {
    gameName: s.gameName,
    tagline: s.tagline,
    length: s.length,
    bonusLimit: s.bonusPerDay,
    pauseLimit: s.pauseLimit,
    shareUrl: gameUrl_(),
    referrerName: '',
    player: null,
    question: null,
    questionMissing: false,
    countdown: secondsToReset_(s),
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
    let changed = checkMissed_(row, Date.now(), s);

    const today = todayKey_(s);
    const status = String(row[P.STATUS]);
    const days = Number(row[P.DAYS]) || 0;
    const lastDate = normDate_(row[P.LASTDATE], s);
    const answeredToday = status === 'Alive' && lastDate === today;
    const usedToday = bonusUsedToday_(row, s);
    const bonus = Number(row[P.BONUS]) || 0;
    const reason = String(row[P.REASON] || '');

    state.player = {
      name: String(row[P.NAME]),
      status: status,
      questionNumber: Math.min(days + 1, s.length),
      daysSurvived: days,
      outOnDay: Number(row[P.OUTDAY]) || 0,
      outReason: reason,
      best: Math.max(Number(row[P.BEST]) || 0, days),
      attempt: Number(row[P.ATTEMPT]) || 1,
      bonus: bonus,
      bonusUsedToday: usedToday,
      friendsInvited: Number(row[P.FRIENDS]) || 0,
      pausesLeft: Math.max(0, s.pauseLimit - (Number(row[P.PAUSES]) || 0)),
      comebacks: Number(row[P.COMEBACKS]) || 0,
      answeredToday: answeredToday,
      inviteUrl: state.shareUrl ? state.shareUrl + (state.shareUrl.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + row[P.ID] : '',
      canComeBack: status === 'Out' && reason !== 'Removed by admin' && bonus > 0 && usedToday < s.bonusPerDay,
      canRestart: (status === 'Out' && reason !== 'Removed by admin') || status === 'Champion',
      restartIsInstant: normDate_(row[P.RESTARTDATE], s) !== today
    };

    if (status === 'Alive' && !answeredToday) {
      const served = serveQuestion_(row, s);
      if (served.changed) changed = true;
      if (served.q) {
        const q = served.q;
        state.question = { number: days + 1, secondChance: served.secondChance, difficulty: q.difficulty,
          text: q.text, choices: { A: q.A, B: q.B, C: q.C, D: q.D } };
        const shownKey = q.id + '|' + (Number(row[P.ATTEMPT]) || 1) + '|' + (days + 1);
        if (String(row[P.SHOWNQ]) !== shownKey) {
          row[P.SHOWNQ] = shownKey;
          row[P.SHOWNAT] = Date.now();
          changed = true;
        }
      } else {
        state.questionMissing = true;
      }
    }

    // The answer to your last question is revealed after the next midnight reset.
    if (row[P.LASTQ] && lastDate && lastDate < today) state.reveal = reveal_(row[P.LASTQ]);
    state.player.lastQuestionId = String(row[P.LASTQ] || '');

    // Rank by best run, and the player's circle (who invited them, and who they invited)
    const bestOf = r => Math.max(Number(r[P.BEST]) || 0, Number(r[P.DAYS]) || 0);
    const named = data.rows.filter(r => r[P.NAME]);
    const myBest = bestOf(row);
    state.player.rank = 1 + named.filter(r => bestOf(r) > myBest).length;
    state.player.totalPlayers = named.length;
    state.circle = named.filter(r => r[P.ID] !== row[P.ID] && (r[P.ID] === row[P.REFBY] || r[P.REFBY] === row[P.ID]))
      .map(r => {
        const c = r.slice();
        checkMissed_(c, Date.now(), s);
        return {
          name: String(c[P.NAME]),
          relation: c[P.ID] === row[P.REFBY] ? 'invited you' : 'you invited',
          status: String(c[P.STATUS]),
          survived: Number(c[P.DAYS]) || 0,
          best: bestOf(c),
          answeredToday: c[P.STATUS] === 'Alive' && normDate_(c[P.LASTDATE], s) === today
        };
      })
      .sort((a, b) => b.survived - a.survived || a.name.localeCompare(b.name));

    if (changed) writePlayer_(data.sh, i, row);
  } finally {
    lock.releaseLock();
  }

  try {
    if (s.showAds && state.player) {
      if (state.reveal) state.ads.reveal = pickAd_(state.reveal.id, s);
      const st = state.player.status;
      const slot = st === 'Out' ? 'Knockout' : st === 'Champion' ? 'Champion'
        : (st === 'Alive' && state.player.answeredToday) ? 'Waiting' : '';
      if (slot) state.ads.slot = pickAd_(slot, s);
    }
  } catch (err) { Logger.log(err); }
  return state;
}

function getLeaderboard() {
  const s = settings_();
  const now = Date.now();
  const today = todayKey_(s);
  const rows = readPlayers_().rows.filter(r => r[P.NAME]).map(r => {
    const copy = r.slice();
    checkMissed_(copy, now, s); // display only; the hourly check saves it
    return copy;
  });

  const alive = rows.filter(r => r[P.STATUS] === 'Alive').map(r => ({
    name: String(r[P.NAME]),
    survived: Number(r[P.DAYS]) || 0,
    comebacks: Number(r[P.COMEBACKS]) || 0,
    answeredToday: normDate_(r[P.LASTDATE], s) === today
  })).sort((a, b) => b.survived - a.survived || a.name.localeCompare(b.name));

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
        attempt: Number(r[2]) || 1,
        comebacks: Number(r[4]) || 0
      }))
      .reverse().slice(0, 25);
  }

  const bestRuns = rows.map(r => ({
    name: String(r[P.NAME]),
    best: Math.max(Number(r[P.BEST]) || 0, Number(r[P.DAYS]) || 0),
    status: String(r[P.STATUS])
  })).filter(r => r.best > 0)
    .sort((a, b) => b.best - a.best || a.name.localeCompare(b.name)).slice(0, 10);

  return { alive: alive, out: out, hall: hall, recruiters: recruiters, bestRuns: bestRuns, total: rows.length, length: s.length };
}

// A visitor can try one Easy question before signing up.
function getGuestQuestion() {
  const id = pickQuestion_('Easy', [], []);
  const q = id ? question_(id) : null;
  if (!q) throw new Error('No questions are set up yet.');
  return { id: q.id, difficulty: q.difficulty, text: q.text, choices: { A: q.A, B: q.B, C: q.C, D: q.D } };
}

// Checks a visitor's answer. The correct letter is never sent back.
function guestAnswer(id, choice) {
  choice = String(choice || '').toUpperCase();
  if (!/^[ABCD]$/.test(choice)) throw new Error('Pick A, B, C, or D.');
  const q = question_(String(id || ''));
  if (!q || q.difficulty !== 'Easy') throw new Error('That question is not available. Please refresh.');
  const correct = choice === q.correct;
  try {
    ss_().getSheetByName(TAB.ANSWERS).appendRow([new Date(), 'GUEST', '(visitor)', '', 1, q.id, choice, correct ? 'Yes' : 'No', '']);
  } catch (err) { Logger.log(err); }
  return { correct: correct, secondsToReset: secondsToReset_(settings_()) };
}

function join(name, pin, confirmed13, ref, deviceId, guest) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  pin = String(pin || '').trim();
  ref = String(ref || '');
  deviceId = cleanDevice_(deviceId);
  if (!confirmed13) throw new Error('You must confirm you are 13 or older to play.');
  if (!/^[A-Za-z0-9 _.\-]{2,20}$/.test(name)) {
    throw new Error('Pick a display name 2 to 20 characters long, using letters, numbers, spaces, dashes, dots, or underscores.');
  }
  if (!/^\d{4,6}$/.test(pin)) throw new Error('Your PIN must be 4 to 6 numbers.');

  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    if (data.rows.some(r => String(r[P.NAME]).toLowerCase() === name.toLowerCase())) {
      throw new Error('That display name is taken. Try another one.');
    }

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

    // Did they already get the visitor question right? Check it here, never trust the browser.
    let guestCorrect = false, guestId = '';
    if (guest && guest.id) {
      const gq = question_(String(guest.id));
      if (gq && gq.difficulty === 'Easy') {
        guestId = gq.id;
        guestCorrect = String(guest.choice || '').toUpperCase() === gq.correct;
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
    row[P.DAYS] = guestCorrect ? 1 : 0;
    row[P.BEST] = guestCorrect ? 1 : 0;
    row[P.BONUS] = 0;
    row[P.BONUSUSED] = 0;
    row[P.REFBY] = refId;
    row[P.FRIENDS] = 0;
    row[P.DEVICES] = deviceId;
    row[P.FAST] = 0;
    row[P.PAUSES] = 0;
    row[P.COMEBACKS] = 0;
    row[P.SEEN] = guestId;
    row[P.LASTQ] = guestCorrect ? guestId : '';
    row[P.LASTDATE] = guestCorrect ? todayKey_(s) : yesterdayKey_(s);
    data.sh.appendRow(row);
    data.sh.getRange(data.sh.getLastRow(), P.LASTDATE + 1, 1, 1).setNumberFormat('@');

    try {
      if (deviceId) sameDeviceCheck_(data.rows, row, deviceId);
      if (refRow) {
        const recent = data.rows.filter(r => r[P.REFBY] === refId &&
          r[P.JOINED] instanceof Date && now - r[P.JOINED].getTime() < DAY_MS).length + 1;
        if (recent >= CHEAT.BURST_FRIENDS) {
          alert_('Sign-up burst', String(refRow[P.NAME]),
            recent + ' people joined with ' + refRow[P.NAME] + '\'s invite link in the last 24 hours. Newest: ' + name +
            '. Could be real friends, or fake accounts made to earn bonus questions.',
            'burst|' + refId + '|' + todayKey_(s));
        }
      }
    } catch (err) { Logger.log(err); }

    return { token: token, startedWithCorrect: guestCorrect };
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

    if (checkMissed_(row, now, s) && row[P.STATUS] !== 'Alive') {
      writePlayer_(data.sh, i, row);
      return { result: 'missed', outOnDay: row[P.OUTDAY] };
    }
    if (row[P.STATUS] !== 'Alive') throw new Error('You are not in a run right now.');
    const today = todayKey_(s);
    if (normDate_(row[P.LASTDATE], s) === today) throw new Error('You already answered today. Your next question unlocks at midnight.');

    const served = serveQuestion_(row, s);
    const q = served.q;
    if (!q) throw new Error('Your question is not ready yet. Please refresh.');

    const days = Number(row[P.DAYS]) || 0;
    const qnum = days + 1;
    const correct = choice === q.correct;
    const shownKey = q.id + '|' + (Number(row[P.ATTEMPT]) || 1) + '|' + qnum;
    const secs = (String(row[P.SHOWNQ]) === shownKey && Number(row[P.SHOWNAT]))
      ? Math.round((now - Number(row[P.SHOWNAT])) / 100) / 10 : '';
    ss_().getSheetByName(TAB.ANSWERS).appendRow(
      [new Date(now), row[P.ID], row[P.NAME], row[P.ATTEMPT], qnum, q.id, choice, correct ? 'Yes' : 'No', secs]);

    if (correct && secs !== '' && secs < CHEAT.FAST_SECONDS && /hard/i.test(q.difficulty)) {
      row[P.FAST] = (Number(row[P.FAST]) || 0) + 1;
      if (Number(row[P.FAST]) % CHEAT.FAST_COUNT === 0) {
        try {
          alert_('Lightning answers', String(row[P.NAME]),
            row[P.NAME] + ' has answered ' + row[P.FAST] + ' Hard or Very Hard questions correctly in under ' +
            CHEAT.FAST_SECONDS + ' seconds each. Latest: question ' + q.id + ' in ' + secs +
            ' seconds. They may be getting answers from someone else.',
            'fast|' + row[P.ID] + '|' + row[P.FAST]);
        } catch (err) { Logger.log(err); }
      }
    }

    row[P.LASTDATE] = today;
    row[P.LASTQ] = q.id;
    row[P.CURQ] = '';
    row[P.SEEN] = addSeen_(row[P.SEEN], q.id);
    let champion = false;
    if (correct) {
      row[P.DAYS] = qnum;
      row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, qnum);
      if (qnum >= s.length) {
        champion = true;
        row[P.STATUS] = 'Champion';
        ss_().getSheetByName(TAB.HALL).appendRow([new Date(now), row[P.NAME], row[P.ATTEMPT], qnum, Number(row[P.COMEBACKS]) || 0]);
      }
    } else {
      row[P.STATUS] = 'Out';
      row[P.OUTDAY] = qnum;
      row[P.REASON] = 'Wrong answer';
    }
    writePlayer_(data.sh, i, row);
    data.sh.getRange(i + 2, P.LASTDATE + 1, 1, 1).setNumberFormat('@');

    let ad = null;
    try {
      if (s.showAds) ad = pickAd_(champion ? 'Champion' : correct ? 'Waiting' : 'Knockout', s);
    } catch (err) { Logger.log(err); }
    return {
      ad: ad,
      disclosure: s.showAds ? AMAZON_DISCLOSURE : '',
      result: correct ? 'correct' : 'wrong',
      questionNumber: qnum,
      daysSurvived: Number(row[P.DAYS]) || 0,
      length: s.length,
      champion: champion,
      secondsToNext: secondsToReset_(s)
    };
  } finally {
    lock.releaseLock();
  }
}

// Spend 1 bonus question (earned when a friend joins with your link) to come back
// where you left off after being knocked out. Limit per day is in Settings.
function useBonus(token) {
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => r[P.TOKEN] && r[P.TOKEN] === token);
    if (i < 0) throw new Error('Please log in again.');
    const row = data.rows[i];
    checkMissed_(row, Date.now(), s);

    if (row[P.STATUS] !== 'Out') throw new Error('Bonus questions are for coming back after you get knocked out. Yours will be saved until then.');
    if (row[P.REASON] === 'Removed by admin') throw new Error('This run was ended by the game organizer.');
    if ((Number(row[P.BONUS]) || 0) <= 0) {
      throw new Error('You do not have a bonus question yet. Share your invite link. Each friend who joins earns you one.');
    }
    const used = bonusUsedToday_(row, s);
    if (used >= s.bonusPerDay) {
      throw new Error('You have used your ' + s.bonusPerDay + ' bonus questions for today. Your bonuses will still be here tomorrow.');
    }
    comeBack_(row, s);
    row[P.BONUS] = (Number(row[P.BONUS]) || 0) - 1;
    row[P.BONUSDATE] = todayKey_(s);
    row[P.BONUSUSED] = used + 1;
    writePlayer_(data.sh, i, row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// Start a brand-new run at question 1, free. Available after being knocked out or finishing.
// The first restart each day gets a question right away; after that, the new run starts at midnight.
function newRun(token) {
  const s = settings_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = readPlayers_();
    const i = data.rows.findIndex(r => r[P.TOKEN] && r[P.TOKEN] === token);
    if (i < 0) throw new Error('Please log in again.');
    const row = data.rows[i];
    checkMissed_(row, Date.now(), s);
    const ok = (row[P.STATUS] === 'Out' && row[P.REASON] !== 'Removed by admin') || row[P.STATUS] === 'Champion';
    if (!ok) throw new Error('You can start a new run after this one ends.');
    const instant = startRun_(row, s, false);
    writePlayer_(data.sh, i, row);
    return { ok: true, instant: instant };
  } finally {
    lock.releaseLock();
  }
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

/* ---------------- run helpers ---------------- */

// Resets a row to a fresh run. Returns true if their first question is available right away.
function startRun_(row, s, forceInstant) {
  const today = todayKey_(s);
  const instant = forceInstant || normDate_(row[P.RESTARTDATE], s) !== today;
  row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, Number(row[P.DAYS]) || 0);
  row[P.STATUS] = 'Alive';
  row[P.START] = new Date();
  row[P.ATTEMPT] = (Number(row[P.ATTEMPT]) || 1) + 1;
  row[P.DAYS] = 0;
  row[P.OUTDAY] = '';
  row[P.REASON] = '';
  row[P.CURQ] = '';
  row[P.PAUSES] = 0;
  row[P.COMEBACKS] = 0;
  row[P.LASTDATE] = instant ? yesterdayKey_(s) : today;
  if (!forceInstant) row[P.RESTARTDATE] = today;
  return instant;
}

// Brings a knocked-out player back where they left off, with a new question right away.
function comeBack_(row, s) {
  const wasWrong = row[P.REASON] === 'Wrong answer';
  const wasMissed = /^Missed/.test(String(row[P.REASON] || ''));
  const days = Number(row[P.DAYS]) || 0;
  row[P.STATUS] = 'Alive';
  row[P.OUTDAY] = '';
  row[P.REASON] = '';
  row[P.COMEBACKS] = (Number(row[P.COMEBACKS]) || 0) + 1;
  row[P.LASTDATE] = yesterdayKey_(s);
  if (wasMissed) row[P.PAUSES] = s.pauseLimit; // back in, but no pause days left this run
  // A different question at the same level, never the one they just missed.
  const pick = wasWrong ? pickQuestion_(tierFor_(days + 1, s.length), seenList_(row[P.SEEN]), [String(row[P.LASTQ] || '')]) : '';
  row[P.CURQ] = pick ? '!' + pick : '';
}

// Marks missed days. Each missed day uses a pause day; running out of pause days ends the run.
// Missed days don't count before a player answers their first question of a run.
// Returns true if it changed the row.
function checkMissed_(row, now, s) {
  if (!row[P.NAME] || row[P.STATUS] !== 'Alive') return false;
  const todayN = dayNum_(todayKey_(s));
  const yesterday = yesterdayKey_(s);
  const last = normDate_(row[P.LASTDATE], s);
  if (!last) { row[P.LASTDATE] = yesterday; return true; }
  const missed = todayN - dayNum_(last) - 1;
  if (missed <= 0) return false;
  row[P.LASTDATE] = yesterday;
  if ((Number(row[P.DAYS]) || 0) === 0) return true; // the first question just waits for them
  row[P.PAUSES] = (Number(row[P.PAUSES]) || 0) + missed;
  if (Number(row[P.PAUSES]) > s.pauseLimit) {
    row[P.STATUS] = 'Out';
    row[P.OUTDAY] = (Number(row[P.DAYS]) || 0) + 1;
    row[P.REASON] = 'Missed too many days';
    row[P.BEST] = Math.max(Number(row[P.BEST]) || 0, Number(row[P.DAYS]) || 0);
    row[P.CURQ] = '';
  }
  return true;
}

// Gives the player their current question, picking a new random one if needed.
function serveQuestion_(row, s) {
  // A Second Chance question is stored with a ! in front of its ID.
  const cur = String(row[P.CURQ] || '');
  if (cur) {
    const second = cur.charAt(0) === '!';
    const q = question_(second ? cur.slice(1) : cur);
    if (q && q.active) return { q: q, changed: false, secondChance: second };
  }
  const qnum = (Number(row[P.DAYS]) || 0) + 1;
  const id = pickQuestion_(tierFor_(qnum, s.length), seenList_(row[P.SEEN]), [String(row[P.LASTQ] || '')]);
  if (!id) return { q: null, changed: false, secondChance: false };
  row[P.CURQ] = id;
  return { q: question_(id), changed: true, secondChance: false };
}

// Which difficulty a question number gets. With a 30-day run: 1-7 Easy, 8-14 Medium, 15-21 Hard, 22-30 Very Hard.
function tierFor_(qnum, length) {
  const f = qnum / Math.max(1, length);
  if (f <= 7 / 30 + 1e-9) return 'Easy';
  if (f <= 14 / 30 + 1e-9) return 'Medium';
  if (f <= 21 / 30 + 1e-9) return 'Hard';
  return 'Very Hard';
}

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
  return list.slice(-400).join(',');
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
      return [id, normDifficulty_(r[1]), text, r[3], r[4], r[5], r[6], String(r[7]).trim().toUpperCase(), r[8], active];
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

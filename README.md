# Holdout

One trivia question a day. One wrong answer and you are out. Survive 30 days to make the Hall of Fame.

How it is built

- index.html and config.js: the game website players see. GitHub Pages hosts it at https://pickledbee.github.io/holdout/
- Google Apps Script (attached to the Holdout Google Sheet): the game rules, the questions and answers, players, bonus questions, Amazon picks, cheat alerts, and the Admin Panel. The website sends every request to it, so answers never reach players' browsers.
- apps-script folder: a backup copy of the Apps Script files (Code.gs, Admin.gs, admin.html). The live copy is the one inside Apps Script. If you change one, paste the change into the other so they match.

The one setting the website needs

Open config.js and paste your Apps Script Web app link (it ends in /exec) between the quotes.

As an Amazon Associate I earn from qualifying purchases.

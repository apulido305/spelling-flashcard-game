// Committed regression smoke test for the spelling flashcard app.
//
// Runs against a real headless browser (not just type-checking) because
// this app has a real history of behavior that only breaks at runtime -
// most notably several iOS Safari speech-synthesis distortion bugs that
// static analysis would never catch. Speech is verified by spying on
// window.speechSynthesis.speak rather than actually listening.
//
// Usage: node tests/smoke.mjs
// Env:   SMOKE_URL - base URL of a running instance (default http://localhost:5173)

import { chromium } from 'playwright';

const BASE_URL = process.env.SMOKE_URL || 'http://localhost:5173';

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function newPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.addInitScript(() => {
    window.__spoken = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = (utterance) => {
        window.__spoken.push(utterance.text);
      };
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Ready to practice', { timeout: 10000 });

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept('Smoke Test List');
    } else {
      await dialog.accept();
    }
  });

  return { context, page, pageErrors };
}

async function lastSpoken(page) {
  return page.evaluate(() => window.__spoken[window.__spoken.length - 1]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function startGame(page, words) {
  await page.fill('textarea', words.join('\n'));
  await page.click('button:has-text("Start Game")');
  await page.waitForSelector('.play-definition', { timeout: 5000 });
}

async function answerCorrectly(page, knownWord) {
  // Pass knownWord explicitly whenever a hint button (Spell it / Sound it
  // out) was clicked first - those also go through the speech spy, so
  // lastSpoken() would otherwise return the hint text instead of the word.
  const word = knownWord ?? (await lastSpoken(page));
  await page.fill('input[type="text"]', word);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.feedback.correct', { timeout: 3000 });
  const feedbackText = await page.locator('.feedback').innerText();
  await page.waitForSelector('.feedback', { state: 'detached', timeout: 3000 }).catch(() => {});
  return { word, feedbackText };
}

test('Setup: default list quick-start, custom paste, and Clear all work', async (browser) => {
  const { context, page, pageErrors } = await newPage(browser);

  const playBtn = page.locator('button:has-text("▶ Play")');
  assert(await playBtn.isVisible(), 'Quick-start Play button should be visible on Setup');
  await playBtn.click();
  await page.waitForSelector('.play-definition', { timeout: 5000 });
  const progress = await page.locator('.play-progress').innerText();
  assert(progress.includes('19 left in queue'), `Expected 20-word default list, got: ${progress}`);

  // Back to Setup via New List, then test paste + Clear.
  await page.click('button:has-text("New List")');
  await page.waitForSelector('text=Ready to practice', { timeout: 5000 });
  await page.fill('textarea', 'apple\nbanana\ncherry');
  await page.click('button:has-text("Clear")');
  const textareaValue = await page.locator('textarea').inputValue();
  assert(textareaValue === '', 'Clear should empty the textarea');

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

test('Play loop: correct/incorrect scoring and requeue-on-miss, hint after 2 misses', async (browser) => {
  const { context, page, pageErrors } = await newPage(browser);
  const words = ['cat', 'dog', 'house', 'tree', 'water'];
  await startGame(page, words);

  const targetWord = await lastSpoken(page);

  // requeue() reinserts a missed word 3-5 spots ahead, so it won't be at the
  // front again on the very next turn - cycle through, answering every OTHER
  // word correctly (which permanently removes them, shrinking the pool) and
  // only interacting with targetWord each time it resurfaces, until it's
  // been missed exactly twice and the hint appears on its third turn.
  let missesOnTarget = 0;
  let hintSeen = false;
  for (let i = 0; i < 30 && !hintSeen; i++) {
    const word = await lastSpoken(page);
    if (word === targetWord && missesOnTarget < 2) {
      await page.fill('input[type="text"]', 'xxWRONGxx');
      await page.click('button[type="submit"]');
      await page.waitForSelector('.feedback.incorrect', { timeout: 3000 });
      const feedbackText = await page.locator('.feedback').innerText();
      assert(feedbackText.includes(targetWord), `Incorrect feedback should reveal "${targetWord}", got: ${feedbackText}`);
      missesOnTarget++;
      await page.waitForSelector('.feedback', { state: 'detached', timeout: 3000 });
    } else if (word === targetWord && missesOnTarget === 2) {
      hintSeen = await page.locator('.hint-text').isVisible().catch(() => false);
      assert(hintSeen, 'Hint should appear once the twice-missed word resurfaces a third time');
      await page.fill('input[type="text"]', word);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.feedback.correct', { timeout: 3000 });
      const feedbackText = await page.locator('.feedback').innerText();
      assert(feedbackText.includes('+5'), `Expected +5 after 2 misses, got: ${feedbackText}`);
      await page.waitForSelector('.feedback', { state: 'detached', timeout: 3000 }).catch(() => {});
    } else {
      await answerCorrectly(page, word);
    }
  }
  assert(hintSeen, 'Hint should have appeared and been verified within the loop');

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

test('Spell it costs points and flags review; Sound it out stays free', async (browser) => {
  const { context, page, pageErrors } = await newPage(browser);
  await startGame(page, ['cat', 'dog', 'house']);

  // Word 1: Sound it out (phonetic) - should stay full price, no review flag.
  const word1 = await lastSpoken(page);
  await page.click('button:has-text("Sound it out")');
  await page.waitForTimeout(150);
  const noteAfterSoundOut = await page.locator('.help-used-note').isVisible().catch(() => false);
  assert(!noteAfterSoundOut, 'Sound it out must not trigger the help-used penalty note');
  let { feedbackText } = await answerCorrectly(page, word1);
  assert(feedbackText.includes('+10'), `Expected +10 (Sound it out is free) for "${word1}", got: ${feedbackText}`);

  // Word 2: Spell it - should still cost 5 points and show the note.
  const word2 = await lastSpoken(page);
  await page.click('button:has-text("Spell it")');
  await page.waitForTimeout(150);
  const noteAfterSpellIt = await page.locator('.help-used-note').isVisible();
  assert(noteAfterSpellIt, 'Spell it should trigger the help-used penalty note');
  ({ feedbackText } = await answerCorrectly(page, word2));
  assert(feedbackText.includes('+5'), `Expected +5 (Spell it costs) for "${word2}", got: ${feedbackText}`);

  // Word 3: no help - full price, finishes the queue.
  await answerCorrectly(page);

  await page.waitForSelector('text=Session Complete!', { timeout: 5000 });
  const finalScore = await page.locator('.summary-score').innerText();
  assert(finalScore.includes('25'), `Expected score 25 (10+5+10), got: ${finalScore}`);
  const missedListItems = await page.locator('.missed-list li').allInnerTexts();
  assert(
    missedListItems.length === 1 && missedListItems[0].toLowerCase() === word2.toLowerCase(),
    `Expected review list to contain only "${word2}", got: ${JSON.stringify(missedListItems)}`
  );

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

test('Session completion, Play Again, Restart, and New List all work', async (browser) => {
  const { context, page, pageErrors } = await newPage(browser);
  await startGame(page, ['cat', 'dog']);

  await answerCorrectly(page);
  await answerCorrectly(page);
  await page.waitForSelector('text=Session Complete!', { timeout: 5000 });

  // Play Again resets score and reshuffles the same list.
  await page.click('button:has-text("Play Again")');
  await page.waitForSelector('.play-definition', { timeout: 5000 });
  let progress = await page.locator('.play-progress').innerText();
  assert(progress.includes('Score: 0') && progress.includes('Word 1'), `Expected fresh state after Play Again, got: ${progress}`);

  // Build up some progress, then Restart should zero it out without leaving Play.
  await answerCorrectly(page);
  progress = await page.locator('.play-progress').innerText();
  assert(progress.includes('Score: 10'), `Expected Score: 10 before restart, got: ${progress}`);
  await page.click('button:has-text("Restart")');
  await page.waitForTimeout(200);
  progress = await page.locator('.play-progress').innerText();
  assert(progress.includes('Score: 0') && progress.includes('Word 1'), `Expected fresh state after Restart, got: ${progress}`);

  // New List returns to a cleared Setup screen.
  await page.click('button:has-text("New List")');
  await page.waitForSelector('text=Ready to practice', { timeout: 5000 });
  const textareaValue = await page.locator('textarea').inputValue();
  assert(textareaValue === '', 'New List should clear session state back to an empty Setup screen');

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

test('Saved lists: save, persist across reload, load, and delete', async (browser) => {
  const { context, page, pageErrors } = await newPage(browser);

  await page.fill('textarea', 'alpha\nbeta\ngamma');
  await page.click('button:has-text("Save List")');
  await page.waitForTimeout(200);

  const savedRow = page.locator('.saved-list-row', { hasText: 'Smoke Test List' });
  assert(await savedRow.isVisible(), 'Saved list row should appear after saving');
  const rowText = await savedRow.innerText();
  assert(rowText.includes('3 words'), `Expected "3 words" in saved list row, got: ${rowText}`);

  await page.click('button:has-text("Clear")');
  await savedRow.locator('button:has-text("Load")').click();
  const loaded = await page.locator('textarea').inputValue();
  assert(loaded === 'alpha\nbeta\ngamma', `Load should repopulate the textarea, got: "${loaded}"`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Ready to practice', { timeout: 10000 });
  const persistedRow = page.locator('.saved-list-row', { hasText: 'Smoke Test List' });
  assert(await persistedRow.isVisible(), 'Saved list should persist across a reload');

  await persistedRow.locator('button[aria-label="Delete Smoke Test List"]').click();
  await page.waitForTimeout(200);
  const savedListsSectionCount = await page.locator('.saved-lists').count();
  assert(savedListsSectionCount === 0, 'Saved lists section should disappear once the only saved list is deleted');

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

test('Mastery tracking: masters after 3 separate clean days, biases future queues', async (browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('dialog', async (dialog) => {
    await dialog.accept(dialog.type() === 'prompt' ? 'x' : undefined);
  });
  await page.addInitScript(() => {
    window.__spoken = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = (utterance) => window.__spoken.push(utterance.text);
    }
  });

  // setFixedTime only overrides Date.now()/new Date() - real timers (the
  // correct/incorrect feedback delays, the speech cancel/speak beat) keep
  // running normally, so gameplay waits below behave exactly as in every
  // other test. This lets us simulate separate calendar days without
  // actually waiting real time.
  await page.clock.setFixedTime(new Date('2024-01-01T09:00:00'));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Ready to practice', { timeout: 10000 });

  const words = ['mango', 'kiwi'];

  async function playOneCleanSession() {
    await page.fill('textarea', words.join('\n'));
    await page.click('button:has-text("Start Game")');
    await page.waitForSelector('.play-definition', { timeout: 5000 });
    for (let i = 0; i < words.length; i++) {
      await answerCorrectly(page);
    }
    await page.waitForSelector('text=Session Complete!', { timeout: 5000 });
  }

  async function backToSetup() {
    await page.click('button:has-text("New List")');
    await page.waitForSelector('text=Ready to practice', { timeout: 5000 });
  }

  // Day 1, first session: clean, but only 1 day in - not mastered yet.
  await playOneCleanSession();
  assert(
    !(await page.locator('.newly-mastered').isVisible().catch(() => false)),
    'Should not be mastered after only 1 clean day'
  );
  await backToSetup();

  // Day 1, second session (same calendar day): must NOT double-count -
  // spaced repetition requires separation across days, not just repeated
  // attempts within one sitting.
  await playOneCleanSession();
  assert(
    !(await page.locator('.newly-mastered').isVisible().catch(() => false)),
    'A same-day repeat must not advance the mastery streak'
  );
  await backToSetup();

  // Day 2: second distinct clean day.
  await page.clock.setFixedTime(new Date('2024-01-02T09:00:00'));
  await playOneCleanSession();
  assert(
    !(await page.locator('.newly-mastered').isVisible().catch(() => false)),
    'Should not be mastered after only 2 clean days'
  );
  await backToSetup();

  // Day 3: third distinct clean day - mastery should trigger for both words.
  await page.clock.setFixedTime(new Date('2024-01-03T09:00:00'));
  await playOneCleanSession();
  const newlyMasteredText = await page.locator('.newly-mastered').innerText();
  assert(
    newlyMasteredText.includes('mango') && newlyMasteredText.includes('kiwi'),
    `Expected both words newly mastered after 3 clean days, got: "${newlyMasteredText}"`
  );
  await backToSetup();

  // Queue biasing: mix the now-mastered words with a brand-new one - the
  // not-yet-mastered word should always surface first.
  await page.fill('textarea', ['papaya', ...words].join('\n'));
  await page.click('button:has-text("Start Game")');
  await page.waitForSelector('.play-definition', { timeout: 5000 });
  const firstWord = await lastSpoken(page);
  assert(firstWord === 'papaya', `Expected the not-yet-mastered word first in the queue, got: "${firstWord}"`);

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

test('Quiz mode: single attempt, no hints, correct/total scoring, and does not affect mastery', async (browser) => {
  const { context, page, pageErrors } = await newPage(browser);

  const words = ['quartz', 'zephyr', 'onyx'];
  await page.fill('textarea', words.join('\n'));

  const testBtn = page.locator('button:has-text("Take the Test")');
  assert(await testBtn.isVisible(), '"Take the Test" button should be visible on Setup');
  await testBtn.click();
  await page.waitForSelector('.play-definition', { timeout: 5000 });

  assert(
    !(await page.locator('button:has-text("Spell it")').isVisible().catch(() => false)),
    'Spell it should be hidden in quiz mode'
  );
  assert(
    !(await page.locator('button:has-text("Sound it out")').isVisible().catch(() => false)),
    'Sound it out should be hidden in quiz mode'
  );

  // Word 1: correct - plain "Correct!" feedback, no points language.
  let word = await lastSpoken(page);
  await page.fill('input[type="text"]', word);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.feedback.correct', { timeout: 3000 });
  let feedbackText = await page.locator('.feedback').innerText();
  assert(feedbackText === 'Correct!', `Expected plain "Correct!" in quiz mode, got: "${feedbackText}"`);
  await page.waitForSelector('.feedback', { state: 'detached', timeout: 3000 }).catch(() => {});
  let progress = await page.locator('.play-progress').innerText();
  assert(progress.includes('Correct: 1'), `Expected "Correct: 1", got: ${progress}`);

  // Word 2: miss it - one attempt only, must NOT be requeued.
  const missedWord = await lastSpoken(page);
  await page.fill('input[type="text"]', 'xxWRONGxx');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.feedback.incorrect', { timeout: 3000 });
  feedbackText = await page.locator('.feedback').innerText();
  assert(feedbackText.includes(missedWord), `Expected feedback to reveal "${missedWord}", got: ${feedbackText}`);
  await page.waitForSelector('.feedback', { state: 'detached', timeout: 3000 }).catch(() => {});
  progress = await page.locator('.play-progress').innerText();
  assert(progress.includes('0 left in queue'), `Missed word should not be requeued, got: ${progress}`);

  // Word 3: correct, finishes the quiz.
  word = await lastSpoken(page);
  await page.fill('input[type="text"]', word);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Test Complete!', { timeout: 5000 });

  const scoreText = await page.locator('.summary-score').innerText();
  assert(scoreText.includes('2 / 3'), `Expected "2 / 3 correct", got: "${scoreText}"`);
  const heading = await page.locator('h2').innerText();
  assert(heading.includes('Study These'), `Expected quiz-framed heading, got: "${heading}"`);
  const missedListItems = await page.locator('.missed-list li').allInnerTexts();
  assert(
    missedListItems.length === 1 && missedListItems[0].toLowerCase() === missedWord.toLowerCase(),
    `Expected review list to contain only "${missedWord}", got: ${JSON.stringify(missedListItems)}`
  );
  assert(
    await page.locator('button:has-text("Retake the Test")').isVisible(),
    'Expected "Retake the Test" button on the quiz summary'
  );

  // Quiz mode must not touch mastery data - even a clean quiz shouldn't
  // silently build a practice streak.
  const masteryState = await page.evaluate(() => localStorage.getItem('spelling-flashcard:mastery'));
  if (masteryState) {
    const parsed = JSON.parse(masteryState);
    for (const w of words) {
      assert(!parsed[w], `Quiz mode should not write mastery data for "${w}", found: ${JSON.stringify(parsed[w])}`);
    }
  }

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

test('Progress dashboard: hidden when empty, reflects streak/mastery/quiz history', async (browser) => {
  const { context, page, pageErrors } = await newPage(browser);

  // Nothing practiced yet, nothing typed - dashboard should not render at all.
  assert(
    (await page.locator('.dashboard').count()) === 0,
    'Dashboard should be hidden with no streak, no quiz history, and no words typed'
  );

  await startGame(page, ['lemon', 'melon']);
  for (let i = 0; i < 2; i++) {
    await answerCorrectly(page);
  }
  await page.waitForSelector('text=Session Complete!', { timeout: 5000 });
  await page.click('button:has-text("New List")');
  await page.waitForSelector('text=Ready to practice', { timeout: 5000 });

  let dashboardText = await page.locator('.dashboard').innerText();
  assert(dashboardText.includes('1 day in a row'), `Expected a 1-day streak after one session, got: "${dashboardText}"`);

  await page.fill('textarea', 'lemon\nmelon');
  dashboardText = await page.locator('.dashboard').innerText();
  assert(
    dashboardText.includes('0 / 2 words mastered'),
    `Expected "0 / 2 words mastered" after only 1 clean day (mastery needs 3), got: "${dashboardText}"`
  );

  // Mastered count is reactive to whatever's currently in the textarea.
  await page.fill('textarea', 'lemon\nmelon\ngrape');
  dashboardText = await page.locator('.dashboard').innerText();
  assert(
    dashboardText.includes('0 / 3 words mastered'),
    `Expected the denominator to track the current textarea content, got: "${dashboardText}"`
  );

  await page.click('button:has-text("Take the Test")');
  await page.waitForSelector('.play-definition', { timeout: 5000 });
  for (let i = 0; i < 3; i++) {
    const word = await lastSpoken(page);
    await page.fill('input[type="text"]', word);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.feedback', { timeout: 3000 });
    await page.waitForSelector('.feedback', { state: 'detached', timeout: 3000 }).catch(() => {});
  }
  await page.waitForSelector('text=Test Complete!', { timeout: 5000 });
  await page.click('button:has-text("New List")');
  await page.waitForSelector('text=Ready to practice', { timeout: 5000 });

  dashboardText = await page.locator('.dashboard').innerText();
  assert(dashboardText.includes('Recent tests: 3/3'), `Expected "Recent tests: 3/3", got: "${dashboardText}"`);

  assert(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn(browser);
      console.log(`[PASS] ${name}`);
    } catch (err) {
      failures++;
      console.error(`[FAIL] ${name}`);
      console.error(err instanceof Error ? err.message : err);
    }
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\n${failures}/${tests.length} smoke test(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${tests.length} smoke tests passed`);
}

main();

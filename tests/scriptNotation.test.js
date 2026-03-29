import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cwd } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import {
  estimateReadingTime,
  generateDeliveryRoadmapPrompt,
  parseDeliveryScript
} from '../src/utils/formatters.js';

const SAMPLE_SCRIPT = `## Hook
Imagine a room where every pause feels intentional. [PAUSE]

## Core Narrative
[SLOW]We build trust through clarity and rhythm.[/SLOW]
The [[right word]] and the ((right phrase)) land together.
[FAST]The transition should feel lighter and quicker.[/FAST]

## Call to Action
Take the next step and speak with calm confidence.`;

async function loadJsxModule(modulePath) {
  const result = await build({
    entryPoints: [modulePath],
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: false,
    external: ['react']
  });

  const bundled = result.outputFiles[0].text;
  const tempDir = mkdtempSync(path.join(cwd(), '.teleprompter-test-'));
  const tempFile = path.join(tempDir, 'teleprompter.bundle.mjs');
  writeFileSync(tempFile, bundled);
  return import(pathToFileURL(tempFile).href);
}

test('parseDeliveryScript keeps sections and acoustic cues intact', () => {
  const parsed = parseDeliveryScript(SAMPLE_SCRIPT);

  assert.equal(parsed.stats.sectionCount, 3);
  assert.equal(parsed.stats.pauseCount, 1);
  assert.equal(parsed.stats.emphasisCount, 1);
  assert.equal(parsed.stats.enunciationCount, 1);
  assert.equal(parsed.sections[0].title, 'Hook');
  assert.equal(parsed.sections[1].paragraphs[0].tempo, 'slow');
  assert.equal(parsed.sections[1].paragraphs[1].tempo, 'normal');
  assert.equal(parsed.sections[1].paragraphs[2].tempo, 'fast');
  assert.match(parsed.plainText, /calm confidence/);
  assert.doesNotMatch(parsed.plainText, /\[SLOW\]|\[FAST\]/);
});

test('estimateReadingTime ignores notation markup while counting pauses', () => {
  const time = estimateReadingTime(SAMPLE_SCRIPT, 120);
  assert.ok(time > 0);
  assert.ok(time < 60);
});

test('generateDeliveryRoadmapPrompt asks for roadmap structure and notation', () => {
  const prompt = generateDeliveryRoadmapPrompt({
    topic: 'leadership',
    tone: 'confident',
    targetDuration: 120,
    mode: 'generate'
  });

  assert.match(prompt, /complete script/i);
  assert.match(prompt, /## Hook/);
  assert.match(prompt, /\[PAUSE\]/);
  assert.match(prompt, /\[\[power words\]\]/);
  assert.match(prompt, /\(\(enunciation brackets\)\)/);
  assert.match(prompt, /## Finish/);
});

test('teleprompter renders the same parsed model', async () => {
  const teleprompterPath = fileURLToPath(new URL('../src/components/Teleprompter.jsx', import.meta.url));
  const { default: Teleprompter } = await loadJsxModule(teleprompterPath);

  const markup = renderToStaticMarkup(
    React.createElement(Teleprompter, {
      script: SAMPLE_SCRIPT,
      notationPreferences: {
        showSections: true,
        showPauses: true,
        showTempo: true,
        showEmphasis: true,
        showEnunciation: true,
        distractionFree: true
      }
    })
  );

  assert.match(markup, /Hook/);
  assert.match(markup, /teleprompter-pause/);
  assert.match(markup, /teleprompter-emphasis/);
  assert.match(markup, /teleprompter-enunciation/);
});

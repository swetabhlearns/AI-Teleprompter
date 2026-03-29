const SECTION_TITLES = ['Hook', 'Core Narrative', 'Call to Action', 'Finish'];
const SECTION_ALIASES = new Map([
  ['hook', 'Hook'],
  ['core narrative', 'Core Narrative'],
  ['core', 'Core Narrative'],
  ['narrative', 'Core Narrative'],
  ['call to action', 'Call to Action'],
  ['cta', 'Call to Action'],
  ['close', 'Call to Action'],
  ['finish', 'Finish'],
  ['ending', 'Finish'],
  ['outro', 'Finish'],
  ['conclusion', 'Finish']
]);

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSectionTitle(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Draft';

  const cleaned = trimmed
    .replace(/^#{1,6}\s*/, '')
    .replace(/[:-]+$/, '')
    .trim();

  const alias = SECTION_ALIASES.get(cleaned.toLowerCase());
  return alias || cleaned || 'Draft';
}

function createSection(title, index) {
  const normalizedTitle = normalizeSectionTitle(title);
  return {
    id: `section-${index}-${slugify(normalizedTitle) || 'draft'}`,
    title: normalizedTitle,
    isCanonical: SECTION_TITLES.includes(normalizedTitle),
    paragraphs: []
  };
}

function createParagraph(text, tempo, sectionId, index) {
  const parsed = parseInlineTokens(text, tempo);
  return {
    id: `paragraph-${sectionId}-${index}`,
    tempo: parsed.tempo,
    rawText: text,
    tokens: parsed.tokens
  };
}

function parseInlineTokens(text, fallbackTempo = 'normal') {
  const tokens = [];
  const pattern = /\[\[(.+?)\]\]|\(\((.+?)\)\)|\[(SLOW|FAST|NORMAL)\]|\[\/(SLOW|FAST)\]|\[(PAUSE(?:\s*[:-]?\s*([^\]]+))?)\]/gi;
  let lastIndex = 0;
  let tempo = fallbackTempo;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: text.slice(lastIndex, match.index)
      });
    }

    if (match[1]) {
      tokens.push({
        type: 'emphasis',
        value: match[1].trim()
      });
    } else if (match[2]) {
      tokens.push({
        type: 'enunciation',
        value: match[2].trim()
      });
    } else if (match[3]) {
      const nextTempo = match[3].toLowerCase();
      tempo = nextTempo === 'normal' ? 'normal' : nextTempo;
    } else if (match[4]) {
      // Closing tempo tags are stripped from the output but do not override
      // the paragraph's active tempo label.
    } else {
      const meta = (match[6] || '').trim();
      const durationMatch = meta.match(/(\d+(?:\.\d+)?)\s*s?/i);
      const duration = durationMatch ? Number(durationMatch[1]) : null;
      const label = duration
        ? `Pause ${duration}s`
        : meta
          ? `Pause ${meta}`
          : 'Pause';

      tokens.push({
        type: 'pause',
        value: label,
        duration
      });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      value: text.slice(lastIndex)
    });
  }

  return { tokens, tempo };
}

function stripSectionMarker(line) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/\s*[:-]\s*$/, '')
    .trim();
}

function isSectionHeader(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const headingMatch = trimmed.match(/^#{1,6}\s*(.+?)\s*$/);
  if (headingMatch) {
    return normalizeSectionTitle(headingMatch[1]);
  }

  const plainMatch = trimmed.match(/^(hook|core narrative|core|narrative|call to action|cta|close)\s*[:-]?\s*$/i);
  if (plainMatch) {
    return normalizeSectionTitle(plainMatch[1]);
  }

  return null;
}

function parseTempoMarker(line) {
  const trimmed = line.trim();

  const opening = trimmed.match(/^\[(SLOW|FAST|NORMAL)\](.*)$/i);
  if (opening) {
    const tempo = opening[1].toLowerCase();
    const remainder = opening[2].trim();
    const closingTag = new RegExp(`\\[\\/${tempo}\\]\\s*$`, 'i');
    const selfContained = closingTag.test(remainder);
    const content = remainder.replace(closingTag, '').trim();
    return {
      tempo: tempo === 'normal' ? 'normal' : tempo,
      content: content || null,
      toggleOnly: !content,
      selfContained
    };
  }

  const closing = trimmed.match(/^\[\/(SLOW|FAST)\]$/i);
  if (closing) {
    return {
      tempo: 'normal',
      content: null,
      toggleOnly: true,
      closing: true
    };
  }

  return null;
}

export function parseDeliveryScript(script = '') {
  const normalized = String(script || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const sections = [];

  let currentSection = null;
  let currentTempo = 'normal';
  let paragraphIndex = 0;

  const flushSection = () => {
    if (currentSection) {
      sections.push(currentSection);
    }
  };

  const ensureSection = (title) => {
    if (!currentSection) {
      currentSection = createSection(title, sections.length);
      paragraphIndex = 0;
      return;
    }

    if (currentSection.title !== title) {
      flushSection();
      currentSection = createSection(title, sections.length);
      paragraphIndex = 0;
    }
  };

  const pushParagraph = (line, tempo) => {
    if (!currentSection) {
      currentSection = createSection('Draft', 0);
    }

    const text = String(line || '').trim();
    if (!text) return;

    currentSection.paragraphs.push(createParagraph(text, tempo, currentSection.id, paragraphIndex));
    paragraphIndex += 1;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      currentTempo = 'normal';
      continue;
    }

    const sectionTitle = isSectionHeader(line);
    if (sectionTitle) {
      currentTempo = 'normal';
      ensureSection(sectionTitle);
      continue;
    }

    const tempoMarker = parseTempoMarker(line);
    if (tempoMarker) {
      if (tempoMarker.content) {
        pushParagraph(tempoMarker.content, tempoMarker.tempo);
      }
      if (tempoMarker.toggleOnly && !tempoMarker.selfContained) {
        currentTempo = tempoMarker.tempo;
      } else if (tempoMarker.selfContained || tempoMarker.closing) {
        currentTempo = 'normal';
      } else {
        currentTempo = tempoMarker.tempo;
      }
      continue;
    }

    if (!currentSection) {
      currentSection = createSection('Draft', 0);
    }

    pushParagraph(stripSectionMarker(line), currentTempo);
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  const allParagraphs = sections.flatMap((section) => section.paragraphs);
  const inlineTokens = allParagraphs.flatMap((paragraph) => paragraph.tokens);
  const plainText = allParagraphs
    .flatMap((paragraph) => paragraph.tokens)
    .map((token) => token.value)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    sections,
    paragraphs: allParagraphs,
    tokens: inlineTokens,
    plainText,
    stats: {
      sectionCount: sections.length,
      paragraphCount: allParagraphs.length,
      pauseCount: inlineTokens.filter((token) => token.type === 'pause').length,
      emphasisCount: inlineTokens.filter((token) => token.type === 'emphasis').length,
      enunciationCount: inlineTokens.filter((token) => token.type === 'enunciation').length
    }
  };
}

export function stripDeliveryNotation(script = '') {
  return parseDeliveryScript(script).plainText;
}

export function estimateDeliveryReadingTime(script, wpm = 130) {
  if (!script) return 0;

  const plainText = stripDeliveryNotation(script);
  const wordCount = plainText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const pauseCount = parseDeliveryScript(script).stats.pauseCount;

  const readingMinutes = wordCount / wpm;
  const pauseSeconds = pauseCount * 1.6;

  return Math.round(readingMinutes * 60 + pauseSeconds);
}

export function generateDeliveryRoadmapPrompt({
  topic,
  tone,
  targetDuration,
  difficulty = 'medium',
  currentScript = '',
  mode = 'generate',
  useCurrentData = false
}) {
  const durationMinutes = Math.max(1, Math.round(targetDuration / 60));
  const wordBudget = Math.round((targetDuration / 60) * (difficulty === 'easy' ? 90 : difficulty === 'hard' ? 130 : 110));

  const base = mode === 'refine'
    ? `Rewrite the current speech script into a Delivery Roadmap with acoustic notations. Preserve the original intent, but improve clarity, pacing, and rhetorical structure.`
    : `Write a new speech script as a Delivery Roadmap with acoustic notations.`;

  const scriptContext = currentScript
    ? `\nCurrent script:\n${currentScript}`
    : '';

  const currentDataLine = useCurrentData
    ? '\nIf relevant, incorporate up-to-date details from current context, but keep the script clean and speakable.'
    : '';

  return `${base}

Topic: ${topic || 'a clear, compelling speaking topic'}
Tone: ${tone || 'confident'}
Target duration: about ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}
Target length: roughly ${wordBudget} words
Difficulty: ${difficulty}

Structure:
- Let the AI create the complete script with whatever sections best improve the flow
- Prefer clear sections like ## Hook, ## Core Narrative, ## Call to Action, and ## Finish
- Keep the writing speakable, high contrast, and editorial
- Use [PAUSE] for breath points and emphasis landings
- Use [SLOW]...[/SLOW] around dense or reflective moments, and [FAST]...[/FAST] for energetic transitions
- Mark emphasis words with [[power words]]
- Mark crisp pronunciation phrases with ((enunciation brackets))
- Keep tempo tags wrapped around the exact sentence range, not floating on their own
- Keep the notation light and intentional, not crowded

Output rules:
- Return plain text only
- Keep the section headers visible in the script
- Do not explain the markup
- Do not use bullet lists unless they belong in the speech itself
- Preserve a calm, high-trust coaching voice${currentDataLine}${scriptContext}`;
}

export function generateScriptPrompt(topic, tone, targetDuration) {
  return generateDeliveryRoadmapPrompt({
    topic,
    tone,
    targetDuration,
    mode: 'generate'
  });
}

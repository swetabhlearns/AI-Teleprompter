// src/components/Teleprompter.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// src/utils/scriptNotation.js
var SECTION_TITLES = ["Hook", "Core Narrative", "Call to Action", "Finish"];
var SECTION_ALIASES = /* @__PURE__ */ new Map([
  ["hook", "Hook"],
  ["core narrative", "Core Narrative"],
  ["core", "Core Narrative"],
  ["narrative", "Core Narrative"],
  ["call to action", "Call to Action"],
  ["cta", "Call to Action"],
  ["close", "Call to Action"],
  ["finish", "Finish"],
  ["ending", "Finish"],
  ["outro", "Finish"],
  ["conclusion", "Finish"]
]);
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizeSectionTitle(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Draft";
  const cleaned = trimmed.replace(/^#{1,6}\s*/, "").replace(/[:-]+$/, "").trim();
  const alias = SECTION_ALIASES.get(cleaned.toLowerCase());
  return alias || cleaned || "Draft";
}
function createSection(title, index) {
  const normalizedTitle = normalizeSectionTitle(title);
  return {
    id: `section-${index}-${slugify(normalizedTitle) || "draft"}`,
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
function parseInlineTokens(text, fallbackTempo = "normal") {
  const tokens = [];
  const pattern = /\[\[(.+?)\]\]|\(\((.+?)\)\)|\[(SLOW|FAST|NORMAL)\]|\[\/(SLOW|FAST)\]|\[(PAUSE(?:\s*[:-]?\s*([^\]]+))?)\]/gi;
  let lastIndex = 0;
  let tempo = fallbackTempo;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: text.slice(lastIndex, match.index)
      });
    }
    if (match[1]) {
      tokens.push({
        type: "emphasis",
        value: match[1].trim()
      });
    } else if (match[2]) {
      tokens.push({
        type: "enunciation",
        value: match[2].trim()
      });
    } else if (match[3]) {
      const nextTempo = match[3].toLowerCase();
      tempo = nextTempo === "normal" ? "normal" : nextTempo;
    } else if (match[4]) {
    } else {
      const meta = (match[6] || "").trim();
      const durationMatch = meta.match(/(\d+(?:\.\d+)?)\s*s?/i);
      const duration = durationMatch ? Number(durationMatch[1]) : null;
      const label = duration ? `Pause ${duration}s` : meta ? `Pause ${meta}` : "Pause";
      tokens.push({
        type: "pause",
        value: label,
        duration
      });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      value: text.slice(lastIndex)
    });
  }
  return { tokens, tempo };
}
function stripSectionMarker(line) {
  return line.replace(/^#{1,6}\s*/, "").replace(/\s*[:-]\s*$/, "").trim();
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
    return {
      tempo: tempo === "normal" ? "normal" : tempo,
      content: remainder || null,
      toggleOnly: !remainder
    };
  }
  const closing = trimmed.match(/^\[\/(SLOW|FAST)\]$/i);
  if (closing) {
    return {
      tempo: "normal",
      content: null,
      toggleOnly: true,
      closing: true
    };
  }
  return null;
}
function parseDeliveryScript(script = "") {
  const normalized = String(script || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const sections = [];
  let currentSection = null;
  let currentTempo = "normal";
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
      currentSection = createSection("Draft", 0);
    }
    const text = String(line || "").trim();
    if (!text) return;
    currentSection.paragraphs.push(createParagraph(text, tempo, currentSection.id, paragraphIndex));
    paragraphIndex += 1;
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      currentTempo = "normal";
      continue;
    }
    const sectionTitle = isSectionHeader(line);
    if (sectionTitle) {
      currentTempo = "normal";
      ensureSection(sectionTitle);
      continue;
    }
    const tempoMarker = parseTempoMarker(line);
    if (tempoMarker) {
      currentTempo = tempoMarker.tempo;
      if (tempoMarker.content) {
        pushParagraph(tempoMarker.content, tempoMarker.tempo);
      }
      if (tempoMarker.closing) {
        currentTempo = "normal";
      }
      continue;
    }
    if (!currentSection) {
      currentSection = createSection("Draft", 0);
    }
    pushParagraph(stripSectionMarker(line), currentTempo);
  }
  if (currentSection) {
    sections.push(currentSection);
  }
  const allParagraphs = sections.flatMap((section) => section.paragraphs);
  const inlineTokens = allParagraphs.flatMap((paragraph) => paragraph.tokens);
  const plainText = allParagraphs.flatMap((paragraph) => paragraph.tokens).map((token) => token.value).join(" ").replace(/\s+/g, " ").trim();
  return {
    sections,
    paragraphs: allParagraphs,
    tokens: inlineTokens,
    plainText,
    stats: {
      sectionCount: sections.length,
      paragraphCount: allParagraphs.length,
      pauseCount: inlineTokens.filter((token) => token.type === "pause").length,
      emphasisCount: inlineTokens.filter((token) => token.type === "emphasis").length,
      enunciationCount: inlineTokens.filter((token) => token.type === "enunciation").length
    }
  };
}

// src/components/Teleprompter.jsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_NOTATION_PREFERENCES = {
  showSections: true,
  showPauses: true,
  showTempo: true,
  showEmphasis: true,
  showEnunciation: true,
  distractionFree: false
};
function Token({ token, notationPreferences }) {
  if (token.type === "pause") {
    if (!notationPreferences.showPauses) {
      return null;
    }
    return /* @__PURE__ */ jsx("span", { className: "teleprompter-pause", children: token.value });
  }
  if (token.type === "emphasis") {
    return /* @__PURE__ */ jsx("span", { className: notationPreferences.showEmphasis ? "teleprompter-emphasis" : "", children: token.value });
  }
  if (token.type === "enunciation") {
    return /* @__PURE__ */ jsx("span", { className: notationPreferences.showEnunciation ? "teleprompter-enunciation" : "", children: token.value });
  }
  return /* @__PURE__ */ jsx("span", { children: token.value });
}
function SectionBlock({ section, notationPreferences }) {
  return /* @__PURE__ */ jsxs("section", { className: "teleprompter-section", children: [
    notationPreferences.showSections && section.title !== "Draft" && /* @__PURE__ */ jsxs("div", { className: "teleprompter-section-label", children: [
      /* @__PURE__ */ jsx("span", { children: String(section.index).padStart(2, "0") }),
      /* @__PURE__ */ jsx("h3", { children: section.title })
    ] }),
    section.paragraphs.map((paragraph) => /* @__PURE__ */ jsxs(
      "p",
      {
        className: [
          "teleprompter-paragraph",
          notationPreferences.showTempo && paragraph.tempo !== "normal" ? `tempo-${paragraph.tempo}` : ""
        ].filter(Boolean).join(" "),
        children: [
          notationPreferences.showTempo && paragraph.tempo !== "normal" && /* @__PURE__ */ jsx("span", { className: `teleprompter-tempo-badge tempo-${paragraph.tempo}`, children: paragraph.tempo === "slow" ? "Slow down" : "Speed up" }),
          paragraph.tokens.map((token, index) => /* @__PURE__ */ jsx(
            Token,
            {
              token,
              notationPreferences
            },
            `${paragraph.id}-${index}`
          ))
        ]
      },
      paragraph.id
    ))
  ] });
}
function Teleprompter({
  script = "",
  isActive = false,
  isSpeaking = false,
  audioLevel = 0,
  onSpeedChange,
  initialSpeed = 20,
  notationPreferences = DEFAULT_NOTATION_PREFERENCES
}) {
  const [baseSpeed, setBaseSpeed] = useState(initialSpeed);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const contentRef = useRef(null);
  const scrollPosRef = useRef(0);
  const animationRef = useRef(null);
  const speedRef = useRef(initialSpeed);
  const resolvedPreferences = notationPreferences || DEFAULT_NOTATION_PREFERENCES;
  const parsedScript = useMemo(() => parseDeliveryScript(script), [script]);
  const handleSpeedUp = useCallback(() => {
    setBaseSpeed((prev) => Math.min(100, prev + 10));
  }, []);
  const handleSpeedDown = useCallback(() => {
    setBaseSpeed((prev) => Math.max(10, prev - 10));
  }, []);
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);
  const handleReset = useCallback(() => {
    scrollPosRef.current = 0;
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, []);
  useEffect(() => {
    speedRef.current = baseSpeed;
    if (onSpeedChange) {
      onSpeedChange(baseSpeed);
    }
  }, [baseSpeed, onSpeedChange]);
  useEffect(() => {
    if (!isActive) return void 0;
    const handleKeyDown = (event) => {
      if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          handleSpeedUp();
          break;
        case "ArrowDown":
          event.preventDefault();
          handleSpeedDown();
          break;
        case " ":
          event.preventDefault();
          handleTogglePause();
          break;
        case "r":
        case "R":
          event.preventDefault();
          handleReset();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleReset, handleSpeedDown, handleSpeedUp, handleTogglePause, isActive]);
  useEffect(() => {
    if (!isActive) {
      const resetTimer = window.setTimeout(() => {
        setCountdown(0);
        setIsScrolling(false);
        setIsPaused(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    if (isScrolling || countdown !== 0) {
      return void 0;
    }
    const startTimer = window.setTimeout(() => {
      setCountdown(5);
    }, 0);
    return () => window.clearTimeout(startTimer);
  }, [countdown, isActive, isScrolling]);
  useEffect(() => {
    if (countdown > 0) {
      const timer = window.setTimeout(() => {
        if (countdown === 1) {
          setCountdown(0);
          setIsScrolling(true);
        } else {
          setCountdown(countdown - 1);
        }
      }, 1e3);
      return () => window.clearTimeout(timer);
    }
    return void 0;
  }, [countdown]);
  useEffect(() => {
    if (!isActive || !isScrolling) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return void 0;
    }
    let lastTime = performance.now();
    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      if (!isPaused && contentRef.current) {
        const pixelsPerSecond = speedRef.current / 100 * 200;
        const scrollDelta = pixelsPerSecond * deltaTime / 1e3;
        scrollPosRef.current += scrollDelta;
        const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
        if (scrollPosRef.current >= maxScroll && maxScroll > 0) {
          scrollPosRef.current = maxScroll;
          contentRef.current.scrollTop = maxScroll;
          setIsPaused(true);
          return;
        }
        scrollPosRef.current = Math.min(scrollPosRef.current, Math.max(0, maxScroll));
        contentRef.current.scrollTop = scrollPosRef.current;
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, isPaused, isScrolling]);
  useEffect(() => {
    scrollPosRef.current = 0;
    const resetTimer = window.setTimeout(() => {
      setIsPaused(false);
      setIsScrolling(false);
      setCountdown(0);
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [script]);
  if (!script) {
    return /* @__PURE__ */ jsx("div", { className: "teleprompter-overlay", children: /* @__PURE__ */ jsxs("div", { className: "teleprompter-empty", children: [
      /* @__PURE__ */ jsx("p", { children: "No script loaded" }),
      /* @__PURE__ */ jsx("span", { children: "Open the script workspace to draft your delivery roadmap." })
    ] }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "teleprompter-overlay", children: [
    countdown > 0 && /* @__PURE__ */ jsxs("div", { className: "teleprompter-countdown", children: [
      /* @__PURE__ */ jsx("div", { className: "teleprompter-countdown-label", children: "Get ready" }),
      /* @__PURE__ */ jsx("div", { className: "teleprompter-countdown-number", children: countdown }),
      /* @__PURE__ */ jsxs("div", { className: "teleprompter-countdown-subtitle", children: [
        "Starting in ",
        countdown,
        " second",
        countdown !== 1 ? "s" : ""
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        ref: contentRef,
        className: "teleprompter-text",
        style: {
          height: "100%",
          overflow: "hidden",
          paddingTop: "44vh",
          paddingBottom: "42vh"
        },
        children: parsedScript.sections.length === 0 ? /* @__PURE__ */ jsx("p", { className: "teleprompter-paragraph", children: "Add a section header to shape the flow." }) : parsedScript.sections.map((section, index) => /* @__PURE__ */ jsx(
          SectionBlock,
          {
            section: { ...section, index: index + 1 },
            notationPreferences: resolvedPreferences
          },
          section.id
        ))
      }
    ),
    !resolvedPreferences.distractionFree && /* @__PURE__ */ jsxs(Fragment, { children: [
      isActive && /* @__PURE__ */ jsxs("div", { className: "teleprompter-controls", children: [
        /* @__PURE__ */ jsx("span", { className: "teleprompter-speed-label", children: "Speed" }),
        /* @__PURE__ */ jsx("button", { onClick: handleSpeedDown, className: "teleprompter-control-button", type: "button", children: "\u2212" }),
        /* @__PURE__ */ jsxs("div", { className: "teleprompter-speed-meter", children: [
          /* @__PURE__ */ jsx("div", { className: "teleprompter-speed-track", children: /* @__PURE__ */ jsx(
            "div",
            {
              className: "teleprompter-speed-fill",
              style: { width: `${baseSpeed}%` }
            }
          ) }),
          /* @__PURE__ */ jsxs("span", { children: [
            baseSpeed,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: handleSpeedUp, className: "teleprompter-control-button", type: "button", children: "+" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleTogglePause,
            className: `teleprompter-pause-button ${isPaused ? "paused" : "running"}`,
            type: "button",
            children: isPaused ? "\u25B6" : "\u23F8"
          }
        ),
        /* @__PURE__ */ jsx("button", { onClick: handleReset, className: "teleprompter-control-button", type: "button", children: "\u21BA" })
      ] }),
      isActive && /* @__PURE__ */ jsx("div", { className: "teleprompter-hints", children: "\u2191\u2193 Speed \u2022 Space Pause \u2022 R Reset" })
    ] }),
    isActive && /* @__PURE__ */ jsx("div", { className: "teleprompter-live-indicator", children: /* @__PURE__ */ jsx("span", { className: isSpeaking ? "speaking" : "silent", children: isSpeaking ? "Speaking" : `Tracking ${Math.min(audioLevel * 2, 100)}%` }) })
  ] });
}
var Teleprompter_default = Teleprompter;
export {
  Teleprompter,
  Teleprompter_default as default
};

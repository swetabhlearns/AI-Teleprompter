# 9 Habits for Clearer Speaking

> **Source**: [YouTube - Vin's Communication Coaching](http://youtube.com/watch?v=PiNN-HmHu7A)  
> **Purpose**: Reference document for building AITracker features around communication improvement

---

## Overview

These 9 habits are organized into **three groups**:
1. **Delivery Habits** (How you say it)
2. **Vocal Habits** (Your voice mechanics)
3. **Cognitive Habits** (How you structure thoughts)

---

## 🎯 Group 1: Delivery Habits

### Habit 1: Pause More

**The Problem:**
- People speak without breaks, causing ideas to blur together
- Continuous speech becomes "mumbo jumbo" — nothing sticks

**The Solution:**
- Use strategic pauses between thoughts
- Create "white space" in your speech (like paragraphs in writing)

**Key Insight:**
> People who pause MORE are perceived as MORE confident, not less.

**What to Measure/Detect:**
- Frequency of pauses
- Duration of pauses
- Pause-to-speech ratio
- Sentences without pauses (flag these)

---

### Habit 2: Slow Down to Highlight

**The Problem:**
- Speaking at one fast speed/tempo all the time
- Nothing stands out — like highlighting an entire page

**The Solution:**
- Vary your speaking speed
- Slow down when making important points
- Combine slow speech + pause for maximum impact

**Key Insight:**
> Speaking fast all the time reduces and dilutes impact.

**What to Measure/Detect:**
- Speaking rate variability (words per minute over time)
- Consistent fast speech patterns
- Speed changes around key phrases
- Lack of tempo variation

---

### Habit 3: Use Declarative Statements

**The Problem:**
- Rambling: mouth moves faster than thoughts
- Using filler words: "um", "uh", "you know", "like", "kind of", "maybe"
- Vague, hesitant language makes you sound unsure

**The Solution:**
- Use short, concise, to-the-point sentences
- End with a full stop (declarative statement)
- Think before speaking

**Bad Example:**
> "So, I was thinking maybe we could, you know, potentially look at the other ideas that we had, you know, the ideas when like um we're going to like post on social media, you know, like more often."

**Good Example:**
> "Timing and consistency with our social media content will directly impact engagement."

**What to Measure/Detect:**
- Filler word frequency ("um", "uh", "like", "you know", "kind of", "sort of", "maybe")
- Sentence completion rate
- Average sentence length
- Hedging language ("I think maybe", "potentially", "possibly")

---

## 🎤 Group 2: Vocal Habits

### Habit 4: Warm Up Your Voice

**The Problem:**
- Going from cold to full exertion strains the voice
- Results in: sore throat, fatigue after presentations, weak voice

**The Solution:**
- Lip trills before speaking engagements:
  1. One note for 1 full minute
  2. Lip trill your favorite song
  3. Short bursts of lip trills for 1 minute

**Benefits:**
- Clearer voice
- Stronger projection
- Less vocal fatigue

**Feature Opportunity:**
- Pre-session vocal warm-up guide
- Reminder to warm up before practice sessions

---

### Habit 5: Default to Nose Breathing

**The Problem:**
- Mouth breathing dries out throat and vocal cords
- Leads to shallow breathing and fatigue

**The Solution:**
- Train yourself to breathe through your nose by default
- We take 20,000+ breaths per day — this compounds!

**Benefits of Nose Breathing:**
1. Humidifies the air
2. Keeps throat & vocal cords hydrated
3. Improves oxygen efficiency by 20%
4. Activates parasympathetic nervous system (relaxation)
5. Filters out pollutants

**Feature Opportunity:**
- Breathing pattern detection during recording
- Reminder about nose breathing between sessions

---

### Habit 6: Use More Volume

**The Problem:**
- Speaking too softly/quietly
- Low volume = low perceived confidence
- "When your voice is small, they assume your ideas are small too"

**The Solution:**
- Speak with presence and vitality
- Use volume that fills the space
- Not shouting — projecting with energy

**Key Insight:**
> "People don't just hear what you're saying — they feel it. Volume isn't just about being heard. It's about being felt."

**What to Measure/Detect:**
- Average volume level
- Volume consistency
- Volume drops (trailing off at end of sentences)
- Volume variation for emphasis

---

## 🧠 Group 3: Cognitive Habits

### Habit 7: Finish One Thought at a Time

**The Problem:**
- Starting new thoughts before finishing current ones
- Listeners have to mentally "chase" you (most won't — they zone out)
- Brain multitasking mid-sentence creates fragmented speech

**The Solution:**
- Start a thought → Finish it → Pause → Move to next idea
- Complete your sentences before starting new ones

**Bad Example:**
> "So, I think we should run the marketing campaign next week. Oh, and did you see what the team said about the conversion rates? And actually, did you watch the football game last night?"

**Good Example:**
> "Listen team, we should launch the campaign next week. Let's make sure the whole team is aligned on that as a goal. Everyone also raised a good point about the landing page. Let's put in a plan for conversion rate optimization."

**What to Measure/Detect:**
- Sentence completion rate
- Topic switches mid-sentence
- Interrupted thought patterns
- Tangent detection

---

### Habit 8: Learn to Use Frameworks

**The Problem:**
- Structureless explanations
- Over-explaining
- Losing people in rambling details

**The Solution: CCC Framework**

| Step | Description | Goal |
|------|-------------|------|
| **Context** | Set the scene | Give the WHY before the WHAT |
| **Core** | Main idea | ONE clear, simple point |
| **Connect** | Relevance | Show why it matters to THEM |

**Example:**
> **Context**: "Hey boss, as you know, we're about to release the new online course and the timing is tight."
> 
> **Core**: "We're going to need extra editors to meet the deadline."
> 
> **Connect**: "This will allow us to finish on time without burning the team out, while protecting the brand."

**Feature Opportunity:**
- Framework templates for different scenarios
- Detection of structured vs unstructured responses
- Suggestions to restructure answers using CCC

---

### Habit 9: Use Analogies

**The Problem:**
- Explaining complex ideas with complex language
- When someone doesn't understand, repeating the same thing slower

**The Solution:**
- Use analogies to connect unknown concepts to known ones
- Make abstract ideas concrete and visual

**Example - Explaining Compounding Interest:**

❌ **Bad**: "Compounding interest is the exponential growth where the interest starts to accrue not only on the principal but also on the previously accumulated interest."

✅ **Good**: "Compounding interest is like rolling a snowball downhill. At first, it's really small, but as it rolls, it picks up more snow. The bigger it gets, the faster it grows. The earlier you start rolling (investing), the bigger your snowball becomes."

**Why Analogies Work:**
1. Make your message stick (memorable)
2. Make complex ideas simple
3. Make you relatable and memorable

**What to Measure/Detect:**
- Use of metaphorical language
- Concrete vs abstract word usage
- Comparison phrases ("like", "similar to", "imagine")

---

## 💎 Inspirational Quote

> "People will forget what you've said. People will forget what you did, but people will never forget how you made them feel."
> — **Maya Angelou**

---

## Feature Implementation Ideas

### High Priority (Core Detection Features)

| Feature | Related Habits | Implementation |
|---------|---------------|----------------|
| **Filler Word Detection** | Habit 3 | Count "um", "uh", "like", "you know", etc. |
| **Pause Analysis** | Habit 1, 7 | Detect silence gaps, measure duration |
| **Speaking Rate** | Habit 2 | Words per minute, variation over time |
| **Volume Analysis** | Habit 6 | Average dB, trailing off detection |

### Medium Priority (Structure Analysis)

| Feature | Related Habits | Implementation |
|---------|---------------|----------------|
| **Sentence Completion** | Habit 3, 7 | NLP analysis for complete thoughts |
| **Rambling Detection** | Habit 3, 7, 8 | Long sentences without structure |
| **Framework Check** | Habit 8 | Does response have Context/Core/Connect? |

### Nice to Have (Advanced Features)

| Feature | Related Habits | Implementation |
|---------|---------------|----------------|
| **Speed Variation Scoring** | Habit 2 | Reward tempo changes at key moments |
| **Analogy Detection** | Habit 9 | Detect metaphorical/comparative language |
| **Warm-up Reminders** | Habit 4 | Pre-session prompts |
| **Breathing Guidance** | Habit 5 | Tips between sessions |

---

## Quick Reference Cheatsheet

| # | Habit | One-Liner | Detectable? |
|---|-------|-----------|-------------|
| 1 | Pause More | White space = clarity | ✅ Yes |
| 2 | Slow Down to Highlight | Speed changes = emphasis | ✅ Yes |
| 3 | Declarative Statements | Short sentences + full stops | ✅ Yes |
| 4 | Warm Up Voice | Lip trills before speaking | ❌ Guidance only |
| 5 | Nose Breathing | Protect your voice 24/7 | ❌ Guidance only |
| 6 | More Volume | Energy transfer, not shouting | ✅ Yes |
| 7 | Finish Thoughts | One idea → pause → next | ✅ Yes |
| 8 | Use Frameworks | CCC: Context, Core, Connect | ⚠️ Partial |
| 9 | Use Analogies | Unknown → Known | ⚠️ Partial |

---

## Summary

The core message is: **Great communication isn't about what you say — it's about HOW you say it and HOW you structure it.**

Key takeaways for feature development:
1. **Pauses are powerful** — detect and encourage them
2. **Filler words kill confidence** — track and reduce them
3. **Speed variation matters** — reward dynamic delivery
4. **Volume = energy** — encourage projection
5. **Structure beats content** — help users organize thoughts

<use_interesting_fonts>
Typography instantly signals quality. Avoid using boring, generic fonts.

Never use: Inter, Roboto, Open Sans, Lato, default system fonts

Here are some examples of good, impactful choices:
- Code aesthetic: JetBrains Mono, Fira Code, Space Grotesk
- Editorial: Playfair Display, Crimson Pro
- Technical: IBM Plex family, Source Sans 3
- Distinctive: Bricolage Grotesque, Newsreader

Pairing principle: High contrast = interesting. Display + monospace, serif + geometric sans, variable font across weights.

Use extremes: 100/200 weight vs 800/900, not 400 vs 600. Size jumps of 3x+, not 1.5x.

Pick one distinctive font, use it decisively. Load from Google Fonts.
</use_interesting_fonts>

<design_consistency>
The product should feel like one system across all routes, not a collection of unrelated screens.

Design decisions must stay consistent in these areas:
- Typography: use one display voice, one body voice, one mono voice, and reuse them everywhere.
- Color: define a small token set and avoid introducing new one-off colors per screen.
- Shape: keep one radius family and one border treatment across cards, buttons, inputs, chips, and panels.
- Elevation: use the same shadow logic everywhere, or none at all. Do not mix flat and glossy styles randomly.
- Spacing: use a single spacing rhythm. If a screen feels denser, change hierarchy, not random padding values.
- Copy tone: keep labels, helper text, and empty states in the same voice.
- Interaction patterns: primary actions, secondary actions, toggles, and status indicators should look and behave the same across the app.

Each screen may have its own emphasis, but it should still read as part of the same brand system.
</design_consistency>

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design,this creates what users call the "AI slop" aesthetic. Avoid this: make creative,distinctive frontends that surprise and delight. 

Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

When choosing a direction, commit to one of these patterns and apply it consistently:
- Minimal editorial: quiet surfaces, strong type contrast, restrained motion.
- Playful tactile: hand-drawn accents, warmer surfaces, visible gestures, but still disciplined.
- Technical control room: clear panels, precise spacing, strong hierarchy, functional feedback.

Do not mix multiple directions on the same screen unless one is clearly dominant and the others are supporting accents.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Avoid screen-by-screen improvisation. If a component pattern exists once, reuse it with the same proportions, type scale, and interaction states everywhere it appears.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>

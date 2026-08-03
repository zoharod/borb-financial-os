---
name: Aura Finance
colors:
  surface: '#081425'
  surface-dim: '#081425'
  surface-bright: '#2f3a4c'
  surface-container-lowest: '#040e1f'
  surface-container-low: '#111c2d'
  surface-container: '#152031'
  surface-container-high: '#1f2a3c'
  surface-container-highest: '#2a3548'
  on-surface: '#d8e3fb'
  on-surface-variant: '#c6c6ca'
  inverse-surface: '#d8e3fb'
  inverse-on-surface: '#263143'
  outline: '#8f9094'
  outline-variant: '#45474a'
  surface-tint: '#c6c6ca'
  primary: '#c6c6ca'
  on-primary: '#2f3034'
  primary-container: '#121417'
  on-primary-container: '#7d7e82'
  inverse-primary: '#5d5e62'
  secondary: '#44e2cd'
  on-secondary: '#003731'
  secondary-container: '#03c6b2'
  on-secondary-container: '#004d44'
  tertiary: '#b9c8de'
  on-tertiary: '#233143'
  tertiary-container: '#051525'
  on-tertiary-container: '#718094'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e6'
  primary-fixed-dim: '#c6c6ca'
  on-primary-fixed: '#1a1c1f'
  on-primary-fixed-variant: '#45474a'
  secondary-fixed: '#62fae3'
  secondary-fixed-dim: '#3cddc7'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#d4e4fa'
  tertiary-fixed-dim: '#b9c8de'
  on-tertiary-fixed: '#0d1c2d'
  on-tertiary-fixed-variant: '#39485a'
  background: '#081425'
  on-background: '#d8e3fb'
  surface-variant: '#2a3548'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  data-display:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: -0.03em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-mobile: 20px
  container-padding-desktop: 40px
  gutter: 24px
  section-gap: 64px
---

## Brand & Style

The design system is anchored in a philosophy of **calm intelligence**. It aims to transform the often-anxious experience of financial management into a meditative, effortless interaction. The target audience is the discerning professional who values precision, privacy, and proactive insights over gamified clutter.

The visual style is a fusion of **Modern Corporate** reliability and **Glassmorphism**. It utilizes soft, translucent layers and expansive whitespace to create a sense of breathing room. The aesthetic response should feel like a high-end physical lounge: quiet, curated, and inherently premium. All transitions should be fluid and decelerated to reinforce the predictive, effortless nature of the brand.

## Colors

The palette is built on a "Deep Charcoal" base (`#121417`) to provide a grounded, high-contrast environment that reduces eye strain and implies exclusivity.

- **Primary (Deep Charcoal):** Used for the global canvas and primary surfaces.
- **Secondary (Growth Green):** A custom success green (`#2DD4BF`) that leans toward teal. It represents vitality and upward trends rather than a harsh "correct/incorrect" signal.
- **Neutral (Slate Grays):** A range of soft slates (`#1E293B`, `#94A3B8`) used for secondary containers, borders, and subtle text hierarchies.

Avoid pure blacks or vibrant neons. Every color must feel desaturated and sophisticated, maintaining a "matte" finish even when used in gradients.

## Typography

The typography system uses **Inter** for its systematic clarity and neutral character. To emphasize the "intelligent" aspect of the brand, **JetBrains Mono** is introduced for small labels and data points, providing a precise, technical counterpoint to the sans-serif body text.

- **Weight as Hierarchy:** Use Semibold (`600`) for primary numbers and headlines. Use Regular (`400`) for all explanatory text to maintain a lightweight, airy feel.
- **Tight Tracking:** Larger headlines should use negative letter spacing (`-0.02em`) to feel "locked" and authoritative.
- **Data Clarity:** Financial figures should always use tabular numbers (tnum) to ensure vertical alignment in lists and tables.

## Layout & Spacing

The layout philosophy follows a **fixed-fluid hybrid**. Content is centered in a max-width container (1280px) on desktop to maintain focus, while margins expand fluidly.

- **The 8px Rhythm:** All spacing (padding, margins, gaps) must be multiples of 8px.
- **Generous Gaps:** Large sections should be separated by a minimum of 64px to enforce the "calm" brand pillar.
- **Predictive Grouping:** Use tighter spacing (8px or 12px) for related data points and larger spacing (24px) between distinct functional cards.
- **Safe Zones:** Ensure all interactive elements have a minimum 44px hit target, even if the visual asset is smaller.

## Elevation & Depth

Depth in the design system is communicated through **Glassmorphism and Tonal Layering** rather than traditional drop shadows.

- **The Base:** The lowest level is the Deep Charcoal background.
- **Surface Layer:** Secondary containers use a slightly lighter slate (`#1E293B`) with a subtle 1px inner stroke (top-down) to simulate a beveled edge.
- **Floating Overlays:** Use a "Frosted Glass" effect for navigation bars and modals. This is achieved with a 20px backdrop blur and 60% opacity on a neutral-800 fill.
- **Inner Shadows:** For "sunken" elements like input fields or progress bar tracks, use a subtle inner shadow (`0px 2px 4px rgba(0,0,0,0.3)`) to create a tactile, carved-out look.

## Shapes

The shape language is defined by **hyper-rounded corners** that evoke a sense of safety and premium industrial design (reminiscent of high-end hardware).

- **Primary Radius:** All main cards and containers must use a 24px (`1.5rem`) radius.
- **Nested Elements:** Elements inside a 24px container should use a 12px or 16px radius to maintain visual concentricity.
- **Buttons:** Buttons should be fully pill-shaped to stand out against the structured card grid.
- **Strokes:** Use ultra-thin (1px) borders with 10-15% opacity to define edges without adding visual weight.

## Components

### Buttons
- **Primary:** Pill-shaped, Growth Green background, Deep Charcoal text. No shadow, just a subtle glow on hover.
- **Secondary:** Transparent with a 1px Slate border.
- **Tertiary:** Text-only with "JetBrains Mono" in all caps for a technical, low-emphasis action.

### Cards
- **Structure:** 24px corner radius, 32px internal padding.
- **Style:** Background blur (if over a gradient) or a solid Slate-900 fill. Use an inner 1px border (`rgba(255,255,255,0.05)`) to catch the light.

### Input Fields
- **Style:** "Sunken" appearance using an inner shadow. Background is 5% darker than the card surface.
- **Focus State:** A soft 2px outer glow in Growth Green with 30% opacity. No abrupt border color changes.

### Data Visualization
- **Line Charts:** Use smooth bezier curves. The area under the line should feature a soft gradient of Growth Green fading to transparent.
- **Chips:** Small, pill-shaped indicators with high-contrast JetBrains Mono text. Use for status (e.g., "STABLE", "PENDING").

### Interactive Overlays
- **Modals:** Centered, 24px radius, heavy backdrop blur (min 20px). The backdrop should slightly desaturate the content behind it to pull the modal forward.

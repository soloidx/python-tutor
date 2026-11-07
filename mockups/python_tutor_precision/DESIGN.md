---
name: Python Tutor Precision
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#5c403c'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#916f6b'
  outline-variant: '#e6bdb8'
  surface-tint: '#bf0715'
  primary: '#b70011'
  on-primary: '#ffffff'
  primary-container: '#dc2626'
  on-primary-container: '#fff6f5'
  inverse-primary: '#ffb4ab'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#005e8d'
  on-tertiary: '#ffffff'
  tertiary-container: '#0078b2'
  on-tertiary-container: '#f3f8ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000b'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#cbe6ff'
  tertiary-fixed-dim: '#90cdff'
  on-tertiary-fixed: '#001e30'
  on-tertiary-fixed-variant: '#004b71'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets aspiring programmers, students, and engineers seeking high-efficiency AI-assisted Python tutoring. The brand personality is disciplined, sharp, intellectually clear, and developer-centric. It removes visual friction to foster sustained deep work, precision in code comprehension, and immediate feedback loops.

The design movement is **Technical Minimalism**: crisp white surfaces, calibrated cool grays, micro-borders, and a decisive, vibrant crimson accent derived from the classic dynamic energy of execution errors, debugging tools, and focused breakpoints. Tactile distraction is eliminated in favor of razor-sharp typographic hierarchy, high-density clarity, and effortless architectural rhythm.

## Colors

The palette leverages high-contrast readability and surgical visual accents:

- **Canvas & Surface Tier**:
  - Pure Canvas: `#FFFFFF` (code editors, active cards, focal modals).
  - Subtle Underlay: `#F8FAFC` (workspace backgrounds, secondary panels, neutral bars).
  - Elevated Container: `#FFFFFF` with precise 1px stroke `#E2E8F0` or `#E5E7EB`.
- **Brand Accent (Crimson Focus)**:
  - Primary Accent: `#DC2626` (run action, critical highlights, selected indicators, brand markers).
  - Primary Active/Dark: `#B91C1C`.
  - Accent Soft Tints: `#FFF1F2` (hover fills, badge backgrounds), `#FEE2E2` (active selection fills, subtle outlines).
- **Text & Neutral Scale**:
  - Ink Base: `#111827` (primary headings, code text, high-emphasis UI).
  - Slate Muted: `#64748B` (labels, secondary meta info, placeholders, shortcuts).
  - Border Subtle: `#E5E7EB` (neutral dividers, inputs, structural card borders).
  - Border Subdued: `#F1F5F9` (table rows, inactive states).
- **Status Accents**:
  - Success: `#059669` (connection verified, code tests passed).
  - Warning: `#D97706` (latency warnings, partial keys).
  - Error: `#DC2626` (connection failed, execution traceback).

## Typography

The typography system pairs **Inter** for all UI dialogue, headings, and instructional passages with **JetBrains Mono** for code variables, badges, runtime labels, API endpoints, and status metrics.

- Headlines utilize negative letter spacing to project an engineered, tight visual footprint.
- Monospace tokens (`label-md`, `label-sm`) are strictly enforced for API keys, token counters, key-value indicators, and the connection status terminal readouts.
- When rendering inline code blocks inside tutor chat responses, preserve a 13px base size with `#111827` color over `#F1F5F9` background chips.

## Layout & Spacing

The layout adopts a high-utility fluid dual-pane or tri-pane workspace anchored by a persistent narrow sidebar:

- **Sidebar Anchor**: Fixed width of `260px` on desktop (collapsible to `64px` icon dock on narrower screens).
- **Workspace Canvas**: Fluid-width split-screen pairing the code runner/lesson pane with the conversational AI tutor panel.
- **Modal Dialogs**: Max-width of `640px` for configurations and model settings, centered horizontally and vertically with a `24px` gutter buffer on mobile viewports.
- **Rhythm & Grid**: Elements align to an 8pt architectural rhythm, utilizing `space-xs` (4px) and `space-sm` (8px) for compact control groups and `space-lg` (24px) for section cards.

## Elevation & Depth

Visual hierarchy is constructed through **tonal borders combined with diffused, low-opacity ambient shadows**:

- **Tier 0 (Base)**: `#F8FAFC` flat canvas without shadow.
- **Tier 1 (Surface Cards & Sidebar)**: `#FFFFFF` surface enclosed by a clean `1px solid #E5E7EB` border. Ambient shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)`.
- **Tier 2 (Modals & Popovers)**: `#FFFFFF` floating container with `1px solid #E2E8F0` border and deep ambient blur: `0 20px 25px -5px rgba(17, 24, 39, 0.06), 0 8px 10px -6px rgba(17, 24, 39, 0.04)`.
- **Backdrop Veil**: Semi-transparent neutral wash `rgba(17, 24, 39, 0.35)` with an ultra-light backdrop blur (`backdrop-filter: blur(4px)`) to focus user attention on configuration tasks without disorienting context.

## Shapes

The geometric identity balances modern softness with structured interface discipline:

- **Interactive Nodes (Buttons, Inputs, Selectors)**: Fixed rounded corners at `12px` (`0.75rem`), ensuring comfort during prolonged usage.
- **Modal Sheets, Drawers & Large Cards**: Standardized at `16px` (`1rem`) corner radius.
- **Tags, Status Pills, and Badges**: Fully rounded (`9999px` pill-shaped) to distinguish categorical metadata from functional click triggers.

## Components

### Left Minimalist Sidebar
- **Layout**: Clean vertical rail with logo at top, navigation items centered, and settings pinned at the bottom.
- **Items**: 12px rounded items, padding `8px 12px`, text `body-md` in `#64748B`.
- **Active / Focused Item**: Background `#FFF1F2`, text `#DC2626`, font weight 600, with a subtle 3px left border accent in `#DC2626`.
- **Hover Item**: Background `#F8FAFC`, text `#111827`.

### Settings Modal & Cards
- **Container**: Elevated `#FFFFFF` surface with `16px` border-radius, `1px solid #E5E7EB`, and `space-xl` padding.
- **Navigation / Provider Tabs**: Horizontal segmented control pills. Inactive tabs use `#F8FAFC` with `#64748B` label. Active tab takes `#FFFFFF` with `1px solid #E5E7EB`, `#111827` bold text, and a crisp micro-shadow.
- **Form Controls & Inputs**:
  - Border: `1px solid #E5E7EB`, background `#FFFFFF`, text `#111827`, border-radius `12px`.
  - Focus state: `1px solid #DC2626` outline with `0 0 0 3px #FEE2E2` focus ring.
  - Secret fields (API keys): Obfuscated with eye toggle and monospace typeface (`JetBrains Mono`).

### Buttons
- **Primary Action (e.g., Save, Execute)**: Background `#DC2626`, text `#FFFFFF`, border-radius `12px`, smooth transition on hover to `#B91C1C`.
- **Secondary Action (e.g., 'Comprobar conexión')**: Background `#FFFFFF`, border `1px solid #E5E7EB`, text `#111827`. On hover, background shifts to `#FFF1F2`, border changes to `#FEE2E2`, and text turns `#DC2626`.
- **State Feedback**:
  - Loading: Spinner icon with disabled opacity (0.7).
  - Success: Pill indicator with `#059669` dot, background `#ECFDF5`, text "Conexión exitosa".
  - Failure: Pill indicator with `#DC2626` dot, background `#FEF2F2`, text "Error de conexión".

### Theme Switcher Toggle (Modo claro / Modo oscuro)
- Segmented switch containing two equal-width segments with Sun / Moon icons.
- Container: Background `#F1F5F9`, border-radius `12px`, padding `4px`.
- Active segment: `#FFFFFF` card, subtle shadow, text `#111827`.

### Monospace Code Chips & Badges
- Model identifiers (e.g., `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro`, `llama-3.1`) styled with `label-sm`, background `#F8FAFC`, border `1px solid #E2E8F0`, and text `#64748B`.

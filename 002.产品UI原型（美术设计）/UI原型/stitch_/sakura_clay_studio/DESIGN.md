---
name: Sakura Clay Studio
colors:
  surface: '#fff8f4'
  surface-dim: '#e1d8d3'
  surface-bright: '#fff8f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbf2ec'
  surface-container: '#f5ece6'
  surface-container-high: '#efe7e1'
  surface-container-highest: '#e9e1db'
  on-surface: '#1e1b18'
  on-surface-variant: '#544246'
  inverse-surface: '#34302c'
  inverse-on-surface: '#f8efe9'
  outline: '#867276'
  outline-variant: '#d9c0c5'
  surface-tint: '#99415c'
  primary: '#99415c'
  on-primary: '#ffffff'
  primary-container: '#f58ba8'
  on-primary-container: '#72223d'
  inverse-primary: '#ffb1c4'
  secondary: '#69519b'
  on-secondary: '#ffffff'
  secondary-container: '#c6abfd'
  on-secondary-container: '#543b84'
  tertiary: '#006c4a'
  on-tertiary: '#ffffff'
  tertiary-container: '#46bf8e'
  on-tertiary-container: '#004931'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e0'
  primary-fixed-dim: '#ffb1c4'
  on-primary-fixed: '#3f001a'
  on-primary-fixed-variant: '#7b2944'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d3bbff'
  on-secondary-fixed: '#240554'
  on-secondary-fixed-variant: '#513982'
  tertiary-fixed: '#83f9c3'
  tertiary-fixed-dim: '#66dca8'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#fff8f4'
  on-background: '#1e1b18'
  surface-variant: '#e9e1db'
  cta-text: '#3A2B45'
  text-primary: '#4A3A52'
  text-secondary: '#64536E'
  text-tertiary: '#7C6B85'
  surface-card: '#FFFFFF'
  cat-ob11: '#F68CA1'
  cat-chibi: '#55BCFA'
  cat-scale: '#54CB99'
  cat-other: '#C49BF3'
  heat-tier-1: '#E5BAC1'
  heat-tier-2: '#DB99A4'
  heat-tier-3: '#CE7788'
  heat-tier-4: '#BC586E'
  chart-gridline: '#F3E7EE'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
  display-stat:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

### Personality & Emotional Response
The design system establishes a playful, handcrafted, and comforting atmosphere tailored for miniature sculptors, clay doll makers, and anime hobbyists (e.g., OB11, chibi figure modelers). Built around a "Sakura Macaron" aesthetic, it balances sweet anime softness with systematic tracking precision. The visual space feels like a gentle crafting workbench: reassuring, delightful, and non-judgmental. Interactions spark micro-moments of joy without friction, encouraging daily habits through tactile, pastel warmth.

### Design Movement: Tactile Macaron Minimalism
The design system merges soft tactile skeuomorphism with modern flat simplicity:
- **Cream base surfaces**: Replaces stark digital whites with warm, buttery cream (`#FFF6F0`) to invoke unbaked clay and delicate rice paper.
- **Tenderly diffused illumination**: Employs colored ambient shadows tinted in dusty rose (`rgba(226, 150, 190, 0.16)`) instead of synthetic neutral grays.
- **Sculpted capsule contours**: Generous corner radii mimic cured polymer clay forms.
- **Accented whimsy**: Decorative, tactile symbols (🎀, 🌸, ✨, 🧸, 🌷, 🎨) punctuate key milestones, while retaining clear typographic hierarchies and high-contrast text readouts (`#4A3A52`).

## Colors

### Palette Philosophy
The color system reflects a curated palette of pastel clay powders and macaron confections:
- **Primary (`#F58BA8`)**: Sakura Pink acts as the key brand anchor, conveying warmth and personal touch.
- **Secondary (`#B79CED`)**: Lavender Purple provides ethereal counter-balance, used for secondary actions and progress milestones.
- **Tertiary (`#54CB99`)**: Mint Green denotes completed streaks and balanced structural works.
- **Neutral (`#FFF6F0`)**: Warm Cream acts as the page background canvas, avoiding clinical starkness and cradling pure white cards (`#FFFFFF`).

### Gradient System
The primary interactive CTA leverages a custom directional wash:
`linear-gradient(135deg, #FFB0C8 0%, #CDB0F2 100%)`
To guarantee strict accessibility compliance over this bright gradient, CTA labels must strictly use high-contrast deep plum (`#3A2B45`).

### Data Visualization Rules
1. **Fixed Entity Categories**:
   - **OB11娃头**: `#F68CA1` (Sakura Pink)
   - **QQ人**: `#55BCFA` (Sky Blue)
   - **正比**: `#54CB99` (Mint Green)
   - **其他**: `#C49BF3` (Lavender Purple)
2. **Text Decoupling**: Visual marks and data indicators retain their categorical tint, but textual statistics, dates, and labels must never inherit low-contrast category swatches; they must always render in `--text-primary` (`#4A3A52`) or `--text-secondary` (`#64536E`).
3. **Sequential Heatmap Scale**:
   For calendar tracking, progression flows uniformly across Sakura Pink densities:
   `#E5BAC1` (Level 1) $\rightarrow$ `#DB99A4` (Level 2) $\rightarrow$ `#CE7788` (Level 3) $\rightarrow$ `#BC586E` (Level 4). Level 0 remains an empty outlined cell with border `#F3E7EE`.

## Typography

### Font Selection & Character
The typographic system pairs the soft curves and friendly geometry of **Plus Jakarta Sans** with native system Chinese font stacks (`system-ui, -apple-system, PingFang SC, "Microsoft YaHei"`). This yields clean legibility on small mobile viewports while preserving an approachable, rounded touch.

### Hierarchy & Applications
- **Display Stat (`32px`, 800)**: Reserved for prominent crafting metrics (`128 个`, `¥ 3,860`).
- **Headline XL / LG (`28px` / `22px`, 700)**: Page titles and prominent card greetings (`今天捏了吗？`, `捏土打卡`).
- **Headline MD / SM (`18px` / `16px`, 600)**: Module groupings, folder titles, and modal headers.
- **Body LG / MD (`16px` / `14px`, 400)**: Note logs, journal descriptions (max 200 characters), and category descriptors. Text rendered in `#4A3A52`.
- **Body SM / Label SM (`12px` / `11px`, 400/500)**: Timestamp notations, axis guides, and micro tag labels rendered in `#7C6B85`.

## Layout & Spacing

### Mobile-First Layout Model
The layout adheres strictly to standard WeChat Mini-Program boundaries (375px–414px typical mobile viewports), utilizing an edge margin of `16px` (`margin: 1rem`). Internal content modules observe a compact 4px / 8px vertical and horizontal grid.

### Layout Structures
- **Waterfall Gallery (2 Columns)**: Used for showcase photos and work logs. Columns are separated by an `8px` (`space-sm`) to `12px` (`gutter`) gap, preserving breathing room without fragmenting visual density.
- **Nine-Patch Category Grid (3×3)**: For clay category picking and tool selection. Centered icon tiles with `8px` vertical spacing to their textual identifiers.
- **Mini-Program Header Safe Area**: Top navigation must calculate dynamic `safe-area-inset-top` alongside custom WeChat navigation capsule heights (padding around capsule: right `12px`, vertical centering).
- **Interactive Touch Boundary**: All interactive nodes adhere strictly to a `44pt × 44pt` (`~44px`) minimum touch target envelope.

## Elevation & Depth

### Ambient Tinted Atmosphere
Instead of cold, dark shadows, the design system utilizes translucent, blossom-tinted ambient drop shadows to create a weightless clay-tile effect:
- **Card Surface Depth**: `0 8px 28px rgba(226, 150, 190, 0.16)`. Applied across all primary floating modules, dashboard summaries, and collection folders over the `#FFF6F0` base.
- **Button Lift**: `0 6px 18px rgba(245, 139, 168, 0.28)`. Adds a soft tactile glow beneath the primary gradient CTA.
- **Pressed & Active Depth**: Interactive surfaces depress slightly (`transform: scale(0.98)` or shadow reduction to `0 2px 8px rgba(226, 150, 190, 0.20)`), pairing seamlessly with WeChat lightweight haptic feedback (`wx.vibrateShort({ type: 'light' })`).
- **Overlays**: Darkened image masks (e.g., "已售" Sold Out overlay) employ a frosted semi-translucent veil (`rgba(58, 43, 69, 0.45)`) combined with backdrop blur (`backdrop-filter: blur(4px)`).

## Shapes

### Form Geometry & Rounded Rhythms
Surfaces reference hand-rolled clay and rounded confectionery edges:
- **Cards & Primary Modules**: `16px` (`32rpx`). Offers prominent, friendly curves for daily records and statistics wrappers.
- **Media Thumbnails & Input Containers**: `12px` (`24rpx`). Applied to project photos, material palette chips, and text entry boxes.
- **Pill Capsules (`9999px`)**: Reserved for action buttons, status badges, and the WeChat Mini-Program bottom 4-tab bar selection indicators.
- **Borders & Rules**: 1px solid line `#F3E7EE`. Dashed lines are strictly avoided to prevent visual noise.

## Components

### Buttons
- **Primary CTA**: Capsule-shaped (`border-radius: 9999px`), rendered with `linear-gradient(135deg, #FFB0C8, #CDB0F2)`. Font color is strictly `#3A2B45` with font weight 600. Height is fixed at 48px, padded horizontally with 24px.
- **Secondary Ghost Button**: Card-white fill (`#FFFFFF`) with a 1.5px border in `#F58BA8`, text color `#F58BA8`, resting over the ambient pink shadow.

### Chips & Filter Tags
- **Filter Tags**: Rounded pill (`height: 32px`, `padding: 0 14px`). Inactive state: `#FFFFFF` background with `#64536E` text. Active state: `#F58BA8` with `#FFFFFF` text or pastel tinted background (`rgba(245, 139, 168, 0.15)`) with `#4A3A52` text.

### Cards
- **Record / Waterfall Card**: Surface fill is pure white (`#FFFFFF`), radius `16px` (`32rpx`), framed with the signature pink ambient shadow (`0 8px 28px rgba(226, 150, 190, 0.16)`). Photo covers clip strictly to top radii or remain inset with `8px` inner margin for a picture-frame charm.

### Input Fields
- **Clay Text Entry**: Background is soft tinted white (`#FFFFFF`), radius `12px` (`24rpx`), 1px subtle boundary (`#F3E7EE`). Placeholder text styled in `--text-3` (`#7C6B85`). Focus states transition border to `#B79CED` without harsh outlines.

### Checkboxes & Habit Toggles
- **Check Indicator**: 24px circle with a smooth 2px border in `#CDB0F2`. Checked state animates smoothly into solid `#F58BA8` featuring a white sculpted checkmark (`✓`) and a light haptic pulse.

### WeChat Bottom 4-Tab Bar
- **Tab Shell**: Floating pill dock or bottom-anchored frosted bar (`rgba(255, 255, 255, 0.94)` with `backdrop-filter: blur(12px)`).
- **Tab Items**: 🏠 首页 (Home), 📊 统计 (Stats), 🧱 作品库 (Library), 👤 我 (Profile). Active tabs feature an accent dot or pill highlight in `#F58BA8` accompanied by label text in `#4A3A52`.

### Calendar Heatmap Component
- **Day Matrix**: 7-column grid of rounded squares (`size: 28px × 28px`, `border-radius: 8px`). Level 0 days use a 1px solid `#F3E7EE` border with transparent fill. Levels 1–4 fill progressively with `#E5BAC1`, `#DB99A4`, `#CE7788`, and `#BC586E`. Selected cells trigger an outer ring in `#B79CED`.
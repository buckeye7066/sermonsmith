# Design

Captured from the live codebase (`apps/web`). shadcn/ui-style token system on Tailwind; visual identity is a neutral shadcn base with feature-level accent colors applied per surface (e.g. dark reader theme in the Bible Reader, gradient accents on AI assistant panels).

## Theme

Light-first app shell with class-based dark mode (`darkMode: ["class"]`). The Bible Reader renders its own dark reading surface independent of app theme. Radius scale from `--radius: 0.5rem` (lg) stepping down −2px/−4px for md/sm.

## Color

HSL CSS-variable tokens in `apps/web/src/index.css` (`@layer base`), consumed via Tailwind semantic names — always use the semantic token, never raw hex:

- `background` / `foreground` — 0 0% 100% / 0 0% 3.9% (inverted in `.dark`)
- `card`, `popover` — white surfaces with near-black foreground
- `primary` — near-black (0 0% 9%) with near-white foreground; monochrome primary, color arrives through feature accents
- `secondary`, `muted`, `accent` — 0 0% 96.1% neutrals; `muted-foreground` 0 0% 45.1%
- `destructive` — 0 84.2% 60.2%
- `border` / `input` — 0 0% 89.8%; `ring` near-black
- `chart-1..5` — warm/teal categorical ramp (12 76% 61%, 173 58% 39%, 197 37% 24%, 43 74% 66%, 27 87% 67%)
- `sidebar-*` — dedicated sidebar ramp (98% bg, cool-gray foregrounds, 217° ring)

## Typography

System font stack (no custom webfont loaded in `index.html`). Hierarchy is carried by Tailwind size/weight utilities; the Bible Reader exposes user-adjustable reading size.

## Components

- Radix UI primitives wrapped shadcn-style under `apps/web/src/components/ui/`
- Toast notifications are the canonical feedback channel (success: "Note saved!", errors, validation) — every user action that can fail must speak through them
- Modals (Radix Dialog) host all heavy AI flows: cross-references, explanations, viewpoints comparison, study tools, translation
- Contextual verse toolbar in the reader: icon-row that appears on verse tap
- `tailwindcss-animate` plugin; accordion open/close at 0.2s ease-out is the motion baseline — keep new motion in that quiet register

## Layout

Collapsible icon-rail sidebar navigation (sidebar token ramp) + full-height content pane. Feature pages are single-column forms or reading surfaces; analytics uses stat tiles + charts (chart tokens).

## Conventions

- JSX (not TSX) components; feature-foldered under `components/<feature>/`
- AI operations stream or show named-assistant progress copy ("Larry is writing your sermon…"); never a bare spinner without words for long operations
- Validation failures must produce a visible toast, not a silently disabled button

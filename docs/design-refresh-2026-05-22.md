# App-wide Design Refresh

> Decisions made 2026-05-22. Do not implement until this doc is signed off.
> Covers all screens. Apply every rule here consistently — no screen-by-screen exceptions.

---

## 1. Design tokens — what does NOT change

The following are locked. Do not alter.

- **Color tokens** — all `FT.*` values unchanged
- **Font families** — `SF`, `SFR`, `MONO` unchanged
- **ParChip color system** — birdie/par/bogey/double-bogey unchanged
- **TopoBg** topo texture — unchanged
- **Avatar** color system and overlap — unchanged

---

## 2. Typography scale

Define five levels. Every screen must use only these levels. No ad-hoc font sizes.

| Level | Size | Weight | Family | Letter-spacing | Usage |
|---|---|---|---|---|---|
| **Display** | `36px` | `700` | `SFR` | `-1.2px` | Screen hero headings ("Stats.", "Pick your course.") |
| **Title** | `22px` | `700` | `SF` | `-0.4px` | Section or card headings, round detail numbers |
| **Body** | `16px` | `600` | `SF` | `-0.2px` | Primary list content, card names, player names |
| **Secondary** | `13px` | `400` | `SF` | `0` | Dates, sub-labels, locations, descriptions |
| **Label** | `10px` | `400` | `MONO` | `2px` | MONO section labels, always uppercase |

**Exceptions that stay as-is (intentional outliers):**
- LiveScorecard hole number: `110px / weight 900` — this is a design feature, not a bug
- LiveScorecard PAR / OF values: `32px / weight 900` — same
- StatsScreen big stat numbers (avg vs par, birdies, win%): `40px / weight 700` — intentional data display
- CTA "Start New Round": `34px / weight 700` — primary action gets its own scale

**Current sizes to eliminate:** `8px, 9px, 11px, 12px, 14px, 15px, 17px, 18px, 20px, 24px, 26px, 28px, 30px, 34px` (except CTA), `38px`. Map everything to the five levels above.

---

## 3. Border radius scale

Four values, each with a clear role. Use nothing else.

| Token | Value | Used for |
|---|---|---|
| `r-xl` | `24px` | Large hero CTAs, prominent panels |
| `r-lg` | `20px` | Standard list cards, tiles, course cards |
| `r-md` | `12px` | Buttons, input fields, small cards, modals |
| `r-sm` | `8px` | Badges, icon containers, chips, inner elements |

**Current radius values to eliminate:** `3, 4, 5, 7, 9, 10, 11, 13, 14, 16, 18, 22px`. Map to the four values above.

---

## 4. Spacing

**Screen horizontal padding:** `20px` on all screens — currently `14px` on OfficialCoursesScreen, `22px` on LiveScorecard. Standardise to `20px`.

**Card internal padding:** `14px 16px` standard, `16px 18px` for prominent/hero cards.

**Gap between list cards:** `8px`.

**Section header margin-bottom:** `10px`.

---

## 5. Touch targets

**Minimum interactive element height/width: `44px`.**

Elements to fix:

| Screen | Element | Current | Fix |
|---|---|---|---|
| All screens | Back / nav buttons | `30–36px` | `44px` with `border-radius: r-md` |
| LiveScorecard | Prev / Next hole buttons | `36px` | `44px` |
| LiveScorecard | Hole pip strip | `8px tall` | Keep visual height, wrap in `44px` tall button with transparent padding |
| LiveScorecard | Inline picker number buttons | `44px` ✓ | No change |
| FireteamScreen | Various action buttons | `28–34px` | `44px` |
| SquadScreen | Checkbox-style tap targets | `24px` | `44px` minimum tap area |
| CoursesScreen | Filter chip buttons | `36px` | `44px` |
| StartRoundScreen | "Change" course button | unsized | `height: 44px, padding: 0 12px` |

---

## 6. Emoji — full replacement list

All emoji replaced with inline SVG icons using the **Option B badged** treatment where contextual, or plain SVG where inline.

### Badged SVG icons (square badge, 36×36, `border-radius: r-sm`)

| Emoji | Screen | Badge bg | Icon | Replacement icon description |
|---|---|---|---|---|
| 📋 → | HomeScreen History tile | `FT.forest` | cream stroke | Clock / history (circle + hands) |
| 🌲 → | HomeScreen Course tile | `FT.orange` | ink stroke | Map pin |
| 🌲 → | CoursesScreen empty state | `FT.forest` | cream stroke | Map pin |
| 🎯 → | StatsScreen "Your Profile" | `FT.forest` | cream stroke | Bullseye / target (two concentric circles + dot) |
| 🎯 → | FireteamScreen stats | `FT.orange` | ink stroke | Same |
| 🪪 → | StatsScreen profile card | `FT.forest` | cream stroke | Person silhouette / ID card |

### Inline SVG (no badge, icon replaces emoji directly)

| Emoji | Screen | Replacement |
|---|---|---|
| 🔍 | SquadScreen, OfficialCoursesScreen search | SVG magnifier, `16×16`, `FT.dim` |
| ⚠️ | RoundDetailScreen | SVG triangle-exclamation, `FT.amber`, same size |
| 🏌️ | SquadScreen empty state | SVG person with disc, or generic person, `FT.dim` |
| 🥇 🥈 🥉 | FireteamScreen leaderboard | Keep as-is — these are data content, not UI icons |

### Text-character arrows — replace everywhere

All `→` `←` `‹` `›` text characters used as interactive arrows replaced with SVG:

**Forward arrow (→):**
```svg
<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
  <path d="M4 9H14M14 9L9 4M14 9L9 14"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**Back arrow (←):**
```svg
<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
  <path d="M14 9H4M4 9L9 4M4 9L9 14"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

Use `color: FT.dim` for nav back arrows, `color: FT.cream` on dark backgrounds, `color: FT.ink` inside orange buttons.

**Exception:** LiveScorecard "← prev" / "next →" button labels — replace text arrows with the SVG above but keep the text label alongside (`← prev` becomes SVG + "prev").

---

## 7. Screen-by-screen changes

### HomeScreen

| Element | Current | New |
|---|---|---|
| Greeting label | `"Good to see you,"` 15px/300 | Remove. Replace with MONO stat: `"X ROUNDS THIS MONTH"` 10px/MONO/`rgba(42,31,23,0.4)` |
| Name | `34px/600` + 👋 emoji | `36px/700` letter-spacing `-1.2px`, no emoji |
| CTA title | `"Start New Round"` 26px/600 single line | `34px/700` wraps two lines, letter-spacing `-0.8px` |
| CTA padding | `20px 22px` | `26px 24px` |
| CTA border-radius | `22px` | `24px` (`r-xl`) |
| Arrow button | `48×48px` text `→` | `56×56px` SVG arrow |
| History tile icon | 📋 emoji | Forest badge + clock SVG |
| Course tile icon | 🌲 emoji | Orange badge + pin SVG |
| Tile label | `15px/600` | `17px/700` |
| Tile border-radius | `18px / 16px` mixed | `20px` (`r-lg`) both |
| Tile padding | `14px 16px` | `16px 16px` |
| Round card course name | `14px/500` | `16px/600` (Body level) |
| Round card date | `11px` | `13px` (Secondary level) |
| Round card thumbnail | `40×40px` | `46×46px` |
| Round card border-radius | `14px` | `20px` (`r-lg`) |
| Round card padding | `12px 14px` | `14px 16px` |

**Stat line logic:**
1. `"X ROUNDS THIS MONTH"` — if count > 0
2. `"X ROUNDS IN 2026"` — fallback if month is 0
3. Omit line entirely — if no rounds ever

---

### StartRoundScreen

| Element | Current | New |
|---|---|---|
| "Pick your course." heading | `32px/600` | `36px/700` (`Display` level) |
| "My Courses." heading | `32px/600` | `36px/700` |
| "Ready to play." heading | `32px/600` | `36px/700` |
| Course picker tile font | `20px/600` | `22px/700` (`Title` level) |
| Course picker tile sub | `12px` | `13px` (Secondary level) |
| Course picker tile border-radius | `20px` | `24px` (`r-xl`) — these are large featured tiles |
| Course list card course name | `16px/600` ✓ | No change |
| Course list card par sub | `12px` | `13px` |
| Course list card border-radius | `18px` | `20px` (`r-lg`) |
| Course list thumbnail | `46×46px` ✓ | No change |
| PLAYING label | `10px/MONO` ✓ | No change |
| Friends section label | `9px/MONO` | `10px/MONO` (Label level min) |
| Player chip font | `13px/500` | `13px` ✓ Secondary level |
| Back button | `36×36px` | `44×44px` |
| "Change" button | unsized, `11px` | `height: 44px`, `13px/500` |

---

### OfficialCoursesScreen

| Element | Current | New |
|---|---|---|
| Screen padding | `14px` horizontal | `20px` horizontal |
| "OFFICIAL COURSES" label | `9px/MONO` | `10px/MONO` |
| Page title "Official Courses." | `24px/600` | `36px/700` (`Display` level) |
| Course card course name | `13px/600` | `16px/600` (`Body` level) |
| Course card location | `10px` | `13px` (Secondary level) |
| Course card border-radius | `14px` | `20px` (`r-lg`) |
| Back button | `30×30px` | `44×44px` |
| "OFFICIAL" badge font | `8px/MONO` | `8px/MONO` — keep, this is a badge |

---

### CourseDetailScreen

| Element | Current | New |
|---|---|---|
| Course name heading | `26px/900` | `36px/700` (`Display` level) |
| Section headings (HOLES, WEATHER) | `22px/900` | `22px/700` (`Title` level) |
| Detail row labels | `8px/MONO` | `10px/MONO` (`Label` level) |
| Hole row par value | `18px/900` | Use `Title` (22px/700) for the number |
| Hole row distance | `14px` | `13px` (Secondary level) |
| Info chip font | `13px` | `13px` ✓ |
| Back button | `36×36px` | `44×44px` |
| CTA "Choose this course" button | `17px/900`, `height: 58px` ✓ | No change — already strong |

---

### LiveScorecardScreen

| Element | Current | New |
|---|---|---|
| Hole number | `110px/900` ✓ | No change — hero feature |
| PAR / OF values | `32px/900` ✓ | No change |
| Course name label | `10px/MONO` ✓ | No change |
| "LIVE · timer" | `13px/700` | `13px/700` ✓ |
| Player name | `16px/800` | `16px/700` (`Body` level — 800 is too heavy here) |
| "YOU" badge font | `9px/MONO` | `9px/MONO` — badge exception ✓ |
| TOTAL/THRU label | `11px/MONO` | `10px/MONO` (`Label` level) |
| Prev / Next buttons | `height: 36px` | `height: 44px` |
| Prev / Next text `← →` | text characters | SVG arrows + text label |
| Hole pip strip buttons | `height: 8px` | Wrap in `height: 44px` touchable, keep 4px visual pip |
| Inline score picker nums | `height: 44px` ✓ | No change |
| End round / Quit buttons | `height: 44px` ✓ | No change |

---

### RoundDetailScreen

| Element | Current | New |
|---|---|---|
| Hero heading (course name) | `38px/900` | `36px/700` (`Display` level — 900 weight is too heavy) |
| Score numbers (winner section) | `22px/900` | `22px/700` (`Title` level) |
| Player row name | `14px` | `16px/600` (`Body` level) |
| Hole number in scorecard | `10px/MONO` | `10px/MONO` ✓ |
| Score cell values | `12px/700` | `13px/700` — bump to Secondary level |
| Section labels | `9-11px/MONO` | `10px/MONO` (`Label` level) |
| Back button | check current | `44×44px` |
| ⚠️ | emoji | SVG triangle-exclamation |

---

### StatsScreen

| Element | Current | New |
|---|---|---|
| Screen heading | `34px/600` | `36px/700` (`Display` level) |
| Big stat numbers (avg, birdies, win%) | `40px/700` and `30px` | Standardise to `40px/700` for all three — they're all equal weight data |
| Stat label | `11px/MONO` | `10px/MONO` (`Label` level) |
| Round list course name | `14px/600` | `16px/600` (`Body` level) |
| Round list date | `11px` | `13px` (Secondary level) |
| Round list border-radius | `14px` | `20px` (`r-lg`) |
| Round list thumbnail | `40×40px` | `46×46px` |
| Head-to-head row name | `14px/500` | `16px/600` (`Body` level) |
| Section labels | `11px/MONO` | `10px/MONO` |
| 🪪 emoji | icon | Forest badge + person SVG |
| 🎯 emoji | icon | Forest badge + target SVG |

---

### CoursesScreen

| Element | Current | New |
|---|---|---|
| Screen heading | `34px/600` | `36px/700` (`Display` level) |
| Course card name | `17px/600` | `16px/600` (`Body` level — 17px is between levels, round down) |
| Course card sub (holes, par) | `12px` | `13px` (Secondary level) |
| Course card border-radius | `14px` | `20px` (`r-lg`) |
| Filter chip font | `13px` | `13px` ✓ |
| Filter chip height | `36px` | `44px` |
| OFFICIAL badge | `9px/MONO` | Keep — badge exception |
| 🌲 empty state | emoji | Forest badge + pin SVG |
| NewCourse form headings | `34px/900` | `36px/700` |
| Form label font | `10px/MONO` | `10px/MONO` ✓ |
| Input height | check current | `44px` minimum |

---

### FireteamScreen

| Element | Current | New |
|---|---|---|
| Screen headings | `34px/600` mixed | `36px/700` (`Display` level) |
| Section heading (invite code etc.) | `22px/900` | `22px/700` (`Title` level) |
| Member name | `16px/700` ✓ | No change |
| Member sub | `12px` | `13px` (Secondary level) |
| Stats row value | `18px/600` | `22px/700` (`Title` level) — give these more presence |
| Stats row label | `11px/MONO` | `10px/MONO` |
| Round row name | `14px` | `16px/600` (`Body` level) |
| Small action buttons | `28–32px` | `44px` |
| 🎯 emoji | icon | Orange badge + target SVG |
| 🥇 🥈 🥉 | keep | These are data content |

---

### SquadScreen (Friends)

| Element | Current | New |
|---|---|---|
| Screen heading | `34px/600` | `36px/700` (`Display` level) |
| Friend name | `15px/600` | `16px/600` (`Body` level) |
| Friend sub | `12–13px` | `13px` (Secondary level) |
| Section labels | `9–10px/MONO` | `10px/MONO` |
| Search input row | check height | `44px` minimum |
| 🔍 search icon | emoji | SVG magnifier, `16×16`, `FT.dim` |
| 🎯 empty state | emoji | SVG target, no badge needed here |
| 🏌️ empty state | emoji | SVG person icon, `FT.dim` |
| Add friend button | check height | `44px` |

---

### AuthScreens

| Element | Current | New |
|---|---|---|
| Screen headings | `32px` | `36px/700` (`Display` level) |
| Sub-headings | `22px/900` | `22px/700` (`Title` level) |
| Input height | `~44px` — check actual | `44px` minimum |
| Button height | `~44px` — check actual | `44px` minimum |
| Body text | `15px` | `16px` (Body level) |
| Fine print / terms | `13px` ✓ | No change |

---

### FriendProfileScreen

| Element | Current | New |
|---|---|---|
| Name heading | `22px/600` | `22px/700` (`Title` level) |
| Stats values | `18px/700` | `22px/700` (`Title` level — give more presence) |
| Stat labels | `10px/MONO` | `10px/MONO` ✓ |
| Round list name | `14px` | `16px/600` (`Body` level) |
| Round list date | `11px` | `13px` (Secondary level) |
| Back button | `34×34px` | `44×44px` |

---

### CourseSubmissionScreen

| Element | Current | New |
|---|---|---|
| Screen heading | `24px/700` | `36px/700` (`Display` level) |
| Sub text | `15px` | `16px` (Body level) |
| Form labels | `10px/MONO` ✓ | No change |
| Input height | check current | `44px` minimum |
| Submit button | check height | `44px`, `r-lg (20px)` |
| Back button | `30×30px` | `44×44px` |

---

## 8. Files to edit when implementing

| File | What changes |
|---|---|
| `src/screens/HomeScreen.jsx` | Greeting, typography, icons, card sizing |
| `src/screens/StartRoundScreen.jsx` | Headings, tile sizing, touch targets |
| `src/screens/OfficialCoursesScreen.jsx` | Padding, heading size, card sizing |
| `src/screens/CourseDetailScreen.jsx` | Headings, detail typography |
| `src/screens/LiveScorecardScreen.jsx` | Touch targets (prev/next, pips), player name weight |
| `src/screens/RoundDetailScreen.jsx` | Heading weight, typography scale |
| `src/screens/StatsScreen.jsx` | Heading, card sizing, icons |
| `src/screens/CoursesScreen.jsx` | Heading, card sizing, filter chips, icon |
| `src/screens/FireteamScreen.jsx` | Headings, touch targets, icons |
| `src/screens/SquadScreen.jsx` | Heading, typography, icons |
| `src/screens/AuthScreens.jsx` | Headings, input/button heights |
| `src/screens/FriendProfileScreen.jsx` | Headings, typography, back button |
| `src/screens/CourseSubmissionScreen.jsx` | Heading, touch targets |
| `src/components/atoms/index.jsx` | Add `IconSearch`, `IconTarget`, `IconPerson`, `IconArrowForward`, `IconArrowBack` SVG components |

### Suggested implementation order

1. **Add new SVG atoms** — `IconArrowForward`, `IconArrowBack`, `IconSearch` — these are needed everywhere, do them first
2. **HomeScreen** — highest visibility, establishes the pattern
3. **OfficialCoursesScreen + CourseDetailScreen** — frequently used flow
4. **StartRoundScreen** — another high-traffic screen
5. **LiveScorecardScreen** — touch target fixes only, preserve the bold design
6. **StatsScreen + RoundDetailScreen** — typography pass
7. **Remaining screens** — FireteamScreen, SquadScreen, CoursesScreen, AuthScreens, FriendProfileScreen, CourseSubmissionScreen

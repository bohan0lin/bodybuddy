# BodyBuddy UI Redesign Implementation Guide

> This document is the implementation handoff for Claude Code. Read it completely before changing code.

## 1. Goal

Redesign the existing BodyBuddy PWA without rebuilding the application or replacing its backend.

The product should feel lively, premium, simple, and immediately understandable. The primary daily action is logging food through AI by voice or photo, with manual entry available as a secondary path.

This change must preserve the existing Supabase data, authentication, AI endpoints, food library, meal editing, workout logging, calendar, knowledge base, bilingual support, and PWA behavior.

## 2. Design sources of truth

Use these files in priority order:

1. Interactive target design: [`bodybuddy-redesign-v2.html`](./bodybuddy-redesign-v2.html)
2. Home reference screenshot: [`references/home-reference.png`](./references/home-reference.png)
3. Me reference screenshot: [`references/me-reference.png`](./references/me-reference.png)
4. This implementation guide

The interactive design is the latest approved direction. The screenshots are visual references, not exact requirements. Do not copy their five-tab navigation; use the four-tab architecture defined below.

## 3. Scope for this implementation

### In scope

- Restyle the app shell and cards for the new light and dark themes.
- Redesign the Today page.
- Redesign the Me page, keeping its route as `/settings` to avoid breaking links.
- Change the bottom navigation to four destinations: Today, Calendar, Coach, Me.
- Add a prominent meal-capture area on Today: Voice log, Photo scan, Manual entry.
- Replace Body Trend on Today with Today's Meals.
- Place Language and Theme inside the settings control in the upper-right corner of Me.
- Preserve all existing functionality and routes that are still needed.
- Keep the current iOS safe-area and keyboard-safe bottom navigation behavior.

### Out of scope

- Replacing Supabase or changing authentication.
- Rewriting the AI assistant architecture.
- Removing the Body page; only remove its preview card from Today.
- Removing the Knowledge page. It remains available from the Coach experience or another secondary entry until its final navigation is designed.
- Inventing health scores, workout goals, or progress percentages that cannot be calculated from real data.
- Deploying before local verification.

## 4. Navigation architecture

The persistent bottom navigation has four equal items:

| Position | Label | Route | Purpose |
| --- | --- | --- | --- |
| 1 | Today | `/` | Daily status and fastest meal logging |
| 2 | Calendar | `/calendar` | Seven-day and month history, day details |
| 3 | Coach | `/coach` | AI conversation and suggested prompts |
| 4 | Me | `/settings` | Goal, body metrics, progress, preferences |

Implementation notes:

- Remove the center `+` FAB and its action sheet from `BottomNav.tsx`.
- Do not keep a separate Knowledge tab in the bottom navigation.
- Keep `/knowledge` working. Add a subtle Knowledge entry in Coach or the Me settings sheet if one does not already exist after the redesign.
- The active tab must be unambiguous through both icon and color.
- Use the existing `position: sticky; bottom: 0` approach. Do not switch the navigation back to `position: fixed`; that previously caused iOS keyboard and safe-area gaps.
- Preserve `env(safe-area-inset-bottom)` and the current `100svh` app-shell logic.

## 5. Today page

Target file: `src/pages/Today.tsx`

### 5.1 Header

- Keep the localized current date at upper left.
- Show `Today` as the main heading.
- Keep the calendar icon at upper right, navigating to `/calendar`.
- Maintain the current iOS top safe-area padding.

### 5.2 Remaining Today / Today's Workout carousel

Use one horizontally switchable card with two faces.

Default face: Remaining Today

- Remaining calories are the largest value.
- Supporting line: consumed calories out of target calories.
- Calorie progress ring at upper right.
- Protein, carbs, and fat targets along the bottom.
- All displayed energy values remain in kcal.
- If a target is `0`, avoid division by zero and show an empty ring with a calm empty-state label instead of a percentage.

Second face: Today's Workout

- Sum today's workout duration and estimated calorie burn.
- Show the latest or most relevant workout type and note as the focus.
- If multiple workouts exist, display the total duration and burn, then use a concise count such as `2 activities`.
- If no workout exists, show `No workout logged` and a clear action to `/workout`.

Interaction:

- Default to the nutrition face on each fresh visit.
- Support swipe, an arrow button, and two position dots.
- Do not auto-rotate.
- Respect `prefers-reduced-motion`.
- The entire workout empty-state action may navigate to `/workout`; the nutrition card itself must not accidentally open the long manual form.

### 5.3 Log this meal

This replaces the current single entry into the meal form and follows the home reference composition.

Show two equal primary tiles:

- Voice log: microphone icon, warm coral treatment, label `Voice log`, supporting text `Tell AI what you ate`.
- Photo scan: camera icon, soft purple treatment, label `Photo scan`, supporting text `AI estimates nutrition`.

Show one full-width secondary button below:

- Manual entry with a pencil icon.

Expected behavior:

- Voice log enters the AI meal-logging flow in voice mode. If voice capture is not yet implemented, do not fake a recording state; route to Coach with meal-logging context and clearly expose the available voice control there.
- Photo scan routes to the existing photo-recognition flow in `LogMeal.tsx` and should open the image picker/camera through a deliberate user click.
- Manual entry routes to `/log` with the standard form visible.
- Keep AI results confirm-before-write. A model response must never silently create a meal.

Recommended implementation shape:

- Add a route state such as `{ mode: 'voice' | 'photo' | 'manual', returnTo: '/' }`.
- Let `LogMeal.tsx` react to `mode: 'photo'` only after the page is visible; do not trigger a browser permission request without a user gesture.
- Reuse existing `postJson('/api/recognize', ...)`, image resizing, saved foods, amount scaling, and edit logic.

### 5.4 Last 7 days

- Keep the approved single calorie ring for each day.
- Do not show calorie numbers under the rings.
- A ring can represent up to three laps when consumption exceeds the target; reuse `CalorieRing.tsx`.
- Workout indication belongs inside the center of the calorie ring.
- The dumbbell is small, thin, and the same color as the active ring:
  - Light theme: coral.
  - Dark theme: gold.
- Remove the separate row below each ring currently used for `WorkoutDot`.
- Tapping a day navigates to `/day/:date` and preserves the correct back destination.

Implementation note: the current `WorkoutDot.tsx` is a filled, rounded icon. Update it to a smaller thin-line dumbbell, or create a dedicated `WorkoutRingIcon` so other uses of the filled icon are not unintentionally changed.

### 5.5 Today's Meals

Remove the Body Trend card from Today. Keep the Body page and all body data.

Add a `Today's meals` section below the seven-day strip:

- Header shows the total meal count.
- Sort today's meals by `createdAt` ascending.
- Each row shows meal name, localized meal type, time, and kcal.
- Show at most two or three rows on Today to preserve hierarchy; provide `View all` when there are more.
- Tapping a meal opens the existing edit flow in `/log` with `editMeal` and `returnTo: '/'`.
- Empty state: one quiet line such as `No meals logged yet`, with no extra decorative card.

Do not show the weight chart or Body Trend on the home screen after this change.

## 6. Me page

Target file: `src/pages/Settings.tsx`

The route stays `/settings`, but the visible tab label is Me.

### 6.1 Profile header

- Left: rounded-square avatar or initial.
- Center: display name and a calculated tracking streak.
- Right: settings icon.
- Tapping avatar/name opens `/settings/profile`.
- Do not show the email in the main visual hierarchy. It can appear in the settings sheet under Account.

Tracking streak calculation:

- A tracked day is a date containing at least one meal or workout record.
- Count consecutive tracked dates backward from today.
- If today is empty but yesterday is tracked, allow the active streak to end yesterday so the streak does not disappear early in the day.
- Do not store the streak in the database; derive it from existing records.

### 6.2 Goal hero

Goal is the most prominent area of Me and appears immediately below the profile header.

Content:

- Eyebrow: `Primary goal`.
- Large goal name, e.g. `Body recomposition`.
- One concise explanation line.
- Daily calories as the strongest target value.
- Protein, carbs, and fat alongside it.
- Small Edit action navigating to `/settings/targets` or a new focused goal editor.

Data requirement:

- The current `Profile` type has numeric targets but no goal category.
- Add a persistent `goalType` only if the user can select the goal. Recommended values:
  - `recomposition`
  - `fat_loss`
  - `muscle_gain`
  - `maintenance`
  - `performance`
- Add a safe Supabase migration for `profiles.goal_type` with a sensible nullable/default value and update the row mapper.
- Existing users must retain all current numeric targets.
- Do not automatically overwrite calorie or macro targets when changing the goal type. Recommendations may be offered, but require confirmation before saving.

If schema work is intentionally deferred, label the card `Daily goal` and emphasize the real numeric targets rather than hard-coding a fake goal type.

### 6.3 Body metrics

Show a compact 2 × 2 grid:

- Height: `profile.heightCm`.
- Weight: `latestWeight.weight`.
- BMI: derive from latest weight and height; show one decimal.
- Body fat: `latestWeight.bodyFat`.

Rules:

- Use `—` for missing values; never show `0` as a real measurement.
- Tapping the card opens `/body` with `{ back: '/settings' }`.
- Do not duplicate a full weight trend graph here.

### 6.4 Monthly consistency

Only show metrics that can be computed accurately.

Recommended first version:

- Meals logged: number of elapsed days this month with at least one meal, shown as `X of Y days`.
- Workout days: number of distinct workout dates this month.

Do not label workout data as `70% completed` unless the product has a stored workout-frequency target. Do not invent a completion rate from raw workout count.

### 6.5 Settings control

The upper-right settings icon opens a focused sheet or modal. It is not a separate visual section on the Me page.

Primary controls inside the sheet:

- Language: English / 中文, wired to `useT().setLang`.
- Appearance: System / Light / Dark, wired to `usePrefs().setTheme`.

Secondary items below a divider:

- Account email.
- Knowledge library entry if it has no visible entry from Coach.
- Sign out, visually low-emphasis but clearly labeled.

Do not place Language and Theme as large cards on the main Me page. The energy unit does not need a prominent global setting because meal energy input already has its own kcal/kJ toggle; all summaries continue to display kcal.

## 7. Visual system

### 7.1 Product personality

- Premium but energetic, not clinical.
- Light theme: warm pearl background with coral highlights and subtle mint/purple accents.
- Dark theme: retain the existing black-and-gold identity.
- Use color to establish hierarchy, not to decorate every element.

### 7.2 Theme tokens

Extend the existing variables in `src/index.css` instead of placing large inline style objects in page components.

Suggested light direction:

- Background: warm pearl near `#F5F0E7`.
- Primary surface: translucent warm white.
- Main text: near-black warm brown.
- Primary action and calorie ring: coral near `#FB775B`.
- Photo action accent: restrained lavender.
- Workout secondary accent: muted teal only where category distinction is useful.

Suggested dark direction:

- Background: `#09090A` or the existing `#0A0A0B`.
- Raised surfaces: charcoal gradient or layered charcoal tokens, visibly lighter than the background.
- Main accent: existing gold near `#C8A97E`.
- Borders: low-opacity gold/white hairlines.
- Shadows: deep black shadow plus subtle top highlight so cards visibly float above the background.

### 7.3 Floating cards

- Large card radius: approximately 24–26 px.
- Small tile radius: approximately 18–22 px.
- Light theme: translucent white surface, soft shadow, white top highlight, `backdrop-filter` where supported.
- Dark theme: cards must not be pure black. Use raised charcoal surfaces, a faint gold edge, and a stronger shadow than light mode.
- Provide a non-blurred fallback; content contrast must not depend on backdrop blur.
- Avoid nesting multiple bordered cards.

### 7.4 Flowing background

- Use a very subtle, low-contrast radial light field behind content.
- It must never reduce text contrast.
- Animation should be slow and minimal.
- Disable animation under `prefers-reduced-motion: reduce`.

### 7.5 Typography and icons

- Continue using Inter plus system fallbacks.
- Use weights 400 and 500 for the redesign.
- Large numeric values should use tabular figures.
- Use one consistent thin-line icon style, around 1.7–1.8 stroke width.
- Keep interactive tap targets at least 44 × 44 px even when the visible icon is smaller.
- Avoid emoji as permanent navigation or action icons.

## 8. Component plan

Prefer extracting reusable components instead of expanding page-level inline styles.

Suggested components:

- `AppIcon.tsx`: shared thin-line icons or a consistent icon wrapper.
- `FloatingCard.tsx`: visual surface only; no business logic.
- `DailySummaryCarousel.tsx`: nutrition/workout carousel.
- `MealCapturePanel.tsx`: voice/photo/manual actions.
- `SevenDayStrip.tsx`: shared by Today and calendar where appropriate.
- `TodayMeals.tsx`: compact daily meal list.
- `ProfileHeader.tsx`: Me header and settings trigger.
- `GoalHero.tsx`: goal and daily targets.
- `BodyMetricGrid.tsx`: height, weight, BMI, body fat.
- `PreferencesSheet.tsx`: language, theme, account, sign out.

Keep `CalorieRing.tsx` as the source of truth for up-to-three-lap calorie progress.

Do not create a generic component for every small row. Extract only repeated visual or behavioral patterns.

## 9. Existing files likely to change

| File | Expected change |
| --- | --- |
| `src/pages/Today.tsx` | New Today layout, carousel, capture area, today meals; remove body trend preview |
| `src/pages/Settings.tsx` | Replace list-style settings page with the new Me layout |
| `src/components/BottomNav.tsx` | Four-tab navigation; remove center FAB and Knowledge tab |
| `src/components/CalorieRing.tsx` | Preserve logic; optionally support a centered child/icon |
| `src/components/WorkoutDot.tsx` | Use thin, small ring-center treatment or split into a new component |
| `src/index.css` | Theme tokens, floating surfaces, carousel, capture tiles, Me layout |
| `src/lib/i18n.tsx` | Add all new English and Chinese strings |
| `src/types.ts` | Optional `goalType` addition |
| `src/data/store.tsx` | Optional `goal_type` mapping and profile update support |
| `supabase/*.sql` | Optional additive migration for `profiles.goal_type` |

Do not change API endpoints for a visual-only portion of the work unless required for the voice entry behavior.

## 10. Responsive and PWA requirements

- Primary target: iPhone installed PWA, 320–460 px wide.
- Also verify normal browser layout at 736 px or wider.
- No horizontal scrolling.
- No content behind the notch, home indicator, or bottom navigation.
- Opening and dismissing the keyboard must not leave a gap below the bottom navigation.
- Do not use `100dvh` for the app shell if it reintroduces keyboard resizing issues; preserve the current `100svh` behavior unless testing proves a safer alternative.
- Bottom navigation remains reachable on long pages and must not cover the last actionable row.
- Use `touch-action: pan-y` carefully around the horizontal carousel so vertical page scrolling still works.

## 11. Accessibility

- All icon-only buttons require localized `aria-label` values.
- Carousel state must be announced with meaningful labels; dots are real buttons.
- Theme and language controls expose selected state.
- Do not rely on color alone for selected tabs or progress meaning.
- Maintain readable contrast in both themes.
- Respect reduced motion.
- Voice recording must visibly show idle, listening, processing, success, and error states when implemented.

## 12. Data and product accuracy rules

- Store calories internally in kcal.
- Summary screens always display kcal.
- kcal/kJ conversion is allowed only in the meal energy input control.
- AI-derived nutrition and exercise calories are estimates and should be labeled as estimates before confirmation.
- AI meal logging remains confirm-before-write.
- Never invent missing body measurements, target values, goal type, streak, or completion percentages.
- Treat a numeric target of `0` as not configured, not as a completed goal.

## 13. Implementation sequence

Implement in small, verifiable stages:

1. Create shared design tokens and floating-card styles in `src/index.css`.
2. Convert `BottomNav.tsx` to the four-tab architecture while preserving sticky/safe-area behavior.
3. Build the Today summary carousel using existing meals, targets, and workouts.
4. Build the three meal-capture actions and wire them to existing flows.
5. Move `WorkoutDot` into each seven-day calorie ring.
6. Replace Body Trend with Today's Meals and wire edit navigation.
7. Redesign `/settings` as Me using existing profile and weight data.
8. Add the settings sheet with direct language/theme controls and account actions.
9. Add optional persisted goal type only with an additive migration and backward-compatible mapping.
10. Complete bilingual strings.
11. Run typecheck/build and perform mobile visual QA in both themes.

Do not combine schema migration and major visual refactoring into one unreviewable commit.

## 14. Acceptance checklist

### Today

- [ ] Existing date header and calendar entry still work.
- [ ] Remaining Today is the default carousel face.
- [ ] Workout face uses real workout data and has a truthful empty state.
- [ ] Voice, photo, and manual meal actions are visually clear and keyboard accessible.
- [ ] Photo recognition still uses the existing confirm/edit flow.
- [ ] Seven-day rings retain the three-lap behavior.
- [ ] Workout dumbbell is inside the ring, small, thin, and ring-colored.
- [ ] Body Trend is absent from Today.
- [ ] Today's Meals uses real records and opens meal editing.

### Me

- [ ] Goal is the strongest visual element.
- [ ] Goal and macro values come from real profile data.
- [ ] Missing body data displays as `—`, not `0`.
- [ ] BMI is derived safely and rounded to one decimal.
- [ ] Language and Theme appear only inside the upper-right settings control.
- [ ] Theme changes apply immediately and persist.
- [ ] Language changes apply immediately and persist.
- [ ] Sign out remains available.

### Navigation and PWA

- [ ] Bottom nav has exactly four primary items.
- [ ] `/knowledge`, `/log`, `/workout`, `/body`, and all settings subroutes remain reachable where required.
- [ ] iOS keyboard dismissal leaves no bottom gap.
- [ ] Safe areas are correct in installed PWA mode.
- [ ] Light cards visibly float against the pearl background.
- [ ] Dark cards visibly float against the black background.
- [ ] `npm run build` passes.

## 15. Verification commands

Run the repository's existing checks first. At minimum:

```bash
npm run build
```

If a lint or test script exists in `package.json`, run it too. Do not add a new dependency only for this redesign unless it materially reduces code or improves accessibility.

Manual QA matrix:

- Light / Dark / System themes.
- Chinese / English.
- iPhone installed PWA and normal browser.
- Empty account, partially configured account, and account with meals/workouts.
- Target calories equal to zero.
- Intake under one lap, over one lap, over two laps, and over three laps.
- No workout, one workout, and multiple workouts today.
- No meals and more than three meals today.
- Keyboard opened and dismissed on every form entry point.

## 16. Git requirements

- Use English commit messages.
- Do not add Claude, Anthropic, or any AI tool as a co-author.
- Preserve unrelated user changes.
- Keep commits focused and reviewable.
- Do not deploy until the implementation builds successfully and the user asks to deploy.

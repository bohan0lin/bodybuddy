# BodyBuddy Redesign Review and Fix Plan

> Handoff for Claude Code. Fix the issues below in priority order. Preserve all existing user data and unrelated changes. Do not deploy.

## 1. Review status

Reviewed branch: `redesign`

Automated checks completed:

- TypeScript project build: passed.
- Oxlint: passed.
- Vite production build: passed.
- PWA service worker generation: passed.
- Chinese/English key parity: 247 / 247, no missing keys.
- `git diff --check`: passed.

Build observation:

- Main JavaScript bundle: approximately 894 kB before gzip and 257 kB after gzip.
- Vite reports a chunk-size warning above 500 kB.

Authenticated runtime and iPhone PWA testing have not been completed. Do not place account credentials in code, documentation, logs, fixtures, environment files, or commits.

## 2. Release decision

Do not deploy the redesign until all P1 issues are fixed and the `goal_type` database migration is confirmed in the target Supabase project.

There are no known P0 issues. There are three P1 issues.

## 3. P1 — Voice Log is not a voice feature

### Current behavior

`src/components/MealCapturePanel.tsx` routes Voice Log directly to `/coach`.

`src/pages/Coach.tsx` currently provides only:

- Text input.
- Photo picker.
- Send button.

There is no microphone button, speech recognition, recording state, transcription state, or voice-specific meal context. The UI promises a feature that is not delivered.

### Required behavior

Clicking Voice Log must open Coach in meal-logging voice mode.

Suggested route state:

```ts
{
  mode: 'voice-meal',
  returnTo: '/'
}
```

Coach should:

1. Read the route state.
2. Display a microphone action next to the text field.
3. Start recording only after an explicit user click.
4. Convert speech into editable text.
5. Prefix or contextualize the transcript as a meal-recording request.
6. Let the user review or edit the transcript before sending.
7. Preserve confirm-before-write for every generated meal action.

Minimum state model:

- `idle`
- `listening`
- `processing`
- `ready`
- `error`

For an initial implementation, use feature detection for `SpeechRecognition` and `webkitSpeechRecognition`. If unsupported, show a localized fallback and focus the normal text input. Do not display a fake listening state.

Required bilingual copy:

- Start listening.
- Stop listening.
- Listening…
- Processing speech…
- Voice input is not supported in this browser.
- Review before sending.

### Acceptance criteria

- Voice Log no longer lands on an ordinary empty text chat without explanation.
- Microphone access is requested only following a direct user action.
- Transcript remains editable.
- No meal is saved until the user confirms the assistant action card.
- Unsupported browsers have a usable text fallback.

## 4. P1 — Cold-load profile forms can overwrite saved data

### Root cause

`StoreProvider` renders children while its Supabase request is still loading. During that time, `profile` is `DEFAULT_PROFILE`, where all numeric targets are zero.

`src/pages/SettingsTargets.tsx` initializes local form state only once:

```ts
const [form, setForm] = useState(profile)
```

`src/pages/SettingsProfile.tsx` has the same pattern for display name and height.

On a direct reload of `/settings/targets` or `/settings/profile`, the page can initialize from defaults before Supabase returns. Subsequent store updates do not refresh the local form. Saving can overwrite real user values with defaults.

### Required fix

Preferred solution: do not render authenticated routes until both authentication and store hydration are complete.

Recommended structure:

1. Keep `StoreProvider` responsible for fetching data.
2. Add a child application shell that calls `useStore()`.
3. While `store.loading` is true, render the existing BodyBuddy splash.
4. Render routes only after hydration completes.

Also make the form components resilient:

- Initialize from hydrated profile data.
- If a synchronization effect is used, do not overwrite form fields after the user has begun editing.
- Disable Save while required source data is loading.

### Acceptance criteria

- Reload `/settings/targets` directly with an account that has non-zero targets; existing values must appear.
- Reload `/settings/profile` directly; existing name and height must appear.
- Slow-network simulation must not reveal an editable all-zero form.
- Saving without changes must not alter database values.

## 5. P1 — Goal persistence can fail silently without migration

### Current behavior

`src/data/store.tsx` optimistically changes local profile state and then sends a Supabase update containing `goal_type`.

If `supabase/migration-goal-type.sql` has not been applied, Supabase rejects the update. The UI still navigates away and temporarily displays the local value. The failure is only written to the browser console, and the value disappears after reload.

Because all target fields and `goal_type` are included in one update, selecting a goal before migration may also prevent calorie and macro changes from persisting.

### Required database change

Run the additive migration in the target Supabase project before deployment:

```sql
alter table public.profiles
  add column if not exists goal_type text;
```

Strengthen it with an idempotent check constraint allowing only:

- `recomposition`
- `fat_loss`
- `muscle_gain`
- `maintenance`
- `performance`
- `null`

The migration must remain safe for existing users and must not alter existing calorie or macro targets.

### Required application change

For profile updates:

1. Return a Promise from `updateProfile`.
2. Wait for the Supabase response before reporting success or navigating away.
3. On failure, roll back the optimistic state or refetch the profile.
4. Show a localized error message.
5. Prevent duplicate saves while the request is pending.

Apply the same error-handling principle to profile and target changes. Do not silently treat a console error as successful persistence.

### Acceptance criteria

- Goal and numeric targets remain after a hard reload.
- Failed database writes produce visible feedback.
- A failed write does not leave local state showing an unsaved value.
- Existing users retain their stored numeric targets after migration.

## 6. P2 — Photo Scan requires an unexplained second tap

### Current behavior

The Today tile navigates to `/log` with `mode: 'photo'`. `LogMeal.tsx` only scrolls the existing camera card into view. Because that card is already at the top, the route mode creates almost no visible behavior. The user must tap Photo Scan and then tap the camera card again.

### Preferred fix

Make the Today Photo Scan tile itself own the hidden `input[type=file]` activation so the first click is the deliberate browser user gesture.

Recommended flow:

1. User taps Photo Scan on Today.
2. Camera/photo picker opens immediately.
3. Resize the selected image with the existing image helper.
4. Navigate to the recognition/edit flow and begin analysis.
5. Show progress, recognition results, and editable nutrition fields.
6. Save only after user confirmation.

Avoid placing a raw base64 image into a URL. If state must cross routes, use an in-memory handoff, a shared recognition hook/context, or perform recognition before navigation and pass only the result.

### Acceptance criteria

- One tap on Photo Scan opens the camera/photo picker.
- Canceling the picker leaves the user on Today without an error.
- Recognition errors provide retry and manual-entry options.
- Existing image resize and RAG grounding remain in use.

## 7. P2 — Calendar workout marker differs from Today

### Current behavior

`src/components/SevenDayStrip.tsx` correctly places a small thin dumbbell in the center of the calorie ring.

`src/pages/Calendar.tsx` still renders the older filled `WorkoutDot` below the ring.

### Required fix

- Reuse the same ring-center workout marker in both views.
- Keep the dumbbell small and thin.
- Match the active calorie ring color:
  - Light theme: coral.
  - Dark theme: gold.
- Remove the extra reserved row below the calendar ring.
- Preserve the three-lap behavior of `CalorieRing`.

### Acceptance criteria

- Today and Calendar use the same ring and workout-marker language.
- Calendar cells remain readable at 320 px width.
- A day without a workout has no center icon.

## 8. P2 — Bottom navigation loses section state on child routes

### Current behavior

The four `NavLink` entries match only their direct routes. Child screens therefore have no active section:

- `/day/:date` should belong to Calendar.
- `/settings/targets`, `/settings/profile`, and `/body` should belong to Me.
- `/knowledge` should belong to Coach or Me, according to its final entry location.

### Required fix

Use `useLocation()` and route-family matching to calculate the active destination instead of relying only on default `NavLink` matching.

Suggested mapping:

- Today: `/`
- Calendar: `/calendar`, `/day/*`, optionally `/history`
- Coach: `/coach`, `/knowledge`
- Me: `/settings`, `/settings/*`, `/body`

`/log` and `/workout` may either retain the originating tab through route state or intentionally show no active tab. Pick one behavior and keep it consistent.

### Acceptance criteria

- Calendar remains active while viewing a day.
- Me remains active while editing profile, targets, or body data.
- Selected state is communicated through both icon/color and appropriate accessibility state.

## 9. P2 — Preferences dialog accessibility is incomplete

### Missing behavior

`src/components/PreferencesSheet.tsx` has dialog semantics, but does not:

- Move focus into the dialog when opened.
- Trap focus inside the dialog.
- Close with Escape.
- Return focus to the settings trigger.
- Prevent background scrolling.

### Required fix

- Give the panel a stable dialog title connected through `aria-labelledby`.
- Focus the close button or first control when opened.
- Trap Tab and Shift+Tab within the panel.
- Handle Escape.
- Restore focus to the settings button on close.
- Lock body scroll for the lifetime of the open dialog and restore it on cleanup.
- Keep backdrop-click close behavior.

### Acceptance criteria

- Entire dialog is usable using only the keyboard.
- Screen-reader focus does not move behind the dialog.
- Closing returns focus to the settings icon.

## 10. P2 — Initial mobile bundle should be route-split

### Current result

The production bundle is approximately 894 kB before gzip. All routes are eagerly imported in `src/App.tsx`.

### Required fix

Use `React.lazy` and `Suspense` for non-home routes, especially:

- Calendar and Day.
- Coach.
- Knowledge.
- LogMeal and LogWorkout.
- Body.
- Settings subpages.

Keep Today and the application shell in the initial chunk unless measurement shows another split is better.

### Acceptance criteria

- Production build passes.
- Route chunks are emitted separately.
- Initial main bundle is materially smaller.
- Navigation shows a lightweight branded fallback rather than a blank page.
- PWA precaching and offline startup continue to work.

## 11. P3 — Carousel accessibility semantics

### Current issue

The pagination dots use `role="tab"` without complete tab semantics or associated `tabpanel` elements. The arrow button label also remains workout-oriented after its direction changes.

### Required fix

Choose one model:

- Implement full tab semantics with IDs, `aria-controls`, and tabpanels; or
- Treat the dots as ordinary pagination buttons and remove `role="tab"`.

The arrow label must describe its current destination, such as:

- Show today's workout.
- Show remaining nutrition.

Expose the current slide through a concise live status or equivalent accessible name.

## 12. P3 — Today's Meals hides the count when there are more than three

### Current issue

When there are more than three meals, the header shows only View all and no longer shows the total count.

### Required fix

Keep the total visible for every state. Example:

```text
5 meals · View all
```

Continue to render at most three rows on Today.

## 13. P3 — Body-fat zero and goal-type validation

- `BodyMetricGrid` treats `bodyFat = 0` as a displayed measurement while other impossible zero measurements become `—`. Apply one consistent validity rule.
- Type `GoalHero.goalType` as `GoalType | null | undefined`, not an arbitrary string.
- Validate unknown database values before mapping them into `Profile`.
- Add the database check constraint described in the P1 migration section.

## 14. P3 — Documentation is stale

Update `README.md` after the code fixes:

- Today no longer contains the weight-trend preview.
- Bottom navigation now has four items.
- Language and theme live in the Me preferences sheet.
- `PickerList` and the deleted settings pages should not appear in the project tree.
- Describe Voice Log only after it actually works.
- Add updated Today and Me screenshots after authenticated visual QA.

## 15. Design regression checks

After fixing the functional issues, compare the implementation with:

- `docs/redesign/bodybuddy-redesign-v2.html`
- `docs/redesign/references/home-reference.png`
- `docs/redesign/references/me-reference.png`
- `docs/redesign/IMPLEMENTATION_GUIDE.md`

Confirm:

- Goal is the strongest visual element on Me.
- Language and Theme are absent from the main Me hierarchy and available from the upper-right settings icon.
- Light cards visibly float above the pearl background.
- Dark cards are raised charcoal, not black-on-black.
- Text remains readable over every translucent surface.
- Today defaults to Remaining Today.
- Carousel supports touch without preventing vertical scrolling.
- Today's Meals replaces Body Trend.
- Seven-day and month-calendar rings use consistent workout markers.
- All visible summary energy values use kcal.
- Numeric target zero is shown as unconfigured, not as a real goal.

## 16. Authenticated manual QA

Use a dedicated test account supplied through the normal application login UI. Never hard-code or commit credentials.

### Data setup

Create or use records covering:

- Non-zero calorie and macro targets.
- One selected goal type.
- Height, weight, and body fat.
- Zero meals today.
- More than three meals today.
- Zero workouts today.
- Multiple workouts today.
- At least seven days of mixed meal/workout history.
- A day over 100%, 200%, and 300% of calorie target.

### Functional walkthrough

1. Reload the app on Today.
2. Check nutrition totals against stored meals.
3. Swipe to workout and compare duration/burn against stored workouts.
4. Test Voice Log, edit the transcript, submit, dismiss once, then confirm once.
5. Test Photo Scan, cancel once, then choose a valid food photo.
6. Edit the recognized portion before confirming.
7. Open each seven-day date and verify back navigation.
8. Open Calendar and verify ring/marker consistency.
9. Edit an existing meal from Today's Meals.
10. Open Me and verify goal, BMI, streak, monthly meal days, and workout days.
11. Change Language and confirm all new strings update immediately.
12. Change System/Light/Dark and hard reload to confirm persistence.
13. Reload `/settings/targets` directly and verify saved values are preserved.
14. Simulate a failed profile write and verify rollback/error feedback.
15. Sign out and confirm protected data is no longer visible.

### iPhone installed-PWA walkthrough

1. Launch from the Home Screen.
2. Check top safe area on Today, Calendar, Coach, Me, and forms.
3. Focus and dismiss the keyboard on Coach, LogMeal, Knowledge, targets, and profile.
4. Confirm the bottom navigation returns flush to the safe-area bottom without a gap.
5. Confirm no page content is covered by the navigation.
6. Open and close Preferences repeatedly; verify background does not jump or remain locked.
7. Test camera and microphone permission denial, approval, and retry.
8. Close and reopen the PWA; confirm session and preferences persist.

## 17. Automated verification

Run:

```bash
npm run lint
npm run build
git diff --check
```

Add focused tests where practical for:

- Streak calculation.
- BMI calculation and missing values.
- Monthly distinct-day calculation.
- Route-family navigation state.
- Target form hydration.
- Profile update rollback on Supabase failure.
- Carousel destination labels.

Do not run paid/model-backed evals merely to validate this UI redesign. Run AI evals only if the Coach prompt, tool definitions, voice-to-prompt behavior, or AI request payload changes.

## 18. Required implementation order

1. Fix store hydration and profile form data safety.
2. Apply/validate `goal_type` migration and make profile writes awaitable with visible errors.
3. Implement real Voice Log behavior.
4. Improve Photo Scan to a one-tap picker flow.
5. Unify Calendar workout markers.
6. Fix route-family navigation state.
7. Complete Preferences accessibility.
8. Fix carousel and meal-count details.
9. Add route-level code splitting.
10. Update README and screenshots.
11. Run automated checks.
12. Perform authenticated browser and iPhone PWA QA.

## 19. Git requirements

- Use English commit messages.
- Do not add Claude, Anthropic, or another AI tool as a co-author.
- Preserve unrelated user changes.
- Keep data-safety fixes separate from visual polish where possible.
- Do not commit account credentials, generated auth sessions, `.env.local`, or test-user data.
- Do not deploy until the user explicitly requests deployment.

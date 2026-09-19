# iOS keyboard dismissal recovery

2026-09-19: the tester confirmed photo recognition works, but reported that a
bottom gap remains after dismissing the keyboard in the iPhone Home Screen app.
The first scroll-reset patch did not resolve it. The tester narrowed the trigger
to tapping a blank area in the installed Home Screen app. This remains a device
acceptance failure until the new patch passes a physical-device retest.

The authenticated app scrolls inside `.app-content`, while WebKit can also pan
the root document to reveal a focused field. The current hypothesis is that this
root offset survives keyboard dismissal. Related upstream reports include
https://bugs.webkit.org/show_bug.cgi?id=254861 and
https://bugs.webkit.org/show_bug.cgi?id=292603 . These reports establish a browser
failure pattern, not proof of the exact geometry on this user's phone.

The recovery listens only on iOS after a text field receives focus. It resets
document scrolling after blur at bounded animation-settling intervals, or when a
previously shrunken viewport returns to full height while focus remains. It does
not overwrite shell height or top or reset internal page scrolling,
or listen to scroll events. This avoids restoring the earlier viewport-sizing
workaround that caused a launch-time gap. Zoom, rotation, input-to-input focus
and cleanup are covered by regression tests.

The follow-up explicitly blurs text fields when a user taps a noninteractive
blank area. This closes a recovery gap where Safari may retain DOM focus while
dismissing the keyboard. Interactive controls and text selection are excluded.
Recovery checks now extend to 1,200 ms after blur. This is a targeted hypothesis,
not confirmation of the device's underlying WebKit failure.

Staging displays the deployed commit prefix beside its badge. Tapping
`STAGING · <build> · Layout` captures viewport height, scale, offsets, document
scrolling, focused element tag and shell/navigation rectangles before opening a
diagnostic panel. Capture it while the gap is visible and share the report. It
contains no account fields, message text, tokens or input values and sends no
telemetry. The panel is absent in production.

## Preview acceptance

- Confirm the newest Preview deployment is Ready and reload the installed app.
- Check launch before focusing any field: no new gap or cropped content.
- In Coach, open the keyboard, type, dismiss with Done, and repeat five times.
- Repeat by tapping outside the field and switching to Calendar or Settings.
- Scroll a long form, switch between fields and dismiss the keyboard; preserve
  the form's scroll position and keep navigation at the bottom.
- Repeat after background/resume and portrait/landscape rotation.
- Check controls near the bottom remain tappable, not merely visually aligned.

Unit tests simulate viewport events; they do not emulate the physical iOS keyboard.
If the gap remains, collect a screenshot plus the exact dismissal gesture and
whether the same behavior occurs in Safari versus the installed Home Screen app
before changing viewport dimensions again.

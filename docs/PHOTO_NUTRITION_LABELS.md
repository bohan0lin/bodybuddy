# Photo nutrition label priority

Readable package labels take priority over generic food retrieval. The recognition model extracts the printed energy unit and the nutrition column's amount/unit; application code converts kJ to kcal using 4.184 kJ per kcal. Label results bypass retrieval entirely. A per-100-g column is a reference basis, not evidence that the user ate 100 g; the editor shows that basis and asks the user to check values and adjust the amount eaten.

When a label is present but its basis or required nutrition fields cannot be read, recognition returns no items. The existing retake/manual-entry flow handles this case without silently substituting generic values. Multiple label products are rejected rather than summing unrelated reference portions. Ordinary food photos retain visual estimation and compatible catalog calibration.

Regression fixture: the reported bread label contains 1668 kJ, 12 g protein, 46.5 g carbohydrates and 18.2 g fat per 100 g. Expected display is 399 kcal; the generic bread entry (247 kcal, 13/43/3.4 g) must not replace it. Tests cover kcal, serving and volume bases, unreadable and incomplete labels, retrieval fallback, and portion scaling in the editor.

These tests mock model extraction and verify application behavior. They do not prove OCR accuracy on real images. Validate the original photo, a per-serving label and a blurred label in preview before production release. No database migration is required; previously saved incorrect entries need manual correction.

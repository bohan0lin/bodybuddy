# Assistant clarification behavior

Incomplete input is a normal conversation state. The assistant prompt asks for
clarification without tools when intent cannot be established from the message
and conversation history.

A narrow first-message filler check handles a standalone Chinese fragment such
as `就` and hesitation sounds without a model call. It does not classify all
short messages as meaningless: contextual answers, single-character food names
and photos still reach the model. Other unclear text uses model judgment.

A successful model call with no reply and no proposals receives a localized
clarification. If proposals exist, an empty reply becomes a review/confirmation
prompt; actions still require user confirmation.

Actual provider failures remain service failures. They are mapped to public
error codes, and Coach shows an availability message for HTTP 429/503, with a
request reference when available. It no longer appends raw error messages.
Tool loops are not automatically retried because tools may have queued proposals.
The original reported failure was not reproduced against the live provider;
these changes cover the known filler and empty-result paths without claiming
that all provider errors mean the user was unclear.

Regression coverage includes standalone fillers, contextual replies, meaningful
single characters, photos, localized empty output, proposal-only output and
upstream failures without tool-loop retries.

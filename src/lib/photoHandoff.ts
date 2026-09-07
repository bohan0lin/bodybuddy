// In-memory handoff across routes: the home photo tile opens the camera inside the
// user gesture, then parks the File here for /capture to recognize (keeps base64 out of the URL).
let pending: File | null = null

export function peekPendingPhoto(): File | null {
  return pending
}

export function setPendingPhoto(file: File): void {
  pending = file
}

export function takePendingPhoto(): File | null {
  const f = pending
  pending = null
  return f
}

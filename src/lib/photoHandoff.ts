// 跨路由的内存手递：主页「拍照识别」先在用户手势内打开相机/相册，
// 选好图后把 File 暂存这里，导航到 /log 由识别流程取用（避免把 base64 放进 URL）。
let pending: File | null = null

export function setPendingPhoto(file: File): void {
  pending = file
}

export function takePendingPhoto(): File | null {
  const f = pending
  pending = null
  return f
}

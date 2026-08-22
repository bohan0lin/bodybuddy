// 把用户拍/选的图片压缩到合理尺寸并转 base64，减小上传体积与识别成本
export async function fileToResizedBase64(
  file: File,
  maxDim = 1024,
): Promise<{ data: string; mediaType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(new Error('读取图片失败'))
    fr.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('加载图片失败'))
    im.src = dataUrl
  })

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const width = Math.round(img.width * scale)
  const height = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法处理图片')
  ctx.drawImage(img, 0, 0, width, height)

  const out = canvas.toDataURL('image/jpeg', 0.85)
  return { data: out.split(',')[1], mediaType: 'image/jpeg' }
}

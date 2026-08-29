// 零依赖诊断探针
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, node: process.version })
}

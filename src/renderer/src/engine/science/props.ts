export const BASEBALL = { leather: '#fff8e9', shade: '#dedbd1', seam: '#db5b5b', rim: '#8b9b9e' }

/** An illustrative point-mass marker, shared by board, PNG and frozen replay. */
export function paintBaseball(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25)
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip()
  const fill = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.1, 0, 0, radius * 1.2)
  fill.addColorStop(0, '#ffffff'); fill.addColorStop(0.5, BASEBALL.leather); fill.addColorStop(1, BASEBALL.shade)
  ctx.fillStyle = fill; ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
  ctx.strokeStyle = BASEBALL.seam; ctx.lineWidth = Math.max(0.65, radius * 0.075); ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * radius * 0.62, -radius * 0.82)
    ctx.quadraticCurveTo(-side * radius * 0.12, 0, side * radius * 0.62, radius * 0.82); ctx.stroke()
    for (let i = 1; i < 8; i++) {
      const t = i / 8, sx = side * radius * (0.62 * ((1 - t) ** 2 + t ** 2) - 0.24 * t * (1 - t)), sy = radius * (-0.82 + 1.64 * t)
      const a = Math.atan2(1.64, side * (-1.48 + 2.96 * t)) + Math.PI / 2 - 0.25, half = radius * 0.12
      ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * half, sy - Math.sin(a) * half); ctx.lineTo(sx + Math.cos(a) * half, sy + Math.sin(a) * half); ctx.stroke()
    }
  }
  ctx.restore()
  ctx.save(); ctx.strokeStyle = BASEBALL.rim; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
}

/**
 * ฉลองเมื่อทำสิ่งที่ดีกับสุขภาพ เช่น กินยาแล้ว: ชิ้นกระดาษสีและเม็ดยาพุ่งจากกลางจอแล้วหายไปเอง
 * ไม่บังการกด ไม่มีเสียง และไม่ทำงานถ้าผู้ใช้ตั้ง "ลดการเคลื่อนไหว" ไว้
 */
const COLORS = ['#5352C8', '#FFD66B', '#F7A1B4', '#FDDDB9', '#8FDCCB', '#A9A9F2'];

export function celebrate(count = 36): void {
  if (typeof window === 'undefined' || !document.body.animate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:90';
  document.body.appendChild(layer);

  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.55;
  const reach = Math.min(window.innerWidth, 900) * 0.55;
  const animations: Animation[] = [];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    const pill = i % 3 === 0;
    const size = 8 + Math.random() * 8;
    piece.style.cssText = `position:absolute;left:${originX}px;top:${originY}px;width:${pill ? size * 2 : size}px;height:${size}px;border-radius:999px;background:${COLORS[i % COLORS.length]}`;
    layer.appendChild(piece);

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const distance = reach * (0.45 + Math.random() * 0.55);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    animations.push(
      piece.animate(
        [
          { transform: 'translate(0,0) rotate(0deg) scale(.4)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) rotate(${180 + Math.random() * 360}deg) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx * 1.15}px,${dy + 260}px) rotate(${540 + Math.random() * 360}deg) scale(.9)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.16,.8,.3,1)', fill: 'forwards' }
      )
    );
  }

  void Promise.allSettled(animations.map((a) => a.finished)).then(() => layer.remove());
}

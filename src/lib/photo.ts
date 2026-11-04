/** ย่อรูปโปรไฟล์เป็นสี่เหลี่ยมจัตุรัสขนาดเล็ก (ตัดกึ่งกลาง) แล้วคืนเป็น data URL เพื่อเก็บใน localStorage ได้ */
export async function resizeToAvatar(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('load-failed'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * ย่อภาพพื้นหลังบ้าน (แบนเนอร์) เป็นภาพแนวนอนอัตราส่วน 8:3 ตัดกึ่งกลาง แล้วคืนเป็น data URL
 * ขนาดจำกัดไว้ให้เล็กพอเก็บในเครื่องและซิงก์กับเซิร์ฟเวอร์ได้ (ประมาณ 50-120 KB)
 */
export async function resizeToBanner(file: File, width = 960, height = 360): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('load-failed'));
      el.src = url;
    });
    const targetRatio = width / height;
    const srcRatio = img.naturalWidth / img.naturalHeight;
    // ตัดส่วนเกินของภาพต้นฉบับให้ได้อัตราส่วนเท่าแบนเนอร์ (ตัดจากกึ่งกลาง)
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (srcRatio > targetRatio) sw = sh * targetRatio;
    else sh = sw / targetRatio;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

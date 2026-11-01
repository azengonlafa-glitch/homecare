/** คัดลอกข้อความลงคลิปบอร์ด (มีวิธีสำรองเมื่อเบราว์เซอร์ไม่อนุญาต) คืนค่า true เมื่อสำเร็จ */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // เบราว์เซอร์ไม่อนุญาตคลิปบอร์ด: ลองวิธีสำรองด้านล่าง
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

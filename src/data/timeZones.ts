/** เขตเวลาที่ให้เลือกในกิจกรรมปฏิทิน (ค่าเป็นชื่อ IANA) */
export const TIME_ZONE_OPTIONS = [
  { value: 'Asia/Bangkok', label: 'ประเทศไทย (UTC+7)' },
  { value: 'Asia/Singapore', label: 'สิงคโปร์ / มาเลเซีย (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'ญี่ปุ่น / เกาหลี (UTC+9)' },
  { value: 'Australia/Sydney', label: 'ออสเตรเลีย ซิดนีย์ (UTC+10/+11)' },
  { value: 'Europe/London', label: 'สหราชอาณาจักร (UTC+0/+1)' },
  { value: 'Europe/Berlin', label: 'ยุโรปกลาง (UTC+1/+2)' },
  { value: 'America/New_York', label: 'สหรัฐฯ ฝั่งตะวันออก (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'สหรัฐฯ ฝั่งตะวันตก (UTC-8/-7)' },
];

export const DEFAULT_TIME_ZONE = 'Asia/Bangkok';

export const timeZoneLabel = (value: string) =>
  TIME_ZONE_OPTIONS.find((t) => t.value === value)?.label ?? value;

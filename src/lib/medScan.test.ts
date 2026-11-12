import { describe, expect, it } from 'vitest';
import { hasScanData, normalizeOcr, parseLabelText } from './medScan';

describe('normalizeOcr', () => {
  it('ตัดวรรณยุกต์และช่องว่าง เลขไทยเป็นอารบิก', () => {
    expect(normalizeOcr('ครั้ง ละ ๑ เม็ด')).toBe('ครงละ1เมด');
    expect(normalizeOcr('ก่อนอาหาร')).toBe(normalizeOcr('กอนอาหาร'));
  });
});

describe('parseLabelText: ซองยาไทย', () => {
  it('ฉลากโรงพยาบาลทั่วไป', () => {
    const r = parseLabelText(`โรงพยาบาลตัวอย่าง
AMLODIPINE 5 MG
รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง
หลังอาหาร เช้า
จำนวน 30 เม็ด`);
    expect(r.drug?.id).toBe('amlodipine');
    expect(r.name).toBe('Amlodipine 5 mg');
    expect(r.perDose).toBe(1);
    expect(r.unit).toBe('เม็ด');
    expect(r.periods).toEqual(['morning']);
    expect(r.meal).toBe('after');
    expect(r.quantity).toBe(30);
  });

  it('ทนผลอ่านที่เพี้ยน: เว้นวรรคทุกตัว วรรณยุกต์หาย เลขไทย', () => {
    const r = parseLabelText('Metformin 500 mg\nครง ละ ๑ เมด\nหลง อาหาร เชา เยน\nจานวน 60');
    expect(r.drug?.id).toBe('metformin');
    expect(r.perDose).toBe(1);
    expect(r.unit).toBe('เม็ด');
    expect(r.periods).toEqual(['morning', 'evening']);
    expect(r.meal).toBe('after');
  });

  it('ครึ่งเม็ด และวันละ 3 ครั้งเมื่อไม่ได้ระบุช่วงเวลา', () => {
    const r = parseLabelText('ครั้งละ ครึ่ง เม็ด วันละ 3 ครั้ง ก่อนอาหาร');
    expect(r.perDose).toBe(0.5);
    expect(r.periods).toEqual(['morning', 'noon', 'evening']);
    expect(r.meal).toBe('before');
  });

  it('ยาใช้เมื่อมีอาการ', () => {
    const r = parseLabelText('PARACETAMOL 500 MG\nรับประทานครั้งละ 1-2 เม็ด ทุก 4-6 ชั่วโมง เวลาปวดหรือมีไข้');
    expect(r.drug?.id).toBe('paracetamol');
    expect(r.asNeeded).toBe(true);
    expect(r.perDose).toBe(1);
  });

  it('ยาที่ไม่มีในฐานข้อมูล ใช้ชื่อภาษาอังกฤษบนฉลาก', () => {
    const r = parseLabelText('BISOPROLOL FUMARATE 2.5 MG\nครั้งละ 1 เม็ด เช้า');
    expect(r.drug).toBeUndefined();
    expect(r.name).toBe('Bisoprolol fumarate 2.5 mg');
  });
});

describe('parseLabelText: ฉลากภาษาอังกฤษ', () => {
  it('take 2 tablets twice a day after meals', () => {
    const r = parseLabelText('Ibuprofen 400 mg\nTake 2 tablets twice a day after meals\n#20');
    expect(r.drug?.id).toBe('ibuprofen');
    expect(r.perDose).toBe(2);
    expect(r.unit).toBe('เม็ด');
    expect(r.periods).toEqual(['morning', 'evening']);
    expect(r.meal).toBe('after');
    expect(r.quantity).toBe(20);
  });

  it('ตัวย่อ TID / PRN', () => {
    expect(parseLabelText('1 cap TID').periods).toEqual(['morning', 'noon', 'evening']);
    expect(parseLabelText('1 tab PRN').asNeeded).toBe(true);
  });
});

describe('hasScanData', () => {
  it('ไม่มีอะไรที่อ่านได้ = false', () => {
    expect(hasScanData(parseLabelText('ขอให้หายไว ๆ'))).toBe(false);
  });
});

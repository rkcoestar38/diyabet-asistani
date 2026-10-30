import { toCsv } from '../files';

jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));

describe('CSV cell safety', () => {
  it.each(['=1+2', '+SUM(A1)', '-SUM(A1)', '@SUM(A1)', '\t=1+2', '\r=1+2'])('exports formula-like user text as text %p', (note) => {
    const csv = toCsv([{ id: 'synthetic', time: 1700000000000, note }]);
    expect(csv).toContain(`'${note}`);
  });
  it('preserves real numeric measurements, including signed correction values and decimal commas', () => {
    const csv = toCsv([{ id: 'synthetic', time: 1700000000000, bg: 100, carbs: 12.5, bolus: 1.5, note: 'Normal; "text"' }]);
    expect(csv).toContain(';100;');
    expect(csv).toContain(';12,5;1,5;');
    expect(csv).toContain('"Normal; ""text"""');
    expect(csv).not.toContain("'12,5");
  });
});

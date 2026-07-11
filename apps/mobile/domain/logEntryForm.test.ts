import { itemRowTotal, itemsGrandTotal, validateLogEntryFields, buildLogItemsData } from './logEntryForm';

describe('logEntryForm', () => {
  describe('itemRowTotal / itemsGrandTotal', () => {
    it('multiplies quantity by unit cost, null when incomputable', () => {
      expect(itemRowTotal({ quantity: '2', unitCost: '10.5' })).toBe('21.00');
      expect(itemRowTotal({ quantity: '', unitCost: '10' })).toBeNull();
    });
    it('sums the computable rows, null when none compute', () => {
      expect(itemsGrandTotal([{ quantity: '2', unitCost: '10' }, { quantity: '1', unitCost: '5' }])).toBe('25.00');
      expect(itemsGrandTotal([{ quantity: '', unitCost: '' }])).toBeNull();
    });
  });

  describe('validateLogEntryFields', () => {
    const ok = { typeId: 'SERVICE', title: 'Oil', date: '2026-06-01', mileage: '4200' };
    it('passes a complete entry', () => {
      expect(validateLogEntryFields(ok)).toEqual({});
    });
    it('flags each missing/invalid field', () => {
      expect(validateLogEntryFields({ ...ok, typeId: '' }).typeId).toBe('Select a type');
      expect(validateLogEntryFields({ ...ok, title: '  ' }).title).toBe('Title is required');
      expect(validateLogEntryFields({ ...ok, title: 'x'.repeat(101) }).title).toMatch(/100 characters/);
      expect(validateLogEntryFields({ ...ok, date: '' }).date).toBe('Date is required');
      expect(validateLogEntryFields({ ...ok, mileage: '' }).mileage).toBe('Mileage is required');
      expect(validateLogEntryFields({ ...ok, mileage: 'abc' }).mileage).toBe('Enter a valid mileage');
    });
    it('accepts mileage with thousands commas', () => {
      expect(validateLogEntryFields({ ...ok, mileage: '12,500' })).toEqual({});
    });
  });

  describe('buildLogItemsData', () => {
    it('drops blank rows and numbers the amounts', () => {
      expect(
        buildLogItemsData([
          { categoryId: 'PART', description: ' Filter ', quantity: '2', unitCost: '5' },
          { categoryId: 'LABOR', description: '   ', quantity: '1', unitCost: '9' },
          { categoryId: 'PART', description: 'Oil', quantity: '', unitCost: '' },
        ]),
      ).toEqual([
        { categoryId: 'PART', description: 'Filter', quantity: 2, unitCost: 5 },
        { categoryId: 'PART', description: 'Oil', quantity: null, unitCost: null },
      ]);
    });
  });
});

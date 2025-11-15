import {
	countCheckboxes,
	generateProgressText
} from '../src/checkbox-counter';

jest.mock('obsidian', () => ({
	App: jest.fn().mockImplementation()
}));

describe('Checkbox Counter', () => {
	describe('countCheckboxes', () => {
		it('should count unchecked checkboxes', () => {
			const content = `## Header
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`;
			
			const stats = countCheckboxes(content);
			expect(stats.completed).toBe(0);
			expect(stats.total).toBe(3);
		});

		it('should count checked checkboxes', () => {
			const content = `## Header
- [x] Task 1
- [x] Task 2
- [x] Task 3`;
			
			const stats = countCheckboxes(content);
			expect(stats.completed).toBe(3);
			expect(stats.total).toBe(3);
		});

		it('should count mixed checkboxes', () => {
			const content = `## Header
- [x] Task 1
- [ ] Task 2
- [x] Task 3
- [ ] Task 4`;
			
			const stats = countCheckboxes(content);
			expect(stats.completed).toBe(2);
			expect(stats.total).toBe(4);
		});

		it('should ignore non-checkbox lines', () => {
			const content = `## Header
Some text
- Regular list item
- [x] Task 1
- [ ] Task 2`;
			
			const stats = countCheckboxes(content);
			expect(stats.completed).toBe(1);
			expect(stats.total).toBe(2);
		});

		it('should handle empty content', () => {
			const content = '';
			const stats = countCheckboxes(content);
			expect(stats.completed).toBe(0);
			expect(stats.total).toBe(0);
		});
	});

	describe('generateProgressText', () => {
		it('should generate correct progress text', () => {
			const stats = {completed: 2, total: 5};
			const text = generateProgressText(stats);
			expect(text).toBe('**Progress:** 2/5 (40%)');
		});

		it('should handle 0% completion', () => {
			const stats = {completed: 0, total: 5};
			const text = generateProgressText(stats);
			expect(text).toBe('**Progress:** 0/5 (0%)');
		});

		it('should handle 100% completion', () => {
			const stats = {completed: 5, total: 5};
			const text = generateProgressText(stats);
			expect(text).toBe('**Progress:** 5/5 (100%)');
		});

		it('should handle no tasks', () => {
			const stats = {completed: 0, total: 0};
			const text = generateProgressText(stats);
			expect(text).toBe('**Progress:** 0/0 (0%)');
		});
	});
});

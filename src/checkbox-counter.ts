import {Vault} from 'obsidian';
import {TODO_PREFIX, TODO_DONE_PREFIX} from './constants';

export interface CheckboxStats {
	completed: number;
	total: number;
}

/**
 * Counts checkboxes in file content
 */
export function countCheckboxes(content: string): CheckboxStats {
	const lines = content.split('\n');
	let completed = 0;
	let total = 0;

	for (const line of lines) {
		if (line.trim().startsWith(TODO_PREFIX)) {
			total++;
		} else if (line.trim().startsWith(TODO_DONE_PREFIX)) {
			total++;
			completed++;
		}
	}

	return {completed, total};
}

/**
 * Generates the progress text to display
 */
export function generateProgressText(stats: CheckboxStats): string {
	const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
	return `**Progress:** ${stats.completed}/${stats.total} (${percentage}%)`;
}

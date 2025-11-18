import {App, Editor, Plugin, PluginSettingTab, Setting, moment, Notice} from 'obsidian';
import WeekPlannerFile, {
	extendFileName,
	getInboxFileName,
	getDayFileName,
	getWeekFileName,
	getTomorrowDate,
	getYesterdayDate,
	getNextWorkingDay,
	isValidWorkingDaysString, getDateFromFilename
} from "./src/file";
import {TODO_DONE_PREFIX, TODO_PREFIX} from "./src/constants";
import {getCalendarWeek} from "./src/date";
import {TodoModal} from "./src/todo-modal";
import {DEFAULT_SETTINGS, WeekPlannerPluginSettings} from "./src/settings";

// noinspection JSUnusedGlobalSymbols
export default class WeekPlannerPlugin extends Plugin {
	settings: WeekPlannerPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "add-todo",
			name: "Add Todo",
			callback: () => {
				new TodoModal(this.app, 'Create Task', 'Create', '', (task: string, list: string, date: Date) => {
					if (list == 'inbox') {
						this.insertIntoInbox(TODO_PREFIX + task)
					} else if (list == 'tomorrow') {
						this.insertIntoTomorrow(TODO_PREFIX + task)
					} else if (list == 'target-date') {
						this.insertIntoTargetDate(date, TODO_PREFIX + task)
					}
				}).open();
			},
		});

		this.addCommand({
			id: 'week-planner-inbox',
			name: 'Show Inbox',
			callback: () => this.createInbox(),
			hotkeys: []
		});

		this.addCommand({
			id: 'week-planner-week',
			name: 'Show Week',
			callback: () => this.createWeek(),
			hotkeys: []
		});

		this.addCommand({
			id: 'week-planner-today',
			name: 'Show Today',
			callback: () => this.createToday(),
			hotkeys: []
		});

		this.addCommand({
			id: 'week-planner-yesterday',
			name: 'Show Yesterday',
			callback: () => this.createYesterday(),
			hotkeys: []
		});

		this.addCommand({
			id: 'week-planner-tomorrow',
			name: 'Show Tomorrow',
			callback: () => this.createTomorrow(),
			hotkeys: []
		});

		this.addCommand({
			id: 'move-task',
			name: 'Move Task',
			editorCallback: (editor: Editor) => {
				this.moveTask(editor)
			}
		});

		this.addCommand({
			id: 'move-to-inbox',
			name: 'Move to Inbox',
			editorCallback: (editor: Editor) => {
				this.moveTaskToInbox(editor)
			}
		});

		this.addCommand({
			id: 'move-anywhere',
			name: 'Move anywhere',
			editorCallback: (editor: Editor) => {
				this.moveAnywhere(editor)
			}
		})

		this.addCommand({
			id: 'sync-week-to-days',
			name: 'Sync Week Tasks to Days',
			callback: async () => {
				await this.syncWeekToDays();
			}
		});

		this.addCommand({
			id: 'update-weekly-summary',
			name: 'Update Weekly Summary',
			callback: async () => {
				await this.updateWeeklySummary();
			}
		});

		this.addSettingTab(new WeekPlannerSettingTab(this.app, this));
	}

	async insertIntoTargetDate(date: Date, todo: string) {
		let today = new WeekPlannerFile(this.settings, this.app.vault, getDayFileName(this.settings, date));
		await today.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox')
		await today.insertAt(todo, 1)
	}

	async insertIntoInbox(todo: string) {
		let inbox = new WeekPlannerFile(this.settings, this.app.vault, getInboxFileName(this.settings));
		await inbox.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox')
		await inbox.insertAt(todo, 1)
	}

	async insertIntoTomorrow(todo: string) {
		let tomorrow = getTomorrowDate(this.settings.workingDays)
		let dest = new WeekPlannerFile(this.settings, this.app.vault, getDayFileName(this.settings, tomorrow));
		await dest.createIfNotExists(this.app.vault, this.app.workspace, 'Inbox')
		await dest.insertAt(todo, 1)
	}

	async createInbox() {
		let file = new WeekPlannerFile(this.settings, this.app.vault, getInboxFileName(this.settings));
		await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox')
	}

	async createWeek() {
		const m = moment()
		let weekFile = new WeekPlannerFile(this.settings, this.app.vault, getWeekFileName(this.settings, m));
		await weekFile.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Goals of Week ' + getCalendarWeek(m))
	}

	async createToday() {
		let date = new Date()
		let file = new WeekPlannerFile(this.settings, this.app.vault, getDayFileName(this.settings, date));
		await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox')
	}

	async createTomorrow() {
		let date = getTomorrowDate(this.settings.workingDays)
		let file = new WeekPlannerFile(this.settings, this.app.vault, getDayFileName(this.settings, date));
		await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox')
	}

	async createYesterday() {
		let date = getYesterdayDate()
		let file = new WeekPlannerFile(this.settings, this.app.vault, getDayFileName(this.settings, date));
		await file.createIfNotExistsAndOpen(this.app.vault, this.app.workspace, 'Inbox')
	}

	async moveTask(editor: Editor) {
		let sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name)
		let source = new WeekPlannerFile(this.settings, this.app.vault, sourceFileName);

		let destFileName: string
		if (source.isInbox() || source.isYesterday()) {
			// Inbox and yesterday's todos are move to today
			destFileName = getDayFileName(this.settings, getNextWorkingDay(this.settings.workingDays))
		} else {
			// All other todos are move to the next working day following the day represented by the current file
			let dateFromFilename = getDateFromFilename(source.fullFileName);
			destFileName = getDayFileName(this.settings, getTomorrowDate(this.settings.workingDays, dateFromFilename))
		}

		// Consider to move files from the past also to today

		let dest = new WeekPlannerFile(this.settings, this.app.vault, destFileName);
		await this.move(editor, source, dest, 'Inbox')
	}

	async move(editor: Editor, source: WeekPlannerFile, dest: WeekPlannerFile, header: string) {
		await dest.createIfNotExists(this.app.vault, this.app.workspace, header)
		const line = editor.getCursor().line
		let todo = editor.getLine(line)
		if (todo.startsWith(TODO_PREFIX) || todo.startsWith(TODO_DONE_PREFIX)) {
			await dest.insertAt(todo, 1)
			await source.deleteLine(line, todo, editor)
		}
	}

	async moveTaskToInbox(editor: Editor) {
		let sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name)
		let source = new WeekPlannerFile(this.settings, this.app.vault, sourceFileName);
		let dest = new WeekPlannerFile(this.settings, this.app.vault, getInboxFileName(this.settings));
		await this.move(editor, source, dest, 'Inbox')
	}

	async moveAnywhere(editor: Editor) {
		const line = editor.getCursor().line
		let todo = editor.getLine(line)
		if (todo.startsWith(TODO_PREFIX) || todo.startsWith(TODO_DONE_PREFIX)) {
			todo = todo.substring(TODO_PREFIX.length, todo.length)
			new TodoModal(this.app, 'Move Task', 'Move', todo, (task: string, list: string, date: Date) => {
				const sourceFileName = extendFileName(this.settings, this.app.workspace.getActiveFile()?.name)
				const source = new WeekPlannerFile(this.settings, this.app.vault, sourceFileName);

				if (list == 'inbox') {
					this.moveTaskToInbox(editor)
				} else if (list == 'tomorrow') {
					const tomorrow = getTomorrowDate(this.settings.workingDays)
					const dest = new WeekPlannerFile(this.settings, this.app.vault, getDayFileName(this.settings, tomorrow));
					this.move(editor, source, dest, 'Inbox')
				} else if (list == 'target-date') {
					const dest = new WeekPlannerFile(this.settings, this.app.vault, getDayFileName(this.settings, date));
					this.move(editor, source, dest, 'Inbox')
				}
			}).open();
		}
	}

	async syncWeekToDays() {
		const m = moment();
		const weekFileName = getWeekFileName(this.settings, m);
		
		try {
			const weekContent = await this.app.vault.adapter.read(weekFileName);
			
			// First, remove tasks from days that are no longer in week
			await this.removeDeletedTasksFromDays(weekContent, m, weekFileName);
			
			// Then process and add/update tasks
			const result = await this.processWeekTasks(weekContent, m);
			
			// Update week file with progress
			await this.updateWeekProgress(m);
			
			// Show summary notification
			if (result.ignored.length > 0) {
				new Notice(`⚠️ ${result.ignored.length} task(s) ignored due to invalid syntax:\n${result.ignored.join('\n')}`, 8000);
			}
			if (result.processed > 0) {
				new Notice(`✅ Processed ${result.processed} task(s) successfully`);
			}
		} catch (error) {
			console.error('Error syncing week to days:', error);
			new Notice('❌ Error syncing week to days. Check console for details.');
		}
	}

	async removeDeletedTasksFromDays(weekContent: string, weekMoment: moment.Moment, weekFileName: string) {
		// Extract all tasks from week file
		const weekTasks = new Set<string>();
		const lines = weekContent.split('\n');
		
		for (const line of lines) {
			if (line.trim().startsWith(TODO_PREFIX) || line.trim().startsWith(TODO_DONE_PREFIX)) {
				const taskText = line.trim().replace(TODO_PREFIX, '').replace(TODO_DONE_PREFIX, '').trim();
				const taskName = this.extractTaskName(taskText);
				if (taskName) {
					weekTasks.add(taskName);
				}
			}
		}
		
		// Check each day file and remove tasks not in week
		for (let i = 1; i <= 7; i++) {
			const dayDate = this.getDayOfWeek(weekMoment, i);
			const dayFileName = getDayFileName(this.settings, dayDate);
			
			try {
				const dayContent = await this.app.vault.adapter.read(dayFileName);
				const dayLines = dayContent.split('\n');
				const newLines: string[] = [];
				
				for (const line of dayLines) {
					if (line.trim().startsWith(TODO_PREFIX) || line.trim().startsWith(TODO_DONE_PREFIX)) {
						const taskText = line.trim().replace(TODO_PREFIX, '').replace(TODO_DONE_PREFIX, '').trim();
						// Keep task if it's in the week file
						if (weekTasks.has(taskText)) {
							newLines.push(line);
						}
						// Otherwise, skip it (delete it)
					} else {
						newLines.push(line);
					}
				}
				
				await this.app.vault.adapter.write(dayFileName, newLines.join('\n'));
			} catch (error) {
				// Day file doesn't exist, skip
			}
		}
	}

	extractTaskName(taskText: string): string | null {
		// Extract task name from various formats
		const shiftDayMatch = taskText.match(/^(.+?)\s-\s#(morning|afternoon|night)\s-\s#(\d)$/i);
		const shiftOnlyMatch = taskText.match(/^(.+?)\s-\s#(morning|afternoon|night)$/i);
		const dayOnlyMatch = taskText.match(/^(.+?)\s-\s#(\d)$/);
		
		if (shiftDayMatch) return shiftDayMatch[1].trim();
		if (shiftOnlyMatch) return shiftOnlyMatch[1].trim();
		if (dayOnlyMatch) return dayOnlyMatch[1].trim();
		if (!taskText.includes(' - ')) return taskText;
		
		return null;
	}

	generateProgressBar(percentage: number, width: number = 20): string {
		const barWidth = Math.min(percentage, 100); // Ensure max is 100%
		
		// Color gradient based on percentage
		let barColor = '#ef4444'; // red for low
		if (percentage >= 80) {
			barColor = '#22c55e'; // green for high
		} else if (percentage >= 50) {
			barColor = '#eab308'; // yellow for medium
		}
		
		return `<div style="width: 100%; background: #f1f5f9; border-radius: 8px; height: 24px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
	<div style="width: ${barWidth}%; background: linear-gradient(90deg, ${barColor}, ${this.adjustColor(barColor, 20)}); height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; transition: width 0.3s ease; box-shadow: inset 0 1px 2px rgba(255,255,255,0.3);">
		<span style="color: ${percentage > 10 ? 'white' : '#64748b'}; font-weight: 600; font-size: 12px; ${percentage <= 10 ? 'margin-left: 8px;' : ''}">${percentage}%</span>
	</div>
</div>`;
	}

	adjustColor(color: string, amount: number): string {
		// Simple color adjustment for gradient
		const num = parseInt(color.replace('#', ''), 16);
		const r = Math.min(255, Math.max(0, (num >> 16) + amount));
		const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
		const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
		return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
	}

	generateChart(data: Array<{week: string, tasks: number, avgPerDay: number, successRate: number}>): string[] {
		if (data.length === 0) return [];

		// Find max values - avgPerDay uses its own scale for better visibility
		const maxAvg = Math.max(...data.map(d => d.avgPerDay), 1);
		
		// Use 100 (for percentage) as the scale for success rate
		const maxValue = 100;
		
		const chartHeight = 300;
		const chartWidth = data.length * 40; // 40px per week
		const padding = 40;

		const chart: string[] = [];
		
		// Container with horizontal scroll
		chart.push('<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin: 20px 0; overflow-x: auto;">');
		
		// Legend
		chart.push('<div style="display: flex; gap: 20px; margin-bottom: 20px; justify-content: center; flex-wrap: wrap;">');
		chart.push('<div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); padding: 8px 16px; border-radius: 20px; backdrop-filter: blur(10px);">');
		chart.push('<div style="width: 20px; height: 3px; background: #60a5fa; border-radius: 2px;"></div>');
		chart.push('<span style="color: white; font-weight: 600; font-size: 13px;">Avg Tasks/Day (normalized)</span>');
		chart.push('</div>');
		chart.push('<div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); padding: 8px 16px; border-radius: 20px; backdrop-filter: blur(10px);">');
		chart.push('<div style="width: 20px; height: 3px; background: #f59e0b; border-radius: 2px;"></div>');
		chart.push('<span style="color: white; font-weight: 600; font-size: 13px;">Success Rate % (0-100)</span>');
		chart.push('</div>');
		chart.push('</div>');
		
		// Scale explanation
		chart.push('<div style="text-align: center; color: rgba(255,255,255,0.9); font-size: 12px; margin-bottom: 15px; font-style: italic;">');
		chart.push(`Avg/Day: normalized (0-${maxAvg.toFixed(1)}) | Success: 0-100%`);
		chart.push('</div>');

		// SVG Chart container
		chart.push('<div style="background: white; border-radius: 8px; padding: 30px 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); min-width: fit-content;">');
		chart.push(`<svg width="${chartWidth + padding * 2}" height="${chartHeight + padding * 2}" style="display: block;">`);
		
		// Draw grid lines
		for (let i = 0; i <= 4; i++) {
			const y = padding + (chartHeight / 4) * i;
			chart.push(`<line x1="${padding}" y1="${y}" x2="${chartWidth + padding}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`);
		}

		// Draw axes
		chart.push(`<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${chartHeight + padding}" stroke="#374151" stroke-width="2" />`);
		chart.push(`<line x1="${padding}" y1="${chartHeight + padding}" x2="${chartWidth + padding}" y2="${chartHeight + padding}" stroke="#374151" stroke-width="2" />`);

		// Calculate points for lines
		const avgPoints: string[] = [];
		const successPoints: string[] = [];

		data.forEach((row, i) => {
			const x = padding + (i * 40) + 20;
			
			// AvgPerDay is normalized to its own range (0-maxAvg mapped to 0-chartHeight)
			// Success uses absolute scale (0-100)
			const avgY = padding + chartHeight - (row.avgPerDay / maxAvg * chartHeight); // Normalized!
			const successY = padding + chartHeight - ((row.successRate * 100) / maxValue * chartHeight);

			avgPoints.push(`${x},${avgY}`);
			successPoints.push(`${x},${successY}`);

			// Draw data points (circles) - only avg and success
			chart.push(`<circle cx="${x}" cy="${avgY}" r="4" fill="#60a5fa" stroke="white" stroke-width="2" />`);
			chart.push(`<circle cx="${x}" cy="${successY}" r="4" fill="#f59e0b" stroke="white" stroke-width="2" />`);

			// Week labels
			const weekLabel = row.week.split('-W')[1] || row.week;
			chart.push(`<text x="${x}" y="${chartHeight + padding + 20}" text-anchor="middle" font-size="10" fill="#6b7280" font-weight="500">W${weekLabel}</text>`);
			
			// Hover tooltips
			chart.push(`<title>Week ${row.week}
Avg/Day: ${row.avgPerDay}
Success: ${(row.successRate * 100).toFixed(1)}%</title>`);
		});

		// Draw lines connecting points - only avg and success
		chart.push(`<polyline points="${avgPoints.join(' ')}" fill="none" stroke="#60a5fa" stroke-width="3" stroke-linejoin="round" />`);
		chart.push(`<polyline points="${successPoints.join(' ')}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round" />`);

		// Y-axis labels with actual values
		const yAxisSteps = 5;
		for (let i = 0; i <= yAxisSteps; i++) {
			const value = (maxValue / yAxisSteps * i).toFixed(0);
			const y = padding + chartHeight - (chartHeight / yAxisSteps * i);
			chart.push(`<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280" font-weight="500">${value}</text>`);
		}

		chart.push('</svg>');
		
		// Stats summary below chart
		chart.push('<div style="display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap; justify-content: center;">');
		const avgSuccess = ((data.reduce((sum, d) => sum + d.successRate, 0) / data.length) * 100).toFixed(1);
		const avgTasksPerDay = (data.reduce((sum, d) => sum + d.avgPerDay, 0) / data.length).toFixed(1);
		
		chart.push(`<div style="background: #eff6ff; padding: 12px 20px; border-radius: 8px; border-left: 4px solid #60a5fa;">
			<div style="font-size: 11px; color: #1e40af; font-weight: 600; margin-bottom: 4px;">AVG PER DAY</div>
			<div style="font-size: 20px; color: #2563eb; font-weight: 700;">${avgTasksPerDay}</div>
		</div>`);
		
		chart.push(`<div style="background: #fffbeb; padding: 12px 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
			<div style="font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 4px;">AVG SUCCESS</div>
			<div style="font-size: 20px; color: #d97706; font-weight: 700;">${avgSuccess}%</div>
		</div>`);
		
		chart.push('</div>');
		
		chart.push('</div>'); // End chart container
		chart.push('</div>'); // End main container

		return chart;
	}

	async updateWeekProgress(weekMoment: moment.Moment) {
		const weekFileName = getWeekFileName(this.settings, weekMoment);
		const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
		const dailyStats: {day: string, completed: number, total: number, percentage: number}[] = [];
		const taskAttendance: Map<string, {completed: number, total: number}> = new Map();
		
		let totalTasks = 0;
		let completedTasks = 0;
		
		// Count tasks from all days of the week
		for (let i = 1; i <= 7; i++) {
			const dayDate = this.getDayOfWeek(weekMoment, i);
			const dayFileName = getDayFileName(this.settings, dayDate);
			let dayCompleted = 0;
			let dayTotal = 0;
			
			try {
				const dayContent = await this.app.vault.adapter.read(dayFileName);
				const lines = dayContent.split('\n');
				
				for (const line of lines) {
					if (line.trim().startsWith(TODO_PREFIX)) {
						totalTasks++;
						dayTotal++;
						
						// Track task attendance
						const taskName = line.trim().replace(TODO_PREFIX, '').trim();
						if (!taskAttendance.has(taskName)) {
							taskAttendance.set(taskName, {completed: 0, total: 0});
						}
						const stats = taskAttendance.get(taskName)!;
						stats.total++;
					} else if (line.trim().startsWith(TODO_DONE_PREFIX)) {
						totalTasks++;
						completedTasks++;
						dayTotal++;
						dayCompleted++;
						
						// Track task attendance
						const taskName = line.trim().replace(TODO_DONE_PREFIX, '').trim();
						if (!taskAttendance.has(taskName)) {
							taskAttendance.set(taskName, {completed: 0, total: 0});
						}
						const stats = taskAttendance.get(taskName)!;
						stats.total++;
						stats.completed++;
					}
				}
			} catch (error) {
				// Day file doesn't exist, skip
			}
			
			// Store daily stats
			const dayPercentage = dayTotal > 0 ? Math.round((dayCompleted / dayTotal) * 100) : 0;
			dailyStats.push({
				day: dayNames[i - 1],
				completed: dayCompleted,
				total: dayTotal,
				percentage: dayPercentage
			});
		}
		
		// Sort task attendance by completion rate (lowest to highest)
		const sortedAttendance = Array.from(taskAttendance.entries())
			.map(([task, stats]) => ({
				task,
				completed: stats.completed,
				total: stats.total,
				percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
			}))
			.sort((a, b) => a.percentage - b.percentage);
		
		// Build progress report with HTML styling
		const weekContent = await this.app.vault.adapter.read(weekFileName);
		const lines = weekContent.split('\n');
		const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
		
		const progressReport = [
			'',
			'---',
			'',
			'## 📊 Week Progress',
			'',
			'<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin: 10px 0;">',
			`<div style="font-size: 18px; font-weight: 600; margin-bottom: 15px;">Overall Progress: ${completedTasks}/${totalTasks} tasks</div>`,
			this.generateProgressBar(percentage),
			'</div>',
			'',
			'### 📅 Daily Summary',
			'',
			'<div style="display: grid; gap: 12px; margin: 15px 0;">'
		];
		
		// Add daily progress with enhanced styling
		for (const dayStat of dailyStats) {
			if (dayStat.total > 0) {
				progressReport.push(`<div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`);
				progressReport.push(`<div style="font-weight: 600; color: #1e293b; margin-bottom: 8px; font-size: 14px;">${dayStat.day}: ${dayStat.completed}/${dayStat.total}</div>`);
				progressReport.push(this.generateProgressBar(dayStat.percentage));
				progressReport.push('</div>');
			}
		}
		
		progressReport.push('</div>');
		
		// Add task attendance ranking with enhanced styling
		if (sortedAttendance.length > 0) {
			progressReport.push('');
			progressReport.push('### 🎯 Task Attendance');
			progressReport.push('*Ordered from lowest to highest completion rate*');
			progressReport.push('');
			progressReport.push('<div style="display: grid; gap: 10px; margin: 15px 0;">');
			
			for (const taskStat of sortedAttendance) {
				// Color code based on attendance
				let borderColor = '#ef4444'; // red
				if (taskStat.percentage >= 80) {
					borderColor = '#22c55e'; // green
				} else if (taskStat.percentage >= 50) {
					borderColor = '#eab308'; // yellow
				}
				
				progressReport.push(`<div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid ${borderColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`);
				progressReport.push(`<div style="font-weight: 500; color: #334155; margin-bottom: 6px; font-size: 13px;">${taskStat.task}: ${taskStat.completed}/${taskStat.total}</div>`);
				progressReport.push(this.generateProgressBar(taskStat.percentage));
				progressReport.push('</div>');
			}
			
			progressReport.push('</div>');
		}
		
		// Remove old progress section if exists
		const progressStartIndex = lines.findIndex(line => 
			line.includes('📊 Week Progress') || line.includes('**Week Progress:**') || line.includes('**Overall:**')
		);
		
		if (progressStartIndex !== -1) {
			// Find the start of the progress section (look for separator or section header before it)
			let sectionStart = progressStartIndex;
			for (let i = progressStartIndex - 1; i >= 0; i--) {
				if (lines[i].trim() === '---') {
					// Check if this is the separator before the progress section
					if (i + 2 < lines.length && lines[i + 2].includes('📊')) {
						sectionStart = i;
						break;
					}
				} else if (lines[i].trim().startsWith('##') && lines[i].includes('📊')) {
					sectionStart = i;
					break;
				}
			}
			
			// Remove only the progress section (from sectionStart to end of file)
			lines.splice(sectionStart);
		}
		
		// Add progress report at the end, preserving tasks
		const newContent = lines.join('\n').trimEnd() + '\n' + progressReport.join('\n') + '\n';
		await this.app.vault.adapter.write(weekFileName, newContent);
	}

	async processWeekTasks(weekContent: string, weekMoment: moment.Moment): Promise<{processed: number, ignored: string[]}> {
		const lines = weekContent.split('\n');
		const weekFileName = getWeekFileName(this.settings, weekMoment);
		let processed = 0;
		const ignored: string[] = [];
		
		for (const line of lines) {
			if (line.trim().startsWith(TODO_PREFIX) || line.trim().startsWith(TODO_DONE_PREFIX)) {
				const task = line.trim();
				const taskText = task.replace(TODO_PREFIX, '').replace(TODO_DONE_PREFIX, '').trim();
				
				// Valid patterns:
				// 1. "task name - #morning/#afternoon/#night - #days" (with shift and multiple/single days)
				// 2. "task name - #morning/#afternoon/#night" (with shift for all working days)
				// 3. "task name - #days" (multiple/single days without shift)
				// 4. "task name" (all working days without shift)
				
				// Pattern for shift + days: supports single (#1), multiple (#1,3,5), or ranges (#2-5)
				const shiftDayMatch = taskText.match(/^(.+?)\s-\s#(morning|afternoon|night)\s-\s#([\d,\-]+)$/i);
				const shiftOnlyMatch = taskText.match(/^(.+?)\s-\s#(morning|afternoon|night)$/i);
				const dayOnlyMatch = taskText.match(/^(.+?)\s-\s#([\d,\-]+)$/);
				const noPatternMatch = !taskText.includes(' - ');
				
				if (shiftDayMatch) {
					// Task with shift and specific days: "caminhar - #morning - #1,3,5"
					const taskName = shiftDayMatch[1].trim();
					const shift = shiftDayMatch[2].toLowerCase();
					const daysStr = shiftDayMatch[3];
					const days = this.parseDays(daysStr);
					
					if (days.length > 0) {
						for (const dayNum of days) {
							if (dayNum >= 1 && dayNum <= 7) {
								const dayDate = this.getDayOfWeek(weekMoment, dayNum);
								await this.addTaskToDay(dayDate, taskName, weekFileName, shift);
							}
						}
						processed++;
					} else {
						ignored.push(`"${taskText}" - invalid day format (use #1, #1,3,5, or #2-5)`);
					}
				} else if (shiftOnlyMatch) {
					// Task with shift for all working days: "exercícios - #morning"
					const taskName = shiftOnlyMatch[1].trim();
					const shift = shiftOnlyMatch[2].toLowerCase();
					
					for (let i = 1; i <= 7; i++) {
						const dayDate = this.getDayOfWeek(weekMoment, i);
						if (this.isWorkingDay(dayDate)) {
							await this.addTaskToDay(dayDate, taskName, weekFileName, shift);
						}
					}
					processed++;
				} else if (dayOnlyMatch) {
					// Task for specific days without shift: "pagar conta - #1,3,5"
					const taskName = dayOnlyMatch[1].trim();
					const daysStr = dayOnlyMatch[2];
					const days = this.parseDays(daysStr);
					
					if (days.length > 0) {
						for (const dayNum of days) {
							if (dayNum >= 1 && dayNum <= 7) {
								const dayDate = this.getDayOfWeek(weekMoment, dayNum);
								await this.addTaskToDay(dayDate, taskName, weekFileName);
							}
						}
						processed++;
					} else {
						ignored.push(`"${taskText}" - invalid day format (use #1, #1,3,5, or #2-5)`);
					}
				} else if (noPatternMatch) {
					// Task for all working days without shift: "fazer relatório"
					for (let i = 1; i <= 7; i++) {
						const dayDate = this.getDayOfWeek(weekMoment, i);
						if (this.isWorkingDay(dayDate)) {
							await this.addTaskToDay(dayDate, taskText, weekFileName);
						}
					}
					processed++;
				} else {
					// Invalid syntax - has " - " but doesn't match any pattern
					ignored.push(`"${taskText}" - invalid syntax. Use: "task - #shift - #days", "task - #shift", "task - #days", or "task"`);
				}
			}
		}
		
		return {processed, ignored};
	}

	parseDays(daysStr: string): number[] {
		const days: Set<number> = new Set();
		
		// Split by comma for multiple entries
		const parts = daysStr.split(',');
		
		for (const part of parts) {
			const trimmed = part.trim();
			
			// Check if it's a range (e.g., "2-5")
			if (trimmed.includes('-')) {
				const rangeParts = trimmed.split('-');
				if (rangeParts.length === 2) {
					const start = parseInt(rangeParts[0].trim());
					const end = parseInt(rangeParts[1].trim());
					
					if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 7 && start <= end) {
						for (let i = start; i <= end; i++) {
							days.add(i);
						}
					}
				}
			} else {
				// Single day number
				const dayNum = parseInt(trimmed);
				if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 7) {
					days.add(dayNum);
				}
			}
		}
		
		return Array.from(days).sort((a, b) => a - b);
	}

	async updateWeeklySummary() {
		const m = moment();
		const weekFileName = getWeekFileName(this.settings, m);
		const summaryFileName = `${this.settings.baseDir}/Summary.md`;
		const weekNumber = getCalendarWeek(m);
		const year = m.year();
		const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
		
		// Calculate week statistics
		let totalPlannedTasks = 0;
		let totalCompletedTasks = 0;
		const daysWithTasks: number[] = [];
		
		// Count tasks from daily files
		for (let i = 1; i <= 7; i++) {
			const dayDate = this.getDayOfWeek(m, i);
			const dayFileName = getDayFileName(this.settings, dayDate);
			let dayTaskCount = 0;
			
			try {
				const dayContent = await this.app.vault.adapter.read(dayFileName);
				const lines = dayContent.split('\n');
				
				for (const line of lines) {
					if (line.trim().startsWith(TODO_DONE_PREFIX)) {
						totalCompletedTasks++;
						totalPlannedTasks++;
						dayTaskCount++;
					} else if (line.trim().startsWith(TODO_PREFIX)) {
						totalPlannedTasks++;
						dayTaskCount++;
					}
				}
				
				if (dayTaskCount > 0) {
					daysWithTasks.push(dayTaskCount);
				}
			} catch (error) {
				// Day file doesn't exist, skip
			}
		}
		
		// Calculate statistics
		const avgTasksPerDay = daysWithTasks.length > 0 
			? (daysWithTasks.reduce((a, b) => a + b, 0) / daysWithTasks.length).toFixed(1)
			: '0.0';
		const successRate = totalPlannedTasks > 0
			? (totalCompletedTasks / totalPlannedTasks).toFixed(3)
			: '0.000';
		
		// Create or update summary file
		let summaryContent = '';
		let fileExists = true;
		try {
			summaryContent = await this.app.vault.adapter.read(summaryFileName);
		} catch (error) {
			fileExists = false;
		}
		
		const lines = summaryContent.split('\n');
		
		// Build the week filename without full path
		const weekFileShortName = `Calweek-${year}-${weekNumber}`;
		const weekLinkText = `[[${weekFileShortName}]]`;
		const newRow = `| ${weekLinkText} | ${avgTasksPerDay} | ${successRate} |`;
		
		// Find if current week already exists in table
		let weekRowIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			// Check if line contains the week key or the week file name
			if (lines[i].includes(weekKey) || lines[i].includes(weekFileShortName)) {
				weekRowIndex = i;
				break;
			}
		}
		
		if (weekRowIndex !== -1) {
			// Update existing row
			lines[weekRowIndex] = newRow;
		} else {
			// Find the last row of the table to add new entry
			let lastTableRowIndex = -1;
			let inTable = false;
			
			for (let i = 0; i < lines.length; i++) {
				const trimmed = lines[i].trim();
				
				// Detect table separator
				if (trimmed.startsWith('|') && trimmed.includes('---')) {
					inTable = true;
					continue;
				}
				
				// If we're in a table and find a row
				if (inTable && trimmed.startsWith('|') && !trimmed.includes('---')) {
					lastTableRowIndex = i;
				}
				
				// If we're in a table and hit a non-table line, we're done
				if (inTable && !trimmed.startsWith('|') && trimmed.length > 0) {
					break;
				}
			}
			
			if (lastTableRowIndex !== -1) {
				// Insert after the last table row
				lines.splice(lastTableRowIndex + 1, 0, newRow);
			} else {
				// No table found - shouldn't happen if file exists with table
				new Notice('⚠️ Table not found in Summary.md. Please create a table with headers: Week | Avg Tasks/Day | Success Rate');
				return;
			}
		}
		
		await this.app.vault.adapter.write(summaryFileName, lines.join('\n'));

		// Generate and add chart
		await this.addChartToSummary(summaryFileName);

		// Open the summary file
		const summaryFile = this.app.vault.getAbstractFileByPath(summaryFileName);
		if (summaryFile) {
			await this.app.workspace.getLeaf().openFile(summaryFile as any);
		}

		new Notice(`✅ Summary updated for week ${weekKey}`);
	}

	async addChartToSummary(summaryFileName: string) {
		try {
			const summaryContent = await this.app.vault.adapter.read(summaryFileName);
			const lines = summaryContent.split('\n');

			// Extract data from table
			const chartData: Array<{week: string, tasks: number, avgPerDay: number, successRate: number}> = [];
			let inTable = false;

			for (const line of lines) {
				const trimmed = line.trim();

				// Detect table separator
				if (trimmed.startsWith('|') && trimmed.includes('---')) {
					inTable = true;
					continue;
				}

				// Parse table rows
				if (inTable && trimmed.startsWith('|')) {
					const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
					if (cells.length >= 3) {
						// Extract week from link: [[Calweek-2025-46]] -> 2025-W46
						const weekMatch = cells[0].match(/Calweek-(\d+)-(\d+)/);
						if (weekMatch) {
							const weekLabel = `${weekMatch[1]}-W${weekMatch[2]}`;
							const avgPerDay = parseFloat(cells[1]) || 0;
							const successRate = parseFloat(cells[2]) || 0;
							const tasks = 0; // Not stored anymore, just for compatibility

							chartData.push({week: weekLabel, tasks, avgPerDay, successRate});
						}
					}
				}

				// Stop if we exit the table
				if (inTable && !trimmed.startsWith('|') && trimmed.length > 0) {
					break;
				}
			}

			if (chartData.length === 0) return;

			// Remove old chart if exists - find and remove everything from "## 📈 Weekly Trends" onwards
			let chartStartIndex = -1;

			for (let i = 0; i < lines.length; i++) {
				if (lines[i].includes('📈 Weekly Trends')) {
					chartStartIndex = i;
					break;
				}
			}

			if (chartStartIndex !== -1) {
				// Remove everything from the chart header to the end of file
				// Check if there's an empty line before the header
				const removeStart = chartStartIndex > 0 && lines[chartStartIndex - 1].trim() === '' ? chartStartIndex - 1 : chartStartIndex;
				lines.splice(removeStart);
			}

			// Generate new chart
			const chart = this.generateChart(chartData.slice(-16)); // Show last 16 weeks

			// Add chart at the end
			const chartSection = ['', '## 📈 Weekly Trends', '', ...chart];
			lines.push(...chartSection);

			await this.app.vault.adapter.write(summaryFileName, lines.join('\n'));
		} catch (error) {
			console.error('Error adding chart to summary:', error);
		}
	}

	getDayOfWeek(weekMoment: moment.Moment, dayNum: number): Date {
		// dayNum: 1=Monday, 2=Tuesday, ..., 7=Sunday
		const startOfWeek = weekMoment.clone().startOf('isoWeek');
		return startOfWeek.add(dayNum - 1, 'days').toDate();
	}

	isWorkingDay(date: Date): boolean {
		const weekdays = this.settings.workingDays.split(',');
		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const dayName = dayNames[date.getDay()];
		return weekdays.includes(dayName);
	}

	async addTaskToDay(date: Date, taskText: string, weekFileName: string, shift?: string) {
		const dayFileName = getDayFileName(this.settings, date);
		const dayFile = new WeekPlannerFile(this.settings, this.app.vault, dayFileName);
		const weekLink = `[[${weekFileName.replace('.md', '').split('/').pop()}]]`;
		
		// Create day file if it doesn't exist with week link
		let content = '';
		try {
			content = await this.app.vault.adapter.read(dayFileName);
		} catch (error) {
			// File doesn't exist, create it with proper structure
			const dayDate = moment(date);
			const header = `## Tasks\n\nWeek: ${weekLink}\n\n`;
			await this.app.vault.adapter.write(dayFileName, header);
			content = header;
		}
		
		// Check if task already exists
		const taskExists = content.includes(taskText);
		
		if (!taskExists) {
			// Add week link if not present
			if (!content.includes(weekLink)) {
				const lines = content.split('\n');
				const headerIndex = lines.findIndex(line => line.trim().startsWith('##'));
				if (headerIndex !== -1) {
					lines.splice(headerIndex + 1, 0, '', `Week: ${weekLink}`, '', '');
					content = lines.join('\n');
					await this.app.vault.adapter.write(dayFileName, content);
				}
			}
			
			// Add task with or without shift section
			if (shift) {
				await this.addTaskToShiftSection(dayFileName, taskText, shift);
			} else {
				// Add task without shift section - append at end
				const updatedContent = await this.app.vault.adapter.read(dayFileName);
				const task = `${TODO_PREFIX}${taskText}`;
				await this.app.vault.adapter.write(dayFileName, updatedContent.trimEnd() + '\n' + task + '\n');
			}
		}
	}

	async addTaskToShiftSection(dayFileName: string, taskText: string, shift: string) {
		const content = await this.app.vault.adapter.read(dayFileName);
		const lines = content.split('\n');
		
		// Shift headers - only Morning, Afternoon, and Night
		const shiftHeaders: {[key: string]: string} = {
			'morning': '### Morning',
			'afternoon': '### Afternoon',
			'night': '### Night'
		};
		
		const shiftHeader = shiftHeaders[shift];
		if (!shiftHeader) return;
		
		// Find shift section
		const shiftIndex = lines.findIndex(line => line.trim() === shiftHeader);
		
		if (shiftIndex !== -1) {
			// Shift section exists, add task after it
			const task = `${TODO_PREFIX}${taskText}`;
			lines.splice(shiftIndex + 1, 0, task);
		} else {
			// Create shift section in the correct order: Morning -> Afternoon -> Night
			const shiftOrder = ['morning', 'afternoon', 'night'];
			const currentShiftIndex = shiftOrder.indexOf(shift);
			
			// Find where to insert the new section
			let insertIndex = -1;
			for (let i = currentShiftIndex + 1; i < shiftOrder.length; i++) {
				const nextShift = shiftHeaders[shiftOrder[i]];
				const nextIndex = lines.findIndex(line => line.trim() === nextShift);
				if (nextIndex !== -1) {
					insertIndex = nextIndex;
					break;
				}
			}
			
			if (insertIndex === -1) {
				// No later shift found, add at the end
				lines.push('', shiftHeader, `${TODO_PREFIX}${taskText}`);
			} else {
				// Insert before the next shift with separator
				lines.splice(insertIndex, 0, shiftHeader, `${TODO_PREFIX}${taskText}`, '', '---', '');
			}
		}
		
		// Add separators between existing shifts if not present
		const updatedLines = [];
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			updatedLines.push(line);
			
			// Check if this is a shift header and the next shift header exists without separator
			if (Object.values(shiftHeaders).includes(line.trim())) {
				// Find the next shift header
				let nextShiftIndex = -1;
				for (let j = i + 1; j < lines.length; j++) {
					if (Object.values(shiftHeaders).includes(lines[j].trim())) {
						nextShiftIndex = j;
						break;
					}
				}
				
				// If next shift found, check if separator exists
				if (nextShiftIndex !== -1) {
					let hasSeparator = false;
					for (let k = i + 1; k < nextShiftIndex; k++) {
						if (lines[k].trim() === '---') {
							hasSeparator = true;
							break;
						}
					}
					
					// Skip to just before next shift
					while (i + 1 < nextShiftIndex) {
						i++;
						updatedLines.push(lines[i]);
					}
					
					if (!hasSeparator) {
						updatedLines.push('');
						updatedLines.push('---');
						updatedLines.push('');
					}
				}
			}
		}
		
		lines.splice(0, lines.length, ...updatedLines);
		
		// Write back to file
		await this.app.vault.adapter.write(dayFileName, lines.join('\n'));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class WeekPlannerSettingTab extends PluginSettingTab {
	plugin: WeekPlannerPlugin;

	constructor(app: App, plugin: WeekPlannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings forWeek Planner plugin.'});

		new Setting(containerEl)
			.setName('Working Days')
			.setDesc('Weekdays that should be considered when stepping between days or shifting tasks to the next working day. Format: Mon,Tue,Wed,Thu,Fri,Sat,Sun')
			.addText(text => text
				.setPlaceholder('Mon,Tue,Wed,Thu,Fri')
				.setValue(this.plugin.settings.workingDays)
				.onChange(async (value) => {
					value = validateOrDefault(value)
					this.plugin.settings.workingDays = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Base directory')
			.setDesc("Week planner's root directory. Will be created if if doesn't exists.")
			.addText(text => text
				.setPlaceholder('Week Planner')
				.setValue(this.plugin.settings.baseDir)
				.onChange(async (value) => {
					value = validateDirectoryOrDefault(value, DEFAULT_SETTINGS.baseDir).trim()
					this.plugin.settings.baseDir = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Days directory')
			.setDesc("Subdirectory of base where daily todo files are stored. Will be created if if doesn't exists.")
			.addText(text => text
				.setPlaceholder('Days')
				.setValue(this.plugin.settings.daysDir)
				.onChange(async (value) => {
					value = validateDirectoryOrDefault(value, DEFAULT_SETTINGS.daysDir).trim()
					this.plugin.settings.daysDir = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Weeks directory')
			.setDesc("Subdirectory of base where weekly files are stored. Will be created if if doesn't exists.")
			.addText(text => text
				.setPlaceholder('Weeks')
				.setValue(this.plugin.settings.weeksDir)
				.onChange(async (value) => {
					value = validateDirectoryOrDefault(value, DEFAULT_SETTINGS.weeksDir).trim()
					this.plugin.settings.weeksDir = value;
					await this.plugin.saveSettings();
				}));

		const div = containerEl.createEl('div', {
			cls: 'advanced-tables-donation',
		});

		const donateText = document.createElement('p');
		donateText.appendText(
			'If this plugin adds value for you and you would like to help support ' +
			'continued development, please use the button below:',
		);
		div.appendChild(donateText);

		const parser = new DOMParser();

		div.appendChild(
			createDonateButton(
				'https://paypal.me/ralfwirdemann',
				parser.parseFromString(paypal, 'text/xml').documentElement,
			),
		);
	}
}

function validateOrDefault(value: string) {
	if (isValidWorkingDaysString(value)) {
		console.log('working day string is valid')
		return value
	}

	console.log('working day string is invalid. using default')
	return DEFAULT_SETTINGS.workingDays
}

function validateDirectoryOrDefault(value: string, defaultValue: string) {
	if (value === undefined || value === '') {
		console.log('directory is invalid. using default')
		return defaultValue
	}

	if (value.contains(':') || value.contains('/') || value.contains('\\')) {
		console.log('directory contains invalid character')
		return defaultValue
	}

	return value
}

const createDonateButton = (link: string, img: HTMLElement): HTMLElement => {
	const a = document.createElement('a');
	a.setAttribute('href', link);
	a.addClass('advanced-tables-donate-button');
	a.appendChild(img);
	return a;
};

const paypal = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40">
<path fill="#253B80" d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z"/>
<path fill="#179BD7" d="M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z"/>
<path fill="#253B80" d="M7.266 29.154l.523-3.322-1.165-.027H1.061L4.927 1.292a.316.316 0 0 1 .314-.268h9.38c3.114 0 5.263.648 6.385 1.927.526.6.861 1.227 1.023 1.917.17.724.173 1.589.007 2.644l-.012.077v.676l.526.298a3.69 3.69 0 0 1 1.065.812c.45.513.741 1.165.864 1.938.127.795.085 1.741-.123 2.812-.24 1.232-.628 2.305-1.152 3.183a6.547 6.547 0 0 1-1.825 2c-.696.494-1.523.869-2.458 1.109-.906.236-1.939.355-3.072.355h-.73c-.522 0-1.029.188-1.427.525a2.21 2.21 0 0 0-.744 1.328l-.055.299-.924 5.855-.042.215c-.011.068-.03.102-.058.125a.155.155 0 0 1-.096.035H7.266z"/>
<path fill="#179BD7" d="M23.048 7.667c-.028.179-.06.362-.096.55-1.237 6.351-5.469 8.545-10.874 8.545H9.326c-.661 0-1.218.48-1.321 1.132L6.596 26.83l-.399 2.533a.704.704 0 0 0 .695.814h4.881c.578 0 1.069-.42 1.16-.99l.048-.248.919-5.832.059-.32c.09-.572.582-.992 1.16-.992h.73c4.729 0 8.431-1.92 9.513-7.476.452-2.321.218-4.259-.978-5.622a4.667 4.667 0 0 0-1.336-1.03z"/>
<path fill="#222D65" d="M21.754 7.151a9.757 9.757 0 0 0-1.203-.267 15.284 15.284 0 0 0-2.426-.177h-7.352a1.172 1.172 0 0 0-1.159.992L8.05 17.605l-.045.289a1.336 1.336 0 0 1 1.321-1.132h2.752c5.405 0 9.637-2.195 10.874-8.545.037-.188.068-.371.096-.55a6.594 6.594 0 0 0-1.017-.429 9.045 9.045 0 0 0-.277-.087z"/>
<path fill="#253B80" d="M9.614 7.699a1.169 1.169 0 0 1 1.159-.991h7.352c.871 0 1.684.057 2.426.177a9.757 9.757 0 0 1 1.481.353c.365.121.704.264 1.017.429.368-2.347-.003-3.945-1.272-5.392C20.378.682 17.853 0 14.622 0h-9.38c-.66 0-1.223.48-1.325 1.133L.01 25.898a.806.806 0 0 0 .795.932h5.791l1.454-9.225 1.564-9.906z"/>
</svg>`;

# Obsidian Week Planner Plugin

https://user-images.githubusercontent.com/28768/197604992-021aadc1-1bb0-4622-a4c8-dc424d05d9cb.mov

This plugin reflects my personal working process that is organized around three central ideas:

-   Inbox: single, unordered lists of todos
-   Week: goals for the current week
-   Today: ordered lists of today's todos

Each if these three todo containers is represented by a single Obsidian document type organized
within the following folder structure:

```
Week Planner
  Days
    2022-09-05-Monday
    2022-09-06-Tuesday
    ...
  Weeks
    Calweek-2022-35
    Calweek-2022-36
  	...
  Inbox
```

Each file contains tasks according to the todo-specific markup rules:

```
## 2022-09-19-Monday
- [ ] Plan my day
- [ ] Do emails
- [ ] Create new Week Planner release
```

The basic idea of this plugin is to create and open these documents easily and to move tasks between
them as seamless as possible. These goals are achieved by providing a set of commands:

-   `Show Inbox` Creates and / or shows the _inbox_ note
-   `Show Week` Creates and / or shows the note of the current calendar _week_
-   `Show Today` Creates and / or shows the todo list for _today_
-   `Show Tomorrow` Creates and / or shows the todo list for _tomorrow_
-   `Show Yesterday` Creates and / or shows the todo list of _yesterday_
-   `Move Task` Moves task under cursor to the next working day
-   `Move to Inbox` Moves task under cursor back to the inbox
-   `Move Anywhere` Opens a modal to move task under cursor to the inbox or a specific date document
-   `Add Todo` Opens a todo modal to create a new todo and insert it into the inbox or a specific date document
-   `Update Progress Counter` Updates the progress counter (completed/total checkboxes) in the current file
-   `Update All Progress Counters` Updates the progress counters in all Week Planner files

All `Show`-Tasks open the relevant document. The document and the underlying folder structure is
created automatically if it doesn't exist.

The `Show`-commands consider the actual date along with a set of working days. Thus, `Show Today`
always creates / opens a todo note for the actual date regardless if today is a working day or not.
But `Show Tomorrow` and `Show Yesterday` consider working days, thus if you trigger `Show Yesterday`
on a Sunday the todo note of last Friday is created / opened.

## The Planning Process

The `Move Task`-command supports a fluent planning process by moving tasks of the currently open
document to the next working day. For instance, if your current document is _inbox_ `Move Task` will
move the task to _today_, but only if today is a working day. If today is a Sunday `Move Task` will
move the task to the next Monday (according to your working day settings as described below).
Shifting tasks from _inbox_ to _today_ comes in handy for your morning planning routine: Open your
_inbox_ and move all today's task to your todo note of today. Today's note will be created
automatically if it doesn't exist.

If your active document is _today_ `Move Task` moves a task to the next working day. This becomes
useful when you finish your work day but have unfinished tasks left that you would like to work on
tomorrow. The _tomorrow_ file will also be created automatically if it doesn't exist.

And finally, if your current document is _yesterday_ `Move Task` moves the task to _today_. This
command is helpful when you didn't finish some of yesterday's tasks and forgot to move them to the
next day on the day before.

## Weekly Sync Syntax

The week file supports flexible task distribution when you run the **Sync Week Tasks to Days**
command. Use the syntax below inside your week note:

-   `[x-x-xxx] - Task name - #morning` &rarr; seven slots (Mon-Sun) where `x` means the task runs on
    that day and `-` skips it. The example schedules Monday, Wednesday, Friday-Sunday in the morning
-   `[xx-----] - Inbox review` &rarr; no shift, runs on Monday and Tuesday only
-   `Task name - #morning - #1,3,5` &rarr; legacy syntax for choosing specific days
-   `Task name - #2-4` &rarr; legacy syntax without shifts
-   `Task name - #morning` &rarr; all working days for the selected shift

The mask format keeps partial selections stable across sync runs because each day is explicitly
encoded in the seven-character pattern.

## Summary & Analytics

Execute the `Update Weekly Summary` command to refresh `Summary.md` with layered insights:

-   A table that links every week file to its average tasks/day and success rate
-   A dual-line **Weekly Trends** chart covering the last 16 weeks
-   A GitHub-style commitment grid that color-codes each day from the last six months based on the
    ratio of completed versus planned tasks (hover to see exact percentages)

## Progress Tracking

The plugin automatically tracks your progress on tasks. Each file created by the plugin includes a
progress counter that shows:

-   Number of completed tasks (checked checkboxes)
-   Total number of tasks
-   Completion percentage

Example:

```
## Inbox
**Progress:** 3/5 (60%)

- [x] Completed task 1
- [x] Completed task 2
- [ ] Pending task 3
- [x] Completed task 3
- [ ] Pending task 4
```

You can update the progress counter manually using:

-   `Update Progress Counter` - Updates only the current file
-   `Update All Progress Counters` - Updates all files in your Week Planner directory

The progress counter is automatically added when new files are created.

## Settings

The plugin allows you to define the set of your specific working days according to the following
format:

```
Mon,Tue,Wed,Thu,Fri
```

The order of the days is not relevant.

## License

-   [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)

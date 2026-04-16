import { resolve } from 'node:path'

const HARNESS_DIR = '.dohyun'

function harnessRoot(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), HARNESS_DIR)
}

export const paths = {
  root: harnessRoot,

  // State
  session: (cwd?: string) => resolve(harnessRoot(cwd), 'state', 'session.json'),
  modes: (cwd?: string) => resolve(harnessRoot(cwd), 'state', 'modes.json'),
  lastRun: (cwd?: string) => resolve(harnessRoot(cwd), 'state', 'last-run.json'),

  // Runtime
  currentTask: (cwd?: string) => resolve(harnessRoot(cwd), 'runtime', 'current-task.json'),
  queue: (cwd?: string) => resolve(harnessRoot(cwd), 'runtime', 'queue.json'),

  // Memory
  notepad: (cwd?: string) => resolve(harnessRoot(cwd), 'memory', 'notepad.md'),
  projectMemory: (cwd?: string) => resolve(harnessRoot(cwd), 'memory', 'project-memory.json'),
  learnings: (cwd?: string) => resolve(harnessRoot(cwd), 'memory', 'learnings.json'),
  hot: (cwd?: string) => resolve(harnessRoot(cwd), 'memory', 'hot.md'),

  // Logs
  log: (cwd?: string) => resolve(harnessRoot(cwd), 'logs', 'log.md'),

  // Dirs
  plans: (cwd?: string) => resolve(harnessRoot(cwd), 'plans'),
  logs: (cwd?: string) => resolve(harnessRoot(cwd), 'logs'),
  skillsLearned: (cwd?: string) => resolve(harnessRoot(cwd), 'skills-learned'),
  stateDir: (cwd?: string) => resolve(harnessRoot(cwd), 'state'),
  runtimeDir: (cwd?: string) => resolve(harnessRoot(cwd), 'runtime'),
  memoryDir: (cwd?: string) => resolve(harnessRoot(cwd), 'memory'),
} as const

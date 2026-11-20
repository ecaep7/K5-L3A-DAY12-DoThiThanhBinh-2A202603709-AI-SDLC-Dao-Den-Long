// Stop hook: chạy npm test; đỏ thì chặn kết thúc (exit 2, lý do ra stderr). Chạy được trên Windows.
import { spawnSync } from 'node:child_process';
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], {
  cwd: root, encoding: 'utf8', shell: process.platform === 'win32',
});
if (r.status === 0) process.exit(0);
const out = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').filter((l) => /✖|not ok|fail|Error/.test(l)).slice(0, 25).join('\n');
process.stderr.write(`npm test ĐỎ - chưa được kết thúc. Sửa rồi chạy lại.\n${out}\n`);
process.exit(2);

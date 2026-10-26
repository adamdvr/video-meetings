// PostToolUse-хук Claude Code: после Edit/Write форматирует изменённый файл корневым Prettier.
// Файлы вне репозитория отсекаются здесь, а неподдерживаемые типы и пути
// из .prettierignore и .gitignore пропускает сам Prettier.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

try {
  const projectDir = realpathSync(process.env.CLAUDE_PROJECT_DIR);
  const input = JSON.parse(readFileSync(0, 'utf8'));
  // Настоящий путь: файл, открытый через симлинк (например, .claude/skills → .agents/skills),
  // проверяется по своему реальному расположению. Для абсолютного пути через симлинк
  // Prettier не применяет правила .prettierignore.
  const file = realpathSync(
    input.tool_response?.filePath ?? input.tool_input?.file_path,
  );
  const relative = path.relative(projectDir, file);
  const insideProject =
    relative !== '' &&
    relative.split(path.sep)[0] !== '..' &&
    !path.isAbsolute(relative);

  if (insideProject) {
    // cwd — корень репозитория: относительно него Prettier ищет .prettierignore и .gitignore.
    execFileSync(
      process.execPath,
      [
        path.join(projectDir, 'node_modules/prettier/bin/prettier.cjs'),
        '--write',
        '--ignore-unknown',
        file,
      ],
      { cwd: projectDir, stdio: 'ignore' },
    );
  }
} catch {
  // Хук не должен прерывать работу: файл, который Prettier не разобрал, поймают lint и check-types.
}

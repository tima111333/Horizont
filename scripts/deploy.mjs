// Публикация на GitHub Pages: сборка → ветка gh-pages (только содержимое dist).
// node scripts/deploy.mjs  (remote origin должен смотреть на репозиторий GitHub)
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const run = (cmd, cwd = process.cwd()) => execSync(cmd, { cwd, stdio: 'inherit' })
const out = (cmd) => execSync(cmd).toString().trim()

const remote = out('git remote get-url origin')
run('npm run build')
const dist = path.resolve('dist')
// Jekyll на Pages прячет файлы и папки с «_» — отключаем
fs.writeFileSync(path.join(dist, '.nojekyll'), '')
// 404 → та же страница: прямые ссылки не ломаются
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'))
fs.rmSync(path.join(dist, '.git'), { recursive: true, force: true })
run('git init -q -b gh-pages', dist)
run('git add -A', dist)
run(`git -c user.name="${out('git config user.name')}" -c user.email="${out('git config user.email')}" commit -q -m "Сборка ${new Date().toISOString().slice(0, 16)}"`, dist)
run(`git push -f "${remote}" gh-pages`, dist)
fs.rmSync(path.join(dist, '.git'), { recursive: true, force: true })
console.log('\nОпубликовано в ветку gh-pages.')

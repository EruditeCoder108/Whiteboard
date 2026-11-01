import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Lessons, lessonName } from '../src/main/lessons'

const lesson = JSON.stringify({ format: 'floating-whiteboard', version: 2, items: [{ t: 's', id: 'a', c: '#111827', w: 3, m: 0, v: 0, p: [1, 1, .5, 20, 20, .5] }] })
let dir = ''
let files = ''
let lessons: Lessons
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'fw-lessons-data-'))
  files = await fs.mkdtemp(join(tmpdir(), 'fw-lessons-files-'))
  lessons = new Lessons(dir)
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.rm(files, { recursive: true, force: true })
})

describe('lesson files', () => {
  it('names a lesson after its file', () => {
    expect(lessonName('D:\\Teaching\\Maths ch 4.wbd')).toBe('Maths ch 4')
  })

  it('saves only to files the teacher chose, and only valid lessons', async () => {
    const path = join(files, 'Maths.wbd')
    expect((await lessons.save(path, lesson)).ok).toBe(false) // never chosen in a dialog
    lessons.allow(path)
    expect((await lessons.save(path, '{"not":"a lesson"}')).ok).toBe(false)
    await expect(fs.access(path)).rejects.toThrow()
    expect((await lessons.save(path, lesson)).ok).toBe(true)
    expect(await fs.readFile(path, 'utf8')).toBe(lesson)
    expect((await lessons.save(join(files, 'notes.txt'), lesson)).ok).toBe(false)
    expect((await lessons.save('relative.wbd', lesson)).ok).toBe(false)
  })

  it('writes the whole file or nothing: no half-written leftovers', async () => {
    const path = join(files, 'Maths.wbd')
    lessons.allow(path)
    await lessons.save(path, lesson)
    await lessons.save(path, lesson.replace('"w":3', '"w":5'))
    expect((await fs.readdir(files)).sort()).toEqual(['Maths.wbd'])
  })

  it('lists recent lessons newest first, drops the missing, and caps the list', async () => {
    const paths: string[] = []
    for (let i = 0; i < 10; i++) {
      const path = join(files, `L${i}.wbd`)
      paths.push(path)
      lessons.allow(path)
      await lessons.save(path, lesson)
    }
    const recent = await lessons.recent()
    expect(recent.length).toBe(8)
    expect(recent[0].name).toBe('L9')
    await fs.rm(paths[9])
    expect((await lessons.recent())[0].name).toBe('L8')
    await lessons.forget(paths[8])
    expect((await lessons.recent())[0].name).toBe('L7')
  })

  it('opens a recent lesson, but not an arbitrary path', async () => {
    const path = join(files, 'Maths.wbd')
    lessons.allow(path)
    await lessons.save(path, lesson)
    const fresh = new Lessons(dir) // a new session: the list is all it knows
    expect((await fresh.open(path))?.json).toBe(lesson)
    const other = join(files, 'secret.wbd')
    await fs.writeFile(other, lesson)
    expect(await fresh.open(other)).toBeNull()
    expect(await fresh.open('not a path')).toBeNull()
  })

  it('remembers which file the lesson belongs to and whether it has unsaved changes', async () => {
    expect(await lessons.link()).toEqual({ path: null, dirty: true })
    const path = join(files, 'Maths.wbd')
    expect((await lessons.setLink({ path, dirty: false })).ok).toBe(false) // unknown file
    lessons.allow(path)
    expect((await lessons.setLink({ path, dirty: false })).ok).toBe(true)
    expect(await new Lessons(dir).link()).toEqual({ path, dirty: false })
    expect((await lessons.setLink({ path: null, dirty: true })).ok).toBe(true)
    expect(await lessons.link()).toEqual({ path: null, dirty: true })
  })
})

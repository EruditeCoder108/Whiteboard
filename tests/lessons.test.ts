import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Lessons, lessonName } from '../src/main/lessons'

const lesson = JSON.stringify({ format: 'floating-whiteboard', version: 2, items: [{ t: 's', id: 'a', c: '#111827', w: 3, m: 0, v: 0, p: [1, 1, .5, 20, 20, .5] }] })
let dir = ''
let files = ''
let lib = ''
let lessons: Lessons
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'fw-lessons-data-'))
  files = await fs.mkdtemp(join(tmpdir(), 'fw-lessons-files-'))
  lib = join(files, 'Library')
  lessons = new Lessons(dir, lib)
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
    const fresh = new Lessons(dir, lib) // a new session: the list is all it knows
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
    expect(await new Lessons(dir, lib).link()).toEqual({ path, dirty: false })
    expect((await lessons.setLink({ path: null, dirty: true })).ok).toBe(true)
    expect(await lessons.link()).toEqual({ path: null, dirty: true })
  })
})

describe('the lesson library', () => {
  const thumb = 'data:image/webp;base64,UklGRg=='

  it('makes a new lesson in the library under a free, file-safe name, and saves it there', async () => {
    const a = await lessons.create('Ch 4: Carbon / compounds?', 'Class 10 Science')
    expect(a).toBe(join(lib, 'Ch 4_ Carbon _ compounds_.wbd'))
    expect((await lessons.save(a, lesson, { pages: 3, kind: 'notebook', thumb })).ok).toBe(true)
    const b = await lessons.create('Ch 4: Carbon / compounds?', '')
    expect(b).toBe(join(lib, 'Ch 4_ Carbon _ compounds_ (2).wbd'))
    expect(await lessons.create('   ', '')).toBeNull()
  })

  it('lists every lesson with its subject, size and picture, newest first; files dropped in the folder show too', async () => {
    const a = (await lessons.create('Fractions', 'Class 5 Maths'))!
    await lessons.save(a, lesson, { pages: 2, kind: 'notebook', thumb })
    await fs.writeFile(join(lib, 'From a USB stick.wbd'), lesson)
    const outside = join(files, 'Elsewhere.wbd')
    lessons.allow(outside)
    await lessons.save(outside, lesson, { pages: 1, kind: 'canvas' })
    const list = await lessons.library()
    expect(list.map(l => l.name).sort()).toEqual(['Elsewhere', 'Fractions', 'From a USB stick'])
    const fractions = list.find(l => l.name === 'Fractions')!
    expect(fractions).toMatchObject({ subject: 'Class 5 Maths', pages: 2, kind: 'notebook', thumb, inLibrary: true })
    expect(list.find(l => l.name === 'Elsewhere')!.inLibrary).toBe(false)
    // a new session may open anything the library shows
    expect((await new Lessons(dir, lib).open(join(lib, 'From a USB stick.wbd')))?.json).toBe(lesson)
  })

  it('renames a lesson in place; the recent list and the board’s link follow it', async () => {
    const a = (await lessons.create('Draft', 'Physics'))!
    await lessons.save(a, lesson, { pages: 1, kind: 'notebook' })
    await lessons.setLink({ path: a, dirty: false })
    const r = await lessons.rename(a, 'Light: reflection')
    expect(r).toEqual({ ok: true, path: join(lib, 'Light_ reflection.wbd') })
    const moved = (r as { path: string }).path
    expect((await lessons.recent())[0].path).toBe(moved)
    expect((await lessons.link()).path).toBe(moved)
    expect((await lessons.library()).find(l => l.path === moved)!.subject).toBe('Physics')
    await expect(fs.access(a)).rejects.toThrow()
  })

  it('copies a lesson next to itself, and deletes only by sending it to the bin', async () => {
    const binned: string[] = []
    const withBin = new Lessons(dir, lib, async p => { binned.push(p); await fs.rm(p) })
    const a = (await withBin.create('Atoms', 'Chemistry'))!
    await withBin.save(a, lesson, { pages: 1, kind: 'notebook' })
    const copy = await withBin.duplicate(a)
    expect(copy).toBe(join(lib, 'Atoms (copy).wbd'))
    expect((await withBin.library()).find(l => l.path === copy)!.subject).toBe('Chemistry')
    expect((await withBin.remove(a)).ok).toBe(true)
    expect(binned).toEqual([a])
    expect((await withBin.library()).map(l => l.name)).toEqual(['Atoms (copy)'])
    expect((await withBin.remove(join(files, 'not-mine.wbd'))).ok).toBe(false) // never an arbitrary file
  })

  it('files a lesson under a subject, and drops lessons whose files have gone', async () => {
    const a = (await lessons.create('Plants', ''))!
    await lessons.save(a, lesson, { pages: 1, kind: 'notebook' })
    await lessons.setSubject(a, '  Class 6 Science  ')
    expect((await lessons.library())[0].subject).toBe('Class 6 Science')
    await fs.rm(a)
    expect(await lessons.library()).toEqual([])
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { PIPS, clockHands, keepInZone, parseNames, pickFrom, pollChart, rollDice, rollNumbers, zoneAt, zoneSpan } from '@/engine/classroom'
import { itemFromJson, itemToJson } from '@/engine/serialize'
import { PollServer, validPoll } from '../src/main/poll'

describe('student zones', () => {
  it('finds the side a hand lands on', () => {
    expect(zoneAt(0, 1200, 3)).toBe(0)
    expect(zoneAt(599, 1200, 3)).toBe(1)
    expect(zoneAt(1199, 1200, 3)).toBe(2)
    expect(zoneAt(1500, 1200, 3)).toBe(2)
    expect(zoneAt(-5, 1200, 3)).toBe(0)
  })

  it('a stroke cannot leave its side', () => {
    const [lo, hi] = zoneSpan(1, 1200, 3)
    expect(lo).toBe(400)
    expect(hi).toBe(800)
    expect(keepInZone(100, 1, 1200, 3)).toBeGreaterThanOrEqual(400)
    expect(keepInZone(1100, 1, 1200, 3)).toBeLessThanOrEqual(800)
    expect(keepInZone(555, 1, 1200, 3)).toBe(555)
  })
})

describe('name picker', () => {
  it('reads names on lines or with commas, without repeats or blanks', () => {
    expect(parseNames('Asha\nRavi, Meena;\n\n  Asha  ')).toEqual(['Asha', 'Ravi', 'Meena'])
    expect(parseNames('रवि\nआशा')).toEqual(['रवि', 'आशा'])
  })

  it('gives roll numbers, in any order the ends are typed, within reason', () => {
    expect(rollNumbers(1, 3)).toEqual(['1', '2', '3'])
    expect(rollNumbers(3, 1)).toEqual(['1', '2', '3'])
    expect(rollNumbers(1, 1e9).length).toBe(1000)
  })

  it('with everyone getting a turn, nobody comes twice until all have', () => {
    const all = ['a', 'b', 'c', 'd']
    let used: string[] = []
    const seen: string[] = []
    for (let i = 0; i < 4; i++) { const r = pickFrom(all, used, true); seen.push(r.pick!); used = r.used }
    expect([...seen].sort()).toEqual(all)
    const again = pickFrom(all, used, true)
    expect(all).toContain(again.pick)
    expect(again.used).toEqual([again.pick])
  })

  it('otherwise anyone can come up, and an empty list gives nobody', () => {
    expect(pickFrom(['a', 'b'], ['a'], false, () => 0).pick).toBe('a')
    expect(pickFrom([], [], true).pick).toBeNull()
    expect(pickFrom(['a', 'b'], [], true, () => .999).pick).toBe('b')
  })
})

describe('dice and clock', () => {
  it('dice stay between 1 and 6, with the right dots', () => {
    for (const r of [0, .5, .9999]) for (const v of rollDice(3, () => r)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6) }
    for (let n = 1; n <= 6; n++) expect(PIPS[n].length).toBe(n)
  })

  it('clock hands point the right way', () => {
    expect(clockHands(3, 0, 0).hour).toBe(90)
    expect(clockHands(15, 30, 0).hour).toBe(105)
    expect(clockHands(0, 15, 0).minute).toBe(90)
    expect(clockHands(0, 0, 30).second).toBe(180)
  })
})

describe('poll', () => {
  const server = new PollServer({ port: 0 })
  afterEach(() => server.stop())
  const start = () => server.start({ question: 'Is <b>this</b> safe?', options: ['Yes', 'No'], address: '127.0.0.1' })
  const answer = async (url: string, cookie: string, option: string): Promise<number> =>
    (await fetch(url + 'vote', { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: `option=${option}` })).status
  const join = async (url: string): Promise<string> => (await fetch(url)).headers.get('set-cookie')!.split(';')[0]

  it('only accepts sensible questions', () => {
    expect(validPoll('q', ['a', 'b'])).toBe(true)
    expect(validPoll('q', ['a'])).toBe(false)
    expect(validPoll('q', ['a', ' '])).toBe(false)
    expect(validPoll('x'.repeat(201), ['a', 'b'])).toBe(false)
    expect(validPoll(7, ['a', 'b'])).toBe(false)
    expect(validPoll('q', Array(7).fill('a'))).toBe(false)
  })

  it('shows the question safely, counts one answer per phone, and a phone can change its answer', async () => {
    const { url } = await start()
    const html = await (await fetch(url)).text()
    expect(html).toContain('Is &lt;b&gt;this&lt;/b&gt; safe?')
    expect(html).not.toContain('<b>this')
    const a = await join(url), b = await join(url)
    expect(await answer(url, a, '0')).toBe(200)
    expect(await answer(url, a, '0')).toBe(200)
    expect(await answer(url, b, '1')).toBe(200)
    expect(server.status().counts).toEqual([1, 1])
    expect(server.status().total).toBe(2)
    await answer(url, a, '1')
    expect(server.status().counts).toEqual([0, 2])
  })

  it('turns away a wrong address, a bad answer and an unknown phone', async () => {
    const { url } = await start()
    const a = await join(url)
    expect((await fetch(url.replace(/\/[^/]+\/$/, '/wrong-token/'))).status).toBe(404)
    expect((await fetch(url + '../..')).status).toBe(404)
    expect(await answer(url, a, '5')).toBe(400)
    expect(await answer(url, a, 'x')).toBe(400)
    expect(await answer(url, '', '0')).toBe(400)
    expect((await fetch(url + 'vote')).status).toBe(405)
    expect(server.status().total).toBe(0)
  })

  it('stops completely, and ends by itself', async () => {
    const { url } = await start()
    server.stop()
    expect(server.status().active).toBe(false)
    await expect(fetch(url)).rejects.toBeTruthy()
    const short = new PollServer({ port: 0, durationMs: 1 })
    await short.start({ question: '', options: ['a', 'b'], address: '127.0.0.1' })
    await new Promise(r => setTimeout(r, 30))
    expect(short.status().active).toBe(false)
  })

  it('the result goes on the board as ordinary objects', () => {
    const items = pollChart('Q', ['A', 'B'], [3, 1], false)
    for (const it of items) expect(itemFromJson(itemToJson(it))).not.toBeNull()
    const bars = items.filter(i => i.t === 'h')
    expect(bars.length).toBe(2)
    expect(bars[0].p[2] - bars[0].p[0]).toBeCloseTo((bars[1].p[2] - bars[1].p[0]) * 3)
  })
})

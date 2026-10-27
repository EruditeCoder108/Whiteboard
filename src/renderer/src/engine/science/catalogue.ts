import { MODELS } from './models'
export type ScienceSubject = 'physics' | 'chemistry' | 'biology' | 'maths'
export const SUBJECTS: { id: ScienceSubject; title: string }[] = [{ id: 'physics', title: 'Physics' }, { id: 'chemistry', title: 'Chemistry' }, { id: 'biology', title: 'Biology' }, { id: 'maths', title: 'Maths' }]
export const CONCEPTS = MODELS.map(m => ({ ...m, tags: `${m.title} ${m.description} ${m.topic} ${m.question} ${m.assumption}`.toLowerCase() }))
export function findConcepts(query: string, subject: ScienceSubject | 'all', topic = 'all') {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return CONCEPTS.filter(entry => (subject === 'all' || entry.subject === subject) && (topic === 'all' || entry.topic === topic) && words.every(word => entry.tags.includes(word)))
}

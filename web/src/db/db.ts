import Dexie, { type Table } from 'dexie'
import type {
  AttemptRow, ProgressRow, Question, SessionRow, StarRow, SubjectMeta, WrongRow,
} from '../domain/types'

export interface MetaRow {
  key: string
  value: unknown
}

export class QuizDB extends Dexie {
  subjects!: Table<SubjectMeta, string>
  questions!: Table<Question, string>
  progress!: Table<ProgressRow, string>
  wrongs!: Table<WrongRow, string>
  stars!: Table<StarRow, string>
  sessions!: Table<SessionRow, number>
  attempts!: Table<AttemptRow, number>
  meta!: Table<MetaRow, string>

  constructor(name = 'njfu-quiz') {
    super(name)
    this.version(1).stores({
      subjects: 'id',
      questions: 'qid, subjectId, [subjectId+type], hash',
      progress: 'key, subjectId, state',
      wrongs: 'key, subjectId, dueAt, cleared',
      stars: 'key, subjectId',
      sessions: '++id, subjectId, startedAt',
      attempts: '++id, sessionId, subjectId, qid, at',
      meta: 'key',
    })
  }
}

export const db = new QuizDB()

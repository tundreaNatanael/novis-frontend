import { describe, expect, it } from 'vitest'
import { courseUpdateBody, lessonMinutes } from './utils'

const LINK = 'https://meet.example.com/piano'
const draft = { title: 'Piano', description: '', defaultMeetingUrl: '', defaultDurationMinutes: '' }

describe('courseUpdateBody', () => {
  it('sends the values as typed, trimmed', () => {
    expect(
      courseUpdateBody(
        { description: null, defaultMeetingUrl: null, defaultDurationMinutes: null },
        {
          title: ' Piano ',
          description: ' For beginners ',
          defaultMeetingUrl: ` ${LINK} `,
          defaultDurationMinutes: '45',
        },
      ),
    ).toStrictEqual({
      title: 'Piano',
      description: 'For beginners',
      defaultMeetingUrl: LINK,
      defaultDurationMinutes: 45,
    })
  })

  it('removes an emptied description, link or length with null and leaves an absent one out', () => {
    expect(
      courseUpdateBody(
        { description: 'x', defaultMeetingUrl: LINK, defaultDurationMinutes: 45 },
        draft,
      ),
    ).toStrictEqual({
      title: 'Piano',
      description: null,
      defaultMeetingUrl: null,
      defaultDurationMinutes: null,
    })
    expect(
      courseUpdateBody(
        { description: null, defaultMeetingUrl: null, defaultDurationMinutes: null },
        draft,
      ),
    ).toStrictEqual({ title: 'Piano' })
    expect(courseUpdateBody(undefined, draft)).toStrictEqual({ title: 'Piano' })
  })

  it('reads a typed length', () => {
    expect(lessonMinutes(' 45 ')).toBe(45)
    expect(lessonMinutes('')).toBeUndefined()
  })
})

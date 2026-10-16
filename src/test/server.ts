import { setupServer } from 'msw/node'

/** The MSW server every test uses; handlers are added per test with `server.use(...)`. */
export const server = setupServer()

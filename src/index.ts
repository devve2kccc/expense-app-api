import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { jwt } from 'hono/jwt'
import type { JwtVariables } from 'hono/jwt'
import dotenv from 'dotenv'

import Auth from './auth.js'
import Accounts from './accounts.js'
import Categories from './categories.js'
import Transactions from './transactions.js'

type Variables = JwtVariables

dotenv.config()

const app = new Hono<{ Variables: Variables }>().basePath('/api')

app.use(logger())

app.use('/accounts/*', jwt({
  secret: process.env.JWT_SECRET!,
  cookie: 'token',
}))

app.use('/categories/*', jwt({
  secret: process.env.JWT_SECRET!,
  cookie: 'token',
}))

app.use('/transactions/*', jwt({
  secret: process.env.JWT_SECRET!,
  cookie: 'token',
}))

app.route("/auth", Auth).route("/accounts", Accounts).route("/categories", Categories).route("/transactions", Transactions)

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})

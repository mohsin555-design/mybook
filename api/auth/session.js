import { handleRequest } from '../../server/server.js'

export default async function handler(req, res) {
  req.url = '/api/auth/session'
  await handleRequest(req, res)
}

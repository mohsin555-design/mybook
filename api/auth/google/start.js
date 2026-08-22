import { handleRequest } from '../../../server/server.js'

export default async function handler(req, res) {
  const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  req.url = `/api/auth/google/start${query}`
  await handleRequest(req, res)
}

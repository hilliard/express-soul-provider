export function requireAuth(req, res, next) {

  if (!req.session.humanId) {

    console.log('Access to protected route blocked')
    return res.status(401).json({ error: 'Unauthorized' })

  }

  next()
}

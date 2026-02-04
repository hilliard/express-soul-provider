import validator from 'validator'
import { getDBConnection } from '../db/db.js'
import bcrypt from 'bcryptjs'

export async function registerUser(req, res) {

  let { firstName, lastName, email, username, password } = req.body

  if (!firstName || !lastName || !email || !username || !password) {

    return res.status(400).json({ error: 'All fields are required.' })

  }

  firstName = firstName.trim()
  lastName = lastName.trim()
  email = email.trim()
  username = username.trim()

  if (!/^[a-zA-Z0-9_-]{1,20}$/.test(username)) {

    return res.status(400).json(
      { error: 'Username must be 1–20 characters, using letters, numbers, _ or -.' }
    )
  }

  if (!validator.isEmail(email)) {

    return res.status(400).json({ error: 'Invalid email format' })

  }

  try {

    const db = await getDBConnection()

    try {
      // Check if email or username already exists
      const existingEmail = await db.get('SELECT human_id FROM email_history WHERE email = ? AND effective_to IS NULL', [email])
      const existingUsername = await db.get('SELECT human_id FROM customers WHERE username = ?', [username])

      if (existingEmail || existingUsername) {
        return res.status(400).json({ error: 'Email or username already in use.' })
      }

      const hashed = await bcrypt.hash(password, 10)

      // 1. Create human record
      const humanResult = await db.run(
        'INSERT INTO humans (first_name, last_name) VALUES (?, ?)',
        [firstName, lastName]
      )
      const humanId = humanResult.lastID

      // 2. Create customer record
      await db.run(
        'INSERT INTO customers (human_id, username, password_hash) VALUES (?, ?, ?)',
        [humanId, username, hashed]
      )

      // 3. Add email to history
      await db.run(
        `INSERT INTO email_history (human_id, email, effective_to, change_reason) 
         VALUES (?, ?, NULL, 'initial')`,
        [humanId, email]
      )

      // 4. Assign customer role
      const roleResult = await db.get("SELECT id FROM site_roles WHERE role_name = 'customer'")
      await db.run(
        'INSERT INTO human_site_roles (human_id, site_role_id) VALUES (?, ?)',
        [humanId, roleResult.id]
      )

      req.session.humanId = humanId

      res.status(201).json({ message: 'User registered' })
    } finally {
      await db.close()
    }
  } catch (err) {
 
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' })

  }

}

export async function loginUser(req, res) {

  let { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'All fields are required' } )
  }

  username = username.trim()

  try {
    const db = await getDBConnection()

    try {
      const customer = await db.get(
        `SELECT c.human_id, c.password_hash, h.first_name 
         FROM customers c 
         JOIN humans h ON c.human_id = h.id 
         WHERE c.username = ?`,
        [username]
      )

      if (!customer) {
        return res.status(401).json({ error: 'Invalid credentials'})
      }

      const isValid = await bcrypt.compare(password, customer.password_hash)

      if (!isValid) {

        return res.status(401).json({ error: 'Invalid credentials'})

      }

      req.session.humanId = customer.human_id
      res.json({ message: 'Logged in' })
    } finally {
      await db.close()
    }
  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
}


export async function logoutUser(req, res) {

  req.session.destroy( () => {

    res.json({ message: 'Logged out' })

  })

}
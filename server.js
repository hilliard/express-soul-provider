import express from 'express'
import { productsRouter } from './routes/products.js'
import { authRouter } from './routes/auth.js'
import { meRouter } from './routes/me.js'
import { cartRouter } from './routes/cart.js'
import { checkoutRouter } from './routes/checkout.js'
import session from 'express-session'

const app = express() 
const PORT = 5600
const secret = process.env.SPIRAL_SESSION_SECRET || 'jellyfish-baskingshark'

app.use(express.json()) 

app.use(session({
  secret: secret,
  resave: false, 
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}))

app.use(express.static('public'))

app.use('/api/products', productsRouter)

app.use('/api/auth/me', meRouter)

app.use('/api/auth', authRouter)

app.use('/api/cart', cartRouter)

app.use('/api/checkout', checkoutRouter)
 
app.listen(PORT, () => { 
  console.log(`Server running at http://localhost:${PORT}`)
}).on('error', (err) => {
  console.error('Failed to start server:', err)
}) 
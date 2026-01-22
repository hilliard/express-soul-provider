import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { 
  previewOrder, 
  createOrder, 
  getOrder, 
  getUserOrders,
  validateCouponCode 
} from '../controllers/checkoutController.js'

export const checkoutRouter = express.Router()

// All checkout routes require authentication
checkoutRouter.use(requireAuth)

// Preview order with optional coupon (doesn't create order)
checkoutRouter.post('/preview', previewOrder)

// Validate coupon code
checkoutRouter.post('/validate-coupon', validateCouponCode)

// Create order from cart
checkoutRouter.post('/create', createOrder)

// Get user's orders
checkoutRouter.get('/orders', getUserOrders)

// Get specific order details
checkoutRouter.get('/orders/:orderId', getOrder)

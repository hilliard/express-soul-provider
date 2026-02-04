import { getDBConnection } from '../db/db.js'

/**
 * Generate unique order number (format: ORD-YYYYMMDD-XXXXX)
 */
function generateOrderNumber() {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
  return `ORD-${dateStr}-${random}`
}

/**
 * Validate and calculate coupon discount
 */
async function validateCoupon(db, couponCode, subtotal, humanId) {
  const coupon = await db.get(
    `SELECT * FROM coupons 
     WHERE code = ? 
     AND is_active = 1 
     AND (valid_from IS NULL OR valid_from <= datetime('now'))
     AND (valid_until IS NULL OR valid_until >= datetime('now'))`,
    [couponCode]
  )

  if (!coupon) {
    return { valid: false, error: 'Invalid or expired coupon code' }
  }

  // Check if minimum purchase amount is met
  if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
    return { 
      valid: false, 
      error: `Minimum purchase of $${coupon.min_purchase_amount.toFixed(2)} required` 
    }
  }

  // Check usage limits
  if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
    return { valid: false, error: 'Coupon usage limit reached' }
  }

  // Calculate discount
  let discountAmount = 0
  if (coupon.discount_type === 'percentage') {
    discountAmount = subtotal * (coupon.discount_value / 100)
    
    // Apply max discount cap if specified
    if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
      discountAmount = coupon.max_discount_amount
    }
  } else if (coupon.discount_type === 'fixed_amount') {
    discountAmount = Math.min(coupon.discount_value, subtotal)
  }

  return {
    valid: true,
    coupon: coupon,
    discountAmount: Math.round(discountAmount * 100) / 100
  }
}

/**
 * Preview order with coupon (doesn't create order)
 */
export async function previewOrder(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = req.session.humanId
    const { couponCode } = req.body

    // Get cart items
    const cartItems = await db.all(
      `SELECT ci.product_id, ci.quantity, p.price, p.title
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.human_id = ?`,
      [humanId]
    )

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' })
    }

    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    let discountAmount = 0
    let couponInfo = null

    // Validate coupon if provided
    if (couponCode) {
      const validation = await validateCoupon(db, couponCode, subtotal, humanId)
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }

      discountAmount = validation.discountAmount
      couponInfo = {
        code: validation.coupon.code,
        description: validation.coupon.description,
        discount: discountAmount
      }
    }

    const taxRate = 0.08 // 8% tax (can be made configurable)
    const taxAmount = Math.round((subtotal - discountAmount) * taxRate * 100) / 100
    const totalAmount = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100

    res.json({
      items: cartItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: discountAmount,
      tax: taxAmount,
      total: totalAmount,
      coupon: couponInfo
    })

  } catch (err) {
    console.error('Preview order error:', err)
    res.status(500).json({ error: 'Failed to preview order' })
  } finally {
    await db.close()
  }
}

/**
 * Create order from cart items
 */
export async function createOrder(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = req.session.humanId
    const { couponCode, notes } = req.body

    // Get cart items with product details
    const cartItems = await db.all(
      `SELECT ci.product_id, ci.quantity, p.price, p.title
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.human_id = ?`,
      [humanId]
    )

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' })
    }

    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    let discountAmount = 0
    let couponId = null

    // Validate and apply coupon
    if (couponCode) {
      const validation = await validateCoupon(db, couponCode, subtotal, humanId)
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }

      discountAmount = validation.discountAmount
      couponId = validation.coupon.id
    }

    const taxRate = 0.08 // 8% tax
    const taxAmount = Math.round((subtotal - discountAmount) * taxRate * 100) / 100
    const totalAmount = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100

    // Generate unique order number
    const orderNumber = generateOrderNumber()

    // Create order
    const orderResult = await db.run(
      `INSERT INTO orders (human_id, order_number, status, subtotal, discount_amount, tax_amount, total_amount, notes)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [humanId, orderNumber, subtotal, discountAmount, taxAmount, totalAmount, notes || null]
    )

    const orderId = orderResult.lastID

    // Create order items from cart
    for (const item of cartItems) {
      const lineTotal = item.price * item.quantity
      await db.run(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.price, lineTotal]
      )
    }

    // Apply coupon to order
    if (couponId) {
      await db.run(
        `INSERT INTO order_coupons (order_id, coupon_id, discount_applied)
         VALUES (?, ?, ?)`,
        [orderId, couponId, discountAmount]
      )

      // Increment coupon usage
      await db.run(
        `UPDATE coupons SET times_used = times_used + 1 WHERE id = ?`,
        [couponId]
      )
    }

    // Clear cart
    await db.run('DELETE FROM cart_items WHERE human_id = ?', [humanId])

    res.status(201).json({
      message: 'Order created successfully',
      orderId: orderId,
      orderNumber: orderNumber,
      total: totalAmount
    })

  } catch (err) {
    console.error('Create order error:', err)
    res.status(500).json({ error: 'Failed to create order' })
  } finally {
    await db.close()
  }
}

/**
 * Get order details
 */
export async function getOrder(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = req.session.humanId
    const orderId = parseInt(req.params.orderId, 10)

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' })
    }

    // Get order
    const order = await db.get(
      `SELECT * FROM orders WHERE id = ? AND human_id = ?`,
      [orderId, humanId]
    )

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Get order items
    const items = await db.all(
      `SELECT oi.*, p.title, p.artist, p.image
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    )

    // Get applied coupons
    const coupons = await db.all(
      `SELECT oc.discount_applied, c.code, c.description
       FROM order_coupons oc
       JOIN coupons c ON oc.coupon_id = c.id
       WHERE oc.order_id = ?`,
      [orderId]
    )

    res.json({
      order: order,
      items: items,
      coupons: coupons
    })

  } catch (err) {
    console.error('Get order error:', err)
    res.status(500).json({ error: 'Failed to retrieve order' })
  } finally {
    await db.close()
  }
}

/**
 * Get all orders for current user
 */
export async function getUserOrders(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = req.session.humanId

    const orders = await db.all(
      `SELECT id, order_number, status, total_amount, created_at
       FROM orders
       WHERE human_id = ?
       ORDER BY created_at DESC`,
      [humanId]
    )

    res.json({ orders: orders })

  } catch (err) {
    console.error('Get user orders error:', err)
    res.status(500).json({ error: 'Failed to retrieve orders' })
  } finally {
    await db.close()
  }
}

/**
 * Validate coupon code (without creating order)
 */
export async function validateCouponCode(req, res) {
  const db = await getDBConnection()
  try {
    const humanId = req.session.humanId
    const { couponCode } = req.body

    if (!couponCode) {
      return res.status(400).json({ error: 'Coupon code required' })
    }

    // Get cart subtotal
    const result = await db.get(
      `SELECT SUM(ci.quantity * p.price) AS subtotal
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.human_id = ?`,
      [humanId]
    )

    const subtotal = result?.subtotal || 0

    if (subtotal === 0) {
      return res.status(400).json({ error: 'Cart is empty' })
    }

    const validation = await validateCoupon(db, couponCode, subtotal, humanId)

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }

    res.json({
      valid: true,
      code: validation.coupon.code,
      description: validation.coupon.description,
      discountAmount: validation.discountAmount
    })

  } catch (err) {
    console.error('Validate coupon error:', err)
    res.status(500).json({ error: 'Failed to validate coupon' })
  } finally {
    await db.close()
  }
}

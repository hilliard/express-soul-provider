import express from 'express'
import { getGenres, getProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productsController.js'
import { requirePermission } from '../middleware/requireAuth.js'

export const productsRouter = express.Router()

productsRouter.get('/genres', getGenres)
productsRouter.get('/', getProducts)
productsRouter.post('/', requirePermission('products.create'), createProduct)
productsRouter.put('/:id', requirePermission('products.update'), updateProduct)
productsRouter.delete('/:id', requirePermission('products.delete'), deleteProduct)
productsRouter.put('/:id', requirePermission('products.update'), updateProduct)
productsRouter.delete('/:id', requirePermission('products.delete'), deleteProduct)
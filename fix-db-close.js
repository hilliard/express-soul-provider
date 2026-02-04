#!/usr/bin/env node
/**
 * Helper script to identify functions that need db.close() fixes
 * Reads controller files and shows functions with getDBConnection()
 */

import fs from 'fs'
import path from 'path'

const controllersDir = './controllers'
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'))

const alreadyFixed = ['cartController.js', 'authController.js', 'meController.js', 'productsController.js']
const toFix = files.filter(f => !alreadyFixed.includes(f))

console.log('\n=== Controllers Still Needing db.close() Fixes ===\n')
toFix.forEach(file => {
  const content = fs.readFileSync(path.join(controllersDir, file), 'utf8')
  const matches = content.match(/export async function \w+/g) || []
  console.log(`📄 ${file}: ${matches.length} functions`)
  matches.forEach(m => console.log(`   - ${m.replace('export async function ', '')}`))
})

console.log('\n✅ Already Fixed:')
alreadyFixed.forEach(f => console.log(`   - ${f}`))

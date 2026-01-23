import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'node:path'

export async function getDBConnection() {

const dbPath = path.join('database.db')

 const db = await open({
   filename: dbPath,
   driver: sqlite3.Database
 }) 
 
 // Enable foreign key constraints
 await db.run('PRAGMA foreign_keys = ON')
 
 return db
 
} 

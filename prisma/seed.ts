import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'prisma/finance.db')
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

const categories = [
  { name: 'Income', color: '#22c55e', sortOrder: 0 },
  { name: 'Housing', color: '#f97316', sortOrder: 1 },
  { name: 'Utilities', color: '#eab308', sortOrder: 2 },
  { name: 'Groceries', color: '#84cc16', sortOrder: 3 },
  { name: 'Eating Out', color: '#f43f5e', sortOrder: 4 },
  { name: 'Transport', color: '#3b82f6', sortOrder: 5 },
  { name: 'Fuel', color: '#06b6d4', sortOrder: 6 },
  { name: 'Shopping', color: '#8b5cf6', sortOrder: 7 },
  { name: 'Health', color: '#ec4899', sortOrder: 8 },
  { name: 'Fitness', color: '#14b8a6', sortOrder: 9 },
  { name: 'Entertainment', color: '#f59e0b', sortOrder: 10 },
  { name: 'Travel', color: '#6366f1', sortOrder: 11 },
  { name: 'Insurance', color: '#64748b', sortOrder: 12 },
  { name: 'Subscriptions', color: '#a855f7', sortOrder: 13 },
  { name: 'Debt Repayments', color: '#dc2626', sortOrder: 14 },
  { name: 'Savings & Investments', color: '#10b981', sortOrder: 15 },
  { name: 'Transfers', color: '#94a3b8', sortOrder: 16 },
  { name: 'Fees & Charges', color: '#78716c', sortOrder: 17 },
  { name: 'Miscellaneous', color: '#9ca3af', sortOrder: 18 },
]

const subcategories: { categoryName: string; names: string[] }[] = [
  { categoryName: 'Eating Out', names: ['Restaurants', 'Cafes', 'Fast Food', 'Food Delivery', 'Bars & Pubs'] },
  { categoryName: 'Transport', names: ['Rideshare', 'Public Transport', 'Parking', 'Tolls'] },
  { categoryName: 'Shopping', names: ['Clothing', 'Electronics', 'Home & Garden', 'Books', 'Personal Care'] },
  { categoryName: 'Health', names: ['Pharmacy', 'Medical', 'Dental', 'Optical'] },
  { categoryName: 'Subscriptions', names: ['Streaming', 'Software', 'Memberships', 'News'] },
  { categoryName: 'Income', names: ['Salary', 'Freelance', 'Refund', 'Interest', 'Other Income'] },
]

type MerchantRuleSeed = {
  pattern: string
  patternType: 'exact' | 'keyword' | 'regex'
  categoryName: string
  subcategoryName?: string
  direction?: string
}

const merchantRules: MerchantRuleSeed[] = [
  { pattern: 'UBER EATS', patternType: 'exact', categoryName: 'Eating Out', subcategoryName: 'Food Delivery' },
  { pattern: 'MENULOG', patternType: 'exact', categoryName: 'Eating Out', subcategoryName: 'Food Delivery' },
  { pattern: 'DOORDASH', patternType: 'exact', categoryName: 'Eating Out', subcategoryName: 'Food Delivery' },
  { pattern: 'WOOLWORTHS', patternType: 'exact', categoryName: 'Groceries' },
  { pattern: 'COLES', patternType: 'exact', categoryName: 'Groceries' },
  { pattern: 'ALDI', patternType: 'exact', categoryName: 'Groceries' },
  { pattern: 'IGA', patternType: 'exact', categoryName: 'Groceries' },
  { pattern: 'AMPOL', patternType: 'exact', categoryName: 'Fuel' },
  { pattern: 'BP', patternType: 'exact', categoryName: 'Fuel' },
  { pattern: 'CALTEX', patternType: 'exact', categoryName: 'Fuel' },
  { pattern: 'SHELL', patternType: 'exact', categoryName: 'Fuel' },
  { pattern: '7-ELEVEN', patternType: 'exact', categoryName: 'Fuel' },
  { pattern: 'NETFLIX', patternType: 'exact', categoryName: 'Subscriptions', subcategoryName: 'Streaming' },
  { pattern: 'SPOTIFY', patternType: 'exact', categoryName: 'Subscriptions', subcategoryName: 'Streaming' },
  { pattern: 'DISNEY PLUS', patternType: 'exact', categoryName: 'Subscriptions', subcategoryName: 'Streaming' },
  { pattern: 'AMAZON PRIME', patternType: 'exact', categoryName: 'Subscriptions', subcategoryName: 'Streaming' },
  { pattern: 'STAN', patternType: 'exact', categoryName: 'Subscriptions', subcategoryName: 'Streaming' },
  { pattern: 'APPLE.COM/BILL', patternType: 'exact', categoryName: 'Subscriptions', subcategoryName: 'Software' },
  { pattern: 'GOOGLE*', patternType: 'keyword', categoryName: 'Subscriptions', subcategoryName: 'Software' },
  { pattern: 'MICROSOFT', patternType: 'keyword', categoryName: 'Subscriptions', subcategoryName: 'Software' },
  { pattern: 'AFTERPAY', patternType: 'keyword', categoryName: 'Shopping' },
  { pattern: 'CHEMIST', patternType: 'keyword', categoryName: 'Health', subcategoryName: 'Pharmacy' },
  { pattern: 'PRICELINE', patternType: 'keyword', categoryName: 'Health', subcategoryName: 'Pharmacy' },
  { pattern: 'UBER*', patternType: 'keyword', categoryName: 'Transport', subcategoryName: 'Rideshare' },
  { pattern: 'DIDI', patternType: 'exact', categoryName: 'Transport', subcategoryName: 'Rideshare' },
  { pattern: 'OPAL', patternType: 'keyword', categoryName: 'Transport', subcategoryName: 'Public Transport' },
  { pattern: 'MYKI', patternType: 'keyword', categoryName: 'Transport', subcategoryName: 'Public Transport' },
  { pattern: 'SALARY', patternType: 'keyword', categoryName: 'Income', subcategoryName: 'Salary', direction: 'income' },
  { pattern: 'PAYROLL', patternType: 'keyword', categoryName: 'Income', subcategoryName: 'Salary', direction: 'income' },
  { pattern: 'INTEREST', patternType: 'keyword', categoryName: 'Income', subcategoryName: 'Interest', direction: 'income' },
  { pattern: 'TRANSFER', patternType: 'keyword', categoryName: 'Transfers' },
  { pattern: 'BPAY', patternType: 'keyword', categoryName: 'Utilities' },
]

async function main() {
  console.log('Seeding database...')

  // Seed categories
  const categoryMap = new Map<string, string>()
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
    })
    categoryMap.set(cat.name, created.id)
  }
  console.log(`Seeded ${categories.length} categories`)

  // Seed subcategories
  const subcategoryMap = new Map<string, string>()
  let subCount = 0
  for (const { categoryName, names } of subcategories) {
    const categoryId = categoryMap.get(categoryName)
    if (!categoryId) continue
    for (const name of names) {
      const existing = await prisma.subcategory.findFirst({
        where: { name, categoryId },
      })
      if (!existing) {
        const created = await prisma.subcategory.create({
          data: { name, categoryId },
        })
        subcategoryMap.set(`${categoryName}:${name}`, created.id)
        subCount++
      } else {
        subcategoryMap.set(`${categoryName}:${name}`, existing.id)
      }
    }
  }
  console.log(`Seeded ${subCount} subcategories`)

  // Seed merchant rules
  let ruleCount = 0
  for (const rule of merchantRules) {
    const categoryId = categoryMap.get(rule.categoryName)
    if (!categoryId) continue
    const subcategoryId = rule.subcategoryName
      ? subcategoryMap.get(`${rule.categoryName}:${rule.subcategoryName}`)
      : undefined

    await prisma.merchantRule.upsert({
      where: { pattern: rule.pattern },
      update: {},
      create: {
        pattern: rule.pattern,
        patternType: rule.patternType,
        categoryId,
        subcategoryId: subcategoryId ?? null,
        direction: rule.direction ?? null,
        isUserDefined: false,
        priority: 0,
      },
    })
    ruleCount++
  }
  console.log(`Seeded ${ruleCount} merchant rules`)

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

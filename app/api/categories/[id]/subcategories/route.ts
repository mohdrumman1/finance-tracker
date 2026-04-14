import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { name } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const category = await prisma.category.findUnique({ where: { id } })
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    const existing = await prisma.subcategory.findFirst({
      where: { name: name.trim(), categoryId: id },
    })
    if (existing) {
      return NextResponse.json({ error: 'Subcategory already exists in this category' }, { status: 409 })
    }
    const subcategory = await prisma.subcategory.create({
      data: { name: name.trim(), categoryId: id },
    })
    return NextResponse.json(subcategory, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create subcategory' }, { status: 500 })
  }
}

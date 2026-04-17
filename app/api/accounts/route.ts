import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth } from '@/middleware/auth';


export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        userId: req.userId
      },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, institution, accountType, currency } = body;
    const userId = req.userId;

    if (!name || !institution) {
      return NextResponse.json({ error: 'name and institution are required' }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name,
        institution,
        accountType: accountType ?? 'transaction',
        currency: currency ?? 'AUD'
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(accounts)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, institution, accountType, currency } = body

    if (!name || !institution) {
      return NextResponse.json({ error: 'name and institution are required' }, { status: 400 })
    }

    const account = await prisma.account.create({
      data: {
        name,
        institution,
        accountType: accountType ?? 'transaction',
        currency: currency ?? 'AUD',
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}

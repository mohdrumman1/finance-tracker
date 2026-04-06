import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { GoalService } from '@/lib/goals/GoalService'

const goalService = new GoalService()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.addAmount !== undefined) {
      await goalService.updateSavedAmount(id, body.addAmount)
    } else {
      await prisma.goal.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.targetAmount !== undefined && { targetAmount: body.targetAmount }),
          ...(body.targetDate !== undefined && { targetDate: new Date(body.targetDate) }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.monthlyContributionTarget !== undefined && {
            monthlyContributionTarget: body.monthlyContributionTarget,
          }),
          updatedAt: new Date(),
        },
      })
    }

    const progress = await goalService.getGoalProgress(id)
    return NextResponse.json(progress)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

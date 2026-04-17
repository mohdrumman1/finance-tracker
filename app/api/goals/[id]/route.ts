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
          ...(body.goalType !== undefined && { goalType: body.goalType }),
          ...(body.targetAmount !== undefined && { targetAmount: body.targetAmount }),
          ...(body.currentSavedAmount !== undefined && { currentSavedAmount: body.currentSavedAmount }),
          ...(body.targetDate !== undefined && {
            targetDate: body.targetDate ? new Date(body.targetDate) : null,
          }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.monthlyContributionTarget !== undefined && {
            monthlyContributionTarget: body.monthlyContributionTarget,
          }),
          updatedAt: new Date(),
        },
      })
    }

    const updated = await prisma.goal.findUniqueOrThrow({ where: { id } })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.goal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}

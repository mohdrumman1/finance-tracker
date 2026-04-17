import { NextRequest, NextResponse } from 'next/server'
import { GoalService } from '@/lib/goals/GoalService'

const goalService = new GoalService()

export async function GET() {
  try {
    const progress = await goalService.listGoals()
    return NextResponse.json(progress.map((p) => p.goal))
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const goal = await goalService.createGoal({
      name: body.name,
      goalType: body.goalType,
      targetAmount: body.targetAmount,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      currentSavedAmount: body.currentSavedAmount,
      monthlyContributionTarget: body.monthlyContributionTarget,
      priority: body.priority,
      linkedCategoryIds: body.linkedCategoryIds,
      notes: body.notes,
    })
    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

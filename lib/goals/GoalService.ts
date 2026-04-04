import { prisma } from '../db/client'
import type { Goal } from '@prisma/client'
import { differenceInDays } from 'date-fns'

export interface CreateGoalInput {
  name: string
  goalType: string
  targetAmount: number
  targetDate?: Date
  currentSavedAmount?: number
  monthlyContributionTarget?: number
  priority?: number
  linkedCategoryIds?: string[]
  notes?: string
}

export interface GoalProgress {
  goal: Goal
  requiredMonthlySavings: number
  projectedCompletionDate: Date | null
  onTrack: boolean
  percentComplete: number
  monthsRemaining: number | null
}

export class GoalService {
  async createGoal(data: CreateGoalInput): Promise<Goal> {
    return prisma.goal.create({
      data: {
        name: data.name,
        goalType: data.goalType,
        targetAmount: data.targetAmount,
        targetDate: data.targetDate ?? null,
        currentSavedAmount: data.currentSavedAmount ?? 0,
        monthlyContributionTarget: data.monthlyContributionTarget ?? null,
        priority: data.priority ?? 1,
        linkedCategoryIds: data.linkedCategoryIds
          ? JSON.stringify(data.linkedCategoryIds)
          : null,
        notes: data.notes ?? null,
        status: 'active',
      },
    })
  }

  async getGoalProgress(goalId: string): Promise<GoalProgress> {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } })
    return this.computeProgress(goal)
  }

  async updateSavedAmount(goalId: string, amount: number): Promise<void> {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } })
    const newAmount = parseFloat((goal.currentSavedAmount + amount).toFixed(2))
    const status = newAmount >= goal.targetAmount ? 'completed' : goal.status

    await prisma.goal.update({
      where: { id: goalId },
      data: {
        currentSavedAmount: newAmount,
        status,
        updatedAt: new Date(),
      },
    })
  }

  async listGoals(): Promise<GoalProgress[]> {
    const goals = await prisma.goal.findMany({
      where: { status: { not: 'completed' } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
    return Promise.all(goals.map((g) => this.computeProgress(g)))
  }

  private computeProgress(goal: Goal): GoalProgress {
    const today = new Date()
    const remaining = parseFloat(
      (goal.targetAmount - goal.currentSavedAmount).toFixed(2)
    )
    const percentComplete = goal.targetAmount > 0
      ? parseFloat(((goal.currentSavedAmount / goal.targetAmount) * 100).toFixed(2))
      : 0

    let monthsRemaining: number | null = null
    let requiredMonthlySavings = 0
    let projectedCompletionDate: Date | null = null

    if (goal.targetDate) {
      const daysLeft = differenceInDays(goal.targetDate, today)
      monthsRemaining = Math.max(0, parseFloat((daysLeft / 30).toFixed(1)))
      requiredMonthlySavings =
        monthsRemaining > 0
          ? parseFloat((remaining / monthsRemaining).toFixed(2))
          : remaining
    }

    // Check if on track based on monthly contribution target
    const avgMonthlySavings = goal.monthlyContributionTarget ?? 0
    const onTrack =
      requiredMonthlySavings > 0
        ? avgMonthlySavings >= requiredMonthlySavings
        : percentComplete >= 100

    if (requiredMonthlySavings > 0 && avgMonthlySavings > 0) {
      const monthsNeeded = remaining / avgMonthlySavings
      projectedCompletionDate = new Date(
        today.getTime() + monthsNeeded * 30 * 24 * 60 * 60 * 1000
      )
    }

    return {
      goal,
      requiredMonthlySavings,
      projectedCompletionDate,
      onTrack,
      percentComplete,
      monthsRemaining,
    }
  }
}

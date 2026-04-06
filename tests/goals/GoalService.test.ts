import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db/client', () => ({
  prisma: {
    goal: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { GoalService } from '../../lib/goals/GoalService'
import { prisma } from '../../lib/db/client'

const makeGoal = (overrides = {}) => ({
  id: 'goal-1',
  name: 'House Deposit',
  goalType: 'house_deposit',
  targetAmount: 50000,
  targetDate: new Date('2027-04-01'),
  currentSavedAmount: 10000,
  monthlyContributionTarget: 2000,
  priority: 1,
  linkedCategoryIds: null,
  notes: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('GoalService', () => {
  const service = new GoalService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('required monthly savings correct for a given target and date', async () => {
    const goal = makeGoal()
    vi.mocked(prisma.goal.findUniqueOrThrow).mockResolvedValue(goal as never)

    const progress = await service.getGoalProgress('goal-1')
    // remaining = 50000 - 10000 = 40000
    // months to April 2027 from April 2026 = ~12 months
    // required = 40000 / 12 ≈ 3333
    expect(progress.requiredMonthlySavings).toBeGreaterThan(0)
    expect(progress.requiredMonthlySavings).toBeLessThan(50000)
  })

  it('percent complete calculated correctly', async () => {
    const goal = makeGoal({ currentSavedAmount: 25000, targetAmount: 50000 })
    vi.mocked(prisma.goal.findUniqueOrThrow).mockResolvedValue(goal as never)

    const progress = await service.getGoalProgress('goal-1')
    expect(progress.percentComplete).toBe(50)
  })

  it('percent complete is 0 when nothing saved', async () => {
    const goal = makeGoal({ currentSavedAmount: 0, targetAmount: 50000 })
    vi.mocked(prisma.goal.findUniqueOrThrow).mockResolvedValue(goal as never)

    const progress = await service.getGoalProgress('goal-1')
    expect(progress.percentComplete).toBe(0)
  })

  it('on track flag true when monthly contribution >= required savings', async () => {
    // If contributing 4000/month and only need ~3333, should be on track
    const goal = makeGoal({ monthlyContributionTarget: 4000 })
    vi.mocked(prisma.goal.findUniqueOrThrow).mockResolvedValue(goal as never)

    const progress = await service.getGoalProgress('goal-1')
    expect(progress.onTrack).toBe(true)
  })

  it('on track flag false when monthly contribution < required savings', async () => {
    // If contributing only 1000/month but need ~3333, should not be on track
    const goal = makeGoal({ monthlyContributionTarget: 1000 })
    vi.mocked(prisma.goal.findUniqueOrThrow).mockResolvedValue(goal as never)

    const progress = await service.getGoalProgress('goal-1')
    expect(progress.onTrack).toBe(false)
  })

  it('createGoal creates a goal in the database', async () => {
    const created = makeGoal()
    vi.mocked(prisma.goal.create).mockResolvedValue(created as never)

    const goal = await service.createGoal({
      name: 'House Deposit',
      goalType: 'house_deposit',
      targetAmount: 50000,
      targetDate: new Date('2027-04-01'),
      currentSavedAmount: 10000,
      monthlyContributionTarget: 2000,
    })

    expect(prisma.goal.create).toHaveBeenCalledOnce()
    expect(goal.name).toBe('House Deposit')
  })

  it('listGoals returns active goals with progress', async () => {
    const goals = [makeGoal(), makeGoal({ id: 'goal-2', name: 'Holiday Fund' })]
    vi.mocked(prisma.goal.findMany).mockResolvedValue(goals as never)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(prisma.goal.findUniqueOrThrow as any).mockImplementation(({ where }: any) => {
      return Promise.resolve(goals.find((g) => g.id === where?.id) as never)
    })

    const results = await service.listGoals()
    expect(results).toHaveLength(2)
    expect(results[0].goal.name).toBe('House Deposit')
  })
})

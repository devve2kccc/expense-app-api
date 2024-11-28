import { zValidator } from '@hono/zod-validator'
import { PrismaClient, Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { z } from 'zod'
import { convertAmountFromMiliunits, convertAmountToMiliunits, formatCurrency } from '../utils/helper.js'
import { parseISO } from 'date-fns'


const app = new Hono()
const prisma = new PrismaClient()

const TransactionsSchema = z.object({
    amount: z.union([
        z.string().transform(x => x.replace(/[^0-9.-]+/g, '')),
        z.number(),
    ]).pipe(z.coerce.number().min(0.0001).max(999999999)),
    payee: z.string(),
    notes: z.string().optional(),
    date: z.string().date(),
    accountId: z.string(),
    categoryId: z.string().optional()
})

const UpdateSchema = z.object({
    amount: z.union([
        z.string().transform(x => x.replace(/[^0-9.-]+/g, '')),
        z.number(),
    ]).pipe(z.coerce.number().min(0.0001).max(999999999)).optional(),
    payee: z.string().optional(),
    notes: z.string().optional(),
    date: z.string().date().optional(),
    accountId: z.string().optional(),
    categoryId: z.string().optional()
})

app.get("/", async (c) => {
    const transactionsList = await prisma.transactions.findMany({})

    const transactions = transactionsList.map((transaction) => ({
        ...transaction,
        amount: formatCurrency(convertAmountFromMiliunits(transaction.amount))
    }))
    return c.json({ transactions })
})

app.post("/", zValidator("json", TransactionsSchema), async (c) => {
    const values = c.req.valid("json")

    const accountExist = await prisma.accounts.findUnique({ where: { id: values.accountId } })

    if (!accountExist) {
        return c.json({ error: "Provide an valid account!" }, 404)
    }

    if (values.categoryId) {
        const categoryExist = await prisma.categories.findUnique({ where: { id: values.categoryId } })

        if (!categoryExist) {
            return c.json({ error: "Provide an valid category!" }, 404)
        }
    }
    const transaction = await prisma.transactions.create({
        data: {
            ...values,
            amount: convertAmountToMiliunits(values.amount),
            date: parseISO(values.date)
        }
    })

    return c.json({
        transaction: {
            ...transaction,
            amount: formatCurrency(convertAmountFromMiliunits(transaction.amount))
        }
    })
})

app.put("/:id", zValidator("param", z.object({ id: z.string() })), zValidator("json", UpdateSchema), async (c) => {
    const { id } = c.req.valid("param")
    const values = c.req.valid("json")

    if (!id) {
        return c.json({ error: "Missing Id" }, 400);
    }

    try {
        const data = { ...values }

        if (values.amount !== undefined) {
            data.amount = convertAmountToMiliunits(values.amount)
        }

        const transaction = await prisma.transactions.update({
            where: {
                id: id,
            },
            data: data
        })

        return c.json({
            ...transaction,
            amount: formatCurrency(convertAmountFromMiliunits(transaction.amount))
        });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Transaction not found or you are not authorized to update this account." }, 404);
            }
        }
    }
})

app.delete("/:id", zValidator("param", z.object({
    id: z.string()
})), async (c) => {
    const { id } = c.req.valid("param")

    if (!id) {
        return c.json({ error: "Missing Id" }, 400);
    }

    try {
        const transaction = await prisma.transactions.delete({
            where: {
                id: id
            }
        })
        return c.json({ transaction });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Transaction not found or you are not authorized to update this account." }, 404);
            }
        }
    }
})

export default app
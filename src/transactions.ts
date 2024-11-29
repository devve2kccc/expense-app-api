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

app.get("/", zValidator(
    "query",
    z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        accountId: z.string().optional(),
        categoryId: z.string().optional()
    })), async (c) => {
        const user = c.get("jwtPayload")
        const { from, to, accountId, categoryId } = c.req.valid("query");

        console.log(user);

        const where: any = {
            accounts: {
                userId: user.id
            }
        };

        if (from) {
            where.date = { ...where.date, gte: parseISO(from) };
        }

        if (to) {
            where.date = { ...where.date, lte: parseISO(to) };
        }

        if (accountId) {
            where.accountId = accountId;
        }

        if (categoryId) {
            where.categoryId = categoryId;
        }

        const transactionsList = await prisma.transactions.findMany({
            where: where,
            include: {
                accounts: true,
                categories: true
            }
        });

        const transactions = transactionsList.map((transaction) => ({
            id: transaction.id,
            date: transaction.date,
            category: transaction.categories?.name,
            categoryId: transaction.categoryId,
            payee: transaction.payee,
            amount: formatCurrency(convertAmountFromMiliunits(transaction.amount)),
            notes: transaction.notes,
            account: transaction.accounts.name,
            accountId: transaction.accountId
        }))
        return c.json({ transactions })
    })

app.post("/", zValidator("json", TransactionsSchema), async (c) => {
    const user = c.get("jwtPayload")
    const values = c.req.valid("json")

    const accountExist = await prisma.accounts.findFirst({
        where: { id: values.accountId, userId: user.id }
    })

    if (!accountExist) {
        return c.json({ error: "Provide a valid account!" }, 404)
    }

    if (values.categoryId) {
        const categoryExist = await prisma.categories.findFirst({
            where: { id: values.categoryId, userId: user.id }
        })

        if (!categoryExist) {
            return c.json({ error: "Provide a valid category!" }, 404)
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
    const user = c.get("jwtPayload")
    const { id } = c.req.valid("param")
    const values = c.req.valid("json")

    if (!id) {
        return c.json({ error: "Missing Id" }, 400);
    }

    try {
        const transactionExist = await prisma.transactions.findFirst({
            where: { id: id, accounts: { userId: user.id } }
        })

        if (!transactionExist) {
            return c.json({ error: "Transaction not found or you are not authorized to update this account." }, 404);
        }

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
    const user = c.get("jwtPayload")
    const { id } = c.req.valid("param")

    if (!id) {
        return c.json({ error: "Missing Id" }, 400);
    }

    try {
        const transactionExist = await prisma.transactions.findFirst({
            where: { id: id, accounts: { userId: user.id } }
        })

        if (!transactionExist) {
            return c.json({ error: "Transaction not found or you are not authorized to delete this account." }, 404);
        }

        const transaction = await prisma.transactions.delete({
            where: {
                id: id
            }
        })
        return c.json({ transaction });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Transaction not found or you are not authorized to delete this account." }, 404);
            }
        }
    }
})

export default app
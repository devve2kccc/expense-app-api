import { zValidator } from '@hono/zod-validator'
import { PrismaClient, Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { z } from 'zod'


const app = new Hono()
const prisma = new PrismaClient()

const AccountSchema = z.object({
    name: z.string()
})

app.get("/", async (c) => {
    const user = c.get("jwtPayload")

    const accounts = await prisma.accounts.findMany({
        where: {
            userId: user.id
        }
    })

    return c.json({ accounts })
})

app.post("/", zValidator("json", AccountSchema), async (c) => {
    const user = c.get("jwtPayload")
    const { name } = c.req.valid("json")

    const account = await prisma.accounts.create({
        data: {
            name,
            userId: user.id
        }
    })

    return c.json({ account })
})

app.put("/:id", zValidator("param", z.object({ id: z.string() })), zValidator("json", AccountSchema), async (c) => {
    const user = c.get("jwtPayload")
    const { id } = c.req.valid("param")
    const { name } = c.req.valid("json")

    if (!id) {
        return c.json({ error: "Missing Id" }, 400);
    }

    const account = await prisma.accounts.findUnique({
        where: { id }
    })

    if (!account || account.userId !== user.id) {
        return c.json({ error: "Account not found or you are not authorized to update this account." }, 404);
    }

    try {
        const updatedAccount = await prisma.accounts.update({
            where: { id },
            data: { name }
        })

        return c.json({ updatedAccount });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Account not found or you are not authorized to update this account." }, 404);
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

    const account = await prisma.accounts.findUnique({
        where: { id }
    })

    if (!account || account.userId !== user.id) {
        return c.json({ error: "Account not found or you are not authorized to delete this account." }, 404);
    }

    try {
        const deletedAccount = await prisma.accounts.delete({
            where: { id }
        })
        return c.json({ deletedAccount });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Account not found or you are not authorized to delete this account." }, 404);
            }
        }
    }
})

export default app
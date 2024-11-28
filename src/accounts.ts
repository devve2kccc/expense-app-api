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

    try {
        const account = await prisma.accounts.update({
            where: {
                id: id,
                userId: user.id
            },
            data: { name }
        })

        return c.json({ account });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Category not found or you are not authorized to update this account." }, 404);
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
        const account = await prisma.accounts.delete({
            where: {
                id: id
            }
        })
        return c.json({ account });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Category not found or you are not authorized to update this account." }, 404);
            }
        }
    }
})

export default app
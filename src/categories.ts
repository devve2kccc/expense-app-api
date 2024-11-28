import { zValidator } from '@hono/zod-validator'
import { PrismaClient, Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { z } from 'zod'


const app = new Hono()
const prisma = new PrismaClient()

const CategorySchema = z.object({
    name: z.string()
})

app.get("/", async (c) => {
    const user = c.get("jwtPayload")

    const categories = await prisma.categories.findMany({
        where: {
            userId: user.id
        }
    })

    return c.json({ categories })
})

app.post("/", zValidator("json", CategorySchema), async (c) => {
    const user = c.get("jwtPayload")
    const { name } = c.req.valid("json")

    const category = await prisma.categories.create({
        data: {
            name,
            userId: user.id
        }
    })

    return c.json({ category })
})

app.put("/:id", zValidator("param", z.object({ id: z.string() })), zValidator("json", CategorySchema), async (c) => {
    const user = c.get("jwtPayload")
    const { id } = c.req.valid("param")
    const { name } = c.req.valid("json")

    if (!id) {
        return c.json({ error: "Missing Id" }, 400);
    }

    try {
        const category = await prisma.categories.update({
            where: {
                id: id,
                userId: user.id
            },
            data: { name }
        })

        return c.json({ category });
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
    const { id } = c.req.valid("param")

    if (!id) {
        return c.json({ error: "Missing Id" }, 400);
    }

    try {
        const category = await prisma.categories.delete({
            where: {
                id: id
            }
        })
        return c.json({ category });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') {
                return c.json({ error: "Account not found or you are not authorized to update this account." }, 404);
            }
        }
    }
})

export default app
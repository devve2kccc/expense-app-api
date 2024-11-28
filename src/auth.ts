import { zValidator } from '@hono/zod-validator'
import { PrismaClient, Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

const app = new Hono()
const prisma = new PrismaClient()
dotenv.config()

const UserSchema = z.object({
    email: z.string().email(),
    name: z.string(),
    password: z.string()
})

const LoginSchema = UserSchema.omit({ name: true })

app.post("/register", zValidator("json", UserSchema), async (c) => {
    const { email, name, password } = c.req.valid("json");

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { email, name, password: hashedPassword },
        });

        return c.json({ user: { id: user.id, email: user.email, name: user.name } });

    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2002') {
                return c.json({ error: "Email is already registered." }, 401);
            }
        }

        return c.json({ error: "Something went wrong. Please try again." }, 500);
    }
});

app.post("/login", zValidator("json", LoginSchema), async (c) => {
    const { email, password } = c.req.valid("json");

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return c.json({ error: "Invalid email or password." }, 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return c.json({ error: "Invalid email or password." }, 401);
        }

        const tokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
            expiresIn: "1d"
        });

        return c.json({ token });
    } catch (error) {
        console.error("Login error:", error);
        return c.json({ error: "Internal server error." }, 500);
    }
});


export default app

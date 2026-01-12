import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createUserSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

// GET - List all staff (non-owner users)
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const staff = await prisma.user.findMany({
            where: {
                role: {
                    in: ['FLOOR_STAFF', 'KITCHEN_STAFF', ...(session.user.role === 'OWNER' ? ['SUPERVISOR'] : [])] as ('FLOOR_STAFF' | 'KITCHEN_STAFF' | 'SUPERVISOR')[],
                },
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(staff);
    } catch (error) {
        console.error('Error fetching staff:', error);
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }
}

// POST - Create a new staff member
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = createUserSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: validation.data.email },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(validation.data.password, 10);

        const user = await prisma.user.create({
            data: {
                ...validation.data,
                password: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });

        return NextResponse.json(user, { status: 201 });
    } catch (error) {
        console.error('Error creating staff:', error);
        return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createMenuItemSchema } from '@/lib/validations';

// GET - List all menu items
export async function GET() {
    try {
        const menuItems = await prisma.menuItem.findMany({
            orderBy: { name: 'asc' },
            include: {
                category: true,
            },
        });

        return NextResponse.json(menuItems);
    } catch (error) {
        console.error('Error fetching menu items:', error);
        return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
    }
}

// POST - Create a new menu item
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = createMenuItemSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        const { allergies, ...data } = validation.data;
        const menuItem = await prisma.menuItem.create({
            data: {
                ...data,
                allergies: allergies || [],
            },
            include: {
                category: true,
            },
        });

        return NextResponse.json(menuItem, { status: 201 });
    } catch (error) {
        console.error('Error creating menu item:', error);
        return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 });
    }
}

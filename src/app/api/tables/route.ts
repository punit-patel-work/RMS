import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateTableSchema } from '@/lib/validations';

// GET - List all tables
export async function GET() {
    try {
        const tables = await prisma.table.findMany({
            orderBy: { number: 'asc' },
            include: {
                mergedWith: true,
                mergedTables: true,
                orders: {
                    where: {
                        status: {
                            in: ['CREATED', 'PREPARING', 'READY', 'SERVED'],
                        },
                    },
                    include: {
                        items: {
                            include: {
                                menuItem: true,
                            },
                        },
                    },
                },
            },
        });

        return NextResponse.json(tables);
    } catch (error) {
        console.error('Error fetching tables:', error);
        return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
    }
}

// PUT - Update a table status
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });
        }

        const validation = updateTableSchema.safeParse(updateData);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        const table = await prisma.table.update({
            where: { id },
            data: validation.data,
            include: {
                mergedWith: true,
                mergedTables: true,
            },
        });

        return NextResponse.json(table);
    } catch (error) {
        console.error('Error updating table:', error);
        return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
    }
}

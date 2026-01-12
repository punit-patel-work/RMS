import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST - Unmerge tables
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { tableId } = body;

        if (!tableId) {
            return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });
        }

        // Find all tables merged with this one
        const mergedTables = await prisma.table.findMany({
            where: { mergedWithId: tableId },
        });

        // Unmerge all tables
        await prisma.$transaction([
            // Set all merged tables to vacant and remove merge link
            ...mergedTables.map((table) =>
                prisma.table.update({
                    where: { id: table.id },
                    data: {
                        mergedWithId: null,
                        status: 'VACANT',
                    },
                })
            ),
            // Set the primary table to vacant
            prisma.table.update({
                where: { id: tableId },
                data: { status: 'VACANT' },
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error unmerging tables:', error);
        return NextResponse.json({ error: 'Failed to unmerge tables' }, { status: 500 });
    }
}

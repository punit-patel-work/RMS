import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mergeTablesSchema } from '@/lib/validations';

// POST - Merge tables
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = mergeTablesSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        const { tableIds } = validation.data;
        const primaryTableId = tableIds[0];
        const otherTableIds = tableIds.slice(1);

        // Update all other tables to point to the primary table
        await prisma.$transaction([
            // Set the primary table as occupied
            prisma.table.update({
                where: { id: primaryTableId },
                data: { status: 'OCCUPIED' },
            }),
            // Link other tables to the primary table
            ...otherTableIds.map((id: string) =>
                prisma.table.update({
                    where: { id },
                    data: {
                        mergedWithId: primaryTableId,
                        status: 'OCCUPIED',
                    },
                })
            ),
        ]);

        const tables = await prisma.table.findMany({
            where: { id: { in: tableIds } },
            include: {
                mergedWith: true,
                mergedTables: true,
            },
        });

        return NextResponse.json(tables);
    } catch (error) {
        console.error('Error merging tables:', error);
        return NextResponse.json({ error: 'Failed to merge tables' }, { status: 500 });
    }
}

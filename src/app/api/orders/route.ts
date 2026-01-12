import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createOrderSchema } from '@/lib/validations';

// GET - List all orders
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const tableId = searchParams.get('tableId');

        const whereClause: Record<string, unknown> = {};
        if (status) {
            whereClause.status = status;
        }
        if (tableId) {
            whereClause.tableId = tableId;
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                table: true,
                createdBy: {
                    select: { id: true, name: true },
                },
                items: {
                    include: {
                        menuItem: true,
                    },
                },
                payment: true,
            },
        });

        return NextResponse.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}

// POST - Create a new order
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = createOrderSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        const { tableId, notes, items } = validation.data;

        // Get menu items to calculate prices
        const menuItemIds = items.map((item) => item.menuItemId);
        const menuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
        });

        const menuItemPrices: Map<string, number> = new Map(menuItems.map((item: { id: string; price: number }) => [item.id, item.price]));

        // Calculate total
        const totalAmount = items.reduce((sum: number, item: { menuItemId: string; quantity: number }) => {
            const price: number = menuItemPrices.get(item.menuItemId) || 0;
            return sum + price * item.quantity;
        }, 0);

        // Create order with items
        const order = await prisma.order.create({
            data: {
                tableId,
                notes,
                totalAmount,
                createdById: session.user.id,
                items: {
                    create: items.map((item) => ({
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        notes: item.notes,
                        allergies: item.allergies || [],
                        price: menuItemPrices.get(item.menuItemId) || 0,
                    })),
                },
            },
            include: {
                table: true,
                items: {
                    include: {
                        menuItem: true,
                    },
                },
            },
        });

        // Update table status to occupied
        await prisma.table.update({
            where: { id: tableId },
            data: { status: 'OCCUPIED' },
        });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }
}

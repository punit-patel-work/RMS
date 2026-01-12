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

        const { tableId, orderType, notes, customerName, customerPhone, surcharges, pickupTime, items } = validation.data;

        // Get menu items to calculate prices and check print stations
        const menuItemIds = items.map((item) => item.menuItemId);
        const menuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
        });

        const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

        // Calculate total (base prices + surcharges)
        const totalAmount = items.reduce((sum: number, item: { menuItemId: string; quantity: number }) => {
            const menuItem = menuItemMap.get(item.menuItemId);
            const price = menuItem?.price || 0;
            return sum + price * item.quantity;
        }, 0) + (surcharges || 0);

        // Check if any items need preparation (not NO_PRINT)
        const needsPreparation = items.some((item) => {
            const menuItem = menuItemMap.get(item.menuItemId) as { printStation?: string } | undefined;
            return menuItem?.printStation !== 'NO_PRINT';
        });

        // Determine initial order status
        // Quick Sale with all NO_PRINT items can go straight to READY
        let initialStatus: 'CREATED' | 'READY' = 'CREATED';
        if (orderType === 'QUICK_SALE' && !needsPreparation) {
            initialStatus = 'READY';
        }

        // Create order with items
        const order = await prisma.order.create({
            data: {
                tableId: tableId || undefined,
                orderType: orderType || 'DINE_IN',
                notes,
                totalAmount,
                surcharges: surcharges || 0,
                customerName: customerName || null,
                customerPhone: customerPhone || null,
                pickupTime: pickupTime ? new Date(pickupTime) : null,
                status: initialStatus,
                createdById: session.user.id,
                items: {
                    create: items.map((item) => {
                        const menuItem = menuItemMap.get(item.menuItemId) as { price?: number; printStation?: string } | undefined;
                        // Auto-mark NO_PRINT items as SERVED for Quick Sale
                        const itemStatus = (orderType === 'QUICK_SALE' && menuItem?.printStation === 'NO_PRINT')
                            ? 'SERVED'
                            : 'PENDING';
                        return {
                            menuItemId: item.menuItemId,
                            quantity: item.quantity,
                            notes: item.notes,
                            allergies: item.allergies || [],
                            price: menuItem?.price || 0,
                            status: itemStatus,
                        };
                    }),
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

        // Update table status to occupied (only for DINE_IN orders)
        if (tableId && orderType === 'DINE_IN') {
            await prisma.table.update({
                where: { id: tableId },
                data: { status: 'OCCUPIED' },
            });
        }

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }
}

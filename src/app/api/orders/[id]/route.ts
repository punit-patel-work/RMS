import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateOrderStatusSchema, addOrderItemSchema } from '@/lib/validations';

// GET - Get a single order
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id },
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

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }
}

// PUT - Update order status
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const validation = updateOrderStatusSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        const order = await prisma.order.update({
            where: { id },
            data: { status: validation.data.status },
            include: {
                table: true,
                items: {
                    include: {
                        menuItem: true,
                    },
                },
            },
        });

        return NextResponse.json(order);
    } catch (error) {
        console.error('Error updating order:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}

// POST - Add items to existing order
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const validation = addOrderItemSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        // Get menu item price
        const menuItem = await prisma.menuItem.findUnique({
            where: { id: validation.data.menuItemId },
        });

        if (!menuItem) {
            return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
        }

        // Add item to order
        const orderItem = await prisma.orderItem.create({
            data: {
                orderId: id,
                menuItemId: validation.data.menuItemId,
                quantity: validation.data.quantity,
                notes: validation.data.notes,
                allergies: validation.data.allergies || [],
                price: menuItem.price,
            },
            include: {
                menuItem: true,
            },
        });

        // Update order total
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: true,
            },
        });

        if (order) {
            const newTotal = order.items.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);
            await prisma.order.update({
                where: { id },
                data: { totalAmount: newTotal },
            });
        }

        return NextResponse.json(orderItem, { status: 201 });
    } catch (error) {
        console.error('Error adding order item:', error);
        return NextResponse.json({ error: 'Failed to add order item' }, { status: 500 });
    }
}

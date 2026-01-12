import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateOrderItemStatusSchema } from '@/lib/validations';

// PUT - Update order item status
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { itemId } = await params;
        const body = await request.json();
        const validation = updateOrderItemStatusSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        const orderItem = await prisma.orderItem.update({
            where: { id: itemId },
            data: { status: validation.data.status },
            include: {
                menuItem: true,
                order: {
                    include: {
                        table: true,
                    },
                },
            },
        });

        // If all items in the order are READY, update order status to READY
        const order = await prisma.order.findUnique({
            where: { id: orderItem.orderId },
            include: {
                items: true,
            },
        });

        if (order) {
            const allReady = order.items.every((item: { status: string }) => item.status === 'READY');
            if (allReady && order.status === 'PREPARING') {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'READY' },
                });
            }
        }

        return NextResponse.json(orderItem);
    } catch (error) {
        console.error('Error updating order item status:', error);
        return NextResponse.json({ error: 'Failed to update order item status' }, { status: 500 });
    }
}

// DELETE - Remove order item (only if PENDING)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: orderId, itemId } = await params;

        // Check if item exists and is PENDING
        const orderItem = await prisma.orderItem.findUnique({
            where: { id: itemId },
        });

        if (!orderItem) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        if (orderItem.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Can only remove items that have not been sent to kitchen' },
                { status: 400 }
            );
        }

        // Delete the item
        await prisma.orderItem.delete({
            where: { id: itemId },
        });

        // Recalculate order total
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (order) {
            const newTotal = order.items.reduce(
                (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
                0
            );
            await prisma.order.update({
                where: { id: orderId },
                data: { totalAmount: newTotal },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing order item:', error);
        return NextResponse.json({ error: 'Failed to remove order item' }, { status: 500 });
    }
}

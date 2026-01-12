import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPaymentSchema } from '@/lib/validations';

// POST - Process payment
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = createPaymentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues }, { status: 400 });
        }

        const { orderId, amount, method } = validation.data;

        // Check if order exists and is not already paid
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                table: true,
                payment: true,
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.payment) {
            return NextResponse.json({ error: 'Order already paid' }, { status: 400 });
        }

        // Create payment and update order status
        const payment = await prisma.payment.create({
            data: {
                orderId,
                amount,
                method,
            },
        });

        // Update order status to PAID
        await prisma.order.update({
            where: { id: orderId },
            data: { status: 'PAID' },
        });

        // Only update table status if order has a table (not Quick Sale or To-Go)
        if (order.tableId) {
            // Update table status to VACANT (ready for new guests)
            await prisma.table.update({
                where: { id: order.tableId },
                data: { status: 'VACANT' },
            });

            // Unmerge any tables if this was a merged table
            await prisma.table.updateMany({
                where: { mergedWithId: order.tableId },
                data: {
                    mergedWithId: null,
                    status: 'VACANT',
                },
            });
        }

        return NextResponse.json(payment, { status: 201 });
    } catch (error) {
        console.error('Error processing payment:', error);
        return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
    }
}

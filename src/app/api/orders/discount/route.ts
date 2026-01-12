import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST - Apply discount to order
export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role as string;
        const body = await request.json();
        const { orderId, discountType, discountValue, discountReason } = body;

        // Check if this is a bundle/promotion discount (allow all staff to apply these)
        const isBundleDiscount = discountReason && (
            discountReason.toLowerCase().includes('bundle') ||
            discountReason.toLowerCase().includes('deal') ||
            discountReason.toLowerCase().includes('meal') ||
            discountReason.toLowerCase().includes('promotion')
        );

        // Only OWNER and SUPERVISOR can apply manual discounts
        // But all staff can apply bundle/promotion discounts
        if (!['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'].includes(userRole)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Floor staff can only apply bundle discounts, not manual discounts
        if (userRole === 'FLOOR_STAFF' && !isBundleDiscount) {
            return NextResponse.json({ error: 'Only Owner or Supervisor can apply manual discounts' }, { status: 403 });
        }

        if (!orderId || !discountType || discountValue === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get the order
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Calculate subtotal from items
        const subtotal = order.items.reduce(
            (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
            0
        );

        // Parse discount value as float
        const parsedDiscountValue = parseFloat(String(discountValue));

        // Calculate discount amount
        let discountAmount = 0;
        if (discountType === 'PERCENTAGE') {
            discountAmount = (subtotal * parsedDiscountValue) / 100;
        } else if (discountType === 'FIXED') {
            discountAmount = parsedDiscountValue;
        }

        // Ensure discount doesn't exceed subtotal
        discountAmount = Math.min(discountAmount, subtotal);

        // Calculate new total (subtotal - discount)
        const newTotal = Math.max(0, subtotal - discountAmount);

        // Update the order using raw SQL to avoid Prisma type issues
        await prisma.$executeRaw`
            UPDATE orders 
            SET "discountType" = ${String(discountType)},
                "discountValue" = ${parsedDiscountValue},
                "discountReason" = ${discountReason ? String(discountReason) : null},
                "discountAppliedBy" = ${session.user.id},
                "totalAmount" = ${newTotal},
                "updatedAt" = NOW()
            WHERE id = ${orderId}
        `;

        // Fetch updated order
        const updatedOrder = await prisma.order.findUnique({
            where: { id: orderId },
        });

        return NextResponse.json({
            success: true,
            order: updatedOrder,
            discountAmount,
        });
    } catch (error) {
        console.error('Error applying discount:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to apply discount: ${errorMessage}` }, { status: 500 });
    }
}

// DELETE - Remove discount from order
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role as string;
        if (!['OWNER', 'SUPERVISOR'].includes(userRole)) {
            return NextResponse.json({ error: 'Only Owner or Supervisor can remove discounts' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('orderId');

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        // Get the order
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Recalculate total without discount
        const subtotal = order.items.reduce(
            (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
            0
        );

        // Update the order using raw SQL
        await prisma.$executeRaw`
            UPDATE orders 
            SET "discountType" = NULL,
                "discountValue" = NULL,
                "discountReason" = NULL,
                "discountAppliedBy" = NULL,
                "totalAmount" = ${subtotal},
                "updatedAt" = NOW()
            WHERE id = ${orderId}
        `;

        // Fetch updated order
        const updatedOrder = await prisma.order.findUnique({
            where: { id: orderId },
        });

        return NextResponse.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('Error removing discount:', error);
        return NextResponse.json({ error: 'Failed to remove discount' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all promotions
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const promotions = await prisma.promotion.findMany({
            include: {
                menuItems: {
                    select: { id: true, name: true, price: true },
                },
                createdBy: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(promotions);
    } catch (error) {
        console.error('Error fetching promotions:', error);
        return NextResponse.json({ error: 'Failed to fetch promotions' }, { status: 500 });
    }
}

// POST - Create new promotion (Owner/Supervisor only)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role as string;
        if (!['OWNER', 'SUPERVISOR'].includes(userRole)) {
            return NextResponse.json({ error: 'Only Owner or Supervisor can create promotions' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, type, value, bundlePrice, startDate, endDate, menuItemIds } = body;

        if (!name || !type || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate type
        if (!['PERCENTAGE', 'FIXED', 'BUNDLE'].includes(type)) {
            return NextResponse.json({ error: 'Invalid promotion type' }, { status: 400 });
        }

        // For BUNDLE type, bundlePrice is required
        if (type === 'BUNDLE' && !bundlePrice) {
            return NextResponse.json({ error: 'Bundle price is required for bundle deals' }, { status: 400 });
        }

        // For PERCENTAGE and FIXED, value is required
        if ((type === 'PERCENTAGE' || type === 'FIXED') && !value) {
            return NextResponse.json({ error: 'Discount value is required' }, { status: 400 });
        }

        const promotion = await prisma.promotion.create({
            data: {
                name,
                description: description || null,
                type,
                value: value || 0,
                bundlePrice: bundlePrice || null,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                createdById: session.user.id,
                menuItems: menuItemIds?.length
                    ? { connect: menuItemIds.map((id: string) => ({ id })) }
                    : undefined,
            },
            include: {
                menuItems: {
                    select: { id: true, name: true, price: true },
                },
                createdBy: {
                    select: { id: true, name: true },
                },
            },
        });

        // Update menu items for FIXED/PERCENTAGE promotions  
        if ((type === 'FIXED' || type === 'PERCENTAGE') && menuItemIds?.length > 0) {
            const itemsToUpdate = await prisma.menuItem.findMany({
                where: { id: { in: menuItemIds } },
                select: { id: true, price: true },
            });

            for (const item of itemsToUpdate) {
                let promotionalPrice: number;
                if (type === 'PERCENTAGE') {
                    promotionalPrice = item.price * (1 - value / 100);
                } else {
                    promotionalPrice = Math.max(0, item.price - value);
                }

                await prisma.menuItem.update({
                    where: { id: item.id },
                    data: { isPromotional: true, promotionalPrice },
                });
            }
        }

        return NextResponse.json(promotion, { status: 201 });
    } catch (error) {
        console.error('Error creating promotion:', error);
        return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 });
    }
}

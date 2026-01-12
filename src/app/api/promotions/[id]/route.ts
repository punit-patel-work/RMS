import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get single promotion
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


        const promotion = await prisma.promotion.findUnique({
            where: { id },
            include: {
                menuItems: {
                    select: { id: true, name: true, price: true },
                },
                createdBy: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!promotion) {
            return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
        }

        return NextResponse.json(promotion);
    } catch (error) {
        console.error('Error fetching promotion:', error);
        return NextResponse.json({ error: 'Failed to fetch promotion' }, { status: 500 });
    }
}

// PUT - Update promotion
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role as string;
        if (!['OWNER', 'SUPERVISOR'].includes(userRole)) {
            return NextResponse.json({ error: 'Only Owner or Supervisor can update promotions' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, description, type, value, bundlePrice, startDate, endDate, isActive, menuItemIds } = body;

        // Get current promotion to find previously linked items
        const currentPromotion = await prisma.promotion.findUnique({
            where: { id },
            include: { menuItems: { select: { id: true, price: true } } },
        });

        // Build update data
        const updateData: Record<string, unknown> = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (value !== undefined) updateData.value = value;
        if (bundlePrice !== undefined) updateData.bundlePrice = bundlePrice;
        if (startDate !== undefined) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = new Date(endDate);
        if (isActive !== undefined) updateData.isActive = isActive;

        // Handle menu items update
        if (menuItemIds !== undefined) {
            updateData.menuItems = {
                set: menuItemIds.map((itemId: string) => ({ id: itemId })),
            };
        }

        const promotion = await prisma.promotion.update({
            where: { id },
            data: updateData,
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
        const promoType = type ?? currentPromotion?.type ?? promotion.type;
        const promoValue = value ?? promotion.value;
        const promoIsActive = isActive ?? promotion.isActive;
        const now = new Date();
        const promoEndDate = endDate ? new Date(endDate) : new Date(promotion.endDate);
        const isValidPromo = promoIsActive && promoEndDate > now;

        if (menuItemIds !== undefined) {
            // Clear promotional status from previously linked items that are no longer in the promotion
            const previousItemIds = currentPromotion?.menuItems.map(m => m.id) || [];
            const removedItemIds = previousItemIds.filter(prevId => !menuItemIds.includes(prevId));

            if (removedItemIds.length > 0) {
                await prisma.menuItem.updateMany({
                    where: { id: { in: removedItemIds } },
                    data: { isPromotional: false, promotionalPrice: null },
                });
            }

            // Set promotional status for new items in FIXED/PERCENTAGE promotions
            if ((promoType === 'FIXED' || promoType === 'PERCENTAGE') && menuItemIds.length > 0 && isValidPromo) {
                // Get the items to update with their prices
                const itemsToUpdate = await prisma.menuItem.findMany({
                    where: { id: { in: menuItemIds } },
                    select: { id: true, price: true },
                });

                for (const item of itemsToUpdate) {
                    let promotionalPrice: number;
                    if (promoType === 'PERCENTAGE') {
                        promotionalPrice = item.price * (1 - promoValue / 100);
                    } else {
                        promotionalPrice = Math.max(0, item.price - promoValue);
                    }

                    await prisma.menuItem.update({
                        where: { id: item.id },
                        data: { isPromotional: true, promotionalPrice },
                    });
                }
            } else if (!isValidPromo && menuItemIds.length > 0) {
                // Clear promotional status if promotion is deactivated or expired
                await prisma.menuItem.updateMany({
                    where: { id: { in: menuItemIds } },
                    data: { isPromotional: false, promotionalPrice: null },
                });
            }
        }

        return NextResponse.json(promotion);
    } catch (error) {
        console.error('Error updating promotion:', error);
        return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 });
    }
}

// DELETE - Delete promotion
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role as string;
        if (!['OWNER', 'SUPERVISOR'].includes(userRole)) {
            return NextResponse.json({ error: 'Only Owner or Supervisor can delete promotions' }, { status: 403 });
        }

        const { id } = await params;

        // Get promotion with its menu items before deleting
        const promotion = await prisma.promotion.findUnique({
            where: { id },
            include: { menuItems: { select: { id: true } } },
        });

        if (promotion && promotion.menuItems.length > 0) {
            // Clear promotional status from menu items
            await prisma.menuItem.updateMany({
                where: { id: { in: promotion.menuItems.map(m => m.id) } },
                data: { isPromotional: false, promotionalPrice: null },
            });
        }

        await prisma.promotion.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting promotion:', error);
        return NextResponse.json({ error: 'Failed to delete promotion' }, { status: 500 });
    }
}

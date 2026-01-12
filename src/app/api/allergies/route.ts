import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all allergies
export async function GET() {
    try {
        const allergies = await prisma.allergy.findMany({
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(allergies);
    } catch (error) {
        console.error('Error fetching allergies:', error);
        return NextResponse.json({ error: 'Failed to fetch allergies' }, { status: 500 });
    }
}

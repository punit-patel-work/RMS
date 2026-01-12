import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

// POST - Send daily summary email
export async function POST() {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized - Owner only' }, { status: 401 });
        }

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get today's paid orders
        const orders = await prisma.order.findMany({
            where: {
                status: 'PAID',
                payment: {
                    createdAt: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
            },
            include: {
                payment: true,
                items: {
                    include: {
                        menuItem: true,
                    },
                },
            },
        });


        const totalSales = orders.reduce((sum: number, order: { payment?: { amount: number } | null }) => sum + (order.payment?.amount || 0), 0);
        const totalOrders = orders.length;

        // Get popular items
        const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {};
        orders.forEach((order: { items: { menuItem: { name: string }; quantity: number; price: number }[] }) => {
            order.items.forEach((item: { menuItem: { name: string }; quantity: number; price: number }) => {
                const name = item.menuItem.name;
                if (!itemCounts[name]) {
                    itemCounts[name] = { name, count: 0, revenue: 0 };
                }
                itemCounts[name].count += item.quantity;
                itemCounts[name].revenue += item.price * item.quantity;
            });
        });


        const popularItems = Object.values(itemCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Create or update daily summary
        await prisma.dailySummary.upsert({
            where: { date: today },
            update: {
                totalSales,
                totalOrders,
                emailSent: true,
                emailSentAt: new Date(),
            },
            create: {
                date: today,
                totalSales,
                totalOrders,
                emailSent: true,
                emailSentAt: new Date(),
            },
        });

        // Send email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
        });

        const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #1e293b; color: #e2e8f0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #f97316, #d97706); padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .header h1 { color: white; margin: 0; }
          .content { background-color: #334155; padding: 20px; border-radius: 0 0 8px 8px; }
          .stat-box { background-color: #475569; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #f97316; }
          .stat-label { color: #94a3b8; font-size: 14px; }
          .item-list { margin-top: 20px; }
          .item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #475569; }
          .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍽️ Daily Summary</h1>
            <p style="color: white; margin: 5px 0 0 0;">${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="content">
            <div class="stat-box">
              <div class="stat-value">$${totalSales.toFixed(2)}</div>
              <div class="stat-label">Total Sales</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalOrders}</div>
              <div class="stat-label">Orders Completed</div>
            </div>
            ${popularItems.length > 0 ? `
              <h3 style="color: #e2e8f0; margin-top: 20px;">🔥 Top Selling Items</h3>
              <div class="item-list">
                ${popularItems.map((item, index) => `
                  <div class="item">
                    <span>${index + 1}. ${item.name} (x${item.count})</span>
                    <span style="color: #f97316;">$${item.revenue.toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p style="color: #94a3b8;">No orders today</p>'}
          </div>
          <div class="footer">
            <p>Restaurant Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: process.env.OWNER_EMAIL || session.user.email,
            subject: `Daily Summary - ${today.toLocaleDateString()}`,
            html: emailHtml,
        });

        return NextResponse.json({
            success: true,
            summary: {
                date: today,
                totalSales,
                totalOrders,
                popularItems,
            },
        });
    } catch (error) {
        console.error('Error sending daily summary:', error);
        return NextResponse.json(
            { error: 'Failed to send daily summary. Check SMTP configuration.' },
            { status: 500 }
        );
    }
}

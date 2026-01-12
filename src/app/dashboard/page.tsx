import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, UtensilsCrossed, TableProperties, ClipboardList, 
  TrendingUp, Users, DollarSign, Clock, CheckCircle, AlertTriangle,
  Receipt, Timer, Utensils
} from 'lucide-react';
import Link from 'next/link';

// Types for dashboard data
interface TableData {
  id: string;
  status: string;
}

interface OrderItem {
  id: string;
  menuItem: { name: string };
  order: { table?: { number: number } | null };
}

interface ActiveOrder {
  id: string;
  status: string;
  createdAt: Date;
  items: { id: string }[];
  table?: { number: number } | null;
}

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role;
  const isAdmin = role === 'OWNER' || role === 'SUPERVISOR';
  const isFloorStaff = role === 'FLOOR_STAFF' || isAdmin;
  const isKitchenStaff = role === 'KITCHEN_STAFF' || isAdmin;

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Fetch real stats
  const [tables, activeOrders, todayOrders, readyItems] = await Promise.all([
    prisma.table.findMany({ where: { mergedWithId: null } }),
    prisma.order.findMany({
      where: { status: { in: ['CREATED', 'PREPARING', 'READY', 'SERVED'] } },
      include: { items: true, table: true },
    }),
    prisma.order.findMany({
      where: {
        status: 'PAID',
        payment: { createdAt: { gte: today, lt: tomorrow } },
      },
      include: { payment: true },
    }),
    prisma.orderItem.findMany({
      where: { status: 'READY' },
      include: { menuItem: true, order: { include: { table: true } } },
    }),
  ]);

  // Calculate stats
  const totalSales = todayOrders.reduce((sum: number, order: { payment?: { amount: number } | null }) => 
    sum + (order.payment?.amount || 0), 0
  );
  const occupiedTables = tables.filter((t: TableData) => t.status === 'OCCUPIED').length;
  const dirtyTables = tables.filter((t: TableData) => t.status === 'DIRTY').length;
  const pendingOrders = activeOrders.filter((o: ActiveOrder) => o.status === 'CREATED').length;
  const preparingOrders = activeOrders.filter((o: ActiveOrder) => o.status === 'PREPARING').length;

  const quickActions = [
    ...(isAdmin
      ? [
          {
            title: 'Menu Management',
            description: 'Add, edit, or remove menu items',
            icon: UtensilsCrossed,
            href: '/dashboard/menu',
            color: 'from-orange-500 to-amber-600',
          },
          {
            title: 'Staff Management',
            description: 'Manage staff accounts and roles',
            icon: Users,
            href: '/dashboard/staff',
            color: 'from-blue-500 to-cyan-600',
          },
          {
            title: 'Analytics',
            description: 'View sales and performance',
            icon: TrendingUp,
            href: '/dashboard/analytics',
            color: 'from-purple-500 to-pink-600',
          },
        ]
      : []),
    ...(isFloorStaff
      ? [
          {
            title: 'Tables',
            description: 'View and manage table status',
            icon: TableProperties,
            href: '/dashboard/tables',
            color: 'from-green-500 to-emerald-600',
          },
          {
            title: 'Orders',
            description: 'Active orders overview',
            icon: ClipboardList,
            href: '/dashboard/orders',
            color: 'from-indigo-500 to-violet-600',
          },
        ]
      : []),
    ...(isKitchenStaff
      ? [
          {
            title: 'Kitchen Display',
            description: 'View and manage incoming orders',
            icon: LayoutDashboard,
            href: '/dashboard/kitchen',
            color: 'from-red-500 to-rose-600',
          },
        ]
      : []),
  ];

  // Get current time for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {greeting}, {session?.user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-slate-400 mt-1">Here&apos;s what&apos;s happening today</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-lg font-semibold text-orange-400">
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Alert Banners */}
      {readyItems.length > 0 && isFloorStaff && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
          <div className="bg-green-500 rounded-full p-2 animate-pulse">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-green-400 font-semibold">{readyItems.length} items ready to serve!</p>
            <p className="text-green-300/80 text-sm">
              {readyItems.slice(0, 3).map((item: OrderItem) => `${item.menuItem.name} (Table ${item.order.table?.number})`).join(', ')}
              {readyItems.length > 3 && `, and ${readyItems.length - 3} more...`}
            </p>
          </div>
          <Link href="/dashboard/orders" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            View Orders
          </Link>
        </div>
      )}

      {dirtyTables > 0 && isFloorStaff && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 flex items-center gap-3">
          <div className="bg-amber-500 rounded-full p-2">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-amber-400 font-semibold">{dirtyTables} tables need cleaning</p>
            <p className="text-amber-300/80 text-sm">Mark as vacant when ready</p>
          </div>
          <Link href="/dashboard/tables" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            View Tables
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 transition-all duration-200 cursor-pointer group h-full">
                <CardHeader className="pb-3">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-200`}
                  >
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-white group-hover:text-orange-400 transition-colors">
                    {action.title}
                  </CardTitle>
                  <CardDescription className="text-slate-400">{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats - Show to everyone with role-appropriate data */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Today&apos;s Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sales - Admin only */}
          {isAdmin && (
            <Card className="bg-gradient-to-br from-green-500/20 to-emerald-600/10 border-green-500/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-green-300">Today&apos;s Sales</CardDescription>
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <CardTitle className="text-3xl text-white">${totalSales.toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-green-300/70">{todayOrders.length} orders completed</p>
              </CardContent>
            </Card>
          )}

          {/* Active Orders */}
          <Card className="bg-gradient-to-br from-orange-500/20 to-amber-600/10 border-orange-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-orange-300">Active Orders</CardDescription>
                <Receipt className="w-5 h-5 text-orange-400" />
              </div>
              <CardTitle className="text-3xl text-white">{activeOrders.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {pendingOrders > 0 && <Badge className="bg-slate-600 text-xs">{pendingOrders} pending</Badge>}
                {preparingOrders > 0 && <Badge className="bg-orange-500 text-xs">{preparingOrders} preparing</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Table Status */}
          <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-600/10 border-blue-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-blue-300">Tables</CardDescription>
                <TableProperties className="w-5 h-5 text-blue-400" />
              </div>
              <CardTitle className="text-3xl text-white">
                {occupiedTables} / {tables.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-blue-300/70">
                {tables.length - occupiedTables - dirtyTables} available
                {dirtyTables > 0 && `, ${dirtyTables} need cleaning`}
              </p>
            </CardContent>
          </Card>

          {/* Ready to Serve */}
          <Card className={`bg-gradient-to-br ${readyItems.length > 0 ? 'from-green-500/30 to-emerald-600/20 border-green-500/50' : 'from-slate-500/20 to-slate-600/10 border-slate-500/30'}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className={readyItems.length > 0 ? 'text-green-300' : 'text-slate-400'}>Ready to Serve</CardDescription>
                <Utensils className={`w-5 h-5 ${readyItems.length > 0 ? 'text-green-400' : 'text-slate-500'}`} />
              </div>
              <CardTitle className="text-3xl text-white">{readyItems.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-xs ${readyItems.length > 0 ? 'text-green-300/70' : 'text-slate-500'}`}>
                {readyItems.length > 0 ? 'Items waiting to be served' : 'No items ready'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Orders List - For Floor Staff */}
      {isFloorStaff && activeOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Current Orders</h2>
            <Link href="/dashboard/orders" className="text-orange-400 hover:text-orange-300 text-sm">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.slice(0, 6).map((order: ActiveOrder) => (
              <Card key={order.id} className={`bg-slate-800/50 border-slate-700/50 ${
                order.status === 'READY' ? 'ring-2 ring-green-500/50' : ''
              }`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">Table {order.table?.number}</CardTitle>
                    <Badge className={
                      order.status === 'READY' ? 'bg-green-500' :
                      order.status === 'PREPARING' ? 'bg-orange-500' :
                      order.status === 'SERVED' ? 'bg-blue-500' :
                      'bg-slate-600'
                    }>
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-sm">{order.items.length} items</p>
                  <div className="flex items-center gap-2 mt-2 text-slate-500 text-xs">
                    <Timer className="w-3 h-3" />
                    <span>{Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000)} min ago</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Kitchen Quick Stats - For Kitchen Staff */}
      {isKitchenStaff && !isFloorStaff && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Kitchen Queue</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <CardDescription className="text-slate-400">Pending</CardDescription>
                    <CardTitle className="text-2xl text-white">{pendingOrders}</CardTitle>
                  </div>
                </div>
              </CardHeader>
            </Card>
            <Card className="bg-slate-800/50 border-orange-500/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Utensils className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <CardDescription className="text-orange-300">Preparing</CardDescription>
                    <CardTitle className="text-2xl text-white">{preparingOrders}</CardTitle>
                  </div>
                </div>
              </CardHeader>
            </Card>
            <Card className="bg-slate-800/50 border-green-500/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <CardDescription className="text-green-300">Ready</CardDescription>
                    <CardTitle className="text-2xl text-white">{readyItems.length}</CardTitle>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Clock, ClipboardList, CheckCircle2, Utensils, Bell, Package, Zap, TableProperties } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: number;
  orderType: 'DINE_IN' | 'TO_GO' | 'QUICK_SALE';
  status: string;
  totalAmount: number;
  notes: string | null;
  customerName: string | null;
  createdAt: string;
  table: {
    number: number;
  } | null;
  createdBy: {
    name: string;
  };
  items: {
    id: string;
    quantity: number;
    notes: string | null;
    status: string;
    menuItem: {
      name: string;
    };
  }[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      // Filter out ghost orders (pending payment, failed, cancelled)
      const validOrders = data.filter((o: Order) => 
        !['PENDING_PAYMENT', 'FAILED', 'CANCELLED'].includes(o.status)
      );
      // Sort by creation date, newest first
      setOrders(validOrders.sort((a: Order, b: Order) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Filter orders by type
  const filteredOrders = useMemo(() => {
    if (typeFilter === 'all') return orders;
    if (typeFilter === 'dine-in') return orders.filter(o => o.orderType === 'DINE_IN');
    if (typeFilter === 'to-go') return orders.filter(o => o.orderType === 'TO_GO');
    if (typeFilter === 'quick-sale') return orders.filter(o => o.orderType === 'QUICK_SALE');
    return orders;
  }, [orders, typeFilter]);

  // Categorize by status
  const readyOrders = useMemo(() => 
    filteredOrders.filter((o) => o.status === 'READY'),
    [filteredOrders]
  );
  
  const activeOrders = useMemo(() => 
    filteredOrders.filter((o) => ['CREATED', 'PREPARING'].includes(o.status)),
    [filteredOrders]
  );
  
  const servedOrders = useMemo(() => 
    filteredOrders.filter((o) => o.status === 'SERVED'),
    [filteredOrders]
  );
  
  const paidOrders = useMemo(() => 
    filteredOrders.filter((o) => o.status === 'PAID').slice(0, 20),
    [filteredOrders]
  );

  // Count by type
  const typeCounts = useMemo(() => ({
    all: orders.length,
    dineIn: orders.filter(o => o.orderType === 'DINE_IN').length,
    toGo: orders.filter(o => o.orderType === 'TO_GO').length,
    quickSale: orders.filter(o => o.orderType === 'QUICK_SALE').length,
  }), [orders]);

  const markAsServed = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SERVED' }),
      });
      if (!res.ok) throw new Error('Failed to update order');
      toast.success('Order marked as served');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PREPARING': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'READY': return 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse';
      case 'SERVED': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'PAID': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Order Type Badge Colors
  const getTypeBadge = (orderType: string) => {
    switch (orderType) {
      case 'DINE_IN': 
        return { className: 'bg-violet-500 text-white', icon: '🍽️', label: 'Dine-In' };
      case 'TO_GO': 
        return { className: 'bg-orange-500 text-white', icon: '📦', label: 'To-Go' };
      case 'QUICK_SALE': 
        return { className: 'bg-cyan-500 text-white', icon: '⚡', label: 'Quick Sale' };
      default:
        return { className: 'bg-slate-500 text-white', icon: '', label: orderType };
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-slate-600 text-slate-300';
      case 'PREPARING': return 'bg-orange-600 text-white';
      case 'READY': return 'bg-green-600 text-white';
      case 'SERVED': return 'bg-purple-600 text-white';
      default: return 'bg-slate-600 text-slate-300';
    }
  };

  const getTimeSince = (date: string) => {
    const now = new Date();
    const created = new Date(date);
    const diff = Math.floor((now.getTime() - created.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const renderOrderTitle = (order: Order) => {
    if (order.orderType === 'TO_GO') {
      return (
        <span className="flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-400" />
          {order.customerName || 'To-Go'}
        </span>
      );
    }
    if (order.orderType === 'QUICK_SALE') {
      return (
        <span className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" />
          Quick Sale
        </span>
      );
    }
    return (
      <span className="flex items-center gap-2">
        <TableProperties className="w-5 h-5 text-violet-400" />
        Table {order.table?.number || '-'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mx-4 lg:mx-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-orange-500" />
            Orders
          </h1>
          <p className="text-slate-400 mt-1">Manage and track all orders</p>
        </div>
        {readyOrders.length > 0 && (
          <Badge className="bg-green-500 text-white animate-bounce px-4 py-2 text-sm">
            <Bell className="w-4 h-4 mr-2" />
            {readyOrders.length} Ready to Serve
          </Badge>
        )}
      </div>

      {/* Order Type Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            typeFilter === 'all' 
              ? 'bg-orange-500 text-white' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All Orders
          <Badge className="bg-white/20">{typeCounts.all}</Badge>
        </button>
        <button
          onClick={() => setTypeFilter('dine-in')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            typeFilter === 'dine-in' 
              ? 'bg-violet-500 text-white' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          🍽️ Dining Room
          <Badge className="bg-white/20">{typeCounts.dineIn}</Badge>
        </button>
        <button
          onClick={() => setTypeFilter('to-go')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            typeFilter === 'to-go' 
              ? 'bg-orange-500 text-white' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          📦 Takeout
          <Badge className="bg-white/20">{typeCounts.toGo}</Badge>
        </button>
        <button
          onClick={() => setTypeFilter('quick-sale')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            typeFilter === 'quick-sale' 
              ? 'bg-cyan-500 text-white' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          ⚡ Counter
          <Badge className="bg-white/20">{typeCounts.quickSale}</Badge>
        </button>
      </div>

      {/* Ready to Serve Section */}
      {readyOrders.length > 0 && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            🔔 Ready to Serve
            <Badge className="ml-2 bg-green-500 text-white">{readyOrders.length}</Badge>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyOrders.map((order) => {
              const typeBadge = getTypeBadge(order.orderType);
              return (
                <Card key={order.id} className="bg-slate-800/80 border-green-500/50 border-2 shadow-lg shadow-green-500/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-lg">
                        {renderOrderTitle(order)}
                        <span className="text-slate-500 font-normal ml-2">#{order.orderNumber}</span>
                      </CardTitle>
                      <Badge className={typeBadge.className}>
                        {typeBadge.icon} {typeBadge.label}
                      </Badge>
                    </div>
                    {order.orderType === 'TO_GO' && order.customerName && (
                      <p className="text-orange-300 text-sm font-medium">{order.customerName}</p>
                    )}
                    <CardDescription className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeSince(order.createdAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm mb-4">
                      {order.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-slate-300">
                          <span>{item.quantity}x {item.menuItem.name}</span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-slate-500">+{order.items.length - 3} more items</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-400">Total</span>
                      <span className="text-lg font-bold text-emerald-400">${order.totalAmount.toFixed(2)}</span>
                    </div>
                    <Button 
                      onClick={() => markAsServed(order.id)}
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                    >
                      <Utensils className="w-4 h-4 mr-2" />
                      {order.orderType === 'TO_GO' ? 'Hand to Customer' : 'Mark as Served'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Orders */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Active Orders
          <Badge className="ml-2 bg-orange-500 text-white">{activeOrders.length + servedOrders.length}</Badge>
        </h2>
        {activeOrders.length === 0 && servedOrders.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No active orders</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...activeOrders, ...servedOrders].map((order) => {
              const typeBadge = getTypeBadge(order.orderType);
              return (
                <Card key={order.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white flex items-center gap-2">
                        {renderOrderTitle(order)}
                        <span className="text-slate-500 font-normal ml-2">#{order.orderNumber}</span>
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge className={typeBadge.className + ' text-xs'}>
                          {typeBadge.icon}
                        </Badge>
                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      </div>
                    </div>
                    {order.orderType === 'TO_GO' && order.customerName && (
                      <p className="text-orange-300 text-sm">{order.customerName}</p>
                    )}
                    <CardDescription className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeSince(order.createdAt)} • {order.createdBy.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      {order.items.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-slate-300">
                          <span>{item.quantity}x {item.menuItem.name}</span>
                          <Badge className={`text-xs ${getItemStatusBadge(item.status)}`}>
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                      {order.items.length > 4 && (
                        <p className="text-slate-500">+{order.items.length - 4} more items</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                      <span className="text-slate-400 text-sm">Total</span>
                      <span className="text-lg font-bold text-emerald-400">${order.totalAmount.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Orders */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          Completed Today
          <Badge className="ml-2 bg-emerald-500/30 text-emerald-400">{paidOrders.length}</Badge>
        </h2>
        {paidOrders.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-8 text-center">
              <p className="text-slate-500">No completed orders yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {paidOrders.map((order) => {
              const typeBadge = getTypeBadge(order.orderType);
              return (
                <Card key={order.id} className="bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 transition-all">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <Badge className={typeBadge.className + ' text-xs'}>
                        {typeBadge.icon} {typeBadge.label}
                      </Badge>
                      <span className="text-white font-medium">
                        {order.orderType === 'TO_GO' ? order.customerName || 'To-Go' : 
                         order.orderType === 'QUICK_SALE' ? 'Counter Sale' :
                         order.table ? `Table ${order.table.number}` : 'Order'}
                      </span>
                      <span className="text-slate-500 text-sm">#{order.orderNumber}</span>
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-slate-400 text-sm">{getTimeSince(order.createdAt)}</span>
                      <span className="text-emerald-400 font-bold">${order.totalAmount.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

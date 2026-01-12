'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Clock, ClipboardList, CheckCircle2, Utensils, Bell } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: number;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  table: {
    number: number;
  };
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

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      // Sort by creation date, newest first
      setOrders(data.sort((a: Order, b: Order) => 
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
      case 'CANCELLED': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Separate ready orders for prominent display
  const readyOrders = orders.filter((o) => o.status === 'READY');
  const otherActiveOrders = orders.filter((o) => ['CREATED', 'PREPARING', 'SERVED'].includes(o.status));
  const completedOrders = orders.filter((o) => ['PAID', 'CANCELLED'].includes(o.status));

  return (
    <div className="space-y-8 mx-4 lg:mx-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-orange-500" />
            Orders
          </h1>
          <p className="text-slate-400 mt-1">Manage and track all orders</p>
        </div>
        <div className="flex items-center gap-3">
          {readyOrders.length > 0 && (
            <Badge className="bg-green-500 text-white animate-bounce px-4 py-2 text-sm">
              <Bell className="w-4 h-4 mr-2" />
              {readyOrders.length} Ready to Serve
            </Badge>
          )}
        </div>
      </div>

      {/* Ready to Serve Section - Prominent Display for Floor Staff */}
      {readyOrders.length > 0 && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            🔔 Ready to Serve
            <Badge className="ml-2 bg-green-500 text-white">{readyOrders.length}</Badge>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyOrders.map((order) => (
              <Card key={order.id} className="bg-slate-800/80 border-green-500/50 border-2 shadow-lg shadow-green-500/10 hover:shadow-green-500/20 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-green-400" />
                      Table {order.table.number}
                      <span className="text-slate-500 font-normal text-sm">#{order.orderNumber}</span>
                    </CardTitle>
                    <Badge className="bg-green-500 text-white animate-pulse">READY</Badge>
                  </div>
                  <CardDescription className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getTimeSince(order.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{item.quantity}x</span> {item.menuItem.name}
                        </span>
                        <Badge className={`text-xs ${getItemStatusBadge(item.status)}`}>
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => markAsServed(order.id)} 
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Served
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other Active Orders */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-500" />
          Active Orders
          <Badge variant="outline" className="ml-2 text-slate-400 border-slate-600">{otherActiveOrders.length}</Badge>
        </h2>

        {otherActiveOrders.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No active orders</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherActiveOrders.map((order) => (
              <Card key={order.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">
                      Table {order.table.number}
                      <span className="text-slate-500 font-normal ml-2">#{order.orderNumber}</span>
                    </CardTitle>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  </div>
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
                      <p className="text-slate-500 text-xs">+{order.items.length - 4} more items</p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Total</span>
                    <span className="text-orange-400 font-bold text-lg">${order.totalAmount.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Orders */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          Completed Orders
          <Badge variant="outline" className="ml-2 text-slate-400 border-slate-600">{completedOrders.length}</Badge>
        </h2>

        {completedOrders.length === 0 ? (
          <Card className="bg-slate-800/30 border-slate-700/50">
            <CardContent className="py-8 text-center text-slate-500">
              No completed orders today
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {completedOrders.slice(0, 10).map((order) => (
              <Card key={order.id} className="bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 transition-all">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="text-white font-medium">Table {order.table.number}</span>
                    <span className="text-slate-500 text-sm">#{order.orderNumber}</span>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-slate-400 text-sm">{getTimeSince(order.createdAt)}</span>
                    <span className="text-emerald-400 font-bold">${order.totalAmount.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

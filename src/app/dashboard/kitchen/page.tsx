'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Clock, AlertTriangle, ChefHat, Check } from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  allergies: string[];
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
  price: number;
  menuItem: {
    id: string;
    name: string;
  };
}

interface Order {
  id: string;
  orderNumber: number;
  status: string;
  notes: string | null;
  createdAt: string;
  table: {
    number: number;
  };
  items: OrderItem[];
}

interface Allergy {
  id: string;
  name: string;
  badge: string;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, allergiesRes] = await Promise.all([
        fetch('/api/orders?status=CREATED'),
        fetch('/api/allergies'),
      ]);
      
      // Also fetch PREPARING orders
      const preparingRes = await fetch('/api/orders?status=PREPARING');
      
      const createdOrders = await ordersRes.json();
      const preparingOrders = await preparingRes.json();
      const allAllergies = await allergiesRes.json();
      
      setOrders([...createdOrders, ...preparingOrders].sort(
        (a: Order, b: Order) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
      setAllergies(allAllergies);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update order');
      toast.success(`Order marked as ${status.toLowerCase()}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setUpdating(null);
    }
  };

  const updateItemStatus = async (orderId: string, itemId: string, status: string) => {
    setUpdating(itemId);
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      toast.success(`Item marked as ${status.toLowerCase()}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update item');
    } finally {
      setUpdating(null);
    }
  };

  const markAllReady = async (order: Order) => {
    setUpdating(order.id);
    try {
      // Mark all items as ready
      await Promise.all(
        order.items
          .filter((item) => item.status !== 'READY')
          .map((item) =>
            fetch(`/api/orders/${order.id}/items/${item.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'READY' }),
            })
          )
      );
      
      // Mark order as ready
      await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY' }),
      });
      
      toast.success('Order marked as ready!');
      fetchData();
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setUpdating(null);
    }
  };

  const getTimeSince = (date: string) => {
    const now = new Date();
    const created = new Date(date);
    const diff = Math.floor((now.getTime() - created.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
  };

  const getTimeColor = (date: string) => {
    const now = new Date();
    const created = new Date(date);
    const diff = Math.floor((now.getTime() - created.getTime()) / 60000);
    if (diff < 10) return 'text-green-400';
    if (diff < 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const allergyBadgeColor = (badge: string) => {
    const colors: Record<string, string> = {
      amber: 'bg-amber-600 text-white',
      orange: 'bg-orange-600 text-white',
      blue: 'bg-blue-600 text-white',
      red: 'bg-red-600 text-white',
    };
    return colors[badge] || 'bg-slate-600 text-white';
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-slate-600 text-slate-200';
      case 'PREPARING': return 'bg-orange-600 text-white';
      case 'READY': return 'bg-green-600 text-white';
      default: return 'bg-slate-600 text-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-orange-500" />
            Kitchen Display
          </h1>
          <p className="text-slate-400 mt-1">View and manage incoming orders</p>
        </div>
        <Badge variant="outline" className="text-slate-400 border-slate-600">
          {orders.length} active order{orders.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {orders.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ChefHat className="w-16 h-16 text-slate-500 mb-4" />
            <p className="text-xl text-slate-400">No active orders</p>
            <p className="text-slate-500 mt-2">New orders will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => {
            const allReady = order.items.every((item: { status: string }) => item.status === 'READY');
            return (
              <Card key={order.id} className={`bg-slate-800/50 border-slate-700 ${order.status === 'CREATED' ? 'border-l-4 border-l-orange-500' : ''} ${allReady ? 'border-l-4 border-l-green-500' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl text-white flex items-center gap-2">
                      Table {order.table.number}
                      <Badge className="ml-2 bg-slate-700 text-slate-300">#{order.orderNumber}</Badge>
                    </CardTitle>
                    <div className={`flex items-center gap-1 text-sm ${getTimeColor(order.createdAt)}`}>
                      <Clock className="w-4 h-4" />
                      {getTimeSince(order.createdAt)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Order notes */}
                  {order.notes && (
                    <div className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30 text-yellow-300 text-sm">
                      📝 {order.notes}
                    </div>
                  )}

                  {/* Order items */}
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-700/50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-orange-400">{item.quantity}x</span>
                            <span className="text-white font-medium">{item.menuItem.name}</span>
                          </div>
                          <Badge className={getItemStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </div>

                        {/* Notes */}
                        {item.notes && (
                          <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/10 p-2 rounded">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium">{item.notes}</span>
                          </div>
                        )}

                        {/* Allergies */}
                        {item.allergies && item.allergies.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {item.allergies.map((allergyId) => {
                              const allergy = allergies.find((a) => a.id === allergyId);
                              return allergy ? (
                                <Badge key={allergyId} className={`${allergyBadgeColor(allergy.badge)} font-bold text-xs`}>
                                  ⚠️ {allergy.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}

                        {/* Item action */}
                        {item.status !== 'READY' && (
                          <Button
                            size="sm"
                            onClick={() => updateItemStatus(order.id, item.id, item.status === 'PENDING' ? 'PREPARING' : 'READY')}
                            disabled={updating === item.id}
                            className={item.status === 'PENDING' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
                          >
                            {updating === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : item.status === 'PENDING' ? (
                              'Start Preparing'
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" /> Mark Ready
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Order action */}
                  <Button
                    onClick={() => allReady ? updateOrderStatus(order.id, 'READY') : markAllReady(order)}
                    disabled={updating === order.id}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {updating === order.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {allReady ? 'Notify Floor Staff' : 'Mark All Ready'}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

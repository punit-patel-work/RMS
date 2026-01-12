'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Package, Plus, Minus, ShoppingCart, Clock, Check, 
  Phone, User, Trash2, ChefHat, PackageCheck, Search, X,
  Banknote, CreditCard
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  printStation: string;
  categoryId: string;
  isPromotional: boolean;
  promotionalPrice: number | null;
}

interface Category {
  id: string;
  name: string;
  menuItems: MenuItem[];
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  status: string;
  menuItem: MenuItem;
}

interface Order {
  id: string;
  orderNumber: number;
  orderType: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  pickupTime: string | null;
  totalAmount: number;
  surcharges: number;
  createdAt: string;
  items: OrderItem[];
  payment: { id: string; method: string } | null;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

export default function ToGoPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('active');
  const [mobileCartView, setMobileCartView] = useState(false);
  
  // Payment dialog state for pickup
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Order form state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupTime, setPickupTime] = useState<string>('asap');
  const [surcharges, setSurcharges] = useState(0);
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PAY_LATER' | 'CASH' | 'CARD'>('PAY_LATER');

  const fetchData = useCallback(async () => {
    try {
      const [categoriesRes, ordersRes] = await Promise.all([
        fetch('/api/menu/categories'),
        fetch('/api/orders'),
      ]);

      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json());
      }

      if (ordersRes.ok) {
        const allOrders = await ordersRes.json();
        // Filter to only To-Go orders, exclude failed/pending payment
        setOrders(allOrders.filter((o: Order) => 
          o.orderType === 'TO_GO' && 
          !['PENDING_PAYMENT', 'FAILED', 'CANCELLED'].includes(o.status)
        ));
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const availableItems = useMemo(() => {
    return categories.flatMap((cat) => 
      cat.menuItems.filter((item) => item.available)
    );
  }, [categories]);

  const filteredItems = useMemo(() => {
    let items = availableItems;

    // Handle special 'deals' category - show only promotional items
    if (selectedCategory === 'deals') {
      items = items.filter((item) => item.isPromotional);
    } else if (selectedCategory !== 'all') {
      items = items.filter((item) => item.categoryId === selectedCategory);
    }

    if (searchTerm) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return items;
  }, [availableItems, selectedCategory, searchTerm]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.menuItem.isPromotional && item.menuItem.promotionalPrice 
        ? item.menuItem.promotionalPrice 
        : item.menuItem.price;
      return sum + price * item.quantity;
    }, 0) + surcharges;
  }, [cart, surcharges]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Order categorization - Using correct status flow
  // IN_PROGRESS/CREATED/PREPARING -> Kitchen working
  // READY -> Ready for pickup (waiting for customer)
  // SERVED/COMPLETED -> Picked up
  const activeOrders = useMemo(() => 
    orders.filter((o) => ['CREATED', 'PREPARING'].includes(o.status))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders]
  );

  const readyOrders = useMemo(() =>
    orders.filter((o) => o.status === 'READY')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const completedOrders = useMemo(() =>
    orders.filter((o) => ['SERVED', 'PAID'].includes(o.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20),
    [orders]
  );

  const addToCart = (menuItem: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { menuItem, quantity: 1, notes: '' }];
    });
    // Haptic feedback for touch
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.menuItem.id === menuItemId) {
            const newQty = item.quantity + delta;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const resetForm = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPickupTime('asap');
    setSurcharges(0);
    setOrderNotes('');
    setSearchTerm('');
    setSelectedCategory('all');
    setMobileCartView(false);
    setPaymentMethod('PAY_LATER');
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Add items to the order first');
      return;
    }

    setSubmitting(true);
    try {
      let pickupDateTime: string | undefined;
      if (pickupTime !== 'asap') {
        const now = new Date();
        const minutes = parseInt(pickupTime);
        now.setMinutes(now.getMinutes() + minutes);
        pickupDateTime = now.toISOString();
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'TO_GO',
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          pickupTime: pickupDateTime,
          surcharges,
          notes: orderNotes || undefined,
          items: cart.map((item) => ({
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const order = await res.json();
      
      // If payment method is CASH or CARD, process payment immediately
      if (paymentMethod !== 'PAY_LATER') {
        const paymentRes = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            amount: cartTotal,
            method: paymentMethod,
          }),
        });
        
        if (!paymentRes.ok) {
          throw new Error('Order created but payment failed');
        }
        
        toast.success(
          <div className="flex flex-col">
            <span className="font-bold text-lg">Order #{order.orderNumber} Paid!</span>
            <span className="text-sm opacity-80">${cartTotal.toFixed(2)} via {paymentMethod}</span>
          </div>
        );
      } else {
        toast.success(
          <div className="flex flex-col">
            <span className="font-bold text-lg">Order #{order.orderNumber} Created!</span>
            <span className="text-sm opacity-80">Sent to kitchen - Pay on pickup</span>
          </div>
        );
      }
      
      setSheetOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  // CORRECT STATUS FLOW:
  // markOrderReady: CREATED/PREPARING -> READY (kitchen done, waiting for customer)
  const markOrderReady = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Order is READY for pickup!');
      fetchData();
    } catch {
      toast.error('Failed to update order');
    }
  };

  // markOrderPickedUp: READY -> SERVED (customer picked up)
  // If order is not paid, show payment dialog first
  const markOrderPickedUp = async (order: Order) => {
    if (!order.payment) {
      // Order not paid - show payment dialog
      setSelectedOrderForPayment(order);
      setPickupPaymentMethod('CASH');
      setPaymentDialogOpen(true);
      return;
    }
    
    // Already paid - just mark as picked up
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SERVED' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Order has been picked up!');
      fetchData();
    } catch {
      toast.error('Failed to update order');
    }
  };

  // Process payment and mark as picked up
  const processPickupPayment = async () => {
    if (!selectedOrderForPayment) return;
    
    setProcessingPayment(true);
    try {
      // Process payment
      const paymentRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrderForPayment.id,
          amount: selectedOrderForPayment.totalAmount,
          method: pickupPaymentMethod,
        }),
      });
      
      if (!paymentRes.ok) {
        throw new Error('Payment failed');
      }
      
      // Mark as served
      const statusRes = await fetch(`/api/orders/${selectedOrderForPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SERVED' }),
      });
      
      if (!statusRes.ok) throw new Error('Failed to update status');
      
      toast.success(
        <div className="flex flex-col">
          <span className="font-bold">Order #{selectedOrderForPayment.orderNumber} Complete!</span>
          <span className="text-sm">${selectedOrderForPayment.totalAmount.toFixed(2)} paid via {pickupPaymentMethod}</span>
        </div>
      );
      
      setPaymentDialogOpen(false);
      setSelectedOrderForPayment(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m ago`;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-orange-500" />
            To-Go Orders
          </h1>
          <p className="text-slate-400 mt-1">Manage takeout and pickup orders</p>
        </div>
        <Button 
          onClick={() => setSheetOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 px-6 text-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          New To-Go Order
        </Button>
      </div>

      {/* Order Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-yellow-500/20 border-yellow-500/50">
          <CardContent className="p-4 flex items-center gap-4">
            <ChefHat className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-white">{activeOrders.length}</p>
              <p className="text-sm text-yellow-400">In Kitchen</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/20 border-green-500/50">
          <CardContent className="p-4 flex items-center gap-4">
            <PackageCheck className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-white">{readyOrders.length}</p>
              <p className="text-sm text-green-400">Ready for Pickup</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-500/20 border-slate-500/50">
          <CardContent className="p-4 flex items-center gap-4">
            <Check className="w-8 h-8 text-slate-400" />
            <div>
              <p className="text-2xl font-bold text-white">{completedOrders.length}</p>
              <p className="text-sm text-slate-400">Picked Up Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="active" className="data-[state=active]:bg-yellow-500">
            🍳 In Kitchen ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="ready" className="data-[state=active]:bg-green-500">
            ✅ Ready ({readyOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-slate-600">
            📦 Picked Up ({completedOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* IN KITCHEN TAB */}
        <TabsContent value="active" className="mt-4">
          {activeOrders.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <ChefHat className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                <p className="text-slate-400">No orders in kitchen</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOrders.map((order) => (
                <Card key={order.id} className="bg-slate-800 border-yellow-500/50 border-l-4 border-l-yellow-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl text-white">
                        #{order.orderNumber}
                      </CardTitle>
                      <Badge className={order.status === 'PREPARING' ? 'bg-yellow-500' : 'bg-orange-500'}>
                        {order.status === 'PREPARING' ? '🍳 COOKING' : '📋 QUEUED'}
                      </Badge>
                    </div>
                    {order.customerName && (
                      <CardDescription className="text-lg text-slate-300 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {order.customerName}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {getTimeSince(order.createdAt)}
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <p className="text-sm text-slate-400 mb-2">
                        {order.items.reduce((sum, i) => sum + i.quantity, 0)} items
                      </p>
                      {order.items.slice(0, 3).map((item) => (
                        <p key={item.id} className="text-white">
                          {item.quantity}x {item.menuItem.name}
                        </p>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-slate-400 text-sm">
                          +{order.items.length - 3} more
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total</span>
                      <span className="text-xl font-bold text-green-400">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      onClick={() => markOrderReady(order.id)}
                      className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Mark READY for Pickup
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* READY FOR PICKUP TAB */}
        <TabsContent value="ready" className="mt-4">
          {readyOrders.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <PackageCheck className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                <p className="text-slate-400">No orders waiting for pickup</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyOrders.map((order) => (
                <Card key={order.id} className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500 border-2">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl text-white">
                        #{order.orderNumber}
                      </CardTitle>
                      <Badge className="bg-green-500 text-lg px-3 py-1 animate-pulse">
                        ✅ READY
                      </Badge>
                    </div>
                    {order.customerName && (
                      <CardDescription className="text-xl text-green-300 flex items-center gap-2 font-medium">
                        <User className="w-5 h-5" />
                        {order.customerName}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {order.customerPhone && (
                      <div className="text-slate-300 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {order.customerPhone}
                      </div>
                    )}
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Ready {getTimeSince(order.createdAt)}
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      {order.items.map((item) => (
                        <p key={item.id} className="text-white">
                          ✓ {item.quantity}x {item.menuItem.name}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total</span>
                      <span className="text-2xl font-bold text-green-400">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      onClick={() => markOrderPickedUp(order)}
                      className="w-full h-14 text-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                    >
                      <PackageCheck className="w-5 h-5 mr-2" />
                      {order.payment ? 'Customer Picked Up' : 'Collect Payment & Pickup'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PICKED UP / HISTORY TAB */}
        <TabsContent value="completed" className="mt-4">
          {completedOrders.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Check className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                <p className="text-slate-400">No completed orders today</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {completedOrders.map((order) => (
                <Card key={order.id} className="bg-slate-800/50 border-slate-700 opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl font-bold text-white">#{order.orderNumber}</span>
                      <Badge className="bg-slate-600">✓ Done</Badge>
                    </div>
                    {order.customerName && (
                      <p className="text-slate-400">{order.customerName}</p>
                    )}
                    <p className="text-sm text-slate-500">{getTimeSince(order.createdAt)}</p>
                    <p className="text-green-400 font-bold mt-2">${order.totalAmount.toFixed(2)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* NEW ORDER - SHEET (80% width Split-Screen POS Layout) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:w-[85%] sm:max-w-[85%] p-0 bg-slate-900 border-l border-slate-700">
          {/* Accessibility - Required SheetHeader */}
          <SheetHeader className="sr-only">
            <SheetTitle>Create New To-Go Order</SheetTitle>
            <SheetDescription>Select items and enter customer details</SheetDescription>
          </SheetHeader>
          
          <div className="h-full flex flex-col lg:flex-row overflow-hidden">
            {/* LEFT PANEL - MENU (takes remaining space after right panel) */}
            <div className={`flex-1 flex flex-col bg-slate-900 lg:border-r border-slate-700 min-h-0 overflow-hidden ${mobileCartView ? 'hidden lg:flex' : ''}`}>
              {/* Header */}
              <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-xl lg:text-2xl font-bold text-white">Select Items</h2>
                <Button variant="ghost" size="icon" onClick={() => setSheetOpen(false)}>
                  <X className="w-6 h-6 text-slate-400" />
                </Button>
              </div>

              {/* Search Bar - Full Width */}
              <div className="p-3 lg:p-4 border-b border-slate-700 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    placeholder="Search menu items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 lg:h-14 text-base lg:text-lg bg-slate-800 border-slate-600 text-white rounded-xl"
                  />
                </div>
              </div>

              {/* Category Pills - Horizontal Scroll with proper overflow */}
              <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-slate-700 flex-shrink-0">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {/* Deals filter - Show all promotional items */}
                  <button
                    onClick={() => setSelectedCategory('deals')}
                    className={`flex-shrink-0 px-4 lg:px-5 py-2 lg:py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      selectedCategory === 'deals' 
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' 
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                  >
                    🔥 Deals
                  </button>
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`flex-shrink-0 px-4 lg:px-5 py-2 lg:py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      selectedCategory === 'all' 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    All Items
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex-shrink-0 px-4 lg:px-5 py-2 lg:py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                        selectedCategory === cat.id 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items Grid - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Search className="w-12 h-12 mb-4" />
                    <p>No items found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filteredItems.map((item) => {
                      const displayPrice = item.isPromotional && item.promotionalPrice 
                        ? item.promotionalPrice 
                        : item.price;
                      return (
                        <button
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className={`bg-slate-800 border rounded-xl p-4 text-left hover:bg-slate-700 hover:border-orange-500 transition-all active:scale-95 flex flex-col justify-between min-h-[120px] relative ${
                            item.isPromotional ? 'border-yellow-500/50' : 'border-slate-700'
                          }`}
                        >
                          {/* Promotional Badge */}
                          {item.isPromotional && (
                            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              🔥 DEAL
                            </div>
                          )}
                          <p className="font-medium text-white text-base leading-tight line-clamp-2">
                            {item.name}
                          </p>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex flex-col">
                              <span className="text-xl font-bold text-green-400">
                                ${displayPrice.toFixed(2)}
                              </span>
                              {item.isPromotional && item.promotionalPrice && (
                                <span className="text-sm text-slate-500 line-through">
                                  ${item.price.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                              <Plus className="w-5 h-5 text-orange-500" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* MOBILE FLOATING CART BUTTON */}
            {!mobileCartView && (
              <div className="lg:hidden fixed bottom-4 right-4 z-50">
                <button
                  onClick={() => setMobileCartView(true)}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full p-4 shadow-lg flex items-center gap-2"
                >
                  <ShoppingCart className="w-6 h-6" />
                  {cartItemCount > 0 && (
                    <span className="font-bold">{cartItemCount} - ${cartTotal.toFixed(2)}</span>
                  )}
                </button>
              </div>
            )}

            {/* RIGHT PANEL - ORDER DETAILS (fixed width, visible on mobile when mobileCartView) */}
            <div className={`${mobileCartView ? 'flex' : 'hidden'} lg:flex w-full lg:w-[380px] flex-shrink-0 flex-col bg-slate-800 ${mobileCartView ? 'absolute inset-0 z-40' : ''}`}>
              {/* Mobile Back Button */}
              <div className={`${mobileCartView ? 'flex' : 'hidden'} p-4 border-b border-slate-700 items-center gap-3 flex-shrink-0`}>
                <Button variant="ghost" size="sm" onClick={() => setMobileCartView(false)}>
                  <X className="w-5 h-5 mr-1" /> Back to Menu
                </Button>
              </div>
              {/* Customer Info - TOP */}
              <div className="p-4 border-b border-slate-700 space-y-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-orange-500" />
                  Customer Info
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-400 text-sm">Customer Name</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter name for order..."
                      className="bg-slate-700 border-slate-600 text-white h-11 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-400 text-sm">Phone</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Optional"
                        className="bg-slate-700 border-slate-600 text-white h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-sm">Pickup Time</Label>
                      <Select value={pickupTime} onValueChange={setPickupTime}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-11 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="asap">ASAP</SelectItem>
                          <SelectItem value="15">15 mins</SelectItem>
                          <SelectItem value="30">30 mins</SelectItem>
                          <SelectItem value="45">45 mins</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cart Items - MIDDLE (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                  <ShoppingCart className="w-5 h-5 text-orange-500" />
                  Order Items
                  {cartItemCount > 0 && (
                    <Badge className="bg-orange-500 ml-2">{cartItemCount}</Badge>
                  )}
                </h3>

                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg">Cart is empty</p>
                    <p className="text-sm">Tap items on the left to add</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => {
                      const unitPrice = item.menuItem.isPromotional && item.menuItem.promotionalPrice 
                        ? item.menuItem.promotionalPrice 
                        : item.menuItem.price;
                      return (
                        <div key={item.menuItem.id} className="bg-slate-700/50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 pr-2">
                              <span className="text-white font-medium">
                                {item.menuItem.name}
                              </span>
                              {item.menuItem.isPromotional && (
                                <span className="ml-2 text-xs bg-yellow-500/30 text-yellow-400 px-1.5 py-0.5 rounded">
                                  DEAL
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => updateQuantity(item.menuItem.id, -item.quantity)}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.menuItem.id, -1)}
                                className="w-9 h-9 rounded-lg bg-slate-600 hover:bg-slate-500 flex items-center justify-center"
                              >
                                <Minus className="w-4 h-4 text-white" />
                              </button>
                              <span className="w-10 text-center text-white font-bold text-lg">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.menuItem.id, 1)}
                                className="w-9 h-9 rounded-lg bg-slate-600 hover:bg-slate-500 flex items-center justify-center"
                              >
                                <Plus className="w-4 h-4 text-white" />
                              </button>
                            </div>
                            <span className="text-green-400 font-bold text-lg">
                              ${(unitPrice * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bag Fee & Notes */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-slate-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-400 text-sm">Bag Fee</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={surcharges}
                        onChange={(e) => setSurcharges(parseFloat(e.target.value) || 0)}
                        className="bg-slate-700 border-slate-600 text-white h-10 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-sm">Notes</Label>
                      <Input
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Special requests..."
                        className="bg-slate-700 border-slate-600 text-white h-10 mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Totals & Action - BOTTOM (Anchored) */}
              <div className="p-4 border-t border-slate-700 bg-slate-900 flex-shrink-0">
                {/* Payment Method Selection */}
                <div className="mb-4">
                  <Label className="text-slate-400 text-sm mb-2 block">Payment</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setPaymentMethod('PAY_LATER')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                        paymentMethod === 'PAY_LATER' 
                          ? 'bg-slate-600 text-white ring-2 ring-orange-500' 
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Later
                    </button>
                    <button
                      onClick={() => setPaymentMethod('CASH')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                        paymentMethod === 'CASH' 
                          ? 'bg-green-600 text-white ring-2 ring-green-400' 
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod('CARD')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                        paymentMethod === 'CARD' 
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      Card
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-400 text-lg">Total</span>
                  <span className="text-4xl font-bold text-white">${cartTotal.toFixed(2)}</span>
                </div>
                <Button
                  onClick={handleSubmitOrder}
                  disabled={cart.length === 0 || submitting}
                  className={`w-full h-14 text-xl font-bold disabled:opacity-50 ${
                    paymentMethod === 'PAY_LATER' 
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' 
                      : paymentMethod === 'CASH'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      {paymentMethod === 'PAY_LATER' ? (
                        <>
                          <Package className="w-6 h-6 mr-2" />
                          Create Order (Pay Later)
                        </>
                      ) : (
                        <>
                          {paymentMethod === 'CASH' ? <Banknote className="w-6 h-6 mr-2" /> : <CreditCard className="w-6 h-6 mr-2" />}
                          Pay ${cartTotal.toFixed(2)} ({paymentMethod})
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Payment Collection Dialog for Pickup */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white flex items-center gap-2">
              <Banknote className="w-6 h-6 text-green-500" />
              Collect Payment
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Order #{selectedOrderForPayment?.orderNumber} - {selectedOrderForPayment?.customerName || 'Customer'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Order Total */}
            <div className="bg-slate-800 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-sm">Amount Due</p>
              <p className="text-4xl font-bold text-white">
                ${selectedOrderForPayment?.totalAmount.toFixed(2)}
              </p>
            </div>
            
            {/* Payment Method Selection */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPickupPaymentMethod('CASH')}
                className={`py-4 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  pickupPaymentMethod === 'CASH' 
                    ? 'bg-green-600 text-white ring-2 ring-green-400' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Banknote className="w-6 h-6" />
                Cash
              </button>
              <button
                onClick={() => setPickupPaymentMethod('CARD')}
                className={`py-4 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  pickupPaymentMethod === 'CARD' 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                Card
              </button>
            </div>
            
            {/* Confirm Button */}
            <Button
              onClick={processPickupPayment}
              disabled={processingPayment}
              className={`w-full h-14 text-lg font-bold ${
                pickupPaymentMethod === 'CASH'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
              }`}
            >
              {processingPayment ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirm Payment & Complete Order
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

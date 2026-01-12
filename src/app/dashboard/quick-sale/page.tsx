'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, Search, Plus, Minus, ShoppingCart, Trash2, CreditCard, 
  Banknote, IceCream, Coffee, Package, Zap, Check, Receipt
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  printStation: string;
  categoryId: string;
}

interface Category {
  id: string;
  name: string;
  menuItems: MenuItem[];
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export default function QuickSalePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/menu/categories');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  // Filter to show only NO_PRINT items (quick sale items)
  const quickSaleCategories = useMemo(() => {
    return categories
      .map((cat) => ({
        ...cat,
        menuItems: cat.menuItems.filter((item) => 
          item.available && item.printStation === 'NO_PRINT'
        ),
      }))
      .filter((cat) => cat.menuItems.length > 0);
  }, [categories]);

  const filteredItems = useMemo(() => {
    let items: MenuItem[] = [];
    
    if (selectedCategory === 'all') {
      items = quickSaleCategories.flatMap((cat) => cat.menuItems);
    } else {
      const cat = quickSaleCategories.find((c) => c.id === selectedCategory);
      items = cat?.menuItems || [];
    }

    if (searchTerm) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return items;
  }, [quickSaleCategories, selectedCategory, searchTerm]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (menuItem: MenuItem) => {
    // Clear any previous payment error when adding new items
    setPaymentError(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setPaymentError(null);
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

  const clearCart = () => {
    setCart([]);
    setPaymentError(null);
  };

  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setProcessing(true);
    setPaymentError(null);
    
    try {
      // Create order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'QUICK_SALE',
          items: cart.map((item) => ({
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!orderRes.ok) {
        const error = await orderRes.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const order = await orderRes.json();

      // Process payment immediately
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
        const payError = await paymentRes.json().catch(() => ({}));
        const errorMessage = payError.error || 'Payment declined. Please try a different payment method.';
        // DON'T clear cart - keep it for retry!
        setPaymentError(errorMessage);
        toast.error(
          <div className="flex flex-col">
            <span className="font-bold">Payment Failed</span>
            <span className="text-sm">{errorMessage}</span>
          </div>,
          { duration: 5000 }
        );
        return; // Exit without clearing cart
      }

      // SUCCESS - Only now clear the cart
      toast.success(
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500" />
          <span>
            Sale Complete! ${cartTotal.toFixed(2)} ({paymentMethod})
          </span>
        </div>
      );

      clearCart();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setPaymentError(errorMessage);
      toast.error(errorMessage);
      // DON'T clear cart on error!
    } finally {
      setProcessing(false);
    }
  };

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'ice-cream':
        return <IceCream className="w-5 h-5" />;
      case 'drinks':
        return <Coffee className="w-5 h-5" />;
      case 'quick-grab':
        return <Package className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
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
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Left Panel - Items Grid */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-500" />
            Quick Sale
          </h1>
          <p className="text-slate-400 mt-1">Instant checkout for grab-and-go items</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white h-12 text-lg"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('all')}
            className={`flex-shrink-0 h-12 px-6 ${
              selectedCategory === 'all' ? 'bg-orange-500' : 'border-slate-600'
            }`}
          >
            All Items
          </Button>
          {quickSaleCategories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 h-12 px-6 flex items-center gap-2 ${
                selectedCategory === cat.id ? 'bg-orange-500' : 'border-slate-600'
              }`}
            >
              {getCategoryIcon(cat.id)}
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Items Grid - Touch Optimized */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Package className="w-12 h-12 mb-4" />
              <p>No quick sale items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:bg-slate-700 hover:border-orange-500 transition-all active:scale-95 min-h-[100px] flex flex-col justify-between"
                >
                  <div>
                    <p className="font-medium text-white text-lg line-clamp-2">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-slate-400 line-clamp-1 mt-1">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xl font-bold text-green-400">${item.price.toFixed(2)}</span>
                    <Plus className="w-6 h-6 text-orange-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-96 bg-slate-800 rounded-xl border border-slate-700 flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-orange-500" />
              Cart
              {cartItemCount > 0 && (
                <Badge className="bg-orange-500">{cartItemCount}</Badge>
              )}
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <ShoppingCart className="w-12 h-12 mb-4" />
              <p>Cart is empty</p>
              <p className="text-sm">Tap items to add</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <Card key={item.menuItem.id} className="bg-slate-700/50 border-slate-600">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white">{item.menuItem.name}</p>
                        <p className="text-sm text-slate-400">
                          ${item.menuItem.price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.menuItem.id, -1)}
                          className="h-10 w-10 border-slate-600 text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center text-white font-bold text-lg">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.menuItem.id, 1)}
                          className="h-10 w-10 border-slate-600 text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right mt-2">
                      <span className="text-green-400 font-bold">
                        ${(item.menuItem.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer - Payment */}
        <div className="border-t border-slate-700 p-4 space-y-4">
          {/* Payment Error Banner */}
          {paymentError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-center">
              <p className="text-red-400 font-bold">⚠️ Payment Failed</p>
              <p className="text-red-300 text-sm">{paymentError}</p>
              <p className="text-slate-400 text-xs mt-1">Try a different payment method</p>
            </div>
          )}
          
          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Total</span>
            <span className="text-3xl font-bold text-white">${cartTotal.toFixed(2)}</span>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('CASH')}
              className={`h-14 text-lg flex items-center gap-2 ${
                paymentMethod === 'CASH' ? 'bg-green-600 hover:bg-green-700' : 'border-slate-600'
              }`}
            >
              <Banknote className="w-5 h-5" />
              Cash
            </Button>
            <Button
              variant={paymentMethod === 'CARD' ? 'default' : 'outline'}
              onClick={() => setPaymentMethod('CARD')}
              className={`h-14 text-lg flex items-center gap-2 ${
                paymentMethod === 'CARD' ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-600'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Card
            </Button>
          </div>

          {/* Pay Button */}
          <Button
            onClick={processPayment}
            disabled={cart.length === 0 || processing}
            className="w-full h-16 text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          >
            {processing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Receipt className="w-6 h-6 mr-2" />
                PAY ${cartTotal.toFixed(2)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Users, Merge, Split, Plus, Minus, ShoppingCart, 
  DollarSign, X, Check, Star, Sparkles, Trash2, Percent, Tag, Receipt, Gift, Search
} from 'lucide-react';
import { useSession } from 'next-auth/react';

// Tax rate (13% default)
const TAX_RATE = 0.13;

interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'ORDER_PENDING';
  mergedWithId: string | null;
  mergedTables: Table[];
  orders: Order[];
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  discountType: string | null;
  discountValue: number | null;
  discountReason: string | null;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  allergies: string[];
  status: string;
  price: number;
  menuItem: MenuItem;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  categoryId: string;
  allergies: string[];
  isSpecial?: boolean;
  isPromotional?: boolean;
  promotionalPrice?: number | null;
}

interface Category {
  id: string;
  name: string;
  menuItems: MenuItem[];
}

interface Allergy {
  id: string;
  name: string;
  badge: string;
}

interface CartItem {
  id: string; // Unique ID for each cart item
  menuItemId: string;
  quantity: number;
  notes: string;
  allergies: string[];
  menuItem: MenuItem;
  bundleId?: string; // Track which bundle this item belongs to
  bundlePrice?: number; // The bundle's total price (stored on first item only)
}

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED' | 'BUNDLE';
  value: number;
  bundlePrice: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  menuItems: { id: string; name: string; price: number }[];
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Order state - each item has unique ID
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  
  // Pending carts per table - stores cart state when switching between tables
  const [pendingCarts, setPendingCarts] = useState<Record<string, { items: CartItem[], notes: string }>>({});
  
  // Discount state
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [tipAmount, setTipAmount] = useState('');

  // Get session for role check
  const { data: session } = useSession();
  const canApplyDiscount = session?.user?.role === 'OWNER' || session?.user?.role === 'SUPERVISOR';

  // Use a ref to track selected table ID without causing re-renders
  const selectedTableIdRef = useRef<string | null>(null);
  
  // Update ref when selectedTable changes
  useEffect(() => {
    selectedTableIdRef.current = selectedTable?.id || null;
  }, [selectedTable]);

  const fetchData = useCallback(async () => {
    try {
      const [tablesRes, categoriesRes, allergiesRes, promotionsRes] = await Promise.all([
        fetch('/api/tables'),
        fetch('/api/menu/categories'),
        fetch('/api/allergies'),
        fetch('/api/promotions'),
      ]);
      const newTables = await tablesRes.json();
      setTables(newTables);
      setCategories(await categoriesRes.json());
      setAllergies(await allergiesRes.json());
      
      // Filter active promotions
      const allPromos = await promotionsRes.json();
      const now = new Date();
      const activePromos = allPromos.filter((p: Promotion) => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return p.isActive && now >= start && now <= end;
      });
      setPromotions(activePromos);
      
      // Update selectedTable if it exists to refresh order data (using ref to avoid dependency)
      if (selectedTableIdRef.current) {
        const updatedTable = newTables.find((t: Table) => t.id === selectedTableIdRef.current);
        if (updatedTable) {
          setSelectedTable(updatedTable);
        }
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies - uses ref instead

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Increased to 30 seconds to reduce load
    return () => clearInterval(interval);
  }, [fetchData]);


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VACANT': return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'OCCUPIED': return 'bg-orange-500/20 border-orange-500/50 text-orange-400';
      case 'RESERVED': return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
      case 'ORDER_PENDING': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      default: return 'bg-slate-500/20 border-slate-500/50 text-slate-400';
    }
  };

  const handleTableClick = (table: Table) => {
    if (mergeMode) {
      setSelectedForMerge((prev) =>
        prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id]
      );
    } else {
      // Save current cart to pendingCarts for current table (if different from new table)
      if (selectedTable?.id && selectedTable.id !== table.id && (cartItems.length > 0 || orderNotes)) {
        setPendingCarts((prev) => ({
          ...prev,
          [selectedTable.id]: { items: cartItems, notes: orderNotes }
        }));
      }
      
      // Restore pending cart for the new table, or start fresh
      const pendingCart = pendingCarts[table.id];
      if (pendingCart) {
        setCartItems(pendingCart.items);
        setOrderNotes(pendingCart.notes);
      } else if (selectedTable?.id !== table.id) {
        // Only clear if switching to a different table with no pending cart
        setCartItems([]);
        setOrderNotes('');
      }
      
      setSelectedTable(table);
      setOrderDialogOpen(true);
      setSelectedCategory('all');
      setSearchTerm('');
    }
  };

  const handleMergeTables = async () => {
    if (selectedForMerge.length < 2) {
      toast.error('Select at least 2 tables to merge');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tables/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableIds: selectedForMerge }),
      });
      if (!res.ok) throw new Error('Failed to merge tables');
      toast.success('Tables merged');
      setMergeMode(false);
      setSelectedForMerge([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to merge tables');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnmergeTables = async (tableId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/tables/unmerge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId }),
      });
      if (!res.ok) throw new Error('Failed to unmerge tables');
      toast.success('Tables unmerged');
      fetchData();
    } catch (error) {
      toast.error('Failed to unmerge tables');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTableStatus = async (tableId: string, status: string) => {
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tableId, status }),
      });
      if (!res.ok) throw new Error('Failed to update table');
      toast.success('Table status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update table');
    }
  };

  // Add item to cart - always creates new line item
  const addToCart = (menuItem: MenuItem) => {
    const newItem: CartItem = {
      id: `${menuItem.id}-${Date.now()}`, // Unique ID
      menuItemId: menuItem.id,
      quantity: 1,
      notes: '',
      allergies: [],
      menuItem,
    };
    setCartItems((prev) => [...prev, newItem]);
    toast.success(`${menuItem.name} added`);
  };

  const updateCartItemQuantity = (cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === cartItemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const updateCartItemNotes = (cartItemId: string, notes: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, notes } : item))
    );
  };

  const toggleCartItemAllergy = (cartItemId: string, allergyId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === cartItemId
          ? {
              ...item,
              allergies: item.allergies.includes(allergyId)
                ? item.allergies.filter((a) => a !== allergyId)
                : [...item.allergies, allergyId],
            }
          : item
      )
    );
  };

  const getItemPrice = (item: MenuItem) => {
    if (item.isPromotional && item.promotionalPrice) {
      return item.promotionalPrice;
    }
    return item.price;
  };

  // Add entire bundle to cart with all items linked
  const addBundleToCart = (promo: Promotion) => {
    if (promo.type !== 'BUNDLE' || !promo.bundlePrice || promo.menuItems.length === 0) {
      toast.error('Invalid bundle');
      return;
    }

    // Generate unique bundle instance ID
    const bundleInstanceId = `bundle-${promo.id}-${Date.now()}`;
    
    // Get all menu items for this bundle
    const allMenuItems = categories.flatMap((c) => c.menuItems);
    
    // Create cart items for each item in the bundle
    const bundleItems: CartItem[] = [];
    let isFirst = true;
    
    for (const promoItem of promo.menuItems) {
      const menuItem = allMenuItems.find((m) => m.id === promoItem.id);
      if (!menuItem) continue;
      
      bundleItems.push({
        id: `${menuItem.id}-${Date.now()}-${bundleItems.length}`,
        menuItemId: menuItem.id,
        quantity: 1,
        notes: '',
        allergies: [] as string[],
        menuItem,
        bundleId: bundleInstanceId,
        bundlePrice: isFirst ? promo.bundlePrice ?? undefined : undefined,
      });
      isFirst = false;
    }

    if (bundleItems.length === 0) {
      toast.error('Could not find bundle items in menu');
      return;
    }

    setCartItems((prev) => [...prev, ...bundleItems]);
    
    const savings = promo.menuItems.reduce((sum: number, i: { price: number }) => sum + i.price, 0) - promo.bundlePrice;
    toast.success(`${promo.name} added! You save $${savings.toFixed(2)}`);
  };

  // Calculate cart total with bundle pricing
  const getCartTotal = () => {
    let total = 0;
    const processedBundles = new Set<string>();

    for (const item of cartItems) {
      if (item.bundleId) {
        // If this item is part of a bundle and we haven't processed this bundle yet
        if (!processedBundles.has(item.bundleId)) {
          // Find the first item with this bundleId that has the bundlePrice
          const bundleFirstItem = cartItems.find(
            (i) => i.bundleId === item.bundleId && i.bundlePrice !== undefined
          );
          if (bundleFirstItem?.bundlePrice) {
            total += bundleFirstItem.bundlePrice;
          }
          processedBundles.add(item.bundleId);
        }
        // Don't add individual item prices for bundle items
      } else {
        // Regular item pricing
        total += getItemPrice(item.menuItem) * item.quantity;
      }
    }
    return total;
  };

  // Calculate subtotal, tax, and grand total for an order
  const calculateOrderTotals = (order: Order | null | undefined) => {
    if (!order) return { subtotal: 0, discount: 0, tax: 0, total: 0 };
    
    const subtotal = order.items.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);
    let discount = 0;
    
    if (order.discountType && order.discountValue) {
      if (order.discountType === 'PERCENTAGE') {
        discount = (subtotal * order.discountValue) / 100;
      } else {
        discount = order.discountValue;
      }
    }
    
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * TAX_RATE;
    const total = afterDiscount + tax;
    
    return { subtotal, discount, tax, total };
  };

  // Apply discount via API
  const applyDiscount = async () => {
    const currentActiveOrder = selectedTable?.orders.find((o) => 
      ['CREATED', 'PREPARING', 'READY', 'SERVED'].includes(o.status)
    );
    
    if (!currentActiveOrder || !discountValue) {
      toast.error('No active order found or discount value missing');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders/discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentActiveOrder.id,
          discountType,
          discountValue: parseFloat(discountValue),
          discountReason,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to apply discount');
      }
      
      toast.success('Discount applied successfully');
      setDiscountDialogOpen(false);
      setDiscountValue('');
      setDiscountReason('');
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply discount');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove discount
  const removeDiscount = async () => {
    const currentActiveOrder = selectedTable?.orders.find((o) => 
      ['CREATED', 'PREPARING', 'READY', 'SERVED'].includes(o.status)
    );
    
    if (!currentActiveOrder) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/discount?orderId=${currentActiveOrder.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to remove discount');
      
      toast.success('Discount removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove discount');
    } finally {
      setSubmitting(false);
    }
  };

  const removeOrderItem = async (orderId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove item');
      toast.success('Item removed from order');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const submitOrder = async () => {
    if (!selectedTable || cartItems.length === 0) return;

    // Capture items and clear cart immediately to prevent duplicate submissions
    const itemsToSubmit = [...cartItems];
    const notesToSubmit = orderNotes;
    const tableId = selectedTable.id;
    setCartItems([]);
    setOrderNotes('');
    
    // Clear pending cart for this table since order is being submitted
    setPendingCarts((prev) => {
      const newPending = { ...prev };
      delete newPending[tableId];
      return newPending;
    });

    setSubmitting(true);
    try {
      const activeOrder = selectedTable.orders.find((o) => 
        ['CREATED', 'PREPARING', 'READY', 'SERVED'].includes(o.status)
      );

      // Calculate bundle savings
      let bundleSavings = 0;
      const processedBundles = new Set<string>();
      
      console.log('Cart items for bundle check:', itemsToSubmit.map(i => ({ id: i.id, name: i.menuItem.name, bundleId: i.bundleId, bundlePrice: i.bundlePrice })));
      
      for (const item of itemsToSubmit) {
        if (item.bundleId && !processedBundles.has(item.bundleId)) {
          // Find all items in this bundle and calculate regular price
          const bundleItems = itemsToSubmit.filter((i) => i.bundleId === item.bundleId);
          const regularTotal = bundleItems.reduce((sum: number, i: { menuItem: { price: number }; quantity: number }) => sum + i.menuItem.price * i.quantity, 0);
          
          // Find the bundle price (stored on first item)
          const bundleFirstItem = bundleItems.find((i) => i.bundlePrice !== undefined);
          console.log('Bundle found:', item.bundleId, 'Items:', bundleItems.length, 'Regular total:', regularTotal, 'Bundle price:', bundleFirstItem?.bundlePrice);
          
          if (bundleFirstItem?.bundlePrice) {
            bundleSavings += regularTotal - bundleFirstItem.bundlePrice;
          }
          processedBundles.add(item.bundleId);
        }
      }
      
      console.log('Total bundle savings calculated:', bundleSavings);

      // Get bundle names for the discount reason
      const bundleNames = Array.from(processedBundles).map((bundleId) => {
        const firstItem = itemsToSubmit.find((i) => i.bundleId === bundleId && i.bundlePrice);
        if (firstItem) {
          // Find the promotion name from the bundleId format: bundle-{promoId}-{timestamp}
          const promoId = bundleId.split('-')[1];
          const promo = promotions.find((p) => p.id === promoId);
          return promo?.name || 'Bundle Deal';
        }
        return 'Bundle Deal';
      });

      if (activeOrder) {
        // Add items to existing order
        for (const item of itemsToSubmit) {
          await fetch(`/api/orders/${activeOrder.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              notes: item.notes || undefined,
              allergies: item.allergies,
            }),
          });
        }
        
        console.log('Items added to existing order:', activeOrder.id, 'Bundle savings:', bundleSavings);
        
        // Apply bundle discount if there are savings
        if (bundleSavings > 0) {
          // Add to existing discount if there is one
          const existingDiscount = activeOrder.discountValue || 0;
          const newDiscount = existingDiscount + bundleSavings;
          
          console.log('Applying discount - existing:', existingDiscount, 'new total:', newDiscount);
          
          const discountRes = await fetch('/api/orders/discount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: activeOrder.id,
              discountType: 'FIXED',
              discountValue: newDiscount,
              discountReason: bundleNames.join(', '),
            }),
          });
          
          if (!discountRes.ok) {
            const discountError = await discountRes.json();
            console.error('Failed to apply discount to existing order:', discountError);
          } else {
            console.log('Discount applied to existing order successfully');
          }
        }
        
        toast.success(`Items added to order${bundleSavings > 0 ? ` (Bundle savings: $${bundleSavings.toFixed(2)})` : ''}`);
      } else {
        // Create new order
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId: selectedTable.id,
            notes: notesToSubmit || undefined,
            items: itemsToSubmit.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              notes: item.notes || undefined,
              allergies: item.allergies,
            })),
          }),
        });
        
        const order = await res.json();
        if (!res.ok) {
          console.error('Order creation failed:', order);
          throw new Error('Failed to create order');
        }
        
        console.log('Order created:', order.id, 'Bundle savings:', bundleSavings);
        
        // Apply bundle discount if there are savings
        if (bundleSavings > 0) {
          console.log('Applying discount to order:', order.id, 'Amount:', bundleSavings);
          const discountRes = await fetch('/api/orders/discount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              discountType: 'FIXED',
              discountValue: bundleSavings,
              discountReason: bundleNames.join(', '),
            }),
          });
          
          if (!discountRes.ok) {
            const discountError = await discountRes.json();
            console.error('Failed to apply bundle discount:', discountError);
          } else {
            console.log('Discount applied successfully');
          }
        }
        
        toast.success(`Order created${bundleSavings > 0 ? ` with bundle savings: $${bundleSavings.toFixed(2)}` : ''}`);
      }

      setOrderDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  const processPayment = async () => {
    const activeOrder = selectedTable?.orders.find((o) => 
      ['CREATED', 'PREPARING', 'READY', 'SERVED'].includes(o.status)
    );
    if (!activeOrder) return;

    // Calculate the total with tax
    const totals = calculateOrderTotals(activeOrder);
    const tip = tipAmount ? parseFloat(tipAmount) : 0;
    const finalAmount = totals.total + tip;

    setSubmitting(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrder.id,
          amount: finalAmount,
          method: paymentMethod,
          tip: tip > 0 ? tip : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to process payment');
      toast.success('Payment processed successfully!');
      setPaymentDialogOpen(false);
      setOrderDialogOpen(false);
      setTipAmount('');
      fetchData();
    } catch (error) {
      toast.error('Failed to process payment');
    } finally {
      setSubmitting(false);
    }
  };


  const allergyBadgeColor = (badge: string, selected: boolean) => {
    if (!selected) return 'bg-slate-700 text-slate-400 border-slate-600';
    const colors: Record<string, string> = {
      amber: 'bg-amber-500 text-white border-amber-400',
      orange: 'bg-orange-500 text-white border-orange-400',
      blue: 'bg-blue-500 text-white border-blue-400',
      red: 'bg-red-500 text-white border-red-400',
    };
    return colors[badge] || 'bg-slate-500 text-white border-slate-400';
  };

  // Get menu items by category and filter by search
  const allMenuItems = categories.flatMap((c) => c.menuItems.filter((i) => i.available));
  
  // Filter by search term first
  const searchFiltered = searchTerm.trim() 
    ? allMenuItems.filter((i) => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.description?.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : allMenuItems;
  
  const displayItems = selectedCategory === 'all' 
    ? searchFiltered 
    : selectedCategory === 'specials'
    ? searchFiltered.filter((i) => i.isSpecial)
    : selectedCategory === 'promos'
    ? searchFiltered.filter((i) => i.isPromotional)
    : selectedCategory === 'deals'
    ? [] // Deals are shown separately as promotions
    : categories.find((c) => c.id === selectedCategory)?.menuItems.filter((i) => 
        i.available && 
        (!searchTerm.trim() || i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.description?.toLowerCase().includes(searchTerm.toLowerCase()))
      ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const activeOrder = selectedTable?.orders.find((o) => 
    ['CREATED', 'PREPARING', 'READY', 'SERVED'].includes(o.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Tables</h1>
          <p className="text-slate-400 mt-1">Manage table status and orders</p>
        </div>
        <div className="flex gap-2">
          {mergeMode ? (
            <>
              <Button variant="outline" onClick={() => { setMergeMode(false); setSelectedForMerge([]); }} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleMergeTables} disabled={selectedForMerge.length < 2 || submitting} className="bg-orange-500 hover:bg-orange-600">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Merge className="w-4 h-4 mr-2" /> Merge Selected</>}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setMergeMode(true)} className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Merge className="w-4 h-4 mr-2" />
              Merge Tables
            </Button>
          )}
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-4">
        {['VACANT', 'OCCUPIED', 'RESERVED', 'ORDER_PENDING'].map((status) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${getStatusColor(status).split(' ')[0]}`} />
            <span className="text-sm text-slate-400">{status.charAt(0) + status.slice(1).toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Table Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {tables.filter((t) => !t.mergedWithId).map((table) => {
          const hasReadyOrder = table.orders.some((o) => o.status === 'READY');
          const hasPendingItems = pendingCarts[table.id]?.items.length > 0;
          return (
            <Card
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border-2 ${getStatusColor(table.status)} ${
                mergeMode && selectedForMerge.includes(table.id) ? 'ring-4 ring-orange-500 ring-offset-2 ring-offset-slate-900' : ''
              } ${hasReadyOrder ? 'animate-pulse shadow-lg shadow-green-500/30' : ''} ${hasPendingItems ? 'shadow-lg shadow-purple-500/30' : ''}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-white">
                    Table {table.number}
                    {table.mergedTables.length > 0 && (
                      <span className="text-sm font-normal text-slate-400 ml-1">
                        +{table.mergedTables.map((t) => t.number).join(',')}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex gap-1">
                    {hasPendingItems && <Badge className="bg-purple-500 text-xs">Pending</Badge>}
                    {hasReadyOrder && <Badge className="bg-green-500 animate-bounce">Ready!</Badge>}
                  </div>
                </div>
                <CardDescription className="text-slate-400">
                  <Users className="w-4 h-4 inline mr-1" />
                  {table.capacity + table.mergedTables.reduce((sum: number, t: { capacity: number }) => sum + t.capacity, 0)} seats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge className={getStatusColor(table.status)}>
                  {table.status.charAt(0) + table.status.slice(1).toLowerCase()}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Order Dialog - Vertical Layout */}
      <Dialog open={orderDialogOpen} onOpenChange={(open) => {
        if (!open && selectedTable && (cartItems.length > 0 || orderNotes)) {
          // Save cart when closing dialog
          setPendingCarts((prev) => ({
            ...prev,
            [selectedTable.id]: { items: cartItems, notes: orderNotes }
          }));
        }
        setOrderDialogOpen(open);
      }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <DialogHeader className="border-b border-slate-700 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl text-white flex items-center gap-3">
                  <ShoppingCart className="w-7 h-7 text-orange-500" />
                  Table {selectedTable?.number}
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  {activeOrder ? 'Add items to existing order' : 'Create a new order'}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {/* Show Demerge button if table has merged tables */}
                {selectedTable && selectedTable.mergedTables.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnmergeTables(selectedTable.id)}
                    disabled={submitting}
                    className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                  >
                    <Split className="w-4 h-4 mr-1" />
                    Demerge
                  </Button>
                )}
                <Select
                  key={selectedTable?.id + '-' + selectedTable?.status}
                  defaultValue={selectedTable?.status}
                  onValueChange={(v) => selectedTable && updateTableStatus(selectedTable.id, v)}
                >
                  <SelectTrigger className="w-32 bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {['VACANT', 'OCCUPIED', 'RESERVED', 'ORDER_PENDING'].map((s) => (
                      <SelectItem key={s} value={s} className="text-white">
                        {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          {/* Main Content - Scrollable */}
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Category Tabs */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
                className={selectedCategory === 'all' ? 'bg-orange-500' : 'border-slate-600 text-slate-300'}
                size="sm"
              >
                All Items
              </Button>
              {allMenuItems.some((i) => i.isSpecial) && (
                <Button
                  variant={selectedCategory === 'specials' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('specials')}
                  className={selectedCategory === 'specials' ? 'bg-orange-500' : 'border-slate-600 text-slate-300'}
                  size="sm"
                >
                  <Star className="w-4 h-4 mr-1" /> Specials
                </Button>
              )}
              {allMenuItems.some((i) => i.isPromotional) && (
                <Button
                  variant={selectedCategory === 'promos' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('promos')}
                  className={selectedCategory === 'promos' ? 'bg-orange-500' : 'border-slate-600 text-slate-300'}
                  size="sm"
                >
                  <Sparkles className="w-4 h-4 mr-1" /> Promos
                </Button>
              )}
              {promotions.length > 0 && (
                <Button
                  variant={selectedCategory === 'deals' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('deals')}
                  className={selectedCategory === 'deals' ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'border-orange-500/50 text-orange-300 bg-orange-500/10'}
                  size="sm"
                >
                  <Gift className="w-4 h-4 mr-1" /> Deals ({promotions.length})
                </Button>
              )}
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={selectedCategory === cat.id ? 'bg-orange-500' : 'border-slate-600 text-slate-300'}
                  size="sm"
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Menu Items - Vertical List */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white flex items-center justify-between">
                <span>{selectedCategory === 'deals' ? 'Active Deals & Bundles' : 'Menu'}</span>
                {searchTerm && (
                  <span className="text-sm font-normal text-slate-400">
                    Found {displayItems.length} items
                  </span>
                )}
              </h3>
              
              {/* Show Deals when deals category is selected */}
              {selectedCategory === 'deals' ? (
                <div className="space-y-3">
                  {promotions.map((promo) => (
                    <div
                      key={promo.id}
                      onClick={() => promo.type === 'BUNDLE' && addBundleToCart(promo)}
                      className={`p-4 rounded-lg bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/50 ${
                        promo.type === 'BUNDLE' ? 'cursor-pointer hover:border-orange-400 hover:from-orange-500/30 hover:to-amber-500/30 transition-all' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Gift className="w-5 h-5 text-orange-400" />
                            <span className="text-white font-semibold text-lg">{promo.name}</span>
                            <Badge className={
                              promo.type === 'BUNDLE' ? 'bg-orange-500 text-white' :
                              promo.type === 'PERCENTAGE' ? 'bg-purple-500 text-white' :
                              'bg-green-500 text-white'
                            }>
                              {promo.type === 'BUNDLE' ? 'Bundle' : promo.type === 'PERCENTAGE' ? `${promo.value}% OFF` : `$${promo.value} OFF`}
                            </Badge>
                          </div>
                          {promo.description && (
                            <p className="text-slate-300 text-sm mt-1">{promo.description}</p>
                          )}
                          {promo.menuItems.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {promo.menuItems.map((item) => (
                                <Badge key={item.id} variant="outline" className="border-orange-500/50 text-orange-200">
                                  {item.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          {promo.type === 'BUNDLE' && promo.bundlePrice && (
                            <>
                              {promo.menuItems.length > 0 && (
                                <span className="text-slate-500 line-through text-sm">
                                  ${promo.menuItems.reduce((sum: number, i: { price: number }) => sum + i.price, 0).toFixed(2)}
                                </span>
                              )}
                              <span className="text-orange-400 font-bold text-2xl">${promo.bundlePrice.toFixed(2)}</span>
                              <Button 
                                size="sm" 
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addBundleToCart(promo);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" /> Add Bundle
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {promotions.length === 0 && (
                    <p className="text-slate-400 text-center py-8">No active deals available</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`p-4 rounded-lg cursor-pointer transition-all hover:scale-[1.01] ${
                        item.isSpecial ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50' :
                        item.isPromotional ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50' :
                        'bg-slate-800 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.isSpecial && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
                          {item.isPromotional && <Sparkles className="w-5 h-5 text-green-400" />}
                          <div>
                            <span className="text-white font-medium text-lg">{item.name}</span>
                            {item.description && (
                              <p className="text-slate-400 text-sm">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.isPromotional && item.promotionalPrice ? (
                            <div className="text-right">
                              <span className="text-slate-500 line-through text-sm">${item.price.toFixed(2)}</span>
                              <span className="text-green-400 font-bold text-xl ml-2">${item.promotionalPrice.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-orange-400 font-bold text-xl">${item.price.toFixed(2)}</span>
                          )}
                          <Plus className="w-6 h-6 text-orange-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current Order */}
            {activeOrder && activeOrder.items.length > 0 && (() => {
              const totals = calculateOrderTotals(activeOrder);
              return (
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Current Order</h3>
                    {activeOrder.discountValue && (
                      <Badge className="bg-green-500 text-white">
                        {activeOrder.discountType === 'PERCENTAGE' 
                          ? `${activeOrder.discountValue}% OFF` 
                          : `$${activeOrder.discountValue} OFF`}
                      </Badge>
                    )}
                  </div>
                  {activeOrder.items.map((item) => (
                    <div key={item.id} className={`p-3 rounded-lg ${
                      item.status === 'READY' ? 'bg-green-500/20 border border-green-500/50' :
                      item.status === 'PREPARING' ? 'bg-orange-500/10 border border-orange-500/30' :
                      'bg-slate-700/50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-white font-medium">{item.quantity}x {item.menuItem.name}</span>
                          {item.notes && <p className="text-orange-400 text-xs">{item.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${
                            item.status === 'READY' ? 'bg-green-500' :
                            item.status === 'PREPARING' ? 'bg-orange-500' :
                            'bg-slate-600'
                          }`}>{item.status}</Badge>
                          <span className="text-slate-400">${(item.price * item.quantity).toFixed(2)}</span>
                          {item.status === 'PENDING' && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); removeOrderItem(activeOrder.id, item.id); }}
                              className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Order Totals with Tax */}
                  <div className="pt-3 border-t border-slate-600 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Subtotal</span>
                      <span className="text-slate-300">${totals.subtotal.toFixed(2)}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Discount
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={removeDiscount}
                            className="h-5 w-5 p-0 text-red-400 hover:bg-red-500/20 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </span>
                        <span className="text-green-400">-${totals.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Tax (13%)</span>
                      <span className="text-slate-300">${totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-600">
                      <span className="text-white">Total</span>
                      <span className="text-green-400">${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Cart Items - New Items with Allergies */}
            {cartItems.length > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-orange-500" />
                    New Items
                  </h3>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setCartItems([])} 
                    className="text-slate-400"
                  >
                    Clear All
                  </Button>
                </div>

                {cartItems.map((item) => (
                  <div key={item.id} className="bg-slate-800 rounded-lg p-4 space-y-3">
                    {/* Item Header */}
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium text-lg">{item.menuItem.name}</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => removeCartItem(item.id)}
                        className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/20"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Quantity & Price */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => updateCartItemQuantity(item.id, -1)} 
                          className="h-9 w-9 p-0 border-slate-600"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-white text-xl font-medium w-8 text-center">{item.quantity}</span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => updateCartItemQuantity(item.id, 1)} 
                          className="h-9 w-9 p-0 border-slate-600"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <span className="text-orange-400 font-bold text-xl">
                        ${(getItemPrice(item.menuItem) * item.quantity).toFixed(2)}
                      </span>
                    </div>

                    {/* Notes */}
                    <Input
                      placeholder="Special notes (e.g., no onions, extra spicy)"
                      value={item.notes}
                      onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />

                    {/* Allergies - Always Visible */}
                    <div>
                      <Label className="text-slate-400 text-sm mb-2 block">Allergies (select all that apply):</Label>
                      <div className="flex gap-2 flex-wrap">
                        {allergies.map((allergy) => (
                          <button
                            key={allergy.id}
                            type="button"
                            onClick={() => toggleCartItemAllergy(item.id, allergy.id)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                              allergyBadgeColor(allergy.badge, item.allergies.includes(allergy.id))
                            }`}
                          >
                            {allergy.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Cart Total */}
                <div className="flex justify-between items-center pt-3 border-t border-orange-500/30">
                  <span className="text-white font-medium">New Items Total</span>
                  <span className="text-orange-400 font-bold text-xl">${getCartTotal().toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="border-t border-slate-700 pt-4 gap-2">
            {cartItems.length > 0 && (
              <Button 
                onClick={submitOrder} 
                disabled={submitting} 
                className="bg-orange-500 hover:bg-orange-600 flex-1"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>{activeOrder ? 'Add to Order' : 'Create Order'} - ${getCartTotal().toFixed(2)}</>
                )}
              </Button>
            )}
            {activeOrder && (() => {
              const totals = calculateOrderTotals(activeOrder);
              return (
                <>
                  {canApplyDiscount && (
                    <Button 
                      variant="outline" 
                      onClick={() => setDiscountDialogOpen(true)} 
                      className="border-slate-600 text-slate-300"
                    >
                      <Percent className="w-4 h-4 mr-2" />
                      Discount
                    </Button>
                  )}
                  <Button 
                    onClick={() => setPaymentDialogOpen(true)} 
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Bill (${totals.total.toFixed(2)})
                  </Button>
                </>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-500" />
              Process Payment
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Table {selectedTable?.number}
            </DialogDescription>
          </DialogHeader>
          {activeOrder && (() => {
            const totals = calculateOrderTotals(activeOrder);
            return (
              <div className="space-y-4">
                {/* Order Summary */}
                <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-slate-300">${totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">Discount</span>
                      <span className="text-green-400">-${totals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tax (13%)</span>
                    <span className="text-slate-300">${totals.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2 border-t border-slate-600">
                    <span className="text-white">Total</span>
                    <span className="text-green-400">${totals.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Tip */}
                <div>
                  <Label className="text-slate-300">Tip (optional)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <Label className="text-slate-300">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'CASH' | 'CARD')}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="CASH" className="text-white">Cash</SelectItem>
                      <SelectItem value="CARD" className="text-white">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Final Amount */}
                {tipAmount && parseFloat(tipAmount) > 0 && (
                  <div className="flex justify-between text-lg font-bold text-green-400">
                    <span>Final Amount (with tip)</span>
                    <span>${(totals.total + parseFloat(tipAmount)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={processPayment} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                <Check className="w-4 h-4 mr-2" />
                Confirm Payment
              </>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              Apply Discount
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {canApplyDiscount 
                ? 'Apply a discount to this order'
                : 'Only Supervisors and Owners can apply discounts'}
            </DialogDescription>
          </DialogHeader>
          {canApplyDiscount ? (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Discount Type</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'PERCENTAGE' | 'FIXED')}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="PERCENTAGE" className="text-white">Percentage (%)</SelectItem>
                      <SelectItem value="FIXED" className="text-white">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">
                    {discountType === 'PERCENTAGE' ? 'Percentage' : 'Amount'}
                  </Label>
                  <Input
                    type="number"
                    placeholder={discountType === 'PERCENTAGE' ? 'e.g., 10' : 'e.g., 5.00'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Reason (optional)</Label>
                  <Input
                    placeholder="e.g., Birthday discount, Loyalty reward"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDiscountDialogOpen(false)} className="text-slate-400">
                  Cancel
                </Button>
                <Button 
                  onClick={applyDiscount}
                  disabled={submitting || !discountValue}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Discount'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <DialogFooter>
              <Button onClick={() => setDiscountDialogOpen(false)} className="bg-slate-600">
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

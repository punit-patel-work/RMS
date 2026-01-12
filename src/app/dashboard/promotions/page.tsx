'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  Loader2, Plus, Pencil, Trash2, Tag, Percent, DollarSign, 
  Gift, Calendar, Clock, CheckCircle, XCircle, Sparkles
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
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
  menuItems: MenuItem[];
  createdBy: { id: string; name: string };
  createdAt: string;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED' | 'BUNDLE'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMenuItems, setSelectedMenuItems] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [promotionsRes, categoriesRes] = await Promise.all([
        fetch('/api/promotions'),
        fetch('/api/menu/categories'),
      ]);
      
      setPromotions(await promotionsRes.json());
      
      const categories = await categoriesRes.json();
      const items = categories.flatMap((c: { menuItems: MenuItem[] }) => c.menuItems);
      setMenuItems(items);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('PERCENTAGE');
    setValue('');
    setBundlePrice('');
    setStartDate('');
    setEndDate('');
    setSelectedMenuItems([]);
    setEditingPromotion(null);
  };

  const openCreateDialog = () => {
    resetForm();
    // Set default dates
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(nextMonth.toISOString().split('T')[0]);
    setDialogOpen(true);
  };

  const openEditDialog = (promo: Promotion) => {
    setEditingPromotion(promo);
    setName(promo.name);
    setDescription(promo.description || '');
    setType(promo.type);
    setValue(promo.value.toString());
    setBundlePrice(promo.bundlePrice?.toString() || '');
    setStartDate(new Date(promo.startDate).toISOString().split('T')[0]);
    setEndDate(new Date(promo.endDate).toISOString().split('T')[0]);
    setSelectedMenuItems(promo.menuItems.map((m) => m.id));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description: description || null,
        type,
        value: parseFloat(value) || 0,
        bundlePrice: type === 'BUNDLE' ? parseFloat(bundlePrice) : null,
        startDate,
        endDate,
        menuItemIds: selectedMenuItems,
      };

      const res = await fetch(
        editingPromotion ? `/api/promotions/${editingPromotion.id}` : '/api/promotions',
        {
          method: editingPromotion ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save promotion');
      }

      toast.success(editingPromotion ? 'Promotion updated!' : 'Promotion created!');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (promo: Promotion) => {
    try {
      const res = await fetch(`/api/promotions/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });

      if (!res.ok) throw new Error('Failed to update');
      toast.success(promo.isActive ? 'Promotion deactivated' : 'Promotion activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update promotion');
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;

    try {
      const res = await fetch(`/api/promotions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Promotion deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete promotion');
    }
  };

  const getTypeIcon = (promoType: string) => {
    switch (promoType) {
      case 'PERCENTAGE': return <Percent className="w-4 h-4" />;
      case 'FIXED': return <DollarSign className="w-4 h-4" />;
      case 'BUNDLE': return <Gift className="w-4 h-4" />;
      default: return <Tag className="w-4 h-4" />;
    }
  };

  const getTypeColor = (promoType: string) => {
    switch (promoType) {
      case 'PERCENTAGE': return 'bg-purple-500';
      case 'FIXED': return 'bg-green-500';
      case 'BUNDLE': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  const isPromoActive = (promo: Promotion) => {
    const now = new Date();
    const start = new Date(promo.startDate);
    const end = new Date(promo.endDate);
    return promo.isActive && now >= start && now <= end;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const toggleMenuItem = (itemId: string) => {
    setSelectedMenuItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const activePromotions = promotions.filter(isPromoActive);
  const inactivePromotions = promotions.filter((p) => !isPromoActive(p));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Promotions & Deals</h1>
          <p className="text-slate-400 mt-1">Create and manage special offers</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          New Promotion
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-600/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-green-300">Active Promotions</CardDescription>
            <CardTitle className="text-3xl text-white">{activePromotions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/20 to-indigo-600/10 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-purple-300">Percentage Deals</CardDescription>
            <CardTitle className="text-3xl text-white">
              {promotions.filter((p) => p.type === 'PERCENTAGE').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/20 to-amber-600/10 border-orange-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-orange-300">Bundle Deals</CardDescription>
            <CardTitle className="text-3xl text-white">
              {promotions.filter((p) => p.type === 'BUNDLE').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Active Promotions */}
      {activePromotions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-green-400" />
            Active Promotions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePromotions.map((promo) => (
              <Card key={promo.id} className="bg-slate-800/50 border-green-500/30 hover:border-green-500/50 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${getTypeColor(promo.type)} text-white`}>
                        {getTypeIcon(promo.type)}
                        <span className="ml-1">{promo.type}</span>
                      </Badge>
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(promo)} className="h-8 w-8 p-0 text-slate-400">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deletePromotion(promo.id)} className="h-8 w-8 p-0 text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-white text-lg mt-2">{promo.name}</CardTitle>
                  {promo.description && (
                    <CardDescription className="text-slate-400">{promo.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-bold text-green-400">
                    {promo.type === 'PERCENTAGE' && `${promo.value}% OFF`}
                    {promo.type === 'FIXED' && `$${promo.value} OFF`}
                    {promo.type === 'BUNDLE' && `$${promo.bundlePrice} Bundle`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-4 h-4" />
                    {formatDate(promo.startDate)} - {formatDate(promo.endDate)}
                  </div>
                  {promo.menuItems.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {promo.menuItems.slice(0, 3).map((item) => (
                        <Badge key={item.id} variant="outline" className="text-xs border-slate-600 text-slate-300">
                          {item.name}
                        </Badge>
                      ))}
                      {promo.menuItems.length > 3 && (
                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                          +{promo.menuItems.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">By {promo.createdBy.name}</span>
                    <Switch checked={promo.isActive} onCheckedChange={() => toggleActive(promo)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Inactive/Expired Promotions */}
      {inactivePromotions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Inactive / Expired
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactivePromotions.map((promo) => (
              <Card key={promo.id} className="bg-slate-800/30 border-slate-700/50 opacity-75">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${getTypeColor(promo.type)} text-white opacity-50`}>
                        {getTypeIcon(promo.type)}
                        <span className="ml-1">{promo.type}</span>
                      </Badge>
                      <Badge className="bg-slate-600 text-slate-300">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(promo)} className="h-8 w-8 p-0 text-slate-400">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deletePromotion(promo.id)} className="h-8 w-8 p-0 text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-slate-300 text-lg mt-2">{promo.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xl font-bold text-slate-400">
                    {promo.type === 'PERCENTAGE' && `${promo.value}% OFF`}
                    {promo.type === 'FIXED' && `$${promo.value} OFF`}
                    {promo.type === 'BUNDLE' && `$${promo.bundlePrice} Bundle`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    {formatDate(promo.startDate)} - {formatDate(promo.endDate)}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-600">By {promo.createdBy.name}</span>
                    <Switch checked={promo.isActive} onCheckedChange={() => toggleActive(promo)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {promotions.length === 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Tag className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Promotions Yet</h3>
            <p className="text-slate-400 mb-4">Create your first promotion to attract customers</p>
            <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Promotion
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              {editingPromotion ? 'Edit Promotion' : 'Create New Promotion'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingPromotion ? 'Update the promotion details' : 'Set up a new promotion or deal'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Promotion Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Holiday Special, Meal Deal"
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the promotion..."
                  className="bg-slate-700/50 border-slate-600 text-white min-h-[80px]"
                />
              </div>
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <Label className="text-slate-300">Promotion Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="PERCENTAGE" className="text-white">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-purple-400" />
                      Percentage Discount
                    </div>
                  </SelectItem>
                  <SelectItem value="FIXED" className="text-white">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      Fixed Amount Off
                    </div>
                  </SelectItem>
                  <SelectItem value="BUNDLE" className="text-white">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-orange-400" />
                      Bundle Deal (Meal Deal)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Value Input */}
            <div className="grid gap-4 md:grid-cols-2">
              {(type === 'PERCENTAGE' || type === 'FIXED') && (
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    {type === 'PERCENTAGE' ? 'Discount Percentage' : 'Discount Amount'}
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={type === 'PERCENTAGE' ? '10' : '5.00'}
                      className="bg-slate-700/50 border-slate-600 text-white pl-8"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {type === 'PERCENTAGE' ? '%' : '$'}
                    </span>
                  </div>
                </div>
              )}
              {type === 'BUNDLE' && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Bundle Price *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={bundlePrice}
                      onChange={(e) => setBundlePrice(e.target.value)}
                      placeholder="12.99"
                      className="bg-slate-700/50 border-slate-600 text-white pl-8"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  </div>
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Start Date *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">End Date *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Menu Items Selection */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                {type === 'BUNDLE' ? 'Bundle Items (Select items included)' : 'Apply to Items (optional)'}
              </Label>
              <div className="bg-slate-700/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleMenuItem(item.id)}
                      className={`p-2 rounded-lg text-left text-sm transition-all ${
                        selectedMenuItems.includes(item.id)
                          ? 'bg-orange-500/20 border border-orange-500/50 text-orange-300'
                          : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-slate-400">${item.price.toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              </div>
              {selectedMenuItems.length > 0 && (
                <p className="text-sm text-orange-400">
                  {selectedMenuItems.length} item(s) selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingPromotion ? 'Update Promotion' : 'Create Promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

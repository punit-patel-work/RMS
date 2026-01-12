'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, FolderOpen, UtensilsCrossed } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string | null;
  order: number;
  menuItems: MenuItem[];
}

interface Allergy {
  id: string;
  name: string;
  badge: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  available: boolean;
  categoryId: string;
  allergies: string[];
  category?: Category;
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Category form state
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryOrder, setCategoryOrder] = useState(0);

  // Item form state
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemAllergies, setItemAllergies] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [categoriesRes, allergiesRes] = await Promise.all([
        fetch('/api/menu/categories'),
        fetch('/api/allergies'),
      ]);
      const categoriesData = await categoriesRes.json();
      const allergiesData = await allergiesRes.json();
      setCategories(categoriesData);
      setAllergies(allergiesData);
    } catch (error) {
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryDescription('');
    setCategoryOrder(0);
    setEditingCategory(null);
  };

  const resetItemForm = () => {
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemImage('');
    setItemAvailable(true);
    setItemCategoryId('');
    setItemAllergies([]);
    setEditingItem(null);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || '');
    setCategoryOrder(category.order);
    setCategoryDialog(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDescription(item.description || '');
    setItemPrice(item.price.toString());
    setItemImage(item.image || '');
    setItemAvailable(item.available);
    setItemCategoryId(item.categoryId);
    setItemAllergies(item.allergies);
    setItemDialog(true);
  };

  const handleCategorySubmit = async () => {
    setSubmitting(true);
    try {
      const url = editingCategory ? `/api/menu/categories/${editingCategory.id}` : '/api/menu/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName,
          description: categoryDescription || undefined,
          order: categoryOrder,
        }),
      });

      if (!res.ok) throw new Error('Failed to save category');

      toast.success(editingCategory ? 'Category updated' : 'Category created');
      setCategoryDialog(false);
      resetCategoryForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleItemSubmit = async () => {
    if (!itemCategoryId) {
      toast.error('Please select a category');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingItem ? `/api/menu/items/${editingItem.id}` : '/api/menu/items';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemName,
          description: itemDescription || undefined,
          price: parseFloat(itemPrice),
          image: itemImage || undefined,
          available: itemAvailable,
          categoryId: itemCategoryId,
          allergies: itemAllergies,
        }),
      });

      if (!res.ok) throw new Error('Failed to save item');

      toast.success(editingItem ? 'Item updated' : 'Item created');
      setItemDialog(false);
      resetItemForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category and all its items?')) return;

    try {
      const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete category');
      toast.success('Category deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Delete this menu item?')) return;

    try {
      const res = await fetch(`/api/menu/items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      toast.success('Item deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const toggleItemAvailable = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/menu/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !item.available }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      toast.success(item.available ? 'Item marked unavailable' : 'Item marked available');
      fetchData();
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  const allergyBadgeColor = (badge: string) => {
    const colors: Record<string, string> = {
      amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      red: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[badge] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
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
          <h1 className="text-3xl font-bold text-white">Menu Management</h1>
          <p className="text-slate-400 mt-1">Manage categories and menu items</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={categoryDialog} onOpenChange={(open) => { setCategoryDialog(open); if (!open) resetCategoryForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <FolderOpen className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  {editingCategory ? 'Update category details' : 'Create a new menu category'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Name</Label>
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g., Starters"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Input
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    placeholder="Optional description"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Display Order</Label>
                  <Input
                    type="number"
                    value={categoryOrder}
                    onChange={(e) => setCategoryOrder(parseInt(e.target.value) || 0)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCategoryDialog(false)} className="text-slate-400">
                  Cancel
                </Button>
                <Button onClick={handleCategorySubmit} disabled={submitting || !categoryName} className="bg-orange-500 hover:bg-orange-600">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingCategory ? 'Update' : 'Create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={itemDialog} onOpenChange={(open) => { setItemDialog(open); if (!open) resetItemForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  {editingItem ? 'Update menu item details' : 'Create a new menu item'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g., Bruschetta"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Input
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="Short description"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Price *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="0.00"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Category *</Label>
                    <Select value={itemCategoryId} onValueChange={setItemCategoryId}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="text-white">
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Image URL</Label>
                  <Input
                    value={itemImage}
                    onChange={(e) => setItemImage(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Allergies</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {allergies.map((allergy) => (
                      <button
                        key={allergy.id}
                        type="button"
                        onClick={() => {
                          setItemAllergies((prev) =>
                            prev.includes(allergy.id) ? prev.filter((a) => a !== allergy.id) : [...prev, allergy.id]
                          );
                        }}
                        className={`px-3 py-1 rounded-full text-sm border transition-all ${
                          itemAllergies.includes(allergy.id)
                            ? allergyBadgeColor(allergy.badge)
                            : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        {allergy.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">Available</Label>
                  <Switch checked={itemAvailable} onCheckedChange={setItemAvailable} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setItemDialog(false)} className="text-slate-400">
                  Cancel
                </Button>
                <Button onClick={handleItemSubmit} disabled={submitting || !itemName || !itemPrice || !itemCategoryId} className="bg-orange-500 hover:bg-orange-600">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingItem ? 'Update' : 'Create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="items" className="data-[state=active]:bg-orange-500">Menu Items</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-orange-500">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-6">
          {categories.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UtensilsCrossed className="w-12 h-12 text-slate-500 mb-4" />
                <p className="text-slate-400">No categories yet. Create a category first.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {categories.map((category) => (
                <div key={category.id}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-orange-500" />
                    {category.name}
                    <Badge variant="outline" className="ml-2 text-slate-400 border-slate-600">
                      {category.menuItems.length} items
                    </Badge>
                  </h3>
                  {category.menuItems.length === 0 ? (
                    <p className="text-slate-500 text-sm ml-7">No items in this category</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.menuItems.map((item) => (
                        <Card key={item.id} className={`bg-slate-800/50 border-slate-700 ${!item.available ? 'opacity-60' : ''}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-white text-lg">{item.name}</CardTitle>
                                <CardDescription className="text-slate-400 line-clamp-2">
                                  {item.description || 'No description'}
                                </CardDescription>
                              </div>
                              <span className="text-orange-400 font-bold">${item.price.toFixed(2)}</span>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {item.allergies.map((allergyId) => {
                                const allergy = allergies.find((a) => a.id === allergyId);
                                return allergy ? (
                                  <Badge key={allergyId} className={allergyBadgeColor(allergy.badge)}>
                                    {allergy.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={item.available}
                                  onCheckedChange={() => toggleItemAvailable(item)}
                                  className="scale-90"
                                />
                                <span className="text-xs text-slate-500">{item.available ? 'Available' : 'Unavailable'}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openEditItem(item)} className="text-slate-400 hover:text-white">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-400">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white">{category.name}</CardTitle>
                      <CardDescription className="text-slate-400">
                        {category.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-slate-400 border-slate-600">
                      Order: {category.order}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">{category.menuItems.length} items</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditCategory(category)} className="text-slate-400 hover:text-white">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteCategory(category.id)} className="text-slate-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

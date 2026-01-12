'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Users, Mail } from 'lucide-react';

interface Staff {
  id: string;
  email: string;
  name: string;
  role: 'FLOOR_STAFF' | 'KITCHEN_STAFF' | 'SUPERVISOR';
  createdAt: string;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'FLOOR_STAFF' | 'KITCHEN_STAFF'>('FLOOR_STAFF');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      setStaff(data);
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('FLOOR_STAFF');
    setEditingStaff(null);
  };

  const openEdit = (member: Staff) => {
    setEditingStaff(member);
    setName(member.name);
    setEmail(member.email);
    setPassword('');
    setRole(member.role === 'SUPERVISOR' ? 'FLOOR_STAFF' : member.role);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const url = editingStaff ? `/api/staff/${editingStaff.id}` : '/api/staff';
      const method = editingStaff ? 'PUT' : 'POST';

      const body: Record<string, unknown> = { name, email, role };
      if (password) body.password = password;
      if (!editingStaff) body.password = password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save staff');
      }

      toast.success(editingStaff ? 'Staff updated' : 'Staff created');
      setDialogOpen(false);
      resetForm();
      fetchStaff();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save staff');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteStaff = async (id: string) => {
    if (!confirm('Delete this staff member?')) return;

    try {
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete staff');
      toast.success('Staff deleted');
      fetchStaff();
    } catch (error) {
      toast.error('Failed to delete staff');
    }
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'SUPERVISOR':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'FLOOR_STAFF':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'KITCHEN_STAFF':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const formatRole = (r: string) => r.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

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
          <h1 className="text-3xl font-bold text-white">Staff Management</h1>
          <p className="text-slate-400 mt-1">Manage your restaurant staff</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">{editingStaff ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingStaff ? 'Update staff details' : 'Create a new staff account'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Password {editingStaff ? '(leave blank to keep current)' : '*'}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Role *</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'FLOOR_STAFF' | 'KITCHEN_STAFF')}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="FLOOR_STAFF" className="text-white">Floor Staff</SelectItem>
                    <SelectItem value="KITCHEN_STAFF" className="text-white">Kitchen Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-400">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !name || !email || (!editingStaff && !password)}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingStaff ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {staff.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">No staff members yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => (
            <Card key={member.id} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-white font-medium text-lg">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-white">{member.name}</CardTitle>
                      <CardDescription className="text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {member.email}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge className={getRoleBadgeColor(member.role)}>{formatRole(member.role)}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(member)} className="text-slate-400 hover:text-white">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteStaff(member.id)} className="text-slate-400 hover:text-red-400">
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
  );
}

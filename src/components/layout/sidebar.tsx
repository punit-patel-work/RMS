'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
type Role = 'OWNER' | 'SUPERVISOR' | 'FLOOR_STAFF' | 'KITCHEN_STAFF';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  BarChart3,
  TableProperties,
  ClipboardList,
  ChefHat,
  LogOut,
  Menu,
  X,
  User,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF', 'KITCHEN_STAFF'],
  },
  {
    title: 'My Profile',
    href: '/dashboard/profile',
    icon: User,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF', 'KITCHEN_STAFF'],
  },
  {
    title: 'Menu Management',
    href: '/dashboard/menu',
    icon: UtensilsCrossed,
    roles: ['OWNER', 'SUPERVISOR'],
  },
  {
    title: 'Promotions',
    href: '/dashboard/promotions',
    icon: Tag,
    roles: ['OWNER', 'SUPERVISOR'],
  },
  {
    title: 'Staff Management',
    href: '/dashboard/staff',
    icon: Users,
    roles: ['OWNER', 'SUPERVISOR'],
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    roles: ['OWNER', 'SUPERVISOR'],
  },
  {
    title: 'Tables',
    href: '/dashboard/tables',
    icon: TableProperties,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'],
  },
  {
    title: 'Orders',
    href: '/dashboard/orders',
    icon: ClipboardList,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'],
  },
  {
    title: 'Kitchen Display',
    href: '/dashboard/kitchen',
    icon: ChefHat,
    roles: ['OWNER', 'SUPERVISOR', 'KITCHEN_STAFF'],
  },
];

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) => item.roles.includes(user.role));

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'SUPERVISOR':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'FLOOR_STAFF':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'KITCHEN_STAFF':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const formatRole = (role: Role) => {
    return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">RMS</h1>
            <p className="text-xs text-slate-500">Restaurant Management</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-700/50" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/10 text-orange-400 border border-orange-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                )}
              >
                <item.icon className={cn('w-5 h-5', isActive ? 'text-orange-400' : '')} />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-slate-700/50" />

      {/* User section */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <div
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
            getRoleBadgeColor(user.role)
          )}
        >
          {formatRole(user.role)}
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg text-white"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800/95 backdrop-blur-sm border-r border-slate-700/50 transform transition-transform duration-200 ease-in-out lg:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

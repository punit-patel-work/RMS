'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, DollarSign, ShoppingCart, TrendingUp, Mail, Calendar,
  Download, FileText, FileSpreadsheet, Percent, Clock, RefreshCw
} from 'lucide-react';

interface ItemSales {
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  revenue: number;
}

interface ReportData {
  dateRange: { start: string; end: string };
  totalSales: number;
  totalOrders: number;
  totalDiscounts: number;
  averageOrderValue: number;
  itemsSold: ItemSales[];
  paymentMethods: { method: string; count: number; amount: number }[];
  hourlyBreakdown: { hour: number; orders: number; revenue: number }[];
  orderTypeBreakdown: { type: string; count: number; amount: number }[];
}

interface Order {
  id: string;
  totalAmount: number;
  status: string;
  orderType?: string;
  discountType: string | null;
  discountValue: number | null;
  discountReason: string | null;
  createdAt: string;
  payment?: {
    createdAt: string;
    amount: number;
    method: string;
  };
  items: {
    quantity: number;
    price: number;
    menuItem: {
      name: string;
      category: { name: string };
    };
  }[];
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Date selection
  const [dateMode, setDateMode] = useState<'today' | 'range' | 'specific'>('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Live ongoing orders (today only)
  const [ongoingOrders, setOngoingOrders] = useState({ count: 0, value: 0 });
  
  // Report data
  const [report, setReport] = useState<ReportData>({
    dateRange: { start: '', end: '' },
    totalSales: 0,
    totalOrders: 0,
    totalDiscounts: 0,
    averageOrderValue: 0,
    itemsSold: [],
    paymentMethods: [],
    hourlyBreakdown: [],
    orderTypeBreakdown: [],
  });

  const getDateRange = useCallback(() => {
    if (dateMode === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    } else if (dateMode === 'specific') {
      return { start: specificDate, end: specificDate };
    } else {
      return { start: startDate, end: endDate };
    }
  }, [dateMode, startDate, endDate, specificDate]);

  const fetchOngoingOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) return;
      const orders: Order[] = await res.json();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Filter for today's ongoing (not paid) orders
      const ongoing = orders.filter((order) => {
        if (order.status === 'PAID' || order.status === 'CANCELLED') return false;
        const orderDate = new Date(order.createdAt);
        return orderDate >= today;
      });
      
      const count = ongoing.length;
      const value = ongoing.reduce((sum: number, order: { totalAmount: number }) => sum + order.totalAmount, 0);
      setOngoingOrders({ count, value });
    } catch {
      // Silent fail for ongoing updates
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Failed to load orders');
      const orders: Order[] = await res.json();

      const startOfDay = new Date(range.start);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(range.end);
      endOfDay.setHours(23, 59, 59, 999);

      // Filter paid orders in date range
      const filteredOrders = orders.filter((order) => {
        if (order.status !== 'PAID' || !order.payment) return false;
        const paymentDate = new Date(order.payment.createdAt);
        return paymentDate >= startOfDay && paymentDate <= endOfDay;
      });

      // Calculate totals
      const totalSales = filteredOrders.reduce((sum: number, order: { payment?: { amount: number } }) => sum + (order.payment?.amount || 0), 0);
      const totalOrders = filteredOrders.length;
      const totalDiscounts = filteredOrders.reduce((sum: number, order: { discountType: string | null; discountValue: number | null; totalAmount: number }) => {
        if (order.discountType === 'FIXED') return sum + (order.discountValue || 0);
        if (order.discountType === 'PERCENTAGE') {
          const originalTotal = order.totalAmount / (1 - (order.discountValue || 0) / 100);
          return sum + (originalTotal - order.totalAmount);
        }
        return sum;
      }, 0);
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Calculate item sales
      const itemMap: Record<string, ItemSales> = {};
      filteredOrders.forEach((order) => {
        order.items.forEach((item) => {
          const key = item.menuItem.name;
          if (!itemMap[key]) {
            itemMap[key] = {
              name: item.menuItem.name,
              category: item.menuItem.category?.name || 'Uncategorized',
              quantity: 0,
              unitPrice: item.price,
              revenue: 0,
            };
          }
          itemMap[key].quantity += item.quantity;
          itemMap[key].revenue += item.price * item.quantity;
        });
      });
      const itemsSold = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);

      // Calculate payment methods
      const paymentMap: Record<string, { method: string; count: number; amount: number }> = {};
      filteredOrders.forEach((order) => {
        const method = order.payment?.method || 'UNKNOWN';
        if (!paymentMap[method]) {
          paymentMap[method] = { method, count: 0, amount: 0 };
        }
        paymentMap[method].count++;
        paymentMap[method].amount += order.payment?.amount || 0;
      });
      const paymentMethods = Object.values(paymentMap);

      // Calculate hourly breakdown
      const hourlyMap: Record<number, { hour: number; orders: number; revenue: number }> = {};
      for (let i = 0; i < 24; i++) {
        hourlyMap[i] = { hour: i, orders: 0, revenue: 0 };
      }
      filteredOrders.forEach((order) => {
        const hour = new Date(order.payment!.createdAt).getHours();
        hourlyMap[hour].orders++;
        hourlyMap[hour].revenue += order.payment?.amount || 0;
      });
      const hourlyBreakdown = Object.values(hourlyMap).filter((h) => h.orders > 0);

      // Calculate order type breakdown
      const orderTypeMap: Record<string, { type: string; count: number; amount: number }> = {};
      filteredOrders.forEach((order) => {
        const type = order.orderType || 'DINE_IN';
        const displayType = type === 'TO_GO' ? 'To-Go' : type === 'QUICK_SALE' ? 'Quick Sale' : 'Dine-In';
        if (!orderTypeMap[type]) {
          orderTypeMap[type] = { type: displayType, count: 0, amount: 0 };
        }
        orderTypeMap[type].count++;
        orderTypeMap[type].amount += order.payment?.amount || 0;
      });
      const orderTypeBreakdown = Object.values(orderTypeMap);

      setReport({
        dateRange: range,
        totalSales,
        totalOrders,
        totalDiscounts,
        averageOrderValue,
        itemsSold,
        paymentMethods,
        hourlyBreakdown,
        orderTypeBreakdown,
      });
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchReport();
    fetchOngoingOrders();
    // Refresh ongoing orders every 30 seconds
    const interval = setInterval(fetchOngoingOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchReport, fetchOngoingOrders]);

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch('/api/email/close-day', { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send email');
      }
      toast.success('Report sent to owner email!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const generateCSV = () => {
    const lines: string[] = [];
    lines.push('Sales Report');
    lines.push(`Date Range: ${report.dateRange.start} to ${report.dateRange.end}`);
    lines.push('');
    
    // Summary
    lines.push('SUMMARY');
    lines.push(`Total Sales,$${report.totalSales.toFixed(2)}`);
    lines.push(`Total Orders,${report.totalOrders}`);
    lines.push(`Total Discounts Given,$${report.totalDiscounts.toFixed(2)}`);
    lines.push(`Average Order Value,$${report.averageOrderValue.toFixed(2)}`);
    lines.push('');
    
    // Items sold
    lines.push('ITEMS SOLD');
    lines.push('Item Name,Category,Quantity,Unit Price,Revenue');
    report.itemsSold.forEach((item) => {
      lines.push(`${item.name},${item.category},${item.quantity},$${item.unitPrice.toFixed(2)},$${item.revenue.toFixed(2)}`);
    });
    lines.push('');
    
    // Payment methods
    lines.push('PAYMENT METHODS');
    lines.push('Method,Count,Amount');
    report.paymentMethods.forEach((pm) => {
      lines.push(`${pm.method},${pm.count},$${pm.amount.toFixed(2)}`);
    });
    lines.push('');
    
    // Hourly breakdown
    lines.push('HOURLY BREAKDOWN');
    lines.push('Hour,Orders,Revenue');
    report.hourlyBreakdown.forEach((h) => {
      const hourStr = `${h.hour.toString().padStart(2, '0')}:00`;
      lines.push(`${hourStr},${h.orders},$${h.revenue.toFixed(2)}`);
    });
    
    return lines.join('\n');
  };

  const handleDownloadExcel = () => {
    setExporting(true);
    try {
      const csv = generateCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `sales_report_${report.dateRange.start}_to_${report.dateRange.end}.csv`;
      link.click();
      toast.success('Excel (CSV) file downloaded!');
    } catch {
      toast.error('Failed to download');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPDF = () => {
    setExporting(true);
    try {
      // Create a printable HTML document
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to download PDF');
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sales Report - ${report.dateRange.start} to ${report.dateRange.end}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
            h1 { color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 10px; }
            h2 { color: #475569; margin-top: 30px; }
            .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
            .summary-card { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .summary-card h3 { margin: 0; color: #64748b; font-size: 14px; }
            .summary-card p { margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f1f5f9; font-weight: 600; color: #475569; }
            .total-row { font-weight: bold; background: #fef3c7; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>🍽️ Restaurant Sales Report</h1>
          <p><strong>Date Range:</strong> ${report.dateRange.start} to ${report.dateRange.end}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          
          <h2>📊 Summary</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Sales</h3>
              <p>$${report.totalSales.toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Orders Completed</h3>
              <p>${report.totalOrders}</p>
            </div>
            <div class="summary-card">
              <h3>Discounts Given</h3>
              <p>$${report.totalDiscounts.toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Average Order Value</h3>
              <p>$${report.averageOrderValue.toFixed(2)}</p>
            </div>
          </div>
          
          <h2>🛒 Items Sold</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Qty Sold</th>
                <th>Unit Price</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${report.itemsSold.map((item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.category}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.unitPrice.toFixed(2)}</td>
                  <td>$${item.revenue.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">TOTAL</td>
                <td>${report.itemsSold.reduce((s, i) => s + i.quantity, 0)}</td>
                <td>-</td>
                <td>$${report.itemsSold.reduce((s, i) => s + i.revenue, 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <h2>💳 Payment Methods</h2>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Transactions</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${report.paymentMethods.map((pm) => `
                <tr>
                  <td>${pm.method}</td>
                  <td>${pm.count}</td>
                  <td>$${pm.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${report.hourlyBreakdown.length > 0 ? `
          <h2>⏰ Hourly Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th>Hour</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${report.hourlyBreakdown.map((h) => `
                <tr>
                  <td>${h.hour.toString().padStart(2, '0')}:00</td>
                  <td>${h.orders}</td>
                  <td>$${h.revenue.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}
          
          <div class="footer">
            <p>Restaurant Management System - Confidential Report</p>
            <p>Press Ctrl+P (or Cmd+P) to print/save as PDF</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      toast.success('PDF print dialog opened!');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading && report.totalOrders === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics & Reports</h1>
          <p className="text-slate-400 mt-1">Sales performance and detailed reports</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleDownloadExcel} 
            disabled={exporting}
            className="border-green-500/50 text-green-400 hover:bg-green-500/20"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDownloadPDF} 
            disabled={exporting}
            className="border-red-500/50 text-red-400 hover:bg-red-500/20"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            onClick={handleSendEmail} 
            disabled={sendingEmail}
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            Send Report by Email
          </Button>
        </div>
      </div>

      {/* Today's Ongoing Orders */}
      <Card className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-white">Ongoing Orders Today</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchOngoingOrders} className="text-slate-400 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-3xl font-bold text-white">{ongoingOrders.count}</p>
              <p className="text-sm text-slate-400">Active orders</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-400">${ongoingOrders.value.toFixed(2)}</p>
              <p className="text-sm text-slate-400">Pending revenue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Selection */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-400" />
            <CardTitle className="text-white">Date Range Selection</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={dateMode === 'today' ? 'default' : 'outline'}
              onClick={() => setDateMode('today')}
              className={dateMode === 'today' ? 'bg-orange-500' : 'border-slate-600'}
            >
              Today
            </Button>
            <Button
              variant={dateMode === 'specific' ? 'default' : 'outline'}
              onClick={() => setDateMode('specific')}
              className={dateMode === 'specific' ? 'bg-orange-500' : 'border-slate-600'}
            >
              Specific Date
            </Button>
            <Button
              variant={dateMode === 'range' ? 'default' : 'outline'}
              onClick={() => setDateMode('range')}
              className={dateMode === 'range' ? 'bg-orange-500' : 'border-slate-600'}
            >
              Date Range
            </Button>
          </div>

          {dateMode === 'specific' && (
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-slate-400">Select Date</Label>
                <Input
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white w-48"
                />
              </div>
            </div>
          )}

          {dateMode === 'range' && (
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <Label className="text-slate-400">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white w-48"
                />
              </div>
              <div>
                <Label className="text-slate-400">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white w-48"
                />
              </div>
            </div>
          )}

          <Button onClick={fetchReport} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Sales</CardTitle>
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">${report.totalSales.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">Revenue collected</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Orders Completed</CardTitle>
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{report.totalOrders}</div>
            <p className="text-xs text-slate-500 mt-1">Paid orders</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Discounts Given</CardTitle>
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <Percent className="w-5 h-5 text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">${report.totalDiscounts.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">Total discounts applied</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Average Order</CardTitle>
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">${report.averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">Per order average</p>
          </CardContent>
        </Card>
      </div>

      {/* Order Type Breakdown */}
      {report.orderTypeBreakdown.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              📊 Sales by Order Type
            </CardTitle>
            <CardDescription className="text-slate-400">Breakdown by Dine-In, To-Go, and Quick Sale</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {report.orderTypeBreakdown.map((typeData) => {
                const color = typeData.type === 'To-Go' ? 'orange' : 
                              typeData.type === 'Quick Sale' ? 'cyan' : 'violet';
                const icon = typeData.type === 'To-Go' ? '📦' : 
                             typeData.type === 'Quick Sale' ? '⚡' : '🍽️';
                return (
                  <div key={typeData.type} className={`bg-${color}-500/10 border border-${color}-500/30 rounded-lg p-4`}
                       style={{ 
                         backgroundColor: color === 'orange' ? 'rgba(249,115,22,0.1)' : 
                                         color === 'cyan' ? 'rgba(6,182,212,0.1)' : 
                                         'rgba(139,92,246,0.1)',
                         borderColor: color === 'orange' ? 'rgba(249,115,22,0.3)' : 
                                     color === 'cyan' ? 'rgba(6,182,212,0.3)' : 
                                     'rgba(139,92,246,0.3)'
                       }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold text-white">{icon} {typeData.type}</span>
                      <Badge className={`${
                        color === 'orange' ? 'bg-orange-500' : 
                        color === 'cyan' ? 'bg-cyan-500' : 'bg-violet-500'
                      }`}>
                        {typeData.count} orders
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold text-white">${typeData.amount.toFixed(2)}</div>
                    <p className="text-xs text-slate-400 mt-1">
                      {report.totalSales > 0 ? ((typeData.amount / report.totalSales) * 100).toFixed(1) : 0}% of total
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Sold Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                🛒 Items Sold
              </CardTitle>
              <CardDescription className="text-slate-400">Detailed breakdown of all items sold</CardDescription>
            </div>
            <Badge className="bg-orange-500">{report.itemsSold.length} items</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {report.itemsSold.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No sales data for selected period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">#</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Item Name</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Category</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Qty Sold</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Unit Price</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.itemsSold.map((item, index) => (
                    <tr key={item.name} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-4 text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4 text-white font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-slate-400">{item.category}</td>
                      <td className="py-3 px-4 text-right text-white">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-slate-400">${item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-green-400 font-bold">${item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-700/50">
                    <td colSpan={3} className="py-3 px-4 text-white font-bold">TOTAL</td>
                    <td className="py-3 px-4 text-right text-white font-bold">
                      {report.itemsSold.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">-</td>
                    <td className="py-3 px-4 text-right text-green-400 font-bold">
                      ${report.itemsSold.reduce((s, i) => s + i.revenue, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods & Hourly Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              💳 Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.paymentMethods.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No payment data</p>
            ) : (
              <div className="space-y-3">
                {report.paymentMethods.map((pm) => (
                  <div key={pm.method} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={pm.method === 'CASH' ? 'bg-green-500' : 'bg-blue-500'}>
                        {pm.method}
                      </Badge>
                      <span className="text-slate-400">{pm.count} transactions</span>
                    </div>
                    <span className="text-white font-bold">${pm.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              ⏰ Hourly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.hourlyBreakdown.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No hourly data</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {report.hourlyBreakdown.map((h) => (
                  <div key={h.hour} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                    <span className="text-slate-400">{h.hour.toString().padStart(2, '0')}:00</span>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400">{h.orders} orders</span>
                      <span className="text-green-400 font-medium">${h.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

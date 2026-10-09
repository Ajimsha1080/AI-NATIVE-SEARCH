'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Filter, Eye, ChevronRight, CheckCircle2, Clock, 
  Truck, AlertCircle, RefreshCw, X
} from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  shipping_address?: string;
  tracking_number?: string;
  carrier?: string;
  items: Array<{
    product_id: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  created_at: string;
}

export default function OrdersManagementPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Status edit form
  const [editFulfillment, setEditFulfillment] = useState('');
  const [editCarrier, setEditCarrier] = useState('');
  const [editTracking, setEditTracking] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/commerce/orders';
      if (statusFilter !== 'ALL') {
        url += `?status=${statusFilter}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditFulfillment(order.fulfillment_status || 'UNFULFILLED');
    setEditCarrier(order.carrier || '');
    setEditTracking(order.tracking_number || '');
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/v1/commerce/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fulfillment_status: editFulfillment,
          carrier: editCarrier,
          tracking_number: editTracking,
          status: editFulfillment === 'FULFILLED' ? 'COMPLETED' : selectedOrder.status,
        }),
      });

      if (res.ok) {
        await fetchOrders();
        setSelectedOrder(prev => prev ? {
          ...prev,
          fulfillment_status: editFulfillment,
          carrier: editCarrier,
          tracking_number: editTracking,
          status: editFulfillment === 'FULFILLED' ? 'COMPLETED' : prev.status,
        } : null);
      }
    } catch (err) {
      console.error('Failed to update order status', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Orders Management</h1>
          <p className="text-xs text-zinc-500">Monitor store conversions, customer inquiries, and fulfillment operations.</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-2xs self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Orders
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by order #, customer name or email..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1 shadow-2xs">
          {['ALL', 'PAID', 'PROCESSING', 'COMPLETED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === status
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/60 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Fulfillment</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Package className="w-6 h-6 mx-auto mb-2 text-zinc-300" />
                    No orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-zinc-50/70 transition">
                    <td className="py-3 px-4 font-bold text-zinc-900">{order.order_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-800">{order.customer_name}</div>
                      <div className="text-[11px] text-zinc-400">{order.customer_email}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-zinc-900">
                      ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        order.status === 'COMPLETED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        order.fulfillment_status === 'FULFILLED' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {order.fulfillment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-[11px]">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleSelectOrder(order)}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg font-medium transition text-[11px]"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Order {selectedOrder.order_number}</h3>
                  <span className="text-[11px] text-zinc-400">ID: {selectedOrder.id}</span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Info */}
              <div className="bg-zinc-50 p-4 rounded-xl space-y-2 border border-zinc-200/60 text-xs">
                <span className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] block">Customer Details</span>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Name:</span>
                  <span className="font-semibold text-zinc-900">{selectedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Email:</span>
                  <span className="font-semibold text-zinc-900">{selectedOrder.customer_email}</span>
                </div>
                {selectedOrder.shipping_address && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Address:</span>
                    <span className="font-semibold text-zinc-900 text-right">{selectedOrder.shipping_address}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <span className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] block">Purchased Items</span>
                <div className="divide-y divide-zinc-100 border border-zinc-200/80 rounded-xl overflow-hidden">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs bg-white">
                      <div>
                        <div className="font-semibold text-zinc-900">{item.title}</div>
                        <div className="text-[11px] text-zinc-400">Qty: {item.quantity}</div>
                      </div>
                      <div className="font-bold text-zinc-800">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-zinc-50 flex justify-between font-bold text-xs text-zinc-900">
                    <span>Grand Total</span>
                    <span>₹{selectedOrder.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleUpdateStatus} className="space-y-4 border-t border-zinc-100 pt-4">
                <span className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] block">Fulfillment Management</span>
                
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">Fulfillment Status</label>
                  <select
                    value={editFulfillment}
                    onChange={e => setEditFulfillment(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="UNFULFILLED">UNFULFILLED</option>
                    <option value="IN_TRANSIT">IN_TRANSIT</option>
                    <option value="FULFILLED">FULFILLED</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">Carrier</label>
                    <input
                      type="text"
                      value={editCarrier}
                      onChange={e => setEditCarrier(e.target.value)}
                      placeholder="e.g., BlueDart, Delhivery"
                      className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={editTracking}
                      onChange={e => setEditTracking(e.target.value)}
                      placeholder="Tracking ID"
                      className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-xs flex items-center justify-center gap-2"
                >
                  {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                  Save Status &amp; Tracking
                </button>
              </form>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-semibold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

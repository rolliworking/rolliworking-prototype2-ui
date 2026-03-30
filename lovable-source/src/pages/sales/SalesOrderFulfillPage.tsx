// Sales Order Fulfillment Page - prompts to push to QBO after fulfillment
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSalesOrder, useSalesOrderLines, type SalesOrder } from '@/hooks/useSalesOrders';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, Loader2, Send, Truck, X, AlertTriangle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function SalesOrderFulfillPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: order, isLoading: orderLoading } = useSalesOrder(id);
  const { data: lines = [] } = useSalesOrderLines(id);
  
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'customer' | 'items' | 'order'>('idle');
  const [isComplete, setIsComplete] = useState(false);
  
  const subtotal = lines.reduce((sum, line) => sum + (line.extended_price || 0), 0);
  const total = subtotal + (order?.shipping_amount || 0);
  
  // Check if customer is synced with QBO
  const isCustomerSynced = Boolean(order?.customers?.qbo_customer_id);
  
  // Check if already pushed to QBO
  const isAlreadyPushed = Boolean(order?.qbo_invoice_id);
  
  const getCustomerName = () => {
    if (!order?.customers) return 'Unknown Customer';
    const c = order.customers;
    return c.display_name || c.company_name || `${c.first_name} ${c.last_name}`.trim();
  };
  
  const handlePushToQBO = async () => {
    if (!order) return;
    
    setIsPushing(true);
    
    try {
      // Step 1: Push customer to QBO if not synced
      if (!order.customers?.qbo_customer_id) {
        setPushStatus('customer');
        console.log('[Fulfill] Step 1: Pushing customer to QBO...');
        
        const { data: customerResult, error: customerError } = await supabase.functions.invoke('qbo-customer-push', {
          body: { customer_id: order.customer_id }
        });
        
        if (customerError) {
          throw new Error(`Failed to create customer in QBO: ${customerError.message}`);
        }
        
        if (!customerResult?.success) {
          throw new Error(customerResult?.error || 'Failed to create customer in QuickBooks');
        }
        
        console.log('[Fulfill] Customer pushed to QBO:', customerResult.qbo_customer_id);
        
        // Invalidate customer queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
        
        // Small delay to ensure the customer sync is complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Step 2: Push parts/items to QBO if not synced
      const partIds = lines
        .filter(line => line.part_id)
        .map(line => line.part_id)
        .filter((partId): partId is string => !!partId);
      
      if (partIds.length > 0) {
        setPushStatus('items');
        console.log('[Fulfill] Step 2: Pushing items to QBO...', partIds);
        
        const { data: itemsResult, error: itemsError } = await supabase.functions.invoke('qbo-item-push', {
          body: { part_ids: partIds }
        });
        
        if (itemsError) {
          console.warn('[Fulfill] Items push warning:', itemsError.message);
          // Don't fail the whole flow if items fail - continue to invoice
        } else if (itemsResult?.synced > 0) {
          console.log('[Fulfill] Items pushed to QBO:', itemsResult.synced, 'synced,', itemsResult.skipped, 'already synced');
          toast.info(`Synced ${itemsResult.synced} product(s) to QuickBooks`);
        }
        
        // Small delay after items sync
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Step 3: Push sales order/invoice to QBO
      setPushStatus('order');
      console.log('[Fulfill] Step 3: Pushing sales order to QBO...');
      
      const { data, error } = await supabase.functions.invoke('qbo-sales-order-push', {
        body: { sales_order_id: order.id }
      });
      
      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to push to QuickBooks');
      }
      
      // Refresh order (invoice id is persisted by the backend push function)
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });

      toast.success('Successfully pushed to QuickBooks!');
      setIsComplete(true);
    } catch (err: any) {
      console.error('Push to QBO failed:', err);
      toast.error(err.message || 'Failed to push to QuickBooks');
    } finally {
      setIsPushing(false);
      setPushStatus('idle');
    }
  };
  
  const handleSkip = () => {
    toast.info('Sales order fulfilled without pushing to QuickBooks');
    navigate('/sales/orders');
  };
  
  const handleDone = () => {
    navigate('/sales/orders');
  };

  const getPushButtonText = () => {
    if (!isPushing) {
      if (!isCustomerSynced) {
        return (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Sync Customer, Products & Push to QuickBooks
          </>
        );
      }
      return (
        <>
          <Send className="h-4 w-4 mr-2" />
          Push to QuickBooks
        </>
      );
    }
    
    if (pushStatus === 'customer') {
      return (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Step 1/3: Creating customer in QuickBooks...
        </>
      );
    }
    
    if (pushStatus === 'items') {
      return (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Step 2/3: Syncing products to QuickBooks...
        </>
      );
    }
    
    return (
      <>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Step 3/3: Creating invoice in QuickBooks...
      </>
    );
  };
  
  if (orderLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  if (!order) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500">Sales order not found</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-2xl mx-auto py-12 px-4">
        {/* Back link */}
        <button
          onClick={() => navigate(`/sales/orders/${id}`)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sales Order
        </button>
        
        {isComplete ? (
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-700">Order Complete!</CardTitle>
              <CardDescription className="text-base">
                Sales order {order.so_number} has been fulfilled and pushed to QuickBooks.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Button 
                onClick={handleDone} 
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Done
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-sky-100 flex items-center justify-center">
                <Truck className="h-10 w-10 text-sky-600" />
              </div>
              <CardTitle className="text-2xl">Order Fulfilled!</CardTitle>
              <CardDescription className="text-base">
                Sales order <span className="font-semibold">{order.so_number}</span> is now fulfilled.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Order Summary */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Customer</span>
                  <span className="font-medium text-slate-900">{getCustomerName()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Items</span>
                  <span className="font-medium text-slate-900">{lines.length} line(s)</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2 mt-2">
                  <span className="text-slate-900">Total</span>
                  <span className="text-slate-900">${total.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Already pushed warning */}
              {isAlreadyPushed && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    This order was already pushed to QuickBooks (Invoice ID: {order.qbo_invoice_id}).
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Customer not synced info (now informational, not blocking) */}
              {!isCustomerSynced && !isAlreadyPushed && (
                <Alert className="bg-blue-50 border-blue-200">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    This customer will be created in QuickBooks automatically when you push this order.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Push to QBO prompt */}
              {!isAlreadyPushed && (
                <div className="text-center space-y-2">
                  <p className="text-slate-700 font-medium">Push this order to QuickBooks?</p>
                  <p className="text-sm text-slate-500">
                    {!isCustomerSynced 
                      ? 'This will first create the customer, then create an invoice in QuickBooks Online.'
                      : 'This will create an invoice in QuickBooks Online for this sales order.'
                    }
                  </p>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex flex-col gap-3">
                {!isAlreadyPushed && (
                  <Button 
                    onClick={handlePushToQBO}
                    disabled={isPushing}
                    className="w-full bg-[#2ca01c] hover:bg-[#248a17] text-white"
                    size="lg"
                  >
                    {getPushButtonText()}
                  </Button>
                )}
                
                <Button 
                  variant={isAlreadyPushed ? "default" : "outline"}
                  onClick={handleSkip}
                  disabled={isPushing}
                  className="w-full"
                  size="lg"
                >
                  {isAlreadyPushed ? (
                    <>Done</>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Skip for Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

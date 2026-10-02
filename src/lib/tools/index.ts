import { commerceEngine } from '../commerce';
import { db } from '../db';

export interface ToolCallRequest {
  tool_id: string;
  parameters: Record<string, any>;
  workspace_id: string;
  agent_id: string;
  conversation_id: string;
}

export interface ToolCallResult {
  tool_id: string;
  status: 'SUCCESS' | 'FAILED' | 'CONFIRMATION_REQUIRED' | 'APPROVAL_REQUIRED' | 'PERMISSION_DENIED';
  message: string;
  data?: any;
  interactive_payload?: {
    type: 'PRODUCTS' | 'ORDER_TRACKING' | 'CONFIRMATION' | 'QUICK_REPLIES' | 'CART_SUMMARY';
    data: any;
  };
  latency_ms: number;
}

export async function executeTool(request: ToolCallRequest): Promise<ToolCallResult> {
  const startTime = Date.now();
  const { tool_id, parameters, workspace_id, agent_id } = request;

  const permission = db.tool_permissions.find(
    p => p.agent_id === agent_id && p.tool_id === tool_id
  );

  if (permission && !permission.is_enabled) {
    return {
      tool_id,
      status: 'PERMISSION_DENIED',
      message: 'Tool ' + tool_id + ' is disabled by merchant configuration.',
      latency_ms: Date.now() - startTime
    };
  }

  try {
    switch (tool_id) {
      case 'product_search': {
        const products = await commerceEngine.searchProducts(workspace_id, {
          query: parameters.query,
          category: parameters.category,
          minPrice: parameters.max_price ? undefined : parameters.min_price,
          maxPrice: parameters.max_price,
          size: parameters.size,
          color: parameters.color,
          inStockOnly: parameters.in_stock_only !== false
        });

        return {
          tool_id,
          status: 'SUCCESS',
          message: 'Found ' + products.length + ' matching products.',
          data: products,
          interactive_payload: products.length > 0 ? {
            type: 'PRODUCTS',
            data: products.slice(0, 4)
          } : undefined,
          latency_ms: Date.now() - startTime
        };
      }

      case 'product_details': {
        const product = await commerceEngine.getProduct(workspace_id, parameters.product_id);
        if (!product) {
          return {
            tool_id,
            status: 'FAILED',
            message: 'Product ID not found.',
            latency_ms: Date.now() - startTime
          };
        }
        return {
          tool_id,
          status: 'SUCCESS',
          message: 'Retrieved details for ' + product.title,
          data: product,
          interactive_payload: { type: 'PRODUCTS', data: [product] },
          latency_ms: Date.now() - startTime
        };
      }

      case 'inventory_lookup': {
        const inventory = await commerceEngine.getInventory(
          workspace_id,
          parameters.product_id,
          parameters.variant_id
        );
        return {
          tool_id,
          status: 'SUCCESS',
          message: inventory.in_stock
            ? 'In stock with ' + inventory.available_quantity + ' units available.'
            : 'Currently out of stock.',
          data: inventory,
          latency_ms: Date.now() - startTime
        };
      }

      case 'order_lookup': {
        if (!parameters.order_number || !parameters.customer_email) {
          return {
            tool_id,
            status: 'FAILED',
            message: 'Both order number and verified customer email are required to look up order details.',
            latency_ms: Date.now() - startTime
          };
        }
        const order = await commerceEngine.getOrder(workspace_id, parameters.order_number, parameters.customer_email);
        if (!order) {
          return {
            tool_id,
            status: 'FAILED',
            message: 'Order ' + parameters.order_number + ' was not found or the provided email does not match.',
            latency_ms: Date.now() - startTime
          };
        }
        const sanitizedOrder = {
          order_number: order.order_number,
          status: order.status,
          total_amount: order.total_amount,
          currency: order.currency,
          carrier: order.carrier,
          tracking_number: order.tracking_number,
          shipping_destination: commerceEngine.maskAddress(order.shipping_address),
          items: order.items.map(i => ({ title: i.title, quantity: i.quantity, price: i.price }))
        };
        return {
          tool_id,
          status: 'SUCCESS',
          message: 'Order ' + order.order_number + ' is ' + order.status,
          data: sanitizedOrder,
          interactive_payload: {
            type: 'ORDER_TRACKING',
            data: sanitizedOrder
          },
          latency_ms: Date.now() - startTime
        };
      }

      case 'order_tracking': {
        if (!parameters.order_number || !parameters.customer_email) {
          return {
            tool_id,
            status: 'FAILED',
            message: 'Both order number and verified customer email are required to track order status.',
            latency_ms: Date.now() - startTime
          };
        }
        const tracking = await commerceEngine.getShippingStatus(workspace_id, parameters.order_number, parameters.customer_email);
        if (!tracking) {
          return {
            tool_id,
            status: 'FAILED',
            message: 'Tracking info not found for order ' + parameters.order_number + ' or email does not match.',
            latency_ms: Date.now() - startTime
          };
        }
        return {
          tool_id,
          status: 'SUCCESS',
          message: 'Order ' + tracking.order_number + ' is ' + tracking.status,
          data: tracking,
          latency_ms: Date.now() - startTime
        };
      }


      case 'cart_lookup': {
        const cart = await commerceEngine.getCart(workspace_id, parameters.cart_id || 'default_cart');
        return {
          tool_id,
          status: 'SUCCESS',
          message: 'Cart has ' + cart.items.length + ' item(s). Total: $' + cart.total.toFixed(2),
          data: cart,
          interactive_payload: { type: 'CART_SUMMARY', data: cart },
          latency_ms: Date.now() - startTime
        };
      }

      case 'add_to_cart': {
        const cart = await commerceEngine.addToCart(workspace_id, parameters.cart_id || 'default_cart', {
          productId: parameters.product_id,
          variantId: parameters.variant_id,
          quantity: parameters.quantity || 1
        });
        return {
          tool_id,
          status: 'SUCCESS',
          message: 'Item added to cart. Total: $' + cart.total.toFixed(2),
          data: cart,
          interactive_payload: { type: 'CART_SUMMARY', data: cart },
          latency_ms: Date.now() - startTime
        };
      }

      case 'coupon_validation': {
        const result = await commerceEngine.validateCoupon(
          workspace_id,
          parameters.coupon_code,
          parameters.cart_subtotal || 100
        );
        return {
          tool_id,
          status: result.valid ? 'SUCCESS' : 'FAILED',
          message: result.description,
          data: result,
          latency_ms: Date.now() - startTime
        };
      }

      case 'return_eligibility': {
        const result = await commerceEngine.checkReturnEligibility(
          workspace_id,
          parameters.order_number,
          parameters.product_id
        );
        return {
          tool_id,
          status: 'SUCCESS',
          message: result.reason,
          data: result,
          latency_ms: Date.now() - startTime
        };
      }

      case 'create_razorpay_order': {
        const { amount, currency = 'INR', product_id, variant_id, quantity = 1 } = parameters;
        let finalAmount = amount;
        let product: any = null;

        if (product_id) {
          product = await commerceEngine.getProduct(workspace_id, product_id);
          if (product && !finalAmount) {
            const variant = product.variants?.find((v: any) => v.id === variant_id) || product.variants?.[0];
            finalAmount = (variant?.price || product.price) * Math.max(1, Number(quantity) || 1);
          }
        }

        const { razorpayService } = await import('../payments/razorpay');
        const order = await razorpayService.createOrder({
          amount: finalAmount || 999,
          currency,
          notes: {
            workspace_id,
            product_id: product_id || '',
            variant_id: variant_id || '',
            quantity: String(quantity)
          }
        });

        return {
          tool_id,
          status: 'SUCCESS',
          message: `Razorpay Order ${order.id} generated for ₹${(finalAmount || 999).toLocaleString('en-IN')}`,
          data: order,
          interactive_payload: {
            type: 'CONFIRMATION',
            data: {
              paymentGateway: 'RAZORPAY',
              order_id: order.id,
              amount: finalAmount,
              currency,
              product
            }
          },
          latency_ms: Date.now() - startTime
        };
      }

      case 'generate_payment_link': {
        const { amount, description = 'Order Payment', customer_name, customer_email, product_id } = parameters;
        const { razorpayService } = await import('../payments/razorpay');
        const link = await razorpayService.createPaymentLink({
          amount: amount || 999,
          description,
          customer: {
            name: customer_name || 'Customer',
            email: customer_email || 'customer@example.com'
          },
          notes: {
            workspace_id,
            product_id: product_id || ''
          }
        });

        return {
          tool_id,
          status: 'SUCCESS',
          message: `Razorpay Payment Link generated: ${link.short_url}`,
          data: link,
          interactive_payload: {
            type: 'CONFIRMATION',
            data: {
              paymentGateway: 'RAZORPAY',
              payment_link: link.short_url,
              amount: link.amount,
              currency: link.currency,
              id: link.id
            }
          },
          latency_ms: Date.now() - startTime
        };
      }

      case 'verify_razorpay_payment': {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parameters;
        const { razorpayService } = await import('../payments/razorpay');
        const isValid = razorpayService.verifySignature({
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature: razorpay_signature || 'mock_valid_signature'
        });

        return {
          tool_id,
          status: isValid ? 'SUCCESS' : 'FAILED',
          message: isValid ? 'Razorpay payment verified successfully.' : 'Payment verification failed.',
          data: { verified: isValid, payment_id: razorpay_payment_id },
          latency_ms: Date.now() - startTime
        };
      }

      case 'human_handoff': {
        const conv = db.conversations.find(c => c.id === request.conversation_id);
        if (conv) {
          conv.status = 'ESCALATED';
          conv.escalation_reason = parameters.reason || 'Customer requested live support agent';
          conv.updated_at = new Date().toISOString();
          db.scheduleSave();
        }
        return {
          tool_id,
          status: 'SUCCESS',
          message: 'Conversation escalated to human customer support team.',
          data: { escalated: true, reason: parameters.reason },
          latency_ms: Date.now() - startTime
        };
      }

      default:
        return {
          tool_id,
          status: 'FAILED',
          message: 'Unknown tool ' + tool_id,
          latency_ms: Date.now() - startTime
        };
    }
  } catch (err: any) {
    return {
      tool_id,
      status: 'FAILED',
      message: err.message || 'Execution error encountered in tool.',
      latency_ms: Date.now() - startTime
    };
  }
}

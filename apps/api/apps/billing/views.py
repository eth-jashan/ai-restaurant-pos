from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from decimal import Decimal
from .models import Invoice, Payment
from apps.orders.models import Order
from .serializers import (
    InvoiceSerializer,
    PaymentSerializer,
    GenerateInvoiceSerializer,
    RecordPaymentSerializer,
)


class InvoiceViewSet(viewsets.ModelViewSet):
    """Invoice management."""
    serializer_class = InvoiceSerializer
    queryset = Invoice.objects.all()
    filterset_fields = ['status']
    search_fields = ['invoice_number', 'customer_name', 'customer_phone']

    def get_queryset(self):
        return Invoice.objects.filter(
            restaurant=self.request.user.restaurant
        ).select_related('order').prefetch_related('payments')

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate invoice from order."""
        serializer = GenerateInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        restaurant = request.user.restaurant

        try:
            order = Order.objects.get(
                id=data['order_id'],
                restaurant=restaurant
            )
        except Order.DoesNotExist:
            return Response(
                {'error': 'Order not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if invoice already exists
        if hasattr(order, 'invoice'):
            return Response(
                {'error': 'Invoice already exists for this order'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate invoice number
        today = timezone.now().strftime('%Y%m%d')
        count = Invoice.objects.filter(
            restaurant=restaurant,
            generated_at__date=timezone.now().date()
        ).count() + 1
        invoice_number = f"INV-{today}-{count:04d}"

        # Calculate amounts
        subtotal = order.subtotal
        discount = Decimal(str(data.get('discount_amount', 0)))
        service_charge_pct = Decimal(str(data.get('service_charge_percent', 0)))

        taxable = subtotal - discount
        service_charge = (taxable * service_charge_pct / 100).quantize(Decimal('0.01'))
        taxable_with_service = taxable + service_charge

        # GST calculation (split into CGST and SGST for same state)
        tax_rate = restaurant.tax_rate / 2  # Split between CGST and SGST
        cgst = (taxable_with_service * tax_rate / 100).quantize(Decimal('0.01'))
        sgst = cgst

        total = taxable_with_service + cgst + sgst
        round_off = (round(total) - total).quantize(Decimal('0.01'))
        total = round(total)

        invoice = Invoice.objects.create(
            restaurant=restaurant,
            order=order,
            invoice_number=invoice_number,
            subtotal=subtotal,
            discount_amount=discount,
            discount_reason=data.get('discount_reason', ''),
            cgst_amount=cgst,
            sgst_amount=sgst,
            service_charge=service_charge,
            round_off=round_off,
            total_amount=total,
            customer_name=data.get('customer_name', order.customer_name),
            customer_phone=data.get('customer_phone', order.customer_phone),
            customer_gstin=data.get('customer_gstin', ''),
            generated_by=request.user,
            status='PENDING'
        )

        return Response({
            'success': True,
            'data': InvoiceSerializer(invoice).data
        }, status=status.HTTP_201_CREATED)


class PaymentViewSet(viewsets.ModelViewSet):
    """Payment management."""
    serializer_class = PaymentSerializer
    queryset = Payment.objects.all()

    def get_queryset(self):
        return Payment.objects.filter(
            restaurant=self.request.user.restaurant
        ).select_related('invoice')

    @action(detail=False, methods=['post'])
    def record(self, request):
        """Record a payment."""
        serializer = RecordPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            invoice = Invoice.objects.get(
                id=data['invoice_id'],
                restaurant=request.user.restaurant
            )
        except Invoice.DoesNotExist:
            return Response(
                {'error': 'Invoice not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        payment = Payment.objects.create(
            restaurant=request.user.restaurant,
            invoice=invoice,
            amount=data['amount'],
            method=data['method'],
            transaction_id=data.get('transaction_id', ''),
            reference_number=data.get('reference_number', ''),
            received_by=request.user,
            status='COMPLETED'
        )

        # Update invoice paid amount
        invoice.paid_amount += data['amount']
        if invoice.paid_amount >= invoice.total_amount:
            invoice.status = 'PAID'
            invoice.paid_at = timezone.now()
        else:
            invoice.status = 'PARTIALLY_PAID'
        invoice.save()

        return Response({
            'success': True,
            'data': PaymentSerializer(payment).data
        }, status=status.HTTP_201_CREATED)

from rest_framework import serializers
from .models import Invoice, Payment
from apps.orders.serializers import OrderSerializer


class PaymentSerializer(serializers.ModelSerializer):
    """Payment serializer."""

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'amount', 'method', 'status',
            'transaction_id', 'reference_number', 'received_by', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    """Invoice serializer."""
    payments = PaymentSerializer(many=True, read_only=True)
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'order', 'invoice_number', 'status', 'subtotal',
            'discount_amount', 'discount_reason', 'cgst_amount', 'sgst_amount',
            'service_charge', 'round_off', 'total_amount', 'paid_amount',
            'balance_due', 'customer_name', 'customer_phone', 'customer_gstin',
            'notes', 'payments', 'generated_at', 'paid_at'
        ]
        read_only_fields = ['id', 'invoice_number', 'generated_at']

    def get_balance_due(self, obj):
        return float(obj.total_amount - obj.paid_amount)


class GenerateInvoiceSerializer(serializers.Serializer):
    """Serializer for generating invoice from order."""
    order_id = serializers.UUIDField()
    discount_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    discount_reason = serializers.CharField(max_length=255, required=False, default='')
    service_charge_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=0
    )
    customer_name = serializers.CharField(max_length=255, required=False, default='')
    customer_phone = serializers.CharField(max_length=20, required=False, default='')
    customer_gstin = serializers.CharField(max_length=15, required=False, default='')


class RecordPaymentSerializer(serializers.Serializer):
    """Serializer for recording payment."""
    invoice_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    transaction_id = serializers.CharField(max_length=100, required=False, default='')
    reference_number = serializers.CharField(max_length=100, required=False, default='')

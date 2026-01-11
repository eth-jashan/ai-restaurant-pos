from rest_framework import serializers
from .models import Order, OrderItem, KOT, KOTItem
from apps.core.serializers import RestaurantTableSerializer, UserSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    """Order item serializer."""

    class Meta:
        model = OrderItem
        fields = [
            'id', 'menu_item', 'name', 'quantity', 'unit_price',
            'total_price', 'modifiers', 'notes', 'status', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class OrderSerializer(serializers.ModelSerializer):
    """Order serializer."""
    items = OrderItemSerializer(many=True, read_only=True)
    table_info = RestaurantTableSerializer(source='table', read_only=True)
    waiter_info = UserSerializer(source='waiter', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'order_type', 'status', 'table', 'table_info',
            'waiter', 'waiter_info', 'customer_name', 'customer_phone',
            'customer_address', 'covers', 'subtotal', 'tax_amount',
            'discount_amount', 'total_amount', 'notes', 'items',
            'placed_at', 'completed_at', 'created_at'
        ]
        read_only_fields = ['id', 'order_number', 'placed_at', 'completed_at', 'created_at']


class OrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating orders."""
    items = serializers.ListField(child=serializers.DictField(), write_only=True)

    class Meta:
        model = Order
        fields = [
            'order_type', 'table', 'customer_name', 'customer_phone',
            'customer_address', 'covers', 'notes', 'items'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        restaurant = self.context['request'].user.restaurant

        # Generate order number
        from django.utils import timezone
        today = timezone.now().strftime('%Y%m%d')
        count = Order.objects.filter(
            restaurant=restaurant,
            created_at__date=timezone.now().date()
        ).count() + 1
        order_number = f"{today}-{count:04d}"

        order = Order.objects.create(
            restaurant=restaurant,
            order_number=order_number,
            waiter=self.context['request'].user,
            **validated_data
        )

        # Create order items
        subtotal = 0
        tax_amount = 0

        for item_data in items_data:
            from apps.menu.models import MenuItem
            menu_item = MenuItem.objects.get(id=item_data['menu_item_id'])

            modifiers_price = sum(m.get('price', 0) for m in item_data.get('modifiers', []))
            unit_price = menu_item.base_price + modifiers_price
            total_price = unit_price * item_data['quantity']

            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                name=menu_item.name,
                quantity=item_data['quantity'],
                unit_price=unit_price,
                total_price=total_price,
                modifiers=item_data.get('modifiers', []),
                notes=item_data.get('notes', '')
            )

            subtotal += total_price
            tax_amount += total_price * (menu_item.tax_rate / 100)

        order.subtotal = subtotal
        order.tax_amount = tax_amount
        order.total_amount = subtotal + tax_amount
        order.save()

        return order


class KOTItemSerializer(serializers.ModelSerializer):
    """KOT item serializer."""
    item_name = serializers.CharField(source='order_item.name', read_only=True)

    class Meta:
        model = KOTItem
        fields = ['id', 'order_item', 'item_name', 'quantity', 'notes']


class KOTSerializer(serializers.ModelSerializer):
    """KOT serializer."""
    items = KOTItemSerializer(many=True, read_only=True)

    class Meta:
        model = KOT
        fields = [
            'id', 'order', 'kot_number', 'status', 'items',
            'printed_at', 'acknowledged_at', 'completed_at', 'created_at'
        ]
        read_only_fields = ['id', 'kot_number', 'created_at']

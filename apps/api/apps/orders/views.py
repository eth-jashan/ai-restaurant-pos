from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Order, OrderItem, KOT, KOTItem
from .serializers import (
    OrderSerializer,
    OrderCreateSerializer,
    OrderItemSerializer,
    KOTSerializer,
)


class OrderViewSet(viewsets.ModelViewSet):
    """Order management."""
    queryset = Order.objects.all()
    filterset_fields = ['status', 'order_type', 'table']
    search_fields = ['order_number', 'customer_name', 'customer_phone']
    ordering_fields = ['created_at', 'total_amount']

    def get_queryset(self):
        return Order.objects.filter(
            restaurant=self.request.user.restaurant
        ).select_related('table', 'waiter').prefetch_related('items')

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        return OrderSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active orders."""
        active_statuses = ['DRAFT', 'PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED']
        orders = self.get_queryset().filter(status__in=active_statuses)
        serializer = OrderSerializer(orders, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update order status."""
        order = self.get_object()
        new_status = request.data.get('status')

        if new_status not in dict(Order.Status.choices):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = new_status

        if new_status == 'PLACED':
            order.placed_at = timezone.now()
        elif new_status in ['COMPLETED', 'CANCELLED']:
            order.completed_at = timezone.now()

        order.save()
        return Response({
            'success': True,
            'data': OrderSerializer(order).data
        })

    @action(detail=True, methods=['post'])
    def add_items(self, request, pk=None):
        """Add items to an existing order."""
        order = self.get_object()
        items_data = request.data.get('items', [])

        if order.status in ['COMPLETED', 'CANCELLED']:
            return Response(
                {'error': 'Cannot add items to completed or cancelled order'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.menu.models import MenuItem

        added_items = []
        for item_data in items_data:
            menu_item = MenuItem.objects.get(id=item_data['menu_item_id'])

            modifiers_price = sum(m.get('price', 0) for m in item_data.get('modifiers', []))
            unit_price = menu_item.base_price + modifiers_price
            total_price = unit_price * item_data['quantity']

            order_item = OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                name=menu_item.name,
                quantity=item_data['quantity'],
                unit_price=unit_price,
                total_price=total_price,
                modifiers=item_data.get('modifiers', []),
                notes=item_data.get('notes', '')
            )
            added_items.append(order_item)

            order.subtotal += total_price
            order.tax_amount += total_price * (menu_item.tax_rate / 100)

        order.total_amount = order.subtotal + order.tax_amount - order.discount_amount
        order.save()

        return Response({
            'success': True,
            'data': OrderSerializer(order).data
        })


class KOTViewSet(viewsets.ModelViewSet):
    """KOT management."""
    serializer_class = KOTSerializer
    queryset = KOT.objects.all()

    def get_queryset(self):
        return KOT.objects.filter(
            restaurant=self.request.user.restaurant
        ).select_related('order').prefetch_related('items')

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge KOT in kitchen."""
        kot = self.get_object()
        kot.status = 'ACKNOWLEDGED'
        kot.acknowledged_at = timezone.now()
        kot.save()
        return Response({
            'success': True,
            'data': KOTSerializer(kot).data
        })

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark KOT as complete."""
        kot = self.get_object()
        kot.status = 'COMPLETED'
        kot.completed_at = timezone.now()
        kot.save()
        return Response({
            'success': True,
            'data': KOTSerializer(kot).data
        })

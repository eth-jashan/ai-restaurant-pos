from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from decimal import Decimal
from .models import Category, MenuItem, ModifierGroup, Modifier
from .serializers import (
    CategorySerializer,
    CategoryWithItemsSerializer,
    MenuItemSerializer,
    MenuItemCreateSerializer,
    ModifierGroupSerializer,
    ModifierSerializer,
    BulkPriceUpdateSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    """Category management."""
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['display_order', 'name', 'created_at']

    def get_queryset(self):
        return Category.objects.filter(restaurant=self.request.user.restaurant)

    def get_serializer_class(self):
        if self.action == 'retrieve' or self.request.query_params.get('include_items'):
            return CategoryWithItemsSerializer
        return CategorySerializer

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class MenuItemViewSet(viewsets.ModelViewSet):
    """Menu item management."""
    queryset = MenuItem.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'food_type', 'is_available', 'is_active']
    search_fields = ['name', 'description', 'short_code']
    ordering_fields = ['display_order', 'name', 'base_price', 'created_at']

    def get_queryset(self):
        return MenuItem.objects.filter(
            restaurant=self.request.user.restaurant
        ).select_related('category')

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MenuItemCreateSerializer
        return MenuItemSerializer

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)

    @action(detail=True, methods=['post'])
    def toggle_availability(self, request, pk=None):
        """Toggle item availability."""
        item = self.get_object()
        item.is_available = not item.is_available
        item.save()
        return Response({
            'success': True,
            'data': MenuItemSerializer(item).data
        })

    @action(detail=False, methods=['post'])
    def bulk_update_prices(self, request):
        """Bulk update prices for items."""
        serializer = BulkPriceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        restaurant = request.user.restaurant

        # Get items to update
        queryset = MenuItem.objects.filter(restaurant=restaurant)

        if data.get('category_id'):
            queryset = queryset.filter(category_id=data['category_id'])
        elif data.get('item_ids'):
            queryset = queryset.filter(id__in=data['item_ids'])

        # Calculate new prices
        updates = []
        for item in queryset:
            old_price = item.base_price
            value = Decimal(str(data['value']))

            if data['adjustment_type'] == 'SET':
                new_price = value
            elif data['adjustment_type'] == 'INCREMENT':
                if data.get('is_percentage'):
                    new_price = old_price * (1 + value / 100)
                else:
                    new_price = old_price + value
            else:  # DECREMENT
                if data.get('is_percentage'):
                    new_price = old_price * (1 - value / 100)
                else:
                    new_price = old_price - value

            new_price = max(Decimal('0'), new_price.quantize(Decimal('0.01')))
            updates.append({
                'item_id': str(item.id),
                'item_name': item.name,
                'old_price': float(old_price),
                'new_price': float(new_price)
            })
            item.base_price = new_price

        # Bulk update
        MenuItem.objects.bulk_update(queryset, ['base_price'])

        return Response({
            'success': True,
            'data': {
                'updated_count': len(updates),
                'changes': updates
            }
        })

    @action(detail=False, methods=['post'])
    def bulk_toggle_availability(self, request):
        """Bulk toggle availability for items."""
        item_names = request.data.get('item_names', [])
        available = request.data.get('available', False)

        if not item_names:
            return Response(
                {'error': 'item_names is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find items by name (case-insensitive)
        from django.db.models import Q
        query = Q()
        for name in item_names:
            query |= Q(name__icontains=name)

        items = MenuItem.objects.filter(
            restaurant=self.request.user.restaurant
        ).filter(query)

        updated = items.update(is_available=available)

        return Response({
            'success': True,
            'data': {
                'updated_count': updated,
                'items': list(items.values('id', 'name', 'is_available'))
            }
        })


class ModifierGroupViewSet(viewsets.ModelViewSet):
    """Modifier group management."""
    serializer_class = ModifierGroupSerializer
    queryset = ModifierGroup.objects.all()

    def get_queryset(self):
        return ModifierGroup.objects.filter(restaurant=self.request.user.restaurant)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class ModifierViewSet(viewsets.ModelViewSet):
    """Modifier management."""
    serializer_class = ModifierSerializer
    queryset = Modifier.objects.all()

    def get_queryset(self):
        return Modifier.objects.filter(
            group__restaurant=self.request.user.restaurant
        )

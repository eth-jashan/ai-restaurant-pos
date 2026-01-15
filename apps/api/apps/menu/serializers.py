from rest_framework import serializers
from .models import Category, MenuItem, ModifierGroup, Modifier


class ModifierSerializer(serializers.ModelSerializer):
    """Modifier serializer."""

    class Meta:
        model = Modifier
        fields = ['id', 'name', 'price', 'is_available']


class ModifierGroupSerializer(serializers.ModelSerializer):
    """Modifier group serializer."""
    modifiers = ModifierSerializer(many=True, read_only=True)

    class Meta:
        model = ModifierGroup
        fields = [
            'id', 'name', 'is_required', 'min_selections',
            'max_selections', 'modifiers'
        ]


class MenuItemSerializer(serializers.ModelSerializer):
    """Menu item serializer."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    modifier_groups = ModifierGroupSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'category', 'category_name', 'name', 'description',
            'short_code', 'base_price', 'tax_rate', 'food_type',
            'is_available', 'is_active', 'display_order', 'preparation_time',
            'image_url', 'tags', 'modifier_groups', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MenuItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating menu items."""

    class Meta:
        model = MenuItem
        fields = [
            'category', 'name', 'description', 'short_code', 'base_price',
            'tax_rate', 'food_type', 'is_available', 'is_active',
            'display_order', 'preparation_time', 'image_url', 'tags'
        ]


class CategorySerializer(serializers.ModelSerializer):
    """Category serializer."""
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'description', 'display_order',
            'is_active', 'items_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_items_count(self, obj):
        return obj.items.filter(is_active=True).count()


class CategoryWithItemsSerializer(CategorySerializer):
    """Category serializer with items included."""
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ['items']


class BulkPriceUpdateSerializer(serializers.Serializer):
    """Serializer for bulk price updates."""
    category_id = serializers.UUIDField(required=False)
    item_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False
    )
    adjustment_type = serializers.ChoiceField(
        choices=['INCREMENT', 'DECREMENT', 'SET']
    )
    value = serializers.DecimalField(max_digits=10, decimal_places=2)
    is_percentage = serializers.BooleanField(default=False)

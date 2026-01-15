import uuid
from django.db import models
from apps.core.models import Restaurant


class Category(models.Model):
    """Menu category."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='categories'
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'categories'
        unique_together = [['restaurant', 'name']]
        ordering = ['display_order', 'name']
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    """Menu item."""

    class FoodType(models.TextChoices):
        VEG = 'VEG', 'Vegetarian'
        NON_VEG = 'NON_VEG', 'Non-Vegetarian'
        EGG = 'EGG', 'Egg'
        VEGAN = 'VEGAN', 'Vegan'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='menu_items'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='items'
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    short_code = models.CharField(max_length=20, blank=True)

    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)

    food_type = models.CharField(
        max_length=10,
        choices=FoodType.choices,
        default=FoodType.VEG
    )

    is_available = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    preparation_time = models.PositiveIntegerField(default=15, help_text='In minutes')
    image_url = models.URLField(blank=True, null=True)
    tags = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'menu_items'
        indexes = [
            models.Index(fields=['restaurant', 'is_available']),
            models.Index(fields=['restaurant', 'category']),
            models.Index(fields=['name']),
        ]
        ordering = ['display_order', 'name']

    def __str__(self):
        return f"{self.name} - ₹{self.base_price}"


class ModifierGroup(models.Model):
    """Modifier group for menu items (e.g., Size, Spice Level)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='modifier_groups'
    )

    name = models.CharField(max_length=100)
    is_required = models.BooleanField(default=False)
    min_selections = models.PositiveIntegerField(default=0)
    max_selections = models.PositiveIntegerField(default=1)

    # Many-to-many with menu items
    menu_items = models.ManyToManyField(
        MenuItem,
        related_name='modifier_groups',
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'modifier_groups'

    def __str__(self):
        return self.name


class Modifier(models.Model):
    """Individual modifier option."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        ModifierGroup,
        on_delete=models.CASCADE,
        related_name='modifiers'
    )

    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'modifiers'

    def __str__(self):
        return f"{self.name} (+₹{self.price})"

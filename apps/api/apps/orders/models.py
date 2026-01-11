import uuid
from django.db import models
from apps.core.models import Restaurant, User, RestaurantTable
from apps.menu.models import MenuItem


class Order(models.Model):
    """Order model."""

    class OrderType(models.TextChoices):
        DINE_IN = 'DINE_IN', 'Dine In'
        TAKEAWAY = 'TAKEAWAY', 'Takeaway'
        DELIVERY = 'DELIVERY', 'Delivery'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PLACED = 'PLACED', 'Placed'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        PREPARING = 'PREPARING', 'Preparing'
        READY = 'READY', 'Ready'
        SERVED = 'SERVED', 'Served'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='orders'
    )

    order_number = models.CharField(max_length=20)
    order_type = models.CharField(
        max_length=20,
        choices=OrderType.choices,
        default=OrderType.DINE_IN
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Table and staff
    table = models.ForeignKey(
        RestaurantTable,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )
    waiter = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='orders_as_waiter'
    )

    # Customer info (for takeaway/delivery)
    customer_name = models.CharField(max_length=255, blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)
    customer_address = models.TextField(blank=True)
    covers = models.PositiveIntegerField(default=1)

    # Amounts
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    notes = models.TextField(blank=True)

    placed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders'
        indexes = [
            models.Index(fields=['restaurant', 'status']),
            models.Index(fields=['restaurant', 'created_at']),
            models.Index(fields=['restaurant', 'order_number']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Order #{self.order_number}"


class OrderItem(models.Model):
    """Individual item in an order."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SENT_TO_KITCHEN = 'SENT_TO_KITCHEN', 'Sent to Kitchen'
        PREPARING = 'PREPARING', 'Preparing'
        READY = 'READY', 'Ready'
        SERVED = 'SERVED', 'Served'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items'
    )
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.SET_NULL,
        null=True
    )

    # Snapshot of item details at order time
    name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    modifiers = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'order_items'

    def __str__(self):
        return f"{self.quantity}x {self.name}"


class KOT(models.Model):
    """Kitchen Order Ticket."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACKNOWLEDGED = 'ACKNOWLEDGED', 'Acknowledged'
        PREPARING = 'PREPARING', 'Preparing'
        READY = 'READY', 'Ready'
        COMPLETED = 'COMPLETED', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='kots'
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='kots'
    )

    kot_number = models.CharField(max_length=20)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    printed_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kots'
        ordering = ['-created_at']

    def __str__(self):
        return f"KOT #{self.kot_number}"


class KOTItem(models.Model):
    """Item in a KOT."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kot = models.ForeignKey(
        KOT,
        on_delete=models.CASCADE,
        related_name='items'
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name='kot_items'
    )

    quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'kot_items'

    def __str__(self):
        return f"{self.quantity}x {self.order_item.name}"

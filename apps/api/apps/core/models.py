import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class Restaurant(models.Model):
    """Restaurant model for multi-tenant support."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True, db_index=True)

    # Address
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)

    # Contact
    phone = models.CharField(max_length=20)
    email = models.EmailField()

    # Business details (India-specific)
    gstin = models.CharField(max_length=15, blank=True, null=True)
    fssai_number = models.CharField(max_length=14, blank=True, null=True)

    # Settings
    currency = models.CharField(max_length=3, default='INR')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurants'
        ordering = ['name']

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    """Custom user manager."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'OWNER')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with restaurant association."""

    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Owner'
        MANAGER = 'MANAGER', 'Manager'
        CAPTAIN = 'CAPTAIN', 'Captain'
        WAITER = 'WAITER', 'Waiter'
        CASHIER = 'CASHIER', 'Cashier'
        KITCHEN = 'KITCHEN', 'Kitchen'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='users',
        null=True,
        blank=True
    )

    email = models.EmailField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)

    # Role and PIN for quick POS login
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.WAITER)
    pin = models.CharField(max_length=6, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'
        unique_together = [['restaurant', 'pin']]
        indexes = [
            models.Index(fields=['restaurant', 'pin']),
            models.Index(fields=['restaurant', 'role']),
        ]

    def __str__(self):
        return f"{self.name} ({self.email})"


class RestaurantTable(models.Model):
    """Table/seating in a restaurant."""

    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Available'
        OCCUPIED = 'OCCUPIED', 'Occupied'
        RESERVED = 'RESERVED', 'Reserved'
        BLOCKED = 'BLOCKED', 'Blocked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='tables'
    )

    name = models.CharField(max_length=50)
    capacity = models.PositiveIntegerField(default=4)
    section = models.CharField(max_length=50, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE
    )

    position_x = models.IntegerField(default=0)
    position_y = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurant_tables'
        unique_together = [['restaurant', 'name']]
        ordering = ['section', 'name']

    def __str__(self):
        return f"{self.name} ({self.section})"

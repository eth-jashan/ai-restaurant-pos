from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Restaurant, User, RestaurantTable


class RestaurantSerializer(serializers.ModelSerializer):
    """Restaurant serializer."""

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'address', 'city', 'state', 'pincode',
            'phone', 'email', 'gstin', 'fssai_number', 'currency', 'tax_rate',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    """User serializer."""
    restaurant = RestaurantSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'phone', 'role', 'is_active',
            'last_login_at', 'restaurant', 'created_at'
        ]
        read_only_fields = ['id', 'last_login_at', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users."""
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['email', 'name', 'phone', 'role', 'pin', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """Login with email/password."""
    email = serializers.EmailField()
    password = serializers.CharField()
    restaurantSlug = serializers.SlugField(required=False, allow_blank=True)
    restaurant_slug = serializers.SlugField(required=False, allow_blank=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        # Accept both camelCase and snake_case
        restaurant_slug = attrs.get('restaurantSlug') or attrs.get('restaurant_slug')

        if not restaurant_slug:
            raise serializers.ValidationError({'restaurantSlug': 'This field is required.'})

        # Find restaurant
        try:
            restaurant = Restaurant.objects.get(slug=restaurant_slug, is_active=True)
        except Restaurant.DoesNotExist:
            raise serializers.ValidationError('Restaurant not found or inactive')

        # Find user
        try:
            user = User.objects.get(restaurant=restaurant, email=email, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid email or password')

        # Check password
        if not user.check_password(password):
            raise serializers.ValidationError('Invalid email or password')

        # Update last login
        from django.utils import timezone
        user.last_login_at = timezone.now()
        user.save(update_fields=['last_login_at'])

        attrs['user'] = user
        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        refresh = RefreshToken.for_user(user)

        # Add custom claims
        refresh['restaurant_id'] = str(user.restaurant.id)
        refresh['role'] = user.role

        return {
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'expires_in': 86400  # 24 hours
            }
        }


class PinLoginSerializer(serializers.Serializer):
    """Quick PIN login for POS."""
    pin = serializers.CharField(max_length=6)
    restaurant_id = serializers.UUIDField()

    def validate(self, attrs):
        pin = attrs.get('pin')
        restaurant_id = attrs.get('restaurant_id')

        try:
            user = User.objects.get(
                restaurant_id=restaurant_id,
                pin=pin,
                is_active=True
            )
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid PIN')

        # Update last login
        from django.utils import timezone
        user.last_login_at = timezone.now()
        user.save(update_fields=['last_login_at'])

        attrs['user'] = user
        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        refresh = RefreshToken.for_user(user)

        # Add custom claims
        refresh['restaurant_id'] = str(user.restaurant.id)
        refresh['role'] = user.role

        return {
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'expires_in': 86400
            }
        }


class RestaurantTableSerializer(serializers.ModelSerializer):
    """Restaurant table serializer."""

    class Meta:
        model = RestaurantTable
        fields = [
            'id', 'name', 'capacity', 'section', 'status',
            'position_x', 'position_y', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenRefreshView
from .models import Restaurant, User, RestaurantTable
from .serializers import (
    RestaurantSerializer,
    UserSerializer,
    UserCreateSerializer,
    LoginSerializer,
    PinLoginSerializer,
    RestaurantTableSerializer,
)


class LoginView(generics.CreateAPIView):
    """Login with email/password."""
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response({
            'success': True,
            'data': result
        })


class PinLoginView(generics.CreateAPIView):
    """Quick PIN login for POS."""
    permission_classes = [AllowAny]
    serializer_class = PinLoginSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response({
            'success': True,
            'data': result
        })


class CurrentUserView(generics.RetrieveAPIView):
    """Get current authenticated user."""
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class RestaurantViewSet(viewsets.ModelViewSet):
    """Restaurant management."""
    serializer_class = RestaurantSerializer
    queryset = Restaurant.objects.all()

    def get_queryset(self):
        # Users can only see their own restaurant
        if self.request.user.is_superuser:
            return Restaurant.objects.all()
        return Restaurant.objects.filter(id=self.request.user.restaurant_id)


class UserViewSet(viewsets.ModelViewSet):
    """User management within a restaurant."""
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        return User.objects.filter(restaurant=self.request.user.restaurant)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class RestaurantTableViewSet(viewsets.ModelViewSet):
    """Table management."""
    serializer_class = RestaurantTableSerializer
    queryset = RestaurantTable.objects.all()

    def get_queryset(self):
        return RestaurantTable.objects.filter(restaurant=self.request.user.restaurant)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update table status."""
        table = self.get_object()
        new_status = request.data.get('status')

        if new_status not in dict(RestaurantTable.Status.choices):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        table.status = new_status
        table.save()
        return Response({
            'success': True,
            'data': self.get_serializer(table).data
        })

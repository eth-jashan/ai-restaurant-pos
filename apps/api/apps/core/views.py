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
        queryset = RestaurantTable.objects.filter(restaurant=self.request.user.restaurant)

        # Filter by section if provided
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section=section)

        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by('section', 'name')

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)

    def list(self, request, *args, **kwargs):
        """Override list to wrap response in standard format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': {
                'tables': serializer.data,
                'count': len(serializer.data)
            }
        })

    @action(detail=False, methods=['get'], url_path='with-orders')
    def with_orders(self, request):
        """Get all tables with their active orders."""
        from apps.orders.models import Order

        tables = self.get_queryset()
        tables_data = []

        for table in tables:
            table_data = self.get_serializer(table).data
            # Get active orders for this table
            active_orders = Order.objects.filter(
                table=table,
                status__in=['PENDING', 'CONFIRMED', 'PREPARING', 'READY']
            ).order_by('-created_at')

            if active_orders.exists():
                from apps.orders.serializers import OrderSerializer
                table_data['orders'] = OrderSerializer(active_orders, many=True).data
            else:
                table_data['orders'] = []

            tables_data.append(table_data)

        return Response({
            'success': True,
            'data': {
                'tables': tables_data,
                'count': len(tables_data)
            }
        })

    @action(detail=False, methods=['get'], url_path='sections/list')
    def sections_list(self, request):
        """Get list of unique sections."""
        sections = (
            RestaurantTable.objects
            .filter(restaurant=self.request.user.restaurant)
            .exclude(section='')
            .values_list('section', flat=True)
            .distinct()
            .order_by('section')
        )
        return Response({
            'success': True,
            'data': {
                'sections': list(sections)
            }
        })

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_create(self, request):
        """Create multiple tables at once."""
        prefix = request.data.get('prefix', 'Table')
        count = request.data.get('count', 1)
        start_number = request.data.get('startNumber', 1)
        capacity = request.data.get('capacity', 4)
        section = request.data.get('section', '')

        created_tables = []
        for i in range(count):
            table_name = f"{prefix} {start_number + i}"
            table, created = RestaurantTable.objects.get_or_create(
                restaurant=self.request.user.restaurant,
                name=table_name,
                defaults={
                    'capacity': capacity,
                    'section': section,
                    'position_x': i % 5 * 100,
                    'position_y': i // 5 * 100,
                }
            )
            if created:
                created_tables.append(table)

        return Response({
            'success': True,
            'data': {
                'tables': self.get_serializer(created_tables, many=True).data,
                'created_count': len(created_tables)
            }
        }, status=status.HTTP_201_CREATED)

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

    @action(detail=True, methods=['get'])
    def orders(self, request, pk=None):
        """Get orders for a specific table."""
        from apps.orders.models import Order
        from apps.orders.serializers import OrderSerializer

        table = self.get_object()
        orders = Order.objects.filter(table=table).order_by('-created_at')

        return Response({
            'success': True,
            'data': {
                'orders': OrderSerializer(orders, many=True).data
            }
        })

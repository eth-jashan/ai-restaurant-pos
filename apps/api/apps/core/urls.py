from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    PinLoginView,
    CurrentUserView,
    RestaurantViewSet,
    UserViewSet,
    RestaurantTableViewSet,
)

router = DefaultRouter()
router.register(r'restaurants', RestaurantViewSet, basename='restaurant')
router.register(r'users', UserViewSet, basename='user')
router.register(r'tables', RestaurantTableViewSet, basename='table')

urlpatterns = [
    # Auth endpoints
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/pin-login/', PinLoginView.as_view(), name='pin-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),

    # Router URLs
    path('', include(router.urls)),
]

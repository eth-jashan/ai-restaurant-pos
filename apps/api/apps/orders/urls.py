from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, KOTViewSet

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='order')
router.register(r'kots', KOTViewSet, basename='kot')

urlpatterns = [
    path('', include(router.urls)),
]

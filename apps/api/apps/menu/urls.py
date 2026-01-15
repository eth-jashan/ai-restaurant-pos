from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    MenuItemViewSet,
    ModifierGroupViewSet,
    ModifierViewSet,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'items', MenuItemViewSet, basename='menu-item')
router.register(r'modifier-groups', ModifierGroupViewSet, basename='modifier-group')
router.register(r'modifiers', ModifierViewSet, basename='modifier')

urlpatterns = [
    path('', include(router.urls)),
]

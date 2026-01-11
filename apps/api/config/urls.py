"""
URL configuration for OrderMind API.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.core.urls')),
    path('api/v1/menu/', include('apps.menu.urls')),
    path('api/v1/orders/', include('apps.orders.urls')),
    path('api/v1/billing/', include('apps.billing.urls')),
    path('api/v1/ai/', include('apps.ai.urls')),
]

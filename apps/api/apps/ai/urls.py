from django.urls import path
from .views import AIParseView, AIConfirmView, AICancelView

urlpatterns = [
    path('parse/', AIParseView.as_view(), name='ai-parse'),
    path('confirm/', AIConfirmView.as_view(), name='ai-confirm'),
    path('cancel/', AICancelView.as_view(), name='ai-cancel'),
]

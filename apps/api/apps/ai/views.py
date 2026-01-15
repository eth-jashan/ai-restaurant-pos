from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import AIService


class AIParseView(APIView):
    """Parse and process AI commands."""

    def post(self, request):
        message = request.data.get('message', '').strip()
        conversation_id = request.data.get('conversation_id')

        if not message:
            return Response(
                {'error': 'Message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ai_service = AIService(
            restaurant=request.user.restaurant,
            user=request.user
        )

        result = ai_service.process_message(message, conversation_id)

        return Response({
            'success': True,
            'data': result
        })


class AIConfirmView(APIView):
    """Confirm a pending AI action."""

    def post(self, request):
        action_id = request.data.get('action_id')
        changes = request.data.get('changes', [])

        if not changes:
            return Response(
                {'error': 'No changes to apply'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Apply price updates
        from apps.menu.models import MenuItem
        from decimal import Decimal

        updated = 0
        for change in changes:
            try:
                item = MenuItem.objects.get(
                    id=change['itemId'],
                    restaurant=request.user.restaurant
                )
                item.base_price = Decimal(str(change['newPrice']))
                item.save()
                updated += 1
            except MenuItem.DoesNotExist:
                continue

        return Response({
            'success': True,
            'data': {
                'updated_count': updated,
                'message': f"Successfully updated {updated} item(s)."
            }
        })


class AICancelView(APIView):
    """Cancel a pending AI action."""

    def post(self, request):
        action_id = request.data.get('action_id')

        return Response({
            'success': True,
            'data': {'message': 'Action cancelled.'}
        })

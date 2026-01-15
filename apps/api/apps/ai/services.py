import re
import json
from decimal import Decimal
from django.conf import settings
from django.db.models import Sum, Count
from django.utils import timezone
from apps.menu.models import MenuItem, Category
from apps.orders.models import Order
from apps.billing.models import Invoice
from .models import AIConversation, AIMessage, AIAction


# Intent constants
INTENTS = {
    'MENU_PRICE_UPDATE': 'MENU_PRICE_UPDATE',
    'MENU_AVAILABILITY_TOGGLE': 'MENU_AVAILABILITY_TOGGLE',
    'SALES_QUERY_TODAY': 'SALES_QUERY_TODAY',
    'TOP_SELLERS': 'TOP_SELLERS',
    'TABLE_LIST': 'TABLE_LIST',
    'MENU_SEARCH': 'MENU_SEARCH',
    'GREETING': 'GREETING',
    'HELP': 'HELP',
    'UNKNOWN': 'UNKNOWN',
}

# Quick pattern matching for common commands
QUICK_PATTERNS = [
    # 86 command (mark unavailable)
    (r'86\s+(?:the\s+)?(.+)', 'MENU_AVAILABILITY_TOGGLE', lambda m: {'items': [m.group(1).strip()], 'available': False}),

    # Mark available
    (r'(?:mark|make)\s+(.+?)\s+(?:available|back)', 'MENU_AVAILABILITY_TOGGLE', lambda m: {'items': [m.group(1).strip()], 'available': True}),

    # Price increase
    (r'(?:increase|raise|up)\s+(.+?)\s+(?:by|to)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(%)?', 'MENU_PRICE_UPDATE',
     lambda m: {'target': m.group(1).strip(), 'modifier': 'INCREMENT', 'value': float(m.group(2)), 'is_percentage': bool(m.group(3))}),

    # Price decrease
    (r'(?:decrease|reduce|lower|drop)\s+(.+?)\s+(?:by|to)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(%)?', 'MENU_PRICE_UPDATE',
     lambda m: {'target': m.group(1).strip(), 'modifier': 'DECREMENT', 'value': float(m.group(2)), 'is_percentage': bool(m.group(3))}),

    # Sales query
    (r'(?:how\'?s?\s+)?(?:today|sales|revenue|business)', 'SALES_QUERY_TODAY', lambda m: {}),

    # Top sellers
    (r'(?:top|best)\s*(?:seller|selling|item)', 'TOP_SELLERS', lambda m: {}),

    # Greeting
    (r'^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))', 'GREETING', lambda m: {}),

    # Help
    (r'^(?:help|what\s+can\s+you\s+do|\?)', 'HELP', lambda m: {}),
]


def match_quick_pattern(message: str):
    """Try quick pattern matching before using AI."""
    message_lower = message.lower().strip()

    for pattern, intent, extractor in QUICK_PATTERNS:
        match = re.search(pattern, message_lower, re.IGNORECASE)
        if match:
            return {
                'intent': intent,
                'entities': extractor(match),
                'confidence': 1.0
            }
    return None


def parse_with_gemini(message: str, context: dict) -> dict:
    """Parse intent using Gemini AI."""
    if not settings.GEMINI_API_KEY:
        return {
            'intent': INTENTS['UNKNOWN'],
            'entities': {},
            'confidence': 0,
            'needs_clarification': True,
            'clarification_question': 'AI features require Gemini API key.'
        }

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        model = genai.GenerativeModel('gemini-1.5-flash')

        prompt = f"""You are a restaurant POS AI assistant. Parse the following user message and extract intent and entities.

Restaurant: {context.get('restaurant_name', 'Restaurant')}
Categories: {', '.join(context.get('categories', []))}

User message: "{message}"

Respond with a JSON object containing:
- intent: One of {list(INTENTS.keys())}
- entities: Relevant extracted data
- confidence: 0-1 confidence score

Example intents:
- MENU_PRICE_UPDATE: Update prices (entities: target, modifier, value, is_percentage)
- MENU_AVAILABILITY_TOGGLE: Mark items available/unavailable (entities: items, available)
- SALES_QUERY_TODAY: Query today's sales
- TOP_SELLERS: Get best selling items

Respond only with valid JSON."""

        response = model.generate_content(prompt)
        result = json.loads(response.text)
        return result

    except Exception as e:
        print(f"Gemini error: {e}")
        return {
            'intent': INTENTS['UNKNOWN'],
            'entities': {},
            'confidence': 0,
            'needs_clarification': True
        }


class AIService:
    """AI service for processing natural language commands."""

    def __init__(self, restaurant, user):
        self.restaurant = restaurant
        self.user = user

    def process_message(self, message: str, conversation_id: str = None) -> dict:
        """Process a user message and return response."""
        start_time = timezone.now()

        # Get or create conversation
        if conversation_id:
            conversation = AIConversation.objects.filter(
                id=conversation_id, restaurant=self.restaurant
            ).first()
        else:
            conversation = AIConversation.objects.create(
                restaurant=self.restaurant,
                user=self.user
            )

        # Try quick pattern matching first
        result = match_quick_pattern(message)

        if not result:
            # Use Gemini for complex parsing
            categories = list(self.restaurant.categories.values_list('name', flat=True))
            result = parse_with_gemini(message, {
                'restaurant_name': self.restaurant.name,
                'categories': categories
            })

        intent = result.get('intent', INTENTS['UNKNOWN'])
        entities = result.get('entities', {})

        # Save user message
        AIMessage.objects.create(
            conversation=conversation,
            role='USER',
            content=message,
            intent=intent,
            confidence=result.get('confidence', 0),
            entities=entities
        )

        # Handle intent
        response = self._handle_intent(intent, entities)

        # Save assistant message
        processing_time = int((timezone.now() - start_time).total_seconds() * 1000)
        AIMessage.objects.create(
            conversation=conversation,
            role='ASSISTANT',
            content=response['message'],
            intent=intent,
            processing_time=processing_time
        )

        return {
            'conversation_id': str(conversation.id),
            **response
        }

    def _handle_intent(self, intent: str, entities: dict) -> dict:
        """Handle different intents."""
        handlers = {
            INTENTS['MENU_AVAILABILITY_TOGGLE']: self._handle_availability_toggle,
            INTENTS['MENU_PRICE_UPDATE']: self._handle_price_update,
            INTENTS['SALES_QUERY_TODAY']: self._handle_sales_query,
            INTENTS['TOP_SELLERS']: self._handle_top_sellers,
            INTENTS['GREETING']: self._handle_greeting,
            INTENTS['HELP']: self._handle_help,
        }

        handler = handlers.get(intent)
        if handler:
            return handler(entities)

        return {
            'message': "I couldn't understand that. Try asking me to update prices, mark items available/unavailable, or check today's sales.",
            'intent': intent,
            'requires_confirmation': False
        }

    def _handle_availability_toggle(self, entities: dict) -> dict:
        """Handle availability toggle."""
        items = entities.get('items', [])
        available = entities.get('available', False)

        if not items:
            return {
                'message': "Which items would you like to update?",
                'intent': INTENTS['MENU_AVAILABILITY_TOGGLE'],
                'requires_confirmation': False
            }

        # Find and update items
        from django.db.models import Q
        query = Q()
        for name in items:
            query |= Q(name__icontains=name)

        updated_items = MenuItem.objects.filter(
            restaurant=self.restaurant
        ).filter(query)

        count = updated_items.update(is_available=available)
        item_names = list(updated_items.values_list('name', flat=True))

        action = "available" if available else "86'd (unavailable)"

        return {
            'message': f"Done! {count} item(s) now {action}: {', '.join(item_names)}",
            'intent': INTENTS['MENU_AVAILABILITY_TOGGLE'],
            'requires_confirmation': False
        }

    def _handle_price_update(self, entities: dict) -> dict:
        """Handle price update (preview only, requires confirmation)."""
        target = entities.get('target', '')
        modifier = entities.get('modifier', 'INCREMENT')
        value = Decimal(str(entities.get('value', 0)))
        is_percentage = entities.get('is_percentage', False)

        # Find items
        items = MenuItem.objects.filter(
            restaurant=self.restaurant
        ).filter(
            Q(name__icontains=target) | Q(category__name__icontains=target)
        )

        if not items.exists():
            return {
                'message': f"Couldn't find items matching '{target}'.",
                'intent': INTENTS['MENU_PRICE_UPDATE'],
                'requires_confirmation': False
            }

        # Calculate preview
        changes = []
        for item in items[:10]:  # Limit preview
            old_price = item.base_price
            if modifier == 'INCREMENT':
                if is_percentage:
                    new_price = old_price * (1 + value / 100)
                else:
                    new_price = old_price + value
            else:
                if is_percentage:
                    new_price = old_price * (1 - value / 100)
                else:
                    new_price = old_price - value

            changes.append({
                'itemId': str(item.id),
                'itemName': item.name,
                'oldPrice': float(old_price),
                'newPrice': float(max(0, new_price))
            })

        change_text = f"{value}%" if is_percentage else f"₹{value}"
        action = "increase" if modifier == 'INCREMENT' else "decrease"

        return {
            'message': f"Found {items.count()} item(s) matching '{target}'. Ready to {action} by {change_text}:",
            'intent': INTENTS['MENU_PRICE_UPDATE'],
            'requires_confirmation': True,
            'preview': {
                'type': 'PRICE_UPDATE',
                'changes': changes
            }
        }

    def _handle_sales_query(self, entities: dict) -> dict:
        """Handle today's sales query."""
        today = timezone.now().date()

        invoices = Invoice.objects.filter(
            restaurant=self.restaurant,
            generated_at__date=today,
            status='PAID'
        )

        orders = Order.objects.filter(
            restaurant=self.restaurant,
            created_at__date=today,
            status__in=['COMPLETED', 'SERVED']
        )

        total_revenue = invoices.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        total_orders = orders.count()
        total_covers = orders.aggregate(Sum('covers'))['covers__sum'] or 0
        avg_ticket = total_revenue / total_orders if total_orders > 0 else 0

        hour = timezone.now().hour
        greeting = "morning" if hour < 12 else "afternoon" if hour < 17 else "evening"

        return {
            'message': f"""Here's your {greeting} update:

**Revenue:** ₹{total_revenue:,.2f}
**Orders:** {total_orders}
**Covers:** {total_covers}
**Avg Ticket:** ₹{avg_ticket:.2f}""",
            'intent': INTENTS['SALES_QUERY_TODAY'],
            'requires_confirmation': False
        }

    def _handle_top_sellers(self, entities: dict) -> dict:
        """Handle top sellers query."""
        today = timezone.now().date()

        from apps.orders.models import OrderItem
        top_items = OrderItem.objects.filter(
            order__restaurant=self.restaurant,
            order__created_at__date=today,
            order__status__in=['COMPLETED', 'SERVED']
        ).values('name').annotate(
            qty=Sum('quantity'),
            revenue=Sum('total_price')
        ).order_by('-qty')[:5]

        if not top_items:
            return {
                'message': "No sales data available for today yet.",
                'intent': INTENTS['TOP_SELLERS'],
                'requires_confirmation': False
            }

        items_list = '\n'.join([
            f"{i+1}. **{item['name']}** - {item['qty']} sold (₹{item['revenue']:,.2f})"
            for i, item in enumerate(top_items)
        ])

        return {
            'message': f"**Top Sellers Today:**\n\n{items_list}",
            'intent': INTENTS['TOP_SELLERS'],
            'requires_confirmation': False
        }

    def _handle_greeting(self, entities: dict) -> dict:
        """Handle greeting."""
        hour = timezone.now().hour
        greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"

        return {
            'message': f"{greeting}! I'm your AI assistant. How can I help you today?",
            'intent': INTENTS['GREETING'],
            'requires_confirmation': False
        }

    def _handle_help(self, entities: dict) -> dict:
        """Handle help request."""
        return {
            'message': """I can help you with:

**Menu Management:**
• "Increase burger prices by ₹20"
• "Raise starters by 10%"
• "86 the paneer tikka" (mark unavailable)
• "Mark biryani available"

**Sales & Analytics:**
• "How's today going?"
• "What are the top sellers?"

Just type naturally and I'll help!""",
            'intent': INTENTS['HELP'],
            'requires_confirmation': False
        }

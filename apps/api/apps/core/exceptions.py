from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """Custom exception handler for consistent error responses."""
    response = exception_handler(exc, context)

    if response is not None:
        custom_response = {
            'success': False,
            'error': {
                'code': response.status_code,
                'message': get_error_message(response),
                'details': response.data if isinstance(response.data, dict) else {'detail': response.data}
            }
        }
        response.data = custom_response

    return response


def get_error_message(response):
    """Extract a user-friendly error message."""
    if isinstance(response.data, dict):
        if 'detail' in response.data:
            return str(response.data['detail'])
        # Get first error message
        for key, value in response.data.items():
            if isinstance(value, list) and len(value) > 0:
                return f"{key}: {value[0]}"
            return f"{key}: {value}"
    return str(response.data)

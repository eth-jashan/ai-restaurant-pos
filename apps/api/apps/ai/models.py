import uuid
from django.db import models
from apps.core.models import Restaurant, User


class AIConversation(models.Model):
    """AI conversation session."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='ai_conversations'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ai_conversations'
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ai_conversations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Conversation {self.id}"


class AIMessage(models.Model):
    """Message in an AI conversation."""

    class Role(models.TextChoices):
        USER = 'USER', 'User'
        ASSISTANT = 'ASSISTANT', 'Assistant'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        AIConversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )

    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()

    intent = models.CharField(max_length=50, blank=True)
    confidence = models.FloatField(default=0)
    entities = models.JSONField(default=dict, blank=True)
    action_taken = models.JSONField(null=True, blank=True)

    processing_time = models.PositiveIntegerField(default=0, help_text='In milliseconds')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_messages'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."


class AIAction(models.Model):
    """Actions performed by AI."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='ai_actions'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ai_actions'
    )

    action_type = models.CharField(max_length=50)
    target_entity = models.CharField(max_length=50)
    previous_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)

    is_confirmed = models.BooleanField(default=False)
    is_reverted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_actions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action_type} on {self.target_entity}"

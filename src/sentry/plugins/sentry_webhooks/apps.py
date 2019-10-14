from __future__ import absolute_import

from django.apps import AppConfig


class PluginsSentryWebhooksAppConfig(AppConfig):
    name = "sentry.plugins.sentry_webhooks"

    def ready(self):
        from .plugin import WebHooksPlugin
        from sentry.plugins import register

        register(WebHooksPlugin)

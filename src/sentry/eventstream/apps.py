from __future__ import absolute_import

from django.apps import AppConfig


class EventstreamAppConfig(AppConfig):
    name = "sentry.eventstream"

    def ready(self):
        from django.conf import settings

        from sentry.utils.services import LazyServiceWrapper

        from .base import EventStream

        backend = LazyServiceWrapper(
            EventStream, settings.SENTRY_EVENTSTREAM, settings.SENTRY_EVENTSTREAM_OPTIONS
        )
        backend.expose(locals())

from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb

from sentry.api.base import StatsMixin
from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission

from sentry.models import SentryAppInstallation


class SentryAppStatsEndpoint(SentryAppBaseEndpoint, StatsMixin):
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request, sentry_app):
        """
        :qparam float since
        :qparam float until
        :qparam resolution - optional
        """

        query_args = self._parse_args(request)

        installations = SentryAppInstallation.with_deleted.filter(
            sentry_app=sentry_app, date_added__range=(query_args["start"], query_args["end"])
        ).values_list("date_added", "date_deleted", "organization_id")
        install_count = SentryAppInstallation.with_deleted.filter(sentry_app=sentry_app).count()
        uninstall_count = SentryAppInstallation.with_deleted.filter(
            sentry_app=sentry_app, date_deleted__isnull=False
        ).count()

        rollup, series = tsdb.get_optimal_rollup_series(query_args["start"], query_args["end"])

        install_stats = dict.fromkeys(series, 0)
        uninstall_stats = dict.fromkeys(series, 0)

        for date_added, date_deleted, organization_id in installations:
            install_norm_epoch = tsdb.normalize_to_epoch(date_added, rollup)
            if install_norm_epoch in install_stats:
                install_stats[install_norm_epoch] += 1

            if date_deleted is not None:
                uninstall_norm_epoch = tsdb.normalize_to_epoch(date_deleted, rollup)
                if uninstall_norm_epoch in uninstall_stats:
                    uninstall_stats[uninstall_norm_epoch] += 1

        result = {
            "total_installs": install_count,
            "total_uninstalls": uninstall_count,
            "install_stats": sorted(install_stats.items(), key=lambda x: x[0]),
            "uninstall_stats": sorted(uninstall_stats.items(), key=lambda x: x[0]),
        }

        return Response(result)

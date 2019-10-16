import Reflux from 'reflux';

import OrganizationActions from 'app/actions/organizationActions';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'app/constants';

const OrganizationStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(OrganizationActions.update, this.onUpdate);
    this.listenTo(OrganizationActions.fetchOrg, this.reset);
    this.listenTo(OrganizationActions.fetchOrgError, this.onFetchOrgError);
  },

  reset() {
    this.loading = true;
    this.error = null;
    this.errorType = null;
    this.organization = null;
  },

  onUpdate(updatedOrg) {
    this.loading = false;
    this.error = null;
    this.errorType = null;
    this.organization = {...this.organization, ...updatedOrg};
    this.trigger(this.get());
  },

  onFetchOrgError(err) {
    this.organization = null;
    this.errorType = null;

    switch (err.statusText) {
      case 'NOT FOUND':
        this.errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND;
        break;
      default:
    }
    this.loading = false;
    this.error = err;
    this.trigger(this.get());
  },

  get() {
    return {
      organization: this.organization,
      error: this.error,
      loading: this.loading,
      errorType: this.errorType,
    };
  },
});

export default OrganizationStore;

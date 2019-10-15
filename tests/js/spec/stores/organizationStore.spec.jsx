import OrganizationStore from 'app/stores/organizationStore';
import OrganizationActions from 'app/actions/organizationActions';
import {updateOrganization} from 'app/actionCreators/organizations';

describe('OrganizationStore', function() {
  beforeEach(function() {
    OrganizationStore.reset();
  });

  it('starts with loading state', function() {
    expect(OrganizationStore.get()).toMatchObject({
      loading: true,
      error: null,
      errorType: null,
      organization: null,
    });
  });

  it('updates correctly', async function() {
    const organization = TestStubs.Organization();
    OrganizationActions.fetchOrgSuccess(organization);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
    });

    // updates
    organization.slug = 'a new slug';
    OrganizationActions.fetchOrgSuccess(organization);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
    });
  });

  it('updates correctly from setting changes', async function() {
    const organization = TestStubs.Organization();
    updateOrganization(organization);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
    });
  });

  it('errors correctly', async function() {
    const error = new Error('uh-oh');
    error.statusText = 'NOT FOUND';
    OrganizationActions.fetchOrgError(error);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error,
      errorType: 'ORG_NOT_FOUND',
      organization: null,
    });
  });
});

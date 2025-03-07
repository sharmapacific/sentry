import React from 'react';
import {mount} from 'sentry-test/enzyme';

import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';
import GroupEventDetailsContainer from 'app/views/organizationGroupDetails/groupEventDetails';

jest.mock(
  'app/views/organizationGroupDetails/groupEventDetails/groupEventDetails',
  () => () => <div>GroupEventDetails</div>
);

describe('groupEventDetailsContainer', () => {
  const org = TestStubs.Organization();

  beforeEach(() => {
    OrganizationEnvironmentsStore.init();
  });

  it('fetches environments', async function() {
    const environmentsCall = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      body: TestStubs.Environments(),
    });
    const wrapper = mount(<GroupEventDetailsContainer organization={org} />);
    // should be in loading state
    expect(wrapper.find('LoadingIndicator').exists()).toBe(true);
    await tick();
    await tick();
    wrapper.update();
    // should be loaded
    expect(wrapper.find('LoadingIndicator').exists()).toBe(false);
    expect(wrapper.text('GroupEventDetails')).toBe('GroupEventDetails');

    // remounting will not rerender
    const wrapper2 = mount(<GroupEventDetailsContainer organization={org} />);
    expect(wrapper2.find('LoadingIndicator').exists()).toBe(false);
    expect(wrapper.text('GroupEventDetails')).toBe('GroupEventDetails');
    expect(environmentsCall).toHaveBeenCalledTimes(1);
  });

  it('displays an error on error', async function() {
    const environmentsCall = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      statusCode: 400,
    });
    const wrapper = mount(<GroupEventDetailsContainer organization={org} />);
    expect(wrapper.find('LoadingIndicator').exists()).toBe(true);
    await tick();
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator').exists()).toBe(false);
    expect(wrapper.find('LoadingError').exists()).toBe(true);
    expect(environmentsCall).toHaveBeenCalledTimes(1);
  });

  it('displays an error on falsey environment', async function() {
    const environmentsCall = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      body: null,
    });
    const wrapper = mount(<GroupEventDetailsContainer organization={org} />);
    expect(wrapper.find('LoadingIndicator').exists()).toBe(true);
    await tick();
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator').exists()).toBe(false);
    expect(wrapper.find('LoadingError').exists()).toBe(true);
    expect(environmentsCall).toHaveBeenCalledTimes(1);
  });
});

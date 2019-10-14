import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select';
import React from 'react';

import {Form, SelectField} from 'app/components/forms';

describe('SelectField', function() {
  it('renders without form context', function() {
    const wrapper = mountWithTheme(
      <SelectField
        options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
        name="fieldName"
        value="a"
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with flat choices', function() {
    const wrapper = shallow(<SelectField choices={['a', 'b', 'c']} name="fieldName" />, {
      context: {
        form: {
          data: {
            fieldName: 'fieldValue',
          },
          errors: {},
        },
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with paired choices', function() {
    const wrapper = shallow(
      <SelectField
        choices={[['a', 'abc'], ['b', 'bcd'], ['c', 'cde']]}
        name="fieldName"
      />,
      {
        context: {
          form: {
            data: {
              fieldName: 'fieldValue',
            },
            errors: {},
          },
        },
      }
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('can change value and submit', function() {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Form onSubmit={mock}>
        <SelectField
          options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
          name="fieldName"
        />
      </Form>,
      TestStubs.routerContext()
    );
    selectByValue(wrapper, 'a', {name: 'fieldName'});
    wrapper.find('Form').simulate('submit');
    expect(mock).toHaveBeenCalledWith(
      {fieldName: 'a'},
      expect.anything(),
      expect.anything()
    );
  });

  describe('Multiple', function() {
    it('selects multiple values and submits', function() {
      const mock = jest.fn();
      const wrapper = mountWithTheme(
        <Form onSubmit={mock}>
          <SelectField
            multiple
            options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
            name="fieldName"
          />
        </Form>,
        TestStubs.routerContext()
      );
      selectByValue(wrapper, 'a', {name: 'fieldName'});
      wrapper.find('Form').simulate('submit');
      expect(mock).toHaveBeenCalledWith(
        {fieldName: ['a']},
        expect.anything(),
        expect.anything()
      );
    });
  });
});

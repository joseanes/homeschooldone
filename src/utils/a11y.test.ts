import { buttonRole } from './a11y';

const keyEvent = (key: string, sameTarget = true) => {
  const el = {};
  return { key, target: el, currentTarget: sameTarget ? el : {}, preventDefault: jest.fn() } as any;
};

describe('buttonRole', () => {
  it('is focusable and announced as a button', () => {
    const props = buttonRole(() => {});
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
  });

  it('activates on Enter and Space', () => {
    const onActivate = jest.fn();
    const props = buttonRole(onActivate);
    props.onKeyDown(keyEvent('Enter'));
    props.onKeyDown(keyEvent(' '));
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys and keys from nested controls', () => {
    const onActivate = jest.fn();
    const props = buttonRole(onActivate);
    props.onKeyDown(keyEvent('a'));
    props.onKeyDown(keyEvent('Enter', false));
    expect(onActivate).not.toHaveBeenCalled();
  });
});

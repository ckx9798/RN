import { Linking } from 'react-native';
import { createOnShouldStartLoadWithRequest } from 'react-native-webview/src/WebViewShared';

import { decideNavigation, WEBVIEW_ORIGIN_WHITELIST } from '@/features/web-navigation';

it('실제 WebView 래퍼에서도 차단 URL이 외부 앱으로 우회되지 않는다', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  const decide = jest.fn((request) => decideNavigation(request.url, 'https://app.example.com') === 'allow');
  const load = jest.fn();
  const handle = createOnShouldStartLoadWithRequest(load, WEBVIEW_ORIGIN_WHITELIST, decide);
  for (const url of ['http://app.example.com/private', 'tel:12345', 'file:///private/image.jpg']) {
    handle({ nativeEvent: { url, lockIdentifier: 1 } } as Parameters<typeof handle>[0]);
    expect(load).toHaveBeenLastCalledWith(false, url, 1);
  }
  await Promise.resolve();
  await Promise.resolve();
  expect(decide).toHaveBeenCalledTimes(3);
  expect(open).not.toHaveBeenCalled();
  expect(canOpen).not.toHaveBeenCalled();
  open.mockRestore();
  canOpen.mockRestore();
});
